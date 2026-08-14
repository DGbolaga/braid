import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import Timestamped, UUIDPrimaryKey


class FormVersion(UUIDPrimaryKey, Timestamped, Base):
    """A whole published form, stored as one versioned JSONB document.

    Not normalised into question rows: it is read whole, written whole, and
    never queried field by field. What *is* queried lives in the projection the
    normalisation step builds.

    `published_at` is null while a version is a draft. A role may hold at most
    one draft, and editing a live form starts one rather than touching what
    applicants are answering right now.
    """

    __tablename__ = "form_version"
    __table_args__ = (UniqueConstraint("program_id", "role", "version"),)

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("program.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sections: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )


class Application(UUIDPrimaryKey, Timestamped, Base):
    """One submitted application, pinned to the form version it was answered on.

    That pin is permanent. The form somebody saw is part of what they said, and
    re-reading an old application through newer questions would put words in
    their mouth.

    Answers are keyed by field id — never by question text — so renaming a
    question does not orphan every answer that used it.
    """

    __tablename__ = "application"

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("program.id"), nullable=False, index=True
    )
    form_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("form_version.id"), nullable=False
    )

    role: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="submitted", index=True
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[str | None] = mapped_column(String(200))
    editable_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    matching_opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    answers: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )


class ApplicationDraft(UUIDPrimaryKey, Timestamped, Base):
    """A half-finished application, autosaved as somebody types."""

    __tablename__ = "application_draft"

    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("program.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    answers: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
