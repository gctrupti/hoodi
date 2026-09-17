from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import TeacherProfile, SkillOffering, AvailabilitySlot, SkillBooking, ReviewRating
from .serializers import (
    TeacherProfileSerializer,
    SkillOfferingSerializer,
    AvailabilitySlotSerializer,
    SkillBookingSerializer,
    ReviewRatingSerializer,
)

class TeacherProfileListCreateView(generics.ListCreateAPIView):
    queryset = TeacherProfile.objects.filter(is_approved=True)
    serializer_class = TeacherProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        user = self.request.user
        user.is_teacher = True
        user.save()
        serializer.save(user=user)

class TeacherProfileDetailView(generics.RetrieveUpdateAPIView):
    queryset = TeacherProfile.objects.all()
    serializer_class = TeacherProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class SkillOfferingListCreateView(generics.ListCreateAPIView):
    serializer_class = SkillOfferingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = SkillOffering.objects.all()
        cat = self.request.query_params.get("category")
        if cat:
            qs = qs.filter(category=cat)
        teacher_id = self.request.query_params.get("teacher")
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        return qs

    def perform_create(self, serializer):
        teacher = TeacherProfile.objects.get(user=self.request.user)
        serializer.save(teacher=teacher)

class SkillOfferingDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SkillOffering.objects.all()
    serializer_class = SkillOfferingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class SkillBookingListCreateView(generics.ListCreateAPIView):
    serializer_class = SkillBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = self.request.query_params.get("role")
        if role == "teacher":
            return SkillBooking.objects.filter(offering__teacher__user=user)
        return SkillBooking.objects.filter(learner=user)

    def perform_create(self, serializer):
        offering = serializer.validated_data["offering"]
        serializer.save(learner=self.request.user, total_price=offering.price)

class SkillBookingDetailView(generics.RetrieveUpdateAPIView):
    queryset = SkillBooking.objects.all()
    serializer_class = SkillBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

class ReviewRatingListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewRatingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user_id = self.request.query_params.get("user")
        if user_id:
            return ReviewRating.objects.filter(target_user_id=user_id)
        return ReviewRating.objects.all()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
