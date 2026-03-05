// ========================
// ADMIN INTERFACE JS
// ========================

// Глобальные переменные
let currentTab = 'session';
let refreshInterval;

// ========================
// УПРАВЛЕНИЕ ВКЛАДКАМИ
// ========================

function showTab(tabName) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Показываем выбранную вкладку
    document.getElementById(tabName).classList.add('active');

    // Активируем кнопку
    event.target.classList.add('active');

    currentTab = tabName;

    // Загружаем данные для вкладки
    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch(tabName) {
        case 'session':
            loadSessionData();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'products':
            loadProducts();
            break;
        case 'prints':
            loadPrints();
            break;
        case 'users':
            loadUsers();
            break;
        case 'statistics':
            loadStatistics();
            break;
        case 'events':
            // По умолчанию загружаем первую подвкладку
            loadEvents();
            // Загружаем данные для фильтров
            loadEventsForSelect('eventProductFilter');
            loadEventsForSelect('eventPrintFilter');
            break;
    }
}

// ========================
// ЗАГРУЗКА ДАННЫХ
// ========================

// Загрузка данных сессии
async function loadSessionData() {
    try {
        const stats = await loadStatistics(true);

        // Активные сотрудники
        const usersResponse = await fetch('/api/admin/users/');
        const usersData = await usersResponse.json();

        if (usersData.success) {
            const activeUsers = usersData.users.filter(u => u.is_active).length;
            document.getElementById('activeUsersCount').textContent = activeUsers;
        }

        // Заказы в работе
        if (stats && stats.queues) {
            const inWork = stats.queues.reception + stats.queues.composing + stats.queues.printing;
            document.getElementById('ordersInWork').textContent = inWork;
        }

        // Время начала сессии (можно хранить в localStorage)
        let startTime = localStorage.getItem('sessionStartTime');
        if (!startTime) {
            startTime = new Date().toLocaleTimeString();
            localStorage.setItem('sessionStartTime', startTime);
        }
        document.getElementById('sessionStartTime').textContent = startTime;

    } catch (error) {
        console.error('Ошибка загрузки данных сессии:', error);
    }
}

// Загрузка заказов
async function loadOrders() {
    const search = document.getElementById('orderSearch').value;
    const status = document.getElementById('orderStatusFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    let url = '/api/admin/orders/?';
    const params = [];

    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (status && status !== 'all') params.push(`status=${status}`);
    if (dateFrom) params.push(`date_from=${dateFrom}`);
    if (dateTo) params.push(`date_to=${dateTo}`);

    url += params.join('&');

    try {
        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('ordersList');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">Заказы не найдены</td></tr>';
            return;
        }

        let html = '';
        data.orders.forEach(order => {
            const statusClass = `status-badge status-${order.status}`;

            html += `
                <tr>
                    <td><strong>${order.order_number}</strong></td>
                    <td>${order.customer_name}</td>
                    <td>${order.phone_number}</td>
                    <td>${order.product.model}<br><small>${order.product.color}, ${order.product.size}</small></td>
                    <td>${order.prints_count}</td>
                    <td><span class="${statusClass}">${order.status_display}</span></td>
                    <td>${order.created_date}</td>
                    <td>${order.current_worker || '—'}<br><small>${order.current_stage || ''}</small></td>
                    <td>
                        <button class="action-btn btn-edit" onclick="viewOrder(${order.id})">👁️</button>
                        <button class="action-btn btn-warning" onclick="changeOrderStatus(${order.id})">📝</button>
                        <button class="action-btn btn-delete" onclick="deleteOrder(${order.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        document.getElementById('ordersList').innerHTML =
            `<tr><td colspan="9" style="text-align: center; padding: 40px;">Ошибка загрузки: ${error.message}</td></tr>`;
    }
}

// Загрузка изделий
async function loadProducts() {
    const search = document.getElementById('productSearch').value;

    try {
        const response = await fetch('/api/admin/products/');
        const data = await response.json();

        const tbody = document.getElementById('productsList');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">Товары не найдены</td></tr>';
            return;
        }

        // Фильтрация по поиску
        let filtered = data.products;
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(p =>
                p.model.toLowerCase().includes(s) ||
                p.color.toLowerCase().includes(s) ||
                p.size.toLowerCase().includes(s)
            );
        }

        let html = '';
        filtered.forEach(p => {
            html += `
                <tr>
                    <td>${p.id}</td>
                    <td><strong>${p.model}</strong></td>
                    <td>
                        ${p.image
                            ? `<img src="${p.image}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 4px;">`
                            : '<span style="color: #aaa;">Нет</span>'}
                    </td>
                    <td>${p.color}</td>
                    <td>${p.size}</td>
                    <td><strong>${p.quantity}</strong></td>
                    <td>${p.orders_count}</td>
                    <td>${p.areas_count}</td>
                    <td>
                        <button class="action-btn btn-edit" onclick="editQuantity('product', ${p.id}, ${p.quantity})">📦</button>
                        <button class="action-btn btn-delete" onclick="deleteProduct(${p.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

// Загрузка принтов
async function loadPrints() {
    const search = document.getElementById('printSearch').value;

    try {
        const response = await fetch('/api/admin/prints/');
        const data = await response.json();

        const tbody = document.getElementById('printsList');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.prints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">Принты не найдены</td></tr>';
            return;
        }

        // Фильтрация
        let filtered = data.prints;
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(s));
        }

        let html = '';
        filtered.forEach(p => {
            html += `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.name}</td>
                    <td>${p.file ? '<a href="' + p.file + '" target="_blank">📷 Файл</a>' : '—'}</td>
                    <td>${p.usage_count}</td>
                    <td>
                        <button class="action-btn btn-delete" onclick="deletePrint(${p.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки принтов:', error);
    }
}

// Загрузка сотрудников
async function loadUsers() {
    const search = document.getElementById('userSearch').value;
    const role = document.getElementById('roleFilter').value;

    try {
        const response = await fetch('/api/admin/users/');
        const data = await response.json();

        const tbody = document.getElementById('usersList');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Сотрудники не найдены</td></tr>';
            return;
        }

        // Фильтрация
        let filtered = data.users;
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(u =>
                u.employee_name.toLowerCase().includes(s) ||
                u.login.toLowerCase().includes(s)
            );
        }
        if (role && role !== 'all') {
            filtered = filtered.filter(u => u.interface === role);
        }

        let html = '';
        filtered.forEach(u => {
            const statusClass = u.is_active ? 'badge-active' : 'badge-inactive';
            const statusText = u.is_active ? 'Активен' : 'Неактивен';

            html += `
                <tr>
                    <td><strong>${u.employee_name}</strong></td>
                    <td>${u.login}</td>
                    <td>${u.interface_display}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${u.current_order_number || '—'}</td>
                    <td>${u.today_completed}</td>
                    <td>${u.today_avg_time} мин</td>
                    <td>
                        <button class="action-btn btn-warning" onclick="toggleUserActive(${u.id}, ${u.is_active})">
                            ${u.is_active ? '🔴 Деакт.' : '🟢 Акт.'}
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteUser(${u.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);
    }
}

// Загрузка статистики
async function loadStatistics(silent = false) {
    try {
        const response = await fetch('/api/admin/statistics/');
        const data = await response.json();

        if (!data.success) {
            console.error('Ошибка статистики:', data.error);
            return null;
        }

        // Общая статистика
        document.getElementById('statTotalOrders').textContent = data.general.total_orders;
        document.getElementById('statTodayOrders').textContent = data.general.today_orders;
        document.getElementById('statCompleted').textContent = data.general.completed;
        document.getElementById('statTotalPrints').textContent = data.general.total_prints;

        // Очереди
        document.getElementById('queueReception').textContent = data.queues.reception;
        document.getElementById('queueComposing').textContent = data.queues.composing;
        document.getElementById('queuePrinting').textContent = data.queues.printing;
        document.getElementById('queueDelivery').textContent = data.queues.delivery;

        // Производительность
        const perfList = document.getElementById('performanceList');
        if (data.performance.length === 0) {
            perfList.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет данных</td></tr>';
        } else {
            let perfHtml = '';
            data.performance.slice(0, 20).forEach(p => {
                perfHtml += `
                    <tr>
                        <td><strong>${p.worker}</strong></td>
                        <td>${p.role}</td>
                        <td>${p.completed}</td>
                        <td>${p.avg_time}</td>
                        <td>${p.items_per_hour}</td>
                    </tr>
                `;
            });
            perfList.innerHTML = perfHtml;
        }

        document.getElementById('statTimestamp').textContent = `Обновлено: ${data.timestamp}`;

        return data;

    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        return null;
    }
}

// ========================
// ДЕЙСТВИЯ С ЗАКАЗАМИ
// ========================

async function viewOrder(orderId) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/`);
        const data = await response.json();

        if (!data.success) {
            alert('Ошибка: ' + data.error);
            return;
        }

        const order = data.order;

        let printsHtml = '';
        if (order.prints.length === 0) {
            printsHtml = '<p>Нет принтов</p>';
        } else {
            order.prints.forEach(p => {
                printsHtml += `
                    <div style="background: #0f3460; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                        <div><strong>${p.area_name}:</strong> ${p.content}</div>
                        <div style="font-size: 12px; color: #aaa;">Позиция: X=${p.position_x}, Y=${p.position_y}</div>
                    </div>
                `;
            });
        }

        let historyHtml = '';
        if (order.history.length === 0) {
            historyHtml = '<p>Нет истории</p>';
        } else {
            order.history.forEach(h => {
                historyHtml += `
                    <div style="background: #1a1a2e; padding: 10px; margin-bottom: 5px; border-radius: 5px;">
                        <div><strong>${h.stage}</strong> - ${h.worker}</div>
                        <div style="font-size: 12px;">${h.started} → ${h.finished || '...'} (${h.duration || '—'} мин)</div>
                        ${h.notes ? `<div style="color: #f39c12;">${h.notes}</div>` : ''}
                    </div>
                `;
            });
        }

        const content = `
            <div style="margin-bottom: 20px;">
                <p><strong>Клиент:</strong> ${order.customer_name}</p>
                <p><strong>Телефон:</strong> ${order.phone_number}</p>
                <p><strong>Товар:</strong> ${order.product.model} (${order.product.color}, ${order.product.size})</p>
                <p><strong>Статус:</strong> <span class="status-badge status-${order.status}">${order.status_display}</span></p>
                <p><strong>Промокод:</strong> ${order.promocode || '—'}</p>
                <p><strong>Скидка:</strong> ${order.discount}%</p>
            </div>

            <h3 style="margin: 20px 0 10px;">Принты</h3>
            ${printsHtml}

            <h3 style="margin: 20px 0 10px;">История</h3>
            ${historyHtml}

            <div style="margin-top: 20px;">
                <button class="action-btn btn-warning" onclick="changeOrderStatus(${order.id}); closeModal('orderModal');">
                    📝 Изменить статус
                </button>
                <button class="action-btn btn-delete" onclick="deleteOrder(${order.id}); closeModal('orderModal');">
                    🗑️ Удалить
                </button>
            </div>
        `;

        document.getElementById('modalOrderNumber').textContent = order.order_number;
        document.getElementById('orderModalContent').innerHTML = content;
        openModal('orderModal');

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function changeOrderStatus(orderId) {
    const newStatus = prompt('Введите новый статус (new/confirmed/composed/printing/printed/done/cancelled):');

    if (!newStatus) return;

    const reason = prompt('Причина изменения (необязательно):', '');

    try {
        const response = await fetch(`/api/admin/orders/${orderId}/status/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                status: newStatus,
                reason: reason
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('Статус обновлен!');
            loadOrders();
            closeModal('orderModal');
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Удалить заказ? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`/api/admin/orders/${orderId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadOrders();
            closeModal('orderModal');
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function deleteAllOrders() {
    if (!confirm('Удалить ВСЕ заказы? Это действие нельзя отменить!')) return;

    try {
        const response = await fetch('/api/admin/orders/delete-all/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadOrders();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

function showAddOrderModal() {
    openModal('addOrderModal');
}

async function createOrder(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/admin/orders/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert(`Заказ создан! Номер: ${result.order_number}`);
            closeModal('addOrderModal');
            form.reset();
            loadOrders();
        } else {
            alert('Ошибка: ' + result.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// ========================
// ДЕЙСТВИЯ С ИЗДЕЛИЯМИ
// ========================

function showAddProductModal() {
    openModal('addProductModal');
}

async function deleteProduct(productId) {
    if (!confirm('Удалить изделие? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`/api/admin/products/${productId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadProducts();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function deleteAllProducts() {
    if (!confirm('Удалить ВСЕ изделия? Это действие нельзя отменить!')) return;

    try {
        const response = await fetch('/api/admin/products/delete-all/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadProducts();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

function editQuantity(type, id, currentQuantity) {
    document.getElementById('editItemId').value = id;
    document.getElementById('editItemType').value = type;
    document.getElementById('editQuantity').value = currentQuantity;
    openModal('editQuantityModal');
}

async function updateQuantity(event) {
    event.preventDefault();

    const id = document.getElementById('editItemId').value;
    const type = document.getElementById('editItemType').value;
    const quantity = document.getElementById('editQuantity').value;

    try {
        const response = await fetch(`/api/admin/products/${id}/update-quantity/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ quantity: parseInt(quantity) })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('editQuantityModal');
            loadProducts();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// ========================
// ДЕЙСТВИЯ С ПРИНТАМИ
// ========================

function showAddPrintModal() {
    openModal('addPrintModal');
}

async function addPrint(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/api/admin/prints/add/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            closeModal('addPrintModal');
            form.reset();
            loadPrints();
        } else {
            alert('Ошибка: ' + result.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function deletePrint(printId) {
    if (!confirm('Удалить принт? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`/api/admin/prints/${printId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadPrints();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function deleteAllPrints() {
    if (!confirm('Удалить ВСЕ принты? Это действие нельзя отменить!')) return;

    try {
        const response = await fetch('/api/admin/prints/delete-all/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadPrints();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// ========================
// ДЕЙСТВИЯ С СОТРУДНИКАМИ
// ========================

function showAddUserModal() {
    openModal('addUserModal');
}

async function addUser(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Преобразуем checkbox
    data.is_active = formData.get('is_active') === 'on';

    try {
        const response = await fetch('/api/admin/users/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            closeModal('addUserModal');
            form.reset();
            loadUsers();
        } else {
            alert('Ошибка: ' + result.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Удалить сотрудника? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadUsers();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function toggleUserActive(userId, currentStatus) {
    const action = currentStatus ? 'деактивировать' : 'активировать';
    if (!confirm(`Вы уверены, что хотите ${action} сотрудника?`)) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-active/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadUsers();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// ========================
// УПРАВЛЕНИЕ СЕССИЕЙ
// ========================

async function printSessionLabel() {
    const task = document.getElementById('taskDescription').value;

    try {
        const response = await fetch('/api/admin/session/print-label/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ task: task })
        });

        const data = await response.json();

        if (data.success) {
            // Открываем окно для печати
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Разрешите всплывающие окна для печати');
                return;
            }

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Служебная наклейка</title>
                    <style>
                        body { font-family: Arial; padding: 20px; }
                        .label {
                            border: 2px solid #000;
                            padding: 20px;
                            width: 300px;
                            margin: 0 auto;
                        }
                        h2 { text-align: center; }
                        .session { font-size: 24px; font-weight: bold; text-align: center; }
                        .task { margin: 20px 0; }
                        .footer { font-size: 12px; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="label">
                        <h2>СЛУЖЕБНАЯ НАКЛЕЙКА</h2>
                        <div class="session">${data.session_number}</div>
                        <div class="task">${data.task || '—'}</div>
                        <div class="footer">${data.print_data.timestamp}</div>
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(html);
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 500);

        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function stopSession() {
    if (!confirm('Остановить сессию? Все сотрудники будут переведены в режим паузы.')) return;

    try {
        const response = await fetch('/api/admin/session/stop/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadSessionData();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function resumeSession() {
    if (!confirm('Продолжить сессию? Все сотрудники будут активированы.')) return;

    try {
        const response = await fetch('/api/admin/session/resume/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadSessionData();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function restartSession() {
    const keepPrints = document.getElementById('keepPrintsOnRestart').checked;

    if (!confirm(`Перезапустить сессию? Все заказы будут удалены. Нанесения ${keepPrints ? 'будут сохранены' : 'тоже будут удалены'}.`)) return;

    try {
        const response = await fetch('/api/admin/session/restart/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ keep_prints: keepPrints })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            // Сбрасываем время сессии
            localStorage.removeItem('sessionStartTime');
            loadSessionData();
            // Перезагружаем другие вкладки
            loadOrders();
            loadProducts();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// ========================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ========================

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

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ========================
// АВТООБНОВЛЕНИЕ
// ========================

function startAutoRefresh() {
    // Обновляем статистику каждые 30 секунд
    refreshInterval = setInterval(() => {
        if (currentTab === 'statistics' || currentTab === 'session') {
            loadStatistics();
        }
        if (currentTab === 'orders') {
            loadOrders();
        }
    }, 30000);
}

// ========================
// ИНИЦИАЛИЗАЦИЯ
// ========================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Админ панель загружена');

    // Загружаем данные для текущей вкладки
    loadTabData('session');

    // Запускаем автообновление
    startAutoRefresh();

    // Обработчики для поиска с debounce
    const searchInputs = ['orderSearch', 'productSearch', 'printSearch', 'userSearch'];
    searchInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            let timeout;
            el.addEventListener('input', function() {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    if (id === 'orderSearch') loadOrders();
                    if (id === 'productSearch') loadProducts();
                    if (id === 'printSearch') loadPrints();
                    if (id === 'userSearch') loadUsers();
                }, 500);
            });
        }
    });

    // Обработчики для фильтров
    const filters = ['orderStatusFilter', 'roleFilter'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                if (id === 'orderStatusFilter') loadOrders();
                if (id === 'roleFilter') loadUsers();
            });
        }
    });

    // Закрытие модальных окон по клику на фон
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });

    // Закрытие по Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });

   const eventSearch = document.getElementById('eventSearch');
    if (eventSearch) {
        let timeout;
        eventSearch.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (document.getElementById('eventsList').style.display !== 'none') {
                    loadEvents();
                }
            }, 500);
        });
    }

    const eventProductSearch = document.getElementById('eventProductSearch');
    if (eventProductSearch) {
        let timeout;
        eventProductSearch.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (document.getElementById('eventsProducts').style.display !== 'none') {
                    loadEventsProducts();
                }
            }, 500);
        });
    }

    const eventPrintSearch = document.getElementById('eventPrintSearch');
    if (eventPrintSearch) {
        let timeout;
        eventPrintSearch.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (document.getElementById('eventsPrints').style.display !== 'none') {
                    loadEventsPrints();
                }
            }, 500);
        });
    }
});

// Очищаем интервал при выгрузке
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});


// ========================
// УПРАВЛЕНИЕ МЕРОПРИЯТИЯМИ (EVENTS)
// ========================

// Переключение между подвкладками мероприятий
function showEventTab(tabName) {
    // Скрываем все панели
    document.querySelectorAll('.event-pane').forEach(pane => {
        pane.style.display = 'none';
    });

    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.event-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Показываем выбранную панель
    document.getElementById(tabName).style.display = 'block';

    // Активируем кнопку
    event.target.classList.add('active');

    // Загружаем данные
    if (tabName === 'eventsList') loadEvents();
    if (tabName === 'eventsProducts') loadEventsProducts();
    if (tabName === 'eventsPrints') loadEventsPrints();
}

// ========== МЕРОПРИЯТИЯ (EventsList) ==========

// Загрузка списка мероприятий
async function loadEvents() {
    try {
        const response = await fetch('/api/admin/events/');
        const data = await response.json();

        const tbody = document.getElementById('eventsListBody');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px;">Мероприятия не найдены</td></tr>';
            return;
        }

        // Фильтрация по поиску
        let filtered = data.events;
        const search = document.getElementById('eventSearch')?.value.toLowerCase();
        if (search) {
            filtered = filtered.filter(e => e.event_name.toLowerCase().includes(search));
        }

        let html = '';
        filtered.forEach(event => {
            const statusClass = event.is_active ? 'badge-active' : 'badge-inactive';
            const statusText = event.is_active ? 'Активно' : 'Неактивно';

            html += `
                <tr>
                    <td>${event.id}</td>
                    <td><strong>${escapeHtml(event.event_name)}</strong></td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="action-btn btn-edit" onclick="editEvent(${event.id}, '${escapeHtml(event.event_name)}', ${event.is_active})">
                            ✏️ Редактировать
                        </button>
                        ${!event.is_active ? `
                            <button class="action-btn btn-success" onclick="setActiveEvent(${event.id})">
                                ⭐ Сделать активным
                            </button>
                        ` : ''}
                        <button class="action-btn btn-delete" onclick="deleteEvent(${event.id})">
                            🗑️ Удалить
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
        document.getElementById('eventsListBody').innerHTML =
            `<tr><td colspan="4" style="text-align: center; padding: 40px;">Ошибка загрузки: ${error.message}</td></tr>`;
    }
}

// Показать модальное окно для добавления мероприятия
function showAddEventModal() {
    document.getElementById('eventModalTitle').textContent = 'Добавление мероприятия';
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = '';
    document.getElementById('eventIsActive').checked = false;
    openModal('eventModal');
}

// Редактирование мероприятия
function editEvent(id, name, isActive) {
    document.getElementById('eventModalTitle').textContent = 'Редактирование мероприятия';
    document.getElementById('eventId').value = id;
    document.getElementById('eventName').value = name;
    document.getElementById('eventIsActive').checked = isActive;
    openModal('eventModal');
}

// Сохранение мероприятия (добавление или редактирование)
async function saveEvent(event) {
    event.preventDefault();

    const id = document.getElementById('eventId').value;
    const name = document.getElementById('eventName').value.trim();
    const isActive = document.getElementById('eventIsActive').checked;

    if (!name) {
        alert('Введите название мероприятия');
        return;
    }

    const url = id ? `/api/admin/events/${id}/update/` : '/api/admin/events/add/';
    const method = 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                event_name: name,
                is_active: isActive
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('eventModal');
            loadEvents();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка сохранения мероприятия:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Установить мероприятие активным
async function setActiveEvent(eventId) {
    if (!confirm('Сделать это мероприятие активным? Текущее активное мероприятие будет деактивировано.')) return;

    try {
        const response = await fetch(`/api/admin/events/${eventId}/set-active/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadEvents();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка активации мероприятия:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Удаление мероприятия
async function deleteEvent(eventId) {
    if (!confirm('Удалить мероприятие? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`/api/admin/events/${eventId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadEvents();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка удаления мероприятия:', error);
        alert('Ошибка: ' + error.message);
    }
}

// ========== ТОВАРЫ МЕРОПРИЯТИЙ (EventsProducts) ==========

// Загрузка товаров мероприятий
async function loadEventsProducts() {
    try {
        const filter = document.getElementById('eventProductFilter')?.value || 'all';
        const search = document.getElementById('eventProductSearch')?.value || '';

        let url = '/api/admin/events-products/';
        const params = [];
        if (filter && filter !== 'all') params.push(`event_id=${filter}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (params.length) url += '?' + params.join('&');

        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('eventsProductsBody');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Товары мероприятий не найдены</td></tr>';
            return;
        }

        let html = '';
        data.items.forEach(item => {
            html += `
                <tr>
                    <td>${item.id}</td>
                    <td>${escapeHtml(item.event_name)}</td>
                    <td>${escapeHtml(item.product_name || '—')}</td>
                    <td>${escapeHtml(item.product_model || '—')}</td>
                    <td>${escapeHtml(item.product_color || '—')}</td>
                    <td>${escapeHtml(item.product_size || '—')}</td>
                    <td>
                        <button class="action-btn btn-delete" onclick="deleteEventProduct(${item.id})">
                            🗑️ Удалить
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки товаров мероприятий:', error);
        document.getElementById('eventsProductsBody').innerHTML =
            `<tr><td colspan="7" style="text-align: center; padding: 40px;">Ошибка загрузки: ${error.message}</td></tr>`;
    }
}

// Загрузка списка мероприятий для селекта
async function loadEventsForSelect(selectId) {
    try {
        const response = await fetch('/api/admin/events/');
        const data = await response.json();

        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Выберите мероприятие</option>';

        if (data.success && data.events) {
            data.events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = event.event_name;
                select.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Ошибка загрузки мероприятий для селекта:', error);
    }
}

// Загрузка списка товаров для селекта
async function loadProductsForSelect() {
    try {
        const response = await fetch('/api/admin/products/');
        const data = await response.json();

        const select = document.getElementById('productSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Выберите товар</option>';

        if (data.success && data.products) {
            data.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.model} (${product.color}, ${product.size})`;
                select.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Ошибка загрузки товаров для селекта:', error);
    }
}

// Показать модальное окно для добавления товара в мероприятие
async function showAddEventProductModal() {
    await loadEventsForSelect('eventSelect');
    await loadProductsForSelect();
    openModal('eventProductModal');
}

// Добавление товара в мероприятие
async function addEventProduct(event) {
    event.preventDefault();

    const eventId = document.getElementById('eventSelect').value;
    const productId = document.getElementById('productSelect').value;

    if (!eventId || !productId) {
        alert('Выберите мероприятие и товар');
        return;
    }

    try {
        const response = await fetch('/api/admin/events-products/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                event_id: parseInt(eventId),
                product_id: parseInt(productId)
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('eventProductModal');
            loadEventsProducts();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка добавления товара в мероприятие:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Удаление товара из мероприятия
async function deleteEventProduct(itemId) {
    if (!confirm('Удалить товар из мероприятия?')) return;

    try {
        const response = await fetch(`/api/admin/events-products/${itemId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadEventsProducts();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка удаления товара из мероприятия:', error);
        alert('Ошибка: ' + error.message);
    }
}

// ========== ПРИНТЫ МЕРОПРИЯТИЙ (EventsPrints) ==========

// Загрузка принтов мероприятий
async function loadEventsPrints() {
    try {
        const filter = document.getElementById('eventPrintFilter')?.value || 'all';
        const search = document.getElementById('eventPrintSearch')?.value || '';

        let url = '/api/admin/events-prints/';
        const params = [];
        if (filter && filter !== 'all') params.push(`event_id=${filter}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (params.length) url += '?' + params.join('&');

        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('eventsPrintsBody');

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">Принты мероприятий не найдены</td></tr>';
            return;
        }

        let html = '';
        data.items.forEach(item => {
            html += `
                <tr>
                    <td>${item.id}</td>
                    <td>${escapeHtml(item.event_name)}</td>
                    <td>${escapeHtml(item.print_name)}</td>
                    <td>${item.print_file ? `<a href="${item.print_file}" target="_blank" style="color: #00bcd4;">📷 Файл</a>` : '—'}</td>
                    <td>
                        <button class="action-btn btn-delete" onclick="deleteEventPrint(${item.id})">
                            🗑️ Удалить
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки принтов мероприятий:', error);
        document.getElementById('eventsPrintsBody').innerHTML =
            `<tr><td colspan="5" style="text-align: center; padding: 40px;">Ошибка загрузки: ${error.message}</td></tr>`;
    }
}

// Загрузка списка принтов для селекта
async function loadPrintsForSelect() {
    try {
        const response = await fetch('/api/admin/prints/');
        const data = await response.json();

        const select = document.getElementById('printSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Выберите принт</option>';

        if (data.success && data.prints) {
            data.prints.forEach(print => {
                const option = document.createElement('option');
                option.value = print.id;
                option.textContent = print.name;
                select.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Ошибка загрузки принтов для селекта:', error);
    }
}

// Показать модальное окно для добавления принта в мероприятие
async function showAddEventPrintModal() {
    await loadEventsForSelect('eventSelectForPrint');
    await loadPrintsForSelect();
    openModal('eventPrintModal');
}

// Добавление принта в мероприятие
async function addEventPrint(event) {
    event.preventDefault();

    const eventId = document.getElementById('eventSelectForPrint').value;
    const printId = document.getElementById('printSelect').value;

    if (!eventId || !printId) {
        alert('Выберите мероприятие и принт');
        return;
    }

    try {
        const response = await fetch('/api/admin/events-prints/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                event_id: parseInt(eventId),
                print_id: parseInt(printId)
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('eventPrintModal');
            loadEventsPrints();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка добавления принта в мероприятие:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Удаление принта из мероприятия
async function deleteEventPrint(itemId) {
    if (!confirm('Удалить принт из мероприятия?')) return;

    try {
        const response = await fetch(`/api/admin/events-prints/${itemId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadEventsPrints();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка удаления принта из мероприятия:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Функция экранирования HTML (если еще не определена)
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

// ========================
// УПРАВЛЕНИЕ ИЗДЕЛИЯМИ С ЗОНАМИ ПЕЧАТИ
// ========================

// Глобальные переменные для хранения данных о текущем изделии
let currentProductData = null;
let currentAreaData = null;
let productAreas = [];

// Переопределяем функцию showAddProductModal
function showAddProductModal() {
    openModal('addProductModal');
}

// Переопределяем функцию addProduct для сохранения данных и перехода к зонам
async function addProduct(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/api/admin/products/add-with-image/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            currentProductData = result.product;
            closeModal('addProductModal');

            productAreas = [];

            // Проверяем, существует ли элемент areasList перед обновлением
            const areasList = document.getElementById('areasList');
            if (areasList) {
                updateAreasList();
            }

            // Проверяем, существует ли модальное окно перед открытием
            const modal = document.getElementById('addPrintAreaModal');
            if (modal) {
                openModal('addPrintAreaModal');
            } else {
                // Если модального окна нет, просто показываем сообщение
                alert('Товар успешно добавлен! Теперь вы можете добавить области печати через вкладку "Области печати".');
                loadProducts();
            }
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Обновление списка добавленных зон
function updateAreasList() {
    const areasList = document.getElementById('areasList');

    if (productAreas.length === 0) {
        areasList.innerHTML = '<div style="text-align: center; padding: 20px; background: #0f3460; border-radius: 8px; color: #aaa;">Пока нет добавленных сторон печати</div>';
        return;
    }

    let html = '<h4 style="color: #e94560; margin-bottom: 15px;">Добавленные стороны:</h4>';

    productAreas.forEach((area, index) => {
        html += `
            <div style="background: #0f3460; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
                <div style="width: 60px; height: 60px; background: #1a1a2e; border-radius: 5px; overflow: hidden;">
                    <img src="${area.previewUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex: 1;">
                    <strong style="color: #fff;">${area.area_name}</strong>
                    <div style="color: #aaa; font-size: 12px;">
                        Размер: ${area.width}x${area.height}px |
                        Позиция: X=${area.offset_x}, Y=${area.offset_y} |
                        Макс. принтов: ${area.max_prints}
                    </div>
                </div>
                <div>
                    <button class="action-btn btn-edit" onclick="editArea(${index})">✏️</button>
                    <button class="action-btn btn-delete" onclick="deleteArea(${index})">🗑️</button>
                </div>
            </div>
        `;
    });

    areasList.innerHTML = html;
}

// Показать дизайнер области
function showAreaDesigner() {
    const areaName = document.getElementById('newAreaName').value.trim();
    const areaImage = document.getElementById('newAreaImage').files[0];

    if (!areaName) {
        alert('Введите название стороны');
        return;
    }

    if (!areaImage) {
        alert('Выберите изображение стороны');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('areaPreviewImage').src = e.target.result;
        document.getElementById('designerAreaName').value = areaName;

        document.getElementById('areaWidth').value = 200;
        document.getElementById('areaHeight').value = 200;
        document.getElementById('areaX').value = 0;
        document.getElementById('areaY').value = 0;
        document.getElementById('maxPrints').value = 1;

        currentAreaData = {
            name: areaName,
            image: areaImage,
            previewUrl: e.target.result
        };

        updateAreaOverlay();
        document.getElementById('printAreaOverlay').style.display = 'block';

        openModal('areaDesignerModal');
    };
    reader.readAsDataURL(areaImage);
}

// Обновление позиции оверлея
function updateAreaOverlay() {
    const overlay = document.getElementById('printAreaOverlay');
    const width = parseInt(document.getElementById('areaWidth').value);
    const height = parseInt(document.getElementById('areaHeight').value);

    overlay.style.width = width + 'px';
    overlay.style.height = height + 'px';
    overlay.style.left = '0px';
    overlay.style.top = '0px';
}

// Сохранение области печати
async function savePrintArea() {
    const areaName = document.getElementById('designerAreaName').value;
    const width = parseInt(document.getElementById('areaWidth').value);
    const height = parseInt(document.getElementById('areaHeight').value);
    const x = parseInt(document.getElementById('areaX').value);
    const y = parseInt(document.getElementById('areaY').value);
    const maxPrints = parseInt(document.getElementById('maxPrints').value);

    const formData = new FormData();
    formData.append('product_id', currentProductData.id);
    formData.append('area_name', areaName);
    formData.append('area_image', currentAreaData.image);
    formData.append('width', width);
    formData.append('height', height);
    formData.append('offset_x', x);
    formData.append('offset_y', y);
    formData.append('max_prints', maxPrints);

    try {
        const response = await fetch('/api/admin/products/add-print-area/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            productAreas.push({
                area_name: areaName,
                width: width,
                height: height,
                offset_x: x,
                offset_y: y,
                max_prints: maxPrints,
                previewUrl: currentAreaData.previewUrl,
                id: result.area_id
            });

            updateAreasList();
            document.getElementById('newAreaName').value = '';
            document.getElementById('newAreaImage').value = '';
            closeModal('areaDesignerModal');
            alert('Область печати успешно добавлена!');
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Редактирование области
function editArea(index) {
    const area = productAreas[index];

    document.getElementById('areaPreviewImage').src = area.previewUrl;
    document.getElementById('designerAreaName').value = area.area_name;
    document.getElementById('areaWidth').value = area.width;
    document.getElementById('areaHeight').value = area.height;
    document.getElementById('areaX').value = area.offset_x;
    document.getElementById('areaY').value = area.offset_y;
    document.getElementById('maxPrints').value = area.max_prints;

    currentAreaData = {
        name: area.area_name,
        previewUrl: area.previewUrl,
        index: index,
        isEdit: true
    };

    updateAreaOverlay();
    document.getElementById('printAreaOverlay').style.display = 'block';
    openModal('areaDesignerModal');
}

// Удаление области
function deleteArea(index) {
    if (confirm('Удалить эту сторону печати?')) {
        productAreas.splice(index, 1);
        updateAreasList();
    }
}

// Завершение создания изделия
function finishProductCreation() {
    closeModal('addPrintAreaModal');
    alert('Изделие успешно добавлено с ' + productAreas.length + ' сторонами печати');
    loadProducts();
}

// Инициализация обработчиков
document.addEventListener('DOMContentLoaded', function() {
    const widthInput = document.getElementById('areaWidth');
    const heightInput = document.getElementById('areaHeight');

    if (widthInput) {
        widthInput.addEventListener('input', updateAreaOverlay);
    }
    if (heightInput) {
        heightInput.addEventListener('input', updateAreaOverlay);
    }
});

// ========================
// УПРАВЛЕНИЕ ПОДВКЛАДКАМИ ИЗДЕЛИЙ
// ========================

// Переключение между подвкладками изделий
function showProductTab(tabName) {
    console.log('showProductTab called with:', tabName);

    // Скрываем все панели
    document.querySelectorAll('.product-pane').forEach(pane => {
        pane.style.display = 'none';
    });

    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.product-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Показываем выбранную панель
    const selectedPane = document.getElementById(tabName);
    if (selectedPane) {
        selectedPane.style.display = 'block';
    }

    // Активируем кнопку (ищем кнопку с соответствующим onclick)
    document.querySelectorAll('.product-tab').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    // Загружаем данные
    if (tabName === 'productItems') {
        loadProducts();
    } else if (tabName === 'productAreas') {
        loadProductsForAreaSelect();
    }
}

// Загрузка товаров для селекта в области печати
async function loadProductsForAreaSelect() {
    try {
        const response = await fetch('/api/admin/products/');
        const data = await response.json();

        const select = document.getElementById('productSelectForAreas');
        const addBtn = document.getElementById('addAreaBtn');

        if (!select) return;

        select.innerHTML = '<option value="">Выберите товар</option>';

        if (data.success && data.products) {
            // Группируем товары по моделям для удобства
            const grouped = {};
            data.products.forEach(product => {
                const key = product.model;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(product);
            });

            // Сортируем модели
            Object.keys(grouped).sort().forEach(model => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = model;

                grouped[model].forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = `${product.color} - ${product.size} (в наличии: ${product.quantity})`;
                    if (product.image) option.dataset.image = product.image;
                    optgroup.appendChild(option);
                });

                select.appendChild(optgroup);
            });

            if (addBtn) addBtn.disabled = true;
        }

        // Сбрасываем список областей
        const container = document.getElementById('areasListContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; background: #0f3460; border-radius: 8px; color: #aaa;">Выберите товар для просмотра областей печати</div>';
        }

    } catch (error) {
        console.error('Ошибка загрузки товаров для селекта:', error);
    }
}

// Загрузка областей печати для выбранного товара
async function loadProductAreas() {
    const productId = document.getElementById('productSelectForAreas').value;
    const addBtn = document.getElementById('addAreaBtn');

    if (!productId) {
        document.getElementById('areasListContainer').innerHTML =
            '<div style="text-align: center; padding: 40px; background: #0f3460; border-radius: 8px; color: #aaa;">Выберите товар для просмотра областей печати</div>';
        if (addBtn) addBtn.disabled = true;
        return;
    }

    if (addBtn) addBtn.disabled = false;

    try {
        const productResponse = await fetch('/api/admin/products/');
        const productData = await productResponse.json();
        const product = productData.products.find(p => p.id == productId);

        const areasResponse = await fetch(`/api/print-areas/?product_id=${productId}`);
        const areas = await areasResponse.json();

        const container = document.getElementById('areasListContainer');

        if (!areas || areas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #0f3460; border-radius: 8px;">
                    <p style="color: #aaa; margin-bottom: 20px;">Для товара "${product?.model || ''} ${product?.color || ''} ${product?.size || ''}" нет областей печати</p>
                    <button class="action-btn btn-success" onclick="showAddAreaModalForProduct(${productId})">
                        ➕ Добавить первую область печати
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <h3 style="color: #e94560; margin-bottom: 15px;">
                Области печати для: ${product?.model || ''} (${product?.color || ''}, ${product?.size || ''})
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
        `;

        areas.forEach(area => {
            html += `
                <div style="background: #0f3460; border-radius: 8px; overflow: hidden; border: 1px solid #1a4b8c;">
                    <div style="height: 150px; background: #1a1a2e; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${area.image_url
                            ? `<img src="${area.image_url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                            : '<div style="color: #aaa;">Нет изображения</div>'}
                    </div>
                    <div style="padding: 15px;">
                        <h4 style="color: #e94560; margin-bottom: 10px;">${escapeHtml(area.area_name)}</h4>
                        <div style="font-size: 13px; color: #aaa; margin-bottom: 5px;">
                            Размер: ${area.width} x ${area.height} px
                        </div>
                        <div style="font-size: 13px; color: #aaa; margin-bottom: 5px;">
                            Отступ: X=${area.offset_x}, Y=${area.offset_y}
                        </div>
                        <div style="font-size: 13px; color: #aaa; margin-bottom: 15px;">
                            Макс. принтов: ${area.max_prints}
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="action-btn btn-edit" onclick="editArea(${area.id})" style="flex: 1;">✏️ Редактировать</button>
                            <button class="action-btn btn-delete" onclick="deleteArea(${area.id})" style="flex: 1;">🗑️ Удалить</button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки областей печати:', error);
        document.getElementById('areasListContainer').innerHTML =
            `<div style="text-align: center; padding: 40px; background: #0f3460; border-radius: 8px; color: #e94560;">Ошибка загрузки: ${error.message}</div>`;
    }
}

// Показать модальное окно для добавления области
function showAddAreaModal() {
    const productId = document.getElementById('productSelectForAreas').value;
    if (!productId) {
        alert('Сначала выберите товар');
        return;
    }
    showAddAreaModalForProduct(productId);
}

// Показать модальное окно для добавления области конкретному товару
function showAddAreaModalForProduct(productId) {
    document.getElementById('areaModalTitle').textContent = 'Добавление области печати';
    document.getElementById('areaId').value = '';
    document.getElementById('areaProductId').value = productId;
    document.getElementById('areaName').value = '';
    document.getElementById('areaImage').value = '';
    document.getElementById('areaWidth').value = '200';
    document.getElementById('areaHeight').value = '200';
    document.getElementById('areaOffsetX').value = '0';
    document.getElementById('areaOffsetY').value = '0';
    document.getElementById('areaMaxPrints').value = '1';

    // Сбрасываем preview
    const preview = document.getElementById('areaPreview');
    const placeholder = document.getElementById('areaPreviewPlaceholder');
    const overlay = document.getElementById('areaOverlay');

    preview.style.display = 'none';
    preview.src = '';
    preview.style.width = 'auto';
    preview.style.height = 'auto';
    preview.style.maxWidth = 'none';
    preview.style.maxHeight = 'none';
    placeholder.style.display = 'block';
    overlay.style.display = 'none';

    openModal('areaModal');
}

// Предпросмотр изображения области
function previewAreaImage(input) {
    const preview = document.getElementById('areaPreview');
    const placeholder = document.getElementById('areaPreviewPlaceholder');
    const overlay = document.getElementById('areaOverlay');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            preview.style.width = 'auto';
            preview.style.height = 'auto';
            preview.style.maxWidth = 'none';
            preview.style.maxHeight = 'none';
            placeholder.style.display = 'none';

            // Обновляем оверлей после загрузки
            preview.onload = function() {
                updateAreaOverlay();
            };
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Обновление позиции overlay
function updateAreaOverlay() {
    const overlay = document.getElementById('areaOverlay');
    const preview = document.getElementById('areaPreview');

    if (preview && preview.style.display === 'block') {
        const width = parseInt(document.getElementById('areaWidth').value);
        const height = parseInt(document.getElementById('areaHeight').value);
        const offsetX = parseInt(document.getElementById('areaOffsetX').value);
        const offsetY = parseInt(document.getElementById('areaOffsetY').value);

        overlay.style.width = width + 'px';
        overlay.style.height = height + 'px';
        overlay.style.left = offsetX + 'px';
        overlay.style.top = offsetY + 'px';
        overlay.style.display = 'block';
    }
}

// Сохранение области печати
async function saveArea(event) {
    event.preventDefault();

    const areaId = document.getElementById('areaId').value;
    const productId = document.getElementById('areaProductId').value;
    const areaName = document.getElementById('areaName').value.trim();
    const width = parseInt(document.getElementById('areaWidth').value);
    const height = parseInt(document.getElementById('areaHeight').value);
    const offsetX = parseInt(document.getElementById('areaOffsetX').value);
    const offsetY = parseInt(document.getElementById('areaOffsetY').value);
    const maxPrints = parseInt(document.getElementById('areaMaxPrints').value);
    const imageFile = document.getElementById('areaImage').files[0];

    if (!areaName) {
        alert('Введите название области');
        return;
    }

    const formData = new FormData();
    formData.append('product_id', productId);
    formData.append('area_name', areaName);
    formData.append('width', width);
    formData.append('height', height);
    formData.append('offset_x', offsetX);
    formData.append('offset_y', offsetY);
    formData.append('max_prints', maxPrints);

    if (imageFile) {
        formData.append('area_image', imageFile);
    }

    const url = areaId ? `/api/admin/print-areas/${areaId}/update/` : '/api/admin/print-areas/add/';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(areaId ? 'Область обновлена' : 'Область добавлена');
            closeModal('areaModal');
            loadProductAreas();
        } else {
            alert('Ошибка: ' + result.error);
        }

    } catch (error) {
        console.error('Ошибка сохранения области:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Редактирование области
async function editArea(areaId) {
    try {
        const productId = document.getElementById('productSelectForAreas').value;
        const response = await fetch(`/api/print-areas/?product_id=${productId}`);
        const areas = await response.json();
        const area = areas.find(a => a.id == areaId);

        if (!area) {
            alert('Область не найдена');
            return;
        }

        document.getElementById('areaModalTitle').textContent = 'Редактирование области печати';
        document.getElementById('areaId').value = areaId;
        document.getElementById('areaProductId').value = productId;
        document.getElementById('areaName').value = area.area_name;
        document.getElementById('areaWidth').value = area.width;
        document.getElementById('areaHeight').value = area.height;
        document.getElementById('areaOffsetX').value = area.offset_x || 0;
        document.getElementById('areaOffsetY').value = area.offset_y || 0;
        document.getElementById('areaMaxPrints').value = area.max_prints;

        if (area.image_url) {
            const preview = document.getElementById('areaPreview');
            preview.src = area.image_url;
            preview.style.display = 'block';
            document.getElementById('areaPreviewPlaceholder').style.display = 'none';
            updateAreaOverlay();
        }

        openModal('areaModal');

    } catch (error) {
        console.error('Ошибка загрузки области:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Удаление области
async function deleteArea(areaId) {
    if (!confirm('Удалить область печати?')) return;

    try {
        const response = await fetch(`/api/admin/print-areas/${areaId}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            loadProductAreas();
        } else {
            alert('Ошибка: ' + data.error);
        }

    } catch (error) {
        console.error('Ошибка удаления области:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Функция экранирования HTML
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

// Инициализация обработчиков
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем обработчики для полей ввода
    const areaInputs = ['areaWidth', 'areaHeight', 'areaOffsetX', 'areaOffsetY'];
    areaInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateAreaOverlay);
        }
    });
});