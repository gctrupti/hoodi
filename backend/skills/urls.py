from django.urls import path
from .views import (
    TeacherProfileListCreateView,
    TeacherProfileDetailView,
    SkillOfferingListCreateView,
    SkillOfferingDetailView,
    SkillBookingListCreateView,
    SkillBookingDetailView,
    ReviewRatingListCreateView,
)

urlpatterns = [
    path("teachers/", TeacherProfileListCreateView.as_view(), name="teacher-list-create"),
    path("teachers/<uuid:pk>/", TeacherProfileDetailView.as_view(), name="teacher-detail"),
    path("offerings/", SkillOfferingListCreateView.as_view(), name="offering-list-create"),
    path("offerings/<uuid:pk>/", SkillOfferingDetailView.as_view(), name="offering-detail"),
    path("bookings/", SkillBookingListCreateView.as_view(), name="booking-list-create"),
    path("bookings/<uuid:pk>/", SkillBookingDetailView.as_view(), name="booking-detail"),
    path("reviews/", ReviewRatingListCreateView.as_view(), name="review-list-create"),
]
