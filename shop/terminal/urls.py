# terminal/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Аутентификация
    path('', views.login_view, name='login'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Интерфейсы
    path('terminal/', views.terminal_interface, name='terminal_interface'),
    path('reception/', views.reception_interface, name='reception_interface'),
    path('production/', views.production_interface, name='production_interface'),
    path('admin-panel/', views.admin_interface, name='admin_interface'),

    # API для терминала (используем существующие функции из views.py)
    path('api/products/', views.api_products, name='api_products'),
    path('api/colors/', views.api_colors, name='api_colors'),
    path('api/sizes/', views.api_sizes, name='api_sizes'),
    path('api/prints/', views.api_prints, name='api_prints'),
    path('api/print-areas/', views.api_print_areas, name='api_print_areas'),
    path('api/orders/create/', views.api_create_order, name='api_create_order'),
    path('api/check-promocode/', views.check_promocode, name='check_promocode'),
    path('api/get-promocodes/', views.get_promocodes, name='get_promocodes'),
]