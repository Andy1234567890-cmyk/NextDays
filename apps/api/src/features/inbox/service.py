"""Service-Schicht für inbox. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class InboxService:
    slice_name = "inbox"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
