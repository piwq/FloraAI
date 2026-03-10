# FloraAI — Быстрый старт

Система анализирует фото растений и выдаёт 30+ морфологических метрик: площадь листьев, длину/объём корней, фрактальную размерность корневой системы и вегетативные индексы здоровья.

---

## Вариант 1 — CLI (самый быстрый, только Python)

```bash
cd ml-service
pip install -r requirements.txt
```

```bash
# Одно фото (очень быстро, лучше использовать с --deep-scan)
python cli_inference.py фото.jpg 

# Лучшее качество распознавания (очень желательно использовать это)
python cli_inference.py фото.jpg --deep-scan --save-overlay

# Папка с фотографиями
python cli_inference.py /путь/к/папке/ --deep-scan --save-overlay
```

Результаты появятся в папке `output/` — JSON с метриками и изображение с наложенными масками.

---

## Вариант 2 — Веб-приложение (Docker)

Нужен Docker с поддержкой NVIDIA GPU.

```bash
cp backend/.env.example backend/.env      # вставить ключи Yandex GPT
cp telegram-bot/.env.example telegram-bot/.env

docker compose up -d --build
docker compose exec backend python manage.py migrate
```

Открыть: **http://localhost**

В веб-версии доступен чат с ИИ-агрономом на основе YandexGPT — он объясняет метрики и даёт рекомендации по уходу за растением.

---

## Параметры CLI

| Флаг | Описание |
|------|----------|
| `--deep-scan` | Использовать это для максимальной точности |
| `--save-overlay` | Сохранить фото с масками сегментации |
| `--conf 0.25` | Порог уверенности (0–1, меньше = больше объектов) |
| `--iou 0.7` | Порог перекрытия масок |
| `-o results/` | Папка для результатов |

---

Telegram-бот: [@FloraAI_hackaton_bot](https://t.me/FloraAI_hackaton_bot)
