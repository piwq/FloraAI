"""
FloraAI — CLI-скрипт для инференса (обработка изображений растений).

Использование:
    # Одно изображение:
    python cli_inference.py image.jpg

    # Несколько изображений (пакетная обработка):
    python cli_inference.py img1.jpg img2.png img3.jpg

    # Все изображения из папки:
    python cli_inference.py /path/to/folder/

    # С DeepScan (точнее, но медленнее):
    python cli_inference.py image.jpg --deep-scan

    # С сохранением аннотированных изображений:
    python cli_inference.py image.jpg --save-overlay

    # Указать папку вывода:
    python cli_inference.py image.jpg -o results/

    # Настроить параметры YOLO:
    python cli_inference.py image.jpg --conf 0.3 --iou 0.5 --imgsz 1280
"""

import argparse
import json
import os
import sys
import glob as glob_module

import cv2
import numpy as np

# Импортируем функцию анализа из основного модуля
from main import analyze_biomass


IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'}


def collect_images(paths: list[str]) -> list[str]:
    """Собирает список файлов изображений из путей (файлы и папки)."""
    result = []
    for p in paths:
        if os.path.isdir(p):
            for ext in IMAGE_EXTENSIONS:
                result.extend(glob_module.glob(os.path.join(p, f'*{ext}')))
                result.extend(glob_module.glob(os.path.join(p, f'*{ext.upper()}')))
        elif os.path.isfile(p):
            result.append(p)
        else:
            print(f"  [!] Пропущено (не найдено): {p}")
    return sorted(set(result))


def format_metrics_table(metrics: dict) -> str:
    """Форматирует метрики в читаемую таблицу."""
    lines = []
    lines.append("=" * 60)
    lines.append(f"  Тип растения:  {metrics.get('plant_type', '—')}")
    lines.append("-" * 60)

    # Листья
    lines.append("  ЛИСТЬЯ")
    lines.append(f"    Количество:          {metrics.get('leaf_count', 0)}")
    lines.append(f"    Площадь:             {metrics.get('leaf_area_cm2', 0):.2f} см²")
    lines.append(f"    Периметр:            {metrics.get('leaf_perimeter_mm', 0):.2f} мм")
    lines.append(f"    ExGreen индекс:      {metrics.get('leaf_exgreen', 0):.2f}")
    lines.append(f"    VARI индекс:         {metrics.get('leaf_vari', 0):.4f}")

    # Стебли
    lines.append("  СТЕБЛИ")
    lines.append(f"    Количество:          {metrics.get('stem_count', 0)}")
    lines.append(f"    Длина:               {metrics.get('stem_length_mm', 0):.2f} мм")
    lines.append(f"    Площадь:             {metrics.get('stem_area_mm2', 0):.2f} мм²")
    lines.append(f"    Ширина основания:    {metrics.get('stem_base_width_mm', 0):.3f} мм")
    lines.append(f"    Ширина кончика:      {metrics.get('stem_tip_width_mm', 0):.3f} мм")
    lines.append(f"    Конусность:          {metrics.get('stem_taper_ratio', 0):.4f}")

    # Корни
    lines.append("  КОРНИ")
    lines.append(f"    Якоря (к стеблю):    {metrics.get('root_anchors', 0)}")
    lines.append(f"    Первичный корень:    {metrics.get('primary_root_len_mm', 0):.2f} мм  |  V={metrics.get('primary_root_vol_mm3', 0):.2f} мм³")
    lines.append(f"    Боковые корни:       {metrics.get('lateral_root_len_mm', 0):.2f} мм  |  V={metrics.get('lateral_root_vol_mm3', 0):.2f} мм³")
    lines.append(f"    ИТОГО длина:         {metrics.get('total_root_len_mm', 0):.2f} мм")
    lines.append(f"    ИТОГО объём:         {metrics.get('total_root_vol_mm3', 0):.2f} мм³")
    lines.append(f"    Площадь (проекция):  {metrics.get('root_area_mm2', 0):.2f} мм²")
    lines.append(f"    Поверхность:         {metrics.get('root_surface_area_mm2', 0):.2f} мм²")

    # RSA-метрики
    lines.append("  RSA (архитектура корневой системы)")
    lines.append(f"    Кончики корней:      {metrics.get('root_tip_count', 0)}")
    lines.append(f"    Узлы ветвления:      {metrics.get('root_fork_count', 0)}")
    lines.append(f"    Боковых корней:      {metrics.get('lateral_root_count', 0)}")
    lines.append(f"    Интенс. ветвления:   {metrics.get('branching_intensity', 0):.4f}")
    lines.append(f"    Ширина системы:      {metrics.get('root_system_width_mm', 0):.2f} мм")
    lines.append(f"    Глубина системы:      {metrics.get('root_system_depth_mm', 0):.2f} мм")
    lines.append(f"    Ш/Г соотношение:     {metrics.get('width_depth_ratio', 0):.4f}")
    lines.append(f"    Плотность:           {metrics.get('root_density', 0):.4f}")
    lines.append(f"    Фракт. размерность:  {metrics.get('root_fractal_dimension', 0):.4f}")
    lines.append(f"    Удельная длина:      {metrics.get('specific_root_length', 0):.4f} мм/мм³")
    lines.append("=" * 60)
    return "\n".join(lines)


def process_image(image_path: str, args) -> dict:
    """Обрабатывает одно изображение и возвращает метрики."""
    img = cv2.imread(image_path)
    if img is None:
        print(f"  [!] Не удалось прочитать: {image_path}")
        return None

    metrics, annotated = analyze_biomass(
        img,
        conf=args.conf,
        iou=args.iou,
        imgsz=args.imgsz,
        draw_annotation=args.save_overlay,
        deep_scan=args.deep_scan,
        bake_overlay=args.save_overlay,
    )

    # Сохраняем аннотированное изображение
    if args.save_overlay and annotated is not None:
        base = os.path.splitext(os.path.basename(image_path))[0]
        out_path = os.path.join(args.output, f"{base}_annotated.jpg")
        cv2.imwrite(out_path, annotated)
        print(f"  -> Аннотация сохранена: {out_path}")

    # Сохраняем JSON с метриками
    base = os.path.splitext(os.path.basename(image_path))[0]
    json_path = os.path.join(args.output, f"{base}_metrics.json")

    # Убираем полигоны из JSON для читаемости (они огромные)
    metrics_clean = {k: v for k, v in metrics.items()
                     if k not in ('segments', 'leaves', 'stems', 'annotated_image_base64')}
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(metrics_clean, f, ensure_ascii=False, indent=2)

    return metrics


def main():
    parser = argparse.ArgumentParser(
        description='FloraAI CLI — анализ растений по фото (сегментация листьев, стеблей, корней)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python cli_inference.py photo.jpg                     # одно фото
  python cli_inference.py *.jpg                         # все jpg в текущей папке
  python cli_inference.py /data/plants/                 # вся папка
  python cli_inference.py photo.jpg --deep-scan         # точный режим (TTA x8)
  python cli_inference.py photo.jpg --save-overlay      # сохранить аннотацию
  python cli_inference.py photo.jpg -o results/         # папка вывода
        """
    )
    parser.add_argument('inputs', nargs='+', help='Изображения или папки с изображениями')
    parser.add_argument('-o', '--output', default='output', help='Папка для результатов (default: output/)')
    parser.add_argument('--conf', type=float, default=0.25, help='YOLO confidence threshold (default: 0.25)')
    parser.add_argument('--iou', type=float, default=0.7, help='YOLO IoU threshold (default: 0.7)')
    parser.add_argument('--imgsz', type=int, default=1024, help='Размер изображения для YOLO (default: 1024)')
    parser.add_argument('--deep-scan', action='store_true', help='DeepScan: 8-кратный TTA ансамблинг (точнее, но медленнее)')
    parser.add_argument('--save-overlay', action='store_true', help='Сохранить аннотированные изображения с масками')
    parser.add_argument('--json-only', action='store_true', help='Только JSON-вывод (без таблицы в консоль)')

    args = parser.parse_args()

    # Создаём папку вывода
    os.makedirs(args.output, exist_ok=True)

    # Собираем файлы
    images = collect_images(args.inputs)
    if not images:
        print("Не найдено изображений для обработки.")
        sys.exit(1)

    mode = "DeepScan (TTA x8)" if args.deep_scan else "Express"
    print(f"\nFloraAI CLI — режим: {mode}")
    print(f"Параметры: conf={args.conf}, iou={args.iou}, imgsz={args.imgsz}")
    print(f"Найдено изображений: {len(images)}")
    print(f"Результаты: {os.path.abspath(args.output)}/\n")

    all_metrics = {}

    for i, img_path in enumerate(images, 1):
        name = os.path.basename(img_path)
        print(f"[{i}/{len(images)}] {name} ...", end=" ", flush=True)

        metrics = process_image(img_path, args)
        if metrics is None:
            continue

        print("OK")
        all_metrics[name] = metrics

        if not args.json_only:
            print(format_metrics_table(metrics))
            print()

    # Сводный JSON для пакетной обработки
    if len(images) > 1:
        summary_path = os.path.join(args.output, '_batch_summary.json')
        summary = {}
        for name, m in all_metrics.items():
            summary[name] = {k: v for k, v in m.items()
                             if k not in ('segments', 'leaves', 'stems', 'annotated_image_base64')}
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print(f"Сводка пакетной обработки: {summary_path}")

    print(f"\nГотово! Обработано {len(all_metrics)}/{len(images)} изображений.")


if __name__ == '__main__':
    main()
