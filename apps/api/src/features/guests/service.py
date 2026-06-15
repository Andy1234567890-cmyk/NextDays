"""Service-Schicht für guests. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class GuestsService:
    slice_name = "guests"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
