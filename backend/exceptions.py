# exceptions.py
from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
from rest_framework import status
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
import logging

logger = logging.getLogger('error_handler')

class ServiceUnavailableException(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Service temporarily unavailable, please try again later."
    default_code = "service_unavailable"

class BadRequestException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Invalid request parameters."
    default_code = "bad_request"

class ResourceNotFoundException(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested resource was not found."
    default_code = "not_found"

class UnauthorizedAccessException(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Authentication credentials were not provided or are invalid."
    default_code = "unauthorized"

class ForbiddenException(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You don't have permission to perform this action."
    default_code = "permission_denied"

class ConflictException(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Request could not be completed due to a conflict."
    default_code = "conflict"

class RateLimitedException(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Too many requests, please try again later."
    default_code = "too_many_requests"

def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF that formats all exceptions
    into a consistent structure and logs them appropriately.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    request = context.get('request')
    view = context.get('view')
    
    # Log detailed error information
    logger.error(
        f"Exception occurred: {exc.__class__.__name__}, "
        f"Detail: {getattr(exc, 'detail', str(exc))}, "
        f"Path: {request.path if request else 'unknown'}, "
        f"Method: {request.method if request else 'unknown'}, "
        f"View: {view.__class__.__name__ if view else 'unknown'}"
    )
    
    # If response is already formatted by DRF
    if response is not None:
        error_data = {
            "status": "error",
            "code": response.status_code,
            "message": response.data.get('detail', str(response.data)) if isinstance(response.data, dict) else str(response.data),
            "errors": response.data if isinstance(response.data, dict) and 'detail' not in response.data else None
        }
        response.data = error_data
        return response
    
    # Handle Django core exceptions
    if isinstance(exc, ValidationError):
        data = {
            "status": "error",
            "code": status.HTTP_400_BAD_REQUEST,
            "message": "Validation error",
            "errors": exc.message_dict if hasattr(exc, 'message_dict') else {'detail': exc.messages}
        }
        return Response(data, status=status.HTTP_400_BAD_REQUEST)
    
    # Handle database integrity errors
    if isinstance(exc, IntegrityError):
        data = {
            "status": "error",
            "code": status.HTTP_409_CONFLICT,
            "message": "Database integrity error",
            "errors": {"detail": str(exc)}
        }
        return Response(data, status=status.HTTP_409_CONFLICT)
    
    # For any other unhandled exceptions, return 500
    data = {
        "status": "error",
        "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "message": "An unexpected error occurred",
        "errors": {"detail": "Please contact support if the problem persists"}
    }
    
    # Only include actual error details in debug mode
    from django.conf import settings
    if settings.DEBUG:
        data["debug_info"] = str(exc)
    
    from rest_framework.response import Response
    return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)