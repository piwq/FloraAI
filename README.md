# FloraAI — ИИ-система анализа морфологии растений

![Python](https://img.shields.io/badge/Python-3.10-3776AB?logo=python&logoColor=white)
![YOLO11](https://img.shields.io/badge/YOLO11x-Instance_Segmentation-00FFFF?logo=yolo)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Django](https://img.shields.io/badge/Django-6-092E20?logo=django)
![Docker](https://img.shields.io/badge/Docker-Compose-2CA5E0?logo=docker)

**FloraAI** — система компьютерного зрения для сегментации и количественного анализа морфологии растений (листья, стебли, корни). Обученная модель YOLO11x-seg выполняет instance-сегментацию, после чего пайплайн рассчитывает 30+ фито-метрик, включая площадь листьев, длину корней, объём биомассы, фрактальную размерность корневой системы и вегетативные индексы здоровья.

Доступен в трёх форматах: **CLI-скрипт** (пакетная обработка), **веб-приложение** (React + Django) и **Telegram-бот**.

---

## Содержание

- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Быстрый старт](#быстрый-старт)
  - [CLI-инференс (командная строка)](#1-cli-инференс-командная-строка)
  - [Веб-приложение (Docker)](#2-веб-приложение-docker-compose)
  - [Telegram-бот](#3-telegram-бот)
- [Обучение модели](#обучение-модели)
- [Измеряемые метрики](#измеряемые-метрики)
- [Технологический стек](#технологический-стек)

---

## Возможности

- **Instance-сегментация** листьев, стеблей и корней (YOLO11)
- **DeepScan** — 8-кратный TTA (Test-Time Augmentation) ансамблинг с soft-voting и edge recovery для повышенной точности
- **30+ морфологических метрик**: площадь, длина, объём, толщина, конусность, фрактальная размерность, RSA-метрики
- **Анализ корневой системы** через скелетизацию и теорию графов (NetworkX + skan)
- **Вегетативные индексы** здоровья листьев (ExGreen, VARI)
- **Калибровка камеры** по шахматной доске (OpenCV) для физически точных измерений
- **Классификация** типа растения (пшеница / руккола)
- **Пакетная обработка** из командной строки
- **Веб-интерфейс** с интерактивным канвасом и чатом с ИИ-агрономом (YandexGPT)
- **Telegram-бот** с полной синхронизацией с веб-версией

---

## Архитектура

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Frontend   │────▶│   Backend    │────▶│   ML Service     │
│  React+Vite │     │  Django+DRF  │     │  FastAPI+YOLO11  │
│  port 80    │     │  port 8000   │     │  port 8001 (GPU) │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
┌─────────────┐     ┌──────┴───────┐
│  Telegram   │────▶│  PostgreSQL  │
│  Bot        │     │  + Redis     │
│  aiogram 3  │     │              │
└─────────────┘     └──────────────┘
```

- **ml-service/** — FastAPI + YOLO11 + OpenCV + NetworkX. Выполняет сегментацию и расчёт метрик. Нуждается в GPU (CUDA).
- **backend/** — Django 6 + DRF + Channels (WebSocket). REST API, чат с YandexGPT, хранение результатов.
- **frontend/** — React 18 + Vite + TailwindCSS. Интерактивный канвас для визуализации сегментации.
- **telegram-bot/** — aiogram 3. Полная интеграция с backend через REST API.
- **nginx/** — реверс-прокси с поддержкой WebSocket.

---

## Быстрый старт

### 1. CLI-инференс (командная строка)

Самый простой способ обработать изображения — CLI-скрипт, который не требует запуска всей инфраструктуры (только ML-сервис).

**Требования:** Python 3.10+, CUDA-совместимый GPU (рекомендуется), ~4 GB RAM.

```bash
# 1. Установка зависимостей
cd ml-service
pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# 2. Обработка одного изображения
python cli_inference.py photo.jpg

# 3. Пакетная обработка (несколько файлов)
python cli_inference.py img1.jpg img2.png img3.jpg

# 4. Обработка всех изображений из папки
python cli_inference.py /path/to/images/

# 5. DeepScan (точнее, TTA x8, но медленнее)
python cli_inference.py photo.jpg --deep-scan

# 6. Сохранить аннотированное изображение с масками сегментации
python cli_inference.py photo.jpg --save-overlay

# 7. Все параметры
python cli_inference.py photo.jpg \
    --conf 0.25 \
    --iou 0.7 \
    --imgsz 1024 \
    --deep-scan \
    --save-overlay \
    -o results/
```

**Параметры:**

| Флаг | По умолчанию | Описание |
|------|-------------|----------|
| `--conf` | 0.25 | Порог уверенности YOLO |
| `--iou` | 0.7 | Порог перекрытия (IoU) |
| `--imgsz` | 1024 | Размер изображения для нейросети |
| `--deep-scan` | выкл | 8-кратный TTA ансамблинг |
| `--save-overlay` | выкл | Сохранить изображение с наложенными масками |
| `-o` / `--output` | `output/` | Папка для результатов |
| `--json-only` | выкл | Только JSON, без таблицы в консоль |

**Результаты:**
- `output/<filename>_metrics.json` — JSON с метриками для каждого изображения
- `output/<filename>_annotated.jpg` — изображение с масками (при `--save-overlay`)
- `output/_batch_summary.json` — сводка при пакетной обработке

**Пример вывода:**

```
FloraAI CLI — режим: Express
Параметры: conf=0.25, iou=0.7, imgsz=1024
Найдено изображений: 1
Результаты: /path/to/output/

[1/1] plant_photo.jpg ... OK
============================================================
  Тип растения:  Пшеница
------------------------------------------------------------
  ЛИСТЬЯ
    Количество:          3
    Площадь:             1.39 см²
    Периметр:            128.45 мм
    ExGreen индекс:      42.31
    VARI индекс:         0.2145
  СТЕБЛИ
    Количество:          2
    Длина:               44.21 мм
    Площадь:             18.73 мм²
  КОРНИ
    Якоря (к стеблю):    2
    Первичный корень:    85.30 мм  |  V=12.45 мм³
    Боковые корни:       65.60 мм  |  V=37.35 мм³
    ИТОГО длина:         150.90 мм
    ИТОГО объём:         49.80 мм³
  RSA (архитектура корневой системы)
    Кончики корней:      12
    Узлы ветвления:      8
    Фракт. размерность:  1.4523
============================================================
```

---

### 2. Веб-приложение (Docker Compose)

**Требования:** Docker, Docker Compose, NVIDIA GPU + nvidia-container-toolkit.

```bash
# 1. Клонирование
git clone https://github.com/piwq/FloraAI.git
cd FloraAI

# 2. Настройка переменных окружения
# Создайте файлы .env:

# backend/.env
# SECRET_KEY=your-secret-key
# YANDEX_API_KEY=your-yandex-api-key
# YANDEX_FOLDER_ID=your-folder-id

# telegram-bot/.env
# TELEGRAM_BOT_TOKEN=your-bot-token
# WEBAPP_URL=https://your-domain.com

# frontend/.env (опционально)
# VITE_API_URL=/api

# 3. Сборка и запуск
docker compose up -d --build

# 4. Применение миграций
docker compose exec backend python manage.py migrate

# 5. Создание суперпользователя (для админки)
docker compose exec backend python manage.py createsuperuser
```

Веб-интерфейс: `http://localhost`
Django Admin: `http://localhost/admin`

---

### 3. Telegram-бот

Telegram-бот запускается автоматически в Docker Compose. Команды:

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + кнопка Mini App |
| `/me` | Профиль пользователя |
| `/history` | История анализов |
| Отправка фото | Запуск анализа растения |

---

## Обучение модели

Модель обучена на датасете из 290 изображений, размеченном в RoboFlow (instance segmentation), с использованием YOLO11x-seg (ultralytics).

**Классы сегментации:**
- `0` — leaf (лист)
- `1` — root (корень)
- `2` — stem (стебель)

**Команда обучения (Python API):**

```python
from ultralytics import YOLO

model = YOLO("yolo11x-seg.pt")
model.train(
    data="data.yaml",
    epochs=200,
    patience=30,
    imgsz=1024,
    batch=-1,                # автоподбор под GPU
    workers=4,
    device=0,

    # Полноразмерные маски (критично для тонких корней)
    mask_ratio=1,
    retina_masks=True,
    overlap_mask=True,

    # Аугментации
    degrees=90.0,
    flipud=0.5,
    fliplr=0.5,
    scale=0.3,
    mosaic=0.5,
    close_mosaic=30,
    hsv_v=0.3,
    hsv_s=0.3,
    hsv_h=0.02,
    copy_paste=0.3,

    # Оптимизатор
    lr0=0.001,
    weight_decay=0.0005,

    project="plant_roots",
    name="yolo11x_final",
    save_period=10,
    plots=True,
)
```

**Инференс (CLI-скрипт FloraAI):**

```bash
python cli_inference.py photo.jpg                  # одно фото
python cli_inference.py *.jpg --deep-scan          # пакетная + DeepScan (TTA x8)
python cli_inference.py photo.jpg --save-overlay   # сохранить маску сегментации
```

**Инференс (ultralytics CLI):**

```bash
yolo task=segment mode=predict \
    model=best.pt \
    source=image.jpg \
    conf=0.25 \
    iou=0.7 \
    imgsz=1024
```

Обученные веса (`best.pt`) расположены в `ml-service/best.pt`.

---

## Измеряемые метрики

### Листья
| Метрика | Единица | Описание |
|---------|---------|----------|
| leaf_count | шт | Количество листьев |
| leaf_area_cm2 | см² | Суммарная площадь листьев |
| leaf_perimeter_mm | мм | Суммарный периметр |
| leaf_exgreen | — | Excess Green Index (Woebbecke et al., 1995) |
| leaf_vari | — | VARI — вегетативный индекс (Gitelson et al., 2002) |

### Стебли
| Метрика | Единица | Описание |
|---------|---------|----------|
| stem_count | шт | Количество стеблей |
| stem_length_mm | мм | Суммарная длина (по скелету Freeman) |
| stem_area_mm2 | мм² | Площадь проекции |
| stem_base_width_mm | мм | Ширина основания |
| stem_tip_width_mm | мм | Ширина кончика |
| stem_taper_ratio | — | Конусность (tip/base) |

### Корни
| Метрика | Единица | Описание |
|---------|---------|----------|
| root_anchors | шт | Точки крепления к стеблю |
| primary_root_len_mm | мм | Длина первичного корня |
| lateral_root_len_mm | мм | Суммарная длина боковых корней |
| total_root_len_mm | мм | Общая длина корневой системы |
| total_root_vol_mm3 | мм³ | Объём корней (цилиндрическая модель) |
| root_area_mm2 | мм² | Площадь проекции |
| root_surface_area_mm2 | мм² | Поверхность (WinRHIZO-совместимо) |
| root_tip_count | шт | Количество кончиков |
| root_fork_count | шт | Узлы ветвления |
| lateral_root_count | шт | Количество боковых корней |
| branching_intensity | 1/мм | Интенсивность ветвления (Fitter & Stickland, 1991) |
| root_system_width_mm | мм | Ширина корневой системы |
| root_system_depth_mm | мм | Глубина корневой системы |
| root_density | — | Плотность заполнения convex hull |
| root_fractal_dimension | — | Фрактальная размерность (box-counting) |
| specific_root_length | мм/мм³ | Удельная длина корня |

---

## Технологический стек

| Компонент | Технологии |
|-----------|------------|
| ML / CV | YOLO11x-seg (ultralytics), OpenCV, PyTorch, scikit-image, NetworkX, skan |
| Backend | Django 6, Django REST Framework, Django Channels, Daphne, PostgreSQL 15, Redis 7 |
| Frontend | React 18, Vite, TailwindCSS, Socket.IO, React Query |
| Telegram | aiogram 3, FSM, Redis state storage |
| Инфраструктура | Docker Compose, Nginx, NVIDIA Container Toolkit |
| ИИ-чат | YandexGPT API |

---

## Структура проекта

```
flora-ai/
├── ml-service/              # ML-сервис (FastAPI + YOLO11)
│   ├── main.py              # Основной пайплайн анализа
│   ├── cli_inference.py     # CLI-скрипт для инференса
│   ├── best.pt              # Обученные веса YOLO11
│   ├── requirements.txt
│   └── Dockerfile
├── backend/                 # Django backend
│   ├── api/
│   │   ├── models.py        # Модели БД
│   │   ├── views.py         # REST API endpoints
│   │   ├── consumers.py     # WebSocket (чат)
│   │   └── services/        # Клиенты к ML и YandexGPT
│   ├── config/              # Django settings, ASGI
│   └── Dockerfile
├── frontend/                # React frontend
│   ├── src/
│   │   ├── pages/           # Страницы
│   │   ├── components/      # Компоненты (канвас, чат, модалки)
│   │   ├── hooks/           # useChat, useWebSocket
│   │   └── services/        # API-клиент
│   └── Dockerfile
├── telegram-bot/            # Telegram-бот
│   ├── bot.py               # Точка входа
│   ├── app/handlers/        # Обработчики команд
│   └── Dockerfile
├── nginx/                   # Реверс-прокси
│   └── nginx.conf
└── docker-compose.yml       # Оркестрация сервисов
```

---

## Авторы

Разработано командой в рамках ИИ-хакатона.
