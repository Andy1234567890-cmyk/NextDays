"""Die drei OAuth-Anbieter der Kanalanbindung (0521): YouTube (Google),
Meta (Instagram + Facebook) und TikTok — nur offizielle APIs, nur lesend.

Jeder Anbieter liefert dieselben drei Dinge:
  * `autorisierungs_url`  — wohin der Partner zum Zustimmen geschickt wird,
  * `code_tauschen` / `token_erneuern` — Token-Handling,
  * `konten` + `snapshot`  — Konten hinter dem Login und deren Kennzahlen,
    dazu die Kennzahlen unserer Beiträge (`beitrags_metriken`).

WURZEL 5b: `measured_at` ist der `Date`-Header der Plattformantwort — nicht
unsere Uhr. Fehlt er (bei Ursprungsservern praktisch nie, RFC 9110 §6.6.1),
gibt es KEINEN Snapshot und einen lauten Logeintrag.

WURZEL 5: Fehler sind typisiert. `PlattformFehler.widerrufen=True` heißt „die
Plattform hat den Zugriff entzogen" (401/403, invalid_grant, Meta-Code 190,
TikTok access_token_invalid) — der Aufrufer setzt `revoked_at` und informiert
den Partner. Alles andere ist ein Störfall, der beim nächsten Lauf erneut
versucht wird; nie still „done".

Was die Plattformen OHNE Analytics-Scope hergeben — ehrlich beschriftet:
  * Instagram: Konto-Views der letzten 28 Tage (insights metric=views).
  * YouTube / TikTok: nur Views je Video. `views_28d` ist dort die Summe über
    die in den letzten 28 Tagen veröffentlichten Videos.
  * Facebook-Seite: Follower, keine Beitrags-Kennzahlen (Page-Insights
    brauchen ein Seiten-Token und eigene Review-Berechtigungen).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx

from src.core.config import Settings
from src.core.logging import get_logger

log = get_logger("nextdays.affiliates.kanal")

TIMEOUT = httpx.Timeout(20.0, connect=10.0)
FENSTER_TAGE = 28
# Wie viele jüngste Beiträge in die Engagement-Rate eingehen.
ENGAGEMENT_BEITRAEGE = 25


class PlattformFehler(Exception):
    def __init__(
        self, message: str, *, status: int | None = None, widerrufen: bool = False
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.widerrufen = widerrufen


@dataclass
class TokenSatz:
    access_token: str
    refresh_token: str | None
    expires_at: datetime | None
    scopes: list[str]
    # Kennung des Kontos, falls der Token-Endpunkt sie mitliefert (TikTok open_id).
    external_account_id: str | None = None


@dataclass
class Konto:
    platform: str
    external_account_id: str
    name: str | None
    url: str | None
    handle: str | None = None


@dataclass
class BeitragsMetrik:
    external_post_id: str
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None
    published_at: datetime | None = None
    url: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class Snapshot:
    measured_at: datetime
    followers: int | None
    views_28d: int | None
    engagement_rate: float | None
    posts_count: int | None
    raw: dict[str, Any]
    # Kennzahlen der jüngsten Beiträge des Kontos (für unsere Beitrags-Zuordnung).
    beitraege: list[BeitragsMetrik]


def _int(v: Any) -> int | None:  # noqa: ANN401
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _date_header(res: httpx.Response) -> datetime:
    roh = res.headers.get("date")
    if not roh:
        raise PlattformFehler("Plattformantwort ohne Date-Header — kein Messzeitpunkt (Wurzel 5b).")
    try:
        return parsedate_to_datetime(roh).astimezone(UTC)
    except (TypeError, ValueError) as exc:
        raise PlattformFehler(f"Date-Header unlesbar: {roh!r}") from exc


def _ts(v: Any) -> datetime | None:  # noqa: ANN401
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(float(v), tz=UTC)
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None


def engagement(beitraege: list[BeitragsMetrik]) -> float | None:
    views = sum(b.views or 0 for b in beitraege)
    if not views:
        return None
    interaktion = sum(
        (b.likes or 0) + (b.comments or 0) + (b.shares or 0) + (b.saves or 0) for b in beitraege
    )
    return round(interaktion / views, 5)


def views_im_fenster(beitraege: list[BeitragsMetrik], *, jetzt: datetime) -> int | None:
    grenze = jetzt - timedelta(days=FENSTER_TAGE)
    im_fenster = [
        b for b in beitraege if b.published_at and b.published_at >= grenze and b.views is not None
    ]
    return sum(b.views or 0 for b in im_fenster) if im_fenster else None


# --- Basis -----------------------------------------------------------------------------


class Anbieter:
    key: str
    platforms: tuple[str, ...]
    scopes: tuple[str, ...]

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    # Konfiguration ------------------------------------------------------------
    def fehlende_variablen(self) -> list[str]:
        raise NotImplementedError

    def konfiguriert(self) -> bool:
        return not self.fehlende_variablen()

    def redirect_uri(self) -> str:
        basis = (self._settings.partner_base_url or "").strip().rstrip("/")
        if not basis:
            raise PlattformFehler(
                "PARTNER_BASE_URL fehlt — Redirect-URI kann nicht gebildet werden."
            )
        return f"{basis}/api/auth/{self.key}/callback"

    # OAuth -------------------------------------------------------------------------
    def autorisierungs_url(self, state: str) -> str:
        raise NotImplementedError

    def code_tauschen(self, code: str) -> TokenSatz:
        raise NotImplementedError

    def token_erneuern(self, refresh_token: str | None, access_token: str) -> TokenSatz:
        raise NotImplementedError

    # Daten --------------------------------------------------------------------------
    def konten(self, access_token: str) -> list[Konto]:
        raise NotImplementedError

    def snapshot(self, access_token: str, konto: Konto) -> Snapshot:
        raise NotImplementedError

    def beitrags_metriken(
        self, access_token: str, konto: Konto, external_ids: list[str]
    ) -> list[BeitragsMetrik]:
        """Kennzahlen zu bekannten Beitrags-IDs (Standard: aus dem Snapshot filtern)."""
        raise NotImplementedError

    @staticmethod
    def beitrags_id_aus_url(url: str) -> str | None:
        raise NotImplementedError

    # HTTP -------------------------------------------------------------------------
    def _request(self, method: str, url: str, **kw: Any) -> httpx.Response:  # noqa: ANN401
        try:
            res = httpx.request(method, url, timeout=TIMEOUT, **kw)
        except httpx.HTTPError as exc:
            raise PlattformFehler(
                f"{self.key}: Verbindung fehlgeschlagen ({exc.__class__.__name__})."
            ) from exc
        return res


# --- YouTube -----------------------------------------------------------------------


class YouTube(Anbieter):
    key = "youtube"
    platforms = ("youtube",)
    scopes = ("https://www.googleapis.com/auth/youtube.readonly",)
    _AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
    _TAUSCH_ENDPUNKT = "https://oauth2.googleapis.com/token"
    _API = "https://www.googleapis.com/youtube/v3"
    _VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")

    def fehlende_variablen(self) -> list[str]:
        f = []
        if not self._settings.google_oauth_client_id:
            f.append("GOOGLE_OAUTH_CLIENT_ID")
        if not self._settings.google_oauth_secret.get_secret_value():
            f.append("GOOGLE_OAUTH_SECRET")
        return f

    def autorisierungs_url(self, state: str) -> str:
        return f"{self._AUTH}?" + urlencode(
            {
                "client_id": self._settings.google_oauth_client_id,
                "redirect_uri": self.redirect_uri(),
                "response_type": "code",
                "scope": " ".join(self.scopes),
                "access_type": "offline",
                "prompt": "consent",
                "include_granted_scopes": "true",
                "state": state,
            }
        )

    def _token_antwort(self, data: dict[str, Any], *, refresh_alt: str | None) -> TokenSatz:
        access = data.get("access_token")
        if not isinstance(access, str) or not access:
            raise PlattformFehler("Google hat kein Zugangstoken geliefert.", status=502)
        exp = _int(data.get("expires_in"))
        return TokenSatz(
            access_token=access,
            refresh_token=data.get("refresh_token") or refresh_alt,
            expires_at=(datetime.now(UTC) + timedelta(seconds=exp)) if exp else None,
            scopes=str(data.get("scope") or "").split(),
        )

    def _token_call(self, form: dict[str, str], *, refresh_alt: str | None) -> TokenSatz:
        res = self._request("POST", self._TAUSCH_ENDPUNKT, data=form)
        if res.status_code >= 400:
            body = res.json() if "json" in res.headers.get("content-type", "") else {}
            fehler = str(body.get("error") or res.status_code)
            raise PlattformFehler(
                f"Google Token: {fehler} — {body.get('error_description') or ''}".strip(),
                status=res.status_code,
                widerrufen=fehler in ("invalid_grant",),
            )
        return self._token_antwort(res.json(), refresh_alt=refresh_alt)

    def code_tauschen(self, code: str) -> TokenSatz:
        return self._token_call(
            {
                "code": code,
                "client_id": self._settings.google_oauth_client_id,
                "client_secret": self._settings.google_oauth_secret.get_secret_value(),
                "redirect_uri": self.redirect_uri(),
                "grant_type": "authorization_code",
            },
            refresh_alt=None,
        )

    def token_erneuern(self, refresh_token: str | None, access_token: str) -> TokenSatz:
        if not refresh_token:
            raise PlattformFehler(
                "Kein Refresh-Token — Konto muss neu verbunden werden.", widerrufen=True
            )
        return self._token_call(
            {
                "refresh_token": refresh_token,
                "client_id": self._settings.google_oauth_client_id,
                "client_secret": self._settings.google_oauth_secret.get_secret_value(),
                "grant_type": "refresh_token",
            },
            refresh_alt=refresh_token,
        )

    def _api(
        self,
        pfad: str,
        token: str,
        **params: Any,  # noqa: ANN401
    ) -> tuple[dict[str, Any], datetime]:
        res = self._request(
            "GET",
            f"{self._API}/{pfad}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        if res.status_code in (401, 403):
            raise PlattformFehler(
                f"YouTube: Zugriff verweigert ({res.status_code}).",
                status=res.status_code,
                widerrufen=True,
            )
        if res.status_code >= 400:
            raise PlattformFehler(
                f"YouTube {pfad}: HTTP {res.status_code}.", status=res.status_code
            )
        return res.json(), _date_header(res)

    def konten(self, access_token: str) -> list[Konto]:
        data, _ = self._api("channels", access_token, part="snippet", mine="true")
        aus = []
        for item in data.get("items") or []:
            sn = item.get("snippet") or {}
            custom = sn.get("customUrl")
            aus.append(
                Konto(
                    platform="youtube",
                    external_account_id=str(item["id"]),
                    name=sn.get("title"),
                    url=f"https://www.youtube.com/{custom}"
                    if custom
                    else f"https://www.youtube.com/channel/{item['id']}",
                    handle=custom.lstrip("@") if isinstance(custom, str) else None,
                )
            )
        return aus

    def _videos(self, token: str, ids: list[str]) -> list[BeitragsMetrik]:
        aus: list[BeitragsMetrik] = []
        for i in range(0, len(ids), 50):
            data, _ = self._api(
                "videos", token, part="statistics,snippet", id=",".join(ids[i : i + 50])
            )
            for v in data.get("items") or []:
                st = v.get("statistics") or {}
                aus.append(
                    BeitragsMetrik(
                        external_post_id=str(v["id"]),
                        views=_int(st.get("viewCount")),
                        likes=_int(st.get("likeCount")),
                        comments=_int(st.get("commentCount")),
                        published_at=_ts((v.get("snippet") or {}).get("publishedAt")),
                        url=f"https://www.youtube.com/watch?v={v['id']}",
                        raw={"statistics": st},
                    )
                )
        return aus

    def snapshot(self, access_token: str, konto: Konto) -> Snapshot:
        data, gemessen = self._api(
            "channels", access_token, part="statistics,contentDetails", id=konto.external_account_id
        )
        items = data.get("items") or []
        if not items:
            raise PlattformFehler("YouTube: Kanal nicht mehr sichtbar.", widerrufen=True)
        st = items[0].get("statistics") or {}
        uploads = ((items[0].get("contentDetails") or {}).get("relatedPlaylists") or {}).get(
            "uploads"
        )
        beitraege: list[BeitragsMetrik] = []
        if uploads:
            pl, _ = self._api(
                "playlistItems",
                access_token,
                part="contentDetails",
                playlistId=uploads,
                maxResults=ENGAGEMENT_BEITRAEGE,
            )
            ids = [
                str((p.get("contentDetails") or {}).get("videoId"))
                for p in pl.get("items") or []
                if (p.get("contentDetails") or {}).get("videoId")
            ]
            beitraege = self._videos(access_token, ids)
        return Snapshot(
            measured_at=gemessen,
            followers=None if st.get("hiddenSubscriberCount") else _int(st.get("subscriberCount")),
            views_28d=views_im_fenster(beitraege, jetzt=gemessen),
            engagement_rate=engagement(beitraege),
            posts_count=_int(st.get("videoCount")),
            raw={"statistics": st},
            beitraege=beitraege,
        )

    def beitrags_metriken(
        self, access_token: str, konto: Konto, external_ids: list[str]
    ) -> list[BeitragsMetrik]:
        return self._videos(access_token, external_ids) if external_ids else []

    @staticmethod
    def beitrags_id_aus_url(url: str) -> str | None:
        teile = urlsplit(url)
        host = (teile.hostname or "").lower()
        if host.endswith("youtu.be"):
            kandidat = teile.path.strip("/").split("/")[0]
        elif "youtube.com" in host:
            pfad = teile.path.strip("/").split("/")
            if pfad and pfad[0] in ("shorts", "live", "embed", "v") and len(pfad) > 1:
                kandidat = pfad[1]
            else:
                m = re.search(r"(?:^|&)v=([^&]+)", teile.query)
                kandidat = m.group(1) if m else ""
        else:
            return None
        return kandidat if YouTube._VIDEO_ID.match(kandidat) else None


# --- Meta (Instagram + Facebook) -----------------------------------------------------------


class Meta(Anbieter):
    key = "meta"
    platforms = ("instagram", "facebook")
    scopes = (
        "instagram_basic",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
    )
    _WIDERRUF_CODES = {190, 102, 10, 200}

    def fehlende_variablen(self) -> list[str]:
        f = []
        if not self._settings.meta_app_id:
            f.append("META_APP_ID")
        if not self._settings.meta_app_secret.get_secret_value():
            f.append("META_APP_SECRET")
        return f

    @property
    def _graph(self) -> str:
        return f"https://graph.facebook.com/{self._settings.meta_graph_version}"

    def autorisierungs_url(self, state: str) -> str:
        return (
            f"https://www.facebook.com/{self._settings.meta_graph_version}/dialog/oauth?"
            + urlencode(
                {
                    "client_id": self._settings.meta_app_id,
                    "redirect_uri": self.redirect_uri(),
                    "response_type": "code",
                    "scope": ",".join(self.scopes),
                    "state": state,
                }
            )
        )

    def _call(self, pfad: str, params: dict[str, Any]) -> tuple[dict[str, Any], datetime]:
        res = self._request("GET", f"{self._graph}/{pfad}", params=params)
        body: dict[str, Any] = {}
        try:
            body = res.json()
        except ValueError:
            pass
        if res.status_code >= 400 or "error" in body:
            err = body.get("error") or {}
            code = _int(err.get("code"))
            raise PlattformFehler(
                f"Meta {pfad}: {err.get('message') or res.status_code}",
                status=res.status_code,
                widerrufen=code in self._WIDERRUF_CODES or res.status_code in (401, 403),
            )
        return body, _date_header(res)

    def _langlebig(self, kurz: str) -> TokenSatz:
        data, _ = self._call(
            "oauth/access_token",
            {
                "grant_type": "fb_exchange_token",
                "client_id": self._settings.meta_app_id,
                "client_secret": self._settings.meta_app_secret.get_secret_value(),
                "fb_exchange_token": kurz,
            },
        )
        access = data.get("access_token")
        if not isinstance(access, str) or not access:
            raise PlattformFehler("Meta hat kein langlebiges Token geliefert.", status=502)
        exp = _int(data.get("expires_in"))
        return TokenSatz(
            access_token=access,
            refresh_token=None,
            expires_at=(datetime.now(UTC) + timedelta(seconds=exp)) if exp else None,
            scopes=list(self.scopes),
        )

    def code_tauschen(self, code: str) -> TokenSatz:
        data, _ = self._call(
            "oauth/access_token",
            {
                "client_id": self._settings.meta_app_id,
                "client_secret": self._settings.meta_app_secret.get_secret_value(),
                "redirect_uri": self.redirect_uri(),
                "code": code,
            },
        )
        kurz = data.get("access_token")
        if not isinstance(kurz, str) or not kurz:
            raise PlattformFehler("Meta hat kein Zugangstoken geliefert.", status=502)
        return self._langlebig(kurz)

    def token_erneuern(self, refresh_token: str | None, access_token: str) -> TokenSatz:
        # Meta kennt kein Refresh-Token: ein gültiges langlebiges Token wird
        # gegen ein frisches getauscht (60 Tage).
        return self._langlebig(access_token)

    def konten(self, access_token: str) -> list[Konto]:
        data, _ = self._call(
            "me/accounts",
            {
                "fields": "id,name,link,instagram_business_account{id,username}",
                "limit": 50,
                "access_token": access_token,
            },
        )
        aus: list[Konto] = []
        for page in data.get("data") or []:
            aus.append(
                Konto(
                    platform="facebook",
                    external_account_id=str(page["id"]),
                    name=page.get("name"),
                    url=page.get("link"),
                )
            )
            ig = page.get("instagram_business_account")
            if ig and ig.get("id"):
                user = ig.get("username")
                aus.append(
                    Konto(
                        platform="instagram",
                        external_account_id=str(ig["id"]),
                        name=user,
                        url=f"https://www.instagram.com/{user}/" if user else None,
                        handle=user,
                    )
                )
        return aus

    def _ig_media(self, token: str, ig_id: str) -> list[BeitragsMetrik]:
        data, _ = self._call(
            f"{ig_id}/media",
            {
                "fields": (
                    "id,permalink,shortcode,like_count,comments_count,timestamp,media_product_type"
                ),
                "limit": ENGAGEMENT_BEITRAEGE,
                "access_token": token,
            },
        )
        aus: list[BeitragsMetrik] = []
        for m in data.get("data") or []:
            metrik = BeitragsMetrik(
                external_post_id=str(m["id"]),
                likes=_int(m.get("like_count")),
                comments=_int(m.get("comments_count")),
                published_at=_ts(m.get("timestamp")),
                url=m.get("permalink"),
                raw={
                    "shortcode": m.get("shortcode"),
                    "media_product_type": m.get("media_product_type"),
                },
            )
            try:
                ins, _ = self._call(
                    f"{m['id']}/insights", {"metric": "views,saved,shares", "access_token": token}
                )
                for eintrag in ins.get("data") or []:
                    wert = _int(((eintrag.get("values") or [{}])[0]).get("value"))
                    if eintrag.get("name") == "views":
                        metrik.views = wert
                    elif eintrag.get("name") == "saved":
                        metrik.saves = wert
                    elif eintrag.get("name") == "shares":
                        metrik.shares = wert
            except PlattformFehler as exc:
                if exc.widerrufen:
                    raise
                # Einzelne Medien (z. B. alte Bilder) haben keine Insights — das
                # ist kein Störfall des Kontos, wird aber benannt.
                log.info(
                    "partner_ig_media_ohne_insights", media_id=m.get("id"), grund=exc.message[:120]
                )
            aus.append(metrik)
        return aus

    def _ig_snapshot(self, token: str, konto: Konto) -> Snapshot:
        data, gemessen = self._call(
            konto.external_account_id,
            {"fields": "followers_count,media_count,username", "access_token": token},
        )
        since = int((gemessen - timedelta(days=FENSTER_TAGE)).timestamp())
        views_28d: int | None = None
        try:
            ins, _ = self._call(
                f"{konto.external_account_id}/insights",
                {
                    "metric": "views",
                    "period": "day",
                    "metric_type": "total_value",
                    "since": since,
                    "until": int(gemessen.timestamp()),
                    "access_token": token,
                },
            )
            for eintrag in ins.get("data") or []:
                if eintrag.get("name") == "views":
                    views_28d = _int((eintrag.get("total_value") or {}).get("value"))
        except PlattformFehler as exc:
            if exc.widerrufen:
                raise
            log.warning(
                "partner_ig_insights_fehlgeschlagen",
                konto=konto.external_account_id,
                grund=exc.message[:160],
            )
        beitraege = self._ig_media(token, konto.external_account_id)
        return Snapshot(
            measured_at=gemessen,
            followers=_int(data.get("followers_count")),
            views_28d=views_28d,
            engagement_rate=engagement(beitraege),
            posts_count=_int(data.get("media_count")),
            raw={"username": data.get("username")},
            beitraege=beitraege,
        )

    def _fb_snapshot(self, token: str, konto: Konto) -> Snapshot:
        data, gemessen = self._call(
            konto.external_account_id,
            {"fields": "followers_count,fan_count,name,link", "access_token": token},
        )
        return Snapshot(
            measured_at=gemessen,
            followers=_int(data.get("followers_count"))
            if data.get("followers_count") is not None
            else _int(data.get("fan_count")),
            views_28d=None,
            engagement_rate=None,
            posts_count=None,
            raw={"fan_count": data.get("fan_count"), "name": data.get("name")},
            beitraege=[],
        )

    def snapshot(self, access_token: str, konto: Konto) -> Snapshot:
        if konto.platform == "instagram":
            return self._ig_snapshot(access_token, konto)
        return self._fb_snapshot(access_token, konto)

    def beitrags_metriken(
        self, access_token: str, konto: Konto, external_ids: list[str]
    ) -> list[BeitragsMetrik]:
        if konto.platform != "instagram" or not external_ids:
            return []
        gesucht = set(external_ids)
        return [
            b
            for b in self._ig_media(access_token, konto.external_account_id)
            if b.external_post_id in gesucht
        ]

    @staticmethod
    def beitrags_id_aus_url(url: str) -> str | None:
        """Instagram-Links tragen den Shortcode (/p/…, /reel/…), nicht die Media-ID —
        der Abgleich läuft über `raw.shortcode` bzw. die permalink."""
        teile = urlsplit(url)
        host = (teile.hostname or "").lower()
        if "instagram.com" not in host and "instagr.am" not in host:
            return None
        pfad = teile.path.strip("/").split("/")
        if len(pfad) >= 2 and pfad[0] in ("p", "reel", "reels", "tv"):
            return f"shortcode:{pfad[1]}"
        return None


# --- TikTok -------------------------------------------------------------------------------


class TikTok(Anbieter):
    key = "tiktok"
    platforms = ("tiktok",)
    scopes = ("user.info.basic", "user.info.profile", "user.info.stats", "video.list")
    _AUTH = "https://www.tiktok.com/v2/auth/authorize/"
    _TAUSCH_ENDPUNKT = "https://open.tiktokapis.com/v2/oauth/token/"
    _API = "https://open.tiktokapis.com/v2"
    _WIDERRUF = {"access_token_invalid", "scope_not_authorized", "invalid_grant"}

    def fehlende_variablen(self) -> list[str]:
        f = []
        if not self._settings.tiktok_client_key:
            f.append("TIKTOK_CLIENT_KEY")
        if not self._settings.tiktok_client_secret.get_secret_value():
            f.append("TIKTOK_CLIENT_SECRET")
        return f

    def autorisierungs_url(self, state: str) -> str:
        return f"{self._AUTH}?" + urlencode(
            {
                "client_key": self._settings.tiktok_client_key,
                "scope": ",".join(self.scopes),
                "response_type": "code",
                "redirect_uri": self.redirect_uri(),
                "state": state,
            }
        )

    def _token_call(self, form: dict[str, str]) -> TokenSatz:
        res = self._request(
            "POST",
            self._TAUSCH_ENDPUNKT,
            data=form,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Cache-Control": "no-cache",
            },
        )
        body: dict[str, Any] = {}
        try:
            body = res.json()
        except ValueError:
            pass
        fehler = body.get("error")
        if res.status_code >= 400 or (fehler and fehler != "ok"):
            raise PlattformFehler(
                f"TikTok Token: {fehler or res.status_code} — "
                f"{body.get('error_description') or ''}".strip(),
                status=res.status_code,
                widerrufen=str(fehler) in self._WIDERRUF,
            )
        access = body.get("access_token")
        if not isinstance(access, str) or not access:
            raise PlattformFehler("TikTok hat kein Zugangstoken geliefert.", status=502)
        exp = _int(body.get("expires_in"))
        return TokenSatz(
            access_token=access,
            refresh_token=body.get("refresh_token"),
            expires_at=(datetime.now(UTC) + timedelta(seconds=exp)) if exp else None,
            scopes=str(body.get("scope") or "").split(","),
            external_account_id=body.get("open_id"),
        )

    def code_tauschen(self, code: str) -> TokenSatz:
        return self._token_call(
            {
                "client_key": self._settings.tiktok_client_key,
                "client_secret": self._settings.tiktok_client_secret.get_secret_value(),
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.redirect_uri(),
            }
        )

    def token_erneuern(self, refresh_token: str | None, access_token: str) -> TokenSatz:
        if not refresh_token:
            raise PlattformFehler(
                "Kein Refresh-Token — Konto muss neu verbunden werden.", widerrufen=True
            )
        return self._token_call(
            {
                "client_key": self._settings.tiktok_client_key,
                "client_secret": self._settings.tiktok_client_secret.get_secret_value(),
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            }
        )

    def _api(
        self,
        method: str,
        pfad: str,
        token: str,
        **kw: Any,  # noqa: ANN401
    ) -> tuple[dict[str, Any], datetime]:  # noqa: ANN401
        res = self._request(
            method, f"{self._API}/{pfad}", headers={"Authorization": f"Bearer {token}"}, **kw
        )
        body: dict[str, Any] = {}
        try:
            body = res.json()
        except ValueError:
            pass
        err = body.get("error") or {}
        code = str(err.get("code") or "ok")
        if res.status_code >= 400 or code != "ok":
            raise PlattformFehler(
                f"TikTok {pfad}: {code} — {err.get('message') or res.status_code}",
                status=res.status_code,
                widerrufen=code in self._WIDERRUF or res.status_code in (401, 403),
            )
        return body.get("data") or {}, _date_header(res)

    def konten(self, access_token: str) -> list[Konto]:
        data, _ = self._api(
            "GET",
            "user/info/",
            access_token,
            params={"fields": "open_id,display_name,username,profile_deep_link"},
        )
        user = data.get("user") or {}
        if not user.get("open_id"):
            return []
        return [
            Konto(
                platform="tiktok",
                external_account_id=str(user["open_id"]),
                name=user.get("display_name") or user.get("username"),
                url=user.get("profile_deep_link")
                or (
                    f"https://www.tiktok.com/@{user['username']}" if user.get("username") else None
                ),
                handle=user.get("username"),
            )
        ]

    def _videos(self, token: str) -> list[BeitragsMetrik]:
        data, _ = self._api(
            "POST",
            "video/list/",
            token,
            params={
                "fields": (
                    "id,title,share_url,view_count,like_count,comment_count,share_count,create_time"
                )
            },
            json={"max_count": 20},
        )
        return [
            BeitragsMetrik(
                external_post_id=str(v["id"]),
                views=_int(v.get("view_count")),
                likes=_int(v.get("like_count")),
                comments=_int(v.get("comment_count")),
                shares=_int(v.get("share_count")),
                published_at=_ts(v.get("create_time")),
                url=v.get("share_url"),
                raw={"title": v.get("title")},
            )
            for v in data.get("videos") or []
            if v.get("id")
        ]

    def snapshot(self, access_token: str, konto: Konto) -> Snapshot:
        data, gemessen = self._api(
            "GET",
            "user/info/",
            access_token,
            params={"fields": "open_id,follower_count,likes_count,video_count,username"},
        )
        user = data.get("user") or {}
        beitraege = self._videos(access_token)
        return Snapshot(
            measured_at=gemessen,
            followers=_int(user.get("follower_count")),
            views_28d=views_im_fenster(beitraege, jetzt=gemessen),
            engagement_rate=engagement(beitraege),
            posts_count=_int(user.get("video_count")),
            raw={"likes_count": user.get("likes_count"), "username": user.get("username")},
            beitraege=beitraege,
        )

    def beitrags_metriken(
        self, access_token: str, konto: Konto, external_ids: list[str]
    ) -> list[BeitragsMetrik]:
        if not external_ids:
            return []
        data, _ = self._api(
            "POST",
            "video/query/",
            access_token,
            params={
                "fields": (
                    "id,title,share_url,view_count,like_count,comment_count,share_count,create_time"
                )
            },
            json={"filters": {"video_ids": external_ids[:20]}},
        )
        return [
            BeitragsMetrik(
                external_post_id=str(v["id"]),
                views=_int(v.get("view_count")),
                likes=_int(v.get("like_count")),
                comments=_int(v.get("comment_count")),
                shares=_int(v.get("share_count")),
                published_at=_ts(v.get("create_time")),
                url=v.get("share_url"),
            )
            for v in data.get("videos") or []
            if v.get("id")
        ]

    @staticmethod
    def beitrags_id_aus_url(url: str) -> str | None:
        teile = urlsplit(url)
        if "tiktok.com" not in (teile.hostname or "").lower():
            return None
        m = re.search(r"/video/(\d{6,})", teile.path)
        return m.group(1) if m else None


ANBIETER: dict[str, type[Anbieter]] = {YouTube.key: YouTube, Meta.key: Meta, TikTok.key: TikTok}


def anbieter(settings: Settings, key: str) -> Anbieter:
    klasse = ANBIETER.get(key)
    if klasse is None:
        raise PlattformFehler(f"Unbekannter Anbieter {key!r}.", status=404)
    return klasse(settings)
