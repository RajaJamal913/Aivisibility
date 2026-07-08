"""
Centralised error handling so every endpoint in the API returns errors in the
exact same shape:

    {
        "error": {
            "code": "NOT_FOUND",
            "message": "Profile abc-123 was not found.",
            "details": {...}   # optional, only present when useful
        }
    }

Rather than letting individual routes hand-roll error JSON (which drifts in
shape over time), routes raise ApiError (or a subclass) and a single
errorhandler here converts it into the response. Unhandled exceptions and
standard HTTP errors (404 on unknown routes, 405, etc.) are also normalised
to this shape so clients never have to branch on error format.
"""
from flask import jsonify
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    """Base class for all deliberately-raised API errors."""

    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message, status_code=None, code=None, details=None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.details = details

    def to_dict(self):
        payload = {"code": self.code, "message": self.message}
        if self.details:
            payload["details"] = self.details
        return {"error": payload}


class NotFoundError(ApiError):
    status_code = 404
    code = "NOT_FOUND"


class ValidationError(ApiError):
    status_code = 422
    code = "VALIDATION_ERROR"


class ConflictError(ApiError):
    status_code = 409
    code = "CONFLICT"


class UpstreamServiceError(ApiError):
    """Raised when an external dependency (LLM provider, DataForSEO) fails
    in a way that could not be recovered by fallback logic."""

    status_code = 502
    code = "UPSTREAM_SERVICE_ERROR"


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        return jsonify(err.to_dict()), err.status_code

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        payload = {
            "error": {
                "code": (err.name or "HTTP_ERROR").upper().replace(" ", "_"),
                "message": err.description,
            }
        }
        return jsonify(payload), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_exception(err: Exception):
        app.logger.exception("Unhandled exception")
        payload = {
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
            }
        }
        return jsonify(payload), 500
