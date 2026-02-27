from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import PlantAnalysis, User
from .serializers import PlantAnalysisSerializer

class PlantAnalysisViewSet(viewsets.ModelViewSet):
    queryset = PlantAnalysis.objects.all()
    serializer_class = PlantAnalysisSerializer

    def create(self, request, *args, **kwargs):
        telegram_id = request.data.get('telegram_id')
        image = request.FILES.get('original_image')

        if not telegram_id:
            return Response({"error": "telegram_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Находим или создаем пользователя по telegram_id
        user, _ = User.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={'username': f"tg_{telegram_id}"}
        )

        # 2. Создаем запись анализа с "заглушкой"
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