"""Pydantic-Schemas für den dashboard-Slice."""
from pydantic import BaseModel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
