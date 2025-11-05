from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .models import Product, PrintDesign, Order, OrderPrint, User, PromoCode, ProductPrintArea


def terminal_view(request):
    """Главная страница терминала"""
    return render(request, 'terminal.html')


@csrf_exempt
def api_products(request):  # Добавлен параметр request
    """API для получения списка продуктов (изделий)"""
    try:
        # Получаем уникальные типы изделий, которые есть в наличии
        products = Product.objects.filter(quantity__gt=0).values('model').distinct()

        products_data = []
        for product in products:
            model_name = product['model']
            # Получаем первое изделие для этого типа
            first_product = Product.objects.filter(model=model_name, quantity__gt=0).first()

            # Используем переменную first_product вместо того чтобы оставлять неиспользованной
            description = f"Доступные модели {model_name}"
            if first_product:
                description = f"{first_product.description or description}"

            products_data.append({
                'id': model_name,
                'name': model_name,
                'description': description,  # Теперь используется информация из first_product
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

        # Получаем все доступные модели этого типа изделия
        models = Product.objects.filter(
            model=product_model,
            quantity__gt=0
        ).values('color').distinct()

        models_data = []
        for model in models:
            color = model['color']
            # Получаем информацию о первой доступной модели этого цвета
            first_model = Product.objects.filter(model=product_model, color=color, quantity__gt=0).first()

            models_data.append({
                'id': color,
                'name': f"{product_model} - {color}",
                'description': f"{color} цвет",
                'base_price': float(first_model.price) if first_model else 0
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

        # Получаем все доступные размеры для этой модели и цвета
        sizes = Product.objects.filter(
            model=product_model,
            color=color,
            quantity__gt=0
        )

        sizes_data = []
        for size_obj in sizes:
            sizes_data.append({
                'size': size_obj.size,
                'quantity': size_obj.quantity,
                'price': float(size_obj.price),
                'product_id': size_obj.product_id
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
                'price': float(print_obj.price)
            })

        # Сортируем: "Свой текст" первые
        prints_data.sort(key=lambda x: 0 if 'Свой текст' in x['name'] else 1)

        return JsonResponse(prints_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_create_order(request):
    """API для создания заказа"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            # Получаем продукт из БД
            product = Product.objects.get(product_id=data['product_id'])

            # Проверяем наличие
            if product.quantity <= 0:
                return JsonResponse({
                    'success': False,
                    'error': 'Товара нет в наличии'
                }, status=400)

            # Создаем заказ
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
                print_design = PrintDesign.objects.get(print_id=print_id)
                OrderPrint.objects.create(
                    order=order,
                    print_design=print_design,
                    area_id=1,
                    position_x=50,
                    position_y=50
                )

            return JsonResponse({
                'success': True,
                'order_id': order.order_id,
                'order_number': f"ORD{order.order_id:06d}",
                'message': 'Заказ успешно создан'
            })

        except Product.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Товар не найден'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=400)
    else:
        # Добавлен возврат для GET запросов
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


@csrf_exempt
def api_print_areas(request):
    """API для получения зон печати продукта"""
    try:
        product_id = request.GET.get('product_id')
        if not product_id:
            return JsonResponse({'error': 'ID продукта не указан'}, status=400)

        areas = ProductPrintArea.objects.filter(product_id=product_id)
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