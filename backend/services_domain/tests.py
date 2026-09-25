"""
Unit tests for Hoodi Domain Services.
Validates business logic, state machines, concurrency guards, and financial ledger calculations.
"""
from decimal import Decimal
from datetime import date, time
from django.test import TestCase
from accounts.models import User
from help_requests.models import HelpRequest
from payments.models import Wallet, WalletTransaction
from skills.models import TeacherProfile, SkillOffering, SkillBooking
from services_domain import (
    HelpRequestService,
    MatchingService,
    PaymentLedgerService,
    BookingService,
    TaskAlreadyAssignedException,
    SelfAssignmentForbiddenException,
    InvalidTaskStatusTransitionException,
    InsufficientFundsException,
    SlotConflictException,
    UnauthorizedAccessException,
)

class DomainServicesTestCase(TestCase):
    def setUp(self):
        # Create test users
        self.user_a = User.objects.create_user(email="requester@test.com", password="password123", full_name="User A")
        self.user_b = User.objects.create_user(email="helper@test.com", password="password123", full_name="User B")
        self.user_c = User.objects.create_user(email="intruder@test.com", password="password123", full_name="User C")

    def test_help_request_creation_and_atomic_acceptance(self):
        req = HelpRequestService.create_request(
            requester=self.user_a,
            title="Pick up groceries from supermarket",
            description="Need milk and bread urgently",
            category="delivery",
            urgency="high",
            pickup_address="123 Main St",
            pickup_lat=12.9716,
            pickup_lon=77.5946,
            fare_amount=Decimal("150.00")
        )
        self.assertEqual(req.status, "open")
        self.assertEqual(req.requester, self.user_a)

        # Self-acceptance must be forbidden
        with self.assertRaises(SelfAssignmentForbiddenException):
            HelpRequestService.accept_request(req.id, self.user_a)

        # Successful acceptance by User B
        accepted_req = HelpRequestService.accept_request(req.id, self.user_b)
        self.assertEqual(accepted_req.status, "accepted")
        self.assertEqual(accepted_req.helper, self.user_b)

        # Second acceptance attempt must be rejected (atomic double-acceptance prevention)
        with self.assertRaises(TaskAlreadyAssignedException):
            HelpRequestService.accept_request(req.id, self.user_c)

    def test_help_request_state_machine_transitions(self):
        req = HelpRequestService.create_request(
            requester=self.user_a,
            title="Fix leaking tap",
            description="Kitchen tap is dripping",
            fare_amount=Decimal("200.00")
        )
        HelpRequestService.accept_request(req.id, self.user_b)

        # Unauthorized user cannot transition status
        with self.assertRaises(UnauthorizedAccessException):
            HelpRequestService.transition_status(req.id, self.user_c, "in_progress")

        # Invalid transition: cannot jump from 'accepted' to 'completed' directly
        with self.assertRaises(InvalidTaskStatusTransitionException):
            HelpRequestService.transition_status(req.id, self.user_b, "completed")

        # Valid transition: accepted -> in_progress -> completed
        in_prog = HelpRequestService.transition_status(req.id, self.user_b, "in_progress")
        self.assertEqual(in_prog.status, "in_progress")

        comp = HelpRequestService.transition_status(req.id, self.user_b, "completed")
        self.assertEqual(comp.status, "completed")
        self.assertIsNotNone(comp.completed_at)

        # Helper task count should have incremented
        self.user_b.refresh_from_db()
        self.assertEqual(self.user_b.completed_tasks_count, 1)

    def test_matching_service_bounding_box_filter(self):
        # Center in Bangalore: (12.9716, 77.5946)
        # Create nearby request (~1 km away)
        req_near = HelpRequestService.create_request(
            requester=self.user_a,
            title="Nearby errand",
            description="Just down the street",
            pickup_lat=12.9720,
            pickup_lon=77.5950,
            fare_amount=Decimal("100.00")
        )
        # Create distant request in Mysore (~140 km away)
        req_far = HelpRequestService.create_request(
            requester=self.user_a,
            title="Distant errand",
            description="Far away in another city",
            pickup_lat=12.2958,
            pickup_lon=76.6394,
            fare_amount=Decimal("500.00")
        )

        nearby = MatchingService.find_nearby_requests(
            current_user=self.user_b,
            latitude=12.9716,
            longitude=77.5946,
            radius_km=5.0
        )

        nearby_ids = [n["request"].id for n in nearby]
        self.assertIn(req_near.id, nearby_ids)
        self.assertNotIn(req_far.id, nearby_ids)

    def test_payment_ledger_service_credit_and_debit(self):
        # Initial wallet balance is 0
        w = PaymentLedgerService.get_or_create_wallet(self.user_b)
        self.assertEqual(w.balance, Decimal("0.00"))

        # Credit wallet with ₹500
        res = PaymentLedgerService.credit_wallet(
            user=self.user_b,
            amount=Decimal("500.00"),
            description="Deposit",
            reference_id="DEP_101"
        )
        self.assertEqual(res["new_balance"], Decimal("500.00"))

        # Debit with insufficient balance must fail
        with self.assertRaises(InsufficientFundsException):
            PaymentLedgerService.debit_wallet(
                user=self.user_b,
                amount=Decimal("600.00"),
                description="Withdrawal"
            )

        # Successful debit of ₹200
        debit_res = PaymentLedgerService.debit_wallet(
            user=self.user_b,
            amount=Decimal("200.00"),
            description="Payout",
            reference_id="PAYOUT_102"
        )
        self.assertEqual(debit_res["new_balance"], Decimal("300.00"))

        # Verify transaction history count
        tx_count = WalletTransaction.objects.filter(wallet=w).count()
        self.assertEqual(tx_count, 2)

    def test_settle_task_earnings_commission_accuracy(self):
        # Total ₹200 delivery errand (15% platform fee = ₹30, helper gets ₹170)
        settle_res = PaymentLedgerService.settle_task_earnings(
            recipient_user=self.user_b,
            total_amount=Decimal("200.00"),
            category="delivery",
            task_id="TEST_TASK_001"
        )
        self.assertEqual(settle_res["total_amount"], 200.00)
        self.assertEqual(settle_res["platform_commission"], 30.00)
        self.assertEqual(settle_res["net_credited"], 170.00)
        self.assertEqual(settle_res["recipient_wallet_balance"], 170.00)

    def test_booking_service_slot_conflict_prevention(self):
        teacher_prof = TeacherProfile.objects.create(
            user=self.user_a,
            headline="Guitar Maestro",
            experience_years=5,
            hourly_rate=Decimal("600.00")
        )
        offering = SkillOffering.objects.create(
            teacher=teacher_prof,
            title="Acoustic Guitar Lessons",
            description="Learn fingerstyle",
            category="music",
            price=Decimal("600.00")
        )

        test_date = date(2026, 10, 15)
        test_time = time(14, 0)

        # Learner B books the slot
        booking = BookingService.create_booking(
            learner=self.user_b,
            offering_id=offering.id,
            booking_date=test_date,
            start_time=test_time
        )
        self.assertEqual(booking.status, "pending")

        # Learner C attempts to book the EXACT SAME slot -> conflict error!
        with self.assertRaises(SlotConflictException):
            BookingService.create_booking(
                learner=self.user_c,
                offering_id=offering.id,
                booking_date=test_date,
                start_time=test_time
            )
