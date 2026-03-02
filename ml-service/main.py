import os, base64
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

def hex_to_bgr(hex_color: str):
    """Конвертирует HEX цвет (#RRGGBB) в формат BGR для OpenCV"""
    hex_color = hex_color.lstrip('#')
    rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return (rgb[2], rgb[1], rgb[0])  # OpenCV использует BGR вместо RGB

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

    metrics["leaf_area_cm2"] = float(round(leaf_area_px * CM2_PER_PIXEL, 2))
    metrics["root_length_mm"] = float(round(root_length_px * MM_PER_PIXEL * 1.1, 2))
    metrics["stem_length_mm"] = float(round(stem_length_px * MM_PER_PIXEL * 1.1, 2))

    return metrics


@app.post("/annotate")
async def annotate_plant(file: UploadFile = File(...),
                         conf: float = Form(float(os.getenv("YOLO_CONF", 0.25))),
                         iou: float = Form(float(os.getenv("YOLO_IOU", 0.7))),
                         imgsz: int = Form(int(os.getenv("YOLO_IMGSZ", 1024))),
                         color_leaf: str = Form("#16A34A"),
                         color_root: str = Form("#9333EA"),
                         color_stem: str = Form("#2563EB")):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)

    raw_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img = cv2.undistort(raw_img, CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)

    # Предсказание
    results = model(img, conf=conf, iou=iou, imgsz=imgsz)[0]

    if results.masks is None:
        return {"annotated_image_base64": None}

    # Маппинг классов на наши новые BGR цвета
    color_map = {
        0: hex_to_bgr(color_leaf),
        1: hex_to_bgr(color_root),
        2: hex_to_bgr(color_stem)
    }

    # Создаем копию картинки для полупрозрачной заливки
    overlay = img.copy()
    boxes = results.boxes.cls.cpu().numpy()

    # 1. Заливаем полигоны цветом на слое overlay
    for i, contour in enumerate(results.masks.xy):
        cls_id = int(boxes[i])
        color = color_map.get(cls_id, (0, 255, 0))
        pts = np.array(contour, dtype=np.int32)
        cv2.fillPoly(overlay, [pts], color)

    # 2. Смешиваем оригинальное фото с цветным слоем (0.4 - это 40% прозрачности)
    annotated_frame = cv2.addWeighted(overlay, 0.4, img, 0.6, 0)

    # 3. Рисуем четкие, НЕпрозрачные контуры поверх уже смешанной картинки
    for i, contour in enumerate(results.masks.xy):
        cls_id = int(boxes[i])
        color = color_map.get(cls_id, (0, 255, 0))
        pts = np.array(contour, dtype=np.int32)
        cv2.polylines(annotated_frame, [pts], isClosed=True, color=color, thickness=2)

    # Кодируем и отправляем
    _, buffer = cv2.imencode('.jpg', annotated_frame)
    encoded_image = base64.b64encode(buffer).decode('utf-8')

    return {"annotated_image_base64": encoded_image}