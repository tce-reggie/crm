// ========================
// COMPOSING INTERFACE JS
// ========================

const API_URLS = {
    getNewOrder: '/api/composing/orders/new/',
    getCurrentOrder: '/api/composing/orders/current/',
    completeOrder: '/api/composing/orders/', // + ID/complete
    cancelOrder: '/api/composing/orders/', // + ID/cancel
};

let currentOrder = null;
let currentAssignmentId = null;

// ========================
// ОСНОВНЫЕ ФУНКЦИИ
// ========================

// Загрузка нового заказа
async function loadNewOrder() {
    console.log('Запрос нового заказа...');

    const container = document.getElementById('currentOrderContainer');
    const newOrderBtn = document.getElementById('newOrderBtn');
    const statusMsg = document.getElementById('statusMessage');

    if (!container) return;

    // Показываем загрузку
    container.innerHTML = '<div class="loading"><p>Поиск нового заказа...</p></div>';
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
                        <p>🚫 Нет доступных заказов для компоновки</p>
                        <p><small>Все заказы в работе или ожидают подтверждения</small></p>
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

        console.log('Текущий заказ:', currentOrder);

        // Заказ сразу в работе
        displayCurrentOrder(currentOrder);
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

// Отображение текущего заказа
function displayCurrentOrder(order) {
    const container = document.getElementById('currentOrderContainer');
    const newOrderBtn = document.getElementById('newOrderBtn');

    if (!container || !order) return;

    // Скрываем кнопку "Новый заказ"
    if (newOrderBtn) {
        newOrderBtn.style.display = 'none';
        newOrderBtn.disabled = false;
    }

    let html = `
        <div class="order-card">
            <div class="order-header">
                <div class="order-number">Заказ: ${order.order_number}</div>
                <div class="order-status status-in_progress">${order.status_display}</div>
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
            html += `
                <div class="print-area-card">
                    <div style="font-weight: bold; color: #2c3e50; margin-bottom: 5px;">
                        ${index + 1}. Зона печати: ${escapeHtml(print.area_name)}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Содержимое:</strong> ${escapeHtml(print.content)}
                    </div>
                    <div style="color: #7f8c8d; font-size: 12px;">
                        Координаты: X=${print.position_x}px, Y=${print.position_y}px
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    } else {
        html += `
            <div class="prints-container">
                <div class="prints-title">Принты</div>
                <p style="color: #95a5a6;">Принты не добавлены</p>
            </div>
        `;
    }

    html += `</div>`;

    container.innerHTML = html;
}

// Показать кнопки управления заказом
function showOrderControls() {
    const controls = document.getElementById('controls');
    const statusMsg = document.getElementById('statusMessage');

    if (controls) {
        controls.innerHTML = `
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
                <button class="btn-success" onclick="completeOrder()" style="padding: 12px 30px;">
                    ✅ Заказ собран
                </button>
                <button class="btn-warning" onclick="cancelCurrentOrder()" style="padding: 12px 30px;">
                    ❌ Вернуть заказ
                </button>
            </div>
        `;
    }

    if (statusMsg) {
        statusMsg.innerHTML = '<p style="color: #3498db; font-size: 16px;">⚙️ Заказ в работе...</p>';
    }
}

// Завершить заказ
async function completeOrder() {
    if (!currentOrder) {
        alert('Нет текущего заказа');
        return;
    }

    if (!confirm('Подтвердить завершение компоновки заказа?')) return;

    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) {
        statusMsg.innerHTML = '<p style="color: #f39c12;">⏳ Завершение заказа...</p>';
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
            alert('✅ Заказ успешно собран!');
            resetInterface();
            loadNewOrder(); // Автоматически ищем следующий заказ
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            if (statusMsg) statusMsg.innerHTML = '';
        }

    } catch (error) {
        console.error('Ошибка завершения заказа:', error);
        alert('Ошибка завершения заказа: ' + error.message);
        if (statusMsg) statusMsg.innerHTML = '';
    }
}

// Вернуть заказ (отменить работу)
async function cancelCurrentOrder() {
    if (!currentOrder) {
        alert('Нет текущего заказа');
        return;
    }

    const reason = prompt('Укажите причину возврата заказа:');
    if (reason === null || reason.trim() === '') {
        alert('Необходимо указать причину возврата');
        return;
    }

    if (!confirm(`Вернуть заказ? Причина: ${reason}`)) return;

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
    console.log('Проверка текущего заказа...');

    try {
        const response = await fetch(API_URLS.getCurrentOrder);
        if (response.ok) {
            const result = await response.json();
            console.log('Результат проверки заказа:', result);

            if (result.success && result.order) {
                currentOrder = result.order;
                currentAssignmentId = result.assignment_id;
                displayCurrentOrder(currentOrder);
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
    console.log('Интерфейс компоновки загружен');

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

    // Обновление каждые 30 секунд (опционально)
    setInterval(checkCurrentOrder, 30000);
});

// Функция для ручного обновления (можно добавить кнопку в интерфейс)
function refreshInterface() {
    console.log('Ручное обновление интерфейса');
    checkCurrentOrder();
}