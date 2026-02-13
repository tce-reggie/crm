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
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">Ошибка: ${data.error}</td></tr>`;
            return;
        }

        if (data.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Изделия не найдены</td></tr>';
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
                    <td>${p.model}</td>
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
        console.error('Ошибка загрузки изделий:', error);
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

async function addProduct(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/admin/products/add/', {
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
            closeModal('addProductModal');
            form.reset();
            loadProducts();
        } else {
            alert('Ошибка: ' + result.error);
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
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
});

// Очищаем интервал при выгрузке
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});