#!/bin/bash

# Применяем миграции базы данных (тоже полезно делать автоматически)
echo "Applying database migrations..."
python manage.py migrate --noinput

# Собираем статику
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Запускаем сам сервер (Django или Gunicorn)
echo "Starting Django server..."
exec "$@"