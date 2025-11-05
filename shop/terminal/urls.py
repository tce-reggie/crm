from django.urls import path
from . import views

urlpatterns = [
    path('', views.terminal_view, name='terminal'),

    # API endpoints
    path('api/products/', views.api_products, name='api_products'),
    path('api/models/', views.api_models, name='api_models'),
    path('api/sizes/', views.api_sizes, name='api_sizes'),
    path('api/prints/', views.api_prints, name='api_prints'),
    path('api/print-areas/', views.api_print_areas, name='api_print_areas'),
    path('api/orders/create/', views.api_create_order, name='api_create_order'),
    path('api/check-user/', views.api_check_user, name='api_check_user'),
    path('api/check-promocode/', views.api_check_promocode, name='api_check_promocode'),
]