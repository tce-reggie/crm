#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} НАСТРОЙКА ПРОБРОСА ПОРТОВ${NC}"
echo -e "${GREEN}=========================================${NC}"

# Имя VM (из Vagrantfile)
VM_NAME="EventManagementServer"

# Проверяем, установлен ли VirtualBox
if ! command -v VBoxManage &> /dev/null; then
    echo -e "${RED} VirtualBox не найден. Установите VirtualBox.${NC}"
    exit 1
fi

# Проверяем, существует ли VM
if ! VBoxManage list vms | grep -q "$VM_NAME"; then
    echo -e "${RED} Виртуальная машина '$VM_NAME' не найдена${NC}"
    echo -e "${YELLOW}Доступные VM:${NC}"
    VBoxManage list vms
    exit 1
fi

# Показываем текущие правила
echo -e "${YELLOW}Текущие правила проброса портов:${NC}"
CURRENT_RULES=$(VBoxManage showvminfo "$VM_NAME" | grep "NIC.*Rule" || echo "Правила не найдены")
echo "$CURRENT_RULES"
echo ""

# Запрашиваем новые порты
read -p "Введите порт на хосте для веб-доступа (по умолчанию 8080): " HOST_PORT
HOST_PORT=${HOST_PORT:-8080}

read -p "Введите порт на хосте для SSH (по умолчанию 2222): " SSH_PORT
SSH_PORT=${SSH_PORT:-2222}

# Проверяем, что порты не заняты
echo -e "${YELLOW} Проверка доступности портов...${NC}"
if ss -tln | grep -q ":$HOST_PORT "; then
    echo -e "${RED} Порт $HOST_PORT уже занят на хосте${NC}"
    exit 1
fi
if ss -tln | grep -q ":$SSH_PORT "; then
    echo -e "${RED} Порт $SSH_PORT уже занят на хосте${NC}"
    exit 1
fi
echo -e "${GREEN} Порты свободны${NC}"

echo ""
echo -e "${YELLOW}Применяю настройки:${NC}"
echo "  Веб: порт $HOST_PORT -> порт 80 VM"
echo "  SSH: порт $SSH_PORT -> порт 22 VM"
echo ""

# Проверяем состояние VM
VM_STATE=$(VBoxManage showvminfo "$VM_NAME" | grep "State:" | awk '{print $2}')
echo -e "${YELLOW}Текущее состояние VM: $VM_STATE${NC}"

# Если VM запущена, останавливаем
if [ "$VM_STATE" == "running" ]; then
    echo -e "${YELLOW} Остановка VM...${NC}"
    VBoxManage controlvm "$VM_NAME" poweroff
    sleep 3
fi

# Удаляем старые правила (игнорируем ошибки)
echo -e "${YELLOW} Удаление старых правил...${NC}"
VBoxManage modifyvm "$VM_NAME" --natpf1 delete "web" 2>/dev/null || true
VBoxManage modifyvm "$VM_NAME" --natpf1 delete "ssh" 2>/dev/null || true

# Добавляем новые правила
echo -e "${YELLOW}➕ Добавление новых правил...${NC}"
if VBoxManage modifyvm "$VM_NAME" --natpf1 "web,tcp,,$HOST_PORT,,80"; then
    echo -e "${GREEN} Правило для веба добавлено${NC}"
else
    echo -e "${RED} Ошибка при добавлении правила для веба${NC}"
fi

if VBoxManage modifyvm "$VM_NAME" --natpf1 "ssh,tcp,,$SSH_PORT,,22"; then
    echo -e "${GREEN} Правило для SSH добавлено${NC}"
else
    echo -e "${RED} Ошибка при добавлении правила для SSH${NC}"
fi

# Запускаем VM
echo -e "${YELLOW} Запуск VM...${NC}"
VBoxManage startvm "$VM_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN} VM успешно запущена${NC}"
else
    echo -e "${RED} Ошибка при запуске VM${NC}"
    exit 1
fi

# Ждем загрузки VM
echo -e "${YELLOW} Ожидание загрузки VM (10 секунд)...${NC}"
sleep 10

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} ПРОБРОС ПОРТОВ НАСТРОЕН!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} Веб доступ:${NC}"
echo -e "   http://localhost:$HOST_PORT"
echo -e "   http://<IP-вашего-компьютера>:$HOST_PORT"
echo ""
echo -e "${GREEN} SSH доступ:${NC}"
echo -e "   ssh -p $SSH_PORT vagrant@localhost"
echo -e "   Пароль: vagrant"
echo ""
echo -e "${YELLOW} Для проверки:${NC}"
echo -e "   curl http://localhost:$HOST_PORT"
echo -e "   ssh -p $SSH_PORT vagrant@localhost 'echo \"SSH работает\"'"
echo -e "${GREEN}=========================================${NC}"

# Проверяем доступность веба
echo -e "${YELLOW} Проверка доступности веб-интерфейса...${NC}"
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$HOST_PORT | grep -q "200\|302"; then
    echo -e "${GREEN} Веб-интерфейс доступен по адресу: http://localhost:$HOST_PORT${NC}"
else
    echo -e "${YELLOW} Веб-интерфейс пока не отвечает. Подождите еще немного.${NC}"
    echo -e "${YELLOW} Проверьте позже: http://localhost:$HOST_PORT${NC}"
fi