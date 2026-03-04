from django.contrib import admin
from .models import User, PlantAnalysis, ChatSession, ChatMessage, SiteSettings

admin.site.register(User)
admin.site.register(PlantAnalysis)
admin.site.register(ChatSession)
admin.site.register(ChatMessage)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'require_subscription')

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False