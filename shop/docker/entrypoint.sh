#!/bin/bash

set -e  # Останавливаем скрипт при ошибке

echo "========================================="
echo " ЗАПУСК EVENT MANAGEMENT SYSTEM"
echo "========================================="

# Переходим в директорию приложения
cd /app

# Проверяем наличие папки data
if [ ! -d "/app/data" ]; then
    echo " Создание папки data..."
    mkdir -p /app/data
fi

# Даем права на запись в data
chmod 777 /app/data

# Применяем миграции (создаст базу данных, если её нет)
echo " Применение миграций..."
python manage.py migrate --noinput

# Собираем статические файлы
echo " Сборка статических файлов..."
python manage.py collectstatic --noinput

# Проверяем, есть ли суперпользователь
echo " Проверка суперпользователя..."
python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print(' Суперпользователь создан: admin / admin123')
else:
    print(' Суперпользователь уже существует')
"

echo "========================================="
echo "ПРИЛОЖЕНИЕ ГОТОВО К ЗАПУСКУ"
echo "========================================="

# Запускаем команду, переданную в CMD (из Dockerfile)
exec "$@"