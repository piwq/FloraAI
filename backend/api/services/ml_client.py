import json
import requests
import base64
import os
from django.core.files.base import ContentFile


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


def analyze_plant_image(image_file, conf, iou, imgsz, user=None):
    files = {'file': (image_file.name, image_file.read(), image_file.content_type)}
    data_payload = {'conf': conf, 'iou': iou, 'imgsz': imgsz}
    data_payload.update(_calib_payload(user))

    ml_data = {
        "plant_type": "Неизвестно",
        "leaf_area_cm2": 0,
        "root_length_mm": 0,
        "stem_length_mm": 0
    }
    annotated_image_content = None

    try:
        response = requests.post("http://flora_ml:8001/predict", files=files, data=data_payload, timeout=40)
        if response.status_code == 200:
            response_json = response.json()
            img_b64 = response_json.pop('annotated_image_base64', None)

            if img_b64:
                image_data = base64.b64decode(img_b64)
                annotated_image_content = ContentFile(image_data, name=f"annotated_{image_file.name}")

            ml_data = response_json
    except Exception as e:
        print(f"ML Error: {e}")

    return ml_data, annotated_image_content


def get_annotated_image(image_file, conf, iou, imgsz, color_leaf="#16A34A", color_root="#9333EA", color_stem="#2563EB", deep_scan=False, bake_overlay=False, user=None):
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
        data_payload.update(_calib_payload(user))

        response = requests.post("http://flora_ml:8001/annotate", files=files, data=data_payload, timeout=120)

        if response.status_code == 200:
            resp_json = response.json()
            img_b64 = resp_json.get('annotated_image_base64')
            segments = resp_json.get('segments', [])
            leaves = resp_json.get('leaves', [])
            stems = resp_json.get('stems', [])
            extra_metrics = {
                'leaf_area_cm2': resp_json.get('leaf_area_cm2', 0.0),
                'stem_length_mm': resp_json.get('stem_length_mm', 0.0),
                'is_baked': resp_json.get('is_baked', False),
            }
            if img_b64:
                image_data = base64.b64decode(img_b64)
                return ContentFile(image_data, name=f"annotated_{filename}"), segments, leaves, stems, extra_metrics
    except Exception as e:
        print(f"ML Annotate Error: {e}")

    return None, [], [], [], {}


def calibrate_camera(images, rows, cols, square_size_mm):
    """Отправляет фото шахматной доски в ML-сервис для калибровки камеры."""
    files = [('files', (img.name, img.read(), img.content_type)) for img in images]
    data_payload = {'rows': rows, 'cols': cols, 'square_size_mm': square_size_mm}

    try:
        response = requests.post("http://flora_ml:8001/calibrate", files=files, data=data_payload, timeout=60)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"ML Calibrate Error: {e}")

    return {"success": False, "error": "ML-сервис недоступен"}