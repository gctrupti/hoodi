from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    ProviderProfileMeView,
    ProviderProfileDetailView,
    ServiceListingViewSet,
    ServiceBookingViewSet,
    ServiceReviewCreateView,
    ServiceDisputeCreateView,
)

router = DefaultRouter()
router.register("listings", ServiceListingViewSet, basename="service-listings")
router.register("bookings", ServiceBookingViewSet, basename="service-bookings")

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="service-categories-list"),
    path("categories/<uuid:pk>/", CategoryDetailView.as_view(), name="service-categories-detail"),
    path("providers/me/", ProviderProfileMeView.as_view(), name="service-provider-me"),
    path("providers/<uuid:pk>/", ProviderProfileDetailView.as_view(), name="service-provider-detail"),
    path("reviews/", ServiceReviewCreateView.as_view(), name="service-reviews"),
    path("disputes/", ServiceDisputeCreateView.as_view(), name="service-disputes"),
    path("", include(router.urls)),
]
