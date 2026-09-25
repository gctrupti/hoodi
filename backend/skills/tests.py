from decimal import Decimal
from datetime import date, time
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from skills.models import TeacherProfile, SkillOffering, SkillBooking

class SkillsApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher_user = User.objects.create_user(
            email="teacher@hoodi.com",
            password="password123",
            full_name="Prof. Sharma",
            is_teacher=True,
        )
        self.learner_user = User.objects.create_user(
            email="learner@hoodi.com",
            password="password123",
            full_name="Pooja Patel",
        )
        self.competitor_learner = User.objects.create_user(
            email="learner2@hoodi.com",
            password="password123",
            full_name="Rohan Verma",
        )

        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            headline="Expert Math & Guitar Tutor",
            hourly_rate=Decimal("500.00"),
            is_approved=True,
        )

        self.offering = SkillOffering.objects.create(
            teacher=self.teacher_profile,
            title="Acoustic Guitar Basics",
            category="Music",
            duration_minutes=60,
            price=Decimal("450.00"),
            is_online=True,
        )

    def test_create_booking_success(self):
        self.client.force_authenticate(user=self.learner_user)
        payload = {
            "offering": self.offering.id,
            "booking_date": "2026-10-15",
            "start_time": "14:00:00",
        }
        res = self.client.post(reverse("booking-list-create"), payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["total_price"], "450.00")
        self.assertEqual(res.data["status"], "pending")

    def test_prevent_self_booking(self):
        self.client.force_authenticate(user=self.teacher_user)
        payload = {
            "offering": self.offering.id,
            "booking_date": "2026-10-15",
            "start_time": "14:00:00",
        }
        res = self.client.post(reverse("booking-list-create"), payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get("code"), "self_booking_forbidden")

    def test_prevent_slot_collision(self):
        # First booking succeeds
        self.client.force_authenticate(user=self.learner_user)
        payload = {
            "offering": self.offering.id,
            "booking_date": "2026-10-15",
            "start_time": "15:00:00",
        }
        res1 = self.client.post(reverse("booking-list-create"), payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second booking for exact same offering & time slot must be rejected
        self.client.force_authenticate(user=self.competitor_learner)
        res2 = self.client.post(reverse("booking-list-create"), payload)
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res2.data.get("code"), "slot_conflict")

    def test_teacher_confirms_booking(self):
        # Create booking as learner
        self.client.force_authenticate(user=self.learner_user)
        booking = SkillBooking.objects.create(
            offering=self.offering,
            learner=self.learner_user,
            booking_date=date(2026, 10, 16),
            start_time=time(10, 0),
            total_price=Decimal("450.00"),
            status="pending",
        )

        # Non-teacher tries to confirm -> forbidden
        self.client.force_authenticate(user=self.learner_user)
        res_fail = self.client.patch(
            reverse("booking-detail", kwargs={"pk": booking.id}),
            {"status": "confirmed"}
        )
        self.assertEqual(res_fail.status_code, status.HTTP_403_FORBIDDEN)

        # Teacher confirms -> success
        self.client.force_authenticate(user=self.teacher_user)
        res_ok = self.client.patch(
            reverse("booking-detail", kwargs={"pk": booking.id}),
            {"status": "confirmed"}
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "confirmed")
