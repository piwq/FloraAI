import requests
import base64
import os
from django.core.files.base import ContentFile


def analyze_plant_image(image_file, conf, iou, imgsz):
    files = {'file': (image_file.name, image_file.read(), image_file.content_type)}
    data_payload = {'conf': conf, 'iou': iou, 'imgsz': imgsz}

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


def get_annotated_image(image_file, conf, iou, imgsz, color_leaf="#16A34A", color_root="#9333EA", color_stem="#2563EB"):
    try:
        filename = os.path.basename(image_file.name)
        file_content = image_file.read()

        files = {'file': (filename, file_content, 'image/jpeg')}
        # Передаем цвета в ML-сервис
        data_payload = {
            'conf': conf, 'iou': iou, 'imgsz': imgsz,
            'color_leaf': color_leaf, 'color_root': color_root, 'color_stem': color_stem
        }

        response = requests.post("http://flora_ml:8001/annotate", files=files, data=data_payload, timeout=120)

        if response.status_code == 200:
            img_b64 = response.json().get('annotated_image_base64')
            if img_b64:
                image_data = base64.b64decode(img_b64)
                return ContentFile(image_data, name=f"annotated_{filename}")
    except Exception as e:
        print(f"ML Annotate Error: {e}")

    return None