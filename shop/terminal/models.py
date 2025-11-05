from django.db import models


# Таблица 1 - Список пользователей
class User(models.Model):
    ACCESS_LEVELS = [
        ('admin', 'Администратор'),
        ('manager', 'Менеджер'),
        ('client', 'Клиент'),
    ]

    phone_number = models.CharField(max_length=20, primary_key=True, verbose_name='Номер телефона')
    name = models.CharField(max_length=100, verbose_name='Имя')
    access_level = models.CharField(max_length=10, choices=ACCESS_LEVELS, verbose_name='Уровень доступа')

    def __str__(self):
        return f"{self.name} ({self.phone_number})"


# Таблица 2 - Промокоды
class PromoCode(models.Model):
    code = models.CharField(max_length=50, unique=True, verbose_name='Промокод')
    discount = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='Скидка (%)')
    is_active = models.BooleanField(default=True, verbose_name='Активен')

    def __str__(self):
        return f"{self.code} - {self.discount}%"


# Таблица 3 - Склад вещей предприятия
class Product(models.Model):
    product_id = models.AutoField(primary_key=True, verbose_name='ID Продукта')
    model = models.CharField(max_length=100, verbose_name='Модель')
    size = models.CharField(max_length=20, verbose_name='Размер')
    color = models.CharField(max_length=50, verbose_name='Цвет')
    quantity = models.IntegerField(default=0, verbose_name='Количество')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Цена')

    class Meta:
        unique_together = ['model', 'size', 'color']

    def __str__(self):
        return f"{self.model} {self.color} {self.size}"


# Таблица 4 - Зоны печати для товаров
class ProductPrintArea(models.Model):
    area_id = models.AutoField(primary_key=True, verbose_name='AreaID')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name='Продукт')
    area_name = models.CharField(max_length=100, verbose_name='Название зоны')
    max_prints = models.IntegerField(default=1, verbose_name='Макс. принтов')
    width = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Ширина (см)')
    height = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Высота (см)')

    def __str__(self):
        return f"{self.product.model} - {self.area_name}"


# Таблица 5 - Склад Принтов
class PrintDesign(models.Model):
    print_id = models.AutoField(primary_key=True, verbose_name='Print ID')
    name = models.CharField(max_length=100, verbose_name='Название')
    file_path = models.FileField(upload_to='prints/', verbose_name='Файл')
    price = models.DecimalField(max_digits=8, decimal_places=2, verbose_name='Цена')

    def __str__(self):
        return self.name


# Таблица 6 - Заказы
class Order(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('in_progress', 'В работе'),
        ('printed', 'Напечатан'),
        ('ready', 'Готов к выдаче'),
        ('completed', 'Выдан'),
        ('cancelled', 'Отменен'),
    ]

    order_id = models.AutoField(primary_key=True, verbose_name='Order ID')
    customer_name = models.CharField(max_length=100, verbose_name='Имя клиента')
    phone_number = models.CharField(max_length=20, verbose_name='Номер телефона')
    promocode = models.ForeignKey(PromoCode, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Промокод')
    created_date = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', verbose_name='Статус')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name='Продукт')

    def __str__(self):
        return f"Заказ #{self.order_id} - {self.customer_name}"


# Таблица 7 - Принты на заказе
class OrderPrint(models.Model):
    order_print_id = models.AutoField(primary_key=True, verbose_name='OrderPrintID')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, verbose_name='Заказ')
    print_design = models.ForeignKey(PrintDesign, on_delete=models.CASCADE, verbose_name='Принт')
    area = models.ForeignKey(ProductPrintArea, on_delete=models.CASCADE, verbose_name='Зона печати')
    position_x = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Позиция X')
    position_y = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Позиция Y')

    def __str__(self):
        return f"Принт для заказа #{self.order.order_id}"


# Таблица 8 - Готовые к выдаче заказы
class ReadyForDelivery(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, primary_key=True, verbose_name='Заказ')
    content_id = models.CharField(max_length=50, verbose_name='Content ID')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name='Продукт')
    ready_date = models.DateTimeField(auto_now_add=True, verbose_name='Дата готовности')
    customer_name = models.CharField(max_length=100, verbose_name='Имя клиента')
    phone_number = models.CharField(max_length=20, verbose_name='Номер телефона')

    def __str__(self):
        return f"Готов к выдаче: {self.order}"