"""Pydantic-Schemas für den content-Slice."""
from pydantic import BaseModel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
