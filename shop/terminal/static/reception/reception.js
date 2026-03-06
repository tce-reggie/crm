// ========================
// RECEPTION INTERFACE JS
// ========================

const API_URLS = {
    orders: '/api/reception/orders/',
    orderDetail: '/api/reception/orders/', // + ID
    confirmOrder: '/api/reception/orders/', // + ID/confirm
    cancelOrder: '/api/reception/orders/', // + ID/cancel
};

// Глобальные переменные
let currentOrders = [];
let selectedOrder = null;

// ========================
// ОСНОВНЫЕ ФУНКЦИИ
// ========================

// Загрузка заказов
async function loadOrders() {
    console.log('Загрузка заказов...');

    const container = document.getElementById('ordersContainer');
    if (!container) return;

    // Показываем загрузку
    container.innerHTML = '<div class="loading"><p>Загрузка заказов...</p></div>';

    try {
        // Получаем параметры фильтрации
        const statusFilter = document.getElementById('statusFilter').value;
        const searchQuery = document.getElementById('searchInput').value;

        // Формируем URL с параметрами
        let url = API_URLS.orders;
        const params = new URLSearchParams();

        if (statusFilter && statusFilter !== 'all') {
            params.append('status', statusFilter);
        }
        if (searchQuery) {
            params.append('search', searchQuery);
        }

        if (params.toString()) {
            url += '?' + params.toString();
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
                <p>Ошибка загрузки заказов: ${error.message}</p>
                <button onclick="loadOrders()">Повторить</button>
            </div>
        `;
    }
}

// Отображение заказов в таблице
function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="no-orders"><p>Заказы не найдены</p></div>';
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
                    <th>Принты</th>
                    <th>Статус</th>
                    <th>Дата</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    orders.forEach(order => {
        const statusClass = `status-${order.status}`;
        const statusText = order.status_display || order.status;

        html += `
            <tr data-order-id="${order.id}">
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>${order.phone_number}</td>
                <td>${order.product.model}<br>
                    <small>${order.product.color}, ${order.product.size}</small>
                </td>
                <td>${order.prints_count || 0}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${order.created_date}</td>
                <td>
                    ${order.status === 'new' ? `
                        <button class="action-btn btn-confirm" onclick="confirmOrder(${order.id})">
                            ✅ Подтвердить
                        </button>
                        <button class="action-btn btn-cancel" onclick="cancelOrder(${order.id})">
                            ❌ Отменить
                        </button>
                    ` : ''}
                    <button class="action-btn btn-view" onclick="viewOrderDetails(${order.id})">
                        👁️ Просмотр
                    </button>
                    <button class="action-btn btn-print" onclick="printOrderSticker(${order.id})">
                        🖨️ Печать
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

// Просмотр деталей заказа
async function viewOrderDetails(orderId) {
    console.log('Просмотр деталей заказа:', orderId);

    try {
        const response = await fetch(`${API_URLS.orderDetail}${orderId}/`);
        if (!response.ok) throw new Error('Ошибка загрузки деталей');

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        selectedOrder = result.order;

        console.log('Данные заказа для просмотра:', selectedOrder);
        console.log('Количество принтов:', selectedOrder.prints ? selectedOrder.prints.length : 0);
        console.log('Принты:', selectedOrder.prints);

        showOrderModal(selectedOrder);

    } catch (error) {
        console.error('Ошибка загрузки деталей заказа:', error);
        alert('Ошибка загрузки деталей заказа: ' + error.message);
    }
}

// Подтверждение заказа
async function confirmOrder(orderId) {
    if (!confirm('Подтвердить заказ?')) return;

    try {
        const response = await fetch(`${API_URLS.confirmOrder}${orderId}/confirm/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Заказ успешно подтвержден!');
            loadOrders(); // Обновляем список

            // После подтверждения сразу печатаем наклейку
            printOrderSticker(orderId);

        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }

    } catch (error) {
        console.error('Ошибка подтверждения заказа:', error);
        alert('Ошибка подтверждения заказа: ' + error.message);
    }
}

// Отмена заказа
async function cancelOrder(orderId) {
    const reason = prompt('Укажите причину отмены:');
    if (reason === null) return; // Пользователь нажал отмена

    if (!confirm(`Отменить заказ? Причина: ${reason}`)) return;

    try {
        const response = await fetch(`${API_URLS.cancelOrder}${orderId}/cancel/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ reason })
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Заказ успешно отменен!');
            loadOrders(); // Обновляем список
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }

    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        alert('Ошибка отмены заказа: ' + error.message);
    }
}

// ========================
// МОДАЛЬНЫЕ ОКНА
// ========================

// Показать модальное окно с деталями заказа
function showOrderModal(order) {
    const modal = document.getElementById('orderModal');
    const content = document.getElementById('modalContent');

    if (!modal || !content) return;

    let html = `
        <div class="order-details" style="
            font-family: Arial, sans-serif;
            line-height: 1.6;
        ">
            <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Заказ: ${order.order_number}</h3>

            <div style="margin-bottom: 20px;">
                <div style="margin-bottom: 10px;">
                    <strong>Статус:</strong> ${order.status_display}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Дата создания:</strong> ${order.created_date}
                </div>
            </div>

            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 12px 0; color: #34495e;">Информация о клиенте:</h4>
                <div style="margin-bottom: 4px;">
                    <strong>Имя:</strong> ${order.customer_name}
                </div>
                <div>
                    <strong>Телефон:</strong> ${order.phone_number}
                </div>
            </div>

            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 12px 0; color: #34495e;">Товар:</h4>
                <div style="margin-bottom: 4px;">
                    <strong>Модель:</strong> ${order.product.model}
                </div>
                <div style="margin-bottom: 4px;">
                    <strong>Цвет:</strong> ${order.product.color}
                </div>
                <div>
                    <strong>Размер:</strong> ${order.product.size}
                </div>
            </div>

            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 12px 0; color: #34495e;">Принты (${order.prints ? order.prints.length : 0}):</h4>
    `;

    if (order.prints && order.prints.length > 0) {
        order.prints.forEach(print => {
            html += `
                <div style="
                    margin-bottom: 12px;
                    padding: 10px;
                    background: white;
                    border-radius: 6px;
                    border-left: 4px solid #3498db;
                ">
                    <div style="margin-bottom: 5px;">
                        <strong>${print.area_name}:</strong> ${print.content}
                    </div>
                    <div style="font-size: 0.9em; color: #7f8c8d;">
                        Позиция: X=${print.position_x}px, Y=${print.position_y}px
                    </div>
                </div>
            `;
        });
    } else {
        html += '<p style="color: #95a5a6;">Принты не добавлены</p>';
    }

    html += `
            </div>

            <div style="
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            ">
    `;

    // Кнопки действий
    if (order.status === 'new') {
        html += `
                <button class="action-btn btn-confirm" onclick="confirmOrder(${order.id}); closeModal();" style="
                    padding: 10px 20px;
                    background: #27ae60;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                ">
                    ✅ Подтвердить заказ
                </button>
        `;
    }

    html += `
                <button class="action-btn btn-print" onclick="closeModal(); printOrderSticker(${order.id});" style="
                    padding: 10px 20px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                ">
                    🖨️ Печатать наклейку
                </button>
            </div>
        </div>
    `;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Закрыть модальное окно
function closeModal() {
    const modal = document.getElementById('orderModal');
    if (modal) modal.style.display = 'none';
}

// Закрыть модальное окно печати
function closePrintModal() {
    const modal = document.getElementById('printModal');
    if (modal) modal.style.display = 'none';
}

// ========================
// ПЕЧАТЬ НАКЛЕЙКИ
// ========================

async function printOrderSticker(orderId) {
    console.log('=== НАЧАЛО ПЕЧАТИ ===');

    // 1. БЛОКИРОВКА ОТКРЫТИЯ ВКЛАДОК
    const originalWindowOpen = window.open;
    window.open = function() {
        console.warn('⛔ БЛОКИРОВКА: Попытка открытия вкладки перехвачена!');
        return null;
    };

    // 2. БЛОКИРОВКА ПЕРЕХОДОВ ПО ССЫЛКАМ
    const handleClick = (e) => {
        if (e.target.tagName === 'A' && e.target.target === '_blank') {
            e.preventDefault();
            console.warn('⛔ БЛОКИРОВКА: Переход по ссылке заблокирован');
        }
    };
    document.addEventListener('click', handleClick, true);

    try {
        // 3. Загрузка данных
        const response = await fetch(`${API_URLS.orderDetail}${orderId}/`);
        if (!response.ok) throw new Error('Ошибка загрузки');

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const order = result.order;
        console.log('Данные загружены:', order.order_number);

        // 4. Сохраняем состояние страницы
        const originalContent = document.body.innerHTML;
        const originalTitle = document.title;
        const scrollPos = window.scrollY;

        // 5. Генерируем контент наклейки
        const stickerHTML = generateStickerContentOnly(order);
        const styles = getStickerPrintStyles();

        // 6. СОЗДАЕМ НОВОЕ ОКНО, НО СРАЗУ ЕГО СКРЫВАЕМ!
        const printWindow = window.open('', '_blank');

        // Если не удалось открыть окно (попап-блокировщик)
        if (!printWindow) {
            console.warn('Не удалось открыть окно печати, используем альтернативный метод');

            // Альтернатива: печатаем на текущей странице с медиа-запросами
            const printContainer = document.createElement('div');
            printContainer.id = 'print-container';
            printContainer.style.position = 'absolute';
            printContainer.style.left = '-9999px';
            printContainer.style.top = '0';
            printContainer.innerHTML = `
                <style>${styles}</style>
                ${stickerHTML}
            `;
            document.body.appendChild(printContainer);

            // Добавляем стили для печати
            const style = document.createElement('style');
            style.textContent = `
                @media print {
                    body > *:not(#print-container) { display: none !important; }
                    #print-container {
                        display: block !important;
                        position: static !important;
                        left: auto !important;
                    }
                }
            `;
            document.head.appendChild(style);

            document.title = `Заказ ${order.order_number}`;

            // ПЕЧАТАЕМ
            setTimeout(() => {
                window.print();
            }, 100);

            // Восстанавливаем
            setTimeout(() => {
                document.body.innerHTML = originalContent;
                document.title = originalTitle;
                window.scrollTo(0, scrollPos);
                style.remove();

                // Снимаем блокировки
                window.open = originalWindowOpen;
                document.removeEventListener('click', handleClick, true);
            }, 1000);

            return;
        }

        // 7. ОСНОВНОЙ МЕТОД - пишем контент в новое окно
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Печать заказа ${order.order_number}</title>
                    <style>${styles}</style>
                    <style>
                        @page { size: 75mm 120mm; margin: 2mm; }
                        body {
                            margin: 0;
                            padding: 0;
                            background: white;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                        }
                        .sticker-wrapper {
                            width: 75mm;
                            margin: 0 auto;
                        }
                    </style>
                </head>
                <body>
                    ${stickerHTML}
                    <script>
                        // Сразу после загрузки вызываем печать
                        window.onload = function() {
                            // Фокусируемся на окне
                            window.focus();

                            // Даем время на отрисовку
                            setTimeout(function() {
                                // Вызываем печать
                                window.print();

                                // После печати закрываем окно
                                setTimeout(function() {
                                    window.close();
                                }, 500);
                            }, 200);
                        };
                    <\/script>
                </body>
            </html>
        `);

        printWindow.document.close();

        console.log('=== ОТПРАВЛЕНО В ОЧЕРЕДЬ ПЕЧАТИ ===');

        // 8. Снимаем блокировки (окно само закроется)
        setTimeout(() => {
            window.open = originalWindowOpen;
            document.removeEventListener('click', handleClick, true);
        }, 5000);

    } catch (error) {
        console.error('=== ОШИБКА ПЕЧАТИ ===', error);
        alert('Ошибка: ' + error.message);

        // Снимаем блокировки при ошибке
        window.open = originalWindowOpen;
        document.removeEventListener('click', handleClick, true);
    }
}

function generateStickerContentOnly(order) {
    const prints = order.prints || [];
    const printsCount = prints.length;
    const isCompact = printsCount > 4;

    let printsHTML = printsCount > 0
        ? `<div class="prints-list ${isCompact ? 'compact' : ''}">
            ${prints.map(p => `
                <div class="print-row">
                    <div class="print-zone">${p.area_name || '—'}</div>
                    <div class="print-content">${p.content || '—'}</div>
                    <div class="print-position">${Math.round(p.position_x||0)}:${Math.round(p.position_y||0)}</div>
                </div>
            `).join('')}
          </div>`
        : '<div class="info-row no-prints">Принты не добавлены</div>';

    return `
    <div class="sticker-wrapper">
        <div class="sticker">
            <div class="header">
                <div class="order-number">${order.order_number}</div>
                <div class="status">${order.status === 'confirmed' ? 'ПОДТВЕРЖДЕН' : order.status.toUpperCase()}</div>
            </div>
            <div class="section">
                <div class="section-title">Товар</div>
                <div class="info-row"><div class="info-label">Модель:</div><div class="info-value">${order.product.model}</div></div>
                <div class="info-row"><div class="info-label">Цвет:</div><div class="info-value">${order.product.color}</div></div>
                <div class="info-row"><div class="info-label">Размер:</div><div class="info-value">${order.product.size}</div></div>
            </div>
            <div class="section">
                <div class="section-title">Принты (${printsCount})</div>
                ${printsHTML}
            </div>
            <div class="section">
                <div class="section-title">Клиент</div>
                <div class="info-row"><div class="info-label">Имя:</div><div class="info-value">${order.customer_name}</div></div>
                <div class="info-row"><div class="info-label">Телефон:</div><div class="info-value">${order.phone_number}</div></div>
                <div class="info-row"><div class="info-label">Дата:</div><div class="info-value">${order.created_date}</div></div>
            </div>
            <div class="footer">
                <div class="timestamp">${new Date().toLocaleString('ru-RU')}</div>
                <div>ID: ${order.id}</div>
            </div>
        </div>
    </div>`;
}

function getStickerPrintStyles() {
    return `
        @media print {
            @page { size: 75mm 120mm; margin: 2mm; }
            body {
                font-family: 'Courier New', monospace;
                font-size: 8.5pt;
                margin: 0;
                padding: 0;
                line-height: 0.95;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background: #fff;
            }
            * { box-sizing: border-box; }
            .sticker-wrapper {
                width: 75mm;
                height: 120mm;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            /* Скрываем всё лишнее при печати */
            .sticker-wrapper > * { width: 100%; }
        }

        .sticker-wrapper {
            display: flex;
            justify-content: center;
            padding: 20px;
            background: #f5f5f5;
        }
        .sticker {
            width: 71mm;
            min-height: 116mm;
            border: 1px solid #000;
            padding: 2mm;
            background: #fff;
            font-family: 'Courier New', monospace;
            font-size: 8.5pt;
            line-height: 0.95;
        }
        .header {
            text-align: center;
            border-bottom: 1px solid #000;
            padding-bottom: 1.5mm;
            margin-bottom: 2mm;
        }
        .order-number {
            font-size: 13pt;
            font-weight: bold;
            margin: 0 0 0.5mm 0;
            letter-spacing: 1px;
            line-height: 1;
            color: #000;
            /* НЕТ обводок, фонов, овалов */
        }
        .status {
            font-size: 8pt;
            margin: 0;
            font-weight: bold;
            line-height: 1;
        }
        .section { margin-bottom: 2mm; }
        .section-title {
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding-bottom: 0.5mm;
            margin-bottom: 1mm;
            text-transform: uppercase;
            font-size: 7.5pt;
            letter-spacing: 0.3px;
            line-height: 1;
        }
        .info-row {
            display: flex;
            margin-bottom: 0.5mm;
            line-height: 1;
        }
        .info-row.no-prints {
            font-style: italic;
            color: #666;
            margin: 1mm 0;
        }
        .info-label {
            font-weight: bold;
            width: 18mm;
            min-width: 18mm;
            flex-shrink: 0;
        }
        .info-value {
            flex: 1;
            word-break: break-word;
            line-height: 1;
        }

        /* Список принтов */
        .prints-list {
            display: flex;
            flex-direction: column;
            gap: 0.5mm;
            font-size: 7.5pt;
            margin-top: 0.5mm;
            line-height: 1;
        }
        .prints-list.compact {
            font-size: 7pt;
            gap: 0.3mm;
        }
        .print-row {
            display: grid;
            grid-template-columns: 15mm auto 13mm;
            gap: 0.5mm;
            align-items: start;
        }
        .prints-list.compact .print-row {
            grid-template-columns: 13mm auto 11mm;
        }
        .print-zone {
            font-weight: bold;
            color: #000;
            /* НЕТ рамок, фонов, обводок */
        }
        .print-content {
            word-break: break-word;
            line-height: 1;
        }
        .print-position {
            text-align: right;
            font-size: 7pt;
            color: #666;
        }
        .footer {
            border-top: 1px solid #000;
            padding-top: 1mm;
            margin-top: 2mm;
            font-size: 6.5pt;
            text-align: center;
            color: #666;
            line-height: 1.1;
        }
    `;
}


// ========================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ========================

// Получение CSRF токена (как в terminal.js)
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

// ========================
// ИНИЦИАЛИЗАЦИЯ
// ========================

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Интерфейс ресепшена загружен');

    // Загружаем заказы
    loadOrders();

    // Назначаем обработчики поиска
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');

    if (searchInput) {
        // Поиск с задержкой (debounce)
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadOrders();
            }, 500);
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', loadOrders);
    }

    // Закрытие модальных окон по клику на фон
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'orderModal') closeModal();
                if (this.id === 'printModal') closePrintModal();
            }
        });
    });

    // Закрытие по Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closePrintModal();
        }
    });
    startStatusCheck();
});

// Автообновление
setInterval(loadOrders, 60000);


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