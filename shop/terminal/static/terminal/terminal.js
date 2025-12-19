// =======================
// НАСТРОЙКИ API
// =======================
const API_URLS = {
    products: '/api/products/',      // Шаг 1
    colors: '/api/colors/',          // Шаг 2
    sizes: '/api/sizes/',            // Шаг 3
    prints: '/api/prints/',          // Шаг 4
    printAreas: '/api/print-areas/', // Шаг 4
    createOrder: '/api/orders/create/', // Шаг 5
    checkPromocode: '/api/check-promocode/',
};

// =======================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =======================
let currentStep = 1;

let selectedData = {
    product: null,   // { model: название, first_product_id: id }
    color: null,     // { name: название, product_id: id }
    size: null,      // { id, size }
};

let inactivityTimer = null;

// Зоны печати и принты
let currentAreaId = null;
let currentAreaConfig = null;   // {width, height, maxPrints}
let areaPrints = {};            // areaId -> [{id,name,imageUrl,x,y,width,height,element}]

// =======================
// ЗАПУСК ПРИЛОЖЕНИЯ
// =======================
function startApplication() {
    console.log('startApplication вызвана');

    const screensaver = document.getElementById('screensaver');
    if (screensaver) screensaver.style.display = 'none';

    const app = document.getElementById('app');
    if (app) app.style.display = 'flex';

    // Загружаем товары через API
    loadProducts();

    resetInactivityTimer();
}

// =======================
// ТАЙМЕР НЕАКТИВНОСТИ
// =======================
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        window.location.reload();
    }, 10 * 60 * 1000);
}

document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('touchstart', resetInactivityTimer);

// =======================
// НАВИГАЦИЯ ПО ШАГАМ
// =======================
function showStep(step) {
    console.log(`showStep(${step}) вызвана`);

    // 1. Скрываем все шаги
    document.querySelectorAll('.step-container').forEach(c => {
        c.style.display = 'none';
        console.log(`Скрыт: ${c.id}`);
    });

    // 2. Показываем нужный шаг
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
        targetStep.style.display = 'flex';  // Используем flex как у шага 1
        console.log(`Показан: step${step}`);
    } else {
        console.error(`Шаг ${step} не найден!`);
        return;
    }

    // 3. Обновляем текущий шаг
    currentStep = step;
    console.log(`Текущий шаг: ${currentStep}`);

    // 4. Обновляем навигацию
    updateNavigation();

    // 5. Если это шаг 5, обновляем сводку
    if (step === 5) {
        updateOrderSummary();
    }
}

function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const confirmBtn = document.getElementById('confirmBtn');

    if (prevBtn) prevBtn.disabled = currentStep === 1;
    if (nextBtn) nextBtn.style.display = currentStep === 5 ? 'none' : 'block';
    if (confirmBtn) confirmBtn.style.display = currentStep === 5 ? 'block' : 'none';
}

function nextStep() {
    if (!validateCurrentStep()) return;
    if (currentStep < 5) {
        showStep(currentStep + 1);
    }
}

function previousStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

function validateCurrentStep() {
    switch (currentStep) {
        case 1:
            if (!selectedData.product) {
                alert('Выберите товар');
                return false;
            }
            return true;
        case 2:
            if (!selectedData.color) {
                alert('Выберите цвет');
                return false;
            }
            return true;
        case 3:
            if (!selectedData.size) {
                alert('Выберите размер');
                return false;
            }
            return true;
        case 4:
            return true;
        case 5:
            return validateConfirmationForm();
        default:
            return true;
    }
}

//новая реализация шаг 1
async function loadProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-message">Загрузка товаров...</div>';

    try {
        const response = await fetch(API_URLS.products);
        const products = await response.json();

        if (!products.length) {
            container.innerHTML = '<div class="no-products-message">Нет доступных товаров</div>';
            return;
        }

        container.innerHTML = '';
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.model = product.model;
            card.dataset.productId = product.product_id;

            let imageHtml = '';
            if (product.image_url) {
                imageHtml = `
                    <div class="product-image">
                        <img src="${product.image_url}" alt="${product.model}">
                    </div>
                `;
            } else {
                imageHtml = `
                    <div class="product-image">${product.model}</div>
                `;
            }

            card.innerHTML = `
                ${imageHtml}
                <div class="product-title">${product.model}</div>
            `;

            card.onclick = () => {
                selectProduct(product.model, product.product_id);
            };

            container.appendChild(card);
        });

    } catch (error) {
        container.innerHTML = `<div class="error-message">Ошибка: ${error.message}</div>`;
    }
}



// =======================
// ВЫБОР ПРОДУКТА / МОДЕЛИ / РАЗМЕРА
// =======================

// Шаг 1 — выбор модели товара
function selectProduct(modelName, firstProductId) {
    console.log('=== selectProduct вызвана ===');
    console.log('Модель:', modelName);
    console.log('ID первого товара:', firstProductId);

    selectedData.product = {
        model: modelName,
        first_product_id: firstProductId
    };

    // Подсвечиваем выбранный товар
    highlightSelection('productsContainer', modelName);

    // Загружаем цвета для выбранной модели
    loadColorsForModel(modelName);

    // ПЕРЕХОДИМ К ШАГУ 2
    setTimeout(() => {
        console.log('Переходим к шагу 2...');
        showStep(2);
    }, 100);
}


function highlightSelection(containerId, selectedId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.product-card, .model-card, .size-card').forEach(el => {
        el.classList.remove('selected');
    });

    container.querySelectorAll('[data-id]').forEach(el => {
        if (el.dataset.id === String(selectedId)) {
            el.classList.add('selected');
        }
    });
}

// Шаг 2 — модели
// Новая функция для загрузки цветов выбранной модели (шаг 2)
// Функция загрузки цветов для выбранной модели
async function loadColorsForModel(modelName) {
    const container = document.getElementById('modelsContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-message">Загрузка цветов...</div>';

    try {
        const response = await fetch(`/api/colors/?model=${encodeURIComponent(modelName)}`);
        const colors = await response.json();

        if (!colors.length) {
            container.innerHTML = '<div class="no-colors-message">Нет доступных цветов</div>';
            return;
        }

        container.innerHTML = '';
        colors.forEach(color => {
            const colorCard = document.createElement('div');
            colorCard.className = 'color-card';
            colorCard.dataset.color = color.name;
            colorCard.dataset.productId = color.product_id;

            // Создаем изображение
            let imageHtml = '';
            if (color.image_url) {
                imageHtml = `
                    <div class="color-image">
                        <img src="${color.image_url}" alt="${color.name}">
                    </div>
                `;
            } else {
                imageHtml = `
                    <div class="color-image-placeholder">${color.name}</div>
                `;
            }

            // ВАЖНО: Добавляем название цвета под изображением
            colorCard.innerHTML = `
                ${imageHtml}
                <div class="color-name">${color.name}</div>  <!-- Это должно быть здесь! -->
            `;

            colorCard.onclick = () => {
                selectColor(color.name, color.product_id);
            };

            container.appendChild(colorCard);
        });

    } catch (error) {
        container.innerHTML = `<div class="error-message">Ошибка: ${error.message}</div>`;
    }
}

// Обработка выбора цвета
function selectColor(colorName, productId) {
    console.log('Выбран цвет:', colorName);
    selectedData.color = {
        name: colorName,
        product_id: productId
    };
    // Подсвечиваем выбранный цвет
    highlightColorSelection(colorName);

    // Загружаем размеры и переходим к шагу 3
    setTimeout(() => {
        console.log('Переходим к шагу 3...');
        showStep(3);

        // Загружаем размеры для выбранной модели и цвета
        if (selectedData.product && selectedData.product.model) {
            loadSizesForModelAndColor(selectedData.product.model, colorName);
        } else {
            console.error('Не выбрана модель товара');
        }
    }, 200);
}

// Подсветка выбранного цвета
function highlightColorSelection(colorName) {
    const container = document.getElementById('modelsContainer');
    if (!container) return;

    container.querySelectorAll('.color-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.color === colorName) {
            card.classList.add('selected');
        }
    });
}

// Загрузка размеров для модели и цвета (шаг 3 вроде)
async function loadSizesForModelAndColor(modelName, colorName) {
    console.log(`Загружаем размеры для модели "${modelName}" и цвета "${colorName}"`);

    const container = document.getElementById('sizesContainer');
    if (!container) {
        console.error('Контейнер sizesContainer не найден');
        return;
    }

    container.innerHTML = '<div class="loading-message">Загрузка размеров...</div>';

    try {
        const url = `/api/sizes/?model=${encodeURIComponent(modelName)}&color=${encodeURIComponent(colorName)}`;
        console.log('Запрашиваем URL:', url);

        const response = await fetch(url);
        console.log('Ответ:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const sizes = await response.json();
        console.log('Получены размеры:', sizes);

        if (!sizes || sizes.length === 0) {
            container.innerHTML = '<div class="no-sizes-message">Нет доступных размеров</div>';
            return;
        }

        container.innerHTML = '';
        sizes.forEach(sizeObj => {
            const card = document.createElement('div');
            card.className = 'size-card';
            card.dataset.id = sizeObj.id;

            const isOut = sizeObj.quantity <= 0;

            // Используем изображение если есть
            let imageHtml = `<div class="size-badge">${sizeObj.size}</div>`;
            if (sizeObj.image_url) {
                imageHtml = `
                    <div class="size-image">
                        <img src="${sizeObj.image_url}" alt="Размер ${sizeObj.size}">
                    </div>
                `;
            }

            card.innerHTML = `
                ${imageHtml}
                <div class="size-title">${sizeObj.size}</div>
                <div class="size-stock" style="color:${isOut ? '#ff6b6b' : '#90ee90'};">
                    ${isOut ? 'Нет в наличии' : 'В наличии: ' + sizeObj.quantity + ' шт.'}
                </div>
            `;

            if (!isOut) {
                card.onclick = () => {
                    console.log('Выбран размер:', sizeObj.size);
                    selectSize(sizeObj.id, sizeObj.size, sizeObj.id);
                };
            } else {
                card.style.opacity = '0.5';
                card.style.cursor = 'not-allowed';
            }

            container.appendChild(card);
        });

    } catch (error) {
        console.error('Ошибка загрузки размеров:', error);
        container.innerHTML = `<div class="error-message">Ошибка загрузки размеров: ${error.message}</div>`;
    }
}
//выбор нужного размера
function selectSize(id, sizeLabel, productId) {
    console.log('Выбран размер:', sizeLabel, 'ID товара:', productId);
    selectedData.size = {
        id,
        size: sizeLabel,
        product_id: productId  // Это ID конкретного товара в каталоге!
    };
    highlightSelection('sizesContainer', id);

    // Переходим к шагу 4 и загружаем данные для него
    setTimeout(() => {
        console.log('Переходим к шагу 4...');
        showStep(4);

        // Загружаем данные для шага 4
        loadStep4Data(productId);
    }, 200);
}

// =======================
// ШАГ 4: ЗОНЫ ПЕЧАТИ И ПРИНТЫ
// =======================
//function switchArea(areaId, config) {
//    console.log('switchArea вызвана для зоны:', areaId);
//
//    currentAreaId = areaId;
//    currentAreaConfig = config;
//
//    // Активируем вкладку
//    document.querySelectorAll('.area-tab').forEach(btn => {
//        btn.classList.toggle('active', btn.dataset.areaId === areaId.toString());
//    });
//
//    // Обновляем информацию
//    const infoEl = document.getElementById('currentAreaInfo');
//    if (infoEl) {
//        const areaName = document.querySelector(`.area-tab[data-area-id="${areaId}"]`)?.textContent || 'Неизвестно';
//        infoEl.textContent = `Зона: ${areaName} | Максимум принтов: ${config.maxPrints}`;
//    }
//
//    // Показываем изображение зоны
//    const imageContainer = document.getElementById('productSideImageContainer');
//    if (imageContainer) {
//        if (config.imageUrl) {
//            imageContainer.innerHTML = `<img src="${config.imageUrl}" alt="Зона печати">`;
//        } else {
//            imageContainer.innerHTML = '<div class="no-image-message">Нет изображения зоны печати</div>';
//        }
//    }
//
//    // Настраиваем область печати
//    const printArea = document.getElementById('printArea');
//    if (printArea) {
//        console.log('Настраиваем область печати:', config.width, 'x', config.height);
//
//        if (config.width && config.height) {
//            const scale = 5; // Уменьшаем масштаб для видимости
//            printArea.style.width = (config.width * scale) + 'px';
//            printArea.style.height = (config.height * scale) + 'px';
//
//            // Очищаем
//            printArea.innerHTML = '';
//
//            if (!areaPrints[areaId] || areaPrints[areaId].length === 0) {
//                const hint = document.createElement('div');
//                hint.className = 'print-area-hint';
//                hint.innerHTML = 'Выберите принт справа<br><span style="font-size:0.8em;">Перетащите его в область</span>';
//                printArea.appendChild(hint);
//            } else {
//                renderAreaPrints();
//            }
//        }
//    }
//
//    updateCurrentPrintsList();
//}
//новая реализация switcharea
function switchArea(areaId, config) {
    console.log('=== switchArea ===');
    console.log('Area ID:', areaId);
    console.log('Полный config:', config);

    currentAreaId = areaId;
    currentAreaConfig = config;

    // Активируем вкладку
    document.querySelectorAll('.area-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.areaId === areaId.toString());
    });

    // Обновляем информацию
    const infoEl = document.getElementById('currentAreaInfo');
    if (infoEl) {
        const areaName = document.querySelector(`.area-tab[data-area-id="${areaId}"]`)?.textContent || 'Неизвестно';
        infoEl.textContent = `Зона: ${areaName} | Максимум принтов: ${config.maxPrints}`;
    }

    // Показываем изображение зоны
    const imageContainer = document.getElementById('productSideImageContainer');
    if (imageContainer) {
        if (config.imageUrl) {
            imageContainer.innerHTML = `<img src="${config.imageUrl}" alt="Зона печати"
                                            style="width: 100%; height: 100%; object-fit: contain;">`;
            console.log('Изображение загружено:', config.imageUrl);
        } else {
            imageContainer.innerHTML = '<div class="no-image-message">Нет изображения зоны печати</div>';
            console.log('Нет изображения для зоны');
        }
    } else {
        console.error('Контейнер productSideImageContainer не найден!');
    }

    // Настраиваем область печати
    const printArea = document.getElementById('printArea');
    if (printArea) {
        console.log('Настраиваем область печати:', config.width, 'x', config.height);
        console.log('Offset X:', config.offsetX, 'Offset Y:', config.offsetY);

        if (config.width && config.height) {
            const scale = 8; // 1 см = 8 пикселей

            // Рассчитываем размеры области печати
            const areaWidth = config.width * scale;
            const areaHeight = config.height * scale;

            // Устанавливаем размеры
            printArea.style.width = areaWidth + 'px';
            printArea.style.height = areaHeight + 'px';

            // Получаем высоту контейнера изображения
            const container = imageContainer || printArea.parentElement;
            const containerHeight = container ? container.clientHeight : 0;

            // Рассчитываем позицию:
            // left = offset_x (просто отступ слева)
            // top = (высота контейнера - высота области - offset_y)
            let leftPos = (config.offsetX || 0);
            let topPos = containerHeight - areaHeight - (config.offsetY || 0);

            console.log('Container height:', containerHeight);
            console.log('Area height:', areaHeight);
            console.log('Offset Y:', config.offsetY || 0);
            console.log('Calculated top position:', topPos);

            // Устанавливаем позицию
            printArea.style.position = 'absolute';
            printArea.style.left = leftPos + 'px';
            printArea.style.top = topPos + 'px';
            printArea.style.zIndex = '20'; // Делаем поверх изображения

            // Очищаем предыдущие принты
            printArea.innerHTML = '';
            if (!areaPrints[areaId] || areaPrints[areaId].length === 0) {
                const hint = document.createElement('div');
                hint.className = 'print-area-hint';
                hint.innerHTML = 'Выберите принт справа<br><span style="font-size:0.8em;">Перетащите его в область</span>';
                printArea.appendChild(hint);
            } else {
                // Отображаем принты для этой зоны
                renderAreaPrints();
            }
        } else {
            printArea.style.display = 'none';
            console.warn('Нет размеров для области печати');
        }
    } else {
        console.error('Область печати не найдена!');
    }

    updateCurrentPrintsList();
}



// Выбор принта из галереи (step4_prints.html вызывает selectPrint(id, name, url))
// Выбор принта из галереи
// Выбор принта из галереи
function selectPrint(id, name, imageUrl) {
    console.log('=== selectPrint ===');
    console.log('Принт:', name, 'ID:', id);
    console.log('Текущая зона:', currentAreaId);
    console.log('Конфиг зоны:', currentAreaConfig);
    console.log('Принты в зоне:', areaPrints[currentAreaId] || []);

    if (!currentAreaId || !currentAreaConfig) {
        alert('Сначала выберите зону печати');
        return;
    }

    const printsForArea = areaPrints[currentAreaId] || [];
    if (printsForArea.length >= currentAreaConfig.maxPrints) {
        alert(`Максимум ${currentAreaConfig.maxPrints} принтов для этой зоны`);
        return;
    }

    const printArea = document.getElementById('printArea');
    if (!printArea) {
        console.error('Область печати не найдена');
        return;
    }

    const defaultWidth = Math.min(printArea.clientWidth / 2, 150);
    const defaultHeight = Math.min(printArea.clientHeight / 2, 150);

    const newPrint = {
        id,
        name,
        imageUrl: imageUrl || null,
        x: (printArea.clientWidth - defaultWidth) / 2,
        y: (printArea.clientHeight - defaultHeight) / 2,
        width: defaultWidth,
        height: defaultHeight
    };

    console.log('Новый принт:', newPrint);

    // Проверяем пересечения
    if (hasIntersectionWithAny(newPrint, printsForArea)) {
        newPrint.x = 10;
        newPrint.y = 10;
    }

    // Добавляем принт
    if (!areaPrints[currentAreaId]) {
        areaPrints[currentAreaId] = [];
    }
    areaPrints[currentAreaId].push(newPrint);

    console.log('Обновленные принты в зоне:', areaPrints[currentAreaId]);

    // Отрисовываем
    renderAreaPrints();
    updateCurrentPrintsList();
}

// Отрисовка принтов в зоне
function renderAreaPrints() {
    const printArea = document.getElementById('printArea');
    if (!printArea || !currentAreaId) return;

    printArea.innerHTML = '';
    const prints = areaPrints[currentAreaId] || [];

    if (prints.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'print-area-hint';
        hint.innerHTML = 'Выберите принт справа<br><span style="font-size:0.8em;">Перетащите его в область</span>';
        printArea.appendChild(hint);
        return;
    }

    prints.forEach(print => {
        const printElement = createPrintElement(print);
        printArea.appendChild(printElement);
    });
    updateCurrentPrintsList();
}

// Создание элемента принта
function createPrintElement(print) {
    const el = document.createElement('div');
    el.className = 'print-object';
    el.style.position = 'absolute';
    el.style.left = print.x + 'px';
    el.style.top = print.y + 'px';
    el.style.width = print.width + 'px';
    el.style.height = print.height + 'px';
    el.style.border = '1px dashed #fff';
    el.style.cursor = 'move';
    el.style.overflow = 'hidden';
    el.dataset.printId = print.id;

    if (print.imageUrl) {
        el.innerHTML = `<img src="${print.imageUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    } else {
        el.textContent = print.name;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = '12px';
        el.style.background = 'rgba(0,0,0,0.3)';
    }

    // Делаем перетаскиваемым
    makeDraggableWithConstraints(el, print);
    return el;
}

//функции для шага 4
async function loadStep4Data(productId) {
    console.log('=== loadStep4Data ===');
    console.log('Product ID:', productId);
    console.log('selectedData:', selectedData);
    console.log('Загружаем данные для шага 4, product_id:', productId);

    // Обновляем информацию о товаре
    updateProductInfo();

    // Загружаем принты
    await loadPrints();

    // Загружаем зоны печати для этого товара
    await loadPrintAreas(productId);
}

// Загрузка всех принтов
async function loadPrints() {
    const container = document.getElementById('printsGallery');
    if (!container) return;

    container.innerHTML = '<div class="loading-message-small">Загрузка принтов...</div>';

    try {
        const response = await fetch(API_URLS.prints);
        const prints = await response.json();

        if (!prints.length) {
            container.innerHTML = '<div class="no-prints-message">Нет доступных принтов</div>';
            return;
        }

        container.innerHTML = '';
        prints.forEach(print => {
            const printCard = document.createElement('div');
            printCard.className = 'print-card';
            printCard.dataset.printId = print.id;
            printCard.dataset.printName = print.name;
            printCard.dataset.imageUrl = print.image_url || '';

            let iconHtml = '';
            if (print.image_url) {
                iconHtml = `<img src="${print.image_url}" alt="${print.name}">`;
            } else {
                iconHtml = `<div class="print-icon-placeholder">${print.name.charAt(0)}</div>`;
            }

            printCard.innerHTML = `
                <div class="print-icon">${iconHtml}</div>
                <div class="print-name">${print.name}</div>
            `;

            printCard.onclick = () => {
                selectPrint(print.id, print.name, print.image_url);
            };

            container.appendChild(printCard);
        });

    } catch (error) {
        console.error('Ошибка загрузки принтов:', error);
        container.innerHTML = `<div class="error-message">Ошибка загрузки принтов</div>`;
    }
}

// Загрузка зон печати для товара
async function loadPrintAreas(productId) {
    console.log('loadPrintAreas для productId:', productId);

    const tabsContainer = document.getElementById('printAreasTabs');
    const imageContainer = document.getElementById('productSideImageContainer');

    if (!tabsContainer || !imageContainer) {
        console.error('Контейнеры не найдены!');
        return;
    }

    tabsContainer.innerHTML = '<div class="loading-message-small">Загрузка зон печати...</div>';
    imageContainer.innerHTML = '<div class="loading-message-small">Загрузка изображения...</div>';

    try {
        const url = `${API_URLS.printAreas}?product_id=${productId}`;
        console.log('Запрашиваем URL:', url);

        const response = await fetch(url);
        const areas = await response.json();

        console.log('Получены зоны печати:', areas);

        if (!areas.length) {
            tabsContainer.innerHTML = '<div class="no-areas-message">Для этого товара нет зон печати</div>';
            imageContainer.innerHTML = '<div class="no-image-message">Нет изображений зон печати</div>';
            return;
        }

        // Создаем вкладки
        tabsContainer.innerHTML = '';
        areas.forEach((area, index) => {
            const tab = document.createElement('button');
            tab.className = 'area-tab';
            if (index === 0) tab.classList.add('active');

            tab.dataset.areaId = area.id;
            tab.textContent = area.area_name;

            tab.onclick = () => {
                switchArea(area.id, {
                    width: area.width,
                    height: area.height,
                    maxPrints: area.max_prints,
                    imageUrl: area.image_url,
                    offsetX: area.offset_x || 0,
                    offsetY: area.offset_y || 0
                });
            };

            tabsContainer.appendChild(tab);
        });

        // Показываем первую зону
        if (areas[0]) {
            switchArea(areas[0].id, {
                width: areas[0].width,
                height: areas[0].height,
                maxPrints: areas[0].max_prints,
                imageUrl: areas[0].image_url,
                offsetX: area.offset_x || 0,
                offsetY: area.offset_y || 0
            });
        }

    } catch (error) {
        console.error('Ошибка загрузки зон печати:', error);
        tabsContainer.innerHTML = `<div class="error-message">Ошибка загрузки зон печати: ${error.message}</div>`;
    }
}

//крутые штуки для шага 4
function makeDraggableWithConstraints(el, printObj) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    el.onmousedown = dragMouseDown;
    el.ontouchstart = dragTouchStart;

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
        const printArea = document.getElementById('printArea');
        if (!printArea) return;

        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = el.offsetTop - pos2;
        let newLeft = el.offsetLeft - pos1;

        newLeft = Math.max(0, Math.min(newLeft, printArea.clientWidth - el.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, printArea.clientHeight - el.offsetHeight));

        const tempPrint = { ...printObj, x: newLeft, y: newTop };

        if (!hasIntersectionWithAny(tempPrint, areaPrints[currentAreaId], printObj)) {
            el.style.top = newTop + 'px';
            el.style.left = newLeft + 'px';
            printObj.x = newTop;
            printObj.y = newLeft;
            updateCurrentPrintsList();
        }
    }

    function elementDragTouch(e) {
        const touch = e.touches[0];
        const printArea = document.getElementById('printArea');
        if (!printArea) return;

        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;

        let newTop = el.offsetTop - pos2;
        let newLeft = el.offsetLeft - pos1;

        newLeft = Math.max(0, Math.min(newLeft, printArea.clientWidth - el.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, printArea.clientHeight - el.offsetHeight));

        const tempPrint = { ...printObj, x: newLeft, y: newTop };

        if (!hasIntersectionWithAny(tempPrint, areaPrints[currentAreaId], printObj)) {
            el.style.top = newTop + 'px';
            el.style.left = newLeft + 'px';
            printObj.x = newLeft;
            printObj.y = newTop;
            updateCurrentPrintsList();
        }
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

function rectanglesIntersect(a, b) {
    return !(
        a.x + a.width <= b.x ||
        a.x >= b.x + b.width ||
        a.y + a.height <= b.y ||
        a.y >= b.y + b.height
    );
}

function hasIntersectionWithAny(printObj, otherPrints, ignorePrint = null) {
    if (!otherPrints) return false;
    for (const p of otherPrints) {
        if (ignorePrint && p === ignorePrint) continue;
        if (rectanglesIntersect(printObj, p)) return true;
    }
    return false;
}

function updateCurrentPrintsList() {
    const listEl = document.getElementById('currentPrintsList');
    if (!listEl || !currentAreaId) return;

    listEl.innerHTML = '';
    const prints = areaPrints[currentAreaId] || [];

    if (!prints.length) {
        listEl.innerHTML = '<li>Принтов на этой зоне нет</li>';
        return;
    }

    prints.forEach((p, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${p.name} — x: ${Math.round(p.x)}, y: ${Math.round(p.y)}`;
        listEl.appendChild(li);
    });
}

// =======================
// ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ТОВАРЕ (ШАГ 4)
// =======================

function updateProductInfo() {
    console.log('updateProductInfo вызвана');

    const productName = selectedData.product?.model || '-';
    const color = selectedData.color?.name || '-';
    const size = selectedData.size?.size || '-';

    const text = `Модель: ${productName} | Цвет: ${color} | Размер: ${size}`;
    const el = document.getElementById('productInfoText');
    if (el) {
        el.textContent = text;
        console.log('Обновлена информация:', text);
    } else {
        console.error('Элемент productInfoText не найден!');
    }
}
// =======================
// ШАГ 5: ПОДТВЕРЖДЕНИЕ
// =======================
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '-';
}

function updateOrderSummary() {
    setText('summaryProduct', selectedData.product?.model || '-');
    setText('summaryModel', selectedData.color?.name || '-');  // Исправьте с model на color
    setText('summarySize', selectedData.size?.size || '-');

    // Добавьте информацию о принтах
    let printsSummary = 'Нет принтов';
    const totalPrints = Object.values(areaPrints).reduce((sum, arr) => sum + arr.length, 0);
    if (totalPrints > 0) {
        printsSummary = `${totalPrints} принт(ов) на ${Object.keys(areaPrints).length} зоне(ах)`;
    }
    setText('summaryPrint', printsSummary);
}

// Валидация формы клиента
function validateConfirmationForm() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!name || !phone) {
        alert('Пожалуйста, заполните ФИО и телефон');
        return false;
    }
    return true;
}

// =======================
// ОТПРАВКА ЗАКАЗА
// =======================
async function submitOrder() {
    if (!validateConfirmationForm()) return;

    const orderData = {
        product_id: selectedData.size.product_id, // ID конкретного товара
        customer_name: document.getElementById('customerName').value,
        phone_number: document.getElementById('customerPhone').value,
        prints: collectPrintsPayload()
    };

    console.log('Отправляем заказ:', orderData);

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
            document.getElementById('orderNumberDisplay').textContent = result.order_number;
            document.getElementById('successScreen').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
        } else {
            throw new Error(result.error || 'Ошибка сервера');
        }
    } catch (e) {
        alert('Ошибка при создании заказа: ' + e.message);
    }
}

function collectPrintsPayload() {
    const payload = [];
    Object.keys(areaPrints).forEach(areaId => {
        areaPrints[areaId].forEach(p => {
            payload.push({
                area_id: areaId,
                print_id: p.id,
                x: p.x,
                y: p.y,
                width: p.width,
                height: p.height
            });
        });
    });
    return payload;
}