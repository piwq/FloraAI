import os, base64, gc
from fastapi import FastAPI, UploadFile, File, Form
from ultralytics import YOLO
import cv2
import numpy as np
import networkx as nx
from skimage.morphology import skeletonize
from skan import Skeleton, summarize
import torch
from scipy.spatial import cKDTree  # Для пространственного карантина фейковых корней

app = FastAPI()

print("🚀 Инициализация Flora AI ML Service (Ядро v6: MST Topology & Rhizosphere Core Filter)...")
model = YOLO("best.pt")

# --- НАСТРОЙКИ ---
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
    polygons = []
    count = 0
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        if cv2.contourArea(cnt) > 20:
            poly_path = [[int(pt[0][0]), int(pt[0][1])] for pt in cnt]
            count += 1
            polygons.append({"id": offset_id + count, "path": poly_path})
    return polygons, count


def get_sahi_tiles(img, rows=3, cols=3, overlap_ratio=0.15):
    h, w = img.shape[:2]
    tiles = []
    dh = h // rows
    dw = w // cols

    for r in range(rows):
        for c in range(cols):
            overlap_y = int(dh * overlap_ratio)
            overlap_x = int(dw * overlap_ratio)

            y1 = max(0, r * dh - overlap_y)
            y2 = min(h, (r + 1) * dh + overlap_y)
            x1 = max(0, c * dw - overlap_x)
            x2 = min(w, (c + 1) * dw + overlap_x)

            tiles.append((img[y1:y2, x1:x2], y1, x1, y2, x2))
    return tiles


def analyze_biomass(img, conf, iou, imgsz, draw_annotation=False, scan_mode="express"):
    h, w = img.shape[:2]

    metrics = {
        "status": "Анализ успешно завершен", "leaf_count": 0, "leaf_area_cm2": 0.0,
        "stem_count": 0, "stem_length_mm": 0.0, "root_anchors": 0, "primary_root_len_mm": 0.0,
        "primary_root_vol_mm3": 0.0, "lateral_root_len_mm": 0.0, "lateral_root_vol_mm3": 0.0,
        "total_root_len_mm": 0.0, "total_root_vol_mm3": 0.0, "root_length_mm": 0.0,
        "segments": [], "leaves": [], "stems": [], "annotated_image_base64": None,
        "scan_mode": scan_mode
    }

    # === 1. ПОДГОТОВКА ЗАДАЧ (SAHI / TTA) ===
    tasks = []

    if scan_mode == "deep_scan":
        tasks.append((img, 0, 0, h, w))
        tasks.append((cv2.convertScaleAbs(img, alpha=1.1, beta=15), 0, 0, h, w))
        tasks.append((cv2.convertScaleAbs(img, alpha=1.3, beta=0), 0, 0, h, w))
        tasks.append((cv2.convertScaleAbs(img, alpha=0.9, beta=-15), 0, 0, h, w))
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        cl = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
        tasks.append((cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR), 0, 0, h, w))

    elif scan_mode == "ultra_scan":
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        cl = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
        img_clahe = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
        tasks.append((img_clahe, 0, 0, h, w))
        tiles = get_sahi_tiles(img_clahe, rows=3, cols=3, overlap_ratio=0.15)
        tasks.extend(tiles)
    else:
        tasks.append((img, 0, 0, h, w))

    acc_leaf = np.zeros((h, w), dtype=np.float32)
    acc_root = np.zeros((h, w), dtype=np.float32)
    acc_stem = np.zeros((h, w), dtype=np.float32)
    weight_map = np.zeros((h, w), dtype=np.float32)

    for patch_img, y1, x1, y2, x2 in tasks:
        patch_h = y2 - y1
        patch_w = x2 - x1

        weight_map[y1:y2, x1:x2] += 1.0

        with torch.no_grad():
            res = model(patch_img, conf=conf, iou=iou, imgsz=imgsz, verbose=False)[0]

        if res.masks is not None:
            boxes = res.boxes.cls.cpu().numpy()
            for j, contour in enumerate(res.masks.xy):
                cls_id = int(boxes[j])
                if len(contour) > 0:
                    pts = np.array(contour, dtype=np.int32)
                    temp_mask = np.zeros((patch_h, patch_w), dtype=np.float32)
                    cv2.fillPoly(temp_mask, [pts], 1.0)

                    if cls_id == 0:
                        acc_leaf[y1:y2, x1:x2] += temp_mask
                    elif cls_id == 1:
                        acc_root[y1:y2, x1:x2] += temp_mask
                    elif cls_id == 2:
                        acc_stem[y1:y2, x1:x2] += temp_mask

        del res
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    weight_map = np.clip(weight_map, 1.0, None)

    conf_leaf = acc_leaf / weight_map
    conf_root = acc_root / weight_map
    conf_stem = acc_stem / weight_map

    threshold = 0.4 if scan_mode in ["deep_scan", "ultra_scan"] else 0.5

    leaf_mask = (conf_leaf >= threshold).astype(np.uint8)
    root_mask = (conf_root >= threshold).astype(np.uint8)
    stem_mask = (conf_stem >= threshold).astype(np.uint8)

    if scan_mode == "ultra_scan":
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        root_mask = cv2.morphologyEx(root_mask, cv2.MORPH_CLOSE, kernel)

    metrics["leaves"], metrics["leaf_count"] = get_polygons_from_mask(leaf_mask, 0)
    metrics["stems"], metrics["stem_count"] = get_polygons_from_mask(stem_mask, 0)
    metrics["leaf_area_cm2"] = float(round(np.sum(leaf_mask) * CM2_PER_PIXEL, 2))

    if np.any(stem_mask):
        stem_skel = skeletonize(stem_mask > 0)
        metrics["stem_length_mm"] = float(round(np.sum(stem_skel) * MM_PER_PIXEL * 1.1, 2))

    final_edges = set()
    segment_dict = {}

    # === 4. ТОПОЛОГИЯ И МАТЕМАТИКА ГРАФОВ ===
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

            G_raw = nx.Graph()
            node_to_coords = {}
            anchor_nodes = set()

            for index, row in branch_data.iterrows():
                b_dist = row.get('branch-distance') if 'branch-distance' in row else row.get('branch_distance')
                b_type = row.get('branch-type') if 'branch-type' in row else row.get('branch_type')
                dist_mm = b_dist * MM_PER_PIXEL

                coords = skeleton_obj.path_coordinates(index).astype(int)
                radii = [dist_transform[y, x] for y, x in coords]

                if b_type == 1 and dist_mm < MIN_ROOT_LENGTH_MM:
                    continue

                num_pixels = len(coords)
                vol_mm3 = sum(np.pi * ((r * MM_PER_PIXEL) ** 2) * (dist_mm / num_pixels) for r in
                              radii) if num_pixels > 0 else 0.0
                true_rad_mm = (np.mean(radii) if radii else 0) * MM_PER_PIXEL

                segment_dict[index] = {
                    'length_mm': dist_mm, 'thickness_mm': true_rad_mm * 2,
                    'volume_mm3': vol_mm3, 'coords': coords
                }

                u = int(row.get('node-id-src') if 'node-id-src' in row else row.get('node_id_src'))
                v = int(row.get('node-id-dst') if 'node-id-dst' in row else row.get('node_id_dst'))

                # Вес для Дейкстры (Идем по толстым путям)
                thickness_factor = max(true_rad_mm * 2, 0.05)
                cost = dist_mm / (thickness_factor ** 2)

                G_raw.add_edge(u, v, weight=cost, length=dist_mm, index=index)

                node_to_coords[u] = (int(row.get('image-coord-src-0', row.get('image_coord_src_0'))),
                                     int(row.get('image-coord-src-1', row.get('image_coord_src_1'))))
                node_to_coords[v] = (int(row.get('image-coord-dst-0', row.get('image_coord_dst_0'))),
                                     int(row.get('image-coord-dst-1', row.get('image_coord_dst_1'))))

            for node_id, (coord_y, coord_x) in node_to_coords.items():
                if 0 <= coord_y < h and 0 <= coord_x < w and stem_dilated[coord_y, coord_x] > 0:
                    anchor_nodes.add(node_id)

            # --- ЛОГИКА 3: РАЗРЫВ ПЕТЕЛЬ (Minimum Spanning Tree) ---
            # Устраняет появление двойных цветов (наложений) на толстых корнях
            G_mst = nx.Graph()
            for cc in nx.connected_components(G_raw):
                sub = G_raw.subgraph(cc)
                mst = nx.minimum_spanning_tree(sub, weight='weight')
                G_mst = nx.compose(G_mst, mst)

            # --- ЛОГИКА 1: ОПРЕДЕЛЕНИЕ "ЯДРА" РАСТЕНИЯ ---
            components = list(nx.connected_components(G_mst))
            core_nodes = set()

            # Если есть стебель, ядро - это всё, что крепится к стеблю
            if anchor_nodes:
                for c in components:
                    if any(n in anchor_nodes for n in c):
                        core_nodes.update(c)
            # Если стебля нет, ядро - это самый массивный кусок корней
            if not core_nodes and components:
                largest_c = max(components,
                                key=lambda c: sum(G_mst[u][v]['length'] for u, v in G_mst.subgraph(c).edges()))
                core_nodes.update(largest_c)

            # --- ЛОГИКА 2: ПРОСТРАНСТВЕННЫЙ КАРАНТИН ФЕЙКОВ (Rhizosphere Filter) ---
            valid_nodes = set(core_nodes)

            if core_nodes and len(components) > 1:
                # Строим K-d дерево по координатам ядра для сверхбыстрого поиска расстояний
                core_coords = np.array([node_to_coords[n] for n in core_nodes])
                tree = cKDTree(core_coords)

                for c in components:
                    if c.issubset(core_nodes): continue

                    c_coords = np.array([node_to_coords[n] for n in c])
                    # Ищем минимальное расстояние от этого оторванного куска до Ядра
                    distances, _ = tree.query(c_coords)
                    min_dist_mm = np.min(distances) * MM_PER_PIXEL
                    comp_len = sum(G_mst[u][v]['length'] for u, v in G_mst.subgraph(c).edges())

                    # ПРАВИЛО: Если кусок оторван дальше чем на 10мм И его общая длина меньше 40мм -> это БЛИК. Удаляем!
                    if min_dist_mm > 10.0 and comp_len < 40.0:
                        continue
                    valid_nodes.update(c)
            elif not core_nodes:
                for c in components: valid_nodes.update(c)

            # Оставляем только очищенные ребра (без петель и фейков)
            G_valid = G_mst.subgraph(valid_nodes)
            valid_anchor_nodes = anchor_nodes.intersection(valid_nodes)

            for u, v, data in G_valid.edges(data=True):
                final_edges.add(data['index'])

            # Поиск главных (стержневых) корней
            roots_attached_to_stems = 0
            primary_edges = set()

            for component in nx.connected_components(G_valid):
                subgraph = G_valid.subgraph(component)
                component_anchors = [n for n in component if n in valid_anchor_nodes]

                if component_anchors:
                    start_node = min(component_anchors, key=lambda n: node_to_coords[n][0])
                    roots_attached_to_stems += 1
                else:
                    start_node = min(component, key=lambda n: node_to_coords[n][0])

                try:
                    physical_lengths = nx.single_source_dijkstra_path_length(subgraph, start_node, weight='length')
                    if not physical_lengths: continue
                    furthest_node = max(physical_lengths, key=physical_lengths.get)

                    primary_path = nx.shortest_path(subgraph, start_node, furthest_node, weight='weight')
                    for i in range(len(primary_path) - 1):
                        u_edge, v_edge = primary_path[i], primary_path[i + 1]
                        primary_edges.add(subgraph[u_edge][v_edge]['index'])
                except:
                    continue

            metrics["root_anchors"] = roots_attached_to_stems

            # Формируем метрики ТОЛЬКО по валидным корням
            for index in final_edges:
                data = segment_dict[index]
                is_primary = index in primary_edges

                if is_primary:
                    metrics["primary_root_len_mm"] += data['length_mm']
                    metrics["primary_root_vol_mm3"] += data['volume_mm3']
                else:
                    metrics["lateral_root_len_mm"] += data['length_mm']
                    metrics["lateral_root_vol_mm3"] += data['volume_mm3']

                metrics["total_root_len_mm"] += data['length_mm']
                metrics["total_root_vol_mm3"] += data['volume_mm3']

                metrics["segments"].append({
                    "id": int(index),
                    "type": "Стержневой (Первичный)" if is_primary else "Боковой (Латеральный)",
                    "length_mm": round(data['length_mm'], 2),
                    "thickness_mm": round(data['thickness_mm'], 3),
                    "volume_mm3": round(data['volume_mm3'], 2),
                    "path": [[int(x), int(y)] for y, x in data['coords']]
                })
        except Exception as e:
            print(f"Ошибка анализа графов: {e}")

    metrics["primary_root_len_mm"] = float(round(metrics["primary_root_len_mm"], 2))
    metrics["primary_root_vol_mm3"] = float(round(metrics["primary_root_vol_mm3"], 2))
    metrics["lateral_root_len_mm"] = float(round(metrics["lateral_root_len_mm"], 2))
    metrics["lateral_root_vol_mm3"] = float(round(metrics["lateral_root_vol_mm3"], 2))
    metrics["total_root_len_mm"] = float(round(metrics["total_root_len_mm"], 2))
    metrics["total_root_vol_mm3"] = float(round(metrics["total_root_vol_mm3"], 2))
    metrics["root_length_mm"] = metrics["total_root_len_mm"]

    # === 5. ОТРИСОВКА МАСОК (ЧИСТЫЙ РЕНДЕР) ===
    if draw_annotation:
        annotated_img = img.copy()
        overlay = img.copy()

        overlay[leaf_mask > 0] = [74, 163, 22]
        overlay[stem_mask > 0] = [235, 99, 37]

        # Отрисовываем ТОЛЬКО те корни, которые прошли пространственный фильтр
        clean_root_mask = np.zeros((h, w), dtype=np.uint8)
        for index in final_edges:
            coords = segment_dict[index]['coords']
            rad = max(1, int((segment_dict[index]['thickness_mm'] / MM_PER_PIXEL) / 2))
            for y, x in coords:
                cv2.circle(clean_root_mask, (x, y), rad, 1, -1)

        overlay[clean_root_mask > 0] = [234, 51, 147]
        cv2.addWeighted(overlay, 0.5, annotated_img, 0.5, 0, annotated_img)
        return metrics, annotated_img

    return metrics, None


@app.post("/predict")
async def predict_plant(file: UploadFile = File(...),
                        conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                        scan_mode: str = Form("express")):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)
    metrics, _ = analyze_biomass(img, conf, iou, imgsz, False, scan_mode)
    return metrics


@app.post("/annotate")
async def annotate_plant(file: UploadFile = File(...),
                         conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                         scan_mode: str = Form("express")):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), CAMERA_MATRIX, DIST_COEFFS, None, CAMERA_MATRIX)

    metrics, annotated_frame = analyze_biomass(img, conf, iou, imgsz, True, scan_mode)

    if annotated_frame is None: return {"annotated_image_base64": None}

    _, buffer = cv2.imencode('.jpg', annotated_frame)

    return {
        "annotated_image_base64": base64.b64encode(buffer).decode('utf-8'),
        "segments": metrics.get("segments", []),
        "leaves": metrics.get("leaves", []),
        "stems": metrics.get("stems", []),
        "scan_mode": scan_mode
    }