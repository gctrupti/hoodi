from rest_framework import serializers
from accounts.serializers import UserSerializer
from .models import HelpRequest, ChatMessage, LocationTracking, calculate_distance_km

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source="sender.full_name")
    sender_email = serializers.ReadOnlyField(source="sender.email")
    sender_avatar = serializers.ReadOnlyField(source="sender.avatar_url")

    class Meta:
        model = ChatMessage
        fields = ["id", "request", "sender", "sender_name", "sender_email", "sender_avatar", "message", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]

class LocationTrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationTracking
        fields = ["id", "request", "helper", "latitude", "longitude", "recorded_at"]
        read_only_fields = ["id", "helper", "recorded_at"]

class HelpRequestSerializer(serializers.ModelSerializer):
    requester = UserSerializer(read_only=True)
    helper = UserSerializer(read_only=True)
    distance_km = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = HelpRequest
        fields = [
            "id", "requester", "helper", "title", "description",
            "category", "urgency", "fare_amount", "status",
            "pickup_address", "pickup_latitude", "pickup_longitude",
            "dropoff_address", "dropoff_latitude", "dropoff_longitude",
            "distance_km", "created_at", "updated_at", "completed_at"
        ]
        read_only_fields = ["id", "requester", "helper", "status", "created_at", "updated_at", "completed_at"]

    def get_distance_km(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        user_lat = request.query_params.get("latitude")
        user_lon = request.query_params.get("longitude")
        if user_lat is not None and user_lon is not None and obj.pickup_latitude is not None and obj.pickup_longitude is not None:
            try:
                return calculate_distance_km(float(user_lat), float(user_lon), obj.pickup_latitude, obj.pickup_longitude)
            except (ValueError, TypeError):
                return None
        return None
