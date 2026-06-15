"""Pydantic-Schemas für den ocr-Slice."""
from pydantic import BaseModel


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
