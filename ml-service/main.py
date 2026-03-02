import os, base64
from fastapi import FastAPI, UploadFile, File, Form
from ultralytics import YOLO
import cv2
import numpy as np
import networkx as nx
from skimage.morphology import skeletonize
from skan import Skeleton, summarize
import torch
app = FastAPI()

print("🚀 Инициализация Flora AI ML Service (с поддержкой DeepScan)...")
model = YOLO("best.pt")

# --- 1. НАСТРОЙКИ ---
YOLO_CONF = float(os.getenv("YOLO_CONF", 0.1))
YOLO_IOU = float(os.getenv("YOLO_IOU", 0.6))
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", 2048))

MM_PER_PIXEL = float(os.getenv("CALIB_MM_PER_PX", 0.106822))
CM2_PER_PIXEL = float(os.getenv("CALIB_CM2_PER_PX", 0.000114))
MIN_ROOT_LENGTH_MM = 2.0
MICRO_SEGMENT_PX = 5

CAMERA_MATRIX = np.array([
    [16801.23224837294, 0.0, 984.2194327484033],
    [0.0, 16782.95796193301, 837.8788984440081],
    [0.0, 0.0, 1.0]
])
DIST_COEFFS = np.array(
    [[-2.2404900497641926, 511.3571899037416, 0.06893033027219728, 0.11857984578290878, 2.2260582173175907]]
)


def get_polygons_from_mask(mask, offset_id=0):
    """Функция извлекает красивые полигоны для React из сырой пиксельной маски"""
    polygons = []
    count = 0
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        if cv2.contourArea(cnt) > 20:  # Отсекаем микро-шумы в 1-2 пикселя
            poly_path = [[int(pt[0][0]), int(pt[0][1])] for pt in cnt]
            count += 1
            polygons.append({"id": offset_id + count, "path": poly_path})
    return polygons, count


def analyze_biomass(img, conf, iou, imgsz, draw_annotation=False, deep_scan=False):
    h, w = img.shape[:2]

    metrics = {
        "status": "Анализ успешно завершен", "leaf_count": 0, "leaf_area_cm2": 0.0,
        "stem_count": 0, "stem_length_mm": 0.0, "root_anchors": 0, "primary_root_len_mm": 0.0,
        "primary_root_vol_mm3": 0.0, "lateral_root_len_mm": 0.0, "lateral_root_vol_mm3": 0.0,
        "total_root_len_mm": 0.0, "total_root_vol_mm3": 0.0, "root_length_mm": 0.0,
        "segments": [], "leaves": [], "stems": [], "annotated_image_base64": None,
        "is_deep_scan": deep_scan
    }

    # === 1. ГЕНЕРАЦИЯ МУТАЦИЙ (TTA) ===
    images_to_process = [img]

    if deep_scan:
        print("🔍 DEEP SCAN АКТИВИРОВАН: Запуск 5-ступенчатого TTA ансамблирования...")
        # Мутация 1: Яркость +
        img_bright = cv2.convertScaleAbs(img, alpha=1.1, beta=15)
        # Мутация 2: Контраст +
        img_contrast = cv2.convertScaleAbs(img, alpha=1.3, beta=0)
        # Мутация 3: CLAHE (Вытягивание деталей из теней)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)
        img_clahe = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
        # Мутация 4: Затемнение (убирает блики)
        img_dark = cv2.convertScaleAbs(img, alpha=0.9, beta=-15)

        images_to_process.extend([img_bright, img_contrast, img_clahe, img_dark])

    # Накопители голосов (каждый пиксель голосует, к какому классу он относится)
    acc_leaf = np.zeros((h, w), dtype=np.uint8)
    acc_root = np.zeros((h, w), dtype=np.uint8)
    acc_stem = np.zeros((h, w), dtype=np.uint8)

    # === 2. ПРОГОН НЕЙРОСЕТИ И ГОЛОСОВАНИЕ ===
    for i, aug_img in enumerate(images_to_process):
        with torch.no_grad():
            res = model(aug_img, conf=conf, iou=iou, imgsz=imgsz, verbose=False)[0]

        if res.masks is not None:
            boxes = res.boxes.cls.cpu().numpy()
            # Переносим маски на CPU сразу в виде массива (тензор -> numpy)
            # YOLO обычно отдает маски в меньшем разрешении (напр. 160x160)
            masks_data = res.masks.data.cpu().numpy()

            for j in range(len(masks_data)):
                cls_id = int(boxes[j])

                # Берем маску конкретного объекта
                mask_pixels = masks_data[j]

                # Бинаризуем (YOLO отдает значения от 0 до 1)
                binary_mask = (mask_pixels > 0.5).astype(np.uint8)

                # РЕЗИНОВЫЙ ТРЮК: Масштабируем маску до размера оригинального фото (h, w)
                # Это НАМНОГО быстрее, чем рисовать через fillPoly
                temp_mask = cv2.resize(binary_mask, (w, h), interpolation=cv2.INTER_NEAREST)

                # Добавляем голос в общую копилку
                if cls_id == 0:
                    acc_leaf += temp_mask
                elif cls_id == 1:
                    acc_root += temp_mask
                elif cls_id == 2:
                    acc_stem += temp_mask

        # 🔥 ВАЖНО: Удаляем результаты из памяти и чистим кеш CUDA после каждого прогона
        del res
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    # === 3. КОНСЕНСУС (ОПРЕДЕЛЯЕМ ФИНАЛЬНУЮ МАСКУ) ===
    # Если обычный режим: достаточно 1 голоса. Если DeepScan: нужно минимум 2 голоса из 5.
    threshold = 2 if deep_scan else 1

    leaf_mask = (acc_leaf >= threshold).astype(np.uint8)
    root_mask = (acc_root >= threshold).astype(np.uint8)
    stem_mask = (acc_stem >= threshold).astype(np.uint8)

    # Извлекаем финальные полигоны для React
    metrics["leaves"], metrics["leaf_count"] = get_polygons_from_mask(leaf_mask, 0)
    metrics["stems"], metrics["stem_count"] = get_polygons_from_mask(stem_mask, 0)

    metrics["leaf_area_cm2"] = float(round(np.sum(leaf_mask) * CM2_PER_PIXEL, 2))

    if np.any(stem_mask):
        stem_skel = skeletonize(stem_mask > 0)
        metrics["stem_length_mm"] = float(round(np.sum(stem_skel) * MM_PER_PIXEL * 1.1, 2))

    # === 4. МАТЕМАТИКА ГРАФОВ (По Идеальной Супер-Маске) ===
    if np.any(root_mask):
        try:
            kernel = np.ones((3, 3), np.uint8)
            root_mask_closed = cv2.morphologyEx(root_mask, cv2.MORPH_CLOSE, kernel)
            dist_transform = cv2.distanceTransform(root_mask_closed, cv2.DIST_L2, 5)
            skeleton_img = skeletonize(root_mask_closed > 0)

            skeleton_obj = Skeleton(skeleton_img)
            branch_data = summarize(skeleton_obj)

            kernel_stem = np.ones((5, 5), np.uint8)
            stem_dilated = cv2.dilate(stem_mask, kernel_stem, iterations=1)

            G = nx.Graph()
            node_to_coords = {}
            anchor_nodes = set()
            valid_branch_indices = []

            for index, row in branch_data.iterrows():
                b_dist = row.get('branch-distance') if 'branch-distance' in row else row.get('branch_distance')
                b_type = row.get('branch-type') if 'branch-type' in row else row.get('branch_type')
                dist_mm = b_dist * MM_PER_PIXEL
                if b_type == 1 and dist_mm < MIN_ROOT_LENGTH_MM: continue

                valid_branch_indices.append(index)
                u = int(row.get('node-id-src') if 'node-id-src' in row else row.get('node_id_src'))
                v = int(row.get('node-id-dst') if 'node-id-dst' in row else row.get('node_id_dst'))
                G.add_edge(u, v, weight=dist_mm, index=index)

                c_src_y = row.get('image-coord-src-0') if 'image-coord-src-0' in row else row.get('image_coord_src_0')
                c_src_x = row.get('image-coord-src-1') if 'image-coord-src-1' in row else row.get('image_coord_src_1')
                c_dst_y = row.get('image-coord-dst-0') if 'image-coord-dst-0' in row else row.get('image_coord_dst_0')
                c_dst_x = row.get('image-coord-dst-1') if 'image-coord-dst-1' in row else row.get('image_coord_dst_1')

                node_to_coords[u] = (int(c_src_y), int(c_src_x))
                node_to_coords[v] = (int(c_dst_y), int(c_dst_x))

            for node_id, (coord_y, coord_x) in node_to_coords.items():
                if 0 <= coord_y < h and 0 <= coord_x < w:
                    if stem_dilated[coord_y, coord_x] > 0:
                        anchor_nodes.add(node_id)

            roots_attached_to_stems = 0
            primary_edges = set()

            for component in nx.connected_components(G):
                subgraph = G.subgraph(component)
                component_anchors = [n for n in component if n in anchor_nodes]
                if component_anchors:
                    start_node = min(component_anchors, key=lambda n: node_to_coords[n][0])
                    roots_attached_to_stems += 1
                else:
                    start_node = min(component, key=lambda n: node_to_coords[n][0])

                try:
                    path_lengths = nx.single_source_dijkstra_path_length(subgraph, start_node, weight='weight')
                    furthest_node = max(path_lengths, key=path_lengths.get)
                    primary_path = nx.shortest_path(subgraph, start_node, furthest_node)
                    for i in range(len(primary_path) - 1):
                        u_edge, v_edge = primary_path[i], primary_path[i + 1]
                        primary_edges.add(subgraph[u_edge][v_edge]['index'])
                except:
                    continue

            metrics["root_anchors"] = roots_attached_to_stems

            for index in valid_branch_indices:
                row = branch_data.loc[index]
                b_dist = row.get('branch-distance') if 'branch-distance' in row else row.get('branch_distance')
                dist_mm = b_dist * MM_PER_PIXEL
                coords = skeleton_obj.path_coordinates(index).astype(int)

                radii = [dist_transform[y, x] for y, x in coords]
                true_rad_px = np.median(radii) if len(radii) >= MICRO_SEGMENT_PX else (np.min(radii) if radii else 0)
                true_rad_mm = true_rad_px * MM_PER_PIXEL
                vol_mm3 = np.pi * (true_rad_mm ** 2) * dist_mm

                is_primary = index in primary_edges
                if is_primary:
                    metrics["primary_root_len_mm"] += dist_mm
                    metrics["primary_root_vol_mm3"] += vol_mm3
                else:
                    metrics["lateral_root_len_mm"] += dist_mm
                    metrics["lateral_root_vol_mm3"] += vol_mm3

                metrics["total_root_len_mm"] += dist_mm
                metrics["total_root_vol_mm3"] += vol_mm3

                segment_data = {
                    "id": int(index),
                    "type": "Стержневой (Первичный)" if is_primary else "Боковой (Латеральный)",
                    "length_mm": round(dist_mm, 2),
                    "thickness_mm": round(true_rad_mm * 2, 3),
                    "volume_mm3": round(vol_mm3, 2),
                    "path": [[int(x), int(y)] for y, x in coords]
                }
                metrics["segments"].append(segment_data)

        except Exception as e:
            print(f"Ошибка анализа графов: {e}")

    metrics["primary_root_len_mm"] = float(round(metrics["primary_root_len_mm"], 2))
    metrics["primary_root_vol_mm3"] = float(round(metrics["primary_root_vol_mm3"], 2))
    metrics["lateral_root_len_mm"] = float(round(metrics["lateral_root_len_mm"], 2))
    metrics["lateral_root_vol_mm3"] = float(round(metrics["lateral_root_vol_mm3"], 2))
    metrics["total_root_len_mm"] = float(round(metrics["total_root_len_mm"], 2))
    metrics["total_root_vol_mm3"] = float(round(metrics["total_root_vol_mm3"], 2))
    metrics["root_length_mm"] = metrics["total_root_len_mm"]

    if draw_annotation:
        return metrics, img.copy()

    return metrics, None


@app.post("/predict")
async def predict_plant(file: UploadFile = File(...),
                        conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                        deep_scan: bool = Form(False)):  # Добавлен флаг
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)
    metrics, _ = analyze_biomass(img, conf, iou, imgsz, False, deep_scan)
    return metrics


@app.post("/annotate")
async def annotate_plant(file: UploadFile = File(...),
                         conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                         deep_scan: bool = Form(False)):  # Добавлен флаг
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)

    # Передаем deep_scan в функцию
    metrics, annotated_frame = analyze_biomass(img, conf, iou, imgsz, True, deep_scan)

    if annotated_frame is None: return {"annotated_image_base64": None}

    _, buffer = cv2.imencode('.jpg', annotated_frame)

    return {
        "annotated_image_base64": base64.b64encode(buffer).decode('utf-8'),
        "segments": metrics.get("segments", []),
        "leaves": metrics.get("leaves", []),
        "stems": metrics.get("stems", []),
        "is_deep_scan": deep_scan
    }