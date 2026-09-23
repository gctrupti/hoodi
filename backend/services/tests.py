from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from payments.models import Wallet
from .models import (
    ServiceCategory,
    ServiceSubcategory,
    ServiceProviderProfile,
    ServiceListing,
    ServiceRequestBooking,
    ServiceQuote,
    ServiceReview,
)

class ServicesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.customer = User.objects.create_user(
            email="customer@hoodi.com",
            password="password123",
            full_name="Ananya Roy",
            phone="+919876543210",
        )
        self.provider_user = User.objects.create_user(
            email="electrician@hoodi.com",
            password="password123",
            full_name="Suresh Kumar",
            phone="+919876543211",
            latitude=12.9716,
            longitude=77.5946,
        )

        # Provider Profile
        self.provider_profile = ServiceProviderProfile.objects.create(
            user=self.provider_user,
            business_name="Suresh Electrical Solutions",
            bio="Licensed electrician with 8+ years experience in Bengaluru.",
            experience_years=8,
            is_verified_provider=True,
            is_available=True,
            service_radius_km=Decimal("15.00"),
            latitude=12.9716,
            longitude=77.5946,
            address="Koramangala, Bengaluru",
        )

        # Categories
        self.home_cat = ServiceCategory.objects.create(
            name="Home Services",
            slug="home-services",
            icon="Wrench",
            description="Plumbing, electrical, cleaning",
            sort_order=1,
        )
        self.elec_subcat = ServiceSubcategory.objects.create(
            category=self.home_cat,
            name="Electrical",
            slug="electrical",
        )

        # Service Listing
        self.listing = ServiceListing.objects.create(
            provider=self.provider_profile,
            category=self.home_cat,
            subcategory=self.elec_subcat,
            title="Switchboard Repair & Fan Installation",
            description="Complete electrical repair, switchboard replacement and ceiling fan installation.",
            pricing_type="starting_from",
            base_price=Decimal("399.00"),
            estimated_duration_mins=45,
            service_area_radius_km=Decimal("12.00"),
            is_active=True,
        )

    def test_category_list_public(self):
        res = self.client.get(reverse("service-categories-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Handle paginated or unpaginated results
        data = res.data.get("results") if isinstance(res.data, dict) and "results" in res.data else res.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], "home-services")

    def test_listing_list_and_search(self):
        res = self.client.get(reverse("service-listings-list") + "?category=home-services")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data.get("results") if isinstance(res.data, dict) and "results" in res.data else res.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Switchboard Repair & Fan Installation")

    def test_booking_lifecycle_and_commission(self):
        # 1. Customer creates booking request
        self.client.force_authenticate(user=self.customer)
        booking_data = {
            "provider": str(self.provider_profile.id),
            "listing": str(self.listing.id),
            "category": str(self.home_cat.id),
            "title": "Need 2 switchboards replaced",
            "description": "Sparks from living room switchboard, urgent fix needed.",
            "scheduled_date": "2026-10-01",
            "scheduled_time_slot": "morning",
            "address": "Indiranagar 100ft Road, Bengaluru",
            "budget": "800.00",
        }
        res = self.client.post(reverse("service-bookings-list"), booking_data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        booking_id = res.data["id"]

        # 2. Provider sends itemized quotation
        self.client.force_authenticate(user=self.provider_user)
        quote_payload = {
            "total_amount": "850.00",
            "estimated_duration": "1 hour",
            "itemized_items": [
                {"description": "Inspection & diagnostic", "amount": 150},
                {"description": "Switchboard replacement labor", "amount": 500},
                {"description": "Parts (Anchor Roma switches)", "amount": 200},
            ],
            "notes": "Original parts included with 6-month warranty",
        }
        res = self.client.post(f"/api/services/bookings/{booking_id}/send_quote/", quote_payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        quote_id = res.data["id"]

        # Check booking status changed to quote_sent
        booking = ServiceRequestBooking.objects.get(pk=booking_id)
        self.assertEqual(booking.status, "quote_sent")

        # 3. Customer accepts quote
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(f"/api/services/bookings/{booking_id}/accept_quote/", {"quote_id": quote_id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.status, "accepted")
        self.assertEqual(booking.final_price, Decimal("850.00"))
        # 10% commission on ₹850 = ₹85
        self.assertEqual(booking.commission_amount, Decimal("85.00"))

        # 4. Provider completes service
        self.client.force_authenticate(user=self.provider_user)
        res = self.client.post(f"/api/services/bookings/{booking_id}/complete_service/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.status, "completed")
        self.provider_profile.refresh_from_db()
        self.assertEqual(self.provider_profile.completed_jobs_count, 1)

        # Check provider wallet credited with net earnings (850 - 85 = 765)
        wallet = Wallet.objects.get(user=self.provider_user)
        self.assertEqual(wallet.balance, Decimal("765.00"))

        # 5. Customer submits review
        self.client.force_authenticate(user=self.customer)
        review_data = {
            "booking": str(booking.id),
            "provider": str(self.provider_profile.id),
            "rating": 5,
            "quality_rating": 5,
            "punctuality_rating": 5,
            "communication_rating": 5,
            "value_rating": 4,
            "comment": "Punctual, professional and clean work! Highly recommended.",
        }
        res = self.client.post(reverse("service-reviews"), review_data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.provider_profile.refresh_from_db()
        self.assertEqual(self.provider_profile.rating, Decimal("5.00"))
