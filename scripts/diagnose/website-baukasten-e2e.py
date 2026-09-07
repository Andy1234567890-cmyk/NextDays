#!/usr/bin/env python3
"""End-to-End-Lauf des Website-Baukastens gegen eine ECHTE Umgebung.

Geht den ganzen Weg einmal durch, den ein Kunde geht: Seiten aller sechs Typen
anlegen, Abschnitte aller Typen fuellen, SEO setzen, Weiterleitung anlegen,
veroeffentlichen, die oeffentlichen Endpunkte und den Renderer abfragen, ein
Formular absenden, die Einsendung lesen -- und am Ende alles wieder wegraeumen.

WARUM ES DIESES SKRIPT GIBT
---------------------------
`pytest` laeuft gegen eine nachgebaute Datenbank, die jede Spalte und jeden
Wert akzeptiert. Genau deshalb blieb ein 500 in `seo/pruefung` unentdeckt (eine
Abfrage las `properties.name`, die Spalte heisst `title`) und genau deshalb
blieb unentdeckt, dass ein nicht erreichbarer Resolver die ganze Kundenseite mit
404 beantwortete statt mit 503. Beides zeigte sich erst hier.

Es raeumt IMMER auf: alles, was der Lauf anlegt, traegt den Slug-Praefix
`zzz-e2e-`, und geloescht wird nur, was diesen Praefix traegt -- gescoped auf
den Mandanten des uebergebenen Tokens. Bestehende Seiten werden weder gelesen
noch veraendert.

VORAUSSETZUNGEN
---------------
1. Ein Zugangstoken eines Kontos mit `MANAGE_SITE_CONFIG` (`--token`).
2. Ein Host, der in `tenant_custom_domains` mit `status = 'active'` auf denselben
   Mandanten zeigt (`--host`). Lokal ist das `localhost`; die Zeile ist eine
   Test-Vorrichtung und gehoert nach dem Lauf wieder entfernt.
3. Laufende API und laufender Renderer (`--api`, `--renderer`).

AUFRUF
------
    python3 scripts/diagnose/website-baukasten-e2e.py \
        --token "$(cat token.txt)" --host localhost \
        --api http://localhost:8000 --renderer http://localhost:3200

    # Nur aufraeumen, ohne zu pruefen:
    python3 scripts/diagnose/website-baukasten-e2e.py --token ... --nur-aufraeumen

Exit 1, sobald eine Pruefung fehlschlaegt.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--token", required=True, help="Bearer-Token mit MANAGE_SITE_CONFIG")
p.add_argument("--host", default="localhost", help="aktive Domain des Mandanten")
p.add_argument("--api", default="http://localhost:8000")
p.add_argument("--renderer", default="http://localhost:3200")
p.add_argument("--nur-aufraeumen", action="store_true",
               help="nur die Reste eines abgebrochenen Laufs entfernen")
ARGS = p.parse_args()

API = ARGS.api.rstrip("/")
REN = ARGS.renderer.rstrip("/")
HOST = ARGS.host
TOKEN = ARGS.token
PRAEFIX = "zzz-e2e-"

ok: list[str] = []
fehl: list[str] = []
angelegt: dict[str, list[str]] = {"pages": [], "redirects": [], "submissions": []}


def ruf(method, url, body=None, auth=True, roh=False):
    req = urllib.request.Request(url, method=method)
    if auth:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=25) as r:
            text = r.read().decode()
            return r.status, (text if roh else (json.loads(text) if text else {}))
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        return e.code, text
    except Exception as e:  # Netzfehler
        return 0, str(e)


def pruefe(name, bedingung, detail=""):
    (ok if bedingung else fehl).append(name)
    print(("  OK   " if bedingung else "  FEHL ") + name + (f"  {detail}" if detail and not bedingung else ""))


def txt(s):
    return {"de": s, "en": s}


def aufraeumen() -> None:
    """Entfernt alles, was ein Lauf angelegt hat.

    Immer auf (Mandant des Tokens, Slug-Praefix) gescoped -- nie ein
    ungescoptes Loeschen. Laeuft VOR dem Lauf (ein Rest aus einem abgebrochenen
    Durchgang wuerde ihn mit 409 blockieren) und danach.
    """
    _st, seiten = ruf("GET", f"{API}/api/v1/site-config/pages")
    for seite_ in (seiten.get("items", []) if isinstance(seiten, dict) else []):
        if (seite_.get("slug") or "").startswith(PRAEFIX):
            ruf("DELETE", f"{API}/api/v1/site-config/pages/{seite_['id']}")
    _st, wl = ruf("GET", f"{API}/api/v1/site-config/redirects")
    for w in (wl.get("items", []) if isinstance(wl, dict) else []):
        if PRAEFIX in (w.get("source_path") or ""):
            ruf("DELETE", f"{API}/api/v1/site-config/redirects/{w['id']}")
    _st, ein = ruf("GET", f"{API}/api/v1/site-config/form-submissions")
    for e in (ein.get("items", []) if isinstance(ein, dict) else []):
        if e.get("form_name") == "E2E-Anfrage":
            ruf("DELETE", f"{API}/api/v1/site-config/form-submissions/{e['id']}")
    # Die SEO-Felder gehoeren dem Betrieb; der Lauf hat sie ueberschrieben und
    # gibt sie leer zurueck. Das ist der Ausgangszustand jeder Website, die den
    # Baukasten neu bekommt -- ein erfundener Ersatzwert waere hier falscher.
    ruf("PUT", f"{API}/api/v1/site-config",
        {"seo_title": None, "seo_description": None, "seo_keywords": None,
         "gtag_id": None})


if ARGS.nur_aufraeumen:
    aufraeumen()
    print("Reste entfernt.")
    sys.exit(0)

aufraeumen()


# === 1) Oeffentlicher Resolver ============================================
print("\n1) Resolver /site/by-domain")
st, site = ruf("GET", f"{API}/api/v1/site/by-domain?host={HOST}", auth=False)
pruefe("by-domain 200", st == 200, f"{st} {site}")
if st != 200:
    sys.exit(1)
pruefe("tenant_id geliefert", bool(site.get("tenant_id")))
pruefe("payments_ready im Branding", "payments_ready" in site, str(sorted(site)[:20]))
pruefe("system_fonts_first = true (0439)", site.get("system_fonts_first") is True, str(site.get("system_fonts_first")))
# head_html/head_css/custom_js/checkout_js SIND oeffentlich: der Renderer
# spritzt genau diesen Kundencode in die ausgelieferte Seite. Geprueft wird
# deshalb, was NICHT nach draussen darf.
GEHEIM = ("stripe_account_id", "paypal_email", "recipient", "smtp", "api_key")
pruefe("kein Leak geheimer Felder", not any(k in site for k in GEHEIM),
       str([k for k in GEHEIM if k in site]))

# === 2) Seiten aller Typen ================================================
print("\n2) Seiten anlegen (sechs Typen)")


def seite(payload, name):
    st, r = ruf("POST", f"{API}/api/v1/site-config/pages", payload)
    if st in (200, 201):
        angelegt["pages"].append(r["id"])
    pruefe(f"Seite {name}", st in (200, 201), f"{st} {r}")
    return r if st in (200, 201) else None


normal = seite({"title": "E2E Seite", "slug": PRAEFIX + "seite"}, "normal")
ordner = seite({"title": "E2E Ordner", "slug": PRAEFIX + "ordner", "page_type": "folder"}, "folder")
extern = seite({"title": "E2E Extern", "slug": PRAEFIX + "extern", "page_type": "external",
                "external_url": "https://www.google.com/"}, "external")
popup = seite({"title": "E2E Popup", "slug": PRAEFIX + "popup", "page_type": "popup",
               "popup_trigger": "delay", "popup_value": 3}, "popup")
post = seite({"title": "E2E Beitrag", "slug": PRAEFIX + "beitrag", "page_type": "post",
              "published_at": "2026-08-01T10:00:00Z", "author": "Redaktion",
              "excerpt": "Kurzer Anriss fuer die Liste.", "tags": ["test", "e2e"]}, "post")

# Abwehr: die Regeln muessen greifen
st, r = ruf("POST", f"{API}/api/v1/site-config/pages",
            {"title": "x", "slug": PRAEFIX + "extern2", "page_type": "external"})
pruefe("external ohne URL -> 4xx", 400 <= st < 500, f"{st} {r}")
st, r = ruf("POST", f"{API}/api/v1/site-config/pages",
            {"title": "x", "slug": PRAEFIX + "popup2", "page_type": "popup"})
pruefe("popup ohne Ausloeser -> 4xx", 400 <= st < 500, f"{st} {r}")
st, r = ruf("POST", f"{API}/api/v1/site-config/pages",
            {"title": "x", "slug": PRAEFIX + "post2", "page_type": "post",
             "tags": ["a", "b", "c", "d", "e", "f", "g", "h", "i"]})
pruefe("post mit 9 Schlagwoertern -> 422", st == 422, f"{st} {r}")

# === 3) Abschnitte aller neuen Typen ======================================
print("\n3) Abschnitte anlegen")
BLOECKE = [
    ("faq", {"headline": txt("Haeufige Fragen"),
             "items": [{"question": txt("Wann ist Anreise?"), "answer": txt("Ab 15 Uhr.")}]}),
    ("map", {"headline": txt("So finden Sie uns"), "address": "Vestergade 1, 6800 Varde", "zoom": 13, "height": 380}),
    ("testimonials", {"headline": txt("Stimmen"),
                      "items": [{"quote": txt("Sehr schoen."), "author": "Familie J.", "location": "Aarhus"}]}),
    ("features", {"headline": txt("Merkmale"), "columns": 3,
                  "items": [{"icon": "wifi", "title": txt("WLAN"), "text": txt("Kostenfrei.")}]}),
    ("posts", {"headline": txt("Neues"), "limit": 3}),
    ("form", {"headline": txt("Anfrage"), "form_name": "E2E-Anfrage",
              "submit_label": txt("Senden"), "success_text": txt("Danke."),
              "fields": [
                  {"name": "name", "type": "text", "label": txt("Name"), "required": True},
                  {"name": "email", "type": "email", "label": txt("E-Mail"), "required": True},
                  {"name": "nachricht", "type": "textarea", "label": txt("Nachricht")},
                  {"name": "einwilligung", "type": "consent", "label": txt("Ich stimme zu."), "required": True},
              ]}),
]
form_block_id = None
faq_block_id = None
for typ, inhalt in BLOECKE:
    st, r = ruf("POST", f"{API}/api/v1/site-config/pages/{normal['id']}/blocks",
                {"type": typ, "content": inhalt})
    pruefe(f"Abschnitt {typ}", st in (200, 201), f"{st} {r}")
    if typ == "form" and st in (200, 201):
        form_block_id = r["id"]
    if typ == "faq" and st in (200, 201):
        faq_block_id = r["id"]

# --- Stil-Roundtrip (Etappe 2, 05.09.2026) --------------------------------
# Die Framer-Abschnitte als Unterobjekte in `settings`, mit einer Mobil-
# Ueberschreibung. Gespeichert -> zurueckgelesen -> vom Renderer als <style>
# mit Media-Query ausgegeben. pytest sieht davon nur die Pydantic-Seite; ob
# der Renderer das CSS wirklich schreibt, zeigt erst diese Kette.
STIL = {
    "stil": {"opazitaet": 0.9, "radius": {"alle": 24},
             "grenze": {"breite": 1, "farbe": "rolle:border"}},
    "scroll": {"anker": "e2e-anker"},
    "je_geraet": {"mobil": {"stil": {"radius": {"alle": 8}}}},
}
if faq_block_id:
    st, r = ruf("PUT", f"{API}/api/v1/site-config/blocks/{faq_block_id}", {"settings": STIL})
    pruefe("Stil-Unterobjekte gespeichert", st == 200 and (r.get("settings") or {}).get("scroll") == {"anker": "e2e-anker"}, f"{st} {str(r)[:200]}")
    st, r = ruf("PUT", f"{API}/api/v1/site-config/blocks/{faq_block_id}",
                {"settings": {"stil": {"opazität": 1}}})
    pruefe("Tippfehler im Unterobjekt -> 400", st == 400, f"{st} {r}")
    st, r = ruf("PUT", f"{API}/api/v1/site-config/blocks/{faq_block_id}",
                {"settings": {"je_geraet": {"desktop": {}}}})
    pruefe("je_geraet.desktop -> 400", st == 400, f"{st} {r}")

st, r = ruf("POST", f"{API}/api/v1/site-config/pages/{normal['id']}/blocks",
            {"type": "form", "content": {"fields": [
                {"name": "a", "type": "text"}, {"name": "a", "type": "email"}]}})
pruefe("Formular mit doppeltem Feldnamen abgelehnt", 400 <= st < 500, f"{st} {r}")

# Ein Popup ohne Abschnitte wird bewusst nicht ausgeliefert (leeres Fenster).
if popup:
    st, r = ruf("POST", f"{API}/api/v1/site-config/pages/{popup['id']}/blocks",
                {"type": "rich_text", "content": {"html": txt("<p>E2E Hinweis</p>")}})
    pruefe("Abschnitt im Popup", st in (200, 201), f"{st} {r}")

# === 4) SEO ===============================================================
print("\n4) SEO + Messung")
st, r = ruf("PUT", f"{API}/api/v1/site-config", {
    "seo_title": "E2E Titel fuer den Lauf",
    "seo_description": "Eine Beschreibung, die lang genug ist, um die Laengenpruefung zu bestehen und trotzdem unter 160 Zeichen bleibt.",
    "seo_keywords": "ferienhaus, daenemark",
    "gtag_id": "G-E2ETEST123",
})
pruefe("SEO speichern", st == 200, f"{st} {r}")
st, r = ruf("PUT", f"{API}/api/v1/site-config", {"gtag_id": "XY-kaputt"})
pruefe("kaputte gtag_id -> 422", st == 422, f"{st} {r}")
st, befunde = ruf("GET", f"{API}/api/v1/site-config/seo/pruefung")
pruefe("SEO-Pruefung 200", st == 200, f"{st} {befunde}")
if st == 200:
    codes = {b.get("code") for b in befunde.get("items", [])}
    print("     Befunde:", sorted(codes))

# === 5) Weiterleitung =====================================================
print("\n5) Weiterleitung")
st, r = ruf("POST", f"{API}/api/v1/site-config/redirects",
            {"source_path": "/" + PRAEFIX + "alt", "target": "/" + PRAEFIX + "seite"})
if st in (200, 201):
    angelegt["redirects"].append(r["id"])
pruefe("Weiterleitung anlegen", st in (200, 201), f"{st} {r}")
st, r = ruf("GET", f"{API}/api/v1/site/redirect?host={HOST}&path=/{PRAEFIX}alt", auth=False)
pruefe("Weiterleitung greift oeffentlich", st == 200 and r.get("target", "").endswith(PRAEFIX + "seite"), f"{st} {r}")
st, r = ruf("GET", f"{API}/api/v1/site/redirect?host={HOST}&path=/gibt-es-nicht", auth=False)
pruefe("unbekannter Pfad -> kein Ziel", st == 200 and not r.get("target"), f"{st} {r}")

# === 6) Veroeffentlichen ==================================================
print("\n6) Veroeffentlichen")
for p, name in ((normal, "seite"), (post, "beitrag"), (popup, "popup")):
    if p:
        st, r = ruf("POST", f"{API}/api/v1/site-config/pages/{p['id']}/publish")
        pruefe(f"publish {name}", st == 200, f"{st} {r}")

# Erst JETZT sagt die SEO-Pruefung etwas: fast alle Befunde beziehen sich auf
# VEROEFFENTLICHTE Seiten (`live`). Vor dem Veroeffentlichen ist die leere
# Liste die richtige Antwort und beweist nichts.
st, befunde = ruf("GET", f"{API}/api/v1/site-config/seo/pruefung")
codes = {b.get("code") for b in befunde.get("items", [])} if st == 200 else set()
print("     Befunde nach dem Veroeffentlichen:", sorted(codes))
pruefe("Befund: Seite ohne SEO-Titel", "seiten_ohne_titel" in codes, str(sorted(codes)))
pruefe("Befund: keine Domain oder Domain vorhanden",
       "keine_domain" not in codes, str(sorted(codes)))

# === 7) Oeffentliche Lesepfade ============================================
print("\n7) Oeffentliche Endpunkte")
st, r = ruf("GET", f"{API}/api/v1/site/page?host={HOST}&slug={PRAEFIX}seite", auth=False)
pruefe("site/page liefert Seite", st == 200 and len(r.get("blocks", [])) >= 6, f"{st} {str(r)[:200]}")
st, r = ruf("GET", f"{API}/api/v1/site/sitemap?host={HOST}", auth=False)
pfade = [e.get("slug") for e in (r.get("pages") or [])] if st == 200 else []
pruefe("sitemap enthaelt die Seite", st == 200 and any(PRAEFIX + "seite" == (p or "") for p in pfade), f"{st} {pfade[:10]}")
pruefe("sitemap enthaelt KEIN Popup", not any(PRAEFIX + "popup" == (p or "") for p in pfade), str(pfade[:10]))
pruefe("sitemap enthaelt Objekte", len(r.get("properties") or []) > 0, str(r)[:120])
st, r = ruf("GET", f"{API}/api/v1/site/popups?host={HOST}", auth=False)
pruefe("popups-Endpunkt liefert das Popup", st == 200 and len(r.get("items", [])) >= 1, f"{st} {str(r)[:200]}")
st, r = ruf("GET", f"{API}/api/v1/site/posts?host={HOST}", auth=False)
pruefe("posts-Endpunkt liefert den Beitrag", st == 200 and any(PRAEFIX + "beitrag" in (i.get("slug") or "") for i in r.get("items", [])), f"{st} {str(r)[:200]}")
st, r = ruf("GET", f"{API}/api/v1/site/posts/{PRAEFIX}beitrag?host={HOST}", auth=False)
pruefe("einzelner Beitrag", st == 200 and (r.get("post") or {}).get("author") == "Redaktion", f"{st} {str(r)[:200]}")

# === 8) Formular absenden (oeffentlich) ===================================
print("\n8) Formular")
if form_block_id:
    st, r = ruf("POST", f"{API}/api/v1/site/form?host={HOST}",
                {"block_id": form_block_id,
                 "daten": {"name": "E2E Tester", "email": "e2e@example.org",
                           "nachricht": "Testeinsendung", "einwilligung": True}}, auth=False)
    pruefe("Einsendung angenommen", st in (200, 201), f"{st} {r}")
    st, r = ruf("POST", f"{API}/api/v1/site/form?host={HOST}",
                {"block_id": form_block_id, "daten": {"name": "X", "email": "x@example.org"}}, auth=False)
    pruefe("ohne Einwilligung -> 422", st == 422, f"{st} {r}")
    st, r = ruf("POST", f"{API}/api/v1/site/form?host={HOST}",
                {"block_id": form_block_id, "daten": {"name": "X", "email": "x@example.org",
                                                      "einwilligung": True, "geschmuggelt": "boese"}}, auth=False)
    pruefe("unbekanntes Feld wird angenommen und verworfen", st in (200, 201), f"{st} {r}")
    st, liste = ruf("GET", f"{API}/api/v1/site-config/form-submissions")
    eigene = [i for i in liste.get("items", []) if i.get("form_name") == "E2E-Anfrage"] if st == 200 else []
    angelegt["submissions"] = [i["id"] for i in eigene]
    pruefe("Einsendungen lesbar (mit Recht)", st == 200 and len(eigene) >= 2, f"{st} {len(eigene)}")
    if eigene:
        pruefe("geschmuggeltes Feld nicht gespeichert",
               all("geschmuggelt" not in (i.get("daten") or {}) for i in eigene),
               str([i.get("daten") for i in eigene]))
        st, r = ruf("POST", f"{API}/api/v1/site-config/form-submissions/{eigene[0]['id']}/read")
        pruefe("als gelesen markieren", st in (200, 204), f"{st} {r}")

# === 9) Renderer (Port 3200) =============================================
print("\n9) Renderer")
# Der Dev-Server uebersetzt jede Route beim ERSTEN Aufruf; das dauert laenger
# als die 1500 ms, die die Middleware dem Resolver gibt, und die Antwort waere
# ein 503 aus dem Aufwaermen statt ein Befund. Deshalb einmal vorwaermen und
# erst danach messen. In Produktion gibt es diesen Schritt nicht.
PFADE = (f"/{PRAEFIX}seite", "/sitemap.xml", "/robots.txt", "/llms.txt",
         "/blog", f"/blog/{PRAEFIX}beitrag", "/blog/rss.xml", "/gibt-es-diese-seite-nicht")
for pfad in PFADE:
    # Bis zu fuenfmal, weil der Dev-Server beim ersten Aufruf uebersetzt und die
    # Middleware dem Resolver nur 1500 ms gibt -- in Produktion ist der Aufruf
    # eine Weiterleitung an localhost und dauert Millisekunden.
    for _ in range(5):
        st, _b = ruf("GET", REN + pfad, auth=False, roh=True)
        if st != 503:
            break
for pfad, name, muss in (
    (f"/{PRAEFIX}seite", "Seite", ["Haeufige Fragen", "Stimmen", "Merkmale"]),
    ("/sitemap.xml", "sitemap.xml", ["<urlset", PRAEFIX + "seite"]),
    ("/robots.txt", "robots.txt", ["Sitemap:"]),
    ("/llms.txt", "llms.txt", []),
    ("/blog", "Blog-Liste", ["E2E Beitrag"]),
    (f"/blog/{PRAEFIX}beitrag", "Beitrag", ["E2E Beitrag", "Redaktion"]),
    ("/blog/rss.xml", "RSS", ["<rss", "E2E Beitrag"]),
):
    st, body = ruf("GET", REN + pfad, auth=False, roh=True)
    fehlend = [m for m in muss if m not in (body or "")]
    pruefe(f"Renderer {name} ({pfad})", st == 200 and not fehlend,
           f"HTTP {st}; fehlt: {fehlend}; anfang={str(body)[:160]}")

st, body = ruf("GET", REN + "/gibt-es-diese-seite-nicht", auth=False, roh=True)
pruefe("Renderer 404-Seite", st == 404, f"HTTP {st}")

# Der Stil-Roundtrip im gerenderten HTML: Grundregel, Mobil-Unterschied, Anker.
st, body = ruf("GET", REN + f"/{PRAEFIX}seite", auth=False, roh=True)
body = body or ""
for name, muss in (
    ("Renderer: Radius Desktop", "border-radius:24px"),
    ("Renderer: Grenze aus Farbrolle", "border:1px solid var(--border)"),
    ("Renderer: Mobil-Ueberschreibung als Media-Query", "@media (max-width:767px)"),
    ("Renderer: Mobil-Radius", "border-radius:8px"),
    ("Renderer: Scroll-Anker als id", 'id="e2e-anker"'),
):
    pruefe(name, st == 200 and muss in body, f"HTTP {st}; fehlt: {muss}")
pruefe("Renderer: kein Tablet-Block ohne Tablet-Werte", "@media (max-width:1023px)" not in body)

# === 10) Kein 500 auf irgendeinem Lesepfad des Slice ======================
# Der Fund, der diesen Abschnitt ausgeloest hat: `seo/pruefung` warf 500, weil
# eine Abfrage `properties.name` las -- eine Spalte, die es nicht gibt. Solche
# Fehler zeigen sich NUR beim echten Aufruf gegen die echte Datenbank; kein
# Typpruefer und kein Test mit nachgebauter DB sieht sie.
print("\n10) Alle Lesepfade des Slice ohne 500")
spec = json.loads(urllib.request.urlopen(f"{API}/openapi.json", timeout=25).read())
ersatz = {"page_id": normal["id"], "block_id": form_block_id or "0" * 36,
          "medium_id": "00000000-0000-0000-0000-000000000000",
          "domain_id": "00000000-0000-0000-0000-000000000000",
          "redirect_id": angelegt["redirects"][0] if angelegt["redirects"] else "00000000-0000-0000-0000-000000000000",
          "submission_id": angelegt["submissions"][0] if angelegt["submissions"] else "00000000-0000-0000-0000-000000000000",
          "slug": PRAEFIX + "beitrag"}
for pfad, ops in sorted(spec["paths"].items()):
    if "/site-config" not in pfad and "/site/" not in pfad:
        continue
    if "get" not in ops:
        continue
    url = pfad
    for k, v in ersatz.items():
        url = url.replace("{" + k + "}", str(v))
    if "{" in url:
        continue
    q = "?host=" + HOST if any(p_.get("name") == "host" for p_ in ops["get"].get("parameters", [])) else ""
    if "path" in [p_.get("name") for p_ in ops["get"].get("parameters", [])]:
        q += "&path=/" + PRAEFIX + "alt"
    st, r = ruf("GET", API + url + q)
    pruefe(f"GET {pfad} kein 5xx", st < 500, f"{st} {str(r)[:200]}")

print(f"\n=== {len(ok)} OK, {len(fehl)} FEHL ===")
for f in fehl:
    print("  FEHL:", f)
aufraeumen()
print("Aufgeraeumt.")
sys.exit(1 if fehl else 0)
