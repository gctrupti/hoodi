import uuid
import math
from decimal import Decimal
from django.db import models
from django.conf import settings

def calculate_distance_km(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return None
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


class ServiceCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    icon = models.CharField(max_length=100, default="Wrench")
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Service Categories"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class ServiceSubcategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ServiceCategory, on_delete=models.CASCADE, related_name="subcategories")
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Service Subcategories"
        unique_together = ("category", "slug")
        ordering = ["name"]

    def __str__(self):
        return f"{self.category.name} -> {self.name}"


class ServiceProviderProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="service_provider_profile")
    business_name = models.CharField(max_length=255)
    bio = models.TextField(blank=True)
    experience_years = models.IntegerField(default=1)
    service_radius_km = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("15.00"))
    is_verified_provider = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    is_suspended = models.BooleanField(default=False)
    working_hours = models.JSONField(default=dict, blank=True)
    skills = models.JSONField(default=list, blank=True)
    languages = models.JSONField(default=list, blank=True)
    portfolio_items = models.JSONField(default=list, blank=True)
    certifications = models.JSONField(default=list, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("5.00"))
    completed_jobs_count = models.IntegerField(default=0)
    address = models.CharField(max_length=500, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.business_name} ({self.user.email})"


class ServiceListing(models.Model):
    PRICING_TYPES = [
        ("fixed", "Fixed Price"),
        ("starting_from", "Starting From"),
        ("hourly", "Hourly Rate"),
        ("custom_quote", "Custom Quotation"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(ServiceProviderProfile, on_delete=models.CASCADE, related_name="listings")
    category = models.ForeignKey(ServiceCategory, on_delete=models.PROTECT, related_name="listings")
    subcategory = models.ForeignKey(ServiceSubcategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="listings")
    title = models.CharField(max_length=255)
    description = models.TextField()
    pricing_type = models.CharField(max_length=50, choices=PRICING_TYPES, default="starting_from")
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("499.00"))
    estimated_duration_mins = models.IntegerField(default=60)
    service_area_radius_km = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    images = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("5.00"))
    completed_jobs = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} by {self.provider.business_name}"


class ServiceRequestBooking(models.Model):
    STATUS_CHOICES = [
        ("requested", "Requested"),
        ("provider_review", "Provider Review"),
        ("quote_sent", "Quote Sent"),
        ("accepted", "Accepted"),
        ("scheduled", "Scheduled"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("rejected", "Rejected"),
        ("disputed", "Disputed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="service_bookings_requested")
    provider = models.ForeignKey(ServiceProviderProfile, on_delete=models.CASCADE, related_name="bookings_received")
    listing = models.ForeignKey(ServiceListing, on_delete=models.SET_NULL, null=True, blank=True, related_name="bookings")
    category = models.ForeignKey(ServiceCategory, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    scheduled_date = models.DateField()
    scheduled_time_slot = models.CharField(max_length=100, default="morning")
    address = models.CharField(max_length=500)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    photos = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="requested")
    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    cancellation_reason = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Booking #{self.id.hex[:8]} - {self.title} ({self.get_status_display()})"


class ServiceQuote(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("modified", "Modified"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(ServiceRequestBooking, on_delete=models.CASCADE, related_name="quotes")
    provider = models.ForeignKey(ServiceProviderProfile, on_delete=models.CASCADE, related_name="quotes_sent")
    itemized_items = models.JSONField(default=list)  # e.g. [{"description": "Labor", "amount": 800}]
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    estimated_duration = models.CharField(max_length=100, default="1-2 hours")
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Quote ₹{self.total_amount} for Booking {self.booking_id}"


class ServiceReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(ServiceRequestBooking, on_delete=models.CASCADE, related_name="review")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="service_reviews_given")
    provider = models.ForeignKey(ServiceProviderProfile, on_delete=models.CASCADE, related_name="reviews")
    rating = models.IntegerField(default=5)
    quality_rating = models.IntegerField(null=True, blank=True)
    punctuality_rating = models.IntegerField(null=True, blank=True)
    communication_rating = models.IntegerField(null=True, blank=True)
    value_rating = models.IntegerField(null=True, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review ({self.rating} stars) for {self.provider.business_name}"


class ServiceDispute(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("under_review", "Under Review"),
        ("resolved", "Resolved"),
        ("dismissed", "Dismissed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(ServiceRequestBooking, on_delete=models.CASCADE, related_name="disputes")
    raised_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="open")
    resolution_note = models.TextField(blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_disputes")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dispute #{self.id.hex[:8]} on Booking {self.booking_id}"
