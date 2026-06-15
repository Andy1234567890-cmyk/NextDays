"""Service-Schicht für tasks. Business-Logik folgt; aktuell nur Health."""
from .schemas import SliceHealth


class TasksService:
    slice_name = "tasks"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
