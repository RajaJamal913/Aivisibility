"""
Marshmallow schemas for request validation. Keeping validation declarative
here (rather than scattered `if "name" not in data` checks in routes) means
every field's rules -- required-ness, type, length -- are visible in one
place, and validation errors get a consistent structured error response via
ValidationError in app/errors.py.
"""
from marshmallow import Schema, fields, validate, ValidationError as MarshmallowValidationError


class CreateProfileSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    domain = fields.String(required=True, validate=validate.Length(min=3, max=255))
    industry = fields.String(required=True, validate=validate.Length(min=1, max=255))
    description = fields.String(required=False, allow_none=True, load_default=None)
    competitors = fields.List(
        fields.String(validate=validate.Length(min=1, max=255)),
        required=False,
        load_default=list,
    )


def validate_payload(schema: Schema, payload: dict) -> dict:
    from app.errors import ValidationError as ApiValidationError

    try:
        return schema.load(payload or {})
    except MarshmallowValidationError as exc:
        raise ApiValidationError("Request payload failed validation.", details=exc.messages)
