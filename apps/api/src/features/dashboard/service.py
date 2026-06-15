"""Service-Schicht für dashboard. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class DashboardService:
    slice_name = "dashboard"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
