// ========================
// DELIVERY INTERFACE JS
// ========================

const API_URLS = {
    orders: '/api/delivery/orders/',
    completeOrder: '/api/delivery/orders/', // + ID/complete/
};

// Глобальные переменные
let currentOrders = [];

// ========================
// ОСНОВНЫЕ ФУНКЦИИ
// ========================

// Загрузка заказов
async function loadOrders() {
    console.log('Загрузка заказов для выдачи...');

    const container = document.getElementById('ordersContainer');
    if (!container) return;

    // Показываем загрузку
    container.innerHTML = '<div class="loading"><p>Загрузка заказов...</p></div>';

    try {
        // Получаем поисковый запрос
        const searchQuery = document.getElementById('searchInput').value;

        // Формируем URL с параметрами
        let url = API_URLS.orders;
        if (searchQuery) {
            url += '?search=' + encodeURIComponent(searchQuery);
        }

        console.log('Запрашиваю URL:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Ошибка загрузки заказов');
        }

        currentOrders = result.orders;
        displayOrders(currentOrders);

    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка загрузки заказов: ${error.message}</p>
                <button onclick="loadOrders()" style="
                    padding: 8px 16px;
                    margin-top: 10px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Повторить</button>
            </div>
        `;
    }
}

// Отображение заказов в таблице
function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="no-orders"><p>📭 Нет заказов, готовых к выдаче</p></div>';
        return;
    }

    let html = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th>№ Заказа</th>
                    <th>Клиент</th>
                    <th>Телефон</th>
                    <th>Товар</th>
                    <th>Размер</th>
                    <th>Статус</th>
                    <th>Дата заказа</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    orders.forEach(order => {
        html += `
            <tr data-order-id="${order.id}">
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>${order.phone_number}</td>
                <td>${order.product.model}<br>
                    <small style="color: #7f8c8d;">${order.product.color}</small>
                </td>
                <td><strong>${order.product.size}</strong></td>
                <td><span class="status-badge status-ready">Готов к выдаче</span></td>
                <td>${order.created_date}</td>
                <td>
                    <button class="action-btn btn-complete" onclick="completeOrder(${order.id})">
                        ✅ Выдать заказ
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// ========================
// ДЕЙСТВИЯ С ЗАКАЗАМИ
// ========================

// Выдача заказа
async function completeOrder(orderId) {
    // Находим заказ для отображения информации
    const order = currentOrders.find(o => o.id === orderId);

    if (!confirm(`Выдать заказ ${order?.order_number || ''} клиенту?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URLS.completeOrder}${orderId}/complete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            showMessage('✅ Заказ успешно выдан!', 'success');
            loadOrders(); // Обновляем список
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }

    } catch (error) {
        console.error('Ошибка выдачи заказа:', error);
        alert('Ошибка выдачи заказа: ' + error.message);
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

// Показ сообщения
function showMessage(text, type = 'success') {
    const message = document.createElement('div');
    message.className = 'success-message';
    message.textContent = text;
    document.body.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 3000);
}

// ========================
// ИНИЦИАЛИЗАЦИЯ
// ========================

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Интерфейс выдачи загружен');

    // Загружаем заказы
    loadOrders();

    // Назначаем обработчик поиска с задержкой (debounce)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadOrders();
            }, 500);
        });
    }

    // Обработка клавиши Enter в поле поиска
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadOrders();
            }
        });
    }
    startStatusCheck();
});

// Автообновление каждые 30 секунд
setInterval(loadOrders, 30000);

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

        if (data.success && !data.is_active) {
            // Аккаунт деактивирован - показываем сообщение
            showPauseMessage();
        }
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
    }
}

function showPauseMessage() {
    // Останавливаем таймер неактивности
    clearTimeout(inactivityTimer);
    // Останавливаем проверку статуса
    clearInterval(statusCheckInterval);

    // Создаем затемнение
    const overlay = document.createElement('div');
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

    // Добавляем стиль анимации
    const style = document.createElement('style');
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

    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);

    // Запускаем проверку каждые 5 секунд для авто-возобновления
    const resumeCheck = setInterval(async () => {
        try {
            const response = await fetch('/api/check-user-status/');
            const data = await response.json();

            if (data.success && data.is_active) {
                // Аккаунт снова активен - перезагружаем страницу
                window.location.reload();
            }
        } catch (error) {
            console.error('Ошибка проверки статуса:', error);
        }
    }, 5000);
}