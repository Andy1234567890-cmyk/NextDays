"""Service-Schicht für reservations. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class ReservationsService:
    slice_name = "reservations"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
