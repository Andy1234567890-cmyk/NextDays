"""URL-Weiterleitungen einer Kunden-Website (0430).

Eigenes Modul und keine weiteren Methoden am Service: der ist bei 1450 Zeilen
und `pylint` zieht hier bei 1500 die Grenze. Der Schnitt ist aber nicht nur
Zeilenzählung — Weiterleitungen sind der einzige Teil des Baukastens, der beim
FEHLSCHLAG einer Seitenauflösung greift. Sie hängen an keiner Seite und an keinem
Block, sondern am 404.

Wozu das Ganze: zieht ein Betrieb von Wix, WordPress oder Lodgify zu uns, sind
seine alten Adressen in Google, in Newslettern und auf Portalseiten verlinkt.
Ohne Weiterleitung landet jeder dieser Besucher auf einer Fehlerseite und die
Suchmaschinen-Platzierung, die über Jahre entstanden ist, verfällt.

Die Reihenfolge ist unverhandelbar: eine EXISTIERENDE Seite hat Vorrang. Sonst
wäre eine Seite über ihre eigene Adresse nicht mehr erreichbar, sobald jemand
versehentlich eine Weiterleitung darauf legt — und der Kunde würde die Ursache
nie in dieser Liste suchen (Hostaway nennt genau das als häufigste Fehlerursache:
„Existing pages take priority over redirects").
"""

from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import formulare
from .schemas import (
    BlockType,
    FormContent,
    FormSubmission,
    FormSubmissionListResponse,
    FormSubmissionRequest,
    FormSubmissionResponse,
    PopupTrigger,
    PublicBlock,
    PublicPageMeta,
    PublicPageResponse,
    PublicPopup,
    PublicPopupListResponse,
    PublicPost,
    PublicPostListResponse,
    PublicPostResponse,
    RedirectCreate,
    RedirectImportRequest,
    RedirectImportResult,
    RedirectListResponse,
    RedirectResponse,
    RedirectType,
    RedirectUpdate,
    SeoBefund,
    SeoPruefungResponse,
    SitemapResponse,
)
from .seiten import beitraege_laden, beitrag_laden, fehlerseite_laden, popups_laden
from .seo import seo_befunde, sitemap_daten
from .service import SiteConfigError

log = get_logger("nextdays.site_config.weiterleitungen")

_COLS = "id, source_path, target, redirect_type, is_active, created_at"

# Wie viele Weiterleitungen eine Website führen darf. Ohne Deckel ist die
# Auflösung pro 404 eine unbegrenzte Liste (Wurzel 8) und die Import-Route ein
# Weg, die Tabelle zu fluten. 1000 ist das Zehnfache dessen, was ein
# Plattform-Umzug braucht.
MAX_WEITERLEITUNGEN = 1000


def _zeile(row: dict) -> RedirectResponse:
    """DB-Zeile → Antwort. `redirect_type` kommt als smallint aus der DB und
    wird zum benannten Enum: die Oberfläche zeigt „dauerhaft/vorübergehend",
    nicht 301/302."""
    return RedirectResponse(
        id=str(row["id"]),
        source_path=row["source_path"],
        target=row["target"],
        redirect_type=RedirectType(str(row["redirect_type"])),
        is_active=bool(row["is_active"]),
        created_at=str(row["created_at"]) if row.get("created_at") else None,
    )


def liste(db: Client, tenant_id: str) -> RedirectListResponse:
    """Alle Weiterleitungen des Betriebs, neueste zuerst."""
    rows = (
        db.table("site_redirects")
        .select(_COLS)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(MAX_WEITERLEITUNGEN)
        .execute()
    ).data or []
    return RedirectListResponse(
        items=[_zeile(r) for r in rows], total=len(rows)
    )


def _anzahl(db: Client, tenant_id: str) -> int:
    rows = (
        db.table("site_redirects")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(MAX_WEITERLEITUNGEN + 1)
        .execute()
    ).data or []
    return len(rows)


def anlegen(
    db: Client,
    tenant_id: str,
    daten: RedirectCreate,
    *,
    fehler: type[Exception],
    ueberschreiben: bool = False,
) -> RedirectResponse:
    """Eine Weiterleitung anlegen — idempotent gegen Doppelklick (Wurzel 2).

    Der UNIQUE-Index (tenant_id, lower(source_path)) ist der Backstop; hier wird
    der Konflikt AUSGEWERTET statt als 500 durchzurutschen:

    * Ziel und Typ sind identisch → die vorhandene Zeile ist das Ergebnis. Das
      ist der Doppelklick, und er darf keinen Fehler zeigen: der Kunde wollte
      diese Weiterleitung, sie existiert, alles gut.
    * Ziel oder Typ weichen ab → 409 mit klarer Meldung, ODER überschreiben,
      wenn der Aufrufer es ausdrücklich verlangt (CSV-Import). Still zu
      überschreiben wäre der Fehler: der Kunde hätte eine funktionierende
      Weiterleitung verloren, ohne es zu erfahren.

    Warum nicht `upsert`: der unterscheidet diese drei Fälle nicht und würde bei
    abweichendem Ziel immer überschreiben.
    """
    if _anzahl(db, tenant_id) >= MAX_WEITERLEITUNGEN:
        raise fehler(
            f"Mehr als {MAX_WEITERLEITUNGEN} Weiterleitungen sind nicht "
            "möglich. Bitte nicht mehr benötigte löschen.",
            status_code=422,
        )
    nutzlast = {
        "tenant_id": tenant_id,
        "source_path": daten.source_path,
        "target": daten.target,
        "redirect_type": int(daten.redirect_type.value),
        "is_active": daten.is_active,
    }
    try:
        rows = (
            db.table("site_redirects").insert(nutzlast).execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — nur der UNIQUE-Konflikt ist gemeint
        if getattr(exc, "code", None) != "23505":
            raise
        return _konflikt_aufloesen(
            db,
            tenant_id,
            daten,
            fehler=fehler,
            ueberschreiben=ueberschreiben,
        )
    if not rows:
        raise fehler("Weiterleitung konnte nicht angelegt werden.", status_code=500)
    log.info(
        "site_redirect_angelegt",
        tenant_id=tenant_id,
        source_path=daten.source_path,
        redirect_type=daten.redirect_type.value,
    )
    return _zeile(rows[0])


def _konflikt_aufloesen(
    db: Client,
    tenant_id: str,
    daten: RedirectCreate,
    *,
    fehler: type[Exception],
    ueberschreiben: bool,
) -> RedirectResponse:
    """Der UNIQUE-Konflikt aus `anlegen` — siehe dortige Erklärung."""
    vorhanden = (
        db.table("site_redirects")
        .select(_COLS)
        .eq("tenant_id", tenant_id)
        .eq("source_path", daten.source_path)
        .limit(1)
        .execute()
    ).data or []
    if not vorhanden:
        # Der Index hat gegriffen, die Zeile ist aber nicht zu finden: das kann
        # nur eine Groß-/Kleinschreibungs-Abweichung sein (der Index ist auf
        # lower(), die Abfrage nicht). Kein erfundener Rückfall — klar melden.
        raise fehler(
            "Für diesen Pfad existiert bereits eine Weiterleitung mit anderer "
            "Schreibweise. Bitte die Liste prüfen.",
            status_code=409,
        )
    row = vorhanden[0]
    gleich = row["target"] == daten.target and int(
        row["redirect_type"]
    ) == int(daten.redirect_type.value)
    if gleich:
        return _zeile(row)
    if not ueberschreiben:
        raise fehler(
            f"Für {daten.source_path} existiert bereits eine Weiterleitung "
            f"nach {row['target']}.",
            status_code=409,
        )
    aktualisiert = (
        db.table("site_redirects")
        .update(
            {
                "target": daten.target,
                "redirect_type": int(daten.redirect_type.value),
                "is_active": daten.is_active,
            }
        )
        .eq("id", row["id"])
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    return _zeile(aktualisiert[0] if aktualisiert else row)


def aendern(
    db: Client,
    tenant_id: str,
    redirect_id: str,
    daten: RedirectUpdate,
    *,
    fehler: type[Exception],
) -> RedirectResponse:
    """Ziel, Typ oder Aktiv-Zustand ändern. Der Quellpfad ist nicht änderbar
    (siehe `RedirectUpdate`).

    Wurzel 3/9: die Zeile wird per (id, tenant_id) geladen, nicht per ID mit
    nachgelagertem Vergleich — derselbe Scope wie im Listen-Pfad."""
    load_scoped(
        db,
        "site_redirects",
        redirect_id,
        tenant_id,
        columns=_COLS,
        not_found=fehler("Weiterleitung nicht gefunden.", status_code=404),
    )
    patch: dict[str, object] = {}
    if daten.target is not None:
        patch["target"] = daten.target
    if daten.redirect_type is not None:
        patch["redirect_type"] = int(daten.redirect_type.value)
    if daten.is_active is not None:
        patch["is_active"] = daten.is_active
    if not patch:
        # Ein leeres Update ist keine Änderung. Es als Erfolg zu quittieren wäre
        # eine Lüge über einen Schreibvorgang, der nicht stattfand.
        raise fehler("Keine Änderung angegeben.", status_code=400)
    rows = (
        db.table("site_redirects")
        .update(patch)
        .eq("id", redirect_id)
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    if not rows:
        raise fehler("Weiterleitung nicht gefunden.", status_code=404)
    return _zeile(rows[0])


def loeschen(
    db: Client, tenant_id: str, redirect_id: str, *, fehler: type[Exception]
) -> None:
    """Weiterleitung entfernen. Nach dem Löschen antwortet der alte Pfad wieder
    mit 404 — das ist gewollt und der einzige Weg zurück."""
    load_scoped(
        db,
        "site_redirects",
        redirect_id,
        tenant_id,
        columns="id",
        not_found=fehler("Weiterleitung nicht gefunden.", status_code=404),
    )
    db.table("site_redirects").delete().eq("id", redirect_id).eq(
        "tenant_id", tenant_id
    ).execute()
    log.info(
        "site_redirect_geloescht", tenant_id=tenant_id, redirect_id=redirect_id
    )


def importieren(
    db: Client,
    tenant_id: str,
    anfrage: RedirectImportRequest,
    *,
    fehler: type[Exception],
) -> RedirectImportResult:
    """Mehrere Weiterleitungen in einem Zug (CSV-Import der Oberfläche).

    Kein `all-or-nothing`: eine kaputte Zeile in einer 200-Zeilen-Datei darf
    nicht die 199 gültigen verwerfen. Stattdessen wird jede Zeile einzeln
    versucht und das Ergebnis nach Wirkung getrennt gemeldet (angelegt /
    geändert / übersprungen + Fehlerliste mit Zeilennummer).

    Der Zähler `skipped` unterscheidet dabei nicht zwischen „war schon genau so
    da" und „übersprungen wegen Konflikt": beides ist für den Kunden dasselbe —
    diese Zeile hat nichts geändert. Die Konflikte stehen zusätzlich in
    `errors`, mit Zeilennummer.
    """
    # Die Zähler laufen als lokale Werte und wandern erst am Ende ins Modell.
    # Nicht aus Stilgründen: `RedirectImportResult.errors` ist mit
    # `Field(default_factory=list)` deklariert, und dann hält astroid das
    # Attribut statisch für ein `FieldInfo` — `errors.append(...)` wäre ein
    # (falscher) `no-member`. Ein Disable-Kommentar wäre die Alternative; ein
    # Ergebnis, das in EINEM Zug entsteht, ist ohnehin besser lesbar.
    angelegt = 0
    geaendert = 0
    uebersprungen = 0
    fehlerzeilen: list[str] = []
    for nummer, eintrag in enumerate(anfrage.items, start=1):
        vorher = (
            db.table("site_redirects")
            .select("id, target, redirect_type")
            .eq("tenant_id", tenant_id)
            .eq("source_path", eintrag.source_path)
            .limit(1)
            .execute()
        ).data or []
        try:
            anlegen(
                db,
                tenant_id,
                eintrag,
                fehler=fehler,
                ueberschreiben=anfrage.overwrite,
            )
        except Exception as exc:  # noqa: BLE001 — je Zeile melden, nicht abbrechen
            # Nur die eigene Fehlerklasse hat eine kundentaugliche Meldung; alles
            # andere (Netz, DB) ist kein Zeilenproblem und muss hoch.
            if not isinstance(exc, fehler):
                raise
            uebersprungen += 1
            fehlerzeilen.append(f"Zeile {nummer}: {exc}")
            continue
        if not vorher:
            angelegt += 1
        elif vorher[0]["target"] == eintrag.target and int(
            vorher[0]["redirect_type"]
        ) == int(eintrag.redirect_type.value):
            # Stand vorher schon genau so da — kein Schreibvorgang.
            uebersprungen += 1
        else:
            geaendert += 1
    log.info(
        "site_redirects_import",
        tenant_id=tenant_id,
        angelegt=angelegt,
        geaendert=geaendert,
        uebersprungen=uebersprungen,
    )
    return RedirectImportResult(
        created=angelegt,
        updated=geaendert,
        skipped=uebersprungen,
        errors=fehlerzeilen,
    )


def aufloesen(db: Client, tenant_id: str, pfad: str) -> dict | None:
    """Öffentlicher Lesepfad: gibt es für diesen Pfad eine AKTIVE Weiterleitung?

    Rückgabe ``{"target": …, "redirect_type": 301|302}`` oder ``None``.

    Der Vergleich läuft über den normalisierten Pfad — kleingeschrieben, ohne
    Query, ohne Schluss-Schrägstrich. Das ist dieselbe Normalisierung wie beim
    Speichern (`_validate_source_path`), sonst trifft `/Alt/` seinen eigenen
    Eintrag nicht.

    KEIN Folgen einer Kette: findet der Renderer ein Ziel, leitet er dorthin und
    fertig. Wäre das Ziel selbst eine Quelle, entstünde bei A→B→A eine Endlos-
    Weiterleitung im Browser des Gastes. Einmal folgen heißt: im schlimmsten
    Fall landet der Gast auf einer Seite, die selbst weiterleitet — das merkt
    sein Browser und bricht ab, statt dass unser Server in einer Schleife läuft.
    """
    ziel = (pfad or "").strip()
    for trenner in ("?", "#"):
        if trenner in ziel:
            ziel = ziel.split(trenner, 1)[0]
    ziel = ziel.strip().lower()
    if not ziel.startswith("/"):
        ziel = "/" + ziel
    if len(ziel) > 1:
        ziel = ziel.rstrip("/") or "/"
    if len(ziel) > 500:
        # Ein überlanger Pfad kann keinen Eintrag treffen (die Spalte ist auf
        # 500 begrenzt). Früh raus, statt die DB damit zu behelligen.
        return None
    rows = (
        db.table("site_redirects")
        .select("target, redirect_type")
        .eq("tenant_id", tenant_id)
        .eq("source_path", ziel)
        .eq("is_active", True)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return None
    return {
        "target": rows[0]["target"],
        "redirect_type": int(rows[0]["redirect_type"]),
    }


class WeiterleitungsService:
    """Dünne Klasse um die Funktionen dieses Moduls — damit der Router eine
    Dependency bekommt wie überall sonst im Slice.

    Sie hält KEINE eigene Logik: alles steht in den Funktionen oben, weil die
    auch vom öffentlichen Lesepfad (ohne Auth-Kontext) gebraucht werden. Die
    Klasse existiert nur, um `ctx.tenant_id` und die Fehlerklasse einzusetzen —
    beides Dinge, die der Router sonst an jedem Aufruf wiederholen müsste.

    Warum nicht am `SiteConfigService`: der ist bei 1460 Zeilen, und `pylint`
    zieht hier bei 1500 die Grenze. Fünf Delegationen hätten ihn darüber
    gebracht — und ein Modul, das nach seinem Thema heißt, findet ohnehin
    schneller, wer Weiterleitungen sucht.
    """

    def __init__(self, db: Client, site: object) -> None:
        self._db = db
        # Der SiteConfigService wird NUR für die Host-Auflösung gebraucht
        # (`resolve_site_by_domain`). Bewusst über die öffentliche Methode und
        # nicht über `_tenant_id_for_host`: die öffentliche prüft zusätzlich den
        # Hauptschalter „Website offline" — eine offline Website soll auch keine
        # Weiterleitungen mehr beantworten.
        self._site = site

    def liste(self, ctx: AuthContext) -> RedirectListResponse:
        return liste(self._db, ctx.tenant_id)

    def anlegen(self, ctx: AuthContext, daten: RedirectCreate) -> RedirectResponse:
        return anlegen(
            self._db, ctx.tenant_id, daten, fehler=SiteConfigError
        )

    def aendern(
        self, ctx: AuthContext, redirect_id: str, daten: RedirectUpdate
    ) -> RedirectResponse:
        return aendern(
            self._db, ctx.tenant_id, redirect_id, daten, fehler=SiteConfigError
        )

    def loeschen(self, ctx: AuthContext, redirect_id: str) -> None:
        loeschen(self._db, ctx.tenant_id, redirect_id, fehler=SiteConfigError)

    def importieren(
        self, ctx: AuthContext, anfrage: RedirectImportRequest
    ) -> RedirectImportResult:
        return importieren(
            self._db, ctx.tenant_id, anfrage, fehler=SiteConfigError
        )

    def aufloesen_fuer_host(self, host: str, pfad: str) -> dict | None:
        """Öffentlich: Host + Pfad → Weiterleitungsziel oder ``None``.

        Der Renderer ruft das NUR, wenn er unter diesem Pfad keine Seite
        gefunden hat — die vorhandene Seite hat immer Vorrang."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        return aufloesen(self._db, branding.tenant_id, pfad)

    def pruefung(self, ctx: AuthContext) -> SeoPruefungResponse:
        """Was an der Auffindbarkeit dieser Website noch fehlt (Etappe B).

        Liegt in dieser Klasse und nicht am SiteConfigService, weil der bei 1460
        Zeilen an der `pylint`-Grenze steht — und weil die Prüfung dieselben
        Quellen liest wie die Sitemap (Seiten, Objekte, Config, Firmenprofil).
        """
        befunde = seo_befunde(self._db, ctx.tenant_id)
        seiten = (
            self._db.table("site_pages")
            .select("id")
            .eq("tenant_id", ctx.tenant_id)
            .eq("is_published", True)
            .limit(1000)
            .execute()
        ).data or []
        return SeoPruefungResponse(
            items=[SeoBefund(**b) for b in befunde],
            geprueft=len(seiten),
        )

    def fehlerseite(self, host: str) -> PublicPageResponse | None:
        """Die eigene 404-Seite eines Hosts (0433), oder ``None``.

        ``None`` heißt: dieser Betrieb hat keine eigene Fehlerseite angelegt —
        dann zeigt der Renderer seine eingebaute. Das ist kein Fehler und darf
        deshalb auch kein 404 der API sein: sonst stünde in jedem Log eine
        Fehlermeldung für den Normalfall.

        Die Seite muss VERÖFFENTLICHT sein. Eine unveröffentlichte Fehlerseite
        wäre der eine Fall, in dem ein Entwurf live ausgeliefert würde."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        seite = fehlerseite_laden(self._db, branding.tenant_id)
        if not seite:
            return None
        blocks = (
            self._db.table("site_blocks")
            .select("type, content, settings")
            .eq("page_id", seite["id"])
            .order("position")
            .execute()
        ).data or []
        return PublicPageResponse(
            tenant_id=branding.tenant_id,
            page=PublicPageMeta(
                slug="404",
                title=seite.get("title") or "",
                # Eine Fehlerseite gehört NIE in den Suchindex — unabhängig
                # davon, was an ihr gespeichert ist. Sie hat keinen eigenen
                # Inhalt, den jemand suchen würde, und indexiert konkurriert sie
                # mit den echten Seiten.
                noindex=True,
            ),
            blocks=[
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
                for b in blocks
            ],
            branding=branding,
        )

    # === Formulare (0436, Etappe F) =====================================

    def formular_absenden(
        self, host: str, anfrage: FormSubmissionRequest
    ) -> FormSubmissionResponse:
        """Eine Formular-Einsendung eines GASTES annehmen (0436).

        Der einzige Weg im Slice, auf dem ein Fremder schreibt — deshalb prüft
        er der Reihe nach ALLES, statt sich auf den Browser zu verlassen:

        1. Der Host muss zu einer aktiven Domain gehören und die Website online
           sein (`resolve_site_by_domain`).
        2. Der Block muss zu DIESEM Betrieb gehören, vom Typ `form` sein und auf
           einer VERÖFFENTLICHTEN Seite liegen. Ohne diese Prüfung könnte
           jemand mit einer fremden `block_id` in die Antwortenliste eines
           anderen Betriebs schreiben (Wurzel 3) oder ein Formular benutzen, das
           noch im Entwurf steckt.
        3. Die Felder werden gegen die Definition geprüft, unbekannte fliegen
           weg (`formulare.einsendung_pruefen`).
        """
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        tenant_id = branding.tenant_id
        rows = (
            self._db.table("site_blocks")
            .select("id, type, content, page_id")
            .eq("id", anfrage.block_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows or rows[0].get("type") != BlockType.form.value:
            # Dieselbe Meldung für „gibt es nicht" und „gehört einem anderen":
            # kein Existenz-Leak an einen fremden Betrieb.
            raise SiteConfigError("Formular nicht gefunden.", status_code=404)
        block = rows[0]
        seite = (
            self._db.table("site_pages")
            .select("is_published")
            .eq("id", block["page_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not seite or not seite[0].get("is_published"):
            raise SiteConfigError("Formular nicht gefunden.", status_code=404)

        inhalt = FormContent.model_validate(block.get("content") or {})
        formulare.speichern(
            self._db, tenant_id, str(block["id"]), inhalt, dict(anfrage.daten)
        )
        return FormSubmissionResponse()

    def formular_liste(
        self, ctx: AuthContext, *, limit: int = 50, offset: int = 0
    ) -> FormSubmissionListResponse:
        """Einsendungen des Betriebs (nur MANAGE_SITE_CONFIG).

        Es gibt keinen anderen Weg an diese Zeilen: die Tabelle hat für
        anon/authenticated kein Grant (0436), weil sie personenbezogene Daten
        Dritter enthält."""
        daten = formulare.liste(
            self._db, ctx.tenant_id, limit=limit, offset=offset
        )
        return FormSubmissionListResponse(
            items=[FormSubmission(**i) for i in daten["items"]],
            total=daten["total"],
        )

    def formular_gelesen(self, ctx: AuthContext, submission_id: str) -> None:
        formulare.als_gelesen(self._db, ctx.tenant_id, submission_id)

    def formular_loeschen(self, ctx: AuthContext, submission_id: str) -> None:
        formulare.loeschen(self._db, ctx.tenant_id, submission_id)

    def popups(self, host: str) -> PublicPopupListResponse:
        """Die veröffentlichten Pop-ups eines Hosts mit Auslösern und Blöcken
        (0437).

        Ein Abruf für alle: der Renderer braucht sie beim Seitenaufbau, und
        ein Aufruf je Pop-up wären drei zusätzliche Anfragen pro
        Seitenansicht.

        Steht die Website offline, wirft `resolve_site_by_domain` — dann gibt es
        auch keine Pop-ups."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        zeilen = popups_laden(self._db, branding.tenant_id)
        if not zeilen:
            return PublicPopupListResponse()
        # Alle Blöcke in EINER Abfrage holen und danach zuordnen. Bei drei
        # Pop-ups wären es sonst drei Abfragen — und die Zahl wächst mit dem,
        # was der Kunde anlegt.
        ids = [str(z["id"]) for z in zeilen]
        blocks = (
            self._db.table("site_blocks")
            .select("page_id, type, content, settings")
            .in_("page_id", ids)
            .order("position")
            .execute()
        ).data or []
        nach_seite: dict[str, list[PublicBlock]] = {i: [] for i in ids}
        for b in blocks:
            nach_seite.setdefault(str(b["page_id"]), []).append(
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
            )
        return PublicPopupListResponse(
            items=[
                PublicPopup(
                    id=str(z["id"]),
                    title=z.get("title") or "",
                    trigger=PopupTrigger(z["popup_trigger"]),
                    value=z.get("popup_value"),
                    device=z.get("popup_device"),
                    once=bool(z.get("popup_once", True)),
                    blocks=nach_seite.get(str(z["id"]), []),
                )
                # Ein Pop-up ohne Blöcke wird WEGGELASSEN: ein leeres Fenster,
                # das sich über die Seite legt, ist schlimmer als keines.
                for z in zeilen
                if z.get("popup_trigger") and nach_seite.get(str(z["id"]))
            ]
        )

    # === Blog (0438, Etappe H) ==========================================

    def beitraege(
        self, host: str, *, limit: int = 20, offset: int = 0, tag: str | None = None
    ) -> PublicPostListResponse:
        """Die veröffentlichten Blog-Beiträge eines Hosts."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        rows = beitraege_laden(
            self._db, branding.tenant_id, limit=limit, offset=offset, tag=tag
        )
        schlagwoerter = sorted(
            {t for r in rows for t in (r.get("tags") or []) if t}
        )
        return PublicPostListResponse(
            items=[self._post(r) for r in rows],
            total=len(rows),
            tags=schlagwoerter,
        )

    def beitrag(self, host: str, slug: str) -> PublicPostResponse:
        """Ein einzelner Beitrag mit Abschnitten.

        404, wenn es ihn nicht gibt, er ein Entwurf ist ODER sein
        Erscheinungsdatum in der Zukunft liegt — die Vorplanung wäre sonst
        wirkungslos, sobald jemand den Link kennt."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        row = beitrag_laden(self._db, branding.tenant_id, slug)
        if not row:
            raise SiteConfigError("Beitrag nicht gefunden.", status_code=404)
        blocks = (
            self._db.table("site_blocks")
            .select("type, content, settings")
            .eq("page_id", row["id"])
            .order("position")
            .execute()
        ).data or []
        return PublicPostResponse(
            tenant_id=branding.tenant_id,
            post=self._post(row),
            page=PublicPageMeta(
                slug=row["slug"],
                title=row["title"],
                # Der site-weite Rückfall gilt auch hier: ein Beitrag ohne
                # eigenen Meta-Titel bekommt den der Website.
                seo_title=row.get("seo_title") or branding.seo_title,
                seo_description=(
                    row.get("seo_description")
                    or row.get("excerpt")
                    or branding.seo_description
                ),
                og_image_url=row.get("og_image_url") or row.get("cover_image_url"),
                noindex=bool(row.get("noindex")) or branding.noindex,
            ),
            blocks=[
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
                for b in blocks
            ],
            branding=branding,
        )

    @staticmethod
    def _post(row: dict) -> PublicPost:
        return PublicPost(
            slug=row.get("slug") or "",
            title=row.get("title") or "",
            excerpt=row.get("excerpt"),
            author=row.get("author"),
            cover_image_url=row.get("cover_image_url"),
            tags=list(row.get("tags") or []),
            published_at=(
                str(row["published_at"]) if row.get("published_at") else None
            ),
        )

    def sitemap(self, host: str) -> SitemapResponse:
        """Öffentlich: alle indexierbaren Adressen eines Hosts (0430).

        Die site-weiten Angaben (Name, Beschreibung, Sprachen, noindex) reisen
        MIT, statt den Renderer einen zweiten Request stellen zu lassen: er
        braucht sie für robots.txt und llms.txt in derselben Sekunde, und die
        Host-Auflösung ist der teure Teil des Aufrufs.

        Steht die Website auf `noindex`, kommt die Liste trotzdem — der Renderer
        schreibt dann eine robots.txt mit `Disallow: /` und liefert die Sitemap
        gar nicht aus. Die Entscheidung gehört an die Stelle, die die Dateien
        schreibt; hier zu kürzen würde nur verbergen, dass es Seiten gibt."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        daten = sitemap_daten(self._db, branding.tenant_id)
        return SitemapResponse(
            **daten,
            noindex=branding.noindex,
            site_name=branding.site_name,
            seo_description=branding.seo_description or branding.tagline,
            default_language=branding.default_language,
            languages=branding.languages,
        )
