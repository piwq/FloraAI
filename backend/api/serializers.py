from rest_framework import serializers
from .models import PlantAnalysis, User

class PlantAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantAnalysis
        fields = ['id', 'status', 'metrics', 'created_at']