"""
HelpRequestService: Domain service managing errand and help request lifecycles.
Encapsulates all business rules, permission gates, and state machine invariants.
"""
from typing import Optional, Tuple
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from help_requests.models import HelpRequest
from .exceptions import (
    TaskAlreadyAssignedException,
    SelfAssignmentForbiddenException,
    InvalidTaskStatusTransitionException,
    UnauthorizedAccessException,
    HoodiDomainException,
)

VALID_STATUS_TRANSITIONS = {
    "open": {"accepted", "cancelled"},
    "accepted": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}

class HelpRequestService:
    @staticmethod
    def create_request(
        requester,
        title: str,
        description: str,
        category: str = "other",
        urgency: str = "normal",
        pickup_address: str = "",
        pickup_lat: Optional[float] = None,
        pickup_lon: Optional[float] = None,
        dropoff_address: str = "",
        dropoff_lat: Optional[float] = None,
        dropoff_lon: Optional[float] = None,
        fare_amount: Decimal = Decimal("0.00"),
    ) -> HelpRequest:
        """Creates a new help request in 'open' status."""
        if not title or len(title.strip()) < 3:
            raise HoodiDomainException("Title must be at least 3 characters long.", code="invalid_title")

        if pickup_lat is not None and not (-90.0 <= pickup_lat <= 90.0):
            raise HoodiDomainException("Invalid latitude value.", code="invalid_coordinates")
        if pickup_lon is not None and not (-180.0 <= pickup_lon <= 180.0):
            raise HoodiDomainException("Invalid longitude value.", code="invalid_coordinates")

        help_req = HelpRequest.objects.create(
            requester=requester,
            title=title.strip(),
            description=description.strip(),
            category=category,
            urgency=urgency,
            fare_amount=fare_amount,
            status="open",
            pickup_address=pickup_address,
            pickup_latitude=pickup_lat,
            pickup_longitude=pickup_lon,
            dropoff_address=dropoff_address,
            dropoff_latitude=dropoff_lat,
            dropoff_longitude=dropoff_lon,
        )
        return help_req

    @staticmethod
    def accept_request(request_id, helper) -> HelpRequest:
        """
        Accepts a help request atomically.
        Uses atomic select_for_update to prevent double-acceptance race conditions.
        """
        with transaction.atomic():
            try:
                help_req = HelpRequest.objects.select_for_update().get(pk=request_id)
            except HelpRequest.DoesNotExist:
                raise HoodiDomainException("Help request not found.", code="not_found", status_code=404)

            if help_req.requester_id == helper.id:
                raise SelfAssignmentForbiddenException()

            if help_req.status != "open":
                raise TaskAlreadyAssignedException(
                    f"Request is not open for acceptance (current status: {help_req.status})."
                )

            help_req.helper = helper
            help_req.status = "accepted"
            help_req.save()
            return help_req

    @staticmethod
    def transition_status(request_id, user, new_status: str) -> HelpRequest:
        """
        Transitions a request to a new status according to state machine rules.
        """
        with transaction.atomic():
            try:
                help_req = HelpRequest.objects.select_for_update().get(pk=request_id)
            except HelpRequest.DoesNotExist:
                raise HoodiDomainException("Help request not found.", code="not_found", status_code=404)

            # Authorization check
            is_requester = (help_req.requester_id == user.id)
            is_helper = (help_req.helper_id == user.id)

            if not (is_requester or is_helper):
                raise UnauthorizedAccessException("Only the requester or assigned helper can update this request.")

            allowed = VALID_STATUS_TRANSITIONS.get(help_req.status, set())
            if new_status not in allowed:
                raise InvalidTaskStatusTransitionException(help_req.status, new_status)

            help_req.status = new_status
            if new_status == "completed":
                help_req.completed_at = timezone.now()
                if help_req.helper:
                    # Atomic task counter increment
                    help_req.helper.completed_tasks_count += 1
                    help_req.helper.save(update_fields=["completed_tasks_count"])

            help_req.save()
            return help_req
