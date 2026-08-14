"""Objekt- und Eigentümerverwaltung als MCP-Werkzeuge.

Eigene Datei, weil es fachlich EIN Bereich ist (Stammdaten des Betriebs) und
`tools.py` sonst über 1500 Zeilen wächst. Die RECHTE stehen weiterhin in der
Registry in `tools.py` — hier ist nur die Ausführung.

DAS TRAGENDE PRINZIP DIESER DATEI: Jeder Vorgang geht über den Service, nie
direkt in die Tabelle. Das ist hier keine Stilfrage, sondern Wurzel 1. Zwei
Beispiele, die es zeigen:

* `unassign_property` entfernt nicht nur die Zuordnung, sondern auch die
  Portalsicht des Eigentümers UND die seiner Familienzugänge auf dieses Objekt.
  Bliebe eine Sicht ohne Familien-Zeile stehen, läse der übrige Code sie als
  „das ist der Eigentümer selbst" — Löschen würde Rechte AUSWEITEN.
* `delete` eines Eigentümers storniert seine Eigennutzungen über den
  Reservierungs-Service, damit die Nächte an die Portale zurückgemeldet werden.
  Ein direktes DELETE liesse sie dort belegt.

Beides steckt im Service. Wer hier abkürzt, verliert es lautlos.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pydantic import ValidationError

from src.features.auth.granular_permissions import has_pm_access
from src.features.auth.permissions import Capability, effective_capabilities
from src.features.owners.service import OwnerError, OwnersService
from src.features.properties.errors import PropertyError
from src.features.properties.service import PropertiesService

from .grenzen import MAX_EIGENTUEMER, MAX_EINHEITEN
from .helfer import _pflicht, _validierung_lesbar

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext


# Die Abschnitte in `properties.type_attributes` — je einer ein Reiter der
# Objektdetail-Seite. Abgelesen aus dem Frontend (`components/objekte/*`), nicht
# geraten: Ein hier fehlender Name wäre ein Abschnitt, den der Assistent nicht
# pflegen kann; ein erfundener einer, der in keiner Oberfläche auftaucht.
_ABSCHNITTE = frozenset({
    "location",      # Standort: Anfahrt, Karte, Umgebung
    "contact",       # Kontakt: zuständige Person im Betrieb
    "compliance",    # Compliance: Melderecht, Registriernummern
    "policies",      # Richtlinien: Hausordnung, Stornobedingungen
    "messaging",     # Nachrichten-Platzhalter für Gastnachrichten
    "pricing",       # Preis-Feineinstellungen (die Preise selbst: rates)
    "availability",  # Verfügbarkeitsregeln (An-/Abreisetage, Vorlauf)
    "occupancy",     # Belegung: Erwachsene/Kinder/Betten
    "beds",          # Bettenaufteilung je Raum
})


class StammdatenMixin:
    """Werkzeuge für Objekte und Eigentümer.

    Erwartet vom Träger (`McpTools`): `_db`, `ctx()`, `_rolle()` und
    `_rechte_cache`.
    """

    # Vom Träger bereitgestellt — hier nur deklariert, damit die Typprüfung
    # die Zugriffe unten versteht.
    # Der Träger (`McpTools`) stellt diese bereit. Sie werfen, statt `...`
    # zurückzugeben: ein leerer Rumpf sähe für die Prüfwerkzeuge wie „gibt
    # None zurück" aus, und jede Zuweisung des Ergebnisses wäre ein
    # Fehlbefund. Erreicht wird der Rumpf nie.
    _db: Any
    _rechte_cache: object

    def ctx(self) -> AuthContext:
        raise NotImplementedError("Vom Träger bereitzustellen.")

    def _rolle(self) -> str | None:
        raise NotImplementedError("Vom Träger bereitzustellen.")

    # -- Objektverwaltung ---------------------------------------------------

    def _objekte_service(self) -> PropertiesService:
        return PropertiesService(service_client=self._db)

    def _objekt_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.schemas import PropertyCreate

        # NUR übergebene Felder ins Schema — alles andere trägt seinen
        # Schema-Default. Besonders `currency` hat bewusst KEINEN Default
        # (Wurzel 4): eine erfundene Währung wäre in 27 EU-Ländern falsch.
        felder = {k: v for k, v in args.items() if v is not None}
        try:
            objekt = self._objekte_service().create(
                self.ctx(), PropertyCreate(**felder)
            )
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {
            "id": objekt.id,
            "name": objekt.title,
            "status": objekt.status,
            "hinweis": (
                "Als Entwurf angelegt. Erst 'objekt_veroeffentlichen' stellt "
                "es auf die Portale — dafür braucht es mindestens einen "
                "Preisplan."
            ),
        }

    def _objekt_aendern(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.schemas import PropertyUpdate

        objekt_id = _pflicht(args, "objekt_id")
        dienst = self._objekte_service()
        felder = {
            k: v for k, v in args.items()
            if k not in {"objekt_id", "abschnitt", "abschnitt_daten"}
            and v is not None
        }
        abschnitt = str(args.get("abschnitt") or "").strip()
        if abschnitt:
            felder["type_attributes"] = self._abschnitt_mischen(
                dienst, objekt_id, abschnitt, args.get("abschnitt_daten")
            )
        if not felder:
            raise ValueError("Keine Änderung angegeben.")
        try:
            objekt = dienst.update(
                self.ctx(), objekt_id, PropertyUpdate(**felder)
            )
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {
            "id": objekt.id,
            "name": objekt.title,
            "geaendert": sorted(felder) + ([abschnitt] if abschnitt else []),
            "hinweis": (
                "Inhaltliche Felder (Beschreibung, Ausstattung, Kapazität) "
                "gehen an die Portale."
            ),
        }

    def _abschnitt_mischen(
        self,
        dienst: PropertiesService,
        objekt_id: str,
        abschnitt: str,
        daten: object,
    ) -> dict[str, Any]:
        """Einen Abschnitt in `type_attributes` ersetzen, den Rest BEWAHREN.

        DER GRUND, warum es diese Methode gibt (gefunden 14.08.2026): In
        `type_attributes` liegen SIEBEN getrennte Bereiche nebeneinander —
        Standort, Kontakt, Compliance, Richtlinien, Preise, Verfügbarkeit,
        Nachrichten-Platzhalter. Jeder ist in der Oberfläche ein eigener
        Reiter, aber alle teilen sich EIN Datenfeld.

        Die Oberfläche liest deshalb den Bestand und mischt (`{...alt, neu}`).
        Wer das Feld hier naiv durchreicht, schreibt nur seinen Abschnitt und
        LÖSCHT die sechs anderen — ein Assistent, der die Compliance-Angaben
        pflegt, hätte die Adresse und die Hausordnung mitgenommen. Wurzel 1:
        Der Gegenzustand muss mitgepflegt werden, und hier heisst das schlicht
        „alles andere stehen lassen".
        """
        if not isinstance(daten, dict):
            raise ValueError(
                "abschnitt_daten fehlt oder ist kein Objekt "
                f"(erwartet die Angaben für '{abschnitt}')"
            )
        if abschnitt not in _ABSCHNITTE:
            erlaubt = ", ".join(sorted(_ABSCHNITTE))
            raise ValueError(
                f"Unbekannter Abschnitt '{abschnitt}'. Möglich: {erlaubt}"
            )
        try:
            bestand = dienst.get(self.ctx(), objekt_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        alle = dict(getattr(bestand, "type_attributes", None) or {})
        # Auch INNERHALB des Abschnitts mischen: wer nur die Kurtaxe-Nummer
        # setzt, soll die übrigen Compliance-Felder nicht verlieren.
        vorher = alle.get(abschnitt)
        alle[abschnitt] = (
            {**vorher, **daten} if isinstance(vorher, dict) else dict(daten)
        )
        return alle

    def _objekt_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        try:
            self._objekte_service().delete(self.ctx(), objekt_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        return {"id": objekt_id, "geloescht": True}

    def _objekt_veroeffentlichen(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        try:
            objekt = self._objekte_service().publish(self.ctx(), objekt_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        return {
            "id": objekt.id,
            "status": objekt.status,
            "hinweis": "Objekt und Verfügbarkeit sind an die Portale gemeldet.",
        }

    def _objekt_duplizieren(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        try:
            neu = self._objekte_service().duplicate(self.ctx(), objekt_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        return {"id": neu.id, "name": neu.title, "status": neu.status}

    def _einheiten_setzen(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        anzahl = args.get("anzahl")
        if anzahl is None:
            raise ValueError("anzahl fehlt")
        try:
            zahl = int(anzahl)
        except (TypeError, ValueError) as exc:
            raise ValueError("anzahl ist keine Zahl") from exc
        if not 1 <= zahl <= MAX_EINHEITEN:
            raise ValueError(f"anzahl muss zwischen 1 und {MAX_EINHEITEN} liegen")
        try:
            einheiten = self._objekte_service().set_unit_count(
                self.ctx(), objekt_id, zahl
            )
        except PropertyError as exc:
            # Verkleinern schlägt fehl, solange wegfallende Einheiten belegt
            # sind — das ist eine echte Aussage und keine technische Panne.
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "einheiten": len(einheiten),
            "hinweis": "Die freie Stückzahl ist an die Portale gemeldet.",
        }

    def _inhalte_neu_senden(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        try:
            self._objekte_service().resync_content(self.ctx(), objekt_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "gesendet": True}

    def _fotos_ordnen(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        ids = args.get("foto_ids")
        if not isinstance(ids, list) or not ids:
            raise ValueError("foto_ids fehlt (Liste aller Foto-IDs in Wunschreihenfolge)")
        try:
            out = self._objekte_service().reorder_photos(
                self.ctx(), objekt_id, [str(i) for i in ids]
            )
        except PropertyError as exc:
            # Der Service verlangt EXAKT alle vorhandenen IDs — eine
            # unvollständige Liste ist ein Fehler, keine Teilsortierung.
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "fotos": len(out.items)}

    def _foto_aendern(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.schemas import PhotoUpdateRequest

        objekt_id = _pflicht(args, "objekt_id")
        foto_id = _pflicht(args, "foto_id")
        # Die Werkzeug-Argumente sind deutsch, das Schema ist englisch —
        # ausdrücklich mappen statt durchreichen, sonst landet ein `bildtext`
        # als unbekanntes Feld im Schema und wird still verworfen.
        felder: dict[str, Any] = {}
        if args.get("bildtext") is not None:
            felder["caption"] = args["bildtext"]
        if args.get("ist_titelbild") is not None:
            felder["is_cover"] = bool(args["ist_titelbild"])
        if not felder:
            raise ValueError(
                "Keine Änderung angegeben (bildtext oder ist_titelbild)."
            )
        try:
            foto = self._objekte_service().update_photo(
                self.ctx(), objekt_id, foto_id, PhotoUpdateRequest(**felder)
            )
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"objekt_id": objekt_id, "foto_id": foto.id, "geaendert": True}

    def _foto_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        foto_id = _pflicht(args, "foto_id")
        try:
            self._objekte_service().delete_photo(self.ctx(), objekt_id, foto_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "foto_id": foto_id, "geloescht": True}

    def _zimmer_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.schemas import PropertyRoomCreate

        objekt_id = _pflicht(args, "objekt_id")
        try:
            raum = self._objekte_service().add_room(
                self.ctx(), objekt_id,
                PropertyRoomCreate(
                    raum_typ=_pflicht(args, "raum_typ"),
                    **({"privat": bool(args["privat"])}
                       if args.get("privat") is not None else {}),
                ),
            )
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"objekt_id": objekt_id, "zimmer_id": raum.id, "angelegt": True}

    def _zimmer_aendern(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.schemas import PropertyRoomUpdate

        objekt_id = _pflicht(args, "objekt_id")
        zimmer_id = _pflicht(args, "zimmer_id")
        felder: dict[str, Any] = {}
        if args.get("raum_typ") is not None:
            felder["raum_typ"] = str(args["raum_typ"])
        if args.get("privat") is not None:
            felder["privat"] = bool(args["privat"])
        if not felder:
            raise ValueError("Keine Änderung angegeben (raum_typ oder privat).")
        try:
            raum = self._objekte_service().update_room(
                self.ctx(), objekt_id, zimmer_id, PropertyRoomUpdate(**felder)
            )
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"objekt_id": objekt_id, "zimmer_id": raum.id, "geaendert": True}

    def _zimmer_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:

        objekt_id = _pflicht(args, "objekt_id")
        zimmer_id = _pflicht(args, "zimmer_id")
        try:
            self._objekte_service().delete_room(self.ctx(), objekt_id, zimmer_id)
        except PropertyError as exc:
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "zimmer_id": zimmer_id, "geloescht": True}

    # -- Eigentümerverwaltung ------------------------------------------------

    def _eigentuemer_service(self) -> OwnersService:
        return OwnersService(service_client=self._db)

    def _require_staff(self, was: str) -> None:
        """MANAGE_STAFF zusätzlich verlangen — für alles, was einen LOGIN anfasst.

        Der Router prüft das BEDINGT: `create` nur bei `portalzugang=true`,
        `update` nur, wenn die E-Mail mitgeschickt wird. Eine statische
        Registry kann das nicht abbilden, deshalb steht die Bedingung hier.
        Ohne sie wäre `MANAGE_OWNERS` ein Umweg zur Nutzerverwaltung: „lege
        einen Eigentümer mit Portalzugang an" erzeugt einen Login.
        """
        erlaubt = effective_capabilities(
            self._rolle(),
            has_pm_access=has_pm_access(self._rolle(), self._rechte_cache),
        )
        if Capability.MANAGE_STAFF not in erlaubt:
            raise ValueError(
                f"[nicht erlaubt — {was} legt einen Login an und verlangt "
                "zusätzlich das Recht, Benutzer zu verwalten.]"
            )

    def _eigentuemer(self, _args: dict[str, Any]) -> dict[str, Any]:

        try:
            out = self._eigentuemer_service().list(self.ctx())
        except OwnerError as exc:
            raise ValueError(exc.message) from exc
        return {
            "anzahl": len(out.items[:MAX_EIGENTUEMER]),
            "eigentuemer": [
                {
                    "id": o.id,
                    "name": o.name,
                    "email": o.email,
                    "objekte": len(getattr(o, "properties", []) or []),
                    "portalzugang": bool(getattr(o, "user_id", None)),
                }
                for o in out.items[:MAX_EIGENTUEMER]
            ],
        }

    def _eigentuemer_detail(self, args: dict[str, Any]) -> dict[str, Any]:

        try:
            o = self._eigentuemer_service().get(
                self.ctx(), _pflicht(args, "eigentuemer_id")
            )
        except OwnerError as exc:
            raise ValueError(exc.message) from exc
        return o.model_dump(mode="json")

    def _eigentuemer_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.owners.schemas import OwnerCreate

        felder = {k: v for k, v in args.items() if v is not None}
        if felder.get("portalzugang"):
            self._require_staff("Ein Eigentümer mit Portalzugang")
        try:
            o = self._eigentuemer_service().create(
                self.ctx(), OwnerCreate(**felder)
            )
        except OwnerError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"id": o.id, "name": o.name, "angelegt": True}

    def _eigentuemer_aendern(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.owners.schemas import OwnerUpdate

        eigentuemer_id = _pflicht(args, "eigentuemer_id")
        felder = {
            k: v for k, v in args.items()
            if k != "eigentuemer_id" and v is not None
        }
        if not felder:
            raise ValueError("Keine Änderung angegeben.")
        if "email" in felder:
            # Die E-Mail ist zugleich die Anmeldung — sie zu ändern ist ein
            # Eingriff in den Login, nicht in die Stammdaten.
            self._require_staff("Die E-Mail eines Eigentümers zu ändern")
        try:
            o = self._eigentuemer_service().update(
                self.ctx(), eigentuemer_id, OwnerUpdate(**felder)
            )
        except OwnerError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"id": o.id, "name": o.name, "geaendert": sorted(felder)}

    def _eigentuemer_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:

        eigentuemer_id = _pflicht(args, "eigentuemer_id")
        # Eigennutzungen sind BUCHUNGEN. Sie mitzulöschen storniert sie und
        # gibt Nächte an die Portale frei — das muss ausdrücklich gewollt
        # sein, nie ein stiller Nebeneffekt des Löschens.
        mit_stays = bool(args.get("mit_eigennutzungen"))
        try:
            self._eigentuemer_service().delete(
                self.ctx(), eigentuemer_id, mit_eigennutzungen=mit_stays
            )
        except OwnerError as exc:
            hinweis = ""
            if (exc.details or {}).get("code") == "owner_has_stays":
                anzahl = (exc.details or {}).get("eigennutzungen")
                hinweis = (
                    f" Der Eigentümer hat {anzahl} Eigennutzung(en). Diese "
                    "werden storniert und die Nächte wieder freigegeben — "
                    "erneut mit mit_eigennutzungen=true aufrufen, wenn das "
                    "gewollt ist."
                )
            raise ValueError(f"{exc.message}{hinweis}") from exc
        return {
            "id": eigentuemer_id,
            "geloescht": True,
            "eigennutzungen_storniert": mit_stays,
        }

    def _objekt_zuordnen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.owners.schemas import OwnerPropertyAssign

        eigentuemer_id = _pflicht(args, "eigentuemer_id")
        felder: dict[str, Any] = {"property_id": _pflicht(args, "objekt_id")}
        if args.get("anteil_prozent") is not None:
            felder["ownership_share"] = float(args["anteil_prozent"])
        if args.get("provision_prozent") is not None:
            felder["commission_override_pct"] = float(args["provision_prozent"])
        try:
            o = self._eigentuemer_service().assign_property(
                self.ctx(), eigentuemer_id, OwnerPropertyAssign(**felder)
            )
        except OwnerError as exc:
            # Ein Objekt hat GENAU EINEN Eigentümer (unique, 0073). Gehört es
            # bereits jemand anderem, nennt der Service dessen Namen — das ist
            # die brauchbare Auskunft, kein technischer Konflikt.
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"eigentuemer_id": o.id, "objekt_id": felder["property_id"],
                "zugeordnet": True}

    def _objekt_entziehen(self, args: dict[str, Any]) -> dict[str, Any]:

        eigentuemer_id = _pflicht(args, "eigentuemer_id")
        objekt_id = _pflicht(args, "objekt_id")
        try:
            self._eigentuemer_service().unassign_property(
                self.ctx(), eigentuemer_id, objekt_id
            )
        except OwnerError as exc:
            raise ValueError(exc.message) from exc
        return {
            "eigentuemer_id": eigentuemer_id,
            "objekt_id": objekt_id,
            "entzogen": True,
            # Wurzel 1: Der Service pflegt den Gegenzustand mit — deshalb geht
            # dieser Weg über den Service und nie direkt in die Tabelle.
            "hinweis": (
                "Die Portalsicht des Eigentümers und die seiner "
                "Familienzugänge auf dieses Objekt wurden mit entfernt."
            ),
        }

    def _portalzugang_einladen(self, args: dict[str, Any]) -> dict[str, Any]:

        eigentuemer_id = _pflicht(args, "eigentuemer_id")
        try:
            o = self._eigentuemer_service().portalzugang_einladen(
                self.ctx(), eigentuemer_id
            )
        except OwnerError as exc:
            raise ValueError(exc.message) from exc
        return {
            "id": o.id,
            "eingeladen": True,
            "hinweis": "Die Einladung ist per E-Mail unterwegs.",
        }
