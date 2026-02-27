import json, os, urllib.request
from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .models import PlantAnalysis
from .serializers import PlantAnalysisSerializer, UserSerializer, RegisterSerializer

User = get_user_model()


# --- 1. АВТОРИЗАЦИЯ ДЛЯ ВЕБ-САЙТА ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# --- 2. АНАЛИЗ ФОТОГРАФИЙ (ЗАГЛУШКА) ---
class PlantAnalysisViewSet(viewsets.ModelViewSet):
    queryset = PlantAnalysis.objects.all()
    serializer_class = PlantAnalysisSerializer

    def create(self, request, *args, **kwargs):
        image = request.FILES.get('original_image')

        # 1. Если пользователь авторизован (на сайте), берем его
        if request.user.is_authenticated:
            user = request.user
        else:
            # 2. Логика для Telegram-бота (если пользователь не вошел через веб)
            telegram_id = request.data.get('telegram_id')

            # Проверяем, что это число, чтобы не упасть с ошибкой ValueError
            if not telegram_id or not str(telegram_id).isdigit():
                return Response(
                    {"error": "telegram_id must be a number for non-authenticated users"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user, _ = User.objects.get_or_create(
                telegram_id=int(telegram_id),
                defaults={'username': f"user_{telegram_id}"}
            )

        # 3. Создаем анализ
        analysis = PlantAnalysis.objects.create(
            user=user,
            original_image=image,
            status='COMPLETED',
            metrics={
                "plant_type": "Arugula (Руккола)",
                "leaf_area_cm2": 15.4,
                "root_length_mm": 120.5,
                "stem_diameter_mm": 4.2
            }
        )
        serializer = self.get_serializer(analysis)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# --- 3. ЧАТ С АГРОНОМОМ YANDEX GPT ---
class ChatAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user_message = request.data.get('message', '')
        metrics = request.data.get('metrics', {})

        system_prompt = (
            f"Ты — профессиональный агроном FloraAI. Данные растения: "
            f"Культура: {metrics.get('plant_type', 'Неизвестно')}, "
            f"Площадь листьев: {metrics.get('leaf_area_cm2', '0')} см2, "
            f"Длина корня: {metrics.get('root_length_mm', '0')} мм. "
            f"Отвечай кратко и давай советы по уходу."
        )

        # БЕРЕМ ИЗ .env, БОЛЬШЕ НИКАКИХ КЛЮЧЕЙ В КОДЕ!
        api_key = os.getenv("YANDEX_API_KEY")
        folder_id = os.getenv("YANDEX_FOLDER_ID")

        if not api_key or not folder_id:
            return Response(
                {"reply": f"Ответ (Заглушка). Нейросеть отключена. Вы спросили: {user_message}. Данные: {metrics}"})

        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {"Content-Type": "application/json", "Authorization": f"Api-Key {api_key}"}
        data = {
            "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
            "completionOptions": {"temperature": 0.3, "maxTokens": 1000},
            "messages": [
                {"role": "system", "text": system_prompt},
                {"role": "user", "text": user_message}
            ]
        }

        try:
            req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode())
            with urllib.request.urlopen(req) as res:
                answer = json.loads(res.read())['result']['alternatives'][0]['message']['text']
                return Response({"reply": answer})
        except Exception as e:
            return Response({"reply": f"⚠️ Ошибка связи с Яндекс: {str(e)}"})