from django.contrib import admin
from .models import (
    User,
    PromoCode,
    Product,
    ProductPrintArea,
    PrintDesign,
    Order,
    OrderPrint,
    ReadyForDelivery,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('login', 'employee_name', 'interface', 'is_active', 'created_at')
    list_filter = ('interface', 'is_active')
    search_fields = ('login', 'employee_name')
    readonly_fields = ('created_at',)


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('code',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('product_id', 'model', 'size', 'color', 'quantity')
    list_filter = ('model', 'size', 'color')
    search_fields = ('model', 'color')
    readonly_fields = ('product_id',)


@admin.register(ProductPrintArea)
class ProductPrintAreaAdmin(admin.ModelAdmin):
    list_display = ('area_id', 'product', 'area_name', 'max_prints', 'width', 'height')
    list_filter = ('product',)
    search_fields = ('area_name', 'product__model')
    readonly_fields = ('area_id',)


@admin.register(PrintDesign)
class PrintDesignAdmin(admin.ModelAdmin):
    list_display = ('print_id', 'name')
    search_fields = ('name',)
    readonly_fields = ('print_id',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'customer_name', 'phone_number', 'product', 'status', 'created_date')
    list_filter = ('status', 'created_date')
    search_fields = ('customer_name', 'phone_number', 'order_id')
    readonly_fields = ('order_id', 'created_date')


@admin.register(OrderPrint)
class OrderPrintAdmin(admin.ModelAdmin):
    list_display = ('order_print_id', 'order', 'print_design', 'area', 'position_x', 'position_y')
    list_filter = ('order', 'print_design', 'area')
    readonly_fields = ('order_print_id',)


@admin.register(ReadyForDelivery)
class ReadyForDeliveryAdmin(admin.ModelAdmin):
    list_display = ('order', 'customer_name', 'phone_number', 'ready_date')
    list_filter = ('ready_date',)
    search_fields = ('customer_name', 'phone_number', 'order__order_id')
    readonly_fields = ('ready_date',)