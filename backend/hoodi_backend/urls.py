from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI Schema & Interactive Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Domain APIs
    path("api/auth/", include("accounts.urls")),
    path("api/help/", include("help_requests.urls")),
    path("api/skills/", include("skills.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/ai/", include("ai_services.urls")),
    path("api/services/", include("services.urls")),
]
