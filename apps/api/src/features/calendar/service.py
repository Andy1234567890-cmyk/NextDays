"""Service-Schicht für calendar. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class CalendarService:
    slice_name = "calendar"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
