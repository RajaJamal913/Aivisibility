import uuid
from datetime import datetime, timezone

from app.extensions import db


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UUIDPrimaryKeyMixin:
    """All entities use a UUID string primary key (rather than autoincrement
    ints) since profile/query/recommendation UUIDs are exposed directly in
    the API and used as opaque, non-guessable identifiers across services."""

    uuid = db.Column(db.String(36), primary_key=True, default=gen_uuid)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
