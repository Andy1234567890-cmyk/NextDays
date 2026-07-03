# Slice: channel_manager

Channel-Manager auf Basis **Channex** (white-label, kein iFrame/Branding),
`/api/v1/channel-manager`: Property-Mapping PMS↔Channex
(`property_mapping.py`, ein Objekt → synthetischer Room-Type), ARI-Push
(Verfügbarkeit/Preise/Restriktionen, `ari_push.py`), Buchungs-Sync von den
OTAs zurück ins PMS (`bookings_sync.py`) und Content-Sync
(`content_builder.py`/`content_sync.py`).

Channel-Verwaltung im 4-Schritt-Flow (`POST /channels/prepare` →
`POST /channels` → Mapping → live; `channels.py`), Airbnb-OAuth
(`airbnb_oauth.py`, `oauth_channels.py`), Webhook-Registrierung + -Empfang
(`/webhooks`, `/webhook`) und eine interne Reconcile-Route. Für die Sandbox
gibt es eine Mock-OTA (`sandbox_ota.py`, OpenChannel).
Siehe ADR-0001 und ADR-0012.
