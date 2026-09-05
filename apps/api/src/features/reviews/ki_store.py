"""Katalog, Einstellungen, Protokoll und Test-KI der Bewertungs-KI.

Der lesende und schreibende Teil rund um ``ki_text``: was der Betrieb an
Haltung hinterlegt hat, wie zugestellt werden soll, was tatsächlich passiert
ist — und die Probe, mit der sich beides vor dem Einschalten prüfen lässt.

Ein eigener Store und kein Mixin an ``ReviewsService``: der Service ist bereits
gross, und diese Tabellen hängen an keiner seiner Abfragen. Dasselbe Muster wie
``VorlagenStore``.

**Die Test-KI sendet nichts.** Sie läuft gegen dieselbe Kette wie der Ernstfall
(Katalog → Prompt → Vertex → Zustell-Entscheidung) und zeigt, was dann
passieren WÜRDE. Ohne sie ist eine schiefe Antwort nicht diagnostizierbar —
man rät zwischen „der Katalog sagt das so", „die Note wurde falsch eingeordnet"
und „das Modell hat sich etwas zurechtgelegt". Ein Betrieb kann so vor dem
Einschalten prüfen, ob seine Haltung ankommt, statt es an der ersten echten
Bewertung zu erfahren, die dauerhaft öffentlich steht.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.ki import KiError
from src.core.logging import get_logger
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .common import plaintext
from .ki_katalog import KATALOG, MAX_ANTWORT_ZEICHEN, NACH_SCHLUESSEL
from .ki_text import (
    FUNKTIONEN,
    Bewertungslage,
    katalog_gepflegt,
    katalog_laden,
    offene_fragen,
    text_erzeugen,
)
from .schemas import (
    KiKatalogAntwort,
    KiKatalogFrage,
    KiKatalogSpeichern,
    KiProtokollEintrag,
    KiProtokollList,
    KiRichtung,
    KiSettings,
    KiTestAntwort,
    KiTestFrage,
    KiZustellart,
)

log = get_logger("nextdays.reviews.ki_store")

# Wie viele Protokollzeilen die Liste höchstens zurückgibt (Wurzel 8).
MAX_PROTOKOLL = 200

_SETTINGS_SPALTEN = (
    "ki_aktiv, zustellart_gast_bewerten, zustellart_antwort, "
    "antwort_mensch_ab_note, tonfall, unterschrift, sprache, "
    "verzoegerung_minuten"
)


class KiStore:
    """Katalog, Einstellungen, Protokoll und Probe — alles tenant-gescopt."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- Katalog
    def katalog(self, tenant_id: str) -> KiKatalogAntwort:
        """Der ganze Katalog: die Fragen aus dem Code, die Antworten aus der DB."""
        gespeichert = katalog_laden(self._db, tenant_id)
        fragen = [
            KiKatalogFrage(
                schluessel=f.schluessel,
                frage=f.frage,
                beispiel=f.beispiel,
                antwort=gespeichert.get(f.schluessel),
                noten=sorted(f.noten),
                richtungen=[KiRichtung(r) for r in sorted(f.richtungen)],
            )
            for f in KATALOG
        ]
        return KiKatalogAntwort(
            fragen=fragen,
            beantwortet=sum(1 for f in fragen if (f.antwort or "").strip()),
            gesamt=len(fragen),
        )

    def katalog_speichern(
        self, tenant_id: str, req: KiKatalogSpeichern
    ) -> KiKatalogAntwort:
        """Eine Antwort setzen oder — bei leerem Text — löschen."""
        from .service import ReviewError

        if req.schluessel not in NACH_SCHLUESSEL:
            # Kein stilles Speichern eines unbekannten Schlüssels: die Antwort
            # landete in keinem Prompt und wäre stiller Datenverlust (Wurzel 5).
            raise ReviewError("Unbekannte Katalogfrage.", status_code=422)
        text = plaintext(req.antwort) or ""
        if len(text) > MAX_ANTWORT_ZEICHEN:
            raise ReviewError(
                f"Die Antwort ist zu lang (höchstens {MAX_ANTWORT_ZEICHEN} "
                "Zeichen).",
                status_code=422,
            )
        if not text.strip():
            self._db.table("review_ki_katalog").delete().eq(
                "tenant_id", tenant_id
            ).eq("frage_schluessel", req.schluessel).execute()
            return self.katalog(tenant_id)
        # Upsert auf (tenant_id, frage_schluessel) — der UNIQUE-Index aus 0549
        # ist der Backstop gegen den Doppelklick, nicht ein Vorab-SELECT
        # (das wäre ein Race, Wurzel 2).
        self._db.table("review_ki_katalog").upsert(
            {
                "tenant_id": tenant_id,
                "frage_schluessel": req.schluessel,
                "antwort": text,
                "updated_at": _jetzt(),
            },
            on_conflict="tenant_id,frage_schluessel",
        ).execute()
        log.info(
            "review_ki_katalog_gespeichert",
            tenant_id=tenant_id,
            frage=req.schluessel,
            zeichen=len(text),
        )
        return self.katalog(tenant_id)

    # -------------------------------------------------------- Einstellungen
    def settings(self, tenant_id: str) -> KiSettings:
        """Einstellungen lesen. Fehlt die Zeile, gelten die Vorgaben — die KI
        ist dann AUS, nicht an (Wurzel 4: kein wohlwollender Ersatzwert bei
        etwas, das öffentliche Texte verschickt)."""
        zeilen = (
            self._db.table("review_ki_settings")
            .select(_SETTINGS_SPALTEN)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return KiSettings(**zeilen[0]) if zeilen else KiSettings()

    def settings_speichern(self, tenant_id: str, req: KiSettings) -> KiSettings:
        self._db.table("review_ki_settings").upsert(
            {
                "tenant_id": tenant_id,
                "ki_aktiv": req.ki_aktiv,
                "zustellart_gast_bewerten": req.zustellart_gast_bewerten.value,
                "zustellart_antwort": req.zustellart_antwort.value,
                "antwort_mensch_ab_note": req.antwort_mensch_ab_note,
                "tonfall": req.tonfall,
                "unterschrift": plaintext(req.unterschrift),
                "sprache": req.sprache,
                "verzoegerung_minuten": req.verzoegerung_minuten,
                "updated_at": _jetzt(),
            },
            on_conflict="tenant_id",
        ).execute()
        log.info(
            "review_ki_settings_gespeichert",
            tenant_id=tenant_id,
            aktiv=req.ki_aktiv,
            gast=req.zustellart_gast_bewerten.value,
            antwort=req.zustellart_antwort.value,
        )
        return self.settings(tenant_id)

    # --------------------------------------------------- Zustell-Entscheidung
    @staticmethod
    def zustellart_entscheiden(
        settings: KiSettings,
        richtung: str,
        note: int | None,
        mensch_pruefen: str | None,
    ) -> tuple[KiZustellart, str | None]:
        """Geht der Text raus oder bleibt er Entwurf? Und warum?

        Die Reihenfolge ist die Rangfolge — jede Stufe kann nur STRENGER
        werden, nie lockerer:

        1. Der grosse Schalter aus → Entwurf.
        2. Das Modell bittet um menschliche Prüfung → Entwurf, immer.
        3. Die Note liegt unter der Schwelle (nur Richtung 'antwort')
           → Entwurf.
        4. Die Zustellart dieser Richtung steht auf 'automatisch' → raus.
        5. Sonst Entwurf — die Vorgabe.

        ``grund`` ist gesetzt, wenn eine automatische Zustellung VERHINDERT
        wurde. Er steht im Protokoll und erklärt dem Betrieb, warum diesmal
        nichts hinausging — sonst sieht die Sperre wie ein Aussetzer aus.
        """
        if not settings.ki_aktiv:
            return KiZustellart.entwurf, "KI-Antworten sind ausgeschaltet."
        if mensch_pruefen:
            return (
                KiZustellart.entwurf,
                f"Menschliche Prüfung nötig: {mensch_pruefen}",
            )
        if richtung == KiRichtung.antwort.value:
            schwelle = settings.antwort_mensch_ab_note
            if schwelle is not None and note is None:
                # Fail-closed (Wurzel 5): wer „unter X Sternen ein Mensch"
                # gesetzt hat, will keine automatische Antwort auf eine
                # Bewertung, deren Note wir nicht kennen (verdeckt, 0).
                return (
                    KiZustellart.entwurf,
                    f"Keine Note bekannt, Schwelle {schwelle} gesetzt — "
                    "ohne Note entscheidet ein Mensch.",
                )
            if schwelle is not None and note is not None and note < schwelle:
                return (
                    KiZustellart.entwurf,
                    f"Note {note} liegt unter der Schwelle {schwelle} — "
                    "eine schlechte Bewertung beantwortet ein Mensch.",
                )
            gewuenscht = settings.zustellart_antwort
        else:
            gewuenscht = settings.zustellart_gast_bewerten
        if gewuenscht == KiZustellart.automatisch:
            return KiZustellart.automatisch, None
        return KiZustellart.entwurf, None

    # ------------------------------------------------------------- Test-KI
    def testen(self, tenant_id: str, req: KiTestFrage) -> KiTestAntwort:
        """Eine Probe. SENDET NICHTS.

        Läuft gegen dieselbe Kette wie der Ernstfall und zeigt, was dann
        passieren würde — inklusive der Zustellart, die sich aus den
        Einstellungen ergäbe.
        """
        from .service import ReviewError

        settings = self.settings(tenant_id)
        katalog = katalog_laden(self._db, tenant_id)
        if not katalog_gepflegt(katalog):
            raise ReviewError(
                "Bitte zuerst mindestens eine Frage im Katalog beantworten — "
                "sonst schreibt die KI beliebigen Text.",
                status_code=422,
            )
        objekt = self._objekt_titel(tenant_id, req.property_id)
        lage = Bewertungslage(
            richtung=req.richtung.value,
            note=req.note,
            gast_text=plaintext(req.gast_text),
            gast_name=plaintext(req.gast_name),
            objekt_titel=objekt,
            sprache=req.sprache,
        )
        try:
            deckel_pruefen(self._db, tenant_id)
            vorschlag = text_erzeugen(
                self._db,
                tenant_id,
                lage=lage,
                einstellungen=settings.model_dump(),
                katalog=katalog,
            )
        except KiError as exc:
            raise ReviewError(exc.message, status_code=exc.status_code) from exc

        buchen(
            self._db,
            tenant_id,
            user_id=None,
            funktion=FUNKTIONEN[req.richtung.value],
            antwort=vorschlag.antwort,
        )
        zustellart, grund = self.zustellart_entscheiden(
            settings, req.richtung.value, req.note, vorschlag.mensch_pruefen
        )
        # Auch der Test wird protokolliert. Ein Betrieb, der eine schiefe
        # Antwort meldet, hat sie meist im Test gesehen — ohne Spur wäre sie
        # nicht mehr auffindbar.
        self.protokollieren(
            tenant_id,
            richtung=req.richtung.value,
            quelle="test",
            bezug_id=None,
            note=req.note,
            eingabe=req.gast_text or "",
            ergebnis=vorschlag.text,
            zustellart=zustellart.value,
            gesendet=False,
            verwendete_fragen=vorschlag.verwendete_fragen,
            grund=grund,
            antwort=vorschlag.antwort,
        )
        return KiTestAntwort(
            text=vorschlag.text,
            zustellart=zustellart,
            grund=grund,
            verwendete_fragen=vorschlag.verwendete_fragen,
            mensch_pruefen=vorschlag.mensch_pruefen,
            offene_fragen=offene_fragen(katalog),
        )

    def _objekt_titel(self, tenant_id: str, property_id: str | None) -> str | None:
        """Objekttitel MIT Tenant-Filter im selben Aufruf (Wurzel 3).

        Ein ungescopter Load mit nachträglichem Vergleich wäre hier ein Leck:
        über den Testweg liesse sich sonst prüfen, welche Objekt-IDs bei
        fremden Betrieben existieren.
        """
        if not property_id:
            return None
        zeilen = (
            self._db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            from .service import ReviewError

            raise ReviewError("Objekt nicht gefunden.", status_code=404)
        return zeilen[0].get("title")

    # ------------------------------------------------------------ Protokoll
    def protokollieren(  # noqa: PLR0913 — eine Spurzeile, alle Felder gebraucht
        self,
        tenant_id: str,
        *,
        richtung: str,
        quelle: str,
        bezug_id: str | None,
        note: int | None,
        eingabe: str,
        ergebnis: str,
        zustellart: str,
        gesendet: bool,
        verwendete_fragen: list[str],
        grund: str | None,
        antwort: object = None,
    ) -> None:
        """Einen Lauf protokollieren — bei JEDEM Lauf, auch beim Entwurf.

        Best effort: das Protokoll darf den Text nicht kippen. Es wird aber
        LAUT geloggt, wenn es fehlschlägt — eine Spur mit stillen Lücken ist
        als Nachweis wertlos, und niemand würde es merken (Wurzel 5).
        """
        try:
            self._db.table("review_ki_protokoll").insert(
                {
                    "tenant_id": tenant_id,
                    "richtung": richtung,
                    "quelle": quelle,
                    "bezug_id": bezug_id,
                    "note": note,
                    "eingabe_auszug": (eingabe or "")[:2000] or None,
                    "ergebnis": ergebnis,
                    "zustellart": zustellart,
                    "gesendet_at": _jetzt() if gesendet else None,
                    "verwendete_fragen": verwendete_fragen,
                    "grund": grund[:500] if grund else None,
                    "modell": getattr(antwort, "modell", None),
                    "region": getattr(antwort, "region", None),
                    "tokens_ein": int(getattr(antwort, "tokens_ein", 0) or 0),
                    "tokens_aus": int(getattr(antwort, "tokens_aus", 0) or 0),
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — best effort, siehe Docstring
            log.error(
                "review_ki_protokoll_nicht_geschrieben",
                tenant_id=tenant_id,
                richtung=richtung,
                grund=type(exc).__name__,
                fehler=str(exc)[:300],
            )

    # ------------------------------------------------ Live-Stand (0568)
    def stand_setzen(
        self, tenant_id: str, schritt: str, *, lauf_abgeschlossen: bool = False
    ) -> None:
        """Das Realtime-Signal fortschreiben: EINE Zeile je Betrieb.

        Die drei Nutzdaten-Tabellen der KI sind für den Client gesperrt
        (Wurzel 6); diese Zeile ist die einzige, auf die die Oberfläche ein Abo
        halten kann. `schritt` ist ein kurzer Satz OHNE Gastnamen oder Texte —
        nur „was passiert gerade". Best effort: das Signal darf den Lauf nicht
        kippen, meldet seinen Ausfall aber LAUT (Wurzel 5).
        """
        jetzt = _jetzt()
        zeile: dict[str, object] = {
            "tenant_id": tenant_id,
            "letzter_schritt": schritt[:200],
            "schritt_at": jetzt,
            "updated_at": jetzt,
        }
        if lauf_abgeschlossen:
            zeile["letzter_lauf_at"] = jetzt
            zeile["laeufe"] = int((self.stand(tenant_id) or {}).get("laeufe") or 0) + 1
        try:
            self._db.table("review_ki_stand").upsert(
                zeile, on_conflict="tenant_id"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Signal, nicht Hauptpfad
            log.warning(
                "review_ki_stand_nicht_geschrieben",
                tenant_id=tenant_id,
                fehler=str(exc)[:200],
            )

    def stand(self, tenant_id: str) -> dict | None:
        zeilen = (
            self._db.table("review_ki_stand")
            .select("letzter_lauf_at, letzter_schritt, schritt_at, laeufe")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return zeilen[0] if zeilen else None

    def protokoll(
        self,
        tenant_id: str,
        *,
        richtung: str | None = None,
        limit: int = 50,
    ) -> KiProtokollList:
        menge = max(1, min(int(limit), MAX_PROTOKOLL))
        q = (
            self._db.table("review_ki_protokoll")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(menge)
        )
        if richtung:
            q = q.eq("richtung", richtung)
        zeilen = q.execute().data or []
        kontext = self._protokoll_kontext(tenant_id, zeilen)
        items = [
            KiProtokollEintrag(
                **kontext.get(str(z.get("bezug_id") or ""), {}),
                id=str(z["id"]),
                richtung=z["richtung"],
                quelle=z["quelle"],
                bezug_id=z.get("bezug_id"),
                note=z.get("note"),
                eingabe_auszug=z.get("eingabe_auszug"),
                ergebnis=z.get("ergebnis"),
                zustellart=z["zustellart"],
                gesendet_at=z.get("gesendet_at"),
                verwendete_fragen=list(z.get("verwendete_fragen") or []),
                grund=z.get("grund"),
                created_at=z.get("created_at"),
            )
            for z in zeilen
        ]
        return KiProtokollList(items=items, total=len(items))

    def _protokoll_kontext(
        self, tenant_id: str, zeilen: list[dict]
    ) -> dict[str, dict]:
        """Gast, Kanal, Objekt und Warteschlangen-Stand je Bezug — in drei
        Abfragen für die ganze Seite, nicht je Zeile.

        Ohne das stand im Protokoll nur eine UUID; niemand konnte ablesen, WEN
        die KI beantwortet hat und ob der Text wartet, raus ist oder scheiterte
        (Debugging-Pflicht: sichtbar machen, was die KI tut)."""
        ids = sorted(
            {str(z["bezug_id"]) for z in zeilen if z.get("bezug_id") and z.get("quelle") == "ota"}
        )
        if not ids:
            return {}
        bewertungen = (
            self._db.table("channex_review")
            .select("id, guest_name, ota, property_id")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        objekt_ids = sorted({str(b["property_id"]) for b in bewertungen if b.get("property_id")})
        titel = {
            str(p["id"]): p.get("title")
            for p in (
                (
                    self._db.table("properties")
                    .select("id, title")
                    .eq("tenant_id", tenant_id)
                    .in_("id", objekt_ids)
                    .execute()
                ).data
                or []
            )
        } if objekt_ids else {}
        schlange = {
            str(q["antwort_auf_id"]): q
            for q in (
                (
                    self._db.table("guest_review_queue")
                    .select("antwort_auf_id, status, error")
                    .eq("tenant_id", tenant_id)
                    .in_("antwort_auf_id", ids)
                    .execute()
                ).data
                or []
            )
        }
        kontext: dict[str, dict] = {}
        for b in bewertungen:
            bid = str(b["id"])
            eintrag = schlange.get(bid) or {}
            kontext[bid] = {
                "gast_name": b.get("guest_name"),
                "kanal": b.get("ota"),
                "objekt_titel": titel.get(str(b.get("property_id") or "")),
                "warteschlange_status": eintrag.get("status"),
                "warteschlange_fehler": eintrag.get("error"),
            }
        return kontext

def _jetzt() -> str:
    return datetime.now(UTC).isoformat()
