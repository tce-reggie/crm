import os
from django.db import models


# Таблица 1 - Список пользователей и интерфейсов
class User(models.Model):
    INTERFACE_CHOICES = [
        ('terminal', 'Терминал заказов'),
        ('reception', 'Ресепшен'),
        ('production', 'Производство'),
        ('admin', 'Администратор'),
    ]

    login = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Логин'
    )
    password = models.CharField(
        max_length=128,  # Увеличим для хэширования паролей
        verbose_name='Пароль'
    )
    employee_name = models.CharField(
        max_length=100,
        verbose_name='Имя сотрудника',
        help_text='ФИО сотрудника'
    )
    interface = models.CharField(
        max_length=20,
        choices=INTERFACE_CHOICES,
        verbose_name='Интерфейс'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Активный'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Дата создания'
    )

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'

    def __str__(self):
        return f"{self.employee_name} ({self.login}) - {self.get_interface_display()}"

    def get_interface_url(self):
        """Возвращает URL интерфейса"""
        interface_urls = {
            'terminal': 'terminal_interface',
            'reception': 'reception_interface',
            'production': 'production_interface',
            'admin': 'admin_interface',
        }
        return interface_urls.get(self.interface, 'login')

    def set_password(self, raw_password):
        """Установка пароля (можно добавить хэширование)"""
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        """Проверка пароля"""
        return check_password(raw_password, self.password)

# Таблица 2 - Промокоды
class PromoCode(models.Model):
    code = models.CharField(max_length=50, unique=True, verbose_name='Промокод')
    discount = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='Скидка (%)')
    is_active = models.BooleanField(default=True, verbose_name='Активен')

    def __str__(self):
        return f"{self.code} - {self.discount}%"


# Таблица 3 - Склад вещей предприятия
# функция для добавления изображения в media
def product_image_directory_path(instance, filename):
    extension = filename.split('.')[-1]
    new_filename = f"{instance.model}_{instance.color}_{instance.size}.{extension}"
    #путь относительно MEDIA_ROOT: products/Футболка_Белый_XL.jpg
    return os.path.join('products', new_filename)

class Product(models.Model):
    product_id = models.AutoField(primary_key=True, verbose_name='ID Продукта')
    model = models.CharField(max_length=100, verbose_name='Модель')
    image_filename = models.ImageField(
        max_length=255,
        blank=True,  # Разрешить пустое значение в формах
        null=True,  # Разрешить NULL в базе данных
        verbose_name='Имя файла картинки'
    )
    size = models.CharField(max_length=20, verbose_name='Размер')
    color = models.CharField(max_length=50, verbose_name='Цвет')
    quantity = models.IntegerField(default=0, verbose_name='Количество')

    class Meta:
        unique_together = ['model', 'size', 'color']

    def __str__(self):
        return f"{self.model} {self.color} {self.size}"


def area_image_directory_path(instance, filename):
    extension = filename.split('.')[-1]
    model = instance.product.model.replace(" ", "_")
    color = instance.product.color.replace(" ", "_")
    size = instance.product.size.replace(" ", "_")
    area = instance.area_name.replace(" ", "_")
    new_filename = f"{model}_{color}_{size}_{area}.{extension}"
    return os.path.join('products', 'areas', new_filename)

# Таблица 4 - Зоны печати для товаров
class ProductPrintArea(models.Model):
    area_id = models.AutoField(primary_key=True, verbose_name='AreaID')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name='Продукт')
    area_name = models.CharField(max_length=100, verbose_name='Название зоны')
    area_image = models.ImageField(
        upload_to=area_image_directory_path,
        verbose_name='Изображение зоны',
        null=True,
        blank=True,
    )
    max_prints = models.IntegerField(default=1, verbose_name='Макс. принтов')
    width = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Ширина (px)')
    height = models.DecimalField(max_digits=6, decimal_places=2, verbose_name='Высота (px)')
    offset_x = models.IntegerField(default=0, verbose_name='Отступ по X (пикс)')
    offset_y = models.IntegerField(default=0, verbose_name='Отступ по Y (пикс)')

    def __str__(self):
        return f"{self.product.model} - {self.area_name}"


def print_design_directory_path(instance, filename):
    extension = filename.split('.')[-1]
    safe_name = instance.name.replace(" ", "_")
    new_filename = f"{safe_name}.{extension}"
    return os.path.join('prints', new_filename)

# Таблица 5 - Склад Принтов
class PrintDesign(models.Model):
    print_id = models.AutoField(primary_key=True, verbose_name='Print ID')
    name = models.CharField(max_length=100, verbose_name='Название')
    file_path = models.ImageField(
        upload_to=print_design_directory_path,  # Используем нашу функцию
        verbose_name='Файл',
        max_length=255
    )

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
    print_design = models.TextField(verbose_name='Содержимое принта')
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