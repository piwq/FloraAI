from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import cv2
import numpy as np
from skimage.morphology import skeletonize
import base64

app = FastAPI()

# Загружаем обе модели (убедись, что файлы best.pt или seg_model.pt / cls_model.pt лежат рядом)
# Пока используем только твою модель сегментации
model = YOLO("best.pt")

# --- ИДЕАЛЬНАЯ КАЛИБРОВКА КАМЕРЫ ---
CAMERA_MATRIX = np.array([
    [16801.23224837294, 0.0, 984.2194327484033],
    [0.0, 16782.95796193301, 837.8788984440081],
    [0.0, 0.0, 1.0]
])
DIST_COEFFS = np.array(
    [[-2.2404900497641926, 511.3571899037416, 0.06893033027219728, 0.11857984578290878, 2.2260582173175907]])
MM_PER_PIXEL = 0.106822
CM2_PER_PIXEL = 0.000114


@app.post("/predict")
async def predict_plant(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)

    # 1. Читаем сырое фото с искажениями линзы
    raw_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 2. МАГИЯ CV: Устраняем оптическую дисторсию (выравниваем фото)
    img = cv2.undistort(raw_img, CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)

    # 3. Отдаем нейросети идеально плоскую картинку
    results = model(img)[0]

    metrics = {
        "plant_type": "Анализ завершен",  # Заглушка, если нет классификатора
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

    for i, box in enumerate(boxes):
        cls_id = int(box.cls[0])
        mask = masks[i]

        if cls_id == 0:  # Лист -> считаем площадь
            leaf_area_px += np.sum(mask)

        elif cls_id == 1:  # Корень -> скелетизация для точной длины
            skeleton = skeletonize(mask > 0.5)
            root_length_px += np.sum(skeleton)

        elif cls_id == 2:  # Стебель -> скелетизация
            skeleton = skeletonize(mask > 0.5)
            stem_length_px += np.sum(skeleton)

    # 4. РАСЧЕТ ИДЕАЛЬНЫХ МЕТРИК
    metrics["leaf_area_cm2"] = float(round(leaf_area_px * CM2_PER_PIXEL, 2))

    # Коэффициент 1.1 для компенсации диагональных пикселей при скелетизации
    metrics["root_length_mm"] = float(round(root_length_px * MM_PER_PIXEL * 1.1, 2))
    metrics["stem_length_mm"] = float(round(stem_length_px * MM_PER_PIXEL * 1.1, 2))

    if results.masks is not None:
        annotated_frame = results.plot()
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        metrics["annotated_image_base64"] = img_base64

    return metrics