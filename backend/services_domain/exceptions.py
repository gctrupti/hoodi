"""
Domain Exceptions for Hoodi Platform.
All domain business rule violations inherit from HoodiDomainException.
"""

class HoodiDomainException(Exception):
    """Base exception for all Hoodi domain errors."""
    def __init__(self, message: str, code: str = "domain_error", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class TaskAlreadyAssignedException(HoodiDomainException):
    def __init__(self, message: str = "This help request is no longer open for acceptance."):
        super().__init__(message, code="task_already_assigned", status_code=409)


class SelfAssignmentForbiddenException(HoodiDomainException):
    def __init__(self, message: str = "You cannot accept or fulfill your own request."):
        super().__init__(message, code="self_assignment_forbidden", status_code=400)


class InvalidTaskStatusTransitionException(HoodiDomainException):
    def __init__(self, current_status: str, attempted_status: str):
        message = f"Cannot transition task from '{current_status}' to '{attempted_status}'."
        super().__init__(message, code="invalid_status_transition", status_code=400)


class InsufficientFundsException(HoodiDomainException):
    def __init__(self, message: str = "Insufficient wallet balance to perform this operation."):
        super().__init__(message, code="insufficient_funds", status_code=400)


class SlotConflictException(HoodiDomainException):
    def __init__(self, message: str = "This time slot is already booked or unavailable."):
        super().__init__(message, code="slot_conflict", status_code=409)


class UnauthorizedAccessException(HoodiDomainException):
    def __init__(self, message: str = "You do not have permission to access or modify this resource."):
        super().__init__(message, code="unauthorized_access", status_code=403)
