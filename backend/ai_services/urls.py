from django.urls import path
from .views import AICategorizeView

urlpatterns = [
    path("categorize/", AICategorizeView.as_view(), name="ai-categorize"),
]
