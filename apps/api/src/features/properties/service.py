"""Service-Schicht für properties. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class PropertiesService:
    slice_name = "properties"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
