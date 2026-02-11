# terminal/urls.py
from django.urls import path
from django.shortcuts import render
from . import views

urlpatterns = [
    # Аутентификация
    path('', views.login_view, name='login'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Интерфейсы
    path('terminal/', views.terminal_interface, name='terminal_interface'),
    path('reception/', views.reception_interface, name='reception_interface'),
    path('admin-panel/', views.admin_interface, name='admin_interface'),

    # API для терминала (существующие функции из views.py)
    path('api/products/', views.api_products, name='api_products'),
    path('api/colors/', views.api_colors, name='api_colors'),
    path('api/sizes/', views.api_sizes, name='api_sizes'),
    path('api/prints/', views.api_prints, name='api_prints'),
    path('api/print-areas/', views.api_print_areas, name='api_print_areas'),
    path('api/orders/create/', views.api_create_order, name='api_create_order'),
    path('api/check-promocode/', views.check_promocode, name='check_promocode'),
    path('api/get-promocodes/', views.get_promocodes, name='get_promocodes'),

    # Reception URLs
    path('reception/', views.reception_interface, name='reception_interface'),
    path('api/reception/orders/', views.api_reception_orders, name='api_reception_orders'),
    path('api/reception/orders/<int:order_id>/', views.api_reception_order_detail, name='api_reception_order_detail'),
    path('api/reception/orders/<int:order_id>/confirm/', views.api_reception_confirm_order, name='api_reception_confirm_order'),
    path('api/reception/orders/<int:order_id>/cancel/', views.api_reception_cancel_order, name='api_reception_cancel_order'),

    # Компоновка
    path('composing/', views.composing_interface, name='composing_interface'),
    # API для компоновки
    path('api/composing/orders/new/', views.api_composing_get_new_order, name='api_composing_new_order'),
    path('api/composing/orders/current/', views.api_composing_get_current_order, name='api_composing_current_order'),
    path('api/composing/orders/<int:order_id>/complete/', views.api_composing_complete_order, name='api_composing_complete_order'),
    path('api/composing/orders/<int:order_id>/cancel/', views.api_composing_cancel_order, name='api_composing_cancel_order'),



    path('printing/', views.printing_interface, name='printing_interface'),
    # API для печати
    path('api/printing/orders/new/', views.api_printing_get_new_order, name='api_printing_new_order'),
    path('api/printing/orders/current/', views.api_printing_get_current_order, name='api_printing_current_order'),
    path('api/printing/orders/<int:order_id>/complete/', views.api_printing_complete_order, name='api_printing_complete'),
    path('api/printing/orders/<int:order_id>/cancel/', views.api_printing_cancel_order, name='api_printing_cancel'),
    path('api/printing/zone-image/', views.api_printing_get_zone_image, name='api_printing_zone_image'),

    # Табло
    path('api/scoreboard/data/', views.api_scoreboard_data, name='api_scoreboard_data'),
    path('scoreboard/', views.scoreboard_interface, name='scoreboard'),

]