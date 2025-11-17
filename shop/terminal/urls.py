from django.urls import path
from . import views

urlpatterns = [
    # Основные маршруты
    path('', views.login_view, name='login'),  # Главная страница теперь ведет на логин
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Интерфейсы
    path('terminal/', views.terminal_interface, name='terminal_interface'),

    # API endpoints
    path('api/products/', views.api_products, name='api_products'),
    path('api/models/', views.api_models, name='api_models'),
    path('api/sizes/', views.api_sizes, name='api_sizes'),
    path('api/prints/', views.api_prints, name='api_prints'),
    path('api/print-areas/', views.api_print_areas, name='api_print_areas'),
    path('api/create-order/', views.api_create_order, name='api_create_order'),
    path('api/check-user/', views.api_check_user, name='api_check_user'),
    path('api/check-promocode/', views.api_check_promocode, name='api_check_promocode'),
]