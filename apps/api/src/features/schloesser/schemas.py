"""Schemas des Schloss-Slices.

Die Feldnamen folgen der Projektkonvention: camelCase nach außen (das
Frontend liest sie direkt), snake_case in der DB. Übersetzt wird im Router,
nicht im Service.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class VerbindungStarten(BaseModel):
    """Start des Connect Webviews.

    `rueckkehrUrl` ist die Seite, auf der der Kunde nach der
    Hersteller-Anmeldung landet. `HttpUrl` statt `str`, damit kein
    `javascript:`-Schema durchkommt (Wurzel 8) — Seam würde es sonst als
    Weiterleitungsziel übernehmen.
    """

    rueckkehr_url: HttpUrl = Field(alias="rueckkehrUrl")

    model_config = {"populate_by_name": True}


class VerbindungUebernehmen(BaseModel):
    webview_id: str = Field(alias="webviewId", min_length=1, max_length=200)

    model_config = {"populate_by_name": True}


class ZuordnungAnlegen(BaseModel):
    """Gerät an Einheit ODER Gebäude hängen.

    Bewusst zwei optionale Felder statt eines Paars „ebene + id": so ist im
    Schema selbst sichtbar, dass es zwei verschiedene fachliche Dinge sind
    (private Tür / Gemeinschaftstür). Dass genau eines gesetzt sein muss,
    prüft der Service — und zusätzlich ein Check in der Migration.
    """

    device_id: str = Field(alias="deviceId")
    unit_id: str | None = Field(default=None, alias="unitId")
    building_id: str | None = Field(default=None, alias="buildingId")

    model_config = {"populate_by_name": True}


class EinstellungenSetzen(BaseModel):
    """Puffer und Vorlauf eines Objekts.

    Die Obergrenzen sind dieselben wie in 0573 — doppelt geprüft, weil ein
    422 mit Klartext besser ist als ein DB-Check-Verstoß mit 500.
    """

    puffer_vor_min: int | None = Field(
        default=None, alias="pufferVorMin", ge=0, le=1440
    )
    puffer_nach_min: int | None = Field(
        default=None, alias="pufferNachMin", ge=0, le=1440
    )
    vorlauf_stunden: int | None = Field(
        default=None, alias="vorlaufStunden", ge=0, le=720
    )
    aktiv: bool | None = None

    model_config = {"populate_by_name": True}


class GeraetAntwort(BaseModel):
    """Ein Gerät für die Oberfläche.

    `kannWiderrufen` ist `None`, wenn es unbekannt ist — die Oberfläche muss
    diesen dritten Zustand anzeigen können („unbekannt") statt ihn zu
    `false` zu verdichten. Ein `bool` statt `bool | None` wäre hier eine
    stille Falschaussage.
    """

    id: str
    seam_device_id: str = Field(serialization_alias="seamDeviceId")
    name: str | None = None
    kann_widerrufen: bool | None = Field(
        default=None, serialization_alias="kannWiderrufen"
    )
    ist_offline_faehig: bool | None = Field(
        default=None, serialization_alias="istOfflineFaehig"
    )
    zeitraster: str | None = None
    online: bool | None = None
    batterie: float | None = None
    kapazitaet_gesamt: int | None = Field(
        default=None, serialization_alias="kapazitaetGesamt"
    )
    zuordnungen: list[dict] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ZugangAntwort(BaseModel):
    """Der Zugang einer Buchung.

    `status` und `statusGrund` gehören zusammen: bei
    `status = nicht_widerrufbar` steht im Grund der Klartext samt Ablaufdatum.
    Die Oberfläche zeigt beides — das ist der Unterschied zwischen einer
    ehrlichen Anzeige und der stillen Behauptung „zurückgezogen".
    """

    id: str
    code: str | None = None
    status: str
    status_grund: str | None = Field(
        default=None, serialization_alias="statusGrund"
    )
    starts_at: str | None = Field(default=None, serialization_alias="startsAt")
    ends_at: str | None = Field(default=None, serialization_alias="endsAt")

    model_config = {"populate_by_name": True}
