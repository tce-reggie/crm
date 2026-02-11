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

@interface_required('composing')
def composing_interface(request):
    """Главный интерфейс компоновки"""
    return render(request, 'composing/composing_interface.html', {
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

            order_number = f"ORD{order.order_id:06d}"
            print(f"Заказ успешно создан. Номер: {order_number}")

        return JsonResponse({
            'success': True,
            'order_number': order_number,
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
        data = json.loads(request.body)
        order = get_object_or_404(Order, order_id=order_id)

        # Проверяем, можно ли подтвердить заказ
        if order.status != 'new':
            return JsonResponse({
                'success': False,
                'error': f'Заказ уже имеет статус: {order.get_status_display()}'
            }, status=400)

        # Обновляем статус
        order.status = 'confirmed'
        order.save()

        # Логируем действие
        print(f"Заказ #{order_id} подтвержден оператором")

        return JsonResponse({
            'success': True,
            'message': 'Заказ успешно подтвержден',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

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
# COMPOSING API ENDPOINTS
# =========================
@csrf_exempt
def api_composing_get_new_order(request):
    """Получение нового заказа для компоновки"""
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
            interface='composing'
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
                'status': 'in_progress',
                'status_display': 'В работе',
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
                'order': order_data,
                'worker_id': user_id,
                'assignment_id': active_assignment.assignment_id,
                'has_active_order': True
            })

        # Ищем заказ со статусом 'confirmed' без активных назначений
        confirmed_orders = Order.objects.filter(
            status='confirmed'
        ).exclude(
            assignments__status='in_progress'
        ).select_related('product').order_by('created_date')

        order = confirmed_orders.first()

        if not order:
            return JsonResponse({
                'success': False,
                'error': 'Нет доступных заказов'
            })

        # Создаем назначение заказа сотруднику (сразу in_progress)
        assignment = OrderAssignment.objects.create(
            order=order,
            worker=user,
            interface='composing',
            status='in_progress'  # Сразу в работе
        )

        # Получаем принты для этого заказа
        prints = OrderPrint.objects.filter(order=order).select_related('area')

        order_data = {
            'id': order.order_id,
            'order_number': f"ORD{order.order_id:06d}",
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'status': 'in_progress',
            'status_display': 'В работе',
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
            'order': order_data,
            'worker_id': user_id,
            'assignment_id': assignment.assignment_id,
            'has_active_order': True
        })

    except Exception as e:
        print(f"ERROR api_composing_get_new_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def api_composing_get_current_order(request):
    """Получение текущего заказа в работе у пользователя"""
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Ищем заказ в работе у пользователя
        active_assignment = OrderAssignment.objects.filter(
            worker=user,
            status='in_progress',
            interface='composing'
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
            'status': 'in_progress',
            'status_display': 'В работе',
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
            'order': order_data,
            'worker_id': user_id,
            'assignment_id': active_assignment.assignment_id
        })

    except Exception as e:
        print(f"ERROR api_composing_get_current_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def api_composing_complete_order(request, order_id):
    """Завершение компоновки заказа"""
    try:
        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Ищем активное назначение
        assignment = OrderAssignment.objects.filter(
            order_id=order_id,
            worker=user,
            interface='composing',
            status='in_progress'
        ).first()

        if not assignment:
            return JsonResponse({
                'success': False,
                'error': 'Заказ не находится у вас в работе'
            })

        # Завершаем работу успешно
        assignment.complete_work()

        # Меняем статус заказа на 'composed'
        order = assignment.order
        order.status = 'composed'
        order.save()

        print(f"Заказ #{order_id} собран сотрудником {user.employee_name}")

        return JsonResponse({
            'success': True,
            'message': 'Заказ успешно собран',
            'new_status': order.status,
            'new_status_display': order.get_status_display()
        })

    except Exception as e:
        print(f"ERROR api_composing_complete_order: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def api_composing_cancel_order(request, order_id):
    """Возврат заказа в очередь"""
    try:
        data = json.loads(request.body)
        cancel_reason = data.get('reason', 'Возвращено компоновщиком')

        user_id = request.session.get('user_id')
        if not user_id:
            return JsonResponse({'success': False, 'error': 'Не авторизован'})

        user = User.objects.get(id=user_id)

        # Ищем активное назначение
        assignment = OrderAssignment.objects.filter(
            order_id=order_id,
            worker=user,
            interface='composing',
            status='in_progress'
        ).first()

        if not assignment:
            return JsonResponse({
                'success': False,
                'error': 'Заказ не находится у вас в работе'
            })

        # Отменяем работу
        assignment.cancel_work(notes=cancel_reason)

        print(f"Заказ #{order_id} отменен сотрудником {user.employee_name}. Причина: {cancel_reason}")

        return JsonResponse({
            'success': True,
            'message': 'Заказ возвращен в очередь',
            'assignment_status': assignment.status
        })

    except Exception as e:
        print(f"ERROR api_composing_cancel_order: {str(e)}")
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
            status='composed'
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
        # ЗАКАЗЫ В РАБОТЕ (printing) - через OrderAssignment
        in_progress_assignments = OrderAssignment.objects.filter(
            status='in_progress',
            interface='print'  # Только печатники
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

            # Создаем запись в OrderAssignment о выдаче
            assignment = OrderAssignment.objects.create(
                order=order,
                worker=user,
                interface='delivery',
                status='completed',  # Сразу завершен
                notes=f"Заказ выдан клиенту. Время выдачи: {timezone.now().strftime('%d.%m.%Y %H:%M')}"
            )

            print(f"Заказ #{order_id} выдан клиенту сотрудником {user.employee_name}")

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