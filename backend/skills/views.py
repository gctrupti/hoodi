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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        offering = serializer.validated_data["offering"]
        booking_date = serializer.validated_data["booking_date"]
        start_time = serializer.validated_data["start_time"]

        from services_domain.booking_service import BookingService
        from services_domain.exceptions import HoodiDomainException

        try:
            booking = BookingService.create_booking(
                learner=request.user,
                offering_id=offering.id,
                booking_date=booking_date,
                start_time=start_time,
            )
            out_serializer = self.get_serializer(booking)
            return Response(out_serializer.data, status=status.HTTP_201_CREATED)
        except HoodiDomainException as e:
            return Response({"error": str(e), "code": e.code}, status=e.status_code)

class SkillBookingDetailView(generics.RetrieveUpdateAPIView):
    queryset = SkillBooking.objects.all()
    serializer_class = SkillBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        new_status = request.data.get("status")
        if new_status and new_status != instance.status:
            from services_domain.booking_service import BookingService
            from services_domain.exceptions import HoodiDomainException
            try:
                booking = BookingService.transition_booking_status(
                    booking_id=instance.id,
                    user=request.user,
                    new_status=new_status,
                )
                serializer = self.get_serializer(booking)
                return Response(serializer.data)
            except HoodiDomainException as e:
                return Response({"error": str(e), "code": e.code}, status=e.status_code)
        return super().update(request, *args, partial=partial, **kwargs)

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
