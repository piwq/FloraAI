import os, base64
from fastapi import FastAPI, UploadFile, File, Form
from ultralytics import YOLO
import cv2
import numpy as np
import networkx as nx
from skimage.morphology import skeletonize
from skan import Skeleton, summarize

app = FastAPI()

# Загружаем модель сегментации
print("🚀 Инициализация Flora AI ML Service...")
model = YOLO("best.pt")

# --- 1. НАСТРОЙКИ ИЗ .env ---
YOLO_CONF = float(os.getenv("YOLO_CONF", 0.1))
YOLO_IOU = float(os.getenv("YOLO_IOU", 0.6))
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", 2048))

MM_PER_PIXEL = float(os.getenv("CALIB_MM_PER_PX", 0.106822))
CM2_PER_PIXEL = float(os.getenv("CALIB_CM2_PER_PX", 0.000114))
MIN_ROOT_LENGTH_MM = 2.0
MICRO_SEGMENT_PX = 5

# --- 2. КАЛИБРОВКА КАМЕРЫ ---
CAMERA_MATRIX = np.array([
    [16801.23224837294, 0.0, 984.2194327484033],
    [0.0, 16782.95796193301, 837.8788984440081],
    [0.0, 0.0, 1.0]
])
DIST_COEFFS = np.array(
    [[-2.2404900497641926, 511.3571899037416, 0.06893033027219728, 0.11857984578290878, 2.2260582173175907]]
)


def hex_to_bgr(hex_color: str):
    hex_color = hex_color.lstrip('#')
    rgb = tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    return (rgb[2], rgb[1], rgb[0])


def analyze_biomass(img, conf, iou, imgsz, draw_annotation=False, colors=None):
    h, w = img.shape[:2]
    results = model(img, conf=conf, iou=iou, imgsz=imgsz)[0]

    # --- РАСШИРЕННЫЕ МЕТРИКИ ДЛЯ ИНТЕРАКТИВНОГО ДАШБОРДА (РУССКИЙ ЯЗЫК) ---
    metrics = {
        "status": "Анализ успешно завершен",
        "plant_type": "Анализ завершен",  # Оставлено для обратной совместимости
        "leaf_count": 0,
        "leaf_area_cm2": 0.0,
        "stem_count": 0,
        "stem_length_mm": 0.0,
        "root_anchors": 0,

        # Раздельные метрики для легенды
        "primary_root_len_mm": 0.0,
        "primary_root_vol_mm3": 0.0,
        "lateral_root_len_mm": 0.0,
        "lateral_root_vol_mm3": 0.0,

        # Общие суммы
        "total_root_len_mm": 0.0,
        "total_root_vol_mm3": 0.0,
        "root_length_mm": 0.0,  # Оставлено для БД Django

        # МАССИВ ДЛЯ ИНТЕРАКТИВНЫХ ТУЛТИПОВ (Hover-эффекты на фронтенде)
        "segments": [],
        "annotated_image_base64": None
    }

    roots_attached_to_stems = 0
    primary_edges = set()
    valid_branch_indices = []

    root_mask = np.zeros((h, w), dtype=np.uint8)
    stem_mask = np.zeros((h, w), dtype=np.uint8)
    leaf_mask = np.zeros((h, w), dtype=np.uint8)

    if draw_annotation:
        output_img = cv2.addWeighted(img, 0.25, np.zeros_like(img), 0.75, 0)
        overlay_masks = np.zeros_like(img)
        c_leaf = colors.get("leaf", (74, 163, 22))
        c_stem = colors.get("stem", (235, 99, 37))
        c_primary = colors.get("root", (0, 0, 255))
        c_lateral = (255, 255, 0)  # Латеральные всегда циановые для контраста

    if results.masks is None:
        return metrics, None

    boxes = results.boxes.cls.cpu().numpy()

    # 1. РАСПРЕДЕЛЕНИЕ МАСОК
    for i, contour in enumerate(results.masks.xy):
        cls_id = int(boxes[i])
        pts = np.array(contour, dtype=np.int32)
        if cls_id == 0:  # Листья
            cv2.fillPoly(leaf_mask, [pts], 1)
            metrics["leaf_count"] += 1
            if draw_annotation:
                cv2.fillPoly(overlay_masks, [pts], c_leaf)
                cv2.polylines(overlay_masks, [pts], True, (255, 255, 255), 1)
        elif cls_id == 1:  # Корни
            cv2.fillPoly(root_mask, [pts], 1)
        elif cls_id == 2:  # Стебли
            cv2.fillPoly(stem_mask, [pts], 1)
            metrics["stem_count"] += 1
            if draw_annotation:
                cv2.fillPoly(overlay_masks, [pts], c_stem)
                cv2.polylines(overlay_masks, [pts], True, (255, 255, 255), 1)

    metrics["leaf_area_cm2"] = float(round(np.sum(leaf_mask) * CM2_PER_PIXEL, 2))

    if np.any(stem_mask):
        stem_skel = skeletonize(stem_mask > 0)
        metrics["stem_length_mm"] = float(round(np.sum(stem_skel) * MM_PER_PIXEL * 1.1, 2))

    if draw_annotation:
        output_img = cv2.addWeighted(overlay_masks, 0.5, output_img, 1.0, 0)

    # 2. ТОПОЛОГИЯ КОРНЕЙ И 3D АНАЛИЗ
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

            # ИНТЕРАКТИВНЫЙ ДАШБОРД: СБОР ДАННЫХ ДЛЯ КАЖДОГО СЕГМЕНТА
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

                # Добавляем в глобальные счетчики
                if is_primary:
                    metrics["primary_root_len_mm"] += dist_mm
                    metrics["primary_root_vol_mm3"] += vol_mm3
                else:
                    metrics["lateral_root_len_mm"] += dist_mm
                    metrics["lateral_root_vol_mm3"] += vol_mm3

                metrics["total_root_len_mm"] += dist_mm
                metrics["total_root_vol_mm3"] += vol_mm3

                # ФОРМИРУЕМ JSON-ОБЪЕКТ ДЛЯ ТУЛТИПА
                segment_data = {
                    "id": int(index),
                    "type": "Стержневой (Первичный)" if is_primary else "Боковой (Латеральный)",
                    "length_mm": round(dist_mm, 2),
                    "thickness_mm": round(true_rad_mm * 2, 3),  # Диаметр
                    "volume_mm3": round(vol_mm3, 2),
                    "path": [[int(x), int(y)] for y, x in coords]  # Для SVG наложения на фронте
                }
                metrics["segments"].append(segment_data)

                # Отрисовка на картинке (без текста)
                if draw_annotation:
                    pts = np.array([[x, y] for y, x in coords], np.int32).reshape((-1, 1, 2))
                    color = c_primary if is_primary else c_lateral
                    cv2.polylines(output_img, [pts], False, color, 4 if is_primary else 2)

        except Exception as e:
            print(f"Ошибка анализа графов: {e}")

    # Округление финальных метрик
    metrics["primary_root_len_mm"] = float(round(metrics["primary_root_len_mm"], 2))
    metrics["primary_root_vol_mm3"] = float(round(metrics["primary_root_vol_mm3"], 2))
    metrics["lateral_root_len_mm"] = float(round(metrics["lateral_root_len_mm"], 2))
    metrics["lateral_root_vol_mm3"] = float(round(metrics["lateral_root_vol_mm3"], 2))
    metrics["total_root_len_mm"] = float(round(metrics["total_root_len_mm"], 2))
    metrics["total_root_vol_mm3"] = float(round(metrics["total_root_vol_mm3"], 2))
    metrics["root_length_mm"] = metrics["total_root_len_mm"]  # Для БД Django

    if draw_annotation:
        return metrics, output_img

    return metrics, None


@app.post("/predict")
async def predict_plant(file: UploadFile = File(...),
                        conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)
    metrics, _ = analyze_biomass(img, conf, iou, imgsz, False)
    return metrics


@app.post("/annotate")
async def annotate_plant(file: UploadFile = File(...),
                         conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                         color_leaf: str = Form("#16A34A"), color_root: str = Form("#9333EA"),
                         color_stem: str = Form("#2563EB")):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)
    colors = {"leaf": hex_to_bgr(color_leaf), "root": hex_to_bgr(color_root), "stem": hex_to_bgr(color_stem)}
    metrics, annotated_frame = analyze_biomass(img, conf, iou, imgsz, True, colors)
    if annotated_frame is None: return {"annotated_image_base64": None}
    _, buffer = cv2.imencode('.jpg', annotated_frame)
    return {
        "annotated_image_base64": base64.b64encode(buffer).decode('utf-8'),
        "segments": metrics.get("segments", [])
    }