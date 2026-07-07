#!/bin/bash
# ---------------------------------------------------------------------------
# myNextDays — SOGo-Webmailer-Theme (Farb-Patch)
# ---------------------------------------------------------------------------
# SOGo (AngularJS Material) liefert die Themefarben aus einer VORKOMPILIERTEN
# statischen Datei css/theme-default.css. Ein $mdThemingProvider-Theme (JS)
# greift NICHT, solange generateThemesOnDemand(false) gilt -> die statische
# CSS gewinnt. Deshalb patchen wir die konkreten Grün-/Teal-RGB-Werte direkt
# auf die Markenfarben und mounten die gepatchte Datei read-only.
#
# SOGo-Standardfarben (verifiziert per grep an theme-default.css):
#   Primär (Teal, Kopfleiste/aktiv): 77,128,128 + Töne
#   Accent (Grün, FAB/Buttons):      136,199,129 + Töne
#
# Ziel = myNextDays (globals.css):  Schwarz #0a0a0a (10,10,10)
#                                   Rot     #b82028 (184,32,40)
#
# Idempotent: patcht IMMER aus der Original-Datei (.orig-Sicherung), nie aus
# einem bereits gepatchten Stand -> mehrfaches Ausführen ist gefahrlos.
# ---------------------------------------------------------------------------
set -e
cd /opt/mailcow-dockerized
SOGO=mailcowdockerized-sogo-mailcow-1
CSSDIR=data/conf/sogo
CONTAINER_CSS=/usr/local/lib/GNUstep/SOGo/WebServerResources/css/theme-default.css

echo "=== 1) Original theme-default.css aus dem Container ziehen (einmalig sichern) ==="
if [ ! -f "$CSSDIR/theme-default.css.orig" ]; then
  docker cp "$SOGO:$CONTAINER_CSS" "$CSSDIR/theme-default.css.orig"
  echo "   Original gesichert ($(wc -c < "$CSSDIR/theme-default.css.orig") Bytes)"
else
  echo "   Original-Sicherung existiert bereits (wird als Basis genutzt)"
fi

echo
echo "=== 2) Farb-Mapping anwenden (immer aus .orig -> idempotent) ==="
cp "$CSSDIR/theme-default.css.orig" "$CSSDIR/theme-default.css"
CSS="$CSSDIR/theme-default.css"

# --- PRIMÄR: alle Teal-Töne -> Schwarz-Abstufungen (dunkel..hell) ---
# Kopfleiste/Vollton -> Marken-Schwarz; hellere Hue-Stufen -> Grau-Abstufungen,
# damit Kontrast (weiße Icons/Text) erhalten bleibt.
sed -i \
  -e 's/rgb(77,128,128)/rgb(10,10,10)/g' \
  -e 's/rgba(77,128,128,/rgba(10,10,10,/g' \
  -e 's/rgb(99,153,151)/rgb(38,38,38)/g' \
  -e 's/rgba(99,153,151,/rgba(38,38,38,/g' \
  -e 's/rgb(125,179,176)/rgb(63,63,70)/g' \
  -e 's/rgb(142,191,187)/rgb(82,82,91)/g' \
  -e 's/rgba(142,191,187,/rgba(82,82,91,/g' \
  -e 's/rgb(161,204,200)/rgb(113,113,122)/g' \
  -e 's/rgba(161,204,200,/rgba(113,113,122,/g' \
  -e 's/rgb(178,214,211)/rgb(161,161,170)/g' \
  -e 's/rgba(178,214,211,/rgba(161,161,170,/g' \
  -e 's/rgb(203,229,200)/rgb(212,212,216)/g' \
  -e 's/rgb(225,245,243)/rgb(228,228,231)/g' \
  "$CSS"

# --- ACCENT: alle Grün-Töne -> Rot-Abstufungen ---
# 136,199,129 ist das FAB-/Accent-Grün. 86,176,76 / 0,200,83 gehören dazu.
sed -i \
  -e 's/rgb(136,199,129)/rgb(184,32,40)/g' \
  -e 's/rgba(136,199,129,/rgba(184,32,40,/g' \
  -e 's/rgb(86,176,76)/rgb(154,26,33)/g' \
  -e 's/rgba(86,176,76,/rgba(154,26,33,/g' \
  -e 's/rgb(0,200,83)/rgb(184,32,40)/g' \
  -e 's/rgba(0,200,83,/rgba(184,32,40,/g' \
  -e 's/rgb(56,142,60)/rgb(107,17,22)/g' \
  -e 's/rgba(56,142,60,/rgba(107,17,22,/g' \
  "$CSS"

echo "   gepatcht: $(wc -c < "$CSS") Bytes"

# --- CKEditor "Powered by"-Badge ausblenden ---
# SOGo bindet CKEditor 5 unter GPL ein (config.licenseKey = "GPL"); CKEditor
# zeigt dann trotzdem das "Powered by CKEditor"-Badge. Unter GPL ist das
# Ausblenden per CSS zulaessig. Das Badge ist ein Overlay .ck-powered-by
# (bzw. .ck-powered-by-balloon). theme-default.css wird als LETZTE CSS
# geladen -> !important hier gewinnt sicher. Idempotent (Marker-Guard).
if ! grep -q "MND-HIDE-CKEDITOR-BADGE" "$CSS"; then
  cat >> "$CSS" <<'BADGEEOF'
/* MND-HIDE-CKEDITOR-BADGE: "Powered by CKEditor"-Werbung ausblenden (GPL-konform) */
.ck.ck-powered-by,.ck-powered-by,.ck-powered-by-balloon,a.ck-powered-by{display:none!important;opacity:0!important;pointer-events:none!important}
BADGEEOF
  echo "   CKEditor-Badge-Ausblendung angehaengt ✓"
fi

# --- Signatur-Editor auf der Mail-Einstellungsseite hoeher machen ---
# Der Editor (.mnd-signature-editor, siehe UIxPreferences.wox) soll bei halber
# Breite dafuer hoeher sein. CKEditor-Content-Bereich = .ck-editor__editable.
if ! grep -q "MND-SIGNATURE-EDITOR-HEIGHT" "$CSS"; then
  cat >> "$CSS" <<'SIGEOF'
/* MND-SIGNATURE-EDITOR-HEIGHT: Signatur-Editor auf der Mail-Seite hoeher */
.mnd-signature-editor .ck-editor__editable,.mnd-signature-editor .ck-editor__editable_inline{min-height:16rem!important}
.mnd-signature-editor textarea{min-height:16rem!important}
SIGEOF
  echo "   Signatur-Editor-Hoehe angehaengt ✓"
fi

echo
echo "=== 3) Rest-Grün? (Kontrolle: dürfen nur noch neutrale Grautöne übrig sein) ==="
LEFT=$(grep -oE 'rgba?\((77,128,128|136,199,129|178,214,211|142,191,187|225,245,243|99,153,151|125,179,176|161,204,200|203,229,200|86,176,76|0,200,83|56,142,60)' "$CSS" | wc -l)
echo "   verbliebene Theme-Grün-Treffer: $LEFT  (Ziel: 0)"

echo
echo "=== 4) Gepatchte CSS read-only in den Container mounten ==="
# Falls der Mount noch nicht existiert: docker-compose.override.yml erweitern.
OVERRIDE=docker-compose.override.yml
MOUNT="./data/conf/sogo/theme-default.css:/usr/local/lib/GNUstep/SOGo/WebServerResources/css/theme-default.css:ro"
if ! grep -q "theme-default.css" "$OVERRIDE" 2>/dev/null; then
  echo "   Mount fehlt -> in $OVERRIDE ergänzen"
  if [ ! -f "$OVERRIDE" ]; then
    printf 'services:\n  sogo-mailcow:\n    volumes:\n      - %s\n' "$MOUNT" > "$OVERRIDE"
  else
    # existierende override: sogo-Service-Volumes ergänzen (einfacher Append-Block)
    python3 - "$OVERRIDE" "$MOUNT" <<'PYEOF'
import sys, re
path, mount = sys.argv[1], sys.argv[2]
txt = open(path).read()
if 'sogo-mailcow:' in txt and 'theme-default.css' not in txt:
    # unter sogo-mailcow: einen volumes-Eintrag anhängen
    txt = re.sub(r'(sogo-mailcow:\s*\n)', r'\1    volumes:\n      - '+mount+'\n', txt, count=1)
    open(path,'w').write(txt)
    print("   override ergänzt")
else:
    print("   override unverändert (bereits vorhanden oder kein sogo-Service)")
PYEOF
  fi
else
  echo "   Mount existiert bereits ✓"
fi

echo
echo "=== 5) sogo-Container neu erstellen ==="
# WICHTIG: Ein Bind-Mount einer EINZELNEN Datei zeigt im laufenden Container
# weiter auf den alten Inhalt, wenn die Datei auf der Platte geaendert wurde.
# 'docker compose up -d' erkennt das NICHT (Config unveraendert -> kein Recreate).
# Daher IMMER --force-recreate, damit der Container den aktuellen Dateistand mountet.
docker compose up -d --force-recreate sogo-mailcow 2>&1 | tail -3
echo "   warte auf SOGo..."
for i in $(seq 1 25); do
  code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 "https://mail.mynextdays.dk/SOGo/" || echo 000)
  [ "$code" = "200" ] && { echo "   SOGo up (HTTP 200) ✓"; break; }
  sleep 2
done

echo
echo "=== 6) Verifikation: liefert der Server jetzt Schwarz statt Teal? ==="
SERVED=$(curl -sk --max-time 10 "https://mail.mynextdays.dk/SOGo/WebServerResources/css/theme-default.css")
echo -n "   Kopfleisten-Schwarz rgb(10,10,10): "; echo "$SERVED" | grep -oE 'rgb\(10,10,10\)' | head -1 && echo "     -> ausgeliefert ✓" || echo "FEHLT ✗"
echo -n "   Accent-Rot rgb(184,32,40): ";        echo "$SERVED" | grep -oE 'rgb\(184,32,40\)' | head -1 && echo "     -> ausgeliefert ✓" || echo "FEHLT ✗"
echo -n "   verbliebenes Teal rgb(77,128,128): "; echo "$SERVED" | grep -c 'rgb(77,128,128)'
echo -n "   verbliebenes FAB-Grün rgb(136,199,129): "; echo "$SERVED" | grep -c 'rgb(136,199,129)'
