"""Service-Schicht für booking_engine. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class BookingEngineService:
    slice_name = "booking_engine"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
