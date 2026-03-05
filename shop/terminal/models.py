import os
from django.db import models
from django.utils import timezone


# Таблица 1 - Список пользователей и интерфейсов
class User(models.Model):
    INTERFACE_CHOICES = [
        ('terminal', 'Терминал заказов'),
        ('reception', 'Ресепшен'),
        ('composing', 'Сборка'),
        ('printing','Печать'),
        ('admin', 'Администратор'),
        ('scoreboard', 'Табло'),
        ('delivery', 'Выдача'),
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
            'printing': 'printing_interface',
            'admin': 'admin_interface',
            'scoreboard': 'scoreboard',
            'delivery': 'delivery_interface',
        }
        return interface_urls.get(self.interface, 'login')

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
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
    # Очищаем названия от пробелов и спецсимволов
    model = instance.model.replace(" ", "_").replace("/", "_").replace("\\", "_")
    color = instance.color.replace(" ", "_").replace("/", "_").replace("\\", "_")
    size = instance.size.replace(" ", "_").replace("/", "_").replace("\\", "_")
    new_filename = f"{instance.model}_{instance.color}_{instance.size}.{extension}"
    #путь относительно MEDIA_ROOT: products/Футболка_Белый_XL.jpg
    return os.path.join('products', new_filename)

class Product(models.Model):
    product_id = models.AutoField(primary_key=True, verbose_name='ID Продукта')
    model = models.CharField(max_length=100, verbose_name='Модель')
    image_filename = models.ImageField(
        upload_to=product_image_directory_path,
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
        ('confirmed', 'Подтвержден'),
        ('in_progress', 'В работе'),
        ('printing', 'Печатается'),
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

#==========================
#COMPOSING INTERFACE
#==========================

# Таблица 9 - Отслеживание работы сотрудников над заказами
class OrderAssignment(models.Model):
    """Назначение заказов сотрудникам"""
    assignment_id = models.AutoField(primary_key=True, verbose_name='ID назначения')

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        verbose_name='Заказ',
        related_name='assignments'
    )

    worker = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        verbose_name='Сотрудник',
        related_name='assigned_orders'
    )

    interface = models.CharField(
        max_length=20,
        choices=User.INTERFACE_CHOICES,
        verbose_name='Интерфейс работы'
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ('in_progress', 'В работе'),
            ('completed', 'Завершен'),
            ('cancelled', 'Отменен'),
        ],
        default='in_progress',
        verbose_name='Статус выполнения'
    )

    started_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Время начала работы'
    )

    finished_at = models.DateTimeField(  # Переименовано и объединено
        null=True,
        blank=True,
        verbose_name='Время завершения/отмены'
    )

    notes = models.TextField(
        blank=True,
        null=True,
        verbose_name='Примечания (причина отмены и т.д.)'
    )

    class Meta:
        verbose_name = 'Назначение заказа'
        verbose_name_plural = 'Назначения заказов'
        # Уникальная комбинация заказа и сотрудника в активном статусе
        constraints = [
            models.UniqueConstraint(
                fields=['order', 'worker'],
                condition=models.Q(status='in_progress'),
                name='unique_active_assignment'
            )
        ]
        ordering = ['-started_at']

    def __str__(self):
        return f"Заказ #{self.order.order_id} → {self.worker.employee_name} ({self.get_interface_display()})"

    def complete_work(self):
        """Завершить работу успешно"""
        self.status = 'completed'
        self.finished_at = timezone.now()
        self.save()

    def cancel_work(self, notes=None):
        """Отменить работу"""
        self.status = 'cancelled'
        self.finished_at = timezone.now()
        if notes:
            self.notes = notes
        self.save()

    def is_active(self):
        """Проверка, активна ли работа"""
        return self.status == 'in_progress'

    def get_duration(self):
        """Получить продолжительность работы (в минутах)"""
        if not self.finished_at:
            return None

        duration = self.finished_at - self.started_at
        return duration.total_seconds() / 60  # В минутах


# Таблицы мероприятий для админки

class EventsList(models.Model):
    """
    Таблица мероприятий
    - EventName - уникальное название мероприятия
    - IsActive - флаг активности (только одно мероприятие может быть активным)
    """
    event_name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='Название мероприятия'
    )
    is_active = models.BooleanField(
        default=False,
        verbose_name='Активно',
        help_text='Только одно мероприятие может быть активным'
    )

    class Meta:
        verbose_name = 'Мероприятие'
        verbose_name_plural = 'Мероприятия'
        ordering = ['event_name']

    def __str__(self):
        return f"{self.event_name} {'(Активно)' if self.is_active else ''}"

    def save(self, *args, **kwargs):
        """
        Переопределяем сохранение, чтобы гарантировать,
        что только одно мероприятие может быть активным
        """
        if self.is_active:
            # Если текущее мероприятие становится активным,
            # деактивируем все остальные
            EventsList.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class EventsProducts(models.Model):
    """
    Таблица товаров доступных на мероприятиях
    - Связывает мероприятия с доступными товарами
    - Одно мероприятие может иметь много товаров
    """
    event = models.ForeignKey(
        EventsList,
        on_delete=models.CASCADE,
        verbose_name='Мероприятие',
        related_name='available_products'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        verbose_name='Товар',
        related_name='events'
    )

    class Meta:
        verbose_name = 'Товар мероприятия'
        verbose_name_plural = 'Товары мероприятий'
        # Уникальная комбинация мероприятия и товара
        unique_together = ['event', 'product']
        ordering = ['event', 'product']

    def __str__(self):
        return f"{self.event.event_name} - {self.product.model} ({self.product.color})"

class EventsPrints(models.Model):
    """
    Таблица принтов доступных на мероприятиях
    - Связывает мероприятия с доступными принтами
    - Одно мероприятие может иметь много принтов
    """
    event = models.ForeignKey(
        EventsList,
        on_delete=models.CASCADE,
        verbose_name='Мероприятие',
        related_name='available_prints'
    )
    print_design = models.ForeignKey(
        PrintDesign,
        on_delete=models.CASCADE,
        verbose_name='Принт',
        related_name='events'
    )
    class Meta:
        verbose_name = 'Принт мероприятия'
        verbose_name_plural = 'Принты мероприятий'
        unique_together = ['event', 'print_design']
        ordering = ['event', 'print_design']

    def __str__(self):
        return f"{self.event.event_name} - {self.print_design.name}"