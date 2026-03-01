import os
from fastapi import FastAPI, UploadFile, File, Form
from ultralytics import YOLO
import cv2
import numpy as np
from skimage.morphology import skeletonize

app = FastAPI()

# Загружаем модель сегментации
model = YOLO("best.pt")

# --- 1. ЧИТАЕМ НАСТРОЙКИ ИЗ .env ---
YOLO_CONF = float(os.getenv("YOLO_CONF", 0.25))
YOLO_IOU = float(os.getenv("YOLO_IOU", 0.7))
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", 640))

MM_PER_PIXEL = float(os.getenv("CALIB_MM_PER_PX", 0.106822))
CM2_PER_PIXEL = float(os.getenv("CALIB_CM2_PER_PX", 0.000114))

# --- 2. КАЛИБРОВКА КАМЕРЫ ---
CAMERA_MATRIX = np.array([
    [16801.23224837294, 0.0, 984.2194327484033],
    [0.0, 16782.95796193301, 837.8788984440081],
    [0.0, 0.0, 1.0]
])
DIST_COEFFS = np.array(
    [[-2.2404900497641926, 511.3571899037416, 0.06893033027219728, 0.11857984578290878, 2.2260582173175907]])


@app.post("/predict")
async def predict_plant(file: UploadFile = File(...),
                        conf: float = Form(float(os.getenv("YOLO_CONF", 0.25))),
                        iou: float = Form(float(os.getenv("YOLO_IOU", 0.7))),
                        imgsz: int = Form(int(os.getenv("YOLO_IMGSZ", 640)))):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)

    # Сырое фото -> устраняем оптическую дисторсию
    raw_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img = cv2.undistort(raw_img, CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)

    # Предикт YOLO
    results = model(img, conf=conf, iou=iou, imgsz=imgsz)[0]

    # Базовые метрики (сразу добавляем null для картинки, чтобы не ломать парсер Django)
    metrics = {
        "plant_type": "Анализ завершен",
        "leaf_area_cm2": 0.0,
        "root_length_mm": 0.0,
        "stem_length_mm": 0.0,
        "annotated_image_base64": None
    }

    if results.masks is None:
        return metrics

    boxes = results.boxes
    masks = results.masks.data.cpu().numpy()

    leaf_area_px = 0
    root_length_px = 0
    stem_length_px = 0

    # Считаем пиксели по классам
    for i, box in enumerate(boxes):
        cls_id = int(box.cls[0])
        mask = masks[i]

        if cls_id == 0:  # Лист (считаем площадь)
            leaf_area_px += np.sum(mask)
        elif cls_id == 1:  # Корень (скелетизация для вычисления длины по центру)
            skeleton = skeletonize(mask > 0.5)
            root_length_px += np.sum(skeleton)
        elif cls_id == 2:  # Стебель (скелетизация)
            skeleton = skeletonize(mask > 0.5)
            stem_length_px += np.sum(skeleton)

    # Переводим пиксели в реальные единицы измерения
    metrics["leaf_area_cm2"] = float(round(leaf_area_px * CM2_PER_PIXEL, 2))
    metrics["root_length_mm"] = float(round(root_length_px * MM_PER_PIXEL * 1.1, 2))
    metrics["stem_length_mm"] = float(round(stem_length_px * MM_PER_PIXEL * 1.1, 2))

    # --- ОТРИСОВКА ВЫРЕЗАНА ДЛЯ МАКСИМАЛЬНОЙ СКОРОСТИ ---
    # Возвращаем только сырые данные

    return metrics