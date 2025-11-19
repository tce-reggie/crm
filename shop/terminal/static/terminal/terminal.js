// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentStep = 1;
let selectedProduct = null;
let selectedModel = null;
let selectedSize = null;
let selectedPrint = null;
let currentPrintObject = null;
let inactivityTimer = null;

// КОНСТАНТЫ API
const API_URLS = {
    products: '/api/products/',
    models: '/api/models/',
    sizes: '/api/sizes/',
    prints: '/api/prints/',
    printAreas: '/api/print-areas/',
    createOrder: '/api/orders/create/',
    checkUser: '/api/check-user/',
    checkPromocode: '/api/check-promocode/'
};

// ЗАПУСК ПРИЛОЖЕНИЯ
function startApplication() {
    console.log('Запуск приложения...');
    document.getElementById('screensaver').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    showStep(1);
    resetInactivityTimer();
}

// ТАЙМЕР НЕАКТИВНОСТИ (10 минут)
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (currentStep !== 0) {
            document.getElementById('screensaver').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
            resetSelection();
        }
    }, 10 * 60 * 1000);
}

// ЗАГРУЗКА НАЧАЛЬНЫХ ДАННЫХ
async function loadInitialData() {
    try {
        await loadProducts();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// НАВИГАЦИЯ
function showStep(step) {
    document.querySelectorAll('.step-container').forEach(container => {
        container.style.display = 'none';
    });

    document.getElementById(`step${step}`).style.display = 'flex';
    document.getElementById('prevBtn').disabled = step === 1;
    document.getElementById('nextBtn').style.display = step === 5 ? 'none' : 'block';
    document.getElementById('confirmBtn').style.display = step === 5 ? 'block' : 'none';

    currentStep = step;
    autoSkipSteps();
}

function nextStep() {
    console.log('Следующий шаг');
    if (currentStep < 5) {
        showStep(currentStep + 1);
    }
}

function previousStep() {
    console.log('Предыдущий шаг');
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

// АВТОПРОПУСК ШАГОВ
function autoSkipSteps() {
    setTimeout(() => {
        if (currentStep === 1 && shouldSkipStep(2)) {
            nextStep();
        } else if (currentStep === 2 && shouldSkipStep(3)) {
            nextStep();
        } else if (currentStep === 3 && shouldSkipStep(4)) {
            nextStep();
        }
    }, 100);
}

// ЗАГРУЗКА ДАННЫХ ДЛЯ ШАГОВ
async function loadStepData(step) {
    switch(step) {
        case 2:
            await loadModels();
            break;
        case 3:
            await loadSizes();
            break;
        case 4:
            await loadPrints();
            await loadPrintAreas();
            updateProductInfo();
            break;
        case 5:
            updateOrderSummary();
            break;
    }
}

// API ФУНКЦИИ
async function loadProducts() {
    try {
        const response = await fetch(API_URLS.products);
        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Ошибка загрузки продуктов:', error);
        displayProducts([]);
    }
}

async function loadModels() {
    if (!selectedProduct) return;

    try {
        const response = await fetch(`${API_URLS.models}?product_id=${selectedProduct.id}`);
        const models = await response.json();
        displayModels(models);
    } catch (error) {
        console.error('Ошибка загрузки моделей:', error);
        displayModels([]);
    }
}

async function loadSizes() {
    if (!selectedProduct || !selectedModel) return;

    try {
        const response = await fetch(`${API_URLS.sizes}?product_model=${selectedProduct.id}&model_id=${selectedModel.id}`);
        const sizes = await response.json();
        displaySizes(sizes);
    } catch (error) {
        console.error('Ошибка загрузки размеров:', error);
        displaySizes([]);
    }
}

async function loadPrints() {
    try {
        const response = await fetch(API_URLS.prints);
        const prints = await response.json();
        displayPrints(prints);
    } catch (error) {
        console.error('Ошибка загрузки принтов:', error);
        displayPrints([]);
    }
}

async function loadPrintAreas() {
    if (!selectedSize) return;

    try {
        const response = await fetch(`${API_URLS.printAreas}?product_id=${selectedSize.product_id}`);
        const areas = await response.json();
        setupPrintArea(areas);
    } catch (error) {
        console.error('Ошибка загрузки зон печати:', error);
    }
}

// ОТОБРАЖЕНИЕ ДАННЫХ
function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    products.forEach(product => {
        const element = createSwipeElement(product.name, product.image, () => selectProduct(product));
        container.appendChild(element);
    });
}

function displayModels(models) {
    const container = document.getElementById('modelsContainer');
    container.innerHTML = '';

    models.forEach(model => {
        const element = createSwipeElement(model.name, model.image, () => selectModel(model));
        container.appendChild(element);
    });
}

function displaySizes(sizes) {
    const container = document.getElementById('sizesContainer');
    container.innerHTML = '';

    sizes.forEach(sizeObj => {
        const element = createSwipeElement(
            `Размер: ${sizeObj.size}`,
            null,
            () => selectSize(sizeObj)
        );
        container.appendChild(element);
    });
}

function displayPrints(prints) {
    const container = document.getElementById('printsGallery');
    container.innerHTML = '';

    prints.forEach(print => {
        const element = document.createElement('div');
        element.className = `print-option ${print.type === 'custom' ? 'custom' : ''}`;
        element.textContent = print.name;
        element.onclick = () => selectPrint(print);
        container.appendChild(element);
    });
}

function createSwipeElement(text, image, onClick) {
    const element = document.createElement('div');
    element.className = 'swipe-item';
    element.innerHTML = image ? `<img src="${image}" alt="${text}"><div>${text}</div>` : `<div>${text}</div>`;
    element.onclick = onClick;
    return element;
}

// ВЫБОР ЭЛЕМЕНТОВ
function selectProduct(product) {
    selectedProduct = product;
    updateSelection('productsContainer', product.id);
    if (shouldSkipStep(2)) setTimeout(() => nextStep(), 500);
}

function selectModel(model) {
    selectedModel = model;
    updateSelection('modelsContainer', model.id);
    if (shouldSkipStep(3)) setTimeout(() => nextStep(), 500);
}

function selectSize(sizeObj) {
    selectedSize = sizeObj;
    updateSelection('sizesContainer', sizeObj.size);
    if (shouldSkipStep(4)) setTimeout(() => nextStep(), 500);
}

function selectPrint(print) {
    selectedPrint = print;
    updateSelection('printsGallery', print.id);

    if (print.type === 'custom') {
        document.getElementById('customControls').style.display = 'block';
    } else {
        document.getElementById('customControls').style.display = 'none';
        addPrintToArea(print);
    }
}

function updateSelection(containerId, selectedId) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.swipe-item, .print-option').forEach(item => {
        item.classList.remove('selected');
    });

    const elements = container.querySelectorAll('.swipe-item, .print-option');
    elements.forEach(element => {
        if (element.textContent.includes(selectedId)) {
            element.classList.add('selected');
        }
    });
}

// РАБОТА С ПРИНТАМИ
function setupPrintArea(areas) {
    const printArea = document.getElementById('printArea');
    if (areas && areas.length > 0) {
        const area = areas[0];
        printArea.style.width = `${area.width * 10}px`; // Масштабируем для отображения
        printArea.style.height = `${area.height * 10}px`;
    }
}

function addPrintToArea(print) {
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = '';

    const printObj = document.createElement('div');
    printObj.className = 'print-object';
    printObj.textContent = print.name;
    printObj.style.width = '100px';
    printObj.style.height = '50px';
    printObj.style.left = '50px';
    printObj.style.top = '50px';

    makeDraggable(printObj);
    printArea.appendChild(printObj);
    currentPrintObject = printObj;
}

function applyCustomText() {
    const text = document.getElementById('customText').value;
    const font = document.getElementById('fontSelect').value;

    if (text && selectedPrint) {
        const printArea = document.getElementById('printArea');
        printArea.innerHTML = '';

        const textObj = document.createElement('div');
        textObj.className = 'print-object';
        textObj.textContent = text;
        textObj.style.fontFamily = font;
        textObj.style.width = '150px';
        textObj.style.height = '40px';
        textObj.style.left = '50px';
        textObj.style.top = '50px';

        makeDraggable(textObj);
        printArea.appendChild(textObj);
        currentPrintObject = textObj;
    }
}

// Drag & Drop функциональность (остается без изменений)
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.onmousedown = dragMouseDown;
    element.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function dragTouchStart(e) {
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDragTouch;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function elementDragTouch(e) {
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function shouldSkipStep(step) {
    return false; // В реальности можно добавить логику пропуска
}

function canProceedToNextStep() {
    switch(currentStep) {
        case 1: return selectedProduct !== null;
        case 2: return selectedModel !== null;
        case 3: return selectedSize !== null;
        case 4: return selectedPrint !== null && currentPrintObject !== null;
        case 5: return validateConfirmation();
        default: return false;
    }
}

function getNextStepNumber() {
    switch(currentStep) {
        case 1: return shouldSkipStep(2) ? 3 : 2;
        case 2: return shouldSkipStep(3) ? 4 : 3;
        case 3: return shouldSkipStep(4) ? 5 : 4;
        default: return currentStep + 1;
    }
}

function getPreviousStepNumber() {
    switch(currentStep) {
        case 3: return shouldSkipStep(2) ? 1 : 2;
        case 4: return shouldSkipStep(3) ? 2 : 3;
        case 5: return shouldSkipStep(4) ? 3 : 4;
        default: return currentStep - 1;
    }
}

function validateConfirmation() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (name === '') {
        alert('Пожалуйста, введите ваше ФИО');
        return false;
    }

    if (phone === '') {
        alert('Пожалуйста, введите номер телефона');
        return false;
    }

    return true;
}

function updateProductInfo() {
    const infoText = `Модель: ${selectedModel?.name || '-'} | Размер: ${selectedSize?.size || '-'}`;
    document.getElementById('productInfoText').textContent = infoText;
}

function updateOrderSummary() {
    document.getElementById('summaryProduct').textContent = selectedProduct?.name || '-';
    document.getElementById('summaryModel').textContent = selectedModel?.name || '-';
    document.getElementById('summarySize').textContent = selectedSize?.size || '-';
    document.getElementById('summaryPrint').textContent = selectedPrint?.name || '-';
    document.getElementById('summaryName').textContent = document.getElementById('customerName').value;
    document.getElementById('summaryPhone').textContent = document.getElementById('customerPhone').value;
}

function toggleNotificationInput() {
    const type = document.getElementById('notificationType').value;
    const contactInput = document.getElementById('notificationContact');
    contactInput.style.display = type === 'none' ? 'none' : 'block';
    contactInput.placeholder = type === 'email' ? 'Email адрес' :
                             type === 'sms' ? 'Номер телефона' :
                             'Контакт для уведомления';
}

// ОФОРМЛЕНИЕ ЗАКАЗА
async function submitOrder() {
    if (!validateConfirmation()) {
        return;
    }

    const orderData = {
        product_id: selectedSize?.product_id,
        customer_name: document.getElementById('customerName').value,
        phone_number: document.getElementById('customerPhone').value,
        print_id: selectedPrint?.id,
        notification_type: document.getElementById('notificationType').value,
        notification_contact: document.getElementById('notificationContact').value,
        position_x: getPrintPosition()?.x || 50,
        position_y: getPrintPosition()?.y || 50
    };

    // Проверка промокода
    const promocode = document.getElementById('promocode')?.value;
    if (promocode) {
        orderData.promocode = promocode;
    }

    try {
        const response = await fetch(API_URLS.createOrder, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showSuccessScreen(result.order_number);
        } else {
            throw new Error(result.error || 'Ошибка сервера');
        }
    } catch (error) {
        alert('Ошибка при создании заказа: ' + error.message);
    }
}

function getPrintPosition() {
    if (!currentPrintObject) return null;

    return {
        x: parseInt(currentPrintObject.style.left) || 50,
        y: parseInt(currentPrintObject.style.top) || 50
    };
}

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

function showSuccessScreen(orderNumber) {
    document.getElementById('orderNumberDisplay').textContent = orderNumber;
    document.getElementById('successScreen').style.display = 'flex';
    currentStep = 0;
}

function resetTerminal() {
    document.getElementById('successScreen').style.display = 'none';
    resetSelection();
    showStep(1);
    resetInactivityTimer();
}

function resetSelection() {
    selectedProduct = null;
    selectedModel = null;
    selectedSize = null;
    selectedPrint = null;
    currentPrintObject = null;

    // Сброс форм
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('notificationType').value = 'none';
    document.getElementById('notificationContact').value = '';
    document.getElementById('notificationContact').style.display = 'none';
    document.getElementById('customText').value = '';
    document.getElementById('customControls').style.display = 'none';

    // Сброс выделений
    document.querySelectorAll('.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // Очистка области предпросмотра
    const printArea = document.getElementById('printArea');
    if (printArea) printArea.innerHTML = '';
}

// СЛУШАТЕЛИ СОБЫТИЙ
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('touchstart', resetInactivityTimer);
document.addEventListener('scroll', resetInactivityTimer);
document.addEventListener('mousemove', resetInactivityTimer);

async function loadModels() {
    if (!selectedProduct) return;

    try {
        const response = await fetch(`/api/models/?product_id=${selectedProduct.id}`);
        const models = await response.json();

        const container = document.getElementById('modelsContainer');
        if (container) {
            let html = '';
            models.forEach(model => {
                const colorStyle = model.color ? `style="background: ${getColorHex(model.color)}; ${getTextColor(model.color)}"` : '';
                html += `
                    <div class="model-card" onclick="selectModel('${model.id}', '${model.name.replace(/'/g, "\\'")}')">
                        <div class="model-image" ${colorStyle}>${model.color || model.name}</div>
                        <div class="model-title">${model.name}</div>
                        <div class="model-description">Цена: ${model.base_price} руб.</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Ошибка загрузки моделей:', error);
        const container = document.getElementById('modelsContainer');
        if (container) {
            container.innerHTML = '<div class="error-message">Ошибка загрузки моделей</div>';
        }
    }
}

function getColorHex(colorName) {
    const colorMap = {
        'белый': '#ffffff', 'белая': '#ffffff',
        'черный': '#000000', 'черная': '#000000',
        'синий': '#1e3a8a', 'синяя': '#1e3a8a',
        'красный': '#dc2626', 'красная': '#dc2626',
        'зеленый': '#059669', 'зеленая': '#059669',
        'серый': '#6b7280', 'серая': '#6b7280'
    };
    const lowerColor = colorName.toLowerCase();
    return colorMap[lowerColor] || '#666666';
}

function getTextColor(colorName) {
    const lightColors = ['белый', 'белая', 'желтый', 'желтая'];
    return lightColors.includes(colorName.toLowerCase()) ? 'color: black;' : 'color: white;';
}

function selectSize(size, productId) {
    selectedSize = {
        size: size,
        product_id: productId
    };

    // Обновляем выделение
    document.querySelectorAll('#sizesContainer .size-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Находим и выделяем выбранную карточку
    document.querySelectorAll('#sizesContainer .size-card').forEach(card => {
        if (card.querySelector('.size-badge').textContent === size) {
            card.classList.add('selected');
        }
    });

    if (shouldSkipStep(4)) setTimeout(() => nextStep(), 500);
}

// Функция для генерации номера заказа
function generateOrderNumber() {
    const timestamp = Date.now().toString();
    return timestamp.slice(-6);
}

// Функция сохранения заказа в localStorage
function saveOrderToLocalStorage(orderData) {
    try {
        // Получаем текущие заказы
        const existingOrders = JSON.parse(localStorage.getItem('orders')) || [];

        // Добавляем новый заказ
        existingOrders.push(orderData);

        // Сохраняем обратно
        localStorage.setItem('orders', JSON.stringify(existingOrders));

        return true;
    } catch (error) {
        console.error('Ошибка сохранения заказа:', error);
        return false;
    }
}

// Функция отправки заказа в Google Sheets (опционально)
async function saveOrderToGoogleSheets(orderData) {
    const scriptURL = 'YOUR_GOOGLE_APPS_SCRIPT_URL';

    try {
        const response = await fetch(scriptURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Ошибка отправки в Google Sheets:', error);
        return false;
    }
}

// Основная функция подтверждения заказа
async function confirmOrder() {
    // Собираем данные
    const orderData = {
        orderNumber: generateOrderNumber(),
        product: document.getElementById('summaryProduct').innerText,
        model: document.getElementById('summaryModel').innerText,
        size: document.getElementById('summarySize').innerText,
        print: document.getElementById('summaryPrint').innerText,
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        timestamp: new Date().toISOString()
    };

    // Валидация
    if (!orderData.name || !orderData.phone) {
        alert('Пожалуйста, заполните ФИО и номер телефона');
        return;
    }

    // Обновляем summary
    document.getElementById('summaryName').textContent = orderData.name;
    document.getElementById('summaryPhone').textContent = orderData.phone;

    // Сохраняем в localStorage
    const saved = saveOrderToLocalStorage(orderData);

    if (saved) {
        // Показываем экран успеха
        showSuccessScreen(orderData.orderNumber);

        // Опционально: отправляем в Google Sheets
        // await saveOrderToGoogleSheets(orderData);
    } else {
        alert('Ошибка сохранения заказа');
    }
}

// Функция показа экрана успеха
function showSuccessScreen(orderNumber) {
    const successScreen = document.getElementById('successScreen');
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');

    orderNumberDisplay.textContent = orderNumber;
    successScreen.style.display = 'flex';
}

// Функция сброса терминала
function resetTerminal() {
    // Скрываем экран успеха
    document.getElementById('successScreen').style.display = 'none';

    // Сбрасываем форму
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';

    // Возвращаемся к первому шагу
    showStep(1);
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем обработчик для кнопки подтверждения
    const confirmBtn = document.getElementById('confirmOrderBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmOrder);
    }

    // Обновляем summary при вводе данных
    const nameInput = document.getElementById('customerName');
    const phoneInput = document.getElementById('customerPhone');

    if (nameInput) {
        nameInput.addEventListener('input', function() {
            document.getElementById('summaryName').textContent = this.value || '-';
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            document.getElementById('summaryPhone').textContent = this.value || '-';
        });
    }
});

function viewAllOrders() {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];

    if (orders.length === 0) {
        alert('Нет сохраненных заказов');
        return;
    }

    let ordersText = 'ВСЕ ЗАКАЗЫ:\n\n';
    orders.forEach(order => {
        ordersText += `Заказ #${order.orderNumber}\n`;
        ordersText += `ФИО: ${order.name}\n`;
        ordersText += `Телефон: ${order.phone}\n`;
        ordersText += `Изделие: ${order.product}\n`;
        ordersText += `Модель: ${order.model}\n`;
        ordersText += `Размер: ${order.size}\n`;
        ordersText += `Принт: ${order.print}\n`;
        ordersText += `Дата: ${new Date(order.timestamp).toLocaleString()}\n`;
        ordersText += '─'.repeat(30) + '\n';
    });

    alert(ordersText);
}