#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Копируем все необходимые файлы из /vagrant
echo -e "${YELLOW} Копирование файлов приложения...${NC}"
sudo cp -r /vagrant/docker/* /opt/event-system/
sudo cp /vagrant/requirements.txt /opt/event-system/ 2>/dev/null || true
sudo cp -r /vagrant/shop /opt/event-system/ 2>/dev/null || true
sudo cp -r /vagrant/terminal /opt/event-system/ 2>/dev/null || true

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} ЗАПУСК EVENT MANAGEMENT SYSTEM${NC}"
echo -e "${GREEN}=========================================${NC}"

# Переходим в директорию с Docker файлами
cd /opt/event-system || {
    echo -e "${RED} Ошибка: директория /opt/event-system не найдена${NC}"
    exit 1
}

# Проверяем наличие docker-compose.yml
if [ ! -f docker-compose.yml ]; then
    echo -e "${RED} Ошибка: docker-compose.yml не найден в /opt/event-system/${NC}"
    exit 1
fi

# Проверяем .env файл
if [ ! -f .env ]; then
    echo -e "${YELLOW} Создание .env файла из примера...${NC}"
    if [ ! -f .env.example ]; then
        echo -e "${RED} Ошибка: .env.example не найден${NC}"
        exit 1
    fi
    cp .env.example .env
    echo -e "${YELLOW}️ Создан файл .env. Отредактируйте его при необходимости:${NC}"
    echo -e "${YELLOW}  sudo nano /opt/event-system/.env${NC}"
fi

# Проверяем, запущен ли Docker
if ! systemctl is-active --quiet docker; then
    echo -e "${YELLOW} Запуск Docker сервиса...${NC}"
    sudo systemctl start docker
    sleep 2
fi

# Проверяем, не запущены ли уже контейнеры
if docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}  Контейнеры уже запущены. Перезапускаем...${NC}"
    docker-compose down
fi

# Запускаем контейнеры
echo -e "${YELLOW} Запуск Docker контейнеров...${NC}"
docker-compose up -d

# Проверяем результат
if [ $? -eq 0 ]; then
    echo -e "${GREEN} Контейнеры успешно запущены${NC}"
else
    echo -e "${RED} Ошибка при запуске контейнеров${NC}"
    exit 1
fi

# Ждем немного, чтобы контейнеры полностью инициализировались
sleep 3

# Показываем статус контейнеров
echo -e "\n${YELLOW} Статус контейнеров:${NC}"
docker-compose ps

# Получаем IP адрес VM
IP=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | head -1)

# Проверяем, что контейнер web доступен
if docker-compose exec web python manage.py check > /dev/null 2>&1; then
    DJANGO_STATUS="${GREEN} Работает${NC}"
else
    DJANGO_STATUS="${YELLOW} Запускается...${NC}"
fi

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN} ПРИЛОЖЕНИЕ ЗАПУЩЕНО!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} Доступ внутри VM:   http://localhost${NC}"
echo -e "${GREEN} Доступ с хоста:      http://$IP${NC}"
echo -e "${GREEN} Доступ извне:        http://<IP-хоста>:8080${NC}"
echo ""
echo -e "${YELLOW} Статус Django:       $DJANGO_STATUS${NC}"
echo -e "${YELLOW} Логи:                docker-compose logs -f${NC}"
echo -e "${YELLOW} Остановка:           docker-compose down${NC}"
echo -e "${YELLOW} Перезапуск:          docker-compose restart${NC}"
echo -e "${GREEN}=========================================${NC}"

# Проверяем, создалась ли база данных
if [ -f /opt/event-system/data/sqlite/db.sqlite3 ]; then
    echo -e "${GREEN} База данных:         найдена (/opt/event-system/data/sqlite/db.sqlite3)${NC}"
else
    echo -e "${YELLOW} База данных:         будет создана при первом запросе${NC}"
fi