// Partner-Link `/p/CODE` (Affiliate-Programm, 0517).
//
// Der Link, den ein Partner teilt, zeigt auf UNSERE Domain, nicht auf die API:
// `mynextdays.com/p/ANNA-K7P2`. Dieser Handler meldet den Klick server-zu-
// server an die FastAPI (`POST /affiliates/clicks`) und schickt den Besucher
// mit `?ref=CODE&klick=TOKEN` auf die Startseite weiter.
//
// BEWUSST KEIN COOKIE. Ein Tracking-Cookie (und nach EDPB 2/2023 Rn. 49–51
// auch ein Tracking-Link) fällt unter Art. 5(3) ePrivacy und bräuchte eine
// Einwilligung, die der Besucher hier noch nicht gegeben hat. Der Code reist
// deshalb nur in der Adresse, wird auf der Startseite sichtbar genannt
// (`PartnerHinweis`) und steht später im Registrierungsformular zur
// Bestätigung — der Betrieb entscheidet durch das Absenden.
//
// Unbekannter Code: Weiterleitung OHNE Parameter. Ein toter Link soll den
// Besucher nicht auf einer Fehlerseite stehen lassen; die API loggt den Fall.
import { type NextRequest, NextResponse } from "next/server";

import { PARTNER_BEWERBEN_URL } from "@/lib/app-url";
import { API_BASE } from "@/lib/config";

export const dynamic = "force-dynamic";

type KlickAntwort = { code: string | null; click_token: string | null };

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  // Team-Link (0520): `?team=1` führt zur PARTNER-Bewerbung, nicht zur
  // Betriebs-Registrierung. Der Sponsor-Code steht dort sichtbar im Formular.
  if (req.nextUrl.searchParams.get("team") === "1") {
    const bewerben = new URL(PARTNER_BEWERBEN_URL, req.nextUrl.origin);
    // PARTNER_BEWERBEN_URL ist relativ (Bewerbung in dieser App).
    bewerben.searchParams.set("sponsor", code.toUpperCase().slice(0, 40));
    return NextResponse.redirect(bewerben, 302);
  }
  const ziel = req.nextUrl.clone();
  ziel.pathname = "/";
  ziel.search = "";

  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const wert = req.nextUrl.searchParams.get(key);
    if (wert) utm[key] = wert.slice(0, 120);
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";

  let antwort: KlickAntwort | null = null;
  try {
    const res = await fetch(`${API_BASE}/affiliates/clicks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Die echte Besucher-IP und der echte Browser — sonst sähe die API nur
        // den Marketing-Container (wie der Login für den Geräteverlauf).
        ...(ip ? { "X-Client-IP": ip } : {}),
        "X-Client-User-Agent": req.headers.get("user-agent") ?? "",
      },
      body: JSON.stringify({
        code: code.slice(0, 40),
        referrer: req.headers.get("referer")?.slice(0, 500) ?? null,
        landing: "/",
        utm,
      }),
      cache: "no-store",
    });
    if (res.ok) antwort = (await res.json()) as KlickAntwort;
    else console.warn("[partner-link] Klick nicht angenommen", res.status);
  } catch (fehler) {
    // Die API ist gerade nicht erreichbar — der Besucher soll trotzdem auf
    // der Seite landen. Der Code bleibt in der Adresse, die Zuordnung klappt
    // später über das sichtbare Feld im Formular.
    console.warn("[partner-link] API nicht erreichbar", fehler);
    ziel.searchParams.set("ref", code.toUpperCase().slice(0, 40));
    return NextResponse.redirect(ziel, 302);
  }

  if (antwort?.code) {
    ziel.searchParams.set("ref", antwort.code);
    if (antwort.click_token) ziel.searchParams.set("klick", antwort.click_token);
  }
  return NextResponse.redirect(ziel, 302);
}
