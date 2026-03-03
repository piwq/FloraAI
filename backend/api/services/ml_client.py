import requests
from django.core.files.base import ContentFile
import base64
import os

ML_SERVICE_URL = os.environ.get('ML_SERVICE_URL', 'http://flora_ml:8001')


def analyze_plant_image(image_file, conf=0.1, iou=0.6, imgsz=2048, scan_mode="express"):
    url = f"{ML_SERVICE_URL}/predict"

    filename = image_file.name if image_file.name else 'image.jpg'
    files = {'file': (filename, image_file.read(), 'image/jpeg')}
    image_file.seek(0)  # Сбрасываем указатель файла

    data = {
        'conf': str(conf),
        'iou': str(iou),
        'imgsz': str(imgsz),
        'scan_mode': scan_mode
    }

    try:
        response = requests.post(url, files=files, data=data, timeout=120)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"ML Predict Error: {e}")

    return None


def get_annotated_image(image_file, conf=0.1, iou=0.6, imgsz=2048, color_leaf="#16A34A", color_root="#9333EA",
                        color_stem="#2563EB", scan_mode="express"):
    url = f"{ML_SERVICE_URL}/annotate"

    filename = image_file.name if image_file.name else 'image.jpg'
    files = {'file': (filename, image_file.read(), 'image/jpeg')}
    image_file.seek(0)  # Сбрасываем указатель файла

    data = {
        'conf': str(conf),
        'iou': str(iou),
        'imgsz': str(imgsz),
        'color_leaf': color_leaf,
        'color_root': color_root,
        'color_stem': color_stem,
        'scan_mode': scan_mode
    }

    try:
        # Увеличиваем таймаут до 120 секунд для UltraScan
        response = requests.post(url, files=files, data=data, timeout=120)

        if response.status_code == 200:
            resp_json = response.json()
            img_b64 = resp_json.get('annotated_image_base64')
            segments = resp_json.get('segments', [])
            leaves = resp_json.get('leaves', [])
            stems = resp_json.get('stems', [])

            if img_b64:
                image_data = base64.b64decode(img_b64)
                return ContentFile(image_data, name=f"annotated_{filename}"), segments, leaves, stems
    except Exception as e:
        print(f"ML Annotate Error: {e}")

    return None, [], [], []