from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import PlantAnalysis

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    # Мапим name фронтенда во first_name в БД
    name = serializers.CharField(source='first_name', required=False, allow_blank=True)
    birthDate = serializers.DateField(source='birth_date', required=False, allow_null=True)
    subscriptionStatus = serializers.SerializerMethodField()
    remainingInterpretations = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'name', 'birthDate', 'subscriptionStatus', 'remainingInterpretations')
        read_only_fields = ('id', 'username', 'email')

    def get_subscriptionStatus(self, obj):
        return 'PREMIUM' if obj.is_premium else 'BASIC'

    def get_remainingInterpretations(self, obj):
        return 'Безлимит' if obj.is_premium else 3

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(source='first_name', required=False, allow_blank=True)
    birthDate = serializers.DateField(source='birth_date', required=False, allow_null=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'name', 'birthDate')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            birth_date=validated_data.get('birth_date', None)
        )
        return user

class PlantAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantAnalysis
        fields = '__all__'