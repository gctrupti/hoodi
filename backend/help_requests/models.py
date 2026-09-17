import uuid
import math
from django.db import models
from django.conf import settings

def calculate_distance_km(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return None
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

class HelpRequest(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("accepted", "Accepted"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    CATEGORY_CHOICES = [
        ("delivery", "Pickup & Delivery"),
        ("home_assistance", "Home Assistance"),
        ("transport", "Transport"),
        ("other", "Other"),
    ]

    URGENCY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="help_requests_created")
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="help_tasks_accepted")
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="other")
    urgency = models.CharField(max_length=50, choices=URGENCY_CHOICES, default="normal")
    fare_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="open")

    # Pickup Location
    pickup_address = models.CharField(max_length=500, blank=True)
    pickup_latitude = models.FloatField(null=True, blank=True)
    pickup_longitude = models.FloatField(null=True, blank=True)

    # Dropoff Location (optional for delivery/transport)
    dropoff_address = models.CharField(max_length=500, blank=True)
    dropoff_latitude = models.FloatField(null=True, blank=True)
    dropoff_longitude = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(HelpRequest, on_delete=models.CASCADE, related_name="chat_messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

class LocationTracking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(HelpRequest, on_delete=models.CASCADE, related_name="tracking_points")
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    latitude = models.FloatField()
    longitude = models.FloatField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]
