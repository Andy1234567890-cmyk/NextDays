"""Service-Schicht für crm (Eigentümer-Akquise + Partner & Deals, Lastenheft §2.6).

Zusammengesetzt aus zwei Mixins — `LeadsMixin` (Leads, Notizen, Konvertierung)
und `PartnersMixin` (Partner, Deals, QR). Der Service läuft mit dem Service-
Role-Client, der RLS umgeht: tenant_id kommt IMMER aus dem verifizierten JWT
(AuthContext), nie aus dem Request; jede Query trägt den Scope explizit.
"""
from __future__ import annotations

from supabase import Client

from .common import CrmError
from .leads import LeadsMixin
from .partners import PartnersMixin
from .schemas import SliceHealth


class CrmService(LeadsMixin, PartnersMixin):
    slice_name = "crm"

    def __init__(self, service_client: Client | None = None) -> None:
        # `None` nur für den Health-Endpunkt (kein DB-Zugriff). Jeder fachliche
        # Pfad geht über `_require_db`, damit ein fehlender Client eine klare
        # 500 und keinen AttributeError irgendwo tief in der Query ergibt.
        self._client = service_client

    @property
    def _db(self) -> Client:  # type: ignore[override]
        if self._client is None:
            raise CrmError("Datenbank nicht verfügbar.", status_code=500)
        return self._client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)
