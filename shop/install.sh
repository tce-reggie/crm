#!/bin/bash

set -e  # Останавливаем скрипт при ошибке

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} Начинаем установку Event Management System${NC}"
echo -e "${GREEN}=========================================${NC}"

# Обновление системы
echo -e "${YELLOW} Обновление пакетов...${NC}"
apt-get update
apt-get upgrade -y

# Установка базовых пакетов
echo -e "${YELLOW} Установка базовых пакетов...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    git \
    vim \
    net-tools \
    gnome-terminal \
    xdg-utils \
    python3 \
    python3-pip \
    python3-venv

# Установка Docker
echo -e "${YELLOW} Установка Docker...${NC}"
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED} Ошибка: Docker не установился${NC}"
    exit 1
fi
echo -e "${GREEN} Docker установлен${NC}"

# Установка Docker Compose
echo -e "${YELLOW} Установка Docker Compose...${NC}"
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED} Ошибка: Docker Compose не установился${NC}"
    exit 1
fi
echo -e "${GREEN} Docker Compose установлен${NC}"

# Добавление пользователя в группу docker
echo -e "${YELLOW} Добавление пользователя в группу docker...${NC}"
usermod -aG docker vagrant

# Копирование Docker файлов
echo -e "${YELLOW} Копирование файлов приложения...${NC}"
mkdir -p /opt/event-system
cp -r /vagrant/docker/* /opt/event-system/
cp /vagrant/docker/.env.example /opt/event-system/.env

# Создание рабочих директорий
echo -e "${YELLOW} Создание директорий для данных...${NC}"
mkdir -p /opt/event-system/data/sqlite   # Для SQLite
mkdir -p /opt/event-system/data/postgres # На будущее
mkdir -p /opt/event-system/logs

if [ -f /vagrant/data/db.sqlite3 ]; then
    echo " Копирование базы данных..."
    cp /vagrant/data/db.sqlite3 /opt/event-system/data/sqlite/db.sqlite3
    chmod 666 /opt/event-system/data/sqlite/db.sqlite3
fi

# Настройка прав
chown -R vagrant:vagrant /opt/event-system

# Создание ярлыков на рабочем столе
echo -e "${YELLOW} Создание ярлыков на рабочем столе...${NC}"
mkdir -p /home/vagrant/Desktop
cp /vagrant/shortcuts/*.desktop /home/vagrant/Desktop/
chmod +x /home/vagrant/Desktop/*.desktop
chown -R vagrant:vagrant /home/vagrant/Desktop

# Копирование скриптов
echo -e "${YELLOW} Копирование скриптов управления...${NC}"
cp -r /vagrant/scripts /home/vagrant/
chmod +x /home/vagrant/scripts/*.sh
chown -R vagrant:vagrant /home/vagrant/scripts

# Создание сервиса автозапуска
echo -e "${YELLOW} Настройка автозапуска...${NC}"
cat > /etc/systemd/system/event-system.service << EOF
[Unit]
Description=Event Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/event-system
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=vagrant
Group=docker

[Install]
WantedBy=multi-user.target
EOF

systemctl enable event-system.service

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} УСТАНОВКА ЗАВЕРШЕНА!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} Для доступа к приложению: http://localhost:8080${NC}"
echo -e "${GREEN} SSH доступ: ssh -p 2222 vagrant@localhost (пароль: vagrant)${NC}"
echo -e "${GREEN}=========================================${NC}"