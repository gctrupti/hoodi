from django.contrib import admin
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

@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "icon", "sort_order", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "slug"]


@admin.register(ServiceSubcategory)
class ServiceSubcategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "slug", "is_active", "created_at"]
    list_filter = ["category", "is_active"]
    search_fields = ["name", "slug"]


@admin.register(ServiceProviderProfile)
class ServiceProviderProfileAdmin(admin.ModelAdmin):
    list_display = ["business_name", "user", "experience_years", "is_verified_provider", "is_available", "is_suspended", "rating", "completed_jobs_count"]
    list_filter = ["is_verified_provider", "is_available", "is_suspended"]
    search_fields = ["business_name", "user__email", "user__full_name"]


@admin.register(ServiceListing)
class ServiceListingAdmin(admin.ModelAdmin):
    list_display = ["title", "provider", "category", "pricing_type", "base_price", "is_active", "rating", "completed_jobs"]
    list_filter = ["pricing_type", "is_active", "category"]
    search_fields = ["title", "description", "provider__business_name"]


@admin.register(ServiceRequestBooking)
class ServiceRequestBookingAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "customer", "provider", "scheduled_date", "status", "final_price", "commission_amount"]
    list_filter = ["status", "scheduled_date"]
    search_fields = ["title", "customer__email", "provider__business_name"]


@admin.register(ServiceQuote)
class ServiceQuoteAdmin(admin.ModelAdmin):
    list_display = ["id", "booking", "provider", "total_amount", "status", "created_at"]
    list_filter = ["status"]


@admin.register(ServiceReview)
class ServiceReviewAdmin(admin.ModelAdmin):
    list_display = ["provider", "reviewer", "rating", "created_at"]
    list_filter = ["rating"]


@admin.register(ServiceDispute)
class ServiceDisputeAdmin(admin.ModelAdmin):
    list_display = ["id", "booking", "raised_by", "reason", "status", "created_at"]
    list_filter = ["status"]
