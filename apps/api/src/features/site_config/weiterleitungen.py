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

from src.core.captcha import CaptchaError, CaptchaService
from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import baum, formular_anlagen, formular_nachlauf, formulare, regeln
from .beitrag_eigene_felder import felder_laden as eigene_felder_laden
from .beitrag_oeffentlich import beitrag_felder_oeffentlich
from .formular_anlagen import (
    FormAnlage,
    FormAnlagenListResponse,
    FormUploadResponse,
)
from .schemas import (
    BlockType,
    ContactContent,
    FormContent,
    FormFieldType,
    FormSubmission,
    FormSubmissionListResponse,
    FormSubmissionRequest,
    FormSubmissionResponse,
    PopupTrigger,
    PublicBlock,
    PublicBlogAngaben,
    PublicPageMeta,
    PublicPageResponse,
    PublicPopup,
    PublicPopupListResponse,
    PublicPost,
    PublicPostEigenesFeld,
    PublicPostListResponse,
    PublicPostNachbar,
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
    kontakt_formular_felder,
)
from .seiten import (
    beitraege_laden,
    beitrag_laden,
    blog_einstellungen_lesen,
    fehlerseite_laden,
    nachbarbeitraege,
    popups_laden,
)
from .seo import seo_befunde, sitemap_daten
from .service import SiteConfigError

log = get_logger("nextdays.site_config.weiterleitungen")

#: Aktionsname des Captcha-Tokens fuer Formulare auf Kunden-Websites (0445).
#:
#: MUSS mit dem String uebereinstimmen, den der Renderer an
#: `grecaptcha.enterprise.execute` uebergibt (`builder/lib/captcha.ts`) —
#: Google prueft ihn gegen. Ein EIGENER Name und nicht „kontakt" (der der
#: Marketing-Seite): waere er derselbe, liesse sich ein Token, das auf unserer
#: Kontaktseite erzeugt wurde, vor dem Formular eines Kunden wiederverwenden,
#: und die Aktionsangabe waere wertlos.
CAPTCHA_AKTION = "website_formular"


def _upload_geheimnis() -> bytes:
    """Der Schluessel, mit dem Upload-Tickets signiert werden (0445).

    DASSELBE Geheimnis wie fuer die Entwurfs-Vorschau und den Seiten-Passwort-
    Zugang (`SITE_DRAFT_SECRET`), und das ist kein Sparen: die Nachricht traegt
    das Praefix `upload.` (siehe `formular_anlagen.ticket_erzeugen`), waehrend
    die anderen beiden `{tenant}.{page}.{exp}` bzw. `{page}.{exp}` lauten. Die
    Namensraeume sind damit getrennt — ein Vorschau-Token laesst sich nicht als
    Upload-Ticket vorzeigen. Ein zweites Geheimnis waere eine zweite Variable,
    die in einer Umgebung fehlen kann, und ein fehlendes Geheimnis ist hier ein
    503.

    Fail-CLOSED (Wurzel 5): kein hartkodierter Ersatz. Sonst koennte jeder
    gueltige Tickets faelschen und Dateien an fremde Einsendungen haengen.
    """
    geheim = get_settings().site_draft_secret.get_secret_value()
    if not geheim:
        raise SiteConfigError(
            "SITE_DRAFT_SECRET ist nicht konfiguriert.", status_code=503
        )
    return geheim.encode()


def _erster_text(werte: dict[str, str]) -> str:
    """Der erste gefuellte Wert einer Sprachtabelle.

    Fuer eine Mail an den GAST, dessen Sprache wir nicht kennen: er hat ein
    Formular ausgefuellt, keine Sprache gewaehlt. Die erste gepflegte Fassung
    ist die ehrlichste Wahl — eine erfundene Uebersetzung waere schlechter, und
    gar nichts zu schicken auch.
    """
    for wert in (werte or {}).values():
        if (wert or "").strip():
            return wert.strip()
    return ""

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

    def __init__(
        self, db: Client, site: object, captcha: CaptchaService | None = None
    ) -> None:
        self._db = db
        # Der Spamschutz oeffentlicher Formulare (0445). Einsetzbar, damit ein
        # Test ihn ersetzen kann — dieselbe Bauart wie im `contact`-Slice, und
        # es ist DERSELBE Dienst mit demselben Schluessel: eine zweite
        # Captcha-Kette waere ein zweiter Ort, an dem eine Schwelle steht.
        self._captcha = captcha or CaptchaService()
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
            .select("id, parent_id, kind, span, type, content, settings")
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
            blocks=baum.baum_bauen(
                blocks,
                kennung=formulare.block_kennung,
                tenant_id=branding.tenant_id,
            ),
            branding=branding,
        )

    def objekt_vorlage(self, host: str) -> PublicPageResponse | None:
        """Das Master-Layout der Objektseite (0468), oder ``None``.

        ``None`` heißt: dieser Betrieb hat noch keine Bausteine darauf gelegt.
        Der Renderer zeigt dann sein eingebautes Layout — und das ist wichtig:
        die Objektseiten bestehender Betriebe dürfen nicht leer werden, nur weil
        es diese Vorlage jetzt gibt (Wurzel 1 — nichts am Bestand ändern, was
        nichts damit zu tun hat).

        Kein 404 im Leerfall, aus demselben Grund wie bei der Fehlerseite: der
        Normalfall gehört nicht als Fehlermeldung ins Log.

        Es gibt hier KEINE Prüfung auf „veröffentlicht". Eine dynamische Seite
        wird nie veröffentlicht — sie existiert, sobald es Objekte gibt. Was der
        Gast sieht, entscheidet der Status des OBJEKTS, nicht der der Vorlage.
        """
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        rows = (
            self._db.table("site_pages")
            .select("id, title")
            .eq("tenant_id", branding.tenant_id)
            .eq("page_type", "dynamic")
            .eq("dynamic_source", "property")
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        seite = rows[0]
        blocks = (
            self._db.table("site_blocks")
            .select("id, parent_id, kind, span, type, content, settings")
            .eq("page_id", seite["id"])
            .order("position")
            .execute()
        ).data or []
        if not blocks:
            # Vorlage vorhanden, aber leer — dasselbe wie „keine Vorlage".
            # Sonst lieferte der Renderer eine Objektseite ohne einen einzigen
            # Abschnitt aus, und der Gast sähe eine weiße Seite.
            return None
        return PublicPageResponse(
            tenant_id=branding.tenant_id,
            page=PublicPageMeta(
                slug="inserat/[id]",
                title=seite.get("title") or "",
                # Die VORLAGE steht in keinem Index — die erzeugten Objektseiten
                # schon. `noindex` gilt hier für das Muster, nicht für sie.
                noindex=True,
            ),
            blocks=baum.baum_bauen(
                blocks,
                kennung=formulare.block_kennung,
                tenant_id=branding.tenant_id,
            ),
            branding=branding,
        )

    def systemseiten_vorlage(
        self, host: str, key: str
    ) -> PublicPageResponse | None:
        """Die Bausteine einer SYSTEMSEITE (0474), oder ``None``.

        Dieselbe Mechanik wie :meth:`objekt_vorlage`, nur über ``system_key``
        statt ``dynamic_source``: Checkout, Bestätigung und Blog-Übersicht sind
        seit 0474 gestaltbar.

        ``None`` heißt „noch keine Bausteine darauf" — der Renderer zeigt dann
        sein eingebautes Layout. Genau das schützt den Bestand: eine
        Buchungsseite darf nicht leer werden, nur weil es diese Vorlage jetzt
        gibt (Wurzel 1).

        Kein 404 im Leerfall: der Normalfall gehört nicht als Fehlermeldung ins
        Log.

        Keine Prüfung auf „veröffentlicht": eine Systemseite wird nie
        veröffentlicht, sie existiert, weil es ihre Route gibt.
        """
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        rows = (
            self._db.table("site_pages")
            .select("id, title, slug")
            .eq("tenant_id", branding.tenant_id)
            .eq("page_type", "system")
            .eq("system_key", key)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        seite = rows[0]
        blocks = (
            self._db.table("site_blocks")
            .select("id, parent_id, kind, span, type, content, settings")
            .eq("page_id", seite["id"])
            .order("position")
            .execute()
        ).data or []
        if not blocks:
            # Seite vorhanden, aber leer — dasselbe wie „keine Vorlage". Sonst
            # lieferte der Renderer eine Buchungsseite ohne einen einzigen
            # Abschnitt aus, und der Gast sähe eine weiße Seite statt eines
            # Buchungsformulars.
            return None
        return PublicPageResponse(
            tenant_id=branding.tenant_id,
            page=PublicPageMeta(
                slug=seite.get("slug") or "",
                title=seite.get("title") or "",
                # Checkout und Bestätigung stehen in keinem Index (0466). Die
                # Blog-Übersicht schon — ihr `noindex` steht an der Seite selbst
                # und wird hier nicht überschrieben; dieser Wert beschreibt nur,
                # dass die VORLAGE als solche nicht indexiert wird.
                noindex=True,
            ),
            blocks=baum.baum_bauen(
                blocks,
                kennung=formulare.block_kennung,
                tenant_id=branding.tenant_id,
            ),
            branding=branding,
        )

    # === Formulare (0436, Etappe F) =====================================

    def formular_absenden(
        self,
        host: str,
        anfrage: FormSubmissionRequest,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> FormSubmissionResponse:
        """Eine Formular-Einsendung eines GASTES annehmen (0436/0444/0445).

        Der einzige Weg im Slice, auf dem ein Fremder schreibt — deshalb prüft
        er der Reihe nach ALLES, statt sich auf den Browser zu verlassen:

        1. Der Host muss zu einer aktiven Domain gehören und die Website online
           sein (`resolve_site_by_domain`).
        2. Der Block muss zu DIESEM Betrieb gehören, vom Typ `form` sein und auf
           einer VERÖFFENTLICHTEN Seite liegen. Ohne diese Prüfung könnte
           jemand mit einer fremden `block_id` in die Antwortenliste eines
           anderen Betriebs schreiben (Wurzel 3) oder ein Formular benutzen, das
           noch im Entwurf steckt.
        3. **Spamschutz** (0445): reCAPTCHA Enterprise, serverseitig bewertet,
           über dieselbe Kette wie das Kontaktformular der Marketing-Seite
           (`core.captcha`). Bei Hostaway ist reCAPTCHA an und NICHT
           abschaltbar; hier ebenso — es gibt keinen Schalter im Block-Inhalt,
           denn ein Schalter „Spamschutz aus" wäre eine Einladung.
        4. Die Felder werden gegen die Definition geprüft, unbekannte fliegen
           weg (`formulare.einsendung_pruefen`).

        Die Reihenfolge ist bedeutungstragend: der Captcha-Aufruf kostet einen
        HTTP-Aufruf zu Google und steht deshalb NACH den billigen Prüfungen —
        ein Bot mit erfundener `block_id` soll uns kein Google-Kontingent
        kosten. Er steht aber VOR dem Speichern: eine Zeile, die erst
        geschrieben und dann verworfen wird, hätte den Zähler des Betriebs
        schon bewegt.
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
        # ZWEI Blocktypen dürfen hier einsenden: der Formular-Abschnitt mit
        # seiner eigenen Feldliste, und der Kontakt-Abschnitt mit dem Schalter
        # „Kontaktformular anzeigen". Letzterer hat keinen Feld-Baukasten, seine
        # Felder stehen fest in `block_inhalte.kontakt_formular_felder()` —
        # bis 27.08.2026 war der Schalter deshalb eine Attrappe ohne Formular
        # (Prüfbericht B4).
        erlaubte_typen = (BlockType.form.value, BlockType.contact.value)
        if not rows or rows[0].get("type") not in erlaubte_typen:
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

        if block.get("type") == BlockType.contact.value:
            kontakt = ContactContent.model_validate(block.get("content") or {})
            # Der Schalter AUS heißt: es gibt hier kein Formular. Eine
            # Einsendung darauf ist kein Versehen, sondern ein direkter POST
            # (Wurzel 3: der Anfrage nicht vertrauen) — dieselbe karge Meldung
            # wie bei einem fremden Block.
            if not kontakt.show_form:
                raise SiteConfigError(
                    "Formular nicht gefunden.", status_code=404
                )
            # Empfänger und Überschrift kommen aus dem Kontakt-Abschnitt, die
            # Felder aus der festen Liste. `bestaetigung` bleibt auf ihrem
            # Standard (an) — ein Gast, der abschickt und nichts hört, schickt
            # noch einmal.
            inhalt = FormContent(
                headline=kontakt.headline,
                recipient=kontakt.email,
                form_name="Kontakt",
                fields=kontakt_formular_felder(),
            )
        else:
            inhalt = FormContent.model_validate(block.get("content") or {})

        # Spamschutz VOR dem Speichern. `CaptchaError` wird durchgereicht und
        # nicht umgedeutet: 403 heisst „der Absender ist durchgefallen",
        # 502/503 heisst „wir koennen gerade nicht pruefen" — zwei
        # verschiedene Aussagen an zwei verschiedene Leute (Wurzel 5).
        try:
            self._captcha.pruefen(
                anfrage.recaptcha_token,
                aktion=CAPTCHA_AKTION,
                ip=ip,
                user_agent=user_agent,
            )
        except CaptchaError as exc:
            raise SiteConfigError(exc.message, status_code=exc.status_code) from exc

        zeile = formulare.speichern(
            self._db, tenant_id, str(block["id"]), inhalt, dict(anfrage.daten)
        )

        # === Nachlauf (0444) ===============================================
        # ALLES ab hier ist best-effort. Die Einsendung IST gespeichert; kippt
        # hier etwas, darf das den Gast nicht treffen. Er hat sein Formular
        # abgeschickt, und dass unsere Bestaetigung nicht durchkam, ist unser
        # Problem, nicht seins (Wurzel 5).
        if inhalt.webhook_url:
            formular_nachlauf.webhook_senden(
                inhalt.webhook_url,
                {
                    "form_name": inhalt.form_name,
                    "submission_id": str(zeile["id"]),
                    "created_at": str(zeile.get("created_at") or ""),
                    "daten": zeile.get("daten") or {},
                },
            )

        # Bestaetigung an den ABSENDER. Die Adresse kommt aus dem Formular
        # selbst — das erste E-Mail-Feld. Kein eigenes Pflichtfeld dafuer: ein
        # Formular ohne E-Mail-Feld kann keine Bestaetigung schicken, und das
        # ist in Ordnung.
        gesendet = False
        if inhalt.bestaetigung:
            adresse = next(
                (
                    (zeile.get("daten") or {}).get(f.name, "")
                    for f in inhalt.fields
                    if f.type is FormFieldType.email
                ),
                "",
            )
            gesendet = formular_nachlauf.bestaetigung_senden(
                adresse,
                branding.site_name,
                _erster_text(inhalt.bestaetigung_text)
                or _erster_text(inhalt.success_text),
                zeile.get("daten") or {},
            )

        # Ticket NUR, wenn das Formular wirklich eine Datei annimmt. Sonst
        # bekaeme jeder Absender die Kennung seiner Einsendung und einen
        # gueltigen Schluessel dazu — fuer eine Tuer, die es nicht gibt (0445).
        hat_datei = any(f.type is FormFieldType.file for f in inhalt.fields)
        return FormSubmissionResponse(
            # Die Weiterleitung kommt in die ANTWORT und wird nicht als
            # HTTP-302 geschickt: der Aufruf kommt aus JavaScript, und ein 302
            # darauf laedt die Zieladresse per fetch nach, statt den Browser
            # dorthin zu schicken. Der Renderer entscheidet.
            weiterleitung=inhalt.weiterleitung,
            # Wurde eine Bestaetigung an den Absender verschickt? Der Renderer
            # sagt es dem Gast — sonst wartet er auf eine Mail, die nie kommt.
            bestaetigung_gesendet=gesendet,
            submission_id=str(zeile["id"]) if hat_datei else None,
            upload_ticket=(
                formular_anlagen.ticket_erzeugen(
                    _upload_geheimnis(), str(zeile["id"])
                )
                if hat_datei
                else None
            ),
        )

    def formular_anlage(
        self,
        submission_id: str,
        ticket: str | None,
        feld: str,
        dateiname: str,
        inhalt: bytes,
    ) -> FormUploadResponse:
        """Eine Datei an eine bereits gespeicherte Einsendung haengen (0445).

        OHNE JWT — der Absender ist ein Gast. Der Weg ist deshalb genau so eng
        gebaut, wie er in `formular_anlagen` beschrieben ist:

        1. **Ticket zuerst.** Ohne gueltiges, nicht abgelaufenes Ticket ist
           schon der erste Schritt zu Ende (401). Es haengt an genau dieser
           Einsendung und gilt zwei Minuten. Ohne diese Pruefung koennte jeder,
           der eine Einsendungs-ID kennt oder raet, Dateien an die Einsendung
           eines Fremden haengen. Das Ticket wird geprueft, BEVOR die Zeile
           geladen wird: sonst waere die Antwortzeit ein Orakel dafuer, welche
           IDs es gibt.
        2. **Der Tenant kommt aus der ZEILE**, nie vom Client (Wurzel 3).
        3. **Deckel je Einsendung.** Ohne ihn waere der Endpunkt zwei Minuten
           lang ein unbegrenzter Bereich (Wurzel 8).
        4. Erst dann `speichern` — dort sitzen Groessengrenze und
           Magic-Byte-Pruefung.

        Der Zaehler wird VOR dem Speichern gelesen und nicht danach: die
        Alternative waere, erst abzulegen und dann festzustellen, dass es eine
        zu viel war.
        """
        if not formular_anlagen.ticket_gilt(
            _upload_geheimnis(), submission_id, ticket
        ):
            raise SiteConfigError(
                "Der Upload-Schluessel fehlt oder ist abgelaufen.",
                status_code=401,
            )
        einsendung = formular_anlagen.einsendung_pruefen(self._db, submission_id)
        if formular_anlagen.anzahl(self._db, submission_id) >= (
            formular_anlagen.MAX_ANLAGEN
        ):
            raise SiteConfigError(
                "Es sind hoechstens "
                f"{formular_anlagen.MAX_ANLAGEN} Anlagen je Anfrage moeglich.",
                status_code=422,
            )
        zeile = formular_anlagen.speichern(
            self._db,
            str(einsendung["tenant_id"]),
            submission_id,
            feld,
            dateiname,
            inhalt,
        )
        return FormUploadResponse(
            id=str(zeile["id"]),
            name=str(zeile["original_name"]),
            groesse=int(zeile["groesse"]),
        )

    def formular_anlagen_liste(
        self, ctx: AuthContext, submission_id: str
    ) -> FormAnlagenListResponse:
        """Die Anlagen EINER Einsendung — mit signierter, kurzlebiger Adresse.

        Auf `(submission_id, tenant_id)` gescopt, genau wie der Listen-Pfad
        darueber (Wurzel 9): waere hier nur die ID im Filter, koennte ein
        Betrieb die Anlagen der Einsendung eines anderen abrufen — inklusive
        einer gueltigen Leseadresse auf die Datei.
        """
        return FormAnlagenListResponse(
            items=[
                FormAnlage(**a)
                for a in formular_anlagen.liste(
                    self._db, ctx.tenant_id, submission_id
                )
            ]
        )

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

    # === Personalisierungs-Regeln (0440) ================================
    # Delegationen wie bei den Formularen: die Logik steht in `regeln`, weil
    # der oeffentliche Lesepfad sie ohne Auth-Kontext braucht.

    def regeln(self, ctx: AuthContext) -> regeln.RuleListResponse:
        return regeln.liste(self._db, ctx.tenant_id)

    def regel_anlegen(
        self, ctx: AuthContext, req: regeln.RuleCreate
    ) -> regeln.RuleResponse:
        return regeln.anlegen(self._db, ctx.tenant_id, req)

    def regel_aendern(
        self, ctx: AuthContext, rule_id: str, req: regeln.RuleUpdate
    ) -> regeln.RuleResponse:
        return regeln.aendern(self._db, ctx.tenant_id, rule_id, req)

    def regel_loeschen(self, ctx: AuthContext, rule_id: str) -> None:
        regeln.loeschen(self._db, ctx.tenant_id, rule_id)

    def regeln_ordnen(
        self, ctx: AuthContext, ids: list[str]
    ) -> regeln.RuleListResponse:
        return regeln.neu_ordnen(self._db, ctx.tenant_id, ids)

    def regeln_oeffentlich(self, host: str) -> regeln.PublicRuleListResponse:
        """Die aktiven Regeln eines Hosts.

        Ueber `resolve_site_by_domain` und nicht ueber die Tenant-Aufloesung
        allein: eine Website, die offline geschaltet ist, soll auch keine
        Regeln mehr ausspielen."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        return regeln.oeffentlich(self._db, branding.tenant_id)

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
            .select("id, parent_id, kind, span, page_id, type, content, settings")
            .in_("page_id", ids)
            .order("position")
            .execute()
        ).data or []
        # Je Seite EINEN Baum bauen. Die Zeilen werden vorher nach Seite
        # sortiert und nicht hinterher zusammengesetzt: ein Baum über mehrere
        # Seiten hinweg hätte Elternteile, die zu einer anderen Seite gehören —
        # `baum_bauen` würde sie zu Recht als verwaist melden.
        roh_je_seite: dict[str, list[dict]] = {i: [] for i in ids}
        for b in blocks:
            roh_je_seite.setdefault(str(b["page_id"]), []).append(b)
        nach_seite: dict[str, list[PublicBlock]] = {
            seite_id: baum.baum_bauen(
                zeilen,
                kennung=formulare.block_kennung,
                tenant_id=branding.tenant_id,
            )
            for seite_id, zeilen in roh_je_seite.items()
        }
        return PublicPopupListResponse(
            items=[
                PublicPopup(
                    id=str(z["id"]),
                    title=z.get("title") or "",
                    trigger=PopupTrigger(z["popup_trigger"]),
                    value=z.get("popup_value"),
                    device=z.get("popup_device"),
                    once=bool(z.get("popup_once", True)),
                    position=z.get("popup_position"),
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
        self,
        host: str,
        *,
        limit: int = 20,
        offset: int = 0,
        tag: str | None = None,
        tags: list[str] | None = None,
        q: str | None = None,
    ) -> PublicPostListResponse:
        """Die veröffentlichten Blog-Beiträge eines Hosts.

        `tag` ist die Filterleiste der Blog-Seite (EIN Schlagwort), `tags` die
        Mehrfachauswahl des „Alle Beiträge"-Abschnitts, `q` die Beitragssuche
        (nur Titel). Alle drei sind Filter auf DERSELBEN Abfrage — ein zweiter
        Endpunkt je Filter wäre eine zweite Wahrheit über dieselbe Liste."""
        branding = self._site.resolve_site_by_domain(host)  # type: ignore[attr-defined]
        rows = beitraege_laden(
            self._db,
            branding.tenant_id,
            limit=limit,
            offset=offset,
            tag=tag,
            tags=tags,
            q=q,
        )
        schlagwoerter = sorted(
            {t for r in rows for t in (r.get("tags") or []) if t}
        )
        return PublicPostListResponse(
            items=[self._post(r) for r in rows],
            total=len(rows),
            tags=schlagwoerter,
            blog=self._blog_angaben(branding.tenant_id),
        )

    def _blog_angaben(self, tenant_id: str) -> PublicBlogAngaben:
        """Blogname und RSS-Angaben für den Renderer (0457)."""
        e = blog_einstellungen_lesen(self._db, tenant_id)
        return PublicBlogAngaben(
            blog_name=e.blog_name,
            prev_next=e.blog_prev_next,
            rss_title=e.rss_title,
            rss_description=e.rss_description,
            rss_image_url=e.rss_image_url,
        )

    def beitrag(
        self, host: str, slug: str, sprache: str | None = None
    ) -> PublicPostResponse:
        """Ein einzelner Beitrag mit Abschnitten.

        404, wenn es ihn nicht gibt, er ein Entwurf ist ODER sein
        Erscheinungsdatum in der Zukunft liegt — die Vorplanung wäre sonst
        wirkungslos, sobald jemand den Link kennt.

        `sprache` wählt die Sprachfassung (0476). Ein Beitrag ist der Ort, an
        dem `excerpt` und `og_image_alt` überhaupt vorkommen — sie wurden
        übersetzt und wären hier ohne diesen Weg nie ausgeliefert worden."""
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
        vorheriger, naechster = nachbarbeitraege(
            self._db, branding.tenant_id, row.get("published_at")
        )
        # Die Sprachfassung dieses Beitrags (0476). Über den Site-Service, weil
        # dort die EINE Ladefunktion steht — eine zweite Abfrage hier wäre die
        # Stelle, an der beim nächsten Feld eine der beiden vergessen wird.
        fassung = self._site.sprachfassung(str(row["id"]), sprache) or {}
        return PublicPostResponse(
            tenant_id=branding.tenant_id,
            post=self._post(row, mit_text=True),
            blog=self._blog_angaben(branding.tenant_id),
            vorheriger=(
                PublicPostNachbar(**vorheriger) if vorheriger else None
            ),
            naechster=PublicPostNachbar(**naechster) if naechster else None,
            # Die EIGENEN Felder (0485) — nur Schluessel und Name, und nur die
            # sichtbaren: „versteckt" gilt fuer den ganzen Betrieb, also auch
            # fuer die Website.
            eigene_felder=[
                PublicPostEigenesFeld(feld_key=f.feld_key, label=f.label)
                for f in eigene_felder_laden(
                    self._db, branding.tenant_id
                ).felder
                if not f.versteckt
            ],
            page=PublicPageMeta(
                slug=row["slug"],
                # Die Sprachfassung gewinnt — dieselbe Rangfolge wie in
                # `_seo_meta`: Fassung → Beitrag → Website.
                title=fassung.get("title") or row["title"],
                # Der site-weite Rückfall gilt auch hier: ein Beitrag ohne
                # eigenen Meta-Titel bekommt den der Website.
                seo_title=(
                    fassung.get("seo_title")
                    or row.get("seo_title")
                    or branding.seo_title
                ),
                seo_description=(
                    fassung.get("seo_description")
                    or row.get("seo_description")
                    # Der Anrisstext, auch er in seiner Sprachfassung: für
                    # einen Beitrag ist er der natürliche Rückfall, weil er
                    # genau das tut, was eine Meta-Beschreibung tun soll.
                    or fassung.get("excerpt")
                    or row.get("excerpt")
                    or branding.seo_description
                ),
                og_image_url=row.get("og_image_url") or row.get("cover_image_url"),
                # Der Alt-Text gehört zum BILD: fällt das Vorschaubild auf das
                # Titelbild zurück, gilt der Alt-Text des Vorschaubilds nicht
                # mehr — er beschriebe dann ein anderes Bild (Wurzel 4).
                og_image_alt=(
                    (fassung.get("og_image_alt") or row.get("og_image_alt"))
                    if row.get("og_image_url")
                    else None
                ),
                noindex=bool(row.get("noindex")) or branding.noindex,
            ),
            blocks=baum.baum_bauen(
                blocks,
                kennung=formulare.block_kennung,
                tenant_id=branding.tenant_id,
            ),
            branding=branding,
        )

    @staticmethod
    def _post(row: dict, *, mit_text: bool = False) -> PublicPost:
        """Eine Beitragszeile zur öffentlichen Antwort.

        `mit_text` NUR auf der Detailseite: in der Liste wären zwanzig volle
        Beitragstexte zwanzigmal Ballast in einer Antwort, die sie nicht
        anzeigt (Wurzel 8).
        """
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
            content_html=row.get("content_html") if mit_text else None,
            parent_post_id=(
                str(row["parent_post_id"]) if row.get("parent_post_id") else None
            ),
            # Die Vorlagenfelder (0483/0485) reisen NUR auf der Detailseite mit
            # — dieselbe Begruendung wie beim Text: eine Uebersicht zeigt sie
            # nicht, und zwanzig Galerien in einer Listenantwort waeren
            # zwanzigmal Ballast (Wurzel 8).
            felder=beitrag_felder_oeffentlich(row) if mit_text else None,
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
