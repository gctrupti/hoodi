from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "username", "full_name", "phone",
            "avatar_url", "cover_url", "bio", "address",
            "latitude", "longitude", "is_verified", "is_helper",
            "is_teacher", "is_admin_user", "rating", "completed_tasks_count",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "rating", "completed_tasks_count", "created_at", "updated_at"]

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    tokens = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "password", "tokens"]

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data.get("full_name", "")
        )

    def get_tokens(self, user):
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
