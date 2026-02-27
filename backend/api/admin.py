from django.contrib import admin
from .models import User, PlantAnalysis, ChatSession, ChatMessage

admin.site.register(User)
admin.site.register(PlantAnalysis)
admin.site.register(ChatSession)
admin.site.register(ChatMessage)