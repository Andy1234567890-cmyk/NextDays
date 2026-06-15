"""Pydantic-Schemas für den crm-Slice."""
from pydantic import BaseModel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
