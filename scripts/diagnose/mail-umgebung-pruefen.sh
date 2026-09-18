#!/usr/bin/env bash
# ============================================================================
# mail-umgebung-pruefen.sh — findet Mail-Variablen, die nur EINEM Prozess fehlen
# ----------------------------------------------------------------------------
# Hintergrund (25.08.2026): Gemeldet wurde „diese Mails haben keinen Link und
# keinerlei Hinweise". Der `ziel_pfad` stand in JEDER Zeile der Datenbank; der
# Button entstand trotzdem nicht, weil `APP_BASE_URL` in dem Prozess fehlte,
# der die Mail verschickte. Dieselbe Mail trug in der Fußzeile den Satz
# „Anbieterangaben sind auf diesem Server nicht hinterlegt (COMPANY_LEGAL_NAME
# fehlt)" — also fehlten dort auch die Pflichtangaben nach § 5 TMG bzw.
# markedsføringsloven.
#
# Die Wurzel war KEIN Codefehler, sondern ein Konfigurations-Drift: `api` und
# `worker` fahren DENSELBEN Code aus demselben Repo, sind in Coolify aber zwei
# Anwendungen mit je eigener, handgepflegter Variablenliste. Die API trug die
# Werte, der Worker nie. Nichts im System vergleicht die beiden Listen — und
# der Mangel fiel deshalb erst auf, als jemand eine Mail mit dem Auge ansah.
#
# Der Worker verschickt keine Nebensache: Bewertungsanfragen
# (`reviews.automation`) und die geplanten Gast-Automails
# (`InboxService.dispatch_due_automations`) gehen alle von dort raus. Fehlen
# ihm die COMPANY_*-Werte, geht jede dieser Gast-Mails ohne Anbieterangabe
# hinaus.
#
# Das Skript vergleicht die Umgebung aller mailversendenden Container gegen
# eine Pflichtliste (read-only, kein Eingriff):
#   1. je Container: welche Pflichtvariable fehlt,
#   2. der Drift zwischen ihnen: was hat einer, der andere nicht.
#
# Aufruf:
#   bash scripts/diagnose/mail-umgebung-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   MAIL_SSH=root@65.21.144.136   # leer lassen, wenn docker lokal läuft
#   MAIL_IMAGES="nextdays-api nextdays-worker"
#
# Exit 0 = jeder Prozess vollständig, Exit 1 = mindestens eine fehlt.
# ============================================================================
set -uo pipefail

MAIL_SSH="${MAIL_SSH-root@65.21.144.136}"
# Ausgewählt wird über das IMAGE, nicht über den Containernamen: Coolify hängt
# an jeden Namen eine eigene Kennung, und `api-…` trifft sonst auch die
# Partner-API (`nextdays-public-api`) — die verschickt keine Mails und würde
# als Dauer-Fehlschlag die echten Befunde zudecken.
MAIL_IMAGES="${MAIL_IMAGES-nextdays-api nextdays-worker}"

# Was JEDER Prozess braucht, der eine Mail baut. Die Liste ist bewusst kurz:
# nur, was ohne Ersatzwert auskommen MUSS, weil `mail_layout` dafür keinen
# Fallback erfindet (Wurzel 4) und die Mail den Mangel sonst dem Empfänger
# zeigt.
PFLICHT=(
  APP_BASE_URL          # ohne sie: kein Link in irgendeiner Meldungsmail
  COMPANY_LEGAL_NAME    # ohne sie: sichtbarer Mangelhinweis in der Fußzeile
  COMPANY_LEGAL_FORM
  COMPANY_STREET
  COMPANY_CITY
  COMPANY_COUNTRY
  COMPANY_REGISTRATION_NUMBER
  COMPANY_CONTACT_EMAIL
  # Nicht Mail, aber derselbe Drift und dieselbe Klasse Schaden: der Worker
  # fährt drei geldbewegende Läufe (`jobs/geld_laeufe.py`) — Einzug fälliger
  # Restzahlungen, Auszahlungen, Provisionsabrechnung am Monatsersten. Ohne
  # Schlüssel tut keiner davon etwas, und der Provisionslauf kommt erst in
  # einem Monat wieder vorbei.
  STRIPE_SECRET_KEY
  # Ohne ihn nimmt der Server KEINE Chat-Nachricht an (503) und zeigt keine
  # an. Fail-closed gebaut, damit nichts still im Klartext landet — aber genau
  # deshalb muss sein Fehlen HIER auffallen und nicht erst am toten Chat.
  OWNER_CHAT_SCHLUESSEL
)

# ENTWEDER-ODER: Gruppen, von denen MINDESTENS EINE Variable dasein muss. Je
# Zeile eine Gruppe, Alternativen durch Leerzeichen getrennt.
#
# Warum das eine eigene Liste ist und nicht zwei Einträge in PFLICHT: ein Gate,
# das etwas fordert, das der Code gar nicht braucht, meldet einen Fehler, den
# es nicht gibt — und ein Prüfskript, dessen Fehlschlag man wegzudrücken lernt,
# deckt beim nächsten Mal den echten Mangel mit zu. Genau das stand hier vom
# 15.09.2026 bis 18.09.2026: beide FCM-Variablen standen in PFLICHT, obwohl
# `push.py::_firebase_app` sie als ALTERNATIVEN behandelt. Live liefen api und
# worker mit gesetztem `FCM_SERVICE_ACCOUNT_JSON` und ohne `FCM_PROJEKT_ID` —
# also vollständig konfiguriert, gemeldet wurden trotzdem zwei Fehlbestände.
EINES_VON=(
  # Push (0414) — dieselbe Klasse Drift wie oben. Die zwei Anlässe, die den
  # Betrieb sofort erreichen müssen (neue Nachricht, neue Buchung), werden im
  # WORKER ausgelöst (Feed-Sync). Fehlt dort der Firebase-Zugang, wirft
  # `push.py` einen PushFehler, den der Dispatcher spezifisch fängt — Mail und
  # SMS laufen weiter, und niemand sieht, dass der Push-Kanal tot ist.
  #
  # Zwei Wege, `push.py::_firebase_app` prüft sie in dieser Reihenfolge:
  #   1. FCM_SERVICE_ACCOUNT_JSON — Dienstkonto-Schlüssel, hat Vorrang.
  #   2. FCM_PROJEKT_ID + Application Default Credentials aus der Umgebung.
  # Einer von beiden genügt; beide zu fordern wäre eine erfundene Anforderung.
  "FCM_SERVICE_ACCOUNT_JSON FCM_PROJEKT_ID"
)

# Ein Befehl, zwei Wege: lokal direkt, sonst über SSH. Das Kommando wird als
# EIN String an die Remote-Shell gegeben — Anführungszeichen darin müssen
# deshalb schon hier stehen, nicht erst dort.
docker_() {
  if [[ -n "$MAIL_SSH" ]]; then
    ssh -o BatchMode=yes "$MAIL_SSH" "docker $*"
  else
    docker "$@"
  fi
}

namen_zu_image() {
  # Trenner `@` statt `\t`: der Befehl geht als String durch die Remote-Shell,
  # die ein `\t` darin zu einem literalen „t" macht — die Spalten liefen dann
  # ineinander und das Skript fand nie einen Container.
  docker_ "ps --format {{.Image}}@{{.Names}}" \
    | awk -F'@' -v i="$1" '$1 == i || $1 ~ "^"i":" {print $2}'
}

echo "== Mail-Umgebung je Prozess =="
echo

container=()
for image in $MAIL_IMAGES; do
  while read -r name; do
    [[ -n "$name" ]] && container+=("$name")
  done < <(namen_zu_image "$image")
done

if [[ ${#container[@]} -eq 0 ]]; then
  echo "Kein Container gefunden (Images: $MAIL_IMAGES)."
  exit 1
fi

fehlend_gesamt=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for name in "${container[@]}"; do
  # `printenv` im Container: die Werte, mit denen der Prozess WIRKLICH läuft.
  # Coolifys Oberfläche zeigt den SOLL-Stand — sie reicht Änderungen aber erst
  # beim nächsten Deploy in den laufenden Container, und genau diese Lücke war
  # der Fehler. Ein Blick in die Oberfläche hätte ihn nicht gefunden.
  docker_ exec "$name" printenv 2>/dev/null | cut -d= -f1 | sort > "$tmp/$name" || true
  fehlt=()
  for v in "${PFLICHT[@]}"; do
    grep -qx "$v" "$tmp/$name" || fehlt+=("$v")
  done
  # Entweder-oder: erst wenn KEINE Alternative der Gruppe dasteht, ist es ein
  # Mangel — gemeldet wird dann die ganze Gruppe, damit ablesbar ist, welche
  # Wahl man hat.
  for gruppe in "${EINES_VON[@]}"; do
    getroffen=0
    for v in $gruppe; do
      grep -qx "$v" "$tmp/$name" && getroffen=1 && break
    done
    [[ $getroffen -eq 1 ]] || fehlt+=("${gruppe// / ODER }")
  done
  if [[ ${#fehlt[@]} -eq 0 ]]; then
    echo "✓ $name — vollständig"
  else
    echo "✗ $name — fehlt: ${fehlt[*]}"
    fehlend_gesamt=$((fehlend_gesamt + ${#fehlt[@]}))
  fi
done

echo
echo "== Drift zwischen den Prozessen =="
echo "(Variablen, die ein Prozess hat und ein anderer nicht — nicht jede davon"
echo " gehört überall hin, aber jede ist eine bewusste Entscheidung wert.)"
echo
# Jedes Paar genau EINMAL (i < j), sonst steht jeder Vergleich doppelt da und
# die eigentlichen Abweichungen gehen in der Wiederholung unter.
for ((i = 0; i < ${#container[@]}; i++)); do
  for ((j = i + 1; j < ${#container[@]}; j++)); do
    a="${container[i]}"
    b="${container[j]}"
    nur_a=$(comm -23 "$tmp/$a" "$tmp/$b" | tr '\n' ' ')
    nur_b=$(comm -13 "$tmp/$a" "$tmp/$b" | tr '\n' ' ')
    echo "  $a  vs.  $b"
    echo "    nur links:  ${nur_a:-—}"
    echo "    nur rechts: ${nur_b:-—}"
  done
done

echo
if [[ $fehlend_gesamt -gt 0 ]]; then
  echo "$fehlend_gesamt fehlende Pflichtvariable(n)."
  echo "Setzen in Coolify je Anwendung, danach REDEPLOY — ein 'docker restart'"
  echo "reicht nicht, Coolify reicht Env-Änderungen nur beim Deploy durch."
  exit 1
fi
echo "Alle mailversendenden Prozesse vollständig konfiguriert."
