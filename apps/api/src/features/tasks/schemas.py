"""Pydantic-Schemas für den tasks-Slice."""
from pydantic import BaseModel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
