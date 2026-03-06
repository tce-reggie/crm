from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from django.views.decorators.http import require_POST
from django.utils import timezone
import json

from .models import (
    Product, PrintDesign, Order, OrderPrint, User, PromoCode, ProductPrintArea, EventsList, EventsProducts, EventsPrints, OrderAssignment
)

from django.db.models import Q
# =========================
# АВТОРИЗАЦИЯ (БЕЗ ХЭШИРОВАНИЯ)
# =========================

def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        try:
            user = User.objects.get(login=username, is_active=True)

            # Простое сравнение пароля в открытом виде
            if user.password == password:
                request.session['user_id'] = user.id
                request.session['employee_name'] = user.employee_name
                request.session['interface'] = user.interface
                request.session['login'] = user.login
                return redirect(user.get_interface_url())
            else:
                messages.error(request, 'Неверный пароль')
        except User.DoesNotExist:
            messages.error(request, 'Пользователь не найден')

    return render(request, 'login.html')

def logout_view(request):
    request.session.flush()
    return redirect('login')


# =========================
# ДЕКОРАТОР ДОСТУПА
# =========================

def interface_required(interface_name):
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            if request.session.get('interface') != interface_name:
                messages.error(request, 'Доступ запрещен')
                return redirect('login')
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

# =========================
# ИНТЕРФЕЙСЫ
# =========================

@interface_required('terminal')
def terminal_interface(request):
    """Главный интерфейс терминала - рендерит базовый шаблон"""
    return render(request, 'terminal/terminal.html', {
        'userlogin': request.session.get('login'),
    })

@interface_required('reception')
def reception_interface(request):
    """Главный интерфейс ресепшена"""
    return render(request, 'reception/reception_interface.html', {
        'userlogin': request.session.get('login'),
    })

@interface_required('printing')
def printing_interface(request):
    """Главный интерфейс печати"""
    return render(request, 'printing/printing_interface.html', {
        'userlogin': request.session.get('login'),
    })

@interface_required('admin')
def admin_interface(request):
    return render(request, 'admin/admin.html', {
        'user_login': request.session.get('login'),
    })

def user_paused_view(request):
    """Страница, показываемая при деактивации пользователя"""
    return render(request, 'user_paused.html')

# =========================
# API ENDPOINTS
# =========================
@csrf_exempt
def api_products(request):
    """Все доступные модели товаров с изображениями (с фильтрацией по активному мероприятию)"""
    try:
        unique_models_with_images = []

        # Получаем активное мероприятие
        active_event = EventsList.objects.filter(is_active=True).first()

        # ОБЪЯВЛЯЕМ ПЕРЕМЕННУЮ ЗДЕСЬ, чтобы она была доступна во всей функции
        event_products_ids = []

        if active_event:
            print(f"DEBUG: Активное мероприятие найдено: {active_event.event_name}")

            # Получаем все product_id для активного мероприятия
            event_products_ids = EventsProducts.objects.filter(
                event=active_event
            ).values_list('product__product_id', flat=True).distinct()

            print(f"DEBUG: Количество товаров в мероприятии: {len(event_products_ids)}")

            # Получаем модели товаров, которые есть в мероприятии и в наличии
            model_names = Product.objects.filter(
                product_id__in=event_products_ids,
                quantity__gt=0
            ).values_list('model', flat=True).distinct().order_by('model')

        else:
            print("DEBUG: Активное мероприятие не найдено, показываю все товары")
            # Если нет активного мероприятия, показываем все товары
            model_names = Product.objects.filter(
                quantity__gt=0
            ).values_list('model', flat=True).distinct().order_by('model')

        print(f"DEBUG: Найдено моделей для отображения: {len(model_names)}")

        for model_name in model_names:
            # Находим первый товар этой модели, который есть в активном мероприятии (если оно есть)
            query = Product.objects.filter(
                model=model_name,
                quantity__gt=0
            )

            # Если есть активное мероприятие, фильтруем по товарам мероприятия
            if active_event and event_products_ids:
                query = query.filter(product_id__in=event_products_ids)

            first_product = query.order_by('product_id').first()

            model_data = {
                'model': model_name,
                'image_url': None,
                'product_id': None,
                'color': None,
            }

            if first_product:
                model_data['product_id'] = first_product.product_id
                model_data['color'] = first_product.color

                # Ищем изображение
                if first_product.image_filename:
                    model_data['image_url'] = first_product.image_filename.url
                else:
                    # Ищем товар с изображением среди доступных для мероприятия
                    product_with_image_query = Product.objects.filter(
                        model=model_name,
                        quantity__gt=0
                    ).exclude(image_filename='')

                    if active_event and event_products_ids:
                        product_with_image_query = product_with_image_query.filter(
                            product_id__in=event_products_ids
                        )

                    product_with_image = product_with_image_query.order_by('product_id').first()

                    if product_with_image:
                        model_data['image_url'] = product_with_image.image_filename.url
                        model_data['color'] = product_with_image.color
                        model_data['product_id'] = product_with_image.product_id

            unique_models_with_images.append(model_data)

        return JsonResponse(unique_models_with_images, safe=False)

    except Exception as e:
        print(f"ERROR api_products: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

# ШАГ 2: ЦВЕТА ДЛЯ МОДЕЛИ
@csrf_exempt
def api_colors(request):
    """Цвета для выбранной модели с учетом активного мероприятия"""
    try:
        model_name = request.GET.get('model')
        if not model_name:
            return JsonResponse({'error': 'Название модели не указано'}, status=400)

        colors_data = []

        # Получаем активное мероприятие
        active_event = EventsList.objects.filter(is_active=True).first()

        # Базовый запрос
        query = Product.objects.filter(
            model=model_name,
            quantity__gt=0
        )

        # Если есть активное мероприятие, фильтруем по товарам мероприятия
        if active_event:
            event_products_ids = EventsProducts.objects.filter(
                event=active_event
            ).values_list('product__product_id', flat=True).distinct()
            query = query.filter(product_id__in=event_products_ids)

        # Получаем уникальные цвета для этой модели
        color_names = query.values_list('color', flat=True).distinct().order_by('color')

        for color_name in color_names:
            # Находим первый товар этого цвета
            product = query.filter(color=color_name).order_by('product_id').first()

            if product:
                colors_data.append({
                    'name': color_name,
                    'product_id': product.product_id,
                    'image_url': product.image_filename.url if product.image_filename else None
                })

        return JsonResponse(colors_data, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ШАГ 3: РАЗМЕРЫ ДЛЯ МОДЕЛИ И ЦВЕТА
@csrf_exempt
def api_sizes(request):
    """Размеры для выбранной модели и цвета с учетом активного мероприятия"""
    try:
        model_name = request.GET.get('model')
        color_name = request.GET.get('color')

        print(f"DEBUG api_sizes: Модель='{model_name}', Цвет='{color_name}'")

        if not model_name or not color_name:
            return JsonResponse({'error': 'Не указаны модель или цвет'}, status=400)

        # Получаем активное мероприятие
        active_event = EventsList.objects.filter(is_active=True).first()

        # Базовый запрос
        query = Product.objects.filter(
            model=model_name,
            color=color_name,
            quantity__gt=0
        )

        # Если есть активное мероприятие, фильтруем по товарам мероприятия
        if active_event:
            event_products_ids = EventsProducts.objects.filter(
                event=active_event
            ).values_list('product__product_id', flat=True).distinct()
            query = query.filter(product_id__in=event_products_ids)

        products = query.order_by('size')
        sizes_data = []
        for product in products:
            print(f"DEBUG: Найден товар ID={product.product_id}, размер={product.size}")
            sizes_data.append({
                'id': product.product_id,
                'size': product.size,
                'quantity': product.quantity,
                'image_url': product.image_filename.url if product.image_filename else None,
            })

        print(f"DEBUG: Отправляю {len(sizes_data)} размеров")
        return JsonResponse(sizes_data, safe=False)

    except Exception as e:
        print(f"ERROR api_sizes: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

# ШАГ 4: ПРИНТЫ И ЗОНЫ ПЕЧАТИ
@csrf_exempt
def api_prints(request):
    """Все доступные принты с учетом активного мероприятия"""
    try:
        print("=== DEBUG: api_prints вызывается ===")

        # Получаем активное мероприятие
        active_event = EventsList.objects.filter(is_active=True).first()
        print(f"DEBUG: Активное мероприятие: {active_event}")

        prints_data = []

        if active_event:
            print(f"DEBUG: Активное мероприятие найдено: {active_event.event_name}")

            # ВАЖНО: Используем print_design, а не print_design_id
            event_prints_ids = EventsPrints.objects.filter(
                event=active_event
            ).values_list('print_design_id', flat=True).distinct()  # Здесь должно быть print_design_id

            print(f"DEBUG: Найдено ID принтов в мероприятии: {list(event_prints_ids)}")

            if event_prints_ids:
                prints = PrintDesign.objects.filter(print_id__in=event_prints_ids).order_by('name')
                print(f"DEBUG: Найдено принтов в мероприятии: {prints.count()}")

                for p in prints:
                    prints_data.append({
                        'id': p.print_id,
                        'name': p.name,
                        'image_url': p.file_path.url if p.file_path else None,
                    })
            else:
                print(f"DEBUG: Для мероприятия '{active_event.event_name}' нет доступных принтов")
        else:
            print("DEBUG: Активное мероприятие не найдено, показываю все принты")
            prints = PrintDesign.objects.all().order_by('name')
            for p in prints:
                prints_data.append({
                    'id': p.print_id,
                    'name': p.name,
                    'image_url': p.file_path.url if p.file_path else None,
                })

        print(f"DEBUG: Отправляю {len(prints_data)} принтов")
        return JsonResponse(prints_data, safe=False)

    except Exception as e:
        print(f"ERROR api_prints: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse([], safe=False)

@csrf_exempt
def api_print_areas(request):
    """Зоны печати для конкретного товара (по product_id)"""
    try:
        product_id = request.GET.get('product_id')
        print(f"DEBUG api_print_areas: Запрос зон печати для product_id={product_id}")

        if not product_id:
            return JsonResponse({'error': 'ID продукта не указан'}, status=400)

        product = get_object_or_404(Product, product_id=product_id)
        areas = ProductPrintArea.objects.filter(product=product)

        areas_data = []
        for area in areas:
            areas_data.append({
                'id': area.area_id,
                'area_name': area.area_name,
                'width': float(area.width),
                'height': float(area.height),
                'max_prints': area.max_prints,
                'image_url': area.area_image.url if area.area_image else None,
                'offset_x': area.offset_x,
                'offset_y': area.offset_y,
            })

        print(f"DEBUG: Найдено {len(areas_data)} зон печати")
        return JsonResponse(areas_data, safe=False)
    except Exception as e:
        print(f"ERROR api_print_areas: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

# ШАГ 5
#======================================#
@csrf_exempt
def api_create_order(request):
    """Создание заказа с принтами"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Метод не разрешен'}, status=405)

    try:
        print("=== ПОЛУЧЕН ЗАПРОС НА СОЗДАНИЕ ЗАКАЗА ===")  # Отладка
        print("Тело запроса:", request.body)

        data = json.loads(request.body or '{}')
        print("Распарсенные данные:", json.dumps(data, indent=2, ensure_ascii=False))

    except json.JSONDecodeError:
        print("Ошибка парсинга JSON")
        return JsonResponse({'success': False, 'error': 'Неверный JSON'}, status=400)

    required = ['customer_name', 'phone_number', 'product_id']
    for field in required:
        if not data.get(field):
            print(f"Отсутствует обязательное поле: {field}")
            return JsonResponse({'success': False, 'error': f'Поле {field} обязательно'}, status=400)

    try:
        product = Product.objects.select_for_update().get(product_id=data['product_id'])
        print(f"Найден товар: {product}")
    except Product.DoesNotExist:
        print(f"Товар с ID {data['product_id']} не найден")
        return JsonResponse({'success': False, 'error': 'Товар не найден'}, status=400)

    if product.quantity <= 0:
        print(f"Товара нет в наличии: {product.quantity} шт.")
        return JsonResponse({'success': False, 'error': 'Нет в наличии'}, status=400)

    prints_payload = data.get('prints', [])
    print(f"Получено принтов: {len(prints_payload)}")

    try:
        with transaction.atomic():
            order = Order.objects.create(
                customer_name=data['customer_name'],
                phone_number=data['phone_number'],
                product=product,
                status='new'
            )
            print(f"Создан заказ: #{order.order_id}")

            # Промокод
            promocode_code = data.get('promocode')
            if promocode_code:
                try:
                    promo = PromoCode.objects.get(code=promocode_code, is_active=True)
                    order.promocode = promo
                    order.save()
                    print(f"Применен промокод: {promocode_code}")
                except PromoCode.DoesNotExist:
                    print(f"Промокод не найден: {promocode_code}")
                    pass

            # Уменьшаем остаток
            product.quantity -= 1
            product.save()
            print(f"Остаток товара уменьшен до: {product.quantity}")

            # Принты - ИСПРАВЛЕННАЯ ЧАСТЬ!
            for i, p in enumerate(prints_payload):
                print(f"Обрабатываю принт {i + 1}: {p}")

                try:
                    # Ключевое изменение: используем content вместо print_id
                    content = p.get('content', '')
                    area_id = p.get('area_id')

                    if not content or not area_id:
                        print(f"Пропускаю принт {i + 1}: нет content или area_id")
                        continue

                    # Для текстовых принтов content - это сам текст
                    # Для принтов из базы content может быть "prints/Название"

                    area = ProductPrintArea.objects.get(area_id=area_id, product=product)
                    print(f"Найдена зона печати: {area.area_name}")

                    # Создаем запись OrderPrint с content в поле print_design
                    OrderPrint.objects.create(
                        order=order,
                        print_design=content,  # Сохраняем content как есть
                        area=area,
                        position_x=p.get('position_x', p.get('x', 0)),
                        position_y=p.get('position_y', p.get('y', 0)),
                    )
                    print(f"Создан OrderPrint для принта: {content}")

                except ProductPrintArea.DoesNotExist:
                    print(f"Зона печати {area_id} не найдена для товара {product.product_id}")
                    continue
                except Exception as e:
                    print(f"Ошибка при создании OrderPrint: {str(e)}")
                    continue


            print(f"Заказ успешно создан. Номер: {order.order_id}")

        return JsonResponse({
            'success': True,
            'order_number': order.order_id,
            'order_id': order.order_id
        })

    except Exception as e:
        print(f"ОБЩАЯ ОШИБКА ПРИ СОЗДАНИИ ЗАКАЗА: {str(e)}")
        import traceback
        print(traceback.format_exc())

        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def check_promocode(request):
    """Проверка промокода (промокоды многоразовые)"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            promocode = data.get('promocode', '').strip().upper()

            if not promocode:
                return JsonResponse({
                    'valid': False,
                    'message': 'Введите промокод'
                })

            try:
                # Ищем активный промокод
                promo = PromoCode.objects.get(code=promocode, is_active=True)

                # Промокод найден и активен - возвращаем данные
                return JsonResponse({
                    'valid': True,
                    'code': promo.code,
                    'discount': float(promo.discount),
                    'message': f'Промокод применён! Скидка: {promo.discount}%'
                })

            except PromoCode.DoesNotExist:
                return JsonResponse({
                    'valid': False,
                    'message': 'Промокод не найден или неактивен'
                })

        except Exception as e:
            return JsonResponse({
                'valid': False,
                'message': f'Ошибка: {str(e)}'
            })

    return JsonResponse({'valid': False, 'message': 'Метод не разрешен'})

def get_promocodes(request):
    """Получение списка активных промокодов"""
    try:
        # Получаем только активные промокоды
        active_promos = PromoCode.objects.filter(
            is_active=True
        ).values('code', 'discount')[:100]  # Ограничиваем количество

        promocodes_list = list(active_promos)

        return JsonResponse({
            'success': True,
            'promocodes': promocodes_list,
            'count': len(promocodes_list)
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


# =========================
# RECEPTION API ENDPOINTS
# =========================

@csrf_exempt
def api_reception_orders(request):
    """Получение заказов для ресепшена с фильтрацией"""
    try:
        print("=== API_RECEPTION_ORDERS ===")

        # Получаем параметры
        status_filter = request.GET.get('status')
        search_query = request.GET.get('search', '').strip()

        print(f"Получено: status='{status_filter}', search='{search_query}'")

        # Начинаем запрос
        orders = Order.objects.all().select_related('product')

        # Ключевое исправление: 'all' - значит не фильтровать по статусу!
        if status_filter and status_filter != 'all':
            # Фильтруем только если указан конкретный статус, а не 'all'
            print(f"Применяю фильтр по статусу: '{status_filter}'")
            orders = orders.filter(status=status_filter)
        else:
            print("Показываю ВСЕ заказы (без фильтра по статусу)")

        print(f"После фильтра статуса: {orders.count()} заказов")

        # Поиск
        if search_query:
            from django.db.models import Q

            conditions = Q()
            conditions |= Q(customer_name__icontains=search_query)
            conditions |= Q(phone_number__icontains=search_query)

            # Поиск по ID
            try:
                if search_query.isdigit():
                    conditions |= Q(order_id=int(search_query))
                elif search_query.upper().startswith('ORD'):
                    num_part = search_query[3:].strip()
                    if num_part.isdigit():
                        conditions |= Q(order_id=int(num_part))
            except (ValueError, IndexError):
                pass

            orders = orders.filter(conditions)
            print(f"После поиска: {orders.count()} заказов")

        # Сортировка
        orders = orders.order_by('-created_date')[:100]

        print(f"Итого: {orders.count()} заказов")

        # Формируем ответ
        orders_data = []
        for order in orders:
            prints_count = OrderPrint.objects.filter(order=order).count()

            orders_data.append({
                'id': order.order_id,
                'order_number': f"ORD{order.order_id:06d}",
                'customer_name': order.customer_name,
                'phone_number': order.phone_number,
                'status': order.status,
                'status_display': order.get_status_display(),
                'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
                'product': {
                    'model': order.product.model,
                    'color': order.product.color,
                    'size': order.product.size,
                },
                'prints_count': prints_count,
            })

        return JsonResponse({
            'success': True,
            'orders': orders_data,
            'count': len(orders_data),
        })

    except Exception as e:
        print(f"ОШИБКА: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def api_reception_order_detail(request, order_id):
    """Получение деталей конкретного заказа"""
    try:
        order = get_object_or_404(
            Order.objects.select_related('product'),
            order_id=order_id
        )

        # Получаем принты
        prints = OrderPrint.objects.filter(order=order).select_related('area')

        order_data = {
            'id': order.order_id,
            'order_number': f"ORD{order.order_id:06d}",
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'status': order.status,
            'status_display': order.get_status_display(),
            'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
            'product': {
                'model': order.product.model,
                'color': order.product.color,
                'size': order.product.size,
            },
            'prints': [
                {
                    'id': op.order_print_id,
                    'content': op.print_design,
                    'area_name': op.area.area_name if op.area else 'Неизвестно',
                    'position_x': float(op.position_x),
                    'position_y': float(op.position_y),
                }
                for op in prints
            ],
        }

        return JsonResponse({
            'success': True,
            'order': order_data
        })

    except Exception as e:
        print(f"ERROR api_reception_order_detail: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def api_reception_confirm_order(request, order_id):
    """Подтверждение заказа оператором"""
    try:
        # 1. Получаем данные и заказ
        data = json.loads(request.body)
        order = get_object_or_404(Order, order_id=order_id)

        # 2. Проверяем авторизацию (аналогично примеру api_printing_complete_order)
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'Не авторизован'
            }, status=401)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Пользователь не найден'
            }, status=404)

        # 3. Проверяем, можно ли подтвердить заказ
        if order.status != 'new':
            return JsonResponse({
                'success': False,
                'error': f'Заказ уже имеет статус: {order.get_status_display()}'
            }, status=400)

        # 4. Обновляем статус заказа
        order.status = 'confirmed'
        order.save()

        # 5. Создаем запись в OrderAssignment
        current_time = timezone.now()

        OrderAssignment.objects.create(
            order=order,
            worker=user,
            interface='reception',  # Графа интерфейс
            status='completed',  # Статус выполнения
            started_at=current_time,  # Время начала
            finished_at=current_time,  # Время окончания (одинаковое с началом)
            notes='Автоматическое подтверждение приема заказа'
        )

        # Логируем действие
        print(f"Заказ #{order_id} подтвержден оператором {user.employee_name}. Запись в назначениях создана.")

        return JsonResponse({
            'success': True,
            'message': 'Заказ успешно подтвержден и назначен',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Неверный формат JSON'
        }, status=400)
    except Exception as e:
        print(f"ERROR api_reception_confirm_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_POST
def api_reception_cancel_order(request, order_id):
    """Отмена заказа оператором"""
    try:
        data = json.loads(request.body)
        cancel_reason = data.get('reason', 'Отменено оператором')

        order = get_object_or_404(Order, order_id=order_id)

        # Проверяем, можно ли отменить заказ
        if order.status not in ['new', 'confirmed']:
            return JsonResponse({
                'success': False,
                'error': f'Нельзя отменить заказ со статусом: {order.get_status_display()}'
            }, status=400)

        # Обновляем статус
        order.status = 'cancelled'
        order.save()

        # Можно добавить запись в лог с причиной отмены
        print(f"Заказ #{order_id} отменен. Причина: {cancel_reason}")

        return JsonResponse({
            'success': True,
            'message': 'Заказ успешно отменен',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

    except Exception as e:
        print(f"ERROR api_reception_cancel_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# =========================
# PRINTING API ENDPOINTS
# =========================

@csrf_exempt
def api_printing_get_new_order(request):
    """Получение нового заказа для печати"""
    try:
        # Получаем ID текущего пользователя
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Проверяем, есть ли у пользователя уже заказ в работе
        active_assignment = OrderAssignment.objects.filter(
            worker=user,
            status='in_progress',
            interface='print'
        ).first()

        if active_assignment:
            # У пользователя уже есть заказ в работе
            order = active_assignment.order
            prints = OrderPrint.objects.filter(order=order).select_related('area')

            order_data = {
                'id': order.order_id,
                'order_number': f"ORD{order.order_id:06d}",
                'customer_name': order.customer_name,
                'phone_number': order.phone_number,
                'status': 'printing',
                'status_display': 'В печати',
                'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
                'product': {
                    'id': order.product.product_id,
                    'model': order.product.model,
                    'color': order.product.color,
                    'size': order.product.size,
                },
                'prints': [
                    {
                        'id': op.order_print_id,
                        'content': op.get_print_display_url() if hasattr(op, 'get_print_display_url') else op.print_design,
                        'area_name': op.area.area_name if op.area else 'Неизвестно',
                        'position_x': float(op.position_x),
                        'position_y': float(op.position_y),
                    }
                    for op in prints
                ],
            }

            return JsonResponse({
                'success': True,
                'order': order_data,
                'worker_id': user_id,
                'assignment_id': active_assignment.assignment_id,
                'has_active_order': True
            })

        # Ищем заказ со статусом 'composed' без активных назначений на печать
        composed_orders = Order.objects.filter(
            status='confirmed'
        ).exclude(
            assignments__status='in_progress',
            assignments__interface='print'
        ).select_related('product').order_by('created_date')

        order = composed_orders.first()

        if not order:
            return JsonResponse({
                'success': False,
                'error': 'Нет доступных заказов'
            })

        # Создаем назначение заказа сотруднику (сразу in_progress)
        assignment = OrderAssignment.objects.create(
            order=order,
            worker=user,
            interface='print',
            status='in_progress'
        )

        # Меняем статус заказа на 'printing'
        order.status = 'printing'
        order.save()

        # Получаем принты для этого заказа
        prints = OrderPrint.objects.filter(order=order).select_related('area')

        order_data = {
            'id': order.order_id,
            'order_number': f"ORD{order.order_id:06d}",
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'status': 'printing',
            'status_display': 'В печати',
            'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
            'product': {
                'id': order.product.product_id,
                'model': order.product.model,
                'color': order.product.color,
                'size': order.product.size,
            },
            'prints': [
                {
                    'id': op.order_print_id,
                    'content': op.get_print_display_url() if hasattr(op, 'get_print_display_url') else op.print_design,
                    'area_name': op.area.area_name if op.area else 'Неизвестно',
                    'position_x': float(op.position_x),
                    'position_y': float(op.position_y),
                }
                for op in prints
            ],
        }

        return JsonResponse({
            'success': True,
            'order': order_data,
            'worker_id': user_id,
            'assignment_id': assignment.assignment_id,
            'has_active_order': True
        })

    except Exception as e:
        print(f"ERROR api_printing_get_new_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def api_printing_get_current_order(request):
    """Получение текущего заказа в работе у печатника"""
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Ищем заказ в работе у пользователя
        active_assignment = OrderAssignment.objects.filter(
            worker=user,
            status='in_progress',
            interface='print'
        ).select_related('order', 'order__product').first()

        if not active_assignment:
            return JsonResponse({'success': True, 'order': None})

        order = active_assignment.order
        prints = OrderPrint.objects.filter(order=order).select_related('area')

        order_data = {
            'id': order.order_id,
            'order_number': f"ORD{order.order_id:06d}",
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'status': 'printing',
            'status_display': 'В печати',
            'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
            'product': {
                'id': order.product.product_id,
                'model': order.product.model,
                'color': order.product.color,
                'size': order.product.size,
            },
            'prints': [
                {
                    'id': op.order_print_id,
                    'content': op.get_print_display_url() if hasattr(op, 'get_print_display_url') else op.print_design,
                    'area_name': op.area.area_name if op.area else 'Неизвестно',
                    'position_x': float(op.position_x),
                    'position_y': float(op.position_y),
                }
                for op in prints
            ],
        }

        return JsonResponse({
            'success': True,
            'order': order_data,
            'worker_id': user_id,
            'assignment_id': active_assignment.assignment_id
        })

    except Exception as e:
        print(f"ERROR api_printing_get_current_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def api_printing_complete_order(request, order_id):
    """Завершение печати заказа"""
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Ищем активное назначение
        assignment = OrderAssignment.objects.filter(
            order_id=order_id,
            worker=user,
            interface='print',
            status='in_progress'
        ).first()

        if not assignment:
            return JsonResponse({
                'success': False,
                'error': 'Заказ не находится у вас в работе'
            })

        # Завершаем работу успешно
        assignment.complete_work()

        # Меняем статус заказа на 'printed'
        order = assignment.order
        order.status = 'printed'
        order.save()

        print(f"Заказ #{order_id} напечатан сотрудником {user.employee_name}")

        return JsonResponse({
            'success': True,
            'message': 'Заказ успешно напечатан',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

    except Exception as e:
        print(f"ERROR api_printing_complete_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def api_printing_cancel_order(request, order_id):
    """Возврат заказа в очередь (отмена печати)"""
    try:
        data = json.loads(request.body)
        cancel_reason = data.get('reason', 'Возвращено печатником')

        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Ищем активное назначение
        assignment = OrderAssignment.objects.filter(
            order_id=order_id,
            worker=user,
            interface='print',
            status='in_progress'
        ).first()

        if not assignment:
            return JsonResponse({
                'success': False,
                'error': 'Заказ не находится у вас в работе'
            })

        # Отменяем работу
        assignment.cancel_work(notes=cancel_reason)

        # Возвращаем статус заказа на 'composed' (можно было бы вернуть и на 'confirmed')
        order = assignment.order
        order.status = 'composed'
        order.save()

        print(f"Заказ #{order_id} возвращен из печати сотрудником {user.employee_name}. Причина: {cancel_reason}")

        return JsonResponse({
            'success': True,
            'message': 'Заказ возвращен в очередь на печать',
            'new_status': order.status,
            'assignment_status': assignment.status
        })

    except Exception as e:
        print(f"ERROR api_printing_cancel_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def api_printing_get_zone_image(request):
    """Получение изображения зоны печати"""
    try:
        product_id = request.GET.get('product_id')
        area_name = request.GET.get('area_name')

        if not product_id or not area_name:
            return JsonResponse({'success': False, 'error': 'Не указаны параметры'})

        product = get_object_or_404(Product, product_id=product_id)
        area = get_object_or_404(ProductPrintArea, product=product, area_name=area_name)

        if area.area_image:
            return JsonResponse({
                'success': True,
                'image_url': area.area_image.url,
                'area_name': area.area_name,
                'width': area.width,
                'height': area.height
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'Изображение зоны не найдено'
            })

    except Exception as e:
        print(f"ERROR api_printing_get_zone_image: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


# =========================
# ТАБЛО API ENDPOINTS
# =========================

@csrf_exempt
def api_scoreboard_data(request):
    """Возвращает данные для табло: заказы в работе и готовые к выдаче"""
    try:
        # ЗАКАЗЫ В РАБОТЕ - через OrderAssignment
        in_progress_assignments = OrderAssignment.objects.filter(
            Q(status='in_progress', interface='print') |
            Q(status='completed', interface='reception')
        ).select_related('order', 'order__product', 'worker').order_by('started_at')[:10]

        in_progress_data = []
        for assignment in in_progress_assignments:
            order = assignment.order
            in_progress_data.append({
                'number': f"ORD{order.order_id:06d}",
                'id': order.order_id,
                'product': f"{order.product.model} {order.product.color} {order.product.size}",
                'customer': order.customer_name,  # Добавляем имя клиента
                'worker': assignment.worker.employee_name if assignment.worker else 'Неизвестно',
                'started': assignment.started_at.strftime('%H:%M') if assignment.started_at else '',
            })

        # ГОТОВЫЕ ЗАКАЗЫ (printed) - напрямую из Order
        ready_orders = Order.objects.filter(
            status='printed'  # Статус "Напечатан"
        ).select_related('product').order_by('-created_date')[:10]

        ready_data = []
        for order in ready_orders:
            ready_data.append({
                'number': f"ORD{order.order_id:06d}",
                'id': order.order_id,
                'product': f"{order.product.model} {order.product.color} {order.product.size}",
                'customer': order.customer_name,
            })

        return JsonResponse({
            'success': True,
            'in_progress': in_progress_data,
            'ready': ready_data,
        })

    except Exception as e:
        print(f"ERROR api_scoreboard_data: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@interface_required('scoreboard')
def scoreboard_interface(request):
    return render(request, 'scoreboard/scoreboard.html', {
        'userlogin': request.session.get('login'),
    })


# =========================
# DELIVERY (ВЫДАЧА) API ENDPOINTS
# =========================

@interface_required('delivery')
def delivery_interface(request):
    """Главный интерфейс выдачи"""
    return render(request, 'delivery/delivery_interface.html', {
        'userlogin': request.session.get('login'),
    })


@csrf_exempt
def api_delivery_orders(request):
    """Получение заказов для выдачи (статус 'printed')"""
    try:
        print("=== API_DELIVERY_ORDERS ===")

        # Получаем параметры поиска
        search_query = request.GET.get('search', '').strip()

        # Базовый запрос - заказы со статусом 'printed' (Напечатан)
        orders = Order.objects.filter(
            status='printed'
        ).select_related('product').order_by('-created_date')

        # Поиск
        if search_query:
            from django.db.models import Q

            conditions = Q()
            conditions |= Q(customer_name__icontains=search_query)
            conditions |= Q(phone_number__icontains=search_query)

            # Поиск по номеру заказа (ORDxxxxxx)
            try:
                if search_query.isdigit():
                    conditions |= Q(order_id=int(search_query))
                elif search_query.upper().startswith('ORD'):
                    num_part = search_query[3:].strip()
                    if num_part.isdigit():
                        conditions |= Q(order_id=int(num_part))
            except (ValueError, IndexError):
                pass

            orders = orders.filter(conditions)

        # Формируем ответ
        orders_data = []
        for order in orders:
            # Получаем информацию о том, кто печатал заказ
            printing_assignment = OrderAssignment.objects.filter(
                order=order,
                interface='print',
                status='completed'
            ).first()

            orders_data.append({
                'id': order.order_id,
                'order_number': f"ORD{order.order_id:06d}",
                'customer_name': order.customer_name,
                'phone_number': order.phone_number,
                'status': order.status,
                'status_display': 'Готов к выдаче',  # Показываем как "Готов к выдаче"
                'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
                'product': {
                    'model': order.product.model,
                    'color': order.product.color,
                    'size': order.product.size,
                },
                'printed_by': printing_assignment.worker.employee_name if printing_assignment else 'Неизвестно',
            })

        return JsonResponse({
            'success': True,
            'orders': orders_data,
            'count': len(orders_data),
        })

    except Exception as e:
        print(f"ОШИБКА api_delivery_orders: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_POST
def api_delivery_complete_order(request, order_id):
    """Выдача заказа клиенту (меняет статус с 'printed' на 'done')"""
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)
        order = get_object_or_404(Order, order_id=order_id)

        # Проверяем, можно ли выдать заказ (только статус 'printed')
        if order.status != 'printed':
            return JsonResponse({
                'success': False,
                'error': f'Заказ нельзя выдать. Текущий статус: {order.get_status_display()}. Должен быть "Напечатан".'
            }, status=400)

        with transaction.atomic():
            # Меняем статус заказа на 'done' (Завершен)
            order.status = 'done'
            order.save()

            current_time = timezone.now()

            # Создаем запись в OrderAssignment о выдаче
            assignment = OrderAssignment.objects.create(
                order=order,
                worker=user,
                interface='delivery',
                status='completed',  # Сразу завершен
                started_at=current_time,  # Устанавливаем время начала
                finished_at=current_time,  # Устанавливаем время окончания (совпадает с началом)
                notes=f"Заказ выдан клиенту. Время выдачи: {current_time.strftime('%d.%m.%Y %H:%M')}"
            )

            print(f"Заказ #{order_id} выдан клиенту сотрудником {user.employee_name}")
            print(f"Время начала и окончания: {current_time}")

        return JsonResponse({
            'success': True,
            'message': 'Заказ успешно выдан',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

    except Exception as e:
        print(f"ERROR api_delivery_complete_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)



@csrf_exempt
def api_check_user_status(request):
    """Проверка статуса пользователя для автоперезагрузки"""
    try:
        user_id = request.session.get('user_id')

        if user_id:
            user = User.objects.get(id=user_id)
            return JsonResponse({
                'success': True,
                'is_active': user.is_active,
                'interface': user.interface
            })
        else:
            return JsonResponse({
                'success': True,
                'is_active': False,
                'reason': 'not_authenticated'
            })

    except User.DoesNotExist:
        return JsonResponse({
            'success': True,
            'is_active': False,
            'reason': 'user_not_found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# =========================
# ADMIN INTERFACE API
# =========================

@interface_required('admin')
def admin_interface(request):
    """Главный интерфейс администратора"""
    return render(request, 'admin/admin_interface.html', {
        'userlogin': request.session.get('login'),
    })

# ================== ЗАКАЗЫ ==================

@csrf_exempt
def api_admin_orders(request):
    """Получение всех заказов с фильтрацией"""
    try:
        status_filter = request.GET.get('status', '')
        search_query = request.GET.get('search', '').strip()
        date_from = request.GET.get('date_from', '')
        date_to = request.GET.get('date_to', '')

        print(f"Фильтры: date_from={date_from}, date_to={date_to}")  # Отладка

        # Получаем все заказы с необходимыми связями
        orders = Order.objects.all().select_related(
            'product',
            'promocode'
        ).prefetch_related(
            'assignments',
            'assignments__worker'
        ).order_by('-created_date')

        # Фильтр по статусу
        if status_filter and status_filter != 'all':
            orders = orders.filter(status=status_filter)

        # Поиск по имени, телефону или номеру заказа
        if search_query:
            from django.db.models import Q
            conditions = Q()
            conditions |= Q(customer_name__icontains=search_query)
            conditions |= Q(phone_number__icontains=search_query)

            # Поиск по номеру заказа (ORDxxxxxx)
            try:
                if search_query.isdigit():
                    conditions |= Q(order_id=int(search_query))
                elif search_query.upper().startswith('ORD'):
                    num_part = search_query[3:].strip()
                    if num_part.isdigit():
                        conditions |= Q(order_id=int(num_part))
            except (ValueError, IndexError):
                pass

            orders = orders.filter(conditions)

        # ФИЛЬТРАЦИЯ ПО ДАТАМ (ИСПРАВЛЕНО)
        if date_from and date_to:
            # Обе даты указаны - диапазон между ними
            from datetime import datetime
            try:
                # Преобразуем строки в объекты даты
                start_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                end_date = datetime.strptime(date_to, '%Y-%m-%d').date()

                # Фильтруем заказы, созданные между start_date и end_date (включительно)
                orders = orders.filter(
                    created_date__date__gte=start_date,
                    created_date__date__lte=end_date
                )
                print(f"Фильтр по диапазону: от {start_date} до {end_date}")

            except Exception as e:
                print(f"Ошибка парсинга дат: {e}")

        elif date_from:
            # Только начальная дата - все заказы после этой даты (включительно)
            from datetime import datetime
            try:
                start_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                orders = orders.filter(created_date__date__gte=start_date)
                print(f"Фильтр от даты: {start_date} и позже")

            except Exception as e:
                print(f"Ошибка парсинга начальной даты: {e}")

        elif date_to:
            # Только конечная дата - все заказы до этой даты (включительно)
            from datetime import datetime
            try:
                end_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                orders = orders.filter(created_date__date__lte=end_date)
                print(f"Фильтр до даты: {end_date} и раньше")

            except Exception as e:
                print(f"Ошибка парсинга конечной даты: {e}")

        orders_data = []
        for order in orders:
            # Количество принтов
            prints_count = OrderPrint.objects.filter(order=order).count()

            # Текущий работник (активное назначение)
            active_assignment = order.assignments.filter(status='in_progress').first()
            current_worker = None
            current_stage = None

            if active_assignment and active_assignment.worker:
                current_worker = active_assignment.worker.employee_name
                current_stage = active_assignment.get_interface_display()

            orders_data.append({
                'id': order.order_id,
                'order_number': f"ORD{order.order_id:06d}",
                'customer_name': order.customer_name,
                'phone_number': order.phone_number,
                'status': order.status,
                'status_display': order.get_status_display(),
                'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
                'product': {
                    'model': order.product.model,
                    'color': order.product.color,
                    'size': order.product.size,
                },
                'promocode': order.promocode.code if order.promocode else None,
                'prints_count': prints_count,
                'current_worker': current_worker,
                'current_stage': current_stage,
            })

        return JsonResponse({
            'success': True,
            'orders': orders_data,
            'count': len(orders_data),
            'filters': {  # Для отладки
                'date_from': date_from,
                'date_to': date_to
            }
        })

    except Exception as e:
        print(f"ERROR api_admin_orders: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
def api_admin_order_detail(request, order_id):
    """Детали конкретного заказа"""
    try:
        order = get_object_or_404(Order.objects.select_related('product', 'promocode'), order_id=order_id)
        prints = OrderPrint.objects.filter(order=order).select_related('area')
        assignments = OrderAssignment.objects.filter(order=order).select_related('worker').order_by('-started_at')

        order_data = {
            'id': order.order_id,
            'order_number': f"ORD{order.order_id:06d}",
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'status': order.status,
            'status_display': order.get_status_display(),
            'created_date': order.created_date.strftime('%d.%m.%Y %H:%M'),
            'product': {
                'id': order.product.product_id,
                'model': order.product.model,
                'color': order.product.color,
                'size': order.product.size,
            },
            'promocode': order.promocode.code if order.promocode else None,
            'discount': float(order.promocode.discount) if order.promocode else 0,
            'prints': [
                {
                    'id': p.order_print_id,
                    'content': p.print_design,
                    'area_name': p.area.area_name if p.area else 'Неизвестно',
                    'position_x': float(p.position_x),
                    'position_y': float(p.position_y),
                } for p in prints
            ],
            'history': [
                {
                    'stage': a.get_interface_display(),
                    'worker': a.worker.employee_name if a.worker else 'Система',
                    'status': a.get_status_display(),
                    'started': a.started_at.strftime('%d.%m.%Y %H:%M'),
                    'finished': a.finished_at.strftime('%d.%m.%Y %H:%M') if a.finished_at else None,
                    'duration': round(a.get_duration(), 1) if a.get_duration() else None,
                    'notes': a.notes,
                } for a in assignments
            ]
        }

        return JsonResponse({'success': True, 'order': order_data})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_update_order_status(request, order_id):
    """Изменение статуса заказа"""
    try:
        data = json.loads(request.body)
        new_status = data.get('status')
        reason = data.get('reason', '')

        if not new_status:
            return JsonResponse({'success': False, 'error': 'Статус не указан'})

        valid_statuses = [s[0] for s in Order.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return JsonResponse({'success': False, 'error': 'Неверный статус'})

        order = get_object_or_404(Order, order_id=order_id)
        old_status = order.status
        order.status = new_status
        order.save()

        # Логируем изменение
        print(f"Администратор изменил статус заказа #{order_id}: {old_status} -> {new_status}. Причина: {reason}")

        return JsonResponse({
            'success': True,
            'message': 'Статус обновлен',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_order(request, order_id):
    """Удаление заказа"""
    try:
        order = get_object_or_404(Order, order_id=order_id)
        order_number = f"ORD{order.order_id:06d}"

        # Удаляем связанные записи
        OrderPrint.objects.filter(order=order).delete()
        OrderAssignment.objects.filter(order=order).delete()
        order.delete()

        return JsonResponse({
            'success': True,
            'message': f'Заказ {order_number} удален'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_all_orders(request):
    """Удаление всех заказов"""
    try:
        data = json.loads(request.body)
        keep_prints = data.get('keep_prints', False)  # Сохранять ли нанесения?

        with transaction.atomic():
            if keep_prints:
                # Удаляем только заказы, но сохраняем принты? (логика уточняется)
                OrderPrint.objects.all().delete()
                OrderAssignment.objects.all().delete()
                Order.objects.all().delete()
            else:
                # Полная очистка
                OrderPrint.objects.all().delete()
                OrderAssignment.objects.all().delete()
                Order.objects.all().delete()

        return JsonResponse({
            'success': True,
            'message': 'Все заказы удалены'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_create_order(request):
    """Создание заказа администратором"""
    try:
        data = json.loads(request.body)

        required = ['customer_name', 'phone_number', 'product_id']
        for field in required:
            if not data.get(field):
                return JsonResponse({'success': False, 'error': f'Поле {field} обязательно'})

        product = get_object_or_404(Product, product_id=data['product_id'])

        with transaction.atomic():
            order = Order.objects.create(
                customer_name=data['customer_name'],
                phone_number=data['phone_number'],
                product=product,
                status='new'  # Создаем как новый
            )

            if data.get('promocode'):
                try:
                    promo = PromoCode.objects.get(code=data['promocode'], is_active=True)
                    order.promocode = promo
                    order.save()
                except PromoCode.DoesNotExist:
                    pass

            # Если нужно сразу изменить статус
            if data.get('initial_status'):
                order.status = data['initial_status']
                order.save()

        return JsonResponse({
            'success': True,
            'order_id': order.order_id,
            'order_number': f"ORD{order.order_id:06d}",
            'message': 'Заказ создан'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ================== ИЗДЕЛИЯ ==================

@csrf_exempt
def api_admin_products(request):
    """Получение списка всех изделий"""
    try:
        products = Product.objects.all().order_by('model', 'color', 'size')
        products_data = []

        for p in products:
            # Количество заказов с этим товаром
            orders_count = Order.objects.filter(product=p).count()
            # Зоны печати
            areas_count = ProductPrintArea.objects.filter(product=p).count()

            products_data.append({
                'id': p.product_id,
                'model': p.model,
                'color': p.color,
                'size': p.size,
                'quantity': p.quantity,
                'image': p.image_filename.url if p.image_filename else None,
                'orders_count': orders_count,
                'areas_count': areas_count,
            })

        return JsonResponse({
            'success': True,
            'products': products_data,
            'count': len(products_data)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_add_product(request):
    """Добавление нового изделия"""
    try:
        data = json.loads(request.body)

        required = ['model', 'color', 'size', 'quantity']
        for field in required:
            if not data.get(field):
                return JsonResponse({'success': False, 'error': f'Поле {field} обязательно'})

        # Проверяем уникальность
        existing = Product.objects.filter(
            model=data['model'],
            color=data['color'],
            size=data['size']
        ).first()

        if existing:
            # Обновляем количество
            existing.quantity += int(data['quantity'])
            existing.save()
            message = f'Количество обновлено. Теперь: {existing.quantity}'
        else:
            # Создаем новый
            product = Product.objects.create(
                model=data['model'],
                color=data['color'],
                size=data['size'],
                quantity=int(data['quantity'])
            )
            message = 'Изделие добавлено'

        return JsonResponse({'success': True, 'message': message})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_product(request, product_id):
    """Удаление изделия"""
    try:
        product = get_object_or_404(Product, product_id=product_id)

        # Проверяем, есть ли связанные заказы
        orders_count = Order.objects.filter(product=product).count()
        if orders_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Нельзя удалить: есть {orders_count} связанных заказов'
            })

        product.delete()

        return JsonResponse({
            'success': True,
            'message': 'Изделие удалено'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_all_products(request):
    """Удаление всех изделий"""
    try:
        # Проверяем, есть ли заказы
        orders_count = Order.objects.count()
        if orders_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Сначала удалите все заказы ({orders_count} шт.)'
            })

        ProductPrintArea.objects.all().delete()
        Product.objects.all().delete()

        return JsonResponse({
            'success': True,
            'message': 'Все изделия удалены'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_update_product_quantity(request, product_id):
    """Изменение количества изделия"""
    try:
        data = json.loads(request.body)
        new_quantity = data.get('quantity')

        if new_quantity is None or int(new_quantity) < 0:
            return JsonResponse({'success': False, 'error': 'Некорректное количество'})

        product = get_object_or_404(Product, product_id=product_id)
        old_quantity = product.quantity
        product.quantity = int(new_quantity)
        product.save()

        return JsonResponse({
            'success': True,
            'message': f'Количество изменено: {old_quantity} → {product.quantity}',
            'new_quantity': product.quantity
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ================== ПРИНТЫ ==================

@csrf_exempt
def api_admin_prints(request):
    """Получение списка всех принтов"""
    try:
        prints = PrintDesign.objects.all().order_by('name')
        prints_data = []

        for p in prints:
            # Сколько раз использован
            usage_count = OrderPrint.objects.filter(print_design=p.name).count()

            prints_data.append({
                'id': p.print_id,
                'name': p.name,
                'file': p.file_path.url if p.file_path else None,
                'usage_count': usage_count,
            })

        return JsonResponse({
            'success': True,
            'prints': prints_data,
            'count': len(prints_data)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_add_print(request):
    """Добавление нового принта"""
    try:
        name = request.POST.get('name')
        file = request.FILES.get('file')

        if not name:
            return JsonResponse({'success': False, 'error': 'Название обязательно'})

        # Проверяем уникальность
        existing = PrintDesign.objects.filter(name=name).first()
        if existing:
            return JsonResponse({'success': False, 'error': 'Принт с таким названием уже существует'})

        print_design = PrintDesign.objects.create(
            name=name,
            file_path=file
        )

        return JsonResponse({
            'success': True,
            'message': 'Принт добавлен',
            'print_id': print_design.print_id
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_print(request, print_id):
    """Удаление принта"""
    try:
        print_design = get_object_or_404(PrintDesign, print_id=print_id)

        # Проверяем, используется ли
        usage_count = OrderPrint.objects.filter(print_design=print_design.name).count()
        if usage_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Принт используется в {usage_count} заказах'
            })

        print_design.delete()

        return JsonResponse({
            'success': True,
            'message': 'Принт удален'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_all_prints(request):
    """Удаление всех принтов"""
    try:
        usage_count = OrderPrint.objects.count()
        if usage_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Сначала удалите заказы с принтами ({usage_count} шт.)'
            })

        PrintDesign.objects.all().delete()

        return JsonResponse({
            'success': True,
            'message': 'Все принты удалены'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ================== СОТРУДНИКИ ==================

@csrf_exempt
def api_admin_users(request):
    """Получение списка сотрудников"""
    try:
        users = User.objects.all().order_by('interface', 'employee_name')
        users_data = []

        for u in users:
            # Текущая активность
            active_assignment = OrderAssignment.objects.filter(
                worker=u,
                status='in_progress'
            ).first()

            # Статистика за сегодня
            today = timezone.now().date()
            today_assignments = OrderAssignment.objects.filter(
                worker=u,
                started_at__date=today,
                status='completed'
            )

            completed_count = today_assignments.count()
            total_time = sum([a.get_duration() or 0 for a in today_assignments])

            users_data.append({
                'id': u.id,
                'login': u.login,
                'employee_name': u.employee_name,
                'interface': u.interface,
                'interface_display': u.get_interface_display(),
                'is_active': u.is_active,
                'created_at': u.created_at.strftime('%d.%m.%Y'),
                'current_order': active_assignment.order.order_id if active_assignment else None,
                'current_order_number': f"ORD{active_assignment.order.order_id:06d}" if active_assignment else None,
                'today_completed': completed_count,
                'today_avg_time': round(total_time / completed_count, 1) if completed_count > 0 else 0,
            })

        return JsonResponse({
            'success': True,
            'users': users_data,
            'count': len(users_data)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_add_user(request):
    """Добавление нового сотрудника"""
    try:
        data = json.loads(request.body)

        required = ['login', 'password', 'employee_name', 'interface']
        for field in required:
            if not data.get(field):
                return JsonResponse({'success': False, 'error': f'Поле {field} обязательно'})

        # Проверяем уникальность логина
        existing = User.objects.filter(login=data['login']).first()
        if existing:
            return JsonResponse({'success': False, 'error': 'Логин уже занят'})

        user = User.objects.create(
            login=data['login'],
            password=data['password'],  # В открытом виде как в вашей системе
            employee_name=data['employee_name'],
            interface=data['interface'],
            is_active=data.get('is_active', True)
        )

        return JsonResponse({
            'success': True,
            'message': 'Сотрудник добавлен',
            'user_id': user.id
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_user(request, user_id):
    """Удаление сотрудника"""
    try:
        user = get_object_or_404(User, id=user_id)

        # Проверяем, есть ли активные назначения
        active = OrderAssignment.objects.filter(worker=user, status='in_progress').exists()
        if active:
            return JsonResponse({
                'success': False,
                'error': 'У сотрудника есть активные заказы'
            })

        user.delete()

        return JsonResponse({
            'success': True,
            'message': 'Сотрудник удален'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_toggle_user_active(request, user_id):
    """Активация/деактивация сотрудника"""
    try:
        user = get_object_or_404(User, id=user_id)

        # Нельзя деактивировать себя
        if user.id == request.session.get('user_id'):
            return JsonResponse({
                'success': False,
                'error': 'Нельзя деактивировать себя'
            })

        user.is_active = not user.is_active
        user.save()

        return JsonResponse({
            'success': True,
            'message': f'Сотрудник {"активирован" if user.is_active else "деактивирован"}',
            'is_active': user.is_active
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ================== СТАТИСТИКА ==================

@csrf_exempt
def api_admin_statistics(request):
    """Получение статистики и информации о состоянии"""
    try:
        now = timezone.now()
        today = now.date()

        # ===== ОБЩАЯ СТАТИСТИКА =====
        total_orders = Order.objects.count()
        new_orders = Order.objects.filter(status='new').count()
        confirmed_orders = Order.objects.filter(status='confirmed').count()
        composed_orders = Order.objects.filter(status='composed').count()
        printing_orders = Order.objects.filter(status='printing').count()
        printed_orders = Order.objects.filter(status='printed').count()
        completed_orders = Order.objects.filter(status='done').count()
        cancelled_orders = Order.objects.filter(status='cancelled').count()

        # Сегодняшние заказы
        today_orders = Order.objects.filter(created_date__date=today).count()
        today_completed = Order.objects.filter(
            status='done',
            created_date__date=today
        ).count()

        # ===== РАЗМЕР ОЧЕРЕДЕЙ =====
        queue_reception = Order.objects.filter(status='new').count()
        queue_composing = Order.objects.filter(status='confirmed').count()
        queue_printing = Order.objects.filter(status='composed').count()
        queue_delivery = Order.objects.filter(status='printed').count()

        # ===== ПРОИЗВОДИТЕЛЬНОСТЬ =====
        # Среднее время от оформления до выдачи
        completed_orders_with_time = Order.objects.filter(
            status='done'
        ).select_related('product')

        total_time = 0
        count_with_time = 0

        performance_data = []
        workers_stats = {}

        # Собираем статистику по сотрудникам
        assignments = OrderAssignment.objects.filter(
            status='completed'
        ).select_related('worker', 'order').order_by('-finished_at')[:1000]

        for a in assignments:
            worker_name = a.worker.employee_name if a.worker else 'Неизвестно'
            if worker_name not in workers_stats:
                workers_stats[worker_name] = {
                    'role': a.get_interface_display() if a.interface else 'Неизвестно',
                    'completed': 0,
                    'total_time': 0,
                    'items': []
                }

            stats = workers_stats[worker_name]
            stats['completed'] += 1
            duration = a.get_duration() or 0
            stats['total_time'] += duration

            # Для расчета среднего времени изделия
            if a.order and a.order.status == 'done':
                order_time = (a.order.created_date - a.order.created_date).total_seconds() / 60
                stats['items'].append({
                    'order_id': a.order.order_id,
                    'time': order_time
                })

        # Формируем таблицу производительности
        for worker_name, stats in workers_stats.items():
            avg_time_per_item = stats['total_time'] / stats['completed'] if stats['completed'] > 0 else 0
            items_per_hour = 60 / avg_time_per_item if avg_time_per_item > 0 else 0

            performance_data.append({
                'worker': worker_name,
                'role': stats['role'],
                'completed': stats['completed'],
                'avg_time': round(avg_time_per_item, 1),
                'items_per_hour': round(items_per_hour, 1),
            })

        # Сортируем по количеству выполненных
        performance_data.sort(key=lambda x: x['completed'], reverse=True)

        # ===== ИЗГОТОВЛЕННЫЕ НАНЕСЕНИЯ =====
        total_prints = OrderPrint.objects.count()
        today_prints = OrderPrint.objects.filter(order__created_date__date=today).count()

        return JsonResponse({
            'success': True,
            'general': {
                'total_orders': total_orders,
                'new': new_orders,
                'confirmed': confirmed_orders,
                'composed': composed_orders,
                'printing': printing_orders,
                'printed': printed_orders,
                'completed': completed_orders,
                'cancelled': cancelled_orders,
                'today_orders': today_orders,
                'today_completed': today_completed,
                'total_prints': total_prints,
                'today_prints': today_prints,
            },
            'queues': {
                'reception': queue_reception,
                'composing': queue_composing,
                'printing': queue_printing,
                'delivery': queue_delivery,
                'total': queue_reception + queue_composing + queue_printing + queue_delivery
            },
            'performance': performance_data,
            'timestamp': now.strftime('%d.%m.%Y %H:%M:%S')
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ================== УПРАВЛЕНИЕ СЕССИЕЙ ==================

@csrf_exempt
@require_POST
def api_admin_stop_session(request):
    """Остановка сессии - все пользователи в паузу"""
    try:
        # Деактивируем всех пользователей кроме администраторов
        User.objects.exclude(interface='admin').update(is_active=False)

        return JsonResponse({
            'success': True,
            'message': 'Сессия остановлена. Все пользователи переведены в режим паузы.'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_resume_session(request):
    """Продолжение сессии - активация всех пользователей"""
    try:
        # Активируем всех пользователей
        User.objects.all().update(is_active=True)

        return JsonResponse({
            'success': True,
            'message': 'Сессия продолжена. Все пользователи активированы.'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_restart_session(request):
    """Перезапуск сессии - удаление всех заказов"""
    try:
        data = json.loads(request.body)
        keep_prints = data.get('keep_prints', False)

        with transaction.atomic():
            # Удаляем все назначения
            OrderAssignment.objects.all().delete()

            if keep_prints:
                # Удаляем заказы, но сохраняем принты? (зависит от логики)
                OrderPrint.objects.all().delete()
                Order.objects.all().delete()
            else:
                # Полная очистка
                OrderPrint.objects.all().delete()
                Order.objects.all().delete()

            # Активируем всех пользователей
            User.objects.all().update(is_active=True)

        return JsonResponse({
            'success': True,
            'message': f'Сессия перезапущена. Все заказы удалены. Нанесения {"сохранены" if keep_prints else "удалены"}.'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_print_session_label(request):
    """Печать служебной наклейки с номером сессии и заданием"""
    try:
        data = json.loads(request.body)
        task_description = data.get('task', '')

        # Генерируем номер сессии (можно использовать timestamp)
        from datetime import datetime
        session_number = datetime.now().strftime('%Y%m%d%H%M%S')

        # Возвращаем данные для печати
        return JsonResponse({
            'success': True,
            'session_number': session_number,
            'task': task_description,
            'print_data': {
                'session': session_number,
                'task': task_description,
                'timestamp': datetime.now().strftime('%d.%m.%Y %H:%M:%S')
            }
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# =========================
# ADMIN EVENTS API ENDPOINTS
# =========================

@csrf_exempt
def api_admin_events(request):
    """Получение списка всех мероприятий"""
    try:
        events = EventsList.objects.all().order_by('-is_active', 'event_name')
        events_data = []

        for e in events:
            events_data.append({
                'id': e.id,
                'event_name': e.event_name,
                'is_active': e.is_active,
            })

        return JsonResponse({
            'success': True,
            'events': events_data,
            'count': len(events_data)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_add_event(request):
    """Добавление нового мероприятия"""
    try:
        data = json.loads(request.body)
        event_name = data.get('event_name', '').strip()
        is_active = data.get('is_active', False)

        if not event_name:
            return JsonResponse({'success': False, 'error': 'Название мероприятия обязательно'})

        # Проверяем уникальность
        existing = EventsList.objects.filter(event_name=event_name).first()
        if existing:
            return JsonResponse({'success': False, 'error': 'Мероприятие с таким названием уже существует'})

        # Создаем мероприятие
        event = EventsList.objects.create(
            event_name=event_name,
            is_active=is_active
        )

        return JsonResponse({
            'success': True,
            'message': f'Мероприятие "{event_name}" добавлено',
            'event_id': event.id
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_update_event(request, event_id):
    """Обновление мероприятия"""
    try:
        data = json.loads(request.body)
        event_name = data.get('event_name', '').strip()
        is_active = data.get('is_active', False)

        if not event_name:
            return JsonResponse({'success': False, 'error': 'Название мероприятия обязательно'})

        event = get_object_or_404(EventsList, id=event_id)

        # Проверяем уникальность названия
        existing = EventsList.objects.filter(event_name=event_name).exclude(id=event_id).first()
        if existing:
            return JsonResponse({'success': False, 'error': 'Мероприятие с таким названием уже существует'})

        old_name = event.event_name
        event.event_name = event_name
        event.is_active = is_active
        event.save()

        return JsonResponse({
            'success': True,
            'message': f'Мероприятие "{old_name}" обновлено'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_set_active_event(request, event_id):
    """Установить мероприятие активным"""
    try:
        event = get_object_or_404(EventsList, id=event_id)

        # Деактивируем все мероприятия
        EventsList.objects.exclude(id=event_id).update(is_active=False)

        # Активируем выбранное
        event.is_active = True
        event.save()

        return JsonResponse({
            'success': True,
            'message': f'Мероприятие "{event.event_name}" активировано'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_delete_event(request, event_id):
    """Удаление мероприятия"""
    try:
        event = get_object_or_404(EventsList, id=event_id)

        # Проверяем, есть ли связанные товары
        products_count = EventsProducts.objects.filter(event=event).count()
        prints_count = EventsPrints.objects.filter(event=event).count()

        if products_count > 0 or prints_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Нельзя удалить: связанных товаров: {products_count}, принтов: {prints_count}'
            })

        event_name = event.event_name
        event.delete()

        return JsonResponse({
            'success': True,
            'message': f'Мероприятие "{event_name}" удалено'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ========== ТОВАРЫ МЕРОПРИЯТИЙ ==========

@csrf_exempt
def api_admin_events_products(request):
    """Получение списка товаров мероприятий"""
    try:
        from django.db.models import Q

        event_id = request.GET.get('event_id')
        search = request.GET.get('search', '')

        items = EventsProducts.objects.select_related('event', 'product').all().order_by('event__event_name',
                                                                                         'product__model')

        if event_id and event_id != 'all':
            items = items.filter(event_id=event_id)

        if search:
            items = items.filter(
                Q(product__model__icontains=search) |
                Q(product__color__icontains=search) |
                Q(product__size__icontains=search)
            )

        items_data = []
        for item in items:
            items_data.append({
                'id': item.id,
                'event_id': item.event.id,
                'event_name': item.event.event_name,
                'product_id': item.product.product_id,
                'product_name': str(item.product),
                'product_model': item.product.model,
                'product_color': item.product.color,
                'product_size': item.product.size,
            })

        return JsonResponse({
            'success': True,
            'items': items_data,
            'count': len(items_data)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_add_event_product(request):
    """Добавление товара в мероприятие"""
    try:
        data = json.loads(request.body)
        event_id = data.get('event_id')
        product_id = data.get('product_id')

        if not event_id or not product_id:
            return JsonResponse({'success': False, 'error': 'Не указаны event_id или product_id'})

        # Проверяем существование
        event = get_object_or_404(EventsList, id=event_id)
        product = get_object_or_404(Product, product_id=product_id)

        # Проверяем уникальность
        existing = EventsProducts.objects.filter(event=event, product=product).first()
        if existing:
            return JsonResponse({'success': False, 'error': 'Этот товар уже добавлен в мероприятие'})

        # Создаем связь
        item = EventsProducts.objects.create(
            event=event,
            product=product
        )

        return JsonResponse({
            'success': True,
            'message': f'Товар "{product.model} {product.color}" добавлен в мероприятие "{event.event_name}"',
            'item_id': item.id
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_delete_event_product(request, item_id):
    """Удаление товара из мероприятия"""
    try:
        item = get_object_or_404(EventsProducts, id=item_id)
        event_name = item.event.event_name
        product_info = str(item.product)

        item.delete()

        return JsonResponse({
            'success': True,
            'message': f'Товар "{product_info}" удален из мероприятия "{event_name}"'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ========== ПРИНТЫ МЕРОПРИЯТИЙ ==========

@csrf_exempt
def api_admin_events_prints(request):
    """Получение списка принтов мероприятий"""
    try:
        from django.db.models import Q

        event_id = request.GET.get('event_id')
        search = request.GET.get('search', '')

        items = EventsPrints.objects.select_related('event', 'print_design').all().order_by('event__event_name',
                                                                                            'print_design__name')

        if event_id and event_id != 'all':
            items = items.filter(event_id=event_id)

        if search:
            items = items.filter(print_design__name__icontains=search)

        items_data = []
        for item in items:
            items_data.append({
                'id': item.id,
                'event_id': item.event.id,
                'event_name': item.event.event_name,
                'print_id': item.print_design.print_id,
                'print_name': item.print_design.name,
                'print_file': item.print_design.file_path.url if item.print_design.file_path else None,
            })

        return JsonResponse({
            'success': True,
            'items': items_data,
            'count': len(items_data)
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_add_event_print(request):
    """Добавление принта в мероприятие"""
    try:
        data = json.loads(request.body)
        event_id = data.get('event_id')
        print_id = data.get('print_id')

        if not event_id or not print_id:
            return JsonResponse({'success': False, 'error': 'Не указаны event_id или print_id'})

        # Проверяем существование
        event = get_object_or_404(EventsList, id=event_id)
        print_design = get_object_or_404(PrintDesign, print_id=print_id)

        # Проверяем уникальность
        existing = EventsPrints.objects.filter(event=event, print_design=print_design).first()
        if existing:
            return JsonResponse({'success': False, 'error': 'Этот принт уже добавлен в мероприятие'})

        # Создаем связь
        item = EventsPrints.objects.create(
            event=event,
            print_design=print_design
        )

        return JsonResponse({
            'success': True,
            'message': f'Принт "{print_design.name}" добавлен в мероприятие "{event.event_name}"',
            'item_id': item.id
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_delete_event_print(request, item_id):
    """Удаление принта из мероприятия"""
    try:
        item = get_object_or_404(EventsPrints, id=item_id)
        event_name = item.event.event_name
        print_name = item.print_design.name

        item.delete()

        return JsonResponse({
            'success': True,
            'message': f'Принт "{print_name}" удален из мероприятия "{event_name}"'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ================== ОБЛАСТИ ПЕЧАТИ (ADMIN) ==================

@csrf_exempt
@require_POST
def api_admin_add_print_area(request):
    """Добавление области печати для товара"""
    try:
        product_id = request.POST.get('product_id')
        area_name = request.POST.get('area_name')
        width = request.POST.get('width')
        height = request.POST.get('height')
        offset_x = request.POST.get('offset_x', 0)
        offset_y = request.POST.get('offset_y', 0)
        max_prints = request.POST.get('max_prints', 1)
        area_image = request.FILES.get('area_image')

        if not all([product_id, area_name, width, height]):
            return JsonResponse({'success': False, 'error': 'Заполните все обязательные поля'})

        if not area_image:
            return JsonResponse({'success': False, 'error': 'Изображение области обязательно'})

        product = get_object_or_404(Product, product_id=product_id)

        # Создаем область печати - изображение сохранится автоматически
        # благодаря upload_to=area_image_directory_path в модели
        area = ProductPrintArea.objects.create(
            product=product,
            area_name=area_name,
            width=width,
            height=height,
            offset_x=offset_x,
            offset_y=offset_y,
            max_prints=max_prints,
            area_image=area_image  # Django автоматически вызовет area_image_directory_path
        )

        return JsonResponse({
            'success': True,
            'message': 'Область печати добавлена',
            'area_id': area.area_id,
            'image_path': area.area_image.url if area.area_image else None
        })

    except Exception as e:
        print(f"ERROR добавления области: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_admin_update_print_area(request, area_id):
    """Обновление области печати"""
    try:
        area = get_object_or_404(ProductPrintArea, area_id=area_id)

        area.area_name = request.POST.get('area_name', area.area_name)
        area.width = request.POST.get('width', area.width)
        area.height = request.POST.get('height', area.height)
        area.offset_x = request.POST.get('offset_x', area.offset_x)
        area.offset_y = request.POST.get('offset_y', area.offset_y)
        area.max_prints = request.POST.get('max_prints', area.max_prints)

        if request.FILES.get('area_image'):
            # Старое изображение удалится автоматически
            area.area_image = request.FILES['area_image']

        area.save()

        return JsonResponse({
            'success': True,
            'message': 'Область печати обновлена'
        })

    except Exception as e:
        print(f"ERROR обновления области: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_delete_print_area(request, area_id):
    """Удаление области печати"""
    try:
        area = get_object_or_404(ProductPrintArea, area_id=area_id)
        area.delete()

        return JsonResponse({
            'success': True,
            'message': 'Область печати удалена'
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def api_admin_add_product_with_image(request):
    """Добавление нового изделия с изображением"""
    try:
        model = request.POST.get('model')
        color = request.POST.get('color')
        size = request.POST.get('size')
        quantity = request.POST.get('quantity')
        image = request.FILES.get('image_filename')

        if not all([model, color, size, quantity, image]):
            return JsonResponse({'success': False, 'error': 'Заполните все поля'})

        # Проверяем уникальность
        existing = Product.objects.filter(
            model=model,
            color=color,
            size=size
        ).first()

        if existing:
            # Обновляем количество
            existing.quantity += int(quantity)
            if image:
                existing.image_filename = image  # Django автоматически вызовет product_image_directory_path
            existing.save()
            message = f'Количество обновлено. Теперь: {existing.quantity}'
            product_data = {
                'id': existing.product_id,
                'model': existing.model,
                'color': existing.color,
                'size': existing.size,
                'quantity': existing.quantity,
                'image': existing.image_filename.url if existing.image_filename else None
            }
        else:
            # Создаем новый - Django автоматически вызовет product_image_directory_path
            product = Product.objects.create(
                model=model,
                color=color,
                size=size,
                quantity=int(quantity),
                image_filename=image  # Здесь Django использует upload_to из модели
            )
            message = 'Изделие добавлено'
            product_data = {
                'id': product.product_id,
                'model': product.model,
                'color': product.color,
                'size': product.size,
                'quantity': product.quantity,
                'image': product.image_filename.url if product.image_filename else None
            }

        return JsonResponse({
            'success': True,
            'message': message,
            'product': product_data
        })

    except Exception as e:
        print(f"ERROR добавления товара: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)