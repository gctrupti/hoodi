import uuid
from django.db import models
from django.conf import settings

class TeacherProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_profile")
    headline = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    experience_years = models.IntegerField(default=1)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Teacher: {self.user.full_name or self.user.email}"

class SkillOffering(models.Model):
    CATEGORY_CHOICES = [
        ("coding", "Coding & Tech"),
        ("music", "Music"),
        ("language", "Languages"),
        ("cooking", "Cooking & Baking"),
        ("fitness", "Fitness & Yoga"),
        ("crafts", "Arts & Crafts"),
        ("academics", "School & Academics"),
        ("other", "Other Skills"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name="offerings")
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="other")
    duration_minutes = models.IntegerField(default=60)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)
    is_online = models.BooleanField(default=True)
    is_in_person = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} by {self.teacher.user.full_name or self.teacher.user.email}"

class AvailabilitySlot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name="availability_slots")
    day_of_week = models.IntegerField(choices=[(i, str(i)) for i in range(7)]) # 0=Monday, 6=Sunday
    start_time = models.TimeField()
    end_time = models.TimeField()

class SkillBooking(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offering = models.ForeignKey(SkillOffering, on_delete=models.CASCADE, related_name="bookings")
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="skill_bookings")
    booking_date = models.DateField()
    start_time = models.TimeField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="pending")
    meeting_link = models.URLField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-booking_date", "-start_time"]

class ReviewRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews_received")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews_written")
    booking = models.ForeignKey(SkillBooking, on_delete=models.SET_NULL, null=True, blank=True)
    rating = models.IntegerField(default=5)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
