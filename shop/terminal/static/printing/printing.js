// ========================
// PRINTING INTERFACE JS
// ========================

const API_URLS = {
    getNewOrder: '/api/printing/orders/new/',
    getCurrentOrder: '/api/printing/orders/current/',
    completeOrder: '/api/printing/orders/', // + ID/complete
    cancelOrder: '/api/printing/orders/', // + ID/cancel
    getPrintZoneImage: '/api/printing/zone-image/', // + area_id/
};

let currentOrder = null;
let currentAssignmentId = null;
let currentAreaImages = {}; // Кэш изображений зон печати

// ========================
// ОСНОВНЫЕ ФУНКЦИИ
// ========================

// Загрузка нового заказа
async function loadNewOrder() {
    console.log('Запрос нового заказа для печати...');

    const container = document.getElementById('currentOrderContainer');
    const newOrderBtn = document.getElementById('newOrderBtn');
    const statusMsg = document.getElementById('statusMessage');

    if (!container) return;

    // Показываем загрузку
    container.innerHTML = '<div class="loading"><p>Поиск заказа для печати...</p></div>';
    if (newOrderBtn) newOrderBtn.disabled = true;
    if (statusMsg) statusMsg.innerHTML = '';

    try {
        const response = await fetch(API_URLS.getNewOrder);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Результат загрузки заказа:', result);

        if (!result.success) {
            if (result.error === 'Нет доступных заказов') {
                container.innerHTML = `
                    <div class="no-orders">
                        <p>🚫 Нет доступных заказов для печати</p>
                        <p><small>Все заказы в работе или ожидают компоновки</small></p>
                    </div>
                `;
                if (statusMsg) statusMsg.innerHTML = '<p style="color: #e74c3c;">Нет доступных заказов</p>';
                if (newOrderBtn) newOrderBtn.disabled = false;
                return;
            }
            throw new Error(result.error || 'Ошибка загрузки заказа');
        }

        currentOrder = result.order;
        currentAssignmentId = result.assignment_id;

        console.log('Текущий заказ для печати:', currentOrder);

        // Заказ сразу в работе
        await displayCurrentOrder(currentOrder);
        showOrderControls();

    } catch (error) {
        console.error('Ошибка загрузки заказа:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>Ошибка загрузки заказа: ${error.message}</p>
                <button class="btn-primary" onclick="loadNewOrder()" style="margin-top: 10px;">
                    🔄 Повторить
                </button>
            </div>
        `;
        if (newOrderBtn) newOrderBtn.disabled = false;
    }
}

// Отображение текущего заказа с предпросмотром печати
async function displayCurrentOrder(order) {
    const container = document.getElementById('currentOrderContainer');
    const newOrderBtn = document.getElementById('newOrderBtn');

    if (!container || !order) return;

    // Скрываем кнопку "Новый заказ"
    if (newOrderBtn) {
        newOrderBtn.style.display = 'none';
        newOrderBtn.disabled = false;
    }

    // Группируем принты по зонам
    const printsByArea = {};
    order.prints.forEach(print => {
        const areaName = print.area_name;
        if (!printsByArea[areaName]) {
            printsByArea[areaName] = [];
        }
        printsByArea[areaName].push(print);
    });

    let html = `
        <div class="order-card">
            <div class="order-header">
                <div class="order-number">Заказ: ${order.order_number}</div>
                <div class="order-status status-printing">${order.status_display}</div>
            </div>

            <div class="product-info">
                <div class="info-item">
                    <div class="info-label">Модель товара</div>
                    <div class="info-value">${escapeHtml(order.product.model)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Цвет</div>
                    <div class="info-value">${escapeHtml(order.product.color)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Размер</div>
                    <div class="info-value">${escapeHtml(order.product.size)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Клиент</div>
                    <div class="info-value">${escapeHtml(order.customer_name)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Телефон</div>
                    <div class="info-value">${escapeHtml(order.phone_number)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Дата заказа</div>
                    <div class="info-value">${escapeHtml(order.created_date)}</div>
                </div>
            </div>
    `;

    // Информация о принтах
    if (order.prints && order.prints.length > 0) {
        html += `
            <div class="prints-container">
                <div class="prints-title">Принты для нанесения (${order.prints.length}):</div>
        `;

        order.prints.forEach((print, index) => {
            const printType = print.content.includes('/') ? 'Изображение' : 'Текст';
            html += `
                <div class="print-area-card">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <div style="font-weight: bold; color: #2c3e50;">
                            ${index + 1}. ${escapeHtml(print.area_name)}
                        </div>
                        <div style="color: #7f8c8d; font-size: 12px;">
                            ${printType}
                        </div>
                    </div>
                    <div style="margin-bottom: 8px; background: #f8f9fa; padding: 8px; border-radius: 4px;">
                        <strong>Содержимое:</strong><br>
                        ${printType === 'Текст'
                            ? escapeHtml(print.content)
                            : `<img src="/media/prints/${print.content.split('/').pop()}" style="width: auto; height: auto; max-width: none; max-height: none; display: block;">`
                        }
                    </div>
                    <div style="color: #7f8c8d; font-size: 12px;">
                        Координаты: X=${print.position_x}px, Y=${print.position_y}px
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    }

    // Вкладки для переключения между зонами печати
    const areaNames = Object.keys(printsByArea);
    if (areaNames.length > 0) {
        html += `
            <div class="print-preview-container">
                <div class="print-preview-title">Предпросмотр печати</div>

                <div class="print-area-tabs" id="areaTabs">
        `;

        // Создаем вкладки для каждой зоны
        areaNames.forEach((areaName, index) => {
            const isActive = index === 0 ? 'active' : '';
            html += `
                <button class="print-area-tab ${isActive}"
                        onclick="switchPrintArea('${areaName}')"
                        data-area="${areaName}">
                    ${areaName}
                </button>
            `;
        });

        html += `
                </div>

                <div class="print-area-preview" id="printAreaPreview">
                    <!-- Здесь будет отображаться изображение зоны с принтами -->
                    <div style="text-align: center; padding: 50px;">
                        Загрузка изображения зоны печати...
                    </div>
                </div>
            </div>
        `;
    }

    html += `</div>`;

    container.innerHTML = html;

    // Загружаем изображения зон печати и отображаем первую зону
    if (areaNames.length > 0) {
        await loadAreaImages(order.product, areaNames);
        if (areaNames[0]) {
            await renderPrintArea(areaNames[0], printsByArea[areaNames[0]]);
        }
    }
}

// Загрузка изображений зон печати
async function loadAreaImages(product, areaNames) {
    currentAreaImages = {};

    for (const areaName of areaNames) {
        try {
            const response = await fetch(`${API_URLS.getPrintZoneImage}?product_id=${product.id}&area_name=${encodeURIComponent(areaName)}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.image_url) {
                    currentAreaImages[areaName] = result.image_url;
                }
            }
        } catch (error) {
            console.error(`Ошибка загрузки изображения зоны ${areaName}:`, error);
        }
    }
}

// Отображение конкретной зоны печати с принтами
// Отображение конкретной зоны печати с принтами
async function renderPrintArea(areaName, prints) {
    const previewContainer = document.getElementById('printAreaPreview');
    if (!previewContainer) return;

    const imageUrl = currentAreaImages[areaName];

    if (!imageUrl) {
        previewContainer.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #95a5a6;">
                <p>Изображение зоны "${areaName}" не найдено</p>
                <p><small>Схематичное расположение принтов:</small></p>
                <div style="position: relative; width: 400px; height: 400px; margin: 0 auto; border: 2px dashed #ddd; background: #f8f9fa;">
                    ${prints.map(print => {
                        const isImage = print.content.includes('/');
                        return `
                            <div style="position: absolute;
                                       left: ${print.position_x}px;
                                       top: ${print.position_y}px;
                                       border: 2px solid ${isImage ? '#3498db' : '#2ecc71'};
                                       background: ${isImage ? '#3498db20' : '#2ecc7120'};
                                       padding: 5px;
                                       border-radius: 4px;">
                                ${isImage ? '🖼️' : '📝'}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        return;
    }

    // Создаем контейнер для изображения и принтов
    previewContainer.innerHTML = `
        <div style="position: relative; display: inline-block;">
            <img src="${imageUrl}" class="print-zone-image" id="zoneImage"
                 style="width: auto; height: auto; display: block;"
                 onload="positionPrints('${areaName}')">
            <div id="printsOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
        </div>
    `;
}

// Позиционирование принтов на изображении зоны
function positionPrints(areaName) {
    const prints = currentOrder.prints.filter(p => p.area_name === areaName);
    const imageElement = document.getElementById('zoneImage');
    const overlay = document.getElementById('printsOverlay');

    if (!imageElement || !overlay) return;

    // Очищаем предыдущие принты
    overlay.innerHTML = '';

    // Получаем смещение области из данных заказа
    const areaOffset = currentOrder.print_areas?.[areaName] || { offset_x: 0, offset_y: 0 };

    // Добавляем каждый принт с учетом смещения области
    prints.forEach(print => {
        const isImage = print.content.includes('/');

        const printElement = document.createElement('div');
        printElement.className = 'print-content-overlay';

        // Позиционируем относительно изображения с учетом смещения области
        const x = parseFloat(print.position_x) + (areaOffset.offset_x || 0);
        const y = parseFloat(print.position_y) + (areaOffset.offset_y || 0);

        printElement.style.left = `${x}px`;
        printElement.style.top = `${y}px`;

        if (isImage) {
            // Для изображений
            printElement.innerHTML = `
                <img src="/media/prints/${print.content.split('/').pop()}" class="print-content-image"
                     style="width: auto; height: auto;">
            `;
        } else {
            // Для текста
             printElement.innerHTML = `
                <div style="
                    font-family: Arial, sans-serif;
                    font-size: 16px;
                    font-weight: normal;
                    color: #FFFFFF;
                    background: transparent;
                    padding: 0;
                    margin: 0;
                    line-height: 1.2;
                    text-align: center;
                    white-space: normal;
                    word-wrap: break-word;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    ${escapeHtml(print.content)}
                </div>
            `;
        }

        overlay.appendChild(printElement);
    });
}

// Переключение между зонами печати
function switchPrintArea(areaName) {
    // Обновляем активную вкладку
    const tabs = document.querySelectorAll('.print-area-tab');
    tabs.forEach(tab => {
        if (tab.dataset.area === areaName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Находим принты для этой зоны
    const prints = currentOrder.prints.filter(p => p.area_name === areaName);
    renderPrintArea(areaName, prints);
}

// Показать кнопки управления заказом
function showOrderControls() {
    const controls = document.getElementById('controls');
    const statusMsg = document.getElementById('statusMessage');

    if (controls) {
        controls.innerHTML = `
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
                <button class="btn-success" onclick="completeOrder()" style="padding: 12px 30px;">
                    ✅ Заказ напечатан
                </button>
                <button class="btn-warning" onclick="cancelCurrentOrder()" style="padding: 12px 30px;">
                    ❌ Вернуть заказ
                </button>
            </div>
        `;
    }

    if (statusMsg) {
        statusMsg.innerHTML = '<p style="color: #3498db; font-size: 16px;">🖨️ Заказ в печати...</p>';
    }
}

// Завершить печать заказа
async function completeOrder() {
    if (!currentOrder) {
        alert('Нет текущего заказа');
        return;
    }

    if (!confirm('Подтвердить завершение печати заказа?')) return;

    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) {
        statusMsg.innerHTML = '<p style="color: #f39c12;">⏳ Завершение печати...</p>';
    }

    try {
        const response = await fetch(`${API_URLS.completeOrder}${currentOrder.id}/complete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Заказ успешно напечатан!');
            resetInterface();
            loadNewOrder(); // Автоматически ищем следующий заказ
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            if (statusMsg) statusMsg.innerHTML = '';
        }

    } catch (error) {
        console.error('Ошибка завершения печати:', error);
        alert('Ошибка завершения печати: ' + error.message);
        if (statusMsg) statusMsg.innerHTML = '';
    }
}

// Вернуть заказ (отменить печать)
async function cancelCurrentOrder() {
    if (!currentOrder) {
        alert('Нет текущего заказа');
        return;
    }

    const reason = prompt('Укажите причину возврата заказа (проблемы с печатью, качеством и т.д.):');
    if (reason === null || reason.trim() === '') {
        alert('Необходимо указать причину возврата');
        return;
    }

    if (!confirm(`Вернуть заказ в очередь? Причина: ${reason}`)) return;

    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) {
        statusMsg.innerHTML = '<p style="color: #f39c12;">⏳ Возврат заказа...</p>';
    }

    try {
        const response = await fetch(`${API_URLS.cancelOrder}${currentOrder.id}/cancel/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ reason: reason })
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Заказ возвращен в очередь');
            resetInterface();
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            if (statusMsg) statusMsg.innerHTML = '';
        }

    } catch (error) {
        console.error('Ошибка возврата заказа:', error);
        alert('Ошибка возврата заказа: ' + error.message);
        if (statusMsg) statusMsg.innerHTML = '';
    }
}

// Сброс интерфейса
function resetInterface() {
    currentOrder = null;
    currentAssignmentId = null;
    currentAreaImages = {};

    const container = document.getElementById('currentOrderContainer');
    const controls = document.getElementById('controls');
    const newOrderBtn = document.getElementById('newOrderBtn');
    const statusMsg = document.getElementById('statusMessage');

    if (container) container.innerHTML = '';
    if (controls) {
        controls.innerHTML = `
            <div style="text-align: center;">
                <button id="newOrderBtn" class="btn-primary" onclick="loadNewOrder()" style="padding: 15px 40px; font-size: 18px;">
                    🆕 Взять новый заказ
                </button>
            </div>
        `;
    }
    if (statusMsg) statusMsg.innerHTML = '';
}

// Проверка текущего заказа при загрузке
async function checkCurrentOrder() {
    console.log('Проверка текущего заказа для печати...');

    try {
        const response = await fetch(API_URLS.getCurrentOrder);
        if (response.ok) {
            const result = await response.json();
            console.log('Результат проверки заказа:', result);

            if (result.success && result.order) {
                currentOrder = result.order;
                currentAssignmentId = result.assignment_id;
                await displayCurrentOrder(currentOrder);
                showOrderControls();

                // Обновляем кнопку "Новый заказ"
                const newOrderBtn = document.getElementById('newOrderBtn');
                if (newOrderBtn) {
                    newOrderBtn.style.display = 'none';
                }
            } else {
                // Нет текущего заказа
                resetInterface();
            }
        }
    } catch (error) {
        console.error('Ошибка проверки текущего заказа:', error);
        resetInterface();
    }
}

// ========================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ========================

// Получение CSRF токена
function getCSRFToken() {
    const name = 'csrftoken';
    let cookieValue = null;

    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }

    return cookieValue;
}

// Экранирование HTML для безопасности
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Обновление статуса интерфейса
function updateInterfaceStatus(message, type = 'info') {
    const statusMsg = document.getElementById('statusMessage');
    if (!statusMsg) return;

    const colors = {
        'info': '#3498db',
        'success': '#2ecc71',
        'warning': '#f39c12',
        'error': '#e74c3c'
    };

    statusMsg.innerHTML = `<p style="color: ${colors[type] || colors.info};">${message}</p>`;
}

// ========================
// ИНИЦИАЛИЗАЦИЯ
// ========================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Интерфейс печати загружен');

    // Инициализация кнопок
    const controls = document.getElementById('controls');
    if (controls && !controls.innerHTML.trim()) {
        controls.innerHTML = `
            <div style="text-align: center;">
                <button id="newOrderBtn" class="btn-primary" onclick="loadNewOrder()" style="padding: 15px 40px; font-size: 18px;">
                    🆕 Взять новый заказ
                </button>
            </div>
        `;
    }

    // Проверяем, есть ли у работника текущий заказ
    checkCurrentOrder();

    // Добавляем обработчик ошибок
    window.addEventListener('error', function(event) {
        console.error('Глобальная ошибка:', event.error);
        updateInterfaceStatus('Произошла ошибка: ' + event.error.message, 'error');
    });

    // Обновление каждые 30 секунд
    setInterval(checkCurrentOrder, 30000);
    startStatusCheck();
});

// Функция для ручного обновления
function refreshInterface() {
    console.log('Ручное обновление интерфейса');
    checkCurrentOrder();
}

// ========================
// ПРОВЕРКА АКТИВНОСТИ АККАУНТА
// ========================

let statusCheckInterval = null;

function startStatusCheck() {
    // Проверяем статус каждые 10 секунд
    statusCheckInterval = setInterval(checkUserStatus, 10000);
}

async function checkUserStatus() {
    try {
        const response = await fetch('/api/check-user-status/');
        const data = await response.json();

        console.log('Проверка статуса:', data);

        if (data.success && !data.is_active) {
            // Аккаунт деактивирован - показываем сообщение
            showPauseMessage();
        }
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
    }
}

function showPauseMessage() {
    console.log('Аккаунт деактивирован, показываем сообщение...');

    // Убираем вызов clearTimeout(inactivityTimer) - его нет в этом файле
    // Просто останавливаем проверку статуса
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }

    // Проверяем, нет ли уже оверлея
    if (document.getElementById('pauseOverlay')) {
        return;
    }

    // Создаем затемнение
    const overlay = document.createElement('div');
    overlay.id = 'pauseOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
    `;

    // Создаем сообщение
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: pauseAppear 0.5s ease;
    `;

    messageBox.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px;">⏸️</div>
        <h2 style="font-size: 28px; margin-bottom: 15px;">Работа приостановлена</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">Ваш аккаунт был деактивирован администратором.</p>
        <p style="font-size: 14px; opacity: 0.8; margin-bottom: 20px;">Страница обновится автоматически после активации.</p>
        <div style="width: 100%; height: 2px; background: rgba(255,255,255,0.2); margin: 20px 0;"></div>
        <p style="font-size: 12px;">Обратитесь к администратору для возобновления работы</p>
    `;

    // Добавляем стиль анимации (только если его еще нет)
    if (!document.getElementById('pauseAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'pauseAnimationStyle';
        style.textContent = `
            @keyframes pauseAppear {
                from {
                    transform: scale(0.8);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);

    // Запускаем проверку каждые 5 секунд для авто-возобновления
    const resumeCheck = setInterval(async () => {
        try {
            const response = await fetch('/api/check-user-status/');
            const data = await response.json();

            if (data.success && data.is_active) {
                console.log('Аккаунт снова активен, перезагружаем...');
                clearInterval(resumeCheck);
                window.location.reload();
            }
        } catch (error) {
            console.error('Ошибка проверки статуса:', error);
        }
    }, 5000);
}
