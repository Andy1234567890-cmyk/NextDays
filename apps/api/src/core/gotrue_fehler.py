"""Unterscheidung: „Token wirklich ungültig" vs. „GoTrue gerade nicht erreichbar".

Wurzel 5 (Kontroll-Signal nicht verschlucken). `supabase_auth.errors.AuthError`
ist die Basisklasse ALLER GoTrue-Fehler — auch der rein technischen. Wer sie
pauschal fängt und 401 „Sitzung abgelaufen" antwortet, verwandelt einen
Netzwerk-Timeout, einen Kong-Hänger oder einen 500 aus GoTrue in eine
Zwangsabmeldung des Nutzers: das BFF sieht 401, wertet das definitionsgemäß als
„nicht mehr angemeldet" und leitet auf /login um. Der Nutzer fliegt raus,
obwohl sein Refresh-Token einwandfrei ist.

Genau dieser Pfad war eine der Ursachen der willkürlichen Abmeldungen. 401
darf nur, wessen Anmeldedaten GoTrue tatsächlich abgelehnt hat.
"""
import httpx
from supabase_auth.errors import AuthApiError, AuthRetryableError, AuthUnknownError
from supabase_auth.errors import AuthError as GoTrueAuthError

# GoTrue-Antwortcodes, die eine echte Ablehnung der Anmeldedaten bedeuten.
# 400 = „Invalid Refresh Token: Already Used"/„invalid grant", 401/403 =
# abgelehnt, 422 = unbrauchbare Eingabe. Alles andere (429, 5xx) ist ein
# Betriebszustand des Auth-Servers, kein Urteil über das Token.
_ABGELEHNT = frozenset({400, 401, 403, 422})

# Transportfehler, die das SDK NICHT in eine AuthError übersetzt: supabase-py
# fängt in `SyncGoTrueBaseAPI._request` nur `HTTPStatusError`/`RuntimeError`.
# Ein Verbindungsabbruch oder Timeout gegen Kong/GoTrue fliegt also ROH aus dem
# `auth.*`-Aufruf heraus, an jedem `except GoTrueAuthError` vorbei — und landet
# ohne Behandlung als 500 beim Nutzer. Die Slices fangen deshalb beides.
TRANSPORT_FEHLER = (httpx.TransportError, httpx.HTTPError)


def ist_abgelehnt(exc: GoTrueAuthError) -> bool:
    """True, wenn GoTrue die Anmeldedaten inhaltlich abgelehnt hat (→ 401).

    False bei allem Technischen (→ 503): Verbindungsfehler, Timeouts, 5xx und
    429 aus GoTrue. `AuthRetryableError` ist per Definition transient; es erbt
    ebenfalls von AuthError und wäre sonst nicht zu unterscheiden.
    """
    if isinstance(exc, AuthRetryableError):
        return False
    # AuthUnknownError entsteht, wenn `handle_exception` die Fehlerantwort selbst
    # nicht auswerten konnte (kaputtes/leeres JSON — typisch für eine Fehlerseite
    # eines Proxys davor). Das ist kein Urteil über das Token.
    if isinstance(exc, AuthUnknownError):
        return False
    if isinstance(exc, AuthApiError):
        return exc.status in _ABGELEHNT
    # Fehler ohne Statuscode (z. B. AuthInvalidJwtError beim lokalen Parsen des
    # übergebenen Tokens): das Token ist syntaktisch unbrauchbar → Ablehnung.
    return True
