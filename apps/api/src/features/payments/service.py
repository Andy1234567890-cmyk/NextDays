"""Service-Schicht für payments. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class PaymentsService:
    slice_name = "payments"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
