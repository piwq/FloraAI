import os, base64
import json
from typing import List, Optional
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


def box_counting_dimension(binary_img):
    """Фрактальная размерность через box-counting (Tatsumi 1989, Nielsen 1997).
    Пшеница ≈ 1.3–1.6, руккола ≈ 1.5–1.9. Чем выше — тем сложнее корневая система."""
    pixels = np.argwhere(binary_img > 0)
    if len(pixels) < 10:
        return 0.0
    min_r, min_c = pixels.min(axis=0)
    max_r, max_c = pixels.max(axis=0)
    cropped = binary_img[min_r:max_r + 1, min_c:max_c + 1]
    sizes = [2, 4, 8, 16, 32, 64, 128]
    counts = []
    valid_sizes = []
    for size in sizes:
        if size > min(cropped.shape):
            break
        count = 0
        for i in range(0, cropped.shape[0], size):
            for j in range(0, cropped.shape[1], size):
                if np.any(cropped[i:i + size, j:j + size]):
                    count += 1
        if count > 0:
            counts.append(count)
            valid_sizes.append(size)
    if len(valid_sizes) < 3:
        return 0.0
    coeffs = np.polyfit(np.log(valid_sizes), np.log(counts), 1)
    return float(round(-coeffs[0], 4))


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


def analyze_biomass(img, conf, iou, imgsz, draw_annotation=False, deep_scan=False,
                    mm_per_pixel=None, cm2_per_pixel=None):
    mm_per_pixel = mm_per_pixel or MM_PER_PIXEL
    cm2_per_pixel = cm2_per_pixel or CM2_PER_PIXEL
    h, w = img.shape[:2]

    metrics = {
        "status": "Анализ успешно завершен", "leaf_count": 0, "leaf_area_cm2": 0.0,
        "stem_count": 0, "stem_length_mm": 0.0, "root_anchors": 0, "primary_root_len_mm": 0.0,
        "primary_root_vol_mm3": 0.0, "lateral_root_len_mm": 0.0, "lateral_root_vol_mm3": 0.0,
        "total_root_len_mm": 0.0, "total_root_vol_mm3": 0.0, "root_length_mm": 0.0,
        "segments": [], "leaves": [], "stems": [], "annotated_image_base64": None,
        "is_deep_scan": deep_scan,
        "plant_type": "Неизвестно",
        "root_tip_count": 0, "root_fork_count": 0, "lateral_root_count": 0,
        "branching_intensity": 0.0,
        "root_system_width_mm": 0.0, "root_system_depth_mm": 0.0,
        "root_density": 0.0, "width_depth_ratio": 0.0,
        "leaf_exgreen": 0.0, "leaf_vari": 0.0,
        "root_fractal_dimension": 0.0,
        "stem_base_width_mm": 0.0, "stem_tip_width_mm": 0.0, "stem_taper_ratio": 0.0,
        "root_area_mm2": 0.0, "root_surface_area_mm2": 0.0,
        "stem_area_mm2": 0.0, "leaf_perimeter_mm": 0.0,
        "specific_root_length": 0.0
    }

    # === 1. ГЕНЕРАЦИЯ МУТАЦИЙ (TTA) ===
    # Каждый элемент: (изображение, нужно_ли_зеркалить_маску_обратно)
    images_to_process = [(img, False)]

    if deep_scan:
        print("🔍 DEEP SCAN АКТИВИРОВАН: 7-ступенчатый TTA (фото + контраст + геометрия)...")
        # Фотометрические мутации
        img_bright = cv2.convertScaleAbs(img, alpha=1.1, beta=15)
        img_contrast = cv2.convertScaleAbs(img, alpha=1.3, beta=0)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)
        img_clahe = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
        img_dark = cv2.convertScaleAbs(img, alpha=0.9, beta=-15)

        # Геометрические мутации (маски зеркалим обратно при голосовании)
        img_flipped_h = cv2.flip(img, 1)
        img_flipped_h_bright = cv2.convertScaleAbs(img_flipped_h, alpha=1.15, beta=10)

        images_to_process.extend([
            (img_bright, False), (img_contrast, False),
            (img_clahe, False), (img_dark, False),
            (img_flipped_h, True), (img_flipped_h_bright, True),
        ])

    # Накопители голосов (каждый пиксель голосует, к какому классу он относится)
    acc_leaf = np.zeros((h, w), dtype=np.uint8)
    acc_root = np.zeros((h, w), dtype=np.uint8)
    acc_stem = np.zeros((h, w), dtype=np.uint8)

    # === 2. ПРОГОН НЕЙРОСЕТИ И ГОЛОСОВАНИЕ ===
    for i, (aug_img, needs_flip_back) in enumerate(images_to_process):
        with torch.no_grad():
            res = model(aug_img, conf=conf, iou=iou, imgsz=imgsz, verbose=False)[0]

        # Семантические маски текущей аугментации (merge всех экземпляров одного класса)
        aug_leaf = np.zeros((h, w), dtype=np.uint8)
        aug_root = np.zeros((h, w), dtype=np.uint8)
        aug_stem = np.zeros((h, w), dtype=np.uint8)

        if res.masks is not None:
            boxes = res.boxes.cls.cpu().numpy()
            masks_data = res.masks.data.cpu().numpy()

            for j in range(len(masks_data)):
                cls_id = int(boxes[j])
                mask_pixels = masks_data[j]
                binary_mask = (mask_pixels > 0.5).astype(np.uint8)
                temp_mask = cv2.resize(binary_mask, (w, h), interpolation=cv2.INTER_NEAREST)

                # Зеркалим маску обратно если изображение было отражено
                if needs_flip_back:
                    temp_mask = cv2.flip(temp_mask, 1)

                if cls_id == 0:
                    aug_leaf = np.maximum(aug_leaf, temp_mask)
                elif cls_id == 1:
                    aug_root = np.maximum(aug_root, temp_mask)
                elif cls_id == 2:
                    aug_stem = np.maximum(aug_stem, temp_mask)

        # Каждая аугментация даёт ровно 1 голос за пиксель
        acc_leaf += aug_leaf
        acc_root += aug_root
        acc_stem += aug_stem

        del res
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    # === 3. КОНСЕНСУС (ОПРЕДЕЛЯЕМ ФИНАЛЬНУЮ МАСКУ) ===
    # Обычный режим: 1 голос. DeepScan (7 аугментаций): минимум 3 голоса из 7.
    threshold = 3 if deep_scan else 1

    leaf_mask = (acc_leaf >= threshold).astype(np.uint8)
    root_mask = (acc_root >= threshold).astype(np.uint8)
    stem_mask = (acc_stem >= threshold).astype(np.uint8)

    # Извлекаем финальные полигоны для React
    metrics["leaves"], metrics["leaf_count"] = get_polygons_from_mask(leaf_mask, 0)
    metrics["stems"], metrics["stem_count"] = get_polygons_from_mask(stem_mask, 0)

    metrics["leaf_area_cm2"] = float(round(np.sum(leaf_mask) * cm2_per_pixel, 2))

    # === КЛАССИФИКАЦИЯ РАСТЕНИЯ (пшеница vs руккола) ===
    # Пшеница: длинные узкие листья (высокий aspect ratio)
    # Руккола: широкие округлые листья (низкий aspect ratio)
    leaf_contours, _ = cv2.findContours(leaf_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    aspect_ratios = []
    for cnt in leaf_contours:
        if cv2.contourArea(cnt) > 100:
            rect = cv2.minAreaRect(cnt)
            w_r, h_r = rect[1]
            if min(w_r, h_r) > 0:
                aspect_ratios.append(max(w_r, h_r) / min(w_r, h_r))

    if aspect_ratios:
        avg_aspect = np.mean(aspect_ratios)
        metrics["plant_type"] = "Пшеница" if avg_aspect > 3.5 else "Руккола"
    else:
        metrics["plant_type"] = "Неизвестно"

    # === ВЕГЕТАТИВНЫЕ ИНДЕКСЫ ЗДОРОВЬЯ ЛИСТЬЕВ (RGB-proxy) ===
    if np.any(leaf_mask) and img is not None:
        leaf_pixels = img[leaf_mask > 0].astype(np.float64)
        B, G, R = leaf_pixels[:, 0], leaf_pixels[:, 1], leaf_pixels[:, 2]

        # ExGreen — Excess Green Index (Woebbecke et al., 1995)
        exgreen = 2.0 * G - R - B
        metrics["leaf_exgreen"] = float(round(np.mean(exgreen), 2))

        # VARI — Visible Atmospherically Resistant Index (Gitelson et al., 2002)
        denom = G + R - B
        valid = np.abs(denom) > 1e-6
        if np.any(valid):
            vari = (G[valid] - R[valid]) / denom[valid]
            vari = np.clip(vari, -1.0, 1.0)
            metrics["leaf_vari"] = float(round(np.mean(vari), 4))

    if np.any(stem_mask):
        stem_skel = skeletonize(stem_mask > 0)

        # Точный расчёт длины через ядро Freeman chain code:
        # горизонтальные/вертикальные соседи = 1.0, диагональные = √2
        _sqrt2 = np.sqrt(2)
        freeman_kernel = np.array([[_sqrt2, 1, _sqrt2], [1, 0, 1], [_sqrt2, 1, _sqrt2]])
        neighbor_dists = cv2.filter2D(stem_skel.astype(np.float64), -1, freeman_kernel)
        stem_length_px = np.sum(neighbor_dists[stem_skel > 0]) / 2.0  # каждое ребро посчитано дважды
        metrics["stem_length_mm"] = float(round(stem_length_px * mm_per_pixel, 2))

        # === ПРОФИЛЬ ТОЛЩИНЫ СТЕБЛЯ ===
        stem_dist = cv2.distanceTransform(stem_mask, cv2.DIST_L2, 5)
        skel_points = np.argwhere(stem_skel > 0)
        if len(skel_points) >= 2:
            # Сортируем точки скелета по Y (сверху вниз)
            skel_sorted = skel_points[skel_points[:, 0].argsort()]
            n_pts = len(skel_sorted)
            # Основание = нижние 10%, кончик = верхние 10%
            base_region = skel_sorted[int(n_pts * 0.9):]
            tip_region = skel_sorted[:int(n_pts * 0.1) + 1]

            base_radii = [stem_dist[y, x] for y, x in base_region if stem_dist[y, x] > 0]
            tip_radii = [stem_dist[y, x] for y, x in tip_region if stem_dist[y, x] > 0]

            if base_radii:
                metrics["stem_base_width_mm"] = float(round(np.median(base_radii) * 2 * mm_per_pixel, 3))
            if tip_radii:
                metrics["stem_tip_width_mm"] = float(round(np.median(tip_radii) * 2 * mm_per_pixel, 3))
            if base_radii and tip_radii and np.median(base_radii) > 0:
                metrics["stem_taper_ratio"] = float(round(
                    np.median(tip_radii) / np.median(base_radii), 4
                ))

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
                dist_mm = b_dist * mm_per_pixel
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
                dist_mm = b_dist * mm_per_pixel
                coords = skeleton_obj.path_coordinates(index).astype(int)

                radii = [dist_transform[y, x] for y, x in coords]
                true_rad_px = np.median(radii) if len(radii) >= MICRO_SEGMENT_PX else (np.mean(radii) if radii else 0)
                true_rad_mm = true_rad_px * mm_per_pixel
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

                # Поверхность сегмента: 2π·r·L (цилиндрическая модель, WinRHIZO)
                surface_mm2 = 2.0 * np.pi * true_rad_mm * dist_mm
                metrics["root_surface_area_mm2"] += surface_mm2

                segment_data = {
                    "id": int(index),
                    "type": "Стержневой (Первичный)" if is_primary else "Боковой (Латеральный)",
                    "length_mm": round(dist_mm, 2),
                    "thickness_mm": round(true_rad_mm * 2, 3),
                    "volume_mm3": round(vol_mm3, 2),
                    "path": [[int(x), int(y)] for y, x in coords]
                }
                metrics["segments"].append(segment_data)

            # === RSA-МЕТРИКИ (Root System Architecture) ===
            # Кончики корней: endpoint-ветви (branch-type=1) в skan
            b_type_col = 'branch-type' if 'branch-type' in branch_data.columns else 'branch_type'
            endpoint_branches = branch_data[branch_data[b_type_col] == 1]
            metrics["root_tip_count"] = len(endpoint_branches)

            # Узлы ветвления (fork): вершины графа со степенью >= 3
            metrics["root_fork_count"] = sum(1 for n in G.nodes() if G.degree(n) >= 3)

            # Число боковых корней (латеральных сегментов)
            lateral_count = sum(1 for idx in valid_branch_indices if idx not in primary_edges)
            metrics["lateral_root_count"] = lateral_count

            # Интенсивность ветвления (Fitter & Stickland, 1991)
            if metrics["primary_root_len_mm"] > 0:
                metrics["branching_intensity"] = float(round(
                    lateral_count / metrics["primary_root_len_mm"], 4
                ))

            # === CONVEX HULL МЕТРИКИ КОРНЕВОЙ СИСТЕМЫ ===
            root_points = np.argwhere(root_mask > 0)
            if len(root_points) >= 3:
                hull = cv2.convexHull(root_points[:, ::-1].astype(np.float32))
                hull_area_px = cv2.contourArea(hull)
                root_area_px = float(np.sum(root_mask))

                # Bounding box корневой системы
                ys, xs = root_points[:, 0], root_points[:, 1]
                sys_width_px = float(xs.max() - xs.min())
                sys_depth_px = float(ys.max() - ys.min())

                metrics["root_system_width_mm"] = float(round(sys_width_px * mm_per_pixel, 2))
                metrics["root_system_depth_mm"] = float(round(sys_depth_px * mm_per_pixel, 2))
                metrics["root_density"] = float(round(
                    root_area_px / (hull_area_px + 1e-6), 4
                ))
                metrics["width_depth_ratio"] = float(round(
                    sys_width_px / (sys_depth_px + 1e-6), 4
                ))

            # === ФРАКТАЛЬНАЯ РАЗМЕРНОСТЬ КОРНЕВОЙ СИСТЕМЫ ===
            metrics["root_fractal_dimension"] = box_counting_dimension(root_mask)

        except Exception as e:
            print(f"Ошибка анализа графов: {e}")

    # === ПЛОЩАДИ МАСОК (проекция, мм²) ===
    MM2_PER_PIXEL = mm_per_pixel ** 2
    metrics["root_area_mm2"] = float(round(np.sum(root_mask) * MM2_PER_PIXEL, 2))
    metrics["stem_area_mm2"] = float(round(np.sum(stem_mask) * MM2_PER_PIXEL, 2))

    # === ПЕРИМЕТР ЛИСТЬЕВ (сумма по всем контурам, мм) ===
    if leaf_contours:
        total_perimeter_px = sum(cv2.arcLength(cnt, True) for cnt in leaf_contours if cv2.contourArea(cnt) > 20)
        metrics["leaf_perimeter_mm"] = float(round(total_perimeter_px * mm_per_pixel, 2))

    # === ФИНАЛЬНОЕ ОКРУГЛЕНИЕ ===
    metrics["primary_root_len_mm"] = float(round(metrics["primary_root_len_mm"], 2))
    metrics["primary_root_vol_mm3"] = float(round(metrics["primary_root_vol_mm3"], 2))
    metrics["lateral_root_len_mm"] = float(round(metrics["lateral_root_len_mm"], 2))
    metrics["lateral_root_vol_mm3"] = float(round(metrics["lateral_root_vol_mm3"], 2))
    metrics["total_root_len_mm"] = float(round(metrics["total_root_len_mm"], 2))
    metrics["total_root_vol_mm3"] = float(round(metrics["total_root_vol_mm3"], 2))
    metrics["root_surface_area_mm2"] = float(round(metrics["root_surface_area_mm2"], 2))
    metrics["root_length_mm"] = metrics["total_root_len_mm"]

    # Удельная длина корня: длина / объём (мм/мм³) — эффективность освоения почвы
    if metrics["total_root_vol_mm3"] > 0:
        metrics["specific_root_length"] = float(round(
            metrics["total_root_len_mm"] / metrics["total_root_vol_mm3"], 4
        ))

    if draw_annotation:
        return metrics, img.copy()

    return metrics, None


def _parse_calibration(camera_matrix_json: Optional[str], dist_coeffs_json: Optional[str],
                       user_mm_per_pixel: Optional[float], user_cm2_per_pixel: Optional[float]):
    """Парсит пользовательские параметры калибровки или возвращает глобальные."""
    cam_mtx = CAMERA_MATRIX
    d_coeffs = DIST_COEFFS
    mpp = user_mm_per_pixel
    cpp = user_cm2_per_pixel

    if camera_matrix_json:
        try:
            cam_mtx = np.array(json.loads(camera_matrix_json))
        except Exception:
            pass
    if dist_coeffs_json:
        try:
            d_coeffs = np.array(json.loads(dist_coeffs_json))
        except Exception:
            pass

    return cam_mtx, d_coeffs, mpp, cpp


@app.post("/predict")
async def predict_plant(file: UploadFile = File(...),
                        conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                        deep_scan: bool = Form(False),
                        camera_matrix_json: Optional[str] = Form(None),
                        dist_coeffs_json: Optional[str] = Form(None),
                        user_mm_per_pixel: Optional[float] = Form(None),
                        user_cm2_per_pixel: Optional[float] = Form(None)):
    cam_mtx, d_coeffs, mpp, cpp = _parse_calibration(
        camera_matrix_json, dist_coeffs_json, user_mm_per_pixel, user_cm2_per_pixel)

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), cam_mtx, d_coeffs, None, cam_mtx)
    metrics, _ = analyze_biomass(img, conf, iou, imgsz, False, deep_scan, mpp, cpp)
    return metrics


@app.post("/annotate")
async def annotate_plant(file: UploadFile = File(...),
                         conf: float = Form(0.1), iou: float = Form(0.6), imgsz: int = Form(2048),
                         deep_scan: bool = Form(False),
                         camera_matrix_json: Optional[str] = Form(None),
                         dist_coeffs_json: Optional[str] = Form(None),
                         user_mm_per_pixel: Optional[float] = Form(None),
                         user_cm2_per_pixel: Optional[float] = Form(None)):
    cam_mtx, d_coeffs, mpp, cpp = _parse_calibration(
        camera_matrix_json, dist_coeffs_json, user_mm_per_pixel, user_cm2_per_pixel)

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.undistort(cv2.imdecode(nparr, cv2.IMREAD_COLOR), cam_mtx, d_coeffs, None, cam_mtx)

    metrics, annotated_frame = analyze_biomass(img, conf, iou, imgsz, True, deep_scan, mpp, cpp)

    if annotated_frame is None: return {"annotated_image_base64": None}

    _, buffer = cv2.imencode('.jpg', annotated_frame)

    return {
        "annotated_image_base64": base64.b64encode(buffer).decode('utf-8'),
        "segments": metrics.get("segments", []),
        "leaves": metrics.get("leaves", []),
        "stems": metrics.get("stems", []),
        "leaf_area_cm2": metrics.get("leaf_area_cm2", 0.0),
        "stem_length_mm": metrics.get("stem_length_mm", 0.0),
        "is_deep_scan": deep_scan
    }


@app.post("/calibrate")
async def calibrate_camera(files: List[UploadFile] = File(...),
                           rows: int = Form(6),
                           cols: int = Form(9),
                           square_size_mm: float = Form(25.0)):
    """Калибровка камеры по шахматной доске (OpenCV).
    Принимает несколько фотографий доски, возвращает camera_matrix, dist_coeffs, mm_per_pixel."""

    objp = np.zeros((rows * cols, 3), np.float32)
    objp[:, :2] = np.mgrid[0:cols, 0:rows].T.reshape(-1, 2) * square_size_mm

    objpoints = []
    imgpoints = []
    img_size = None
    images_used = 0

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)

    for f in files:
        contents = await f.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            continue

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if img_size is None:
            img_size = gray.shape[::-1]

        found, corners = cv2.findChessboardCorners(gray, (cols, rows), None)
        if found:
            corners_refined = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1), criteria)
            objpoints.append(objp)
            imgpoints.append(corners_refined)
            images_used += 1

    if images_used < 3:
        return {
            "success": False,
            "error": f"Найдена шахматная доска только на {images_used} из {len(files)} фото. Нужно минимум 3.",
            "images_used": images_used,
            "images_total": len(files)
        }

    ret, camera_matrix, dist_coeffs, rvecs, tvecs = cv2.calibrateCamera(
        objpoints, imgpoints, img_size, None, None
    )

    # Расчёт mm_per_pixel: средняя дистанция между соседними углами в пикселях
    pixel_dists = []
    for corners in imgpoints:
        corners_flat = corners.reshape(-1, 2)
        for r in range(rows):
            for c in range(cols - 1):
                idx1 = r * cols + c
                idx2 = r * cols + c + 1
                d = np.linalg.norm(corners_flat[idx1] - corners_flat[idx2])
                pixel_dists.append(d)
        for r in range(rows - 1):
            for c in range(cols):
                idx1 = r * cols + c
                idx2 = (r + 1) * cols + c
                d = np.linalg.norm(corners_flat[idx1] - corners_flat[idx2])
                pixel_dists.append(d)

    mean_pixel_dist = np.mean(pixel_dists)
    mm_pp = square_size_mm / mean_pixel_dist
    cm2_pp = (mm_pp / 10.0) ** 2

    return {
        "success": True,
        "camera_matrix": camera_matrix.tolist(),
        "dist_coeffs": dist_coeffs.tolist(),
        "mm_per_pixel": round(float(mm_pp), 6),
        "cm2_per_pixel": round(float(cm2_pp), 8),
        "reprojection_error": round(float(ret), 4),
        "images_used": images_used,
        "images_total": len(files)
    }