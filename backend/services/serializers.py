from decimal import Decimal
from rest_framework import serializers
from .models import (
    ServiceCategory,
    ServiceSubcategory,
    ServiceProviderProfile,
    ServiceListing,
    ServiceRequestBooking,
    ServiceQuote,
    ServiceReview,
    ServiceDispute,
)
from accounts.models import User

class ServiceSubcategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceSubcategory
        fields = ["id", "category", "name", "slug", "description", "is_active", "created_at"]


class ServiceCategorySerializer(serializers.ModelSerializer):
    subcategories = ServiceSubcategorySerializer(many=True, read_only=True)

    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "icon", "description", "sort_order", "is_active", "subcategories", "created_at"]


class ServiceProviderProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    user_avatar = serializers.URLField(source="user.avatar_url", read_only=True)
    user_phone = serializers.CharField(source="user.phone", read_only=True)
    is_identity_verified = serializers.BooleanField(source="user.is_verified", read_only=True)

    class Meta:
        model = ServiceProviderProfile
        fields = [
            "id",
            "user",
            "user_email",
            "user_full_name",
            "user_avatar",
            "user_phone",
            "is_identity_verified",
            "business_name",
            "bio",
            "experience_years",
            "service_radius_km",
            "is_verified_provider",
            "is_available",
            "is_suspended",
            "working_hours",
            "skills",
            "languages",
            "portfolio_items",
            "certifications",
            "rating",
            "completed_jobs_count",
            "address",
            "latitude",
            "longitude",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "rating", "completed_jobs_count", "created_at", "updated_at"]


class ServiceListingSerializer(serializers.ModelSerializer):
    provider_business_name = serializers.CharField(source="provider.business_name", read_only=True)
    provider_rating = serializers.DecimalField(source="provider.rating", max_digits=3, decimal_places=2, read_only=True)
    provider_is_verified = serializers.BooleanField(source="provider.is_verified_provider", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    subcategory_name = serializers.CharField(source="subcategory.name", read_only=True, allow_null=True)

    class Meta:
        model = ServiceListing
        fields = [
            "id",
            "provider",
            "provider_business_name",
            "provider_rating",
            "provider_is_verified",
            "category",
            "category_name",
            "subcategory",
            "subcategory_name",
            "title",
            "description",
            "pricing_type",
            "base_price",
            "estimated_duration_mins",
            "service_area_radius_km",
            "images",
            "is_active",
            "rating",
            "completed_jobs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "rating", "completed_jobs", "created_at", "updated_at"]


class ServiceQuoteSerializer(serializers.ModelSerializer):
    provider_business_name = serializers.CharField(source="provider.business_name", read_only=True)

    class Meta:
        model = ServiceQuote
        fields = [
            "id",
            "booking",
            "provider",
            "provider_business_name",
            "itemized_items",
            "total_amount",
            "estimated_duration",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ServiceReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source="reviewer.full_name", read_only=True)
    reviewer_avatar = serializers.URLField(source="reviewer.avatar_url", read_only=True)

    class Meta:
        model = ServiceReview
        fields = [
            "id",
            "booking",
            "reviewer",
            "reviewer_name",
            "reviewer_avatar",
            "provider",
            "rating",
            "quality_rating",
            "punctuality_rating",
            "communication_rating",
            "value_rating",
            "comment",
            "created_at",
        ]
        read_only_fields = ["id", "reviewer", "created_at"]


class ServiceRequestBookingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_email = serializers.EmailField(source="customer.email", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    provider_business_name = serializers.CharField(source="provider.business_name", read_only=True)
    listing_title = serializers.CharField(source="listing.title", read_only=True, allow_null=True)
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    quotes = ServiceQuoteSerializer(many=True, read_only=True)
    review = ServiceReviewSerializer(read_only=True)

    class Meta:
        model = ServiceRequestBooking
        fields = [
            "id",
            "customer",
            "customer_name",
            "customer_email",
            "customer_phone",
            "provider",
            "provider_business_name",
            "listing",
            "listing_title",
            "category",
            "category_name",
            "title",
            "description",
            "scheduled_date",
            "scheduled_time_slot",
            "address",
            "latitude",
            "longitude",
            "budget",
            "notes",
            "photos",
            "status",
            "final_price",
            "commission_amount",
            "cancellation_reason",
            "completed_at",
            "quotes",
            "review",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer",
            "commission_amount",
            "completed_at",
            "created_at",
            "updated_at",
        ]


class ServiceDisputeSerializer(serializers.ModelSerializer):
    raised_by_email = serializers.EmailField(source="raised_by.email", read_only=True)

    class Meta:
        model = ServiceDispute
        fields = [
            "id",
            "booking",
            "raised_by",
            "raised_by_email",
            "reason",
            "description",
            "status",
            "resolution_note",
            "resolved_by",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "raised_by", "resolved_at", "created_at", "updated_at"]
