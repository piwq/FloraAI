from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import PlantAnalysis, SiteSettings

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name', required=False, allow_blank=True)
    birthDate = serializers.DateField(source='birth_date', required=False, allow_null=True)
    subscriptionStatus = serializers.SerializerMethodField()
    remainingInterpretations = serializers.SerializerMethodField()
    telegramTag = serializers.CharField(source='telegram_username', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'name', 'birthDate', 'subscriptionStatus', 'remainingInterpretations', 'telegramTag', 'yolo_conf', 'yolo_iou', 'yolo_imgsz', 'color_leaf', 'color_root', 'color_stem', 'calib_mm_per_pixel', 'calib_cm2_per_pixel', 'calib_reprojection_error')
        read_only_fields = ('id', 'username', 'email', 'calib_mm_per_pixel', 'calib_cm2_per_pixel', 'calib_reprojection_error')

    def get_subscriptionStatus(self, obj):
        if not SiteSettings.get().require_subscription:
            return 'PREMIUM'
        return 'PREMIUM' if obj.is_premium else 'BASIC'

    def get_remainingInterpretations(self, obj):
        if not SiteSettings.get().require_subscription or obj.is_premium:
            return 'Безлимит'
        count = PlantAnalysis.objects.filter(user=obj).count()
        return max(0, 3 - count)

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

