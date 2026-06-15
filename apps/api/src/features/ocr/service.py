"""Service-Schicht für ocr. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class OcrService:
    slice_name = "ocr"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
