#!/usr/bin/env bash
# Release-Keystore für eine der drei Apps erzeugen — EINMALIG, danach nie wieder.
#
# WARUM DAS EIN EIGENES SKRIPT IST: Der Keystore ist unersetzlich. Android bindet
# die Identität einer App an ihren Signatur-Schlüssel; ein verlorener Keystore
# bedeutet, dass für dieselbe App-ID NIE mehr ein Update veröffentlicht werden
# kann. Es gibt keinen Wiederherstellungsweg — auch Google hat ihn nicht. Deshalb
# ist die Erzeugung hier festgeschrieben (immer 10.000 Tage, immer RSA 4096, immer
# außerhalb des Repos) statt als Befehlszeile in einer Anleitung, die man jedes
# Mal anders abtippt.
#
# WOHIN: ~/.keystores/<app>-release.keystore, also AUSSERHALB des Arbeitsbaums.
# Das Repo ignoriert `*.keystore` zwar, aber ein gitignorierter Schlüssel im
# Projektordner wird beim ersten `rm -rf` mitgelöscht. Ein Pfad außerhalb ist
# kein Komfort, sondern der Unterschied zwischen „umziehen" und „App verloren".
#
# NACH DEM LAUF: Der Fingerabdruck wird ausgegeben und die Base64-Form für das
# GitHub-Secret in eine Datei geschrieben. Beides ist gleich wichtig: der
# Fingerabdruck ist der Beweis, welcher Schlüssel in einem APK steckt.
set -euo pipefail

app="${1:-}"
# Drei Apps seit ADR-0022. Eine Allowlist und keine Prüfung auf „Ordner
# existiert": ein Tippfehler soll hier abbrechen, nicht einen Schlüssel unter
# falschem Namen anlegen — der wäre später von einem echten nicht zu
# unterscheiden.
case "$app" in
  mobile-nextdays|mobile-owner) ;;
  *)
    echo "Aufruf: $0 <mobile-nextdays|mobile-owner>" >&2
    exit 2
    ;;
esac

# Die App-ID gehört zum Schlüssel, nicht zum Skript — sie steht in build.gradle.
wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
gradle="$wurzel/$app/android/app/build.gradle"
[[ -f "$gradle" ]] || { echo "FEHLT: $gradle" >&2; exit 1; }
app_id="$(sed -n 's/.*applicationId "\([^"]*\)".*/\1/p' "$gradle" | head -1)"
[[ -n "$app_id" ]] || { echo "applicationId nicht in $gradle gefunden" >&2; exit 1; }

# Der Secret-Praefix gehoert zur APP, nicht zum Skript: build.gradle liest bei
# myBestDays MYBESTDAYS_RELEASE_* (eigene Marke, eigener Schluessel, ADR-0019).
# Vorher nannte der Hinweis unten hart MYNEXTDAYS_ — wer ihm bei einem
# bestdays-Lauf folgte, ueberschrieb die myNextDays-Secrets mit dem falschen
# Keystore und konnte fuer die veroeffentlichte App kein Update mehr signieren.
case "$app" in
  mobile-nextdays) praefix="MYNEXTDAYS" ;;
  mobile-owner)    praefix="MYNEXTDAYSOWNER" ;;
esac

ziel_ordner="$HOME/.keystores"
ziel="$ziel_ordner/$app-release.keystore"
alias_name="$app"

# Fail-closed: einen vorhandenen Keystore NIE überschreiben. Ein zweiter Lauf
# würde den Schlüssel der schon veröffentlichten App vernichten.
if [[ -e "$ziel" ]]; then
  echo "Es gibt schon einen Keystore: $ziel" >&2
  echo "Abbruch — ein Überschreiben würde die App-Identität unwiederbringlich zerstören." >&2
  exit 1
fi

command -v keytool >/dev/null || {
  echo "keytool fehlt (gehört zum JDK). Installieren: brew install --cask temurin@17" >&2
  exit 1
}

mkdir -p "$ziel_ordner"
chmod 700 "$ziel_ordner"

echo "Keystore für $app  (App-ID: $app_id)"
echo "Ziel: $ziel"
echo
# Ein Passwort, zweimal abgefragt — nicht als Argument, damit es nicht in der
# Shell-History landet.
read -r -s -p "Keystore-Passwort (mindestens 12 Zeichen): " pw1; echo
read -r -s -p "Passwort wiederholen: " pw2; echo
[[ "$pw1" == "$pw2" ]] || { echo "Passwörter stimmen nicht überein." >&2; exit 1; }
[[ ${#pw1} -ge 12 ]] || { echo "Zu kurz — mindestens 12 Zeichen." >&2; exit 1; }

# 10.000 Tage (~27 Jahre): Google verlangt eine Gültigkeit über den 22.10.2033
# hinaus; ein kürzerer Schlüssel wird beim Upload abgelehnt.
# Key- und Store-Passwort sind ABSICHTLICH gleich: Gradle liest beide getrennt,
# aber zwei verschiedene Passwörter für denselben Schlüssel erhöhen nur die
# Verwechslungsgefahr, ohne etwas zu schützen.
keytool -genkeypair \
  -keystore "$ziel" \
  -alias "$alias_name" \
  -keyalg RSA -keysize 4096 \
  -validity 10000 \
  -storepass "$pw1" -keypass "$pw1" \
  -dname "CN=$app_id, O=myNextDays, C=DK"

chmod 600 "$ziel"

# Base64 für das GitHub-Secret. In eine DATEI, nicht auf die Konsole: im
# Terminal-Puffer (und in Screenshots) hätte man sonst den kompletten
# Schlüssel stehen.
b64="$ziel_ordner/$app-release.keystore.base64"
base64 -i "$ziel" -o "$b64"
chmod 600 "$b64"

echo
echo "── Fertig ──────────────────────────────────────────────────────────────"
echo "Keystore:  $ziel"
echo "Base64:    $b64   (Inhalt → GitHub-Secret, danach löschen)"
echo
echo "Fingerabdruck (damit später beweisbar ist, welcher Schlüssel im APK steckt):"
# `-rfc` statt Klartext-Parsing: keytool gibt seine Labels in der Sprache der
# JVM aus ("Zertifikatsfingerprints" auf einem deutschen System), ein grep auf
# "SHA1:" findet dort NICHTS. Der PEM-Block ist sprachneutral, openssl rechnet
# die Fingerabdrücke daraus selbst — dasselbe Ergebnis, unabhängig vom Gebietsschema.
pem="$(keytool -exportcert -rfc -keystore "$ziel" -alias "$alias_name" -storepass "$pw1" 2>/dev/null)"
if [[ -n "$pem" ]]; then
  # `${alg^^}` (Grossschreibung) ist Bash 4; macOS liefert Bash 3.2 und bricht
  # dort mit "bad substitution" ab — live passiert am 19.08.2026, NACH dem
  # Erzeugen des Schluessels, sodass der Fingerabdruck fehlte. Deshalb die
  # Bezeichnung direkt mitgeben statt sie zu berechnen.
  for paar in "sha1:SHA1" "sha256:SHA256"; do
    alg="${paar%%:*}"
    label="${paar##*:}"
    fp="$(printf '%s' "$pem" | openssl x509 -noout -fingerprint -"$alg" 2>/dev/null | cut -d= -f2)"
    printf '  %-7s %s\n' "$label:" "$fp"
  done
else
  echo "  (nicht auslesbar — Passwort oder Alias prüfen)" >&2
fi
echo
cat <<HINWEIS
Nächste Schritte:
  1. Keystore sichern (Passwort-Manager oder verschlüsseltes Backup).
     Ohne ihn ist für $app_id NIE wieder ein Update möglich.
  2. Vier GitHub-Secrets im Repo setzen:
       ${praefix}_RELEASE_KEYSTORE_BASE64  = Inhalt von $b64
       ${praefix}_RELEASE_STORE_PASSWORD   = das eben gewählte Passwort
       ${praefix}_RELEASE_KEY_ALIAS        = $alias_name
       ${praefix}_RELEASE_KEY_PASSWORD     = dasselbe Passwort
     Per CLI:  gh secret set ${praefix}_RELEASE_KEYSTORE_BASE64 < "$b64"
  3. Base64-Datei danach löschen:  rm -f "$b64"
HINWEIS
