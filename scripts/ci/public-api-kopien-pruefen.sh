#!/usr/bin/env bash
# Hält die SCHWESTERDATEIEN von `apps/public-api` und `apps/api` byte-identisch.
#
# WARUM ES DIESE KOPIEN GIBT: `apps/public-api` ist ein eigenständiger Service
# mit eigenem `pyproject.toml` und eigenem Image (siehe dessen pyproject-Kopf).
# Es importiert bewusst NICHTS aus `apps/api` — sonst wären beide wieder ein
# Deployment, und ein Lastausbruch eines API-Kunden würde die Oberfläche des
# Betriebs mitnehmen. Der gemeinsame Kern liegt deshalb als Kopie mit
# SCHWESTERDATEI-Kopf vor, dasselbe Muster wie bei den zwei Mobile-Apps
# (ADR-0019 Stufe 1) und bei den Marketing-Kopien.
#
# WAS DRIFT ANRICHTEN WÜRDE — je Datei ein anderer, konkreter Schaden:
#
#   ausgehende_url.py       Die SSRF-Prüfung für nutzergelieferte URLs. Sie ist
#                           bereits einmal in zwei Fassungen gelaufen (iCal und
#                           MCP) und wurde deshalb zusammengelegt. Wird die
#                           Lücke in einer Fassung geschlossen und in der
#                           anderen nicht, holt der eine Dienst weiterhin die
#                           Cloud-Metadaten-Adresse ab.
#   einheiten_verfuegbar.py Rechnet die freie STÜCKZAHL je Tag. Driftet sie,
#                           meldet der eine Dienst 1 frei und der andere 0 —
#                           und eine der beiden Zahlen geht als Verfügbarkeit
#                           an Booking.com. Genau daran ging live eine
#                           Stop-Sell-Sperre verloren.
#   einheiten.py            Belegung je Einheit. Dieselbe Klasse Fehler.
#   scopes.py               Der Scope-Katalog. Driftet er, bietet das Dashboard
#                           einen Scope an, mit dem kein Endpunkt etwas anfangen
#                           kann — der Kunde bekommt dauerhaft 403 und sucht den
#                           Fehler bei sich.
#   supabase.py             DB-Zugriff samt gehärtetem Transport.
#   ratelimit.py            Zähl-Logik der Limits (gemeinsamer Redis).
#   logging.py              Feldnamen der Logzeilen; Drift macht die
#                           Fehlersuche über beide Dienste hinweg unmöglich.
#   dates.py                Nächte-Zählung. Eine Fassung rechnet vier Nächte,
#                           die andere fünf — und Vorschau und Buchung weichen
#                           um eine Nacht ab.
#   pricing/resolver.py     Die EINE Preisberechnung (Saisons, Aktionen,
#                           Aufenthaltsregeln, Kanal-Markup, Zusatzleistungen,
#                           Abgaben). Driftet sie, nennt die Preisvorschau der
#                           öffentlichen API einen anderen Betrag als die
#                           Buchung im Dashboard: zwei Preise für denselben
#                           Aufenthalt, und damit ein Streit über Geld.
#   pricing/schemas.py      Die Formen dieser Berechnung; Drift bricht den
#                           Resolver in einem der beiden Bäume.
#   addons/pricing.py       Preis einer Zusatzleistung. Drift heißt: dieselbe
#                           Leistung kostet über die API etwas anderes als im
#                           Dashboard.
#
# ARBEITSWEISE BEI EINER ÄNDERUNG: in EINER Datei ändern, dann in die
# Schwester kopieren (der Kopf bleibt erhalten, er ist bei diesen Dateien Teil
# des Inhalts und in beiden Bäumen gleich). Dieses Skript prüft die volle
# Byte-Gleichheit — anders als bei den Marketing-Kopien, wo der Kopf nur in der
# Kopie steht und deshalb übersprungen werden muss.
#
# Aufruf: bash scripts/ci/public-api-kopien-pruefen.sh
set -euo pipefail

paare=(
  "apps/api/src/core/ausgehende_url.py:apps/public-api/src/core/ausgehende_url.py"
  "apps/api/src/core/einheiten.py:apps/public-api/src/core/einheiten.py"
  "apps/api/src/core/einheiten_verfuegbar.py:apps/public-api/src/core/einheiten_verfuegbar.py"
  "apps/api/src/core/logging.py:apps/public-api/src/core/logging.py"
  "apps/api/src/core/ratelimit.py:apps/public-api/src/core/ratelimit.py"
  "apps/api/src/core/supabase.py:apps/public-api/src/core/supabase.py"
  "apps/api/src/features/api_clients/scopes.py:apps/public-api/src/core/scopes.py"
  "apps/api/src/core/dates.py:apps/public-api/src/core/dates.py"
  "apps/api/src/features/addons/pricing.py:apps/public-api/src/features/addons/pricing.py"
  "apps/api/src/features/pricing/resolver.py:apps/public-api/src/features/pricing/resolver.py"
  "apps/api/src/features/pricing/schemas.py:apps/public-api/src/features/pricing/schemas.py"
)

fehler=0
for paar in "${paare[@]}"; do
  a="${paar%%:*}"
  b="${paar##*:}"

  if [[ ! -f "$a" || ! -f "$b" ]]; then
    echo "FEHLT: $a oder $b" >&2
    fehler=1
    continue
  fi

  # Der Kopf MUSS in beiden stehen. Ohne ihn ändert die nächste Person eine
  # der Dateien, ohne zu wissen, dass es eine Schwester gibt — und erfährt es
  # erst hier, im CI, nach dem Push.
  for datei in "$a" "$b"; do
    if ! grep -q "SCHWESTERDATEI" "$datei"; then
      echo "KEIN SCHWESTERDATEI-Kopf in $datei" >&2
      fehler=1
    fi
  done

  if ! diff -u "$a" "$b"; then
    echo "DRIFT: $b weicht von $a ab (in einer ändern, dann kopieren)" >&2
    fehler=1
  else
    echo "✓ $(basename "$b") identisch"
  fi
done

exit "$fehler"
