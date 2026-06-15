"""Service-Schicht für channel_manager. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class ChannelManagerService:
    slice_name = "channel_manager"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
