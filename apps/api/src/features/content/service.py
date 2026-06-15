"""Service-Schicht für content. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class ContentService:
    slice_name = "content"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
