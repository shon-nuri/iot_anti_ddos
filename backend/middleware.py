import json
import logging
import traceback
from django.http import JsonResponse

logger = logging.getLogger('error_handler')

class ErrorHandlingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
            return response
        except Exception as e:
            # Log the full stack trace
            logger.error(
                f"Unhandled exception: {e.__class__.__name__}\n"
                f"Path: {request.path}\n"
                f"Method: {request.method}\n"
                f"Details: {str(e)}\n"
                f"Traceback: {traceback.format_exc()}"
            )
            
            # Return a proper JSON response for all unhandled exceptions
            return self.handle_exception(e, request)
    
    def handle_exception(self, exc, request):
        """Handle uncaught exceptions and return a JSON response"""
        from django.conf import settings
        
        error_data = {
            "status": "error",
            "code": 500,
            "message": "An unexpected error occurred",
        }
        
        # Only include actual error details in debug mode
        if settings.DEBUG:
            error_data["debug_info"] = {
                "exception": str(exc),
                "traceback": traceback.format_exc().split('\n')
            }
        
        return JsonResponse(error_data, status=500)