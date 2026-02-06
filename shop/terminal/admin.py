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
    EventsList,
    EventsProducts,
    EventsPrints
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

@admin.register(EventsList)
class EventsListAdmin(admin.ModelAdmin):
    list_display = ('event_name', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('event_name',)
    list_editable = ('is_active',)
    actions = ['activate_selected', 'deactivate_selected']

    def activate_selected(self, request, queryset):
        """Активировать выбранные мероприятия (только первое станет активным)"""
        count = 0
        for event in queryset:
            if count == 0:  # Первое активируем
                event.is_active = True
                event.save()
                count += 1
            else:  # Остальные пропускаем
                pass
        self.message_user(request, f"Активировано {count} мероприятие(й)")
    activate_selected.short_description = "Активировать выбранные (только первое)"

    def deactivate_selected(self, request, queryset):
        """Деактивировать выбранные мероприятия"""
        updated = queryset.update(is_active=False)
        self.message_user(request, f"Деактивировано {updated} мероприятие(й)")
    deactivate_selected.short_description = "Деактивировать выбранные"

@admin.register(EventsProducts)
class EventsProductsAdmin(admin.ModelAdmin):
    list_display = ('event', 'product', 'product_model', 'product_color', 'product_size')
    list_filter = ('event__is_active', 'event')
    search_fields = ('event__event_name', 'product__model', 'product__color')
    autocomplete_fields = ['event', 'product']

    def product_model(self, obj):
        return obj.product.model
    product_model.short_description = 'Модель'

    def product_color(self, obj):
        return obj.product.color
    product_color.short_description = 'Цвет'

    def product_size(self, obj):
        return obj.product.size
    product_size.short_description = 'Размер'

@admin.register(EventsPrints)
class EventsPrintsAdmin(admin.ModelAdmin):
    list_display = ['event', 'print_design', 'event_is_active']
    list_filter = ['event__is_active', 'event']
    search_fields = ['event__event_name', 'print_design__name']
    autocomplete_fields = ['event', 'print_design']

    def event_is_active(self, obj):
        return obj.event.is_active

    event_is_active.short_description = 'Мероприятие активно'
    event_is_active.boolean = True