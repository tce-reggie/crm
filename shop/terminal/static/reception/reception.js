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

// Печать наклейки заказа
async function printOrderSticker(orderId) {
    console.log('Печать наклейки для заказа:', orderId);

    try {
        // Загружаем детали заказа с принтами
        const response = await fetch(`${API_URLS.orderDetail}${orderId}/`);
        if (!response.ok) throw new Error('Ошибка загрузки деталей заказа');

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const order = result.order;

        // Создаем новое окно для печати
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Разрешите всплывающие окна для печати');
            return;
        }

        // Генерируем HTML для наклейки с данными о принтах
        const html = generateStickerHTML(order);

        printWindow.document.write(html);
        printWindow.document.close();

        // Даем время на загрузку и печатаем
        setTimeout(() => {
            printWindow.print();
            // Можно закрыть окно после печати
            // setTimeout(() => printWindow.close(), 500);
        }, 500);

    } catch (error) {
        console.error('Ошибка печати наклейки:', error);
        alert('Ошибка загрузки данных для печати: ' + error.message);
    }
}

// Генерация HTML для наклейки
function generateStickerHTML(order) {
    console.log('Генерация наклейки для заказа:', order);
    console.log('Принты заказа:', order.prints);

    // Определяем размеры в зависимости от количества принтов
    const prints = order.prints || [];
    const printsCount = prints.length;

    let pageHeight = '100mm'; // базовая высота

    if (printsCount === 0) pageHeight = '80mm';
    else if (printsCount <= 2) pageHeight = '90mm';
    else if (printsCount <= 4) pageHeight = '100mm';
    else if (printsCount <= 6) pageHeight = '120mm';
    else pageHeight = '140mm';

    // Создаем HTML для принтов (как в showOrderModal)
    let printsHTML = '';
    if (printsCount > 0) {
        // Создаем заголовки таблицы
        printsHTML += `
                <div class="prints-grid">
                    <div class="print-header">Зона</div>
                    <div class="print-header">Содержимое</div>
                    <div class="print-header">Позиция</div>
        `;

        // Добавляем каждый принт через forEach (как в showOrderModal)
        prints.forEach(print => {
            printsHTML += `
                    <div class="print-area">${print.area_name || 'Неизвестно'}</div>
                    <div class="print-content">${print.content || 'Нет содержимого'}</div>
                    <div class="print-position">${Math.round(print.position_x || 0)}:${Math.round(print.position_y || 0)}</div>
            `;
        });

        printsHTML += `
                </div>
        `;
    } else {
        printsHTML = '<div class="info-row">Принты не добавлены</div>';
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Заказ ${order.order_number}</title>
        <meta charset="UTF-8">
        <style>
            @media print {
                @page {
                    size: 80mm ${pageHeight};
                    margin: 2mm;
                    padding: 0;
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 9pt;
                    margin: 0;
                    padding: 0;
                    line-height: 1.1;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                * {
                    box-sizing: border-box;
                }
            }

            .sticker {
                width: 76mm;
                min-height: calc(${pageHeight} - 4mm);
                border: 1px solid #000;
                padding: 3mm;
            }

            .header {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 2mm;
                margin-bottom: 3mm;
            }

            .order-number {
                font-size: 12pt;
                font-weight: bold;
                margin: 0 0 1mm 0;
                letter-spacing: 1px;
            }

            .status {
                font-size: 9pt;
                margin: 0;
                font-weight: bold;
            }

            .section {
                margin-bottom: 3mm;
            }

            .section-title {
                font-weight: bold;
                border-bottom: 1px solid #000;
                padding-bottom: 1mm;
                margin-bottom: 1mm;
                text-transform: uppercase;
                font-size: 8pt;
                letter-spacing: 0.5px;
            }

            .info-row {
                display: flex;
                margin-bottom: 1mm;
            }

            .info-label {
                font-weight: bold;
                width: 20mm;
                min-width: 20mm;
            }

            .info-value {
                flex: 1;
                word-break: break-word;
            }

            .prints-grid {
                display: grid;
                grid-template-columns: 15mm auto 15mm;
                gap: 1mm;
                font-size: 8pt;
                margin-top: 1mm;
            }

            .print-header {
                font-weight: bold;
                border-bottom: 1px solid #ccc;
                padding-bottom: 0.5mm;
                margin-bottom: 0.5mm;
            }

            .print-area {
                font-weight: bold;
            }

            .print-content {
                word-break: break-word;
                max-height: 15mm;
                overflow: hidden;
            }

            .print-position {
                text-align: right;
                font-size: 7pt;
                color: #666;
            }

            .footer {
                border-top: 1px solid #000;
                padding-top: 1mm;
                margin-top: 3mm;
                font-size: 7pt;
                text-align: center;
                color: #666;
            }

            .timestamp {
                margin-bottom: 0.5mm;
            }

            /* Для большого количества принтов - более компактный вид */
            .compact-prints .prints-grid {
                grid-template-columns: 12mm auto 12mm;
                font-size: 7pt;
                gap: 0.5mm;
            }

            /* Вертикальная черта для разделения принтов */
            .print-separator {
                border-top: 1px dashed #ccc;
                margin: 0.5mm 0;
            }

            @media print {
                .print-separator {
                    border-top: 1px dashed #000;
                }
            }
        </style>
    </head>
    <body>
        <div class="sticker ${printsCount > 4 ? 'compact-prints' : ''}">
            <div class="header">
                <div class="order-number">${order.order_number}</div>
                <div class="status">${order.status === 'confirmed' ? 'ПОДТВЕРЖДЕН' : order.status.toUpperCase()}</div>
            </div>

            <div class="section">
                <div class="section-title">Товар</div>
                <div class="info-row">
                    <div class="info-label">Модель:</div>
                    <div class="info-value">${order.product.model}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Цвет:</div>
                    <div class="info-value">${order.product.color}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Размер:</div>
                    <div class="info-value">${order.product.size}</div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Принты (${printsCount})</div>
                ${printsHTML}
            </div>

            <div class="section">
                <div class="section-title">Клиент</div>
                <div class="info-row">
                    <div class="info-label">Имя:</div>
                    <div class="info-value">${order.customer_name}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Телефон:</div>
                    <div class="info-value">${order.phone_number}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Дата заказа:</div>
                    <div class="info-value">${order.created_date}</div>
                </div>
            </div>

            <div class="footer">
                <div class="timestamp">Распечатано: ${new Date().toLocaleString('ru-RU')}</div>
                <div>ID: ${order.id}</div>
            </div>
        </div>

        <script>
            window.onload = function() {
                // Небольшая задержка для полной загрузки шрифтов
                setTimeout(() => {
                    window.print();
                    // Закрыть окно через 1 секунду
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                }, 50);
            };
        </script>
    </body>
    </html>
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
});

// Автообновление
setInterval(loadOrders, 60000);