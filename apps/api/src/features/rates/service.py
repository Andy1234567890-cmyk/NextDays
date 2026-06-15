"""Service-Schicht für rates. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class RatesService:
    slice_name = "rates"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
