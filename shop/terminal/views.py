from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from django.views.decorators.http import require_POST
import json

from .models import (
    Product, PrintDesign, Order, OrderPrint, User, PromoCode, ProductPrintArea
)


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
    return render(request, 'reception/reception.html', {
        'user_login': request.session.get('login'),
    })


@interface_required('production')
def production_interface(request):
    return render(request, 'production/production.html', {
        'user_login': request.session.get('login'),
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
    """Все доступные модели товаров с изображениями"""
    try:
        unique_models_with_images = []

        model_names = Product.objects.filter(
            quantity__gt=0
        ).values_list('model', flat=True).distinct().order_by('model')

        for model_name in model_names:
            # Находим первый товар этой модели
            first_product = Product.objects.filter(
                model=model_name,
                quantity__gt=0
            ).order_by('product_id').first()

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
                    product_with_image = Product.objects.filter(
                        model=model_name,
                        quantity__gt=0
                    ).exclude(image_filename='').order_by('product_id').first()

                    if product_with_image:
                        model_data['image_url'] = product_with_image.image_filename.url
                        model_data['color'] = product_with_image.color
                        model_data['product_id'] = product_with_image.product_id

            unique_models_with_images.append(model_data)

        return JsonResponse(unique_models_with_images, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ШАГ 2: ЦВЕТА ДЛЯ МОДЕЛИ
@csrf_exempt
def api_colors(request):
    """Цвета для выбранной модели"""
    try:
        model_name = request.GET.get('model')
        if not model_name:
            return JsonResponse({'error': 'Название модели не указано'}, status=400)

        colors_data = []

        # Получаем уникальные цвета для этой модели
        color_names = Product.objects.filter(
            model=model_name,
            quantity__gt=0
        ).values_list('color', flat=True).distinct().order_by('color')

        for color_name in color_names:
            # Находим первый товар этого цвета
            product = Product.objects.filter(
                model=model_name,
                color=color_name,
                quantity__gt=0
            ).order_by('product_id').first()

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
    """Размеры для выбранной модели и цвета"""
    try:
        model_name = request.GET.get('model')
        color_name = request.GET.get('color')

        print(f"DEBUG api_sizes: Модель='{model_name}', Цвет='{color_name}'")  # Добавьте для отладки

        if not model_name or not color_name:
            return JsonResponse({'error': 'Не указаны модель или цвет'}, status=400)

        products = Product.objects.filter(
            model=model_name,
            color=color_name,
            quantity__gt=0
        ).order_by('size')

        sizes_data = []
        for product in products:
            print(f"DEBUG: Найден товар ID={product.product_id}, размер={product.size}")  # Отладка
            sizes_data.append({
                'id': product.product_id,
                'size': product.size,
                'quantity': product.quantity,
                'image_url': product.image_filename.url if product.image_filename else None,
            })

        print(f"DEBUG: Отправляю {len(sizes_data)} размеров")  # Отладка
        return JsonResponse(sizes_data, safe=False)

    except Exception as e:
        print(f"ERROR api_sizes: {str(e)}")  # Отладка
        return JsonResponse({'error': str(e)}, status=500)

# ШАГ 4: ПРИНТЫ И ЗОНЫ ПЕЧАТИ
@csrf_exempt
def api_prints(request):
    """Все доступные принты"""
    try:
        prints = PrintDesign.objects.all().order_by('name')
        prints_data = []
        for p in prints:
            prints_data.append({
                'id': p.print_id,
                'name': p.name,
                'image_url': p.file_path.url if p.file_path else None,
            })
        return JsonResponse(prints_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

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