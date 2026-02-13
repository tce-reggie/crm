from django.shortcuts import redirect
from django.urls import reverse


class UserActiveMiddleware:
    """
    Middleware для проверки активности пользователя
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Проверяем только для авторизованных пользователей
        if request.user.is_authenticated and hasattr(request, 'session') and 'user_id' in request.session:
            from .models import User

            try:
                user_id = request.session['user_id']
                user = User.objects.get(id=user_id)

                # Если пользователь деактивирован и это не страница выхода
                if not user.is_active and request.path != reverse('logout'):
                    # Очищаем сессию
                    request.session.flush()
                    # Перенаправляем на страницу с сообщением о паузе
                    return redirect('user_paused')

            except User.DoesNotExist:
                # Пользователь не найден - выходим
                request.session.flush()
                return redirect('login')

        response = self.get_response(request)
        return response