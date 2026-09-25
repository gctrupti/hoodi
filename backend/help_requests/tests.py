from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from help_requests.models import HelpRequest

class HelpRequestsApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.requester = User.objects.create_user(
            email="requester@hoodi.com",
            password="password123",
            full_name="Vikram Mehta",
            latitude=12.9716,
            longitude=77.5946,
        )
        self.helper1 = User.objects.create_user(
            email="helper1@hoodi.com",
            password="password123",
            full_name="Rahul Nair",
            is_helper=True,
            latitude=12.9720,
            longitude=77.5950,
        )
        self.helper2 = User.objects.create_user(
            email="helper2@hoodi.com",
            password="password123",
            full_name="Deepak Joshi",
            is_helper=True,
            latitude=12.9730,
            longitude=77.5960,
        )

        self.request_obj = HelpRequest.objects.create(
            requester=self.requester,
            title="Urgent Pharmacy Delivery",
            description="Need paracetamol and cough syrup from Apollo Pharmacy.",
            category="delivery",
            urgency="emergency",
            pickup_latitude=12.9720,
            pickup_longitude=77.5950,
            status="open",
            fare_amount=Decimal("120.00"),
        )

    def test_nearby_requests_bounding_box_filter(self):
        self.client.force_authenticate(user=self.helper1)
        res = self.client.get(
            reverse("help-requests-nearby"),
            {"latitude": 12.9716, "longitude": 77.5946, "radius": 5.0}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data if isinstance(res.data, list) else res.data.get("results", [])
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], str(self.request_obj.id))
        self.assertIn("distance_km", data[0])
        self.assertLess(data[0]["distance_km"], 1.0)

    def test_accept_task_atomic_success(self):
        self.client.force_authenticate(user=self.helper1)
        res = self.client.post(
            reverse("help-request-accept", kwargs={"pk": self.request_obj.id})
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "accepted")

        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, "accepted")
        self.assertEqual(self.request_obj.helper, self.helper1)

    def test_prevent_double_acceptance(self):
        # helper1 accepts first
        self.client.force_authenticate(user=self.helper1)
        res1 = self.client.post(
            reverse("help-request-accept", kwargs={"pk": self.request_obj.id})
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # helper2 tries to accept the already accepted task
        self.client.force_authenticate(user=self.helper2)
        res2 = self.client.post(
            reverse("help-request-accept", kwargs={"pk": self.request_obj.id})
        )
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res2.data.get("code"), "task_already_assigned")

    def test_prevent_self_acceptance(self):
        self.client.force_authenticate(user=self.requester)
        res = self.client.post(
            reverse("help-request-accept", kwargs={"pk": self.request_obj.id})
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get("code"), "self_assignment_forbidden")

    def test_status_transition_lifecycle(self):
        # 1. Accept
        self.client.force_authenticate(user=self.helper1)
        self.client.post(reverse("help-request-accept", kwargs={"pk": self.request_obj.id}))

        # 2. Transition accepted -> in_progress
        res_progress = self.client.post(
            reverse("help-request-status", kwargs={"pk": self.request_obj.id}),
            {"status": "in_progress"}
        )
        self.assertEqual(res_progress.status_code, status.HTTP_200_OK)
        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, "in_progress")

        # 3. Transition in_progress -> completed
        res_completed = self.client.post(
            reverse("help-request-status", kwargs={"pk": self.request_obj.id}),
            {"status": "completed"}
        )
        self.assertEqual(res_completed.status_code, status.HTTP_200_OK)
        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, "completed")
