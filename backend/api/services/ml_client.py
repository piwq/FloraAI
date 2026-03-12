import json
import logging
import requests
import base64
import os
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


def _calib_payload(user):
    """Формирует dict с параметрами калибровки пользователя (если есть)."""
    payload = {}
    if user and getattr(user, 'calib_camera_matrix', None):
        payload['camera_matrix_json'] = json.dumps(user.calib_camera_matrix)
    if user and getattr(user, 'calib_dist_coeffs', None):
        payload['dist_coeffs_json'] = json.dumps(user.calib_dist_coeffs)
    if user and getattr(user, 'calib_mm_per_pixel', None):
        payload['user_mm_per_pixel'] = user.calib_mm_per_pixel
    if user and getattr(user, 'calib_cm2_per_pixel', None):
        payload['user_cm2_per_pixel'] = user.calib_cm2_per_pixel
    return payload


def get_available_models():
    try:
        response = requests.get("http://flora_ml:8001/models", timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"ML Models Error: {e}")
    return {"models": []}


def analyze_plant_image(image_file, conf, iou, imgsz, user=None, model_name=None):
    files = {'file': (image_file.name, image_file.read(), image_file.content_type)}
    data_payload = {'conf': conf, 'iou': iou, 'imgsz': imgsz}
    if model_name:
        data_payload['model_name'] = model_name
    data_payload.update(_calib_payload(user))

    annotated_image_content = None

    try:
        response = requests.post("http://flora_ml:8001/predict", files=files, data=data_payload, timeout=40)
        response.raise_for_status()
        response_json = response.json()
        img_b64 = response_json.pop('annotated_image_base64', None)

        if img_b64:
            image_data = base64.b64decode(img_b64)
            annotated_image_content = ContentFile(image_data, name=f"annotated_{image_file.name}")

        return response_json, annotated_image_content
    except requests.ConnectionError:
        logger.error("ML-сервис недоступен (connection refused)")
        raise RuntimeError("ML-сервис недоступен. Попробуйте позже.")
    except requests.Timeout:
        logger.error("ML-сервис не ответил за 40 секунд")
        raise RuntimeError("ML-сервис не ответил вовремя. Попробуйте позже.")
    except Exception as e:
        logger.error(f"ML Error: {e}")
        raise RuntimeError(f"Ошибка анализа: {e}")


def get_annotated_image(image_file, conf, iou, imgsz, color_leaf="#16A34A", color_root="#9333EA", color_stem="#2563EB", deep_scan=False, bake_overlay=False, user=None, model_name=None):
    try:
        filename = os.path.basename(image_file.name)
        file_content = image_file.read()

        files = {'file': (filename, file_content, 'image/jpeg')}
        data_payload = {
            'conf': conf, 'iou': iou, 'imgsz': imgsz,
            'color_leaf': color_leaf, 'color_root': color_root, 'color_stem': color_stem,
            'deep_scan': 'true' if deep_scan else 'false',
            'bake_overlay': 'true' if bake_overlay else 'false',
        }
        if model_name:
            data_payload['model_name'] = model_name
        data_payload.update(_calib_payload(user))

        response = requests.post("http://flora_ml:8001/annotate", files=files, data=data_payload, timeout=120)

        response.raise_for_status()
        resp_json = response.json()
        img_b64 = resp_json.get('annotated_image_base64')
        segments = resp_json.get('segments', [])
        leaves = resp_json.get('leaves', [])
        stems = resp_json.get('stems', [])

        # Все метрики из ML-ответа (кроме тяжёлых полей)
        _skip = {'annotated_image_base64', 'segments', 'leaves', 'stems'}
        extra_metrics = {k: v for k, v in resp_json.items() if k not in _skip}

        if img_b64:
            image_data = base64.b64decode(img_b64)
            return ContentFile(image_data, name=f"annotated_{filename}"), segments, leaves, stems, extra_metrics
    except requests.ConnectionError:
        logger.error("ML-сервис недоступен (annotate)")
        raise RuntimeError("ML-сервис недоступен. Попробуйте позже.")
    except requests.Timeout:
        logger.error("ML-сервис не ответил за 120 секунд (annotate)")
        raise RuntimeError("ML-сервис не ответил вовремя.")
    except Exception as e:
        logger.error(f"ML Annotate Error: {e}")
        raise RuntimeError(f"Ошибка разметки: {e}")


def calibrate_camera(images, rows, cols, square_size_mm):
    """Отправляет фото шахматной доски в ML-сервис для калибровки камеры."""
    files = [('files', (img.name, img.read(), img.content_type)) for img in images]
    data_payload = {'rows': rows, 'cols': cols, 'square_size_mm': square_size_mm}

    try:
        response = requests.post("http://flora_ml:8001/calibrate", files=files, data=data_payload, timeout=60)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"ML Calibrate Error: {e}")

    return {"success": False, "error": "ML-сервис недоступен"}