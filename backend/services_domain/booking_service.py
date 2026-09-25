"""
BookingService: Domain service managing peer-to-peer skill offerings and bookings.
Guarantees slot collision prevention and booking state machine transitions.
"""
from datetime import date, time
from django.db import transaction
from skills.models import SkillOffering, SkillBooking
from .exceptions import (
    SlotConflictException,
    UnauthorizedAccessException,
    HoodiDomainException,
)

class BookingService:
    @staticmethod
    def create_booking(
        learner,
        offering_id,
        booking_date: date,
        start_time: time,
    ) -> SkillBooking:
        """
        Creates a skill booking while guarding against slot double-booking.
        """
        try:
            offering = SkillOffering.objects.select_related("teacher__user").get(pk=offering_id)
        except SkillOffering.DoesNotExist:
            raise HoodiDomainException("Skill offering not found.", code="offering_not_found", status_code=404)

        if offering.teacher.user_id == learner.id:
            raise HoodiDomainException("You cannot book your own skill offering.", code="self_booking_forbidden")

        with transaction.atomic():
            # Check for existing pending or confirmed bookings at the exact same slot
            conflict = (
                SkillBooking.objects
                .select_for_update()
                .filter(
                    offering=offering,
                    booking_date=booking_date,
                    start_time=start_time,
                    status__in=["pending", "confirmed"],
                )
                .exists()
            )

            if conflict:
                raise SlotConflictException("This time slot is already booked for this instructor.")

            booking = SkillBooking.objects.create(
                offering=offering,
                learner=learner,
                booking_date=booking_date,
                start_time=start_time,
                total_price=offering.price,
                status="pending",
            )

            return booking

    @staticmethod
    def transition_booking_status(booking_id, user, new_status: str) -> SkillBooking:
        """
        Transitions a booking status (confirmed, completed, cancelled).
        """
        if new_status not in ["confirmed", "completed", "cancelled"]:
            raise HoodiDomainException(f"Invalid status: {new_status}", code="invalid_status")

        with transaction.atomic():
            try:
                booking = (
                    SkillBooking.objects
                    .select_for_update()
                    .select_related("offering__teacher__user", "learner")
                    .get(pk=booking_id)
                )
            except SkillBooking.DoesNotExist:
                raise HoodiDomainException("Booking not found.", code="not_found", status_code=404)

            is_teacher = (booking.offering.teacher.user_id == user.id)
            is_learner = (booking.learner_id == user.id)

            if not (is_teacher or is_learner):
                raise UnauthorizedAccessException("You are not authorized to update this booking.")

            # Rule: only teacher can confirm
            if new_status == "confirmed" and not is_teacher:
                raise UnauthorizedAccessException("Only the instructor can confirm a booking.")

            booking.status = new_status
            booking.save()
            return booking
