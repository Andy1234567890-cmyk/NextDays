#!/usr/bin/env bash
# Fingerabdruck eines Release-Keystores ausgeben.
#
# WOZU: Der Fingerabdruck ist der Beweis, WELCHER Schluessel in einem APK
# steckt. Man braucht ihn, wenn Google Play einen Upload wegen falscher
# Signatur ablehnt, beim Einrichten von Play App Signing, und um zu pruefen,
# dass das GitHub-Secret denselben Schluessel traegt wie das lokale Backup.
#
# `keystore-erzeugen.sh` gibt ihn nach dem Erzeugen aus. Dieses Skript ist der
# Weg, ihn SPAETER noch einmal zu bekommen, ohne einen zweiten Schluessel zu
# erzeugen (was die App-Identitaet zerstoeren wuerde).
#
# Aufruf:
#   bash scripts/mobile/keystore-fingerabdruck.sh mobile-bestdays
#   bash scripts/mobile/keystore-fingerabdruck.sh mobile-nextdays
set -euo pipefail

app="${1:-}"
if [[ "$app" != "mobile-nextdays" && "$app" != "mobile-bestdays" ]]; then
  echo "Aufruf: $0 <mobile-nextdays|mobile-bestdays>" >&2
  exit 2
fi

ks="$HOME/.keystores/$app-release.keystore"
[[ -f "$ks" ]] || { echo "Kein Keystore: $ks" >&2; exit 1; }

command -v keytool >/dev/null || { echo "keytool fehlt (JDK)." >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl fehlt." >&2; exit 1; }

read -r -s -p "Keystore-Passwort: " pw; echo
echo

# `-rfc` statt Klartext-Parsing: keytool gibt seine Labels in der Sprache der
# JVM aus, ein grep auf "SHA1:" findet auf einem deutschen System NICHTS. Der
# PEM-Block ist sprachneutral.
pem="$(keytool -exportcert -rfc -keystore "$ks" -alias "$app" -storepass "$pw" 2>/dev/null || true)"
if [[ -z "$pem" ]]; then
  echo "Zertifikat nicht auslesbar — Passwort oder Alias falsch." >&2
  exit 1
fi

echo "Keystore: $ks"
echo "Alias:    $app"
# Bezeichnung mitgeben statt berechnen: `${alg^^}` ist Bash 4, macOS hat 3.2.
for paar in "sha1:SHA1" "sha256:SHA256"; do
  alg="${paar%%:*}"
  label="${paar##*:}"
  fp="$(printf '%s' "$pem" | openssl x509 -noout -fingerprint -"$alg" 2>/dev/null | cut -d= -f2)"
  printf '  %-8s %s\n' "$label:" "$fp"
done

echo
gueltig="$(printf '%s' "$pem" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
echo "Gueltig bis: $gueltig"
echo "(Google verlangt eine Gueltigkeit ueber den 22.10.2033 hinaus.)"
