import os
from fastapi import FastAPI, UploadFile, File, Form
from ultralytics import YOLO
from ultralytics.utils.plotting import colors  # Импортируем палитру YOLO
import cv2
import numpy as np
from skimage.morphology import skeletonize
import base64

app = FastAPI()

# Загружаем модель сегментации
model = YOLO("best.pt")

# --- 1. ЧИТАЕМ НАСТРОЙКИ ИЗ .env (с запасными дефолтными значениями) ---
YOLO_CONF = float(os.getenv("YOLO_CONF", 0.25))
YOLO_IOU = float(os.getenv("YOLO_IOU", 0.7))
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", 640))

MM_PER_PIXEL = float(os.getenv("CALIB_MM_PER_PX", 0.106822))
CM2_PER_PIXEL = float(os.getenv("CALIB_CM2_PER_PX", 0.000114))

# --- 2. ИДЕАЛЬНАЯ КАЛИБРОВКА КАМЕРЫ (Матрицы из твоего скрипта) ---
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

    # =====================================================================
    # 🔥 ВОТ ТА САМАЯ СТРОЧКА, ГДЕ МЫ ПЕРЕДАЕМ НАСТРОЙКИ ИЗ .ENV В МОДЕЛЬ:
    # =====================================================================
    results = model(img, conf=conf, iou=iou, imgsz=imgsz)[0]

    metrics = {
        "plant_type": "Анализ завершен",
        "leaf_area_cm2": 0.0,
        "root_length_mm": 0.0,
        "stem_length_mm": 0.0
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

    # --- 3. КРАСИВАЯ ОТРИСОВКА (Только полигоны + стильная легенда) ---

    # Заставляем YOLO нарисовать ТОЛЬКО заливку масок (выключаем рамки и текст)
    annotated_frame = results.plot(labels=False, boxes=False)

    # Создаем полупрозрачную подложку для легенды (черный прямоугольник)
    overlay = annotated_frame.copy()
    cv2.rectangle(overlay, (10, 10), (220, 115), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, annotated_frame, 0.4, 0, annotated_frame)  # Прозрачность 40%

    # Рисуем саму легенду
    y_pos = 35
    legend_texts = {0: "Лист (Leaf)", 1: "Корень (Root)", 2: "Стебель (Stem)"}

    for cls_id, text in legend_texts.items():
        # Достаем точный цвет, которым YOLO красит именно этот класс
        color = colors(cls_id, bgr=True)

        # Квадратик цвета класса + белая рамочка для контраста
        cv2.rectangle(annotated_frame, (20, y_pos - 15), (40, y_pos + 5), color, -1)
        cv2.rectangle(annotated_frame, (20, y_pos - 15), (40, y_pos + 5), (255, 255, 255), 1)

        # Название класса белым шрифтом
        cv2.putText(annotated_frame, text, (55, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
        y_pos += 30

    # --- 4. КОДИРОВАНИЕ И ОТПРАВКА ---
    # Сжимаем готовую картинку с легендой в .jpg и переводим в Base64
    _, buffer = cv2.imencode('.jpg', annotated_frame)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    metrics["annotated_image_base64"] = img_base64

    return metrics