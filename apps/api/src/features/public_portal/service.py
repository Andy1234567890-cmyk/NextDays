"""Service-Schicht für public_portal. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class PublicPortalService:
    slice_name = "public_portal"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
