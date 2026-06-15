"""Service-Schicht für crm. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class CrmService:
    slice_name = "crm"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
