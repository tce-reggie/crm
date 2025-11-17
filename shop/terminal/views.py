from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
import json
from .models import Product, PrintDesign, Order, OrderPrint, User, PromoCode, ProductPrintArea


def login_view(request):
    """Общий логин для всех интерфейсов"""
    if 'user_id' in request.session:
        return redirect_to_interface(request.session.get('user_interface'))

    if request.method == 'POST':
        login = request.POST.get('login')
        password = request.POST.get('password')

        if login and password:
            try:
                user = User.objects.get(login=login)
                if user.check_password(password):
                    request.session['user_id'] = user.id
                    request.session['user_login'] = user.login
                    request.session['user_interface'] = user.interface
                    return redirect_to_interface(user.interface)
                else:
                    messages.error(request, 'Неверный пароль')
            except User.DoesNotExist:
                messages.error(request, 'Пользователь не найден')
        else:
            messages.error(request, 'Заполните все поля')

    return render(request, 'login.html')  # Теперь из корня templates


def redirect_to_interface(interface):
    """Перенаправление на соответствующий интерфейс"""
    if interface == 'terminal':
        return redirect('terminal_interface')
    # Добавьте другие интерфейсы по мере необходимости
    return redirect('terminal_interface')  # По умолчанию


def logout_view(request):
    request.session.flush()
    return redirect('login')


def login_required(view_func):
    def wrapper(request, *args, **kwargs):
        if 'user_id' not in request.session:
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper


# ТЕРМИНАЛЬНЫЙ ИНТЕРФЕЙС
@login_required
def terminal_interface(request):
    """Главная страница терминального интерфейса"""
    try:
        # Получаем уникальные модели изделий для начального отображения
        products = Product.objects.filter(quantity__gt=0).values_list('model', flat=True).distinct()

        products_data = []
        for model_name in products:
            available_count = Product.objects.filter(model=model_name, quantity__gt=0).count()

            products_data.append({
                'id': model_name,
                'name': model_name,
                'description': f"Доступно {available_count} моделей",
                'image': '#',
            })

        return render(request, 'terminal/terminal.html', {
            'products': products_data
        })
    except Exception as e:
        return render(request, 'terminal/terminal.html', {
            'products': []
        })


# API endpoints (остаются без изменений)
@csrf_exempt
def api_products(request):
    """API для получения списка продуктов (изделий)"""
    try:
        # Получаем уникальные модели изделий, которые есть в наличии
        products = Product.objects.filter(quantity__gt=0).values_list('model', flat=True).distinct()

        products_data = []
        for model_name in products:
            # Получаем первое изделие для этого типа для примера
            first_product = Product.objects.filter(model=model_name, quantity__gt=0).first()

            products_data.append({
                'id': model_name,
                'name': model_name,
                'description': f"Доступные модели {model_name}",
                'image': '#',  # В реальности нужно добавить поле image в модель
                'available_count': Product.objects.filter(model=model_name, quantity__gt=0).count()
            })

        return JsonResponse(products_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_models(request):
    """API для получения моделей выбранного изделия"""
    try:
        product_model = request.GET.get('product_id')

        if not product_model:
            return JsonResponse({'error': 'ID продукта не указан'}, status=400)

        # Получаем все доступные цвета для этой модели
        colors = Product.objects.filter(
            model=product_model,
            quantity__gt=0
        ).values_list('color', flat=True).distinct()

        models_data = []
        for color in colors:
            # Получаем информацию о первом доступном продукте этого цвета
            first_product = Product.objects.filter(model=product_model, color=color, quantity__gt=0).first()

            models_data.append({
                'id': color,
                'name': f"{product_model} - {color}",
                'color': color,
                'base_price': float(first_product.price) if first_product else 0,
                'image': '#'  # В реальности нужно добавить поле image
            })

        return JsonResponse(models_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_sizes(request):
    """API для получения размеров выбранной модели"""
    try:
        product_model = request.GET.get('product_model')
        color = request.GET.get('model_id')

        if not product_model or not color:
            return JsonResponse({'error': 'Не указаны модель или цвет'}, status=400)

        # Получаем все доступные размеры для этой модели и цвета
        sizes = Product.objects.filter(
            model=product_model,
            color=color,
            quantity__gt=0
        )

        sizes_data = []
        for product in sizes:
            sizes_data.append({
                'size': product.size,
                'quantity': product.quantity,
                'price': float(product.price),
                'product_id': product.product_id
            })

        return JsonResponse(sizes_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_prints(request):
    """API для получения доступных принтов"""
    try:
        prints = PrintDesign.objects.all()
        prints_data = []
        for print_obj in prints:
            prints_data.append({
                'id': print_obj.print_id,
                'name': print_obj.name,
                'type': 'custom' if 'Свой текст' in print_obj.name else 'image',
                'price': float(print_obj.price),
                'color': '#ff9800'  # Цвет для визуального отличия
            })

        # Сортируем: "Свой текст" первые
        prints_data.sort(key=lambda x: 0 if 'Свой текст' in x['name'] else 1)

        return JsonResponse(prints_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_print_areas(request):
    """API для получения зон печати продукта"""
    try:
        product_id = request.GET.get('product_id')
        if not product_id:
            return JsonResponse({'error': 'ID продукта не указан'}, status=400)

        # Находим продукт по ID
        try:
            product = Product.objects.get(product_id=product_id)
        except Product.DoesNotExist:
            return JsonResponse({'error': 'Продукт не найден'}, status=404)

        areas = ProductPrintArea.objects.filter(product=product)
        areas_data = []
        for area in areas:
            areas_data.append({
                'id': area.area_id,
                'name': area.area_name,
                'width': float(area.width),
                'height': float(area.height),
                'max_prints': area.max_prints
            })

        return JsonResponse(areas_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_create_order(request):
    """API для создания заказа"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            # Валидация обязательных полей
            required_fields = ['customer_name', 'phone_number', 'product_id']
            for field in required_fields:
                if not data.get(field):
                    return JsonResponse({
                        'success': False,
                        'error': f'Поле {field} обязательно'
                    }, status=400)

            # Получаем продукт из БД
            try:
                product = Product.objects.get(product_id=data['product_id'])
            except Product.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'Товар не найден'
                }, status=400)

            # Проверяем наличие
            if product.quantity <= 0:
                return JsonResponse({
                    'success': False,
                    'error': 'Товара нет в наличии'
                }, status=400)

            # Создаем заказ (order_id создается автоматически как AutoField)
            order = Order.objects.create(
                customer_name=data['customer_name'],
                phone_number=data['phone_number'],
                product=product,
                status='new'
            )

            # Если есть промокод
            promocode = data.get('promocode')
            if promocode:
                try:
                    promo = PromoCode.objects.get(code=promocode, is_active=True)
                    order.promocode = promo
                    order.save()
                except PromoCode.DoesNotExist:
                    pass  # Промокод не найден, но заказ все равно создается

            # Уменьшаем количество товара
            product.quantity -= 1
            product.save()

            # Если есть принт, создаем запись в OrderPrint
            print_id = data.get('print_id')
            if print_id:
                try:
                    print_design = PrintDesign.objects.get(print_id=print_id)
                    # Получаем первую зону печати для продукта
                    area = ProductPrintArea.objects.filter(product=product).first()

                    if area:
                        OrderPrint.objects.create(
                            order=order,
                            print_design=print_design,
                            area=area,
                            position_x=data.get('position_x', 50),
                            position_y=data.get('position_y', 50)
                        )
                except PrintDesign.DoesNotExist:
                    pass  # Принт не найден, но заказ все равно создается

            # Генерируем красивый номер заказа для отображения
            order_number = f"ORD{order.order_id:06d}"

            return JsonResponse({
                'success': True,
                'order_id': order.order_id,
                'order_number': order_number,
                'message': 'Заказ успешно создан'
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': f'Ошибка при создании заказа: {str(e)}'
            }, status=500)

    return JsonResponse({
        'success': False,
        'error': 'Метод не разрешен'
    }, status=405)


@csrf_exempt
def api_check_user(request):
    """API для проверки пользователя по номеру телефона"""
    try:
        phone_number = request.GET.get('phone_number')
        if not phone_number:
            return JsonResponse({
                'exists': False,
                'error': 'Номер телефона не указан'
            })

        user = User.objects.get(phone_number=phone_number)
        return JsonResponse({
            'exists': True,
            'name': user.name,
            'access_level': user.access_level
        })
    except User.DoesNotExist:
        return JsonResponse({'exists': False})
    except Exception as e:
        return JsonResponse({
            'exists': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
def api_check_promocode(request):
    """API для проверки промокода"""
    try:
        code = request.GET.get('code')
        if not code:
            return JsonResponse({
                'valid': False,
                'message': 'Промокод не указан'
            })

        promocode = PromoCode.objects.get(code=code, is_active=True)
        return JsonResponse({
            'valid': True,
            'discount': float(promocode.discount),
            'message': f'Промокод действителен! Скидка {promocode.discount}%'
        })
    except PromoCode.DoesNotExist:
        return JsonResponse({
            'valid': False,
            'message': 'Промокод не найден или неактивен'
        })
    except Exception as e:
        return JsonResponse({
            'valid': False,
            'message': f'Ошибка проверки промокода: {str(e)}'
        }, status=500)