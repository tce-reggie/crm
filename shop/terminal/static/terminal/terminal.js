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

let orderPrints = {};            // { [areaId]: [массив принтов] }
let selectedPrintElement = null; // ID выбранного принта

// Глобальная переменная для данных для шага 5
let step5Data = {
    productId: null,
    productModel: null,
    productSize: null,
    productColor: null,
    prints: [] // Все принты после сохранения
};

let appliedPromocode = null; // Текущий применённый промокод

// =======================
// ЗАПУСК ПРИЛОЖЕНИЯ
// =======================
function startApplication() {
    console.log('=== startApplication() вызывается ===');

    // 1. Скрываем скринсейвер
    const screensaver = document.getElementById('screensaver');
    if (screensaver) screensaver.style.display = 'none';

    // 2. Показываем приложение
    const app = document.getElementById('app');
    if (app) {
        app.style.display = 'flex';
    }

    // 3. Показываем шаг 1
    document.querySelectorAll('.step-container').forEach(c => {
        c.style.display = 'none';
    });

    const step1 = document.getElementById('step1');
    if (step1) {
        step1.style.display = 'flex';
        currentStep = 1;
    }

    // 4. ВАЖНО: Восстанавливаем навигацию
    updateNavigation();

    // 5. Загружаем товары
    loadProducts();

    // 6. Сбрасываем таймер
    resetInactivityTimer();

    console.log('Приложение запущено, шаг 1, навигация восстановлена');
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
        if (c.id !== `step${step}`) {
            c.style.display = 'none';
            console.log(`Скрыт: ${c.id}`);
        }
    });

    // 2. Показываем нужный шаг
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
        targetStep.style.display = 'flex';
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

    // 5. Особые действия при переходе на шаг 5
    if (step === 5) {
        console.log('=== ПЕРЕХОД НА ШАГ 5 ===');

//        // Автоматически сохраняем все несохраненные принты перед показом шага 5
//        const unsavedPrints = getAllUnsavedPrints();
//        if (unsavedPrints && unsavedPrints.length > 0) {
//            console.log('Автосохранение', unsavedPrints.length, 'принтов...');
//            updateStep5Data(unsavedPrints);
//            markPrintsAsSaved(unsavedPrints);
//        } else {
//            console.log('Нет несохраненных принтов, обновляю только данные товара');
//            updateStep5Data([]);
//        }

        // Обновляем сводку
        setTimeout(() => {
            updateOrderSummary();
            console.log('Сводка обновлена');
        }, 100);
    }
}

function updateNavigation() {
    console.log('updateNavigation(), текущий шаг:', currentStep);

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const confirmBtn = document.getElementById('confirmBtn');

    if (!prevBtn || !nextBtn) {
        console.error('Кнопки навигации не найдены');
        return;
    }

    // 1. Всегда показываем контейнер навигации
    const navigationContainer = document.querySelector('.navigation');
    if (navigationContainer) {
        navigationContainer.style.display = 'flex';
    }

    // 2. НА ШАГЕ 5: показываем "Назад", скрываем "Далее"
    if (currentStep === 5) {
        // Кнопка "Назад" активна
        prevBtn.style.display = 'block';
        prevBtn.disabled = false;

        // Кнопка "Далее" скрыта
        nextBtn.style.display = 'none';

        // Если есть кнопка подтверждения - показываем её
        if (confirmBtn) {
            confirmBtn.style.display = 'block';
        }

        console.log('На шаге 5: показана кнопка Назад, скрыта кнопка Далее');
        return;
    }

    // 3. НА ШАГАХ 1-4: стандартная навигация
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';

    // Отключаем "Назад" только на первом шаге
    prevBtn.disabled = currentStep === 1;

    // Кнопка "Далее" всегда активна
    nextBtn.disabled = false;

    // Скрываем кнопку подтверждения
    if (confirmBtn) {
        confirmBtn.style.display = 'none';
    }

    console.log(`На шаге ${currentStep}: стандартная навигация`);
}

function nextStep() {
    console.log('nextStep() вызывается, текущий шаг:', currentStep);

    // Проверяем валидацию для текущего шага
    if (!validateCurrentStep()) {
        console.log('Валидация не пройдена');
        return;
    }

    // ОСОБАЯ ПРОВЕРКА ДЛЯ ШАГА 4
    if (currentStep === 4) {
        console.log('=== ПРОВЕРКА ШАГА 4 ПЕРЕД ПЕРЕХОДОМ ===');

        // 1. Проверяем, есть ли несохраненные принты
        const unsavedPrints = getAllUnsavedPrints();
        if (unsavedPrints && unsavedPrints.length > 0) {
            alert(`У вас есть ${unsavedPrints.length} несохраненных принтов.\n\nНажмите кнопку "Сохранить все изменения" перед переходом к оформлению заказа.`);
            console.log('Переход отменен: есть несохраненные принты');
            return; // Не переходим дальше
        }

//        // 2. Проверяем пересечения (опционально, но полезно)
//        const totalPrints = Object.values(orderPrints).reduce((sum, areaPrints) =>
//            sum + (areaPrints ? areaPrints.length : 0), 0
//        );
//
//        if (totalPrints > 0) {
//            const intersections = checkAllPrintIntersections();
//            if (intersections.length > 0) {
//                const errorMessage = intersections.map(i =>
//                    `• ${i.print1} и ${i.print2} пересекаются на зоне "${i.areaName}"`
//                ).join('\n');
//
//                alert(`Обнаружены пересечения принтов:\n\n${errorMessage}\n\nИсправьте пересечения перед переходом.`);
//                console.log('Переход отменен: есть пересечения принтов');
//                return;
//            }
//        }

        // 3. Если всё хорошо - переходим на шаг 5
        console.log('Все проверки пройдены, переходим к шагу 5');
        showStep(5);
        return;
    }

    // Стандартный переход для шагов 1-3
    if (currentStep < 5) {
        console.log('Переход к шагу', currentStep + 1);
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
            return true;
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

// Функция обновления данных продукта
//function updateOrderProductData() {
//    if (selectedData) {
//        orderData.productId = selectedData.productId;
//        orderData.productModel = selectedData.productModel;
//        orderData.productSize = selectedData.productSize;
//        orderData.productColor = selectedData.productColor;
//    }
//}

// Настраиваем область печати
function switchArea(areaId, config) {
    console.log('Переключаем зону:', areaId);

    // Сохраняем текущую зону
    currentAreaId = areaId;
    currentAreaConfig = config;

    // 1. Активируем вкладку
    document.querySelectorAll('.area-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.areaId === areaId.toString());
    });

    // 2. Обновляем информацию
    const infoEl = document.getElementById('currentAreaInfo');
    if (infoEl) {
        const areaName = document.querySelector(`.area-tab[data-area-id="${areaId}"]`)?.textContent || 'Неизвестно';
        infoEl.textContent = `Зона: ${areaName} | Максимум принтов: ${config.maxPrints || 5}`;
    }

    // 3. Показываем изображение
    const imageContainer = document.getElementById('productSideImageContainer');
    if (imageContainer) {
        if (config.imageUrl) {
            imageContainer.innerHTML = `<img src="${config.imageUrl}" alt="Сторона товара"
                                          style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        } else {
            imageContainer.innerHTML = '<div class="no-image-message">Нет изображения</div>';
        }
    }

    // 4. Настраиваем область печати
    const printArea = document.getElementById('printArea');
    if (printArea && imageContainer) {
        if (config.width && config.height) {
            const parentContainer = imageContainer.parentElement;

            if (printArea.parentElement !== parentContainer) {
                parentContainer.appendChild(printArea);
            }

            printArea.style.width = config.width + 'px';
            printArea.style.height = config.height + 'px';
            printArea.style.left = (config.offsetX || 0) + 'px';
            printArea.style.top = (config.offsetY || 0) + 'px';
            printArea.style.position = 'absolute';
            printArea.style.display = 'block';
            printArea.style.zIndex = '20';

            // ВАЖНО: Очищаем только визуально, принты остаются в orderPrints[areaId]
            printArea.innerHTML = '';

            // Показываем принты для ЭТОЙ зоны
            const printsForThisArea = orderPrints[areaId] || [];

            if (printsForThisArea.length === 0) {
                const hint = document.createElement('div');
                hint.className = 'print-area-hint';
                hint.innerHTML = 'Выберите принт справа<br><span style="font-size:0.8em;">Перетащите его в область</span>';
                printArea.appendChild(hint);
            } else {
                // Отрисовываем принты для этой зоны
                printsForThisArea.forEach(print => {
                    const printElement = createPrintElement(print);
                    printElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectPrintElement(print.id);
                    });
                    printArea.appendChild(printElement);
                });
                highlightSelectedPrint();
            }
        } else {
            printArea.style.display = 'none';
        }
    }

    // 5. Обновляем список принтов для этой зоны
    updateCurrentPrintsList();
}


// Создание элемента принта
function createPrintElement(print) {
    console.log('createPrintElement для принта:', print);

    const el = document.createElement('div');
    el.className = 'print-object';
    el.style.position = 'absolute';
    el.style.left = print.x + 'px';
    el.style.top = print.y + 'px';
    el.style.width = print.width + 'px';
    el.style.height = print.height + 'px';
    el.style.cursor = 'move';
    //el.style.overflow = 'hidden';
    el.style.overflow = 'visible';
    el.dataset.printId = print.id;

    // Стиль в зависимости от состояния
    if (print.isSaved) {
        el.style.border = '2px solid #4CAF50';
    } else {
        el.style.border = '2px solid #FF9800';
    }
    el.style.borderRadius = '5px';
    el.style.transition = 'border-color 0.3s ease';

    // ОТОБРАЖЕНИЕ СОДЕРЖИМОГО
    if (print.isCustomText) {
        // Текстовый принт: БЕЛЫЙ ТЕКСТ НА ПРОЗРАЧНОМ ФОНЕ
        el.textContent = print.name;

        // Стили для текста (белый на прозрачном)
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontFamily = 'Arial, sans-serif';
        el.style.fontSize = '16px';  // Чуть больше для лучшей читаемости
        el.style.fontWeight = 'bold';
        el.style.color = '#FFFFFF';  // БЕЛЫЙ цвет текста
        el.style.background = 'transparent';  // ПРОЗРАЧНЫЙ фон
        el.style.padding = '5px';
        el.style.boxSizing = 'border-box';
        el.style.textAlign = 'center';
        el.style.whiteSpace = 'normal';
        el.style.wordWrap = 'break-word';

    } else if (print.imageUrl) {
        // Обычный принт с изображением
        const img = document.createElement('img');
        img.src = print.imageUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';
        el.appendChild(img);
    } else {
        // Принт без изображения (запасной вариант)
        el.textContent = print.name;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = '12px';
        el.style.background = 'rgba(0,0,0,0.3)';
        el.style.color = 'white';
    }

    // БЕЙДЖИ СОХРАНЕННОСТИ (для ВСЕХ типов принтов)
    if (print.isSaved) {
        const badge = document.createElement('div');
        badge.className = 'saved-badge';
        badge.textContent = '✓';
        badge.style.cssText = `
            position: absolute;
            top: 5px;
            right: 0px;
            background: rgba(255, 152, 0, 0.8);
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            z-index: 15;
        `;
        el.appendChild(badge);
    } else {
        const badge = document.createElement('div');
        badge.className = 'unsaved-badge';
        badge.textContent = 'Не сохранен';
        badge.style.cssText = `
            position: absolute;
            top: -25px;
            right: 0px;
            background: rgba(255, 152, 0, 0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.7em;
            font-weight: bold;
            z-index: 15;
            animation: unsavedPulse 2s infinite;
            white-space: nowrap;
        `;
        el.appendChild(badge);
    }

    makeDraggableWithConstraints(el, print);

    el.addEventListener('click', function(e) {
        if (!e.target.classList.contains('btn-remove-small')) {
            selectPrintElement(print.id);
        }
    });

    return el;
}

//функции для шага 4
async function loadStep4Data(productId) {
    clearAllPrints();
    console.log('=== loadStep4Data ===');
    console.log('Product ID:', productId);
    console.log('selectedData:', selectedData);

    // 1. Обновляем информацию о товаре (модель, цвет, размер)
    updateProductInfo();

    // 2. Загружаем ВСЕ доступные принты (галерею принтов)
    await loadPrints();

    // 3. Загружаем зоны печати для ЭТОГО КОНКРЕТНОГО товара
    await loadPrintAreas(productId);
    // ^ Здесь productId - ID конкретного товара (например, футболка синяя XL)
}

function clearAllPrints() {
    areaPrints = {};
    selectedPrintElement = null;
    currentAreaId = null;
    currentAreaConfig = null;
    step5Data.prints = [];
}

// Загрузка всех принтов
async function loadPrints() {
    const container = document.getElementById('printsGallery');
    if (!container) return;

    // Сохраняем HTML кнопки "Добавить текст"
    const addTextHTML = `
        <div class="print-card add-text-card" onclick="openTextInputModal()">
            <div class="print-icon add-text-icon">
                <div class="add-text-symbol">✏️</div>
            </div>
            <div class="print-name">Добавить текст</div>
        </div>
    `;

    // Показываем загрузку
    container.innerHTML = addTextHTML + '<div class="loading-message-small">Загрузка принтов...</div>';

    try {
        const response = await fetch(API_URLS.prints);
        const prints = await response.json();

        // Начинаем с кнопки "Добавить текст"
        let html = addTextHTML;

        if (!prints || prints.length === 0) {
            html += '<div class="no-prints-message">Нет доступных принтов</div>';
            container.innerHTML = html;
            return;
        }

        // Добавляем обычные принты
        prints.forEach(print => {
            let iconHtml = '';
            if (print.image_url) {
                iconHtml = `<img src="${print.image_url}" alt="${print.name}">`;
            } else {
                iconHtml = `<div class="print-icon-placeholder">${print.name.charAt(0)}</div>`;
            }

            html += `
                <div class="print-card"
                     data-print-id="${print.id}"
                     data-print-name="${print.name}"
                     data-image-url="${print.image_url || ''}"
                     onclick="selectPrint(${print.id}, '${print.name.replace(/'/g, "\\'")}', '${print.image_url || ''}')">
                    <div class="print-icon">${iconHtml}</div>
                    <div class="print-name">${print.name}</div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки принтов:', error);
        container.innerHTML = addTextHTML + `<div class="error-message">Ошибка загрузки принтов: ${error.message}</div>`;
    }
}

// Загрузка зон печати для товара
async function loadPrintAreas(productId) {
    console.log('loadPrintAreas для конкретного товара ID:', productId);

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
        console.log('Запрашиваем зоны печати для товара:', url);

        const response = await fetch(url);
        const areas = await response.json();

        console.log('Получены зоны печати для этого товара:', areas);

        if (!areas || !areas.length) {
            tabsContainer.innerHTML = '<div class="no-areas-message">Для этого товара нет зон печати</div>';
            imageContainer.innerHTML = '<div class="no-image-message">Нет изображений зон печати</div>';
            return;
        }

        // Создаем вкладки (кнопки для выбора стороны печати)
        tabsContainer.innerHTML = '';
        areas.forEach((area, index) => {
            const tab = document.createElement('button');
            tab.className = 'area-tab';
            if (index === 0) tab.classList.add('active');

            tab.dataset.areaId = area.id;
            tab.textContent = area.area_name; // Например: "Передняя сторона", "Задняя сторона"

            tab.onclick = () => {
                // При клике на вкладку показываем эту зону
                console.log('Выбрана зона:', area);
                switchArea(area.id, {
                    width: area.width,          // ширина зоны в см
                    height: area.height,        // высота зоны в см
                    maxPrints: area.max_prints, // максимум принтов
                    imageUrl: area.image_url,   // изображение зоны
                    offsetX: area.offset_x || 0, // отступ слева
                    offsetY: area.offset_y || 0  // отступ сверху
                });
            };

            tabsContainer.appendChild(tab);
        });

        // Автоматически показываем первую зону
        if (areas && areas[0]) {
            const firstArea = areas[0]; // Сохраняем в переменную для ясности
            console.log('Показываем первую зону:', firstArea);

            switchArea(firstArea.id, {
                width: firstArea.width,
                height: firstArea.height,
                maxPrints: firstArea.max_prints,
                imageUrl: firstArea.image_url,
                offsetX: firstArea.offset_x || 0,
                offsetY: firstArea.offset_y || 0
            });
        } else {
            console.warn('Нет зон для показа');
        }

    } catch (error) {
        console.error('Ошибка загрузки зон печати:', error);
        console.error('Стек ошибки:', error.stack); // Добавим стек для диагностики
        tabsContainer.innerHTML = `<div class="error-message">Ошибка загрузки зон печати: ${error.message}</div>`;
    }
}

//крутые штуки для шага 4
// Модифицируем функцию makeDraggableWithConstraints
function makeDraggableWithConstraints(el, printObj) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.onmousedown = function(e) {
        if (printObj.id != selectedPrintElement) {
            selectPrintElement(printObj.id);
        }

        e.preventDefault();
        isDragging = true;

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(el.style.left) || 0;
        initialTop = parseInt(el.style.top) || 0;

        el.classList.add('dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    function onMouseMove(e) {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const printArea = document.getElementById('printArea');
        if (printArea) {
            newLeft = Math.max(0, Math.min(newLeft, printArea.clientWidth - el.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, printArea.clientHeight - el.offsetHeight));
        }

        // Обновляем позицию
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';

        // Если позиция изменилась и принт был сохранён
        if ((newLeft !== initialLeft || newTop !== initialTop) && printObj.isSaved) {
            markPrintAsUnsavedAfterDrag(el, printObj);
        }

        // Всегда обновляем координаты
        printObj.x = newLeft;
        printObj.y = newTop;

        updateCurrentPrintsList();
    }

    function onMouseUp() {
        isDragging = false;
        el.classList.remove('dragging');

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

// Пометить как несохранённый после перетаскивания
function markPrintAsUnsavedAfterDrag(element, printObj) {
    printObj.isSaved = false;

    // Меняем рамку
    element.style.border = '2px solid #FF9800';
    element.style.boxShadow = '0 0 5px rgba(255, 152, 0, 0.5)';

    // Удаляем галочку
    const savedBadge = element.querySelector('.saved-badge');
    if (savedBadge) {
        savedBadge.classList.add('removing');
        setTimeout(() => {
            savedBadge.remove();
        }, 300);
    }

    // Добавляем надпись "Не сохранен"
    const unsavedBadge = document.createElement('div');
    unsavedBadge.className = 'unsaved-badge';
    unsavedBadge.textContent = 'Не сохранен';
    unsavedBadge.style.cssText = `
        position: absolute;
        top: -25px;
        right: ${print.isCustomText ? '25px' : '5px'};
        background: rgba(255, 152, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.7em;
        font-weight: bold;
        z-index: 5;
        animation: unsavedPulse 2s infinite;
    `;
    element.appendChild(unsavedBadge);
}

//функции проверки на пересечения
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

// Обновленная функция selectPrint
function selectPrint(id, name, imageUrl) {
    if (!currentAreaId || !currentAreaConfig) {
        alert('Сначала выберите зону печати');
        return;
    }

    const printsForArea = orderPrints[currentAreaId] || []; // Было areaPrints
    if (printsForArea.length >= currentAreaConfig.maxPrints) {
        alert(`Максимум ${currentAreaConfig.maxPrints} принтов для этой зоны`);
        return;
    }

    const printInstanceId = Date.now();

    const newPrint = {
        id: printInstanceId,
        printId: id,
        name: name,
        imageUrl: imageUrl || null,
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        areaId: currentAreaId,
        isSaved: false,
        isCustomText: false
    };

    // Добавляем в orderPrints (было areaPrints)
    if (!orderPrints[currentAreaId]) {
        orderPrints[currentAreaId] = [];
    }
    orderPrints[currentAreaId].push(newPrint);

    selectedPrintElement = printInstanceId;
    renderAreaPrints();
    updateCurrentPrintsList();
}

// Обновленная функция renderAreaPrints
function renderAreaPrints() {
    const printArea = document.getElementById('printArea');
    if (!printArea || !currentAreaId) return;

    const prints = orderPrints[currentAreaId] || []; // Было areaPrints

    printArea.innerHTML = '';

    if (prints.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'print-area-hint';
        hint.innerHTML = 'Выберите принт справа<br><span style="font-size:0.8em;">Перетащите его в область</span>';
        printArea.appendChild(hint);
        return;
    }

    prints.forEach(print => {
        const printElement = createPrintElement(print);

        printElement.addEventListener('click', (e) => {
            e.stopPropagation();
            selectPrintElement(print.id);
        });

        printArea.appendChild(printElement);
    });

    highlightSelectedPrint();
}

// Функция выбора элемента принта
function selectPrintElement(printInstanceId) {
    selectedPrintElement = printInstanceId;
    highlightSelectedPrint();
    updateCurrentPrintsList();
}

// Подсветка выбранного принта
function highlightSelectedPrint() {
    document.querySelectorAll('.print-object').forEach(el => {
        const isSelected = el.dataset.printId == selectedPrintElement;
        el.classList.toggle('selected', isSelected);

        // Добавляем/убираем рамку для выбранного
        if (isSelected) {
            el.style.border = '3px solid #FF9800';
            el.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.5)';
        } else {
            el.style.border = '2px solid #4CAF50';
            el.style.boxShadow = 'none';
        }
    });
}

function updateCurrentPrintsList() {
    const listEl = document.getElementById('currentPrintsList');
    if (!listEl || !currentAreaId) return;

    listEl.innerHTML = '';
    const prints = orderPrints[currentAreaId] || []; // Было areaPrints

    if (!prints.length) {
        listEl.innerHTML = '<div class="empty-message">Принтов на этой зоне нет</div>';
        return;
    }

    let html = '';

    prints.forEach((print, index) => {
        const isSelected = print.id == selectedPrintElement;
        html += `
            <div class="print-list-item ${isSelected ? 'selected' : ''} ${print.isSaved ? 'saved' : 'unsaved'}"
                 onclick="selectPrintElement(${print.id})">
                <div class="print-item-info">
                    <div class="print-item-name">
                        ${index + 1}. ${print.name}
                        ${print.isSaved ? ' ✓' : ' ⚠️'}
                    </div>
                    <div class="print-item-coords">
                        x: ${Math.round(print.x)}px, y: ${Math.round(print.y)}px
                    </div>
                </div>
                <div class="print-item-actions">
                    <button class="btn-remove-small" onclick="removePrint(${print.id}); event.stopPropagation()">
                        ✕ Удалить
                    </button>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// Получение всех несохранённых принтов
function getAllUnsavedPrints() {
    const unsaved = [];

    Object.keys(orderPrints).forEach(areaId => { // Было areaPrints
        orderPrints[areaId].forEach(print => { // Было areaPrints
            if (!print.isSaved) {
                unsaved.push(print);
            }
        });
    });

    return unsaved;
}

// Обновление step5Data
function updateStep5Data(unsavedPrints) {
    console.log('=== updateStep5Data ===');

    // 1. Обновляем данные продукта
    step5Data.productId = selectedData.size?.product_id;
    step5Data.productModel = selectedData.product?.model;
    step5Data.productSize = selectedData.size?.size;
    step5Data.productColor = selectedData.color?.name;

    // 2. Очищаем старые принты
    step5Data.prints = [];

    // 3. Добавляем каждый принт в step5Data
    if (unsavedPrints && unsavedPrints.length > 0) {
        unsavedPrints.forEach(print => {
            let content;
            if (print.isCustomText) {
                // Для текстовых: сам текст
                content = print.name;
            } else if (print.printId) {
                // Для обычных: "prints/название"
                content = `prints/${print.name}`;
            } else {
                // Запасной вариант
                content = print.name;
            }

            const printForDB = {
                area_id: parseInt(print.areaId),
                content: content,
                position_x: parseFloat(print.x),
                position_y: parseFloat(print.y)
            };

            step5Data.prints.push(printForDB);
            console.log(`Добавлен принт "${print.name}" в step5Data`);
        });
    }

    console.log('step5Data обновлен:', step5Data);

    // Сразу обновляем сводку на шаге 5
    if (currentStep === 5) {
        updateOrderSummary();
    }
}

// Функция удаления принта
function removePrint(printInstanceId) {
    if (!confirm('Удалить этот принт?')) return;

    const prints = orderPrints[currentAreaId] || []; // Было areaPrints
    const printIndex = prints.findIndex(p => p.id == printInstanceId);

    if (printIndex !== -1) {
        const removedPrint = prints[printIndex];
        prints.splice(printIndex, 1);

        // Удаляем из DOM
        const printElement = document.querySelector(`[data-print-id="${printInstanceId}"]`);
        if (printElement) printElement.remove();

        if (selectedPrintElement == printInstanceId) {
            selectedPrintElement = null;
        }

        updateCurrentPrintsList();
    }
}

function saveAllPrints() {
    console.log('=== saveAllPrints ===');

    // 1. Проверяем пересечения (если есть принты)
    const totalPrints = Object.values(orderPrints).reduce((sum, areaPrints) =>
        sum + (areaPrints ? areaPrints.length : 0), 0);

    if (totalPrints > 0) {
        const intersections = checkAllPrintIntersections();
        if (intersections.length > 0) {
            const errorMessage = intersections.map(i =>
                `• ${i.print1} и ${i.print2} пересекаются на зоне "${i.areaName}"`
            ).join('\n');

            alert(`Обнаружены пересечения принтов:\n\n${errorMessage}\n\nИсправьте пересечения перед сохранением.`);
            return;
        }

        // 2. Сохраняем только НЕсохранённые принты
        const unsavedPrints = getAllUnsavedPrints();
        if (unsavedPrints.length > 0) {
            // 3. Обновляем step5Data (здесь добавляется префикс "prints/")
            updateStep5Data(unsavedPrints);

            // 4. Помечаем принты как сохранённые
            markPrintsAsSaved(unsavedPrints);

            // 5. Обновляем список
            updateCurrentPrintsList();

            // 6. Показываем успешное сообщение
            showSaveSuccessMessage(unsavedPrints.length);
        } else {
            alert('Все принты уже сохранены или их нет');
        }
    } else {
        // Если принтов нет, всё равно обновляем данные продукта
        updateStep5Data([]); // Пустой массив
        alert('✅ Информация о товаре сохранена (принтов нет)');
    }

    console.log('=== СОХРАНЕНО ДЛЯ ШАГА 5 ===');
    console.log('Товар:', step5Data.productModel, step5Data.productColor, step5Data.productSize);
    console.log('Принты:', step5Data.prints.length, 'шт.');
    console.log('step5Data:', step5Data);
}

// Функция проверки всех пересечений
function checkAllPrintIntersections() {
    const intersections = [];

    Object.keys(orderPrints).forEach(areaId => { // Было areaPrints
        const prints = orderPrints[areaId] || []; // Было areaPrints
        const areaName = getAreaNameById(areaId);

        // Проверяем все пары принтов в зоне
        for (let i = 0; i < prints.length; i++) {
            for (let j = i + 1; j < prints.length; j++) {
                if (rectanglesIntersect(prints[i], prints[j])) {
                    intersections.push({
                        areaId: areaId,
                        areaName: areaName,
                        print1: prints[i].name,
                        print2: prints[j].name
                    });
                }
            }
        }
    });

    return intersections;
}

// Функция получения названия зоны по ID
function getAreaNameById(areaId) {
    const tab = document.querySelector(`.area-tab[data-area-id="${areaId}"]`);
    return tab ? tab.textContent : `Зона ${areaId}`;
}

// Функция отметки принтов как сохраненных (визуально)
function markPrintsAsSaved(printsToMark) {
    console.log('Помечаем как сохранённые:', printsToMark.length, 'принтов');

    printsToMark.forEach(print => {
        print.isSaved = true;

        // Находим элемент в DOM
        const element = document.querySelector(`.print-object[data-print-id="${print.id}"]`);
        if (element) {
            console.log('Обновляем элемент принта:', print.name);

            // 1. Меняем рамку
            element.style.border = '2px solid #4CAF50';
            element.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';

            // 2. Удаляем надпись "Не сохранен" если есть
            const unsavedBadge = element.querySelector('.unsaved-badge');
            if (unsavedBadge) {
                console.log('Удаляем unsaved-badge');
                unsavedBadge.style.animation = 'unsavedRemove 0.3s ease forwards';
                setTimeout(() => {
                    unsavedBadge.remove();
                }, 300);
            }

            // 3. Удаляем старую галочку если есть
            const oldSavedBadge = element.querySelector('.saved-badge');
            if (oldSavedBadge) {
                console.log('Удаляем старый saved-badge');
                oldSavedBadge.remove();
            }

            // 4. Добавляем новую галочку
            const badge = document.createElement('div');
            badge.className = 'saved-badge';
            badge.textContent = '✓';
            badge.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: #4CAF50;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                z-index: 10;
            `;
            element.appendChild(badge);

            // Анимация появления
            badge.animate([
                { transform: 'scale(0)', opacity: 0 },
                { transform: 'scale(1.2)', opacity: 1 },
                { transform: 'scale(1)', opacity: 1 }
            ], {
                duration: 500,
                easing: 'ease-out'
            });
        } else {
            console.warn('Элемент не найден для принта:', print.id);
        }
    });
}

// Функция показа успешного сообщения
function showSaveSuccessMessage(totalPrints) {
    let message;

    if (totalPrints === 0) {
        message = `✅ Информация о товаре сохранена\n\nВы можете перейти к оформлению заказа.`;
    } else {
        message = `✅ Принты успешно сохранены!\n\nВсего сохранено: ${totalPrints} принтов\nГотово к переходу на шаг 5.\n\nТеперь вы можете:\n1. Добавить еще принты\n2. Переместить существующие\n3. Нажать "Сохранить всё" еще раз для обновления\n\nИли перейдите к оформлению заказа.`;
    }

    alert(message);
}

//==================
//ШАГ 4 добавление текста на товар
//==================
function addCustomText() {
    const textInput = document.getElementById('customText');
    const text = textInput.value.trim();

    if (!text) {
        alert('Введите текст');
        return;
    }

    if (text.length > 100) {
        alert('Максимальная длина текста: 100 символов');
        return;
    }

    // Проверяем максимальное количество принтов
    const printsForArea = orderPrints[currentAreaId] || [];
    if (printsForArea.length >= currentAreaConfig.maxPrints) {
        alert(`Максимум ${currentAreaConfig.maxPrints} принтов для этой зоны`);
        return;
    }

    const printInstanceId = Date.now();

    const customTextPrint = {
        id: printInstanceId,
        name: text,             // Сам текст
        x: 50,
        y: 50,
        width: Math.min(text.length * 8 + 40, 300),
        height: 60,
        areaId: currentAreaId,
        isSaved: false,
        isCustomText: true      // Флаг что это текстовый принт
    };

    console.log('Создаем текстовый принт:', customTextPrint);
    console.log('Текущий currentAreaId:', currentAreaId);
    console.log('Текущий orderPrints до добавления:', orderPrints);

    // Добавляем в orderPrints
    if (!orderPrints[currentAreaId]) {
        orderPrints[currentAreaId] = [];
    }
    orderPrints[currentAreaId].push(customTextPrint);

    console.log('orderPrints после добавления:', orderPrints);
    console.log('Принты в текущей зоне:', orderPrints[currentAreaId]);

    // Выбираем его
    selectedPrintElement = printInstanceId;

    // Закрываем модальное окно
    closeTextInputModal();

    // Отрисовываем
    renderAreaPrints();
    updateCurrentPrintsList();

    console.log('Текстовый принт добавлен:', customTextPrint);
}

function openTextInputModal() {
    console.log('=== openTextInputModal вызывается ===');
    console.log('currentAreaId:', currentAreaId);
    console.log('currentAreaConfig:', currentAreaConfig);

    if (!currentAreaId || !currentAreaConfig) {
        alert('Сначала выберите зону печати');
        return;
    }

    // Проверяем максимальное количество принтов
    const printsForArea = orderPrints[currentAreaId] || [];
    console.log('Принтов в текущей зоне:', printsForArea.length);
    console.log('Максимум принтов:', currentAreaConfig.maxPrints);

    if (printsForArea.length >= currentAreaConfig.maxPrints) {
        alert(`Максимум ${currentAreaConfig.maxPrints} принтов для этой зоны`);
        return;
    }

    const modal = document.getElementById('textInputModal');
    if (!modal) {
        console.error('Модальное окно не найдено!');
        return;
    }

    const textarea = document.getElementById('customText');
    const charCount = document.getElementById('charCount');

    textarea.value = '';
    charCount.textContent = '0';
    modal.style.display = 'flex';

    // Обработчик подсчета символов
    textarea.addEventListener('input', function() {
        charCount.textContent = this.value.length;
    });

    // Фокус на текстовом поле
    setTimeout(() => textarea.focus(), 100);
    console.log('Модальное окно открыто');
}

function closeTextInputModal() {
    console.log('closeTextInputModal вызвана');
    const modal = document.getElementById('textInputModal');
    if (modal) {
        modal.style.display = 'none';
    }
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
// ШАГ 5: ФУНКЦИИ ДЛЯ ПОДТВЕРЖДЕНИЯ ЗАКАЗА
// =======================

// Главная функция обновления сводки заказа на шаге 5
function updateOrderSummary() {
    console.log('=== updateOrderSummary() ВЫЗВАНА ===');
    console.log('step5Data:', step5Data);

    // 1. Просто заполняем элементы, которые точно есть
    // Проверяем разные возможные ID

    // Для модели товара
    const modelEl = document.getElementById('displayProductModel') ||
                   document.getElementById('summaryProductModel') ||
                   document.getElementById('summaryProduct');

    if (modelEl) {
        modelEl.textContent = step5Data.productModel || selectedData.product?.model || 'Не выбрано';
        console.log('Заполнен элемент модели:', modelEl.id, '=', modelEl.textContent);
    } else {
        console.log('Элемент для модели не найден');
    }

    // Для цвета
    const colorEl = document.getElementById('displayProductColor') ||
                   document.getElementById('summaryProductColor') ||
                   document.getElementById('summaryModel');

    if (colorEl) {
        colorEl.textContent = step5Data.productColor || selectedData.color?.name || 'Не выбрано';
        console.log('Заполнен элемент цвета:', colorEl.id, '=', colorEl.textContent);
    } else {
        console.log('Элемент для цвета не найден');
    }

    // Для размера
    const sizeEl = document.getElementById('displayProductSize') ||
                  document.getElementById('summaryProductSize') ||
                  document.getElementById('summarySize');

    if (sizeEl) {
        sizeEl.textContent = step5Data.productSize || selectedData.size?.size || 'Не выбрано';
        console.log('Заполнен элемент размера:', sizeEl.id, '=', sizeEl.textContent);
    } else {
        console.log('Элемент для размера не найден');
    }

    // 2. Обновляем принты
    updatePrintsDisplay();
    updatePromoDisplay();
}

// Функция отображения принтов, сгруппированных по зонам
function updatePrintsDisplay() {
    console.log('=== updatePrintsDisplay() ===');

    // Ищем контейнер для принтов
    const printsContainer = document.getElementById('displayPrints') ||
                           document.getElementById('printsSummary') ||
                           document.getElementById('summaryPrint');

    if (!printsContainer) {
        console.log('Контейнер для принтов не найден!');
        return;
    }

    console.log('Найден контейнер для принтов:', printsContainer.id);

    // Проверяем данные
    if (!step5Data.prints || step5Data.prints.length === 0) {
        printsContainer.innerHTML = '<div style="color: #888; padding: 20px; text-align: center;">Принты не добавлены</div>';
        console.log('Нет принтов для отображения');
        return;
    }

    console.log('Всего принтов:', step5Data.prints.length);

    // Самый простой вывод - просто список
    let html = '';

    // Группируем по зонам
    const zones = {};
    step5Data.prints.forEach(print => {
        const zoneId = print.area_id;
        if (!zones[zoneId]) zones[zoneId] = [];
        zones[zoneId].push(print);
    });

    // Выводим
    Object.keys(zones).forEach(zoneId => {
        const zoneName = `Сторона ${zoneId}`; // Временно просто номер
        const prints = zones[zoneId];

        html += `<div style="margin: 10px 0; padding: 10px; background: #2a2a2a; border-radius: 5px;">`;
        html += `<strong style="color: #FF9800;">${zoneName}:</strong><br>`;

        prints.forEach(print => {
            const name = print.content.replace('prints/', '');
            html += `<div style="color: white; padding: 5px 0 5px 15px;">• ${name}</div>`;
        });

        html += `</div>`;
    });

    printsContainer.innerHTML = html;
    console.log('Принты отображены');
}

// Функция для получения названия зоны по ID
// вроде как не используется, а используется предыдущая 'простая' версия
//function getAreaNameById(areaId) {
//    try {
//        // Ищем вкладку с таким data-area-id среди всех вкладок зон
//        const allTabs = document.querySelectorAll('.area-tab');
//        for (let tab of allTabs) {
//            if (tab.dataset.areaId == areaId) {
//                return tab.textContent.trim();
//            }
//        }
//
//        // Если вкладка не найдена в текущем DOM, пробуем найти в сохраненных данных
//        console.log(`Вкладка для зоны ${areaId} не найдена в DOM`);
//        return null;
//
//    } catch (error) {
//        console.error('Ошибка при получении названия зоны:', error);
//        return null;
//    }
//}

// Функция оформления заказа
async function createOrder() {
    console.log('=== createOrder() ВЫЗВАНА ===');

    try {
        // 1. Получаем данные клиента
        const nameInput = document.getElementById('customerNameInput');
        const phoneInput = document.getElementById('customerPhoneInput');

        if (!nameInput || !phoneInput) {
            alert('Ошибка: поля ввода не найдены');
            return;
        }

        const customerName = nameInput.value.trim();
        const phoneNumber = phoneInput.value.trim();

        // 2. Проверяем заполненность
        if (!customerName) {
            alert('Пожалуйста, введите ФИО клиента');
            nameInput.focus();
            return;
        }

        if (!phoneNumber) {
            alert('Пожалуйста, введите номер телефона');
            phoneInput.focus();
            return;
        }

        // 3. Проверяем товар
        if (!step5Data.productId) {
            alert('Ошибка: товар не выбран');
            return;
        }

        // 4. Подготавливаем данные С ПРОМОКОДОМ
        const orderData = {
            product_id: step5Data.productId,
            customer_name: customerName,
            phone_number: phoneNumber,
            prints: step5Data.prints || [],
            promocode: appliedPromocode ? appliedPromocode.code : null // ДОБАВЛЯЕМ ПРОМОКОД
        };

        console.log('Отправляю заказ JSON:', JSON.stringify(orderData, null, 2));
        console.log('Prints структура:', step5Data.prints);
        console.log('Промокод:', appliedPromocode ? appliedPromocode.code : 'не указан');

        // 5. Показываем загрузку
        const submitBtn = document.getElementById('submitOrderBtn');
        submitBtn.innerHTML = 'СОХРАНЯЕМ...';
        submitBtn.disabled = true;

        // 6. Отправляем на сервер с таймаутом (оставляем твою реализацию)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(API_URLS.createOrder, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(orderData),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('Статус ответа:', response.status, response.statusText);

        // 7. Сначала читаем как текст, чтобы посмотреть что пришло
        const responseText = await response.text();
        console.log('Ответ сервера (текст):', responseText.substring(0, 500));

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (jsonError) {
            console.error('Не могу распарсить JSON. Ответ сервера:', responseText);
            throw new Error(`Сервер вернул не JSON. Статус: ${response.status}. Ответ: ${responseText.substring(0, 200)}`);
        }

        console.log('Ответ сервера (JSON):', result);

        // 8. Обрабатываем ответ
        if (response.ok && result.success) {
            // Показываем экран успеха
            showSuccessScreen(result.order_number || result.order_id || '000001');
        } else {
            throw new Error(result.error || result.message || 'Неизвестная ошибка сервера');
        }

    } catch (error) {
        console.error('Ошибка создания заказа:', error);

        let errorMessage = 'Ошибка при создании заказа';
        if (error.name === 'AbortError') {
            errorMessage = 'Превышено время ожидания ответа сервера';
        } else if (error.message.includes('Не могу распарсить JSON')) {
            errorMessage = 'Сервер вернул ошибку. Проверьте консоль для подробностей.';
        } else {
            errorMessage = error.message;
        }

        alert(errorMessage);

        // Восстанавливаем кнопку
        const submitBtn = document.getElementById('submitOrderBtn');
        if (submitBtn) {
            submitBtn.innerHTML = 'ОФОРМИТЬ ЗАКАЗ';
            submitBtn.disabled = false;
        }
    }
}

// Функция показа экрана успеха
function showSuccessScreen(orderNumber) {
    console.log('Показываю экран успеха для заказа', orderNumber);

    // 1. Скрываем шаг 5
    document.getElementById('step5').style.display = 'none';

    // 2. Скрываем навигацию
    const navigation = document.querySelector('.navigation');
    if (navigation) navigation.style.display = 'none';

    // 3. Показываем экран успеха
    const successScreen = document.getElementById('successScreen');
    if (successScreen) {
        document.getElementById('orderNumberDisplay').textContent = orderNumber;
        successScreen.style.display = 'flex';
    } else {
        console.error('Экран успеха не найден');
    }
}

// Функция начала нового заказа
function startNewOrder() {
    console.log('=== startNewOrder() вызывается ===');

    // 1. Скрываем экран успеха
    const successScreen = document.getElementById('successScreen');
    if (successScreen) {
        successScreen.style.display = 'none';
    }

    // 2. Сбрасываем все данные
    resetOrderData();

    // 3. Показываем скринсейвер
    document.getElementById('screensaver').style.display = 'flex';
    document.getElementById('app').style.display = 'none';

    // 4. Восстанавливаем обработчик скринсейвера
    document.getElementById('screensaver').onclick = startApplication;

    console.log('Терминал готов к новому заказу');
}

// Функция сброса данных после успешного заказа
function resetOrderData() {
    console.log('=== resetOrderData() ВЫЗВАНА ===');

    try {
        // 1. Сбрасываем глобальные переменные
        currentStep = 1;
        selectedData = {
            product: null,
            color: null,
            size: null
        };

        orderPrints = {};
        selectedPrintElement = null;
        currentAreaId = null;
        currentAreaConfig = null;

        step5Data = {
            productId: null,
            productModel: null,
            productSize: null,
            productColor: null,
            prints: []
        };

        console.log('Глобальные переменные сброшены');

        // 2. Очищаем поля ввода шага 5
        const nameInput = document.getElementById('customerNameInput');
        const phoneInput = document.getElementById('customerPhoneInput');

        if (nameInput) {
            nameInput.value = '';
            console.log('Поле имени очищено');
        }
        if (phoneInput) {
            phoneInput.value = '';
            console.log('Поле телефона очищено');
        }

        // 3. Восстанавливаем кнопку оформления заказа
        const submitBtn = document.getElementById('submitOrderBtn');
        if (submitBtn) {
            submitBtn.innerHTML = 'ОФОРМИТЬ ЗАКАЗ';
            submitBtn.disabled = false;
            submitBtn.onclick = createOrder;
            console.log('Кнопка оформления заказа восстановлена');
        }

        // 4. Очищаем все контейнеры данных
        const containersToClear = [
            'productsContainer',
            'modelsContainer',
            'sizesContainer',
            'printsGallery',
            'currentPrintsList',
            'printAreasTabs',
            'productSideImageContainer',
            'printArea',
            'displayPrints',
            'displayProductModel',
            'displayProductColor',
            'displayProductSize'
        ];

        containersToClear.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '';
                console.log(`Контейнер #${id} очищен`);
            }
        });

        // 5. Сбрасываем визуальный выбор
        document.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // 6. Скрываем все шаги кроме 1-го
        document.querySelectorAll('.step-container').forEach((step, index) => {
            if (index === 0) {
                step.style.display = 'flex';
            } else {
                step.style.display = 'none';
            }
        });

        // 7. Обновляем навигацию
        updateNavigation();

        console.log('Все данные успешно сброшены');

    } catch (error) {
        console.error('Ошибка в resetOrderData:', error);
    }
}

// Функция получения CSRF токена для Django
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

//// Вспомогательная функция для установки текста в элемент
//function setText(elementId, text) {
//    const element = document.getElementById(elementId);
//    if (element) {
//        element.textContent = text;
//    } else {
//        console.log(`Элемент #${elementId} не найден`);
//    }
//}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализирую...');

    // 1. Находим кнопку оформления заказа
    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', createOrder);
        console.log('Обработчик установлен для кнопки оформления заказа');
    }

    // 2. Убедимся, что экран успеха скрыт
    const successScreen = document.getElementById('successScreen');
    if (successScreen) {
        successScreen.style.display = 'none';
    }

    // 3. Убедимся, что навигация видна
    const navigation = document.querySelector('.navigation');
    if (navigation) {
        navigation.style.display = 'flex';
    }
});

//===================
// ШАГ 5 ПРОМОКОД
//===================


// Проверка и применение промокода
async function checkPromocode() {
    console.log('=== checkPromocode() вызывается ===');

    const promocodeInput = document.getElementById('promocodeInput');
    const checkBtn = document.getElementById('checkPromocodeBtn');
    const messageEl = document.getElementById('promocodeMessage');

    if (!promocodeInput || !checkBtn || !messageEl) return;

    const code = promocodeInput.value.trim().toUpperCase();

    if (!code) {
        showPromocodeMessage('Введите промокод', 'error');
        return;
    }

    // Показываем загрузку
    checkBtn.innerHTML = 'ПРОВЕРКА...';
    checkBtn.disabled = true;
    showPromocodeMessage('Проверяем промокод...', 'info');

    try {
        const response = await fetch(API_URLS.checkPromocode, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ promocode: code })
        });

        const result = await response.json();

        if (response.ok && result.valid) {
            // Промокод действителен
            appliedPromocode = {
                code: result.code,
                discount: result.discount
            };

            showPromocodeMessage(result.message, 'success');

            // ВАЖНО: Правильно меняем кнопку
            checkBtn.innerHTML = 'УДАЛИТЬ';
            checkBtn.disabled = false;

            // Удаляем старый обработчик и добавляем новый
            checkBtn.replaceWith(checkBtn.cloneNode(true));
            const newBtn = document.getElementById('checkPromocodeBtn');
            newBtn.onclick = removePromocode;
            newBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ff5252)';

            // Обновляем сводку
            updateOrderSummary();

        } else {
            // Промокод недействителен
            showPromocodeMessage(result.message, 'error');
            appliedPromocode = null;
        }

    } catch (error) {
        console.error('Ошибка проверки промокода:', error);
        showPromocodeMessage('Ошибка соединения с сервером', 'error');
        appliedPromocode = null;
    } finally {
        // Восстанавливаем кнопку если промокод не применён
        if (!appliedPromocode) {
            checkBtn.innerHTML = 'ПРИМЕНИТЬ';
            checkBtn.disabled = false;
            checkBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        }
    }
}

// Функция для сообщений (убедись, что она есть)
function showPromocodeMessage(text, type = 'info') {
    const messageEl = document.getElementById('promocodeMessage');
    if (!messageEl) {
        console.error('Элемент promocodeMessage не найден!');
        return;
    }

    messageEl.textContent = text;
    messageEl.className = `promocode-message promocode-${type}`;
    console.log(`Показано сообщение: "${text}" (${type})`);

    // Автоочистка информационных сообщений
    if (type === 'info') {
        setTimeout(() => {
            if (messageEl.textContent === text) {
                messageEl.textContent = '';
                messageEl.className = 'promocode-message';
            }
        }, 3000);
    }
}

// Удаление применённого промокода
function removePromocode() {
    console.log('=== removePromocode() вызывается ===');

    const promocodeInput = document.getElementById('promocodeInput');
    const checkBtn = document.getElementById('checkPromocodeBtn');
    const messageEl = document.getElementById('promocodeMessage');

    // Очищаем поле
    if (promocodeInput) promocodeInput.value = '';

    // Очищаем сообщение
    if (messageEl) {
        messageEl.textContent = '';
        messageEl.className = 'promocode-message';
    }

    // Сбрасываем промокод
    appliedPromocode = null;

    // Восстанавливаем кнопку с новым обработчиком
    if (checkBtn) {
        checkBtn.innerHTML = 'ПРИМЕНИТЬ';
        checkBtn.disabled = false;
        checkBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';

        // ВАЖНО: Перепривязываем обработчик
        checkBtn.replaceWith(checkBtn.cloneNode(true));
        const newBtn = document.getElementById('checkPromocodeBtn');
        newBtn.onclick = checkPromocode;
    }

    // Обновляем сводку
    updateOrderSummary();

    showPromocodeMessage('Промокод удалён', 'info');
    console.log('Промокод удалён');
}

// Расчёт скидки (процентная)
function calculateDiscount(basePrice) {
    if (!appliedPromocode || !basePrice) return 0;

    // Процентная скидка
    return basePrice * (appliedPromocode.discount / 100);
}

// Отображение информации о промокоде
function updatePromoDisplay() {
    // Находим или создаём блок для промокода
    let promoDisplay = document.getElementById('promoDisplay');

    if (!promoDisplay) {
        const summaryContainer = document.querySelector('.summary-container') ||
                                document.getElementById('step5');

        if (summaryContainer) {
            promoDisplay = document.createElement('div');
            promoDisplay.id = 'promoDisplay';
            promoDisplay.className = 'promo-display';
            summaryContainer.appendChild(promoDisplay);
        }
    }

    if (promoDisplay) {
        if (appliedPromocode) {
            promoDisplay.innerHTML = `
                <div class="applied-promo">
                    <span>Промокод:</span>
                    <span class="promo-code">${appliedPromocode.code} (${appliedPromocode.discount}% скидка)</span>
                </div>
            `;
        } else {
            promoDisplay.innerHTML = '';
        }
    }
}