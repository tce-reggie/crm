#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} ИЗМЕНЕНИЕ IP АДРЕСА СЕРВЕРА${NC}"
echo -e "${GREEN}=========================================${NC}"

# Проверка, что скрипт запущен с sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED} Пожалуйста, запустите скрипт с sudo:${NC}"
    echo -e "${YELLOW}   sudo $0${NC}"
    exit 1
fi

# Получаем текущий IP
CURRENT_IP=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | head -1)

if [ -z "$CURRENT_IP" ]; then
    echo -e "${RED} Не удалось определить текущий IP${NC}"
    CURRENT_IP="не определен"
fi

echo -e "${YELLOW}Текущий IP:${NC} $CURRENT_IP"
echo ""

# Запрашиваем новый IP
read -p "Введите новый IP адрес (например 192.168.1.100): " NEW_IP
read -p "Введите маску подсети (например 24): " NETMASK
read -p "Введите шлюз (Gateway, например 192.168.1.1): " GATEWAY

# Проверяем, что поля не пустые
if [ -z "$NEW_IP" ] || [ -z "$NETMASK" ] || [ -z "$GATEWAY" ]; then
    echo -e "${RED} Ошибка: все поля должны быть заполнены${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Применяю настройки:${NC}"
echo "  IP: $NEW_IP"
echo "  Маска: $NETMASK"
echo "  Шлюз: $GATEWAY"
echo ""

# Проверяем существование конфига
if [ ! -f /etc/netplan/00-installer-config.yaml ]; then
    echo -e "${YELLOW} Файл конфигурации не найден, создаю новый...${NC}"
    touch /etc/netplan/00-installer-config.yaml
fi

# Создаем резервную копию
echo -e "${YELLOW} Создание резервной копии...${NC}"
cp /etc/netplan/00-installer-config.yaml /etc/netplan/00-installer-config.yaml.bak.$(date +%Y%m%d_%H%M%S)

# Генерируем новый конфиг
echo -e "${YELLOW} Создание новой конфигурации сети...${NC}"
cat > /etc/netplan/00-installer-config.yaml << EOF
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - $NEW_IP/$NETMASK
      routes:
        - to: default
          via: $GATEWAY
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4, 1.1.1.1]
EOF

# Применяем настройки
echo -e "${YELLOW} Применение настроек сети...${NC}"
netplan apply

if [ $? -eq 0 ]; then
    echo -e "${GREEN} Настройки сети применены${NC}"
else
    echo -e "${RED} Ошибка при применении настроек сети${NC}"
    exit 1
fi

# Обновляем ALLOWED_HOSTS в Django
echo -e "${YELLOW} Обновление ALLOWED_HOSTS в .env...${NC}"

if [ ! -f /opt/event-system/.env ]; then
    echo -e "${RED} Файл .env не найден в /opt/event-system/${NC}"
    exit 1
fi

cd /opt/event-system

# Создаем резервную копию .env
cp .env .env.bak.$(date +%Y%m%d_%H%M%S)

# Обновляем ALLOWED_HOSTS
if grep -q "ALLOWED_HOSTS=" .env; then
    sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=$NEW_IP,localhost,127.0.0.1/" .env
    echo -e "${GREEN} ALLOWED_HOSTS обновлен: $NEW_IP,localhost,127.0.0.1${NC}"
else
    echo "ALLOWED_HOSTS=$NEW_IP,localhost,127.0.0.1" >> .env
    echo -e "${GREEN} ALLOWED_HOSTS добавлен: $NEW_IP,localhost,127.0.0.1${NC}"
fi

# Перезапускаем контейнеры
echo -e "${YELLOW} Перезапуск Docker контейнеров...${NC}"
docker-compose down
docker-compose up -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN} Контейнеры перезапущены${NC}"
else
    echo -e "${RED} Ошибка при перезапуске контейнеров${NC}"
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} IP УСПЕШНО ИЗМЕНЕН НА: $NEW_IP${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} Приложение доступно по адресу: http://$NEW_IP${NC}"
echo -e "${GREEN} Доступ с хоста (через проброс портов): http://<IP-хоста>:8080${NC}"
echo -e "${GREEN}=========================================${NC}"

# Показываем новый IP
sleep 2
NEW_IP_AFTER=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | head -1)
echo -e "${YELLOW}Текущий IP после изменений:${NC} $NEW_IP_AFTER"