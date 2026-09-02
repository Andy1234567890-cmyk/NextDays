"""Verbundene Plattform-Konten eines Partners (Stufe B, 0521): OAuth-Start,
Code-Tausch, Snapshots, Beitrags-Kennzahlen, Trennen, Widerruf.

Ablauf „Konto verbinden":
  1. Partner klickt im Dashboard → `autorisieren()` baut die Anbieter-URL mit
     signiertem `state` (kanal_krypto) — der state bindet den Vorgang an
     GENAU diesen Partner.
  2. Die Plattform leitet auf `{PARTNER_BASE_URL}/api/auth/{provider}/callback`;
     die Partner-App reicht `code` + `state` mit dem Partner-Token an
     `POST /affiliates/channels/{provider}/connect` weiter → `verbinden()`.
     Token verlassen den Server nie.
  3. `verbinden()` tauscht den Code, liest die Konten hinter dem Login, legt
     je Konto eine Verbindung an (Token AES-GCM) und zieht sofort den ersten
     Snapshot — damit das Dashboard nicht bis zum nächsten Tageslauf leer bleibt.

Der Tageslauf (`synchronisieren`, aus jobs.partner_laeufe) erneuert Token vor
Ablauf, schreibt je Kanal EINEN Snapshot je Tag (Wurzel 2: vorhandene Zeile
wird aktualisiert, UNIQUE als Backstop) und ordnet Beitrags-Kennzahlen unseren
`affiliate_posts` zu. Entzieht die Plattform den Zugriff, wird `revoked_at`
gesetzt und der Partner per Mail informiert — nie still „done" (Wurzel 5).

Die Follower-Zahl in `affiliates.channels[]` wird bei verbundenem Konto aus dem
letzten Snapshot gesetzt und als `verified` markiert; die Selbstauskunft bleibt
als `followers_self_reported` daneben (Abweichung sichtbar, Stufe C).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from urllib.parse import urlsplit

from src.core.config import Settings
from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from . import kanal_krypto
from .fehler import AffiliateError
from .kanal_plattformen import (
    ANBIETER,
    Anbieter,
    BeitragsMetrik,
    Konto,
    PlattformFehler,
    Snapshot,
    TokenSatz,
    anbieter,
)
from .mails_reichweite import ReichweiteMails
from .schemas_reichweite import (
    PROVIDER_JE_PLATTFORM,
    KanalAnbieterStatus,
    KanalAutorisierung,
    KanalUebersicht,
    KanalVerbindung,
)

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.affiliates.kanal")

# Token vor Ablauf erneuern, wenn weniger als so viel Restlaufzeit bleibt.
ERNEUERN_VOR_ABLAUF = timedelta(hours=36)
MAX_VERBINDUNGEN_JE_PARTNER = 12


def _rows(res: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    return list(getattr(res, "data", None) or [])


def _ts(wert: Any) -> datetime | None:  # noqa: ANN401
    if not wert:
        return None
    if isinstance(wert, datetime):
        return wert
    try:
        return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
    except ValueError:
        return None


def _norm_url(url: str | None) -> str | None:
    if not url:
        return None
    t = urlsplit(url.strip())
    host = (t.hostname or "").lower()
    host = host[4:] if host.startswith("www.") else host
    return f"{host}{t.path.rstrip('/')}".lower() or None


# --- Anbieter-Status ------------------------------------------------------------------


def anbieter_status(settings: Settings) -> list[KanalAnbieterStatus]:
    aus: list[KanalAnbieterStatus] = []
    for key, klasse in ANBIETER.items():
        a = klasse(settings)
        fehlend = a.fehlende_variablen()
        if fehlend:
            # Laut, aber nur einmal je Aufruf der Übersicht — die Plattform ist
            # im Dashboard nicht verbindbar, und hier steht warum.
            log.warning("partner_kanal_anbieter_nicht_konfiguriert", provider=key, fehlend=fehlend)
        aus.append(
            KanalAnbieterStatus(provider=key, platforms=list(a.platforms), configured=not fehlend)
        )
    return aus


def _anbieter_bereit(settings: Settings, provider: str) -> Anbieter:
    if provider not in ANBIETER:
        raise AffiliateError("Anbieter unbekannt.", status_code=404)
    a = anbieter(settings, provider)
    fehlend = a.fehlende_variablen()
    if fehlend:
        log.error("partner_kanal_anbieter_nicht_konfiguriert", provider=provider, fehlend=fehlend)
        raise AffiliateError(
            f"{provider}: Anbindung nicht konfiguriert ({', '.join(fehlend)} fehlt).",
            status_code=503,
        )
    try:
        a.redirect_uri()
    except PlattformFehler as exc:
        log.error("partner_kanal_redirect_uri_fehlt", grund=exc.message)
        raise AffiliateError(
            "PARTNER_BASE_URL fehlt — Anbindung nicht möglich.", status_code=503
        ) from exc
    return a


# --- Lesen ----------------------------------------------------------------------------


def _letzte_snapshots(db: Client, connection_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not connection_ids:
        return {}
    rows = fetch_all_rows(
        db.table("affiliate_channel_snapshots")
        .select("connection_id, measured_at, followers, views_28d, engagement_rate, posts_count")
        .in_("connection_id", connection_ids)
        .order("measured_at", desc=True)
    )
    aus: dict[str, dict[str, Any]] = {}
    for r in rows:
        aus.setdefault(r["connection_id"], r)
    return aus


def _objekt(row: dict[str, Any], snap: dict[str, Any] | None) -> KanalVerbindung:
    return KanalVerbindung(
        id=row["id"],
        provider=row["provider"],
        platform=row["platform"],
        external_account_id=row["external_account_id"],
        account_name=row.get("account_name"),
        account_url=row.get("account_url"),
        connected_at=row["connected_at"],
        revoked_at=row.get("revoked_at"),
        revoked_reason=row.get("revoked_reason"),
        last_sync_at=row.get("last_sync_at"),
        last_error=row.get("last_error"),
        followers=snap.get("followers") if snap else None,
        views_28d=snap.get("views_28d") if snap else None,
        engagement_rate=float(snap["engagement_rate"])
        if snap and snap.get("engagement_rate") is not None
        else None,
        posts_count=snap.get("posts_count") if snap else None,
        measured_at=snap.get("measured_at") if snap else None,
    )


def verbindungen(
    db: Client, *, affiliate_id: str, nur_aktive: bool = False
) -> list[dict[str, Any]]:
    q = db.table("affiliate_channel_connections").select("*").eq("affiliate_id", affiliate_id)
    if nur_aktive:
        q = q.is_("revoked_at", "null")
    return fetch_all_rows(q.order("connected_at", desc=True))


def uebersicht(db: Client, settings: Settings, *, affiliate_id: str) -> KanalUebersicht:
    rows = verbindungen(db, affiliate_id=affiliate_id)
    snaps = _letzte_snapshots(db, [r["id"] for r in rows])
    return KanalUebersicht(
        providers=anbieter_status(settings),
        connections=[_objekt(r, snaps.get(r["id"])) for r in rows],
    )


def objekte(db: Client, rows: list[dict[str, Any]]) -> list[KanalVerbindung]:
    snaps = _letzte_snapshots(db, [r["id"] for r in rows])
    return [_objekt(r, snaps.get(r["id"])) for r in rows]


# --- OAuth ----------------------------------------------------------------------------


def autorisieren(settings: Settings, *, affiliate_id: str, provider: str) -> KanalAutorisierung:
    a = _anbieter_bereit(settings, provider)
    state = kanal_krypto.state_erzeugen(settings, affiliate_id=affiliate_id, provider=provider)
    return KanalAutorisierung(provider=provider, url=a.autorisierungs_url(state))


def _token_speichern(settings: Settings, satz: TokenSatz) -> dict[str, Any]:
    return {
        "access_token_enc": kanal_krypto.verschluesseln(settings, satz.access_token),
        "refresh_token_enc": kanal_krypto.verschluesseln(settings, satz.refresh_token)
        if satz.refresh_token
        else None,
        "token_expires_at": satz.expires_at.isoformat() if satz.expires_at else None,
        "scopes": satz.scopes,
    }


def _verbindung_ablegen(
    db: Client,
    settings: Settings,
    *,
    affiliate_id: str,
    provider: str,
    konto: Konto,
    satz: TokenSatz,
) -> dict[str, Any]:
    """Neu anlegen oder — bei erneutem Verbinden desselben Kontos — die alte
    Zeile reaktivieren (Wurzel 2: UNIQUE (affiliate_id, platform, external_account_id))."""
    vorhanden = _rows(
        db.table("affiliate_channel_connections")
        .select("id")
        .eq("affiliate_id", affiliate_id)
        .eq("platform", konto.platform)
        .eq("external_account_id", konto.external_account_id)
        .limit(1)
        .execute()
    )
    werte = {
        **_token_speichern(settings, satz),
        "provider": provider,
        "account_name": konto.name,
        "account_url": konto.url,
        "revoked_at": None,
        "revoked_reason": None,
        "last_error": None,
    }
    if vorhanden:
        res = (
            db.table("affiliate_channel_connections")
            .update({**werte, "connected_at": datetime.now(UTC).isoformat()})
            .eq("id", vorhanden[0]["id"])
            .execute()
        )
    else:
        res = (
            db.table("affiliate_channel_connections")
            .insert(
                {
                    **werte,
                    "affiliate_id": affiliate_id,
                    "platform": konto.platform,
                    "external_account_id": konto.external_account_id,
                    "connected_at": datetime.now(UTC).isoformat(),
                }
            )
            .execute()
        )
    rows = _rows(res)
    if not rows:
        raise AffiliateError("Verbindung konnte nicht gespeichert werden.", status_code=500)
    return rows[0]


def verbinden(
    db: Client, settings: Settings, *, affiliate_id: str, provider: str, code: str, state: str
) -> list[KanalVerbindung]:
    a = _anbieter_bereit(settings, provider)
    kanal_krypto.state_pruefen(settings, state, affiliate_id=affiliate_id, provider=provider)
    aktive = verbindungen(db, affiliate_id=affiliate_id, nur_aktive=True)
    if len(aktive) >= MAX_VERBINDUNGEN_JE_PARTNER:
        raise AffiliateError(
            f"Höchstens {MAX_VERBINDUNGEN_JE_PARTNER} verbundene Konten.", status_code=422
        )
    try:
        satz = a.code_tauschen(code)
        konten = a.konten(satz.access_token)
    except PlattformFehler as exc:
        log.warning(
            "partner_kanal_verbinden_fehlgeschlagen", provider=provider, grund=exc.message[:200]
        )
        raise AffiliateError(f"{provider}: {exc.message}", status_code=502) from exc
    if not konten:
        raise AffiliateError(
            "Hinter diesem Login wurde kein verwendbares Konto gefunden "
            "(Instagram braucht ein Business-/Creator-Konto mit verknüpfter Facebook-Seite).",
            status_code=422,
        )
    angelegt: list[dict[str, Any]] = []
    for konto in konten:
        row = _verbindung_ablegen(
            db, settings, affiliate_id=affiliate_id, provider=provider, konto=konto, satz=satz
        )
        angelegt.append(row)
        # Erster Snapshot sofort — Fehler hier sind kein Grund, die Verbindung
        # zu verwerfen (der Tageslauf versucht es erneut), werden aber benannt.
        try:
            _snapshot_ziehen(db, a, row, satz.access_token, konto)
        except PlattformFehler as exc:
            log.warning(
                "partner_kanal_erster_snapshot_fehlgeschlagen",
                connection_id=row["id"],
                grund=exc.message[:200],
            )
            db.table("affiliate_channel_connections").update({"last_error": exc.message[:500]}).eq(
                "id", row["id"]
            ).execute()
    log.info(
        "partner_kanal_verbunden",
        affiliate_id=affiliate_id,
        provider=provider,
        konten=[(k.platform, k.external_account_id) for k in konten],
    )
    kanaele_abgleichen(db, affiliate_id=affiliate_id)
    return objekte(db, angelegt)


def trennen(db: Client, *, affiliate_id: str, connection_id: str) -> None:
    """Partner trennt selbst: Token weg, Zeile bleibt (Historie), Kanal zurück auf
    Selbstauskunft."""
    rows = _rows(
        db.table("affiliate_channel_connections")
        .select("id, revoked_at")
        .eq("id", connection_id)
        .eq("affiliate_id", affiliate_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise AffiliateError("Verbindung nicht gefunden.", status_code=404)
    if rows[0].get("revoked_at"):
        return
    _widerrufen(db, connection_id, grund="partner")
    kanaele_abgleichen(db, affiliate_id=affiliate_id)
    log.info("partner_kanal_getrennt", affiliate_id=affiliate_id, connection_id=connection_id)


def _widerrufen(db: Client, connection_id: str, *, grund: str) -> None:
    # Token werden ÜBERSCHRIEBEN, nicht nur als widerrufen markiert: eine
    # getrennte Verbindung darf kein Geheimnis mehr tragen.
    db.table("affiliate_channel_connections").update(
        {
            "revoked_at": datetime.now(UTC).isoformat(),
            "revoked_reason": grund[:200],
            "access_token_enc": "",
            "refresh_token_enc": None,
        }
    ).eq("id", connection_id).execute()


# --- Snapshots und Beitrags-Kennzahlen -------------------------------------------------------


def _snapshot_schreiben(db: Client, row: dict[str, Any], snap: Snapshot) -> None:
    tag = snap.measured_at.date().isoformat()
    werte = {
        "measured_at": snap.measured_at.isoformat(),
        "followers": snap.followers,
        "views_28d": snap.views_28d,
        "engagement_rate": snap.engagement_rate,
        "posts_count": snap.posts_count,
        "raw": snap.raw,
    }
    vorhanden = _rows(
        db.table("affiliate_channel_snapshots")
        .select("id")
        .eq("connection_id", row["id"])
        .eq("snapshot_date", tag)
        .limit(1)
        .execute()
    )
    if vorhanden:
        db.table("affiliate_channel_snapshots").update(werte).eq("id", vorhanden[0]["id"]).execute()
    else:
        db.table("affiliate_channel_snapshots").insert(
            {
                **werte,
                "connection_id": row["id"],
                "affiliate_id": row["affiliate_id"],
                "platform": row["platform"],
                "snapshot_date": tag,
            }
        ).execute()


def _metrik_schreiben(db: Client, post_id: str, m: BeitragsMetrik, gemessen: datetime) -> None:
    tag = gemessen.date().isoformat()
    werte = {
        "measured_at": gemessen.isoformat(),
        "views": m.views,
        "likes": m.likes,
        "comments": m.comments,
        "shares": m.shares,
        "saves": m.saves,
        "raw": m.raw,
    }
    vorhanden = _rows(
        db.table("affiliate_post_metrics")
        .select("id")
        .eq("post_id", post_id)
        .eq("metric_date", tag)
        .limit(1)
        .execute()
    )
    if vorhanden:
        db.table("affiliate_post_metrics").update(werte).eq("id", vorhanden[0]["id"]).execute()
    else:
        db.table("affiliate_post_metrics").insert(
            {**werte, "post_id": post_id, "metric_date": tag}
        ).execute()


def _beitraege_zuordnen(
    db: Client, a: Anbieter, row: dict[str, Any], token: str, konto: Konto, snap: Snapshot
) -> int:
    """Unsere Beiträge dieser Plattform mit den Plattform-Kennzahlen verbinden.

    Zuordnung: bekannte `external_post_id` → direkt; sonst über die Beitrags-URL
    (Video-ID / Shortcode / permalink). Gibt die Zahl geschriebener Metriken zurück.
    """
    posts = fetch_all_rows(
        db.table("affiliate_posts")
        .select("id, url, external_post_id")
        .eq("affiliate_id", row["affiliate_id"])
        .eq("platform", row["platform"])
        .order("created_at")
    )
    if not posts:
        return 0
    aus_snapshot = {b.external_post_id: b for b in snap.beitraege}
    nach_url = {_norm_url(b.url): b for b in snap.beitraege if b.url}
    nach_shortcode = {
        f"shortcode:{b.raw.get('shortcode')}": b for b in snap.beitraege if b.raw.get("shortcode")
    }
    geschrieben = 0
    nachladen: dict[str, str] = {}  # external_id → post_id
    for p in posts:
        ext = p.get("external_post_id")
        if not ext and p.get("url"):
            kandidat = a.beitrags_id_aus_url(p["url"])
            treffer = None
            if kandidat and kandidat.startswith("shortcode:"):
                treffer = nach_shortcode.get(kandidat)
            elif kandidat:
                treffer = aus_snapshot.get(kandidat)
                if treffer is None:
                    nachladen[kandidat] = p["id"]
                    continue
            if treffer is None:
                treffer = nach_url.get(_norm_url(p["url"]))
            if treffer is None:
                continue
            ext = treffer.external_post_id
            db.table("affiliate_posts").update({"external_post_id": ext}).eq(
                "id", p["id"]
            ).execute()
        if not ext:
            continue
        m = aus_snapshot.get(ext)
        if m is None:
            nachladen[ext] = p["id"]
            continue
        _metrik_schreiben(db, p["id"], m, snap.measured_at)
        geschrieben += 1
    if nachladen:
        for m in a.beitrags_metriken(token, konto, list(nachladen)):
            post_id = nachladen.get(m.external_post_id)
            if post_id is None:
                continue
            db.table("affiliate_posts").update({"external_post_id": m.external_post_id}).eq(
                "id", post_id
            ).execute()
            _metrik_schreiben(db, post_id, m, snap.measured_at)
            geschrieben += 1
    return geschrieben


def _snapshot_ziehen(
    db: Client, a: Anbieter, row: dict[str, Any], token: str, konto: Konto
) -> Snapshot:
    snap = a.snapshot(token, konto)
    _snapshot_schreiben(db, row, snap)
    metriken = _beitraege_zuordnen(db, a, row, token, konto, snap)
    db.table("affiliate_channel_connections").update(
        {"last_sync_at": datetime.now(UTC).isoformat(), "last_error": None}
    ).eq("id", row["id"]).execute()
    log.info(
        "partner_kanal_snapshot",
        connection_id=row["id"],
        platform=row["platform"],
        followers=snap.followers,
        views_28d=snap.views_28d,
        beitraege=metriken,
        measured_at=snap.measured_at.isoformat(),
    )
    return snap


def _konto_aus_zeile(row: dict[str, Any]) -> Konto:
    return Konto(
        platform=row["platform"],
        external_account_id=row["external_account_id"],
        name=row.get("account_name"),
        url=row.get("account_url"),
    )


def _token_bereit(
    db: Client, settings: Settings, a: Anbieter, row: dict[str, Any], *, jetzt: datetime
) -> str:
    """Zugangstoken entschlüsseln und vor Ablauf erneuern."""
    access = kanal_krypto.entschluesseln(settings, row["access_token_enc"])
    ablauf = _ts(row.get("token_expires_at"))
    if ablauf is None or ablauf - jetzt > ERNEUERN_VOR_ABLAUF:
        return access
    refresh = (
        kanal_krypto.entschluesseln(settings, row["refresh_token_enc"])
        if row.get("refresh_token_enc")
        else None
    )
    satz = a.token_erneuern(refresh, access)
    db.table("affiliate_channel_connections").update(_token_speichern(settings, satz)).eq(
        "id", row["id"]
    ).execute()
    log.info("partner_kanal_token_erneuert", connection_id=row["id"], provider=a.key)
    return satz.access_token


def _partner(db: Client, affiliate_id: str) -> dict[str, Any] | None:
    rows = _rows(
        db.table("affiliates")
        .select("id, email, full_name, language")
        .eq("id", affiliate_id)
        .limit(1)
        .execute()
    )
    return rows[0] if rows else None


def synchronisieren(
    db: Client,
    settings: Settings,
    *,
    jetzt: datetime | None = None,
    mails: ReichweiteMails | None = None,
    mindestabstand: timedelta | None = None,
) -> dict[str, int]:
    """Lauf über alle aktiven Verbindungen. Ergebnis: Zähler je Ausgang.

    `mindestabstand`: Verbindungen, deren letzter erfolgreicher Abruf jünger
    ist, werden übersprungen — so kann der stündliche Worker-Tick den Lauf
    aufrufen und es bleibt trotzdem EIN Snapshot je Tag; fehlgeschlagene
    Verbindungen (last_error, kein last_sync_at-Update) werden stündlich erneut
    versucht.
    """
    jetzt = jetzt or datetime.now(UTC)
    mails = mails or ReichweiteMails(settings=settings)
    zaehler = {"ok": 0, "widerrufen": 0, "fehler": 0, "uebersprungen": 0}
    rows = fetch_all_rows(
        db.table("affiliate_channel_connections")
        .select("*")
        .is_("revoked_at", "null")
        .order("connected_at")
    )
    for row in rows:
        letzter = _ts(row.get("last_sync_at"))
        if mindestabstand and letzter and jetzt - letzter < mindestabstand:
            zaehler["uebersprungen"] += 1
            continue
        try:
            a = anbieter(settings, row["provider"])
            if a.fehlende_variablen():
                # Konfiguration weg (Coolify-Variable gelöscht?) — laut, nicht
                # als Widerruf verbuchen.
                log.error(
                    "partner_kanal_sync_ohne_konfiguration",
                    provider=row["provider"],
                    fehlend=a.fehlende_variablen(),
                )
                zaehler["fehler"] += 1
                continue
            token = _token_bereit(db, settings, a, row, jetzt=jetzt)
            _snapshot_ziehen(db, a, row, token, _konto_aus_zeile(row))
            zaehler["ok"] += 1
        except PlattformFehler as exc:
            if exc.widerrufen:
                _widerrufen(db, row["id"], grund=f"plattform: {exc.message[:150]}")
                zaehler["widerrufen"] += 1
                log.warning(
                    "partner_kanal_widerrufen",
                    connection_id=row["id"],
                    platform=row["platform"],
                    grund=exc.message[:200],
                )
                partner = _partner(db, row["affiliate_id"])
                if partner:
                    mails.kanal_widerrufen(
                        email=partner["email"],
                        name=partner["full_name"],
                        sprache=partner.get("language") or "en",
                        plattform=row["platform"],
                        konto=row.get("account_name") or row["external_account_id"],
                    )
                kanaele_abgleichen(db, affiliate_id=row["affiliate_id"])
            else:
                zaehler["fehler"] += 1
                log.warning(
                    "partner_kanal_sync_fehler",
                    connection_id=row["id"],
                    platform=row["platform"],
                    grund=exc.message[:200],
                )
                db.table("affiliate_channel_connections").update(
                    {"last_error": exc.message[:500]}
                ).eq("id", row["id"]).execute()
        except AffiliateError as exc:
            # Token unlesbar (Schlüssel gewechselt) o. ä. — Verbindung ist tot.
            zaehler["fehler"] += 1
            log.error("partner_kanal_sync_abgebrochen", connection_id=row["id"], grund=exc.message)
            db.table("affiliate_channel_connections").update({"last_error": exc.message[:500]}).eq(
                "id", row["id"]
            ).execute()
    log.info("partner_kanal_sync", **zaehler, verbindungen=len(rows))
    return zaehler


# --- affiliates.channels[] abgleichen -------------------------------------------------------


def _kanal_passt(eintrag: dict[str, Any], row: dict[str, Any]) -> bool:
    if eintrag.get("connection_id") == row["id"]:
        return True
    if eintrag.get("platform") != row["platform"]:
        return False
    handle = str(eintrag.get("handle") or "").lower().lstrip("@")
    name = str(row.get("account_name") or "").lower().lstrip("@")
    if handle and name and handle == name:
        return True
    return _norm_url(eintrag.get("url")) is not None and _norm_url(eintrag.get("url")) == _norm_url(
        row.get("account_url")
    )


def kanaele_abgleichen(db: Client, *, affiliate_id: str) -> None:
    """`affiliates.channels[]` mit den aktiven Verbindungen abgleichen.

    Verbundener Kanal: followers = letzter Snapshot, verified=true,
    followers_self_reported = die Angabe des Partners. Getrennter Kanal: zurück
    auf die Selbstauskunft. Wird nach Verbinden/Trennen/Widerruf UND nach
    einer Profiländerung aufgerufen — der Partner kann `verified` damit weder
    setzen noch versehentlich löschen (Wurzel 3).
    """
    partner = _rows(
        db.table("affiliates")
        .select("id, channels, channel_url")
        .eq("id", affiliate_id)
        .limit(1)
        .execute()
    )
    if not partner:
        return
    kanaele: list[dict[str, Any]] = [
        dict(k) for k in (partner[0].get("channels") or []) if isinstance(k, dict)
    ]
    aktive = [r for r in verbindungen(db, affiliate_id=affiliate_id) if not r.get("revoked_at")]
    snaps = _letzte_snapshots(db, [r["id"] for r in aktive])

    # 1. Alles zurücksetzen — was gleich keine aktive Verbindung findet, ist Selbstauskunft.
    for k in kanaele:
        if k.get("verified"):
            k["followers"] = k.get("followers_self_reported")
        k["verified"] = False
        k.pop("verified_at", None)
        k.pop("connection_id", None)

    # 2. Aktive Verbindungen eintragen.
    for row in aktive:
        snap = snaps.get(row["id"])
        treffer = next((k for k in kanaele if _kanal_passt(k, row)), None)
        if treffer is None:
            if not row.get("account_url"):
                continue
            treffer = {
                "platform": row["platform"],
                "url": row["account_url"],
                "handle": row.get("account_name"),
                "followers": None,
                "followers_self_reported": None,
            }
            kanaele.append(treffer)
        if "followers_self_reported" not in treffer:
            treffer["followers_self_reported"] = treffer.get("followers")
        treffer["connection_id"] = row["id"]
        treffer["verified"] = True
        if snap:
            treffer["followers"] = snap.get("followers")
            treffer["verified_at"] = snap.get("measured_at")
    updates: dict[str, Any] = {"channels": kanaele[:12]}
    if kanaele and not partner[0].get("channel_url"):
        updates["channel_url"] = kanaele[0].get("url")
    db.table("affiliates").update(updates).eq("id", affiliate_id).execute()


def verifizierte_plattformen() -> dict[str, str]:
    return dict(PROVIDER_JE_PLATTFORM)


__all__ = [
    "anbieter_status",
    "autorisieren",
    "kanaele_abgleichen",
    "objekte",
    "synchronisieren",
    "trennen",
    "uebersicht",
    "verbinden",
    "verbindungen",
    "verifizierte_plattformen",
]
