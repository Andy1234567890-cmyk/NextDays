# API-Übersicht

Base-URL (lokal): `http://localhost:8000`
Alle Slice-Endpoints liegen unter dem Prefix **`/api/v1`**.

Interaktive Doku (Swagger UI): **http://localhost:8000/docs**

## Meta-Endpoints

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/` | Service-Info |
| `GET` | `/health` | App-Health |

## Slices

Jeder der 12 Vertical Slices stellt mindestens einen Health-Endpoint bereit:

| Slice | Health-Endpoint |
|---|---|
| auth | `GET /api/v1/auth/health` |
| properties | `GET /api/v1/properties/health` |
| rates | `GET /api/v1/rates/health` |
| calendar | `GET /api/v1/calendar/health` |
| reservations | `GET /api/v1/reservations/health` |
| guests | `GET /api/v1/guests/health` |
| inbox | `GET /api/v1/inbox/health` |
| payments | `GET /api/v1/payments/health` |
| channel_manager | `GET /api/v1/channel-manager/health` |
| booking_engine | `GET /api/v1/booking-engine/health` |
| ocr | `GET /api/v1/ocr/health` |
| public_portal | `GET /api/v1/public-portal/health` |

Antwort-Schema:

```json
{ "slice": "auth", "status": "ok" }
```

---

## auth (voll implementiert)

Referenz-Slice. Tenant-Anlage + Supabase-Auth, `tenant_id`/`role` im JWT `app_metadata`.

### `POST /api/v1/auth/register` → `201`

Legt **atomar** Tenant + Owner-User an. Bei Fehler in einem Schritt werden
bereits angelegte Artefakte zurückgerollt (kein verwaister Tenant).

```json
// Request
{
  "email": "owner@example.de",
  "password": "mindestens8zeichen",
  "full_name": "Vorname Nachname",
  "tenant_name": "Meine Vermietung",
  "country": "DE",
  "currency": "EUR"
}
```

```json
// Response 201
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

| Status | Bedeutung |
|---|---|
| `201` | erstellt + direkt eingeloggt |
| `409` | E-Mail bereits vergeben |
| `500` | Tenant/User-Anlage fehlgeschlagen (mit Rollback) |

### `POST /api/v1/auth/login`

```json
// Request
{ "email": "owner@example.de", "password": "mindestens8zeichen" }
```

Antwort: `SessionResponse` (wie bei register). `401` bei falschen Daten.

### `GET /api/v1/auth/me`

Erfordert `Authorization: Bearer <access_token>`.

```json
// Response 200
{
  "user_id": "uuid",
  "email": "owner@example.de",
  "tenant_id": "uuid",
  "role": "owner"
}
```

`401` ohne/mit ungültigem Token.

### Rollen-Guard

`require_role(...)` (in `features/auth/dependencies.py`) ist eine
Dependency-Factory, die Endpoints auf bestimmte Rollen beschränkt
(`owner`, `staff`, `cleaner`) und sonst `403` liefert.

```python
from src.features.auth.dependencies import require_role
from src.features.auth.schemas import UserRole

@router.get("/nur-owner", dependencies=[Depends(require_role(UserRole.owner))])
def nur_owner(): ...
```

---

## Authentifizierung allgemein

- Supabase-JWT (HS256), verifiziert in `core/security.py` gegen `SUPABASE_JWT_SECRET`.
- `AuthContext` (`user_id`, `tenant_id`, `role`) wird aus den JWT-Claims gelesen.
- Geschützte Endpoints nutzen die `CurrentUser`-Dependency.

> Die übrigen Slices (properties, calendar, …) werden nach dem auth-Muster
> ausgebaut. Diese Übersicht wird dabei fortgeschrieben.
