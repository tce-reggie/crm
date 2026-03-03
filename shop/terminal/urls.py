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

    # Выдача (Delivery)
    path('delivery/', views.delivery_interface, name='delivery_interface'),
    path('api/delivery/orders/', views.api_delivery_orders, name='api_delivery_orders'),
    path('api/delivery/orders/<int:order_id>/complete/', views.api_delivery_complete_order, name='api_delivery_complete'),

    # API для проверки статуса
    path('api/check-user-status/', views.api_check_user_status, name='api_check_status'),
    # Страница паузы
    path('user-paused/', views.user_paused_view, name='user_paused'),


    # Админ панель
    path('admin-panel/', views.admin_interface, name='admin_interface'),

    # API для админки
    path('api/admin/orders/', views.api_admin_orders, name='api_admin_orders'),
    path('api/admin/orders/<int:order_id>/', views.api_admin_order_detail, name='api_admin_order_detail'),
    path('api/admin/orders/<int:order_id>/status/', views.api_admin_update_order_status, name='api_admin_update_status'),
    path('api/admin/orders/<int:order_id>/delete/', views.api_admin_delete_order, name='api_admin_delete_order'),
    path('api/admin/orders/delete-all/', views.api_admin_delete_all_orders, name='api_admin_delete_all_orders'),
    path('api/admin/orders/create/', views.api_admin_create_order, name='api_admin_create_order'),

    # Продукты
    path('api/admin/products/', views.api_admin_products, name='api_admin_products'),
    path('api/admin/products/add/', views.api_admin_add_product, name='api_admin_add_product'),
    path('api/admin/products/<int:product_id>/delete/', views.api_admin_delete_product, name='api_admin_delete_product'),
    path('api/admin/products/delete-all/', views.api_admin_delete_all_products, name='api_admin_delete_all_products'),
    path('api/admin/products/<int:product_id>/update-quantity/', views.api_admin_update_product_quantity, name='api_admin_update_quantity'),

    # Принты
    path('api/admin/prints/', views.api_admin_prints, name='api_admin_prints'),
    path('api/admin/prints/add/', views.api_admin_add_print, name='api_admin_add_print'),
    path('api/admin/prints/<int:print_id>/delete/', views.api_admin_delete_print, name='api_admin_delete_print'),
    path('api/admin/prints/delete-all/', views.api_admin_delete_all_prints, name='api_admin_delete_all_prints'),

    # Сотрудники
    path('api/admin/users/', views.api_admin_users, name='api_admin_users'),
    path('api/admin/users/add/', views.api_admin_add_user, name='api_admin_add_user'),
    path('api/admin/users/<int:user_id>/delete/', views.api_admin_delete_user, name='api_admin_delete_user'),
    path('api/admin/users/<int:user_id>/toggle-active/', views.api_admin_toggle_user_active, name='api_admin_toggle_user'),

    # Статистика и сессия
    path('api/admin/statistics/', views.api_admin_statistics, name='api_admin_statistics'),
    path('api/admin/session/stop/', views.api_admin_stop_session, name='api_admin_stop_session'),
    path('api/admin/session/resume/', views.api_admin_resume_session, name='api_admin_resume_session'),
    path('api/admin/session/restart/', views.api_admin_restart_session, name='api_admin_restart_session'),
    path('api/admin/session/print-label/', views.api_admin_print_session_label, name='api_admin_print_label'),

    # Events API endpoints
    path('api/admin/events/', views.api_admin_events, name='api_admin_events'),
    path('api/admin/events/add/', views.api_admin_add_event, name='api_admin_add_event'),
    path('api/admin/events/<int:event_id>/update/', views.api_admin_update_event, name='api_admin_update_event'),
    path('api/admin/events/<int:event_id>/set-active/', views.api_admin_set_active_event, name='api_admin_set_active'),
    path('api/admin/events/<int:event_id>/delete/', views.api_admin_delete_event, name='api_admin_delete_event'),

    # EventsProducts API
    path('api/admin/events-products/', views.api_admin_events_products, name='api_admin_events_products'),
    path('api/admin/events-products/add/', views.api_admin_add_event_product, name='api_admin_add_event_product'),
    path('api/admin/events-products/<int:item_id>/delete/', views.api_admin_delete_event_product,name='api_admin_delete_event_product'),

    # EventsPrints API
    path('api/admin/events-prints/', views.api_admin_events_prints, name='api_admin_events_prints'),
    path('api/admin/events-prints/add/', views.api_admin_add_event_print, name='api_admin_add_event_print'),
    path('api/admin/events-prints/<int:item_id>/delete/', views.api_admin_delete_event_print,name='api_admin_delete_event_print'),
]