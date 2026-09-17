from rest_framework import serializers
from accounts.serializers import UserSerializer
from .models import TeacherProfile, SkillOffering, AvailabilitySlot, SkillBooking, ReviewRating

class AvailabilitySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilitySlot
        fields = ["id", "teacher", "day_of_week", "start_time", "end_time"]
        read_only_fields = ["id", "teacher"]

class SkillOfferingSerializer(serializers.ModelSerializer):
    teacher_name = serializers.ReadOnlyField(source="teacher.user.full_name")
    teacher_avatar = serializers.ReadOnlyField(source="teacher.user.avatar_url")
    teacher_rating = serializers.ReadOnlyField(source="teacher.user.rating")

    class Meta:
        model = SkillOffering
        fields = [
            "id", "teacher", "teacher_name", "teacher_avatar", "teacher_rating",
            "title", "description", "category", "duration_minutes",
            "price", "is_online", "is_in_person", "created_at"
        ]
        read_only_fields = ["id", "teacher", "created_at"]

class TeacherProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    offerings = SkillOfferingSerializer(many=True, read_only=True)
    availability_slots = AvailabilitySlotSerializer(many=True, read_only=True)

    class Meta:
        model = TeacherProfile
        fields = [
            "id", "user", "headline", "bio", "experience_years",
            "hourly_rate", "is_approved", "offerings", "availability_slots", "created_at"
        ]
        read_only_fields = ["id", "user", "created_at"]

class SkillBookingSerializer(serializers.ModelSerializer):
    learner = UserSerializer(read_only=True)
    offering_title = serializers.ReadOnlyField(source="offering.title")
    teacher_name = serializers.ReadOnlyField(source="offering.teacher.user.full_name")

    class Meta:
        model = SkillBooking
        fields = [
            "id", "offering", "offering_title", "teacher_name", "learner",
            "booking_date", "start_time", "total_price", "status",
            "meeting_link", "created_at"
        ]
        read_only_fields = ["id", "learner", "status", "created_at"]

class ReviewRatingSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source="author.full_name")
    author_avatar = serializers.ReadOnlyField(source="author.avatar_url")

    class Meta:
        model = ReviewRating
        fields = ["id", "target_user", "author", "author_name", "author_avatar", "booking", "rating", "comment", "created_at"]
        read_only_fields = ["id", "author", "created_at"]
