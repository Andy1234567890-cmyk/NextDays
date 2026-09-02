import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerprogram",
  description: "Anbefal virksomheder, opbyg et team og tjen penge på abonnementsindtægter.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Sådan fungerer det",
      articles: [
        {
          slug: "ueberblick",
          title: "Partnerprogrammet i overblik",
          excerpt: "Hvem kan deltage, hvordan provision opstår, og hvad du ser.",
          updated: "Status: September 2026",
          body: [
            {
              type: "p",
              text: "Som partner anbefaler du myNextDays til udlejere, bureauer og hoteller. Hvis en virksomhed registrerer sig med din kode eller via dit link og betaler sine abonnementsregninger, modtager du en andel af netto-abonnementsindtægterne i tolv måneder. Skalaen baseret på betalende kunder er live på programsiden.",
            },
            { type: "h2", text: "Hvem kan blive partner" },
            {
              type: "ul",
              items: [
                "Personer og virksomheder i EU, Schweiz eller Storbritannien med en ægte kanal til værter: Influencere, konsulenter, bureauer, skattekontorer, foreninger.",
                "Også myNextDays-kunder selv – et abonnement er ikke en forudsætning.",
                "Obligatorisk i ansøgningen: mindst én social media-konto (Instagram, TikTok, YouTube, Facebook, LinkedIn …) med adresse, brugernavn og rækkevidde. Hjemmeside eller nyhedsbrev er også velkomment.",
              ],
            },
            { type: "h2", text: "Hvordan en virksomhed tildeles dig" },
            {
              type: "steps",
              items: [
                "Du deler dit link (mynextdays.com/p/DIN-KODE) eller din kode.",
                "Virksomheden ser koden ved registrering i feltet „Anbefalet af“ og bekræfter den ved at sende – uden cookie.",
                "Med den første betalte abonnementsregning starter den tolv måneder lange periode.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Du ser dine kunder pseudonymt (Kunde #1, #2 …) med land, status og beløb – aldrig navn eller e-mail. En virksomhed tildeles præcis én partner; den første vinder.",
            },
            { type: "h2", text: "Hvad du finder i dashboardet" },
            {
              type: "ul",
              items: [
                "Oversigt: Rang, klik, registrerede og betalende virksomheder, åben, udbetalbar og udbetalt provision.",
                "Provisioner: hver betalt abonnementsregning som en linje med basis, sats, beløb og status.",
                "Udbetalinger: månedligt pr. valuta fra minimumsbeløbet, med kreditnota (self-billing) som bevis.",
                "Links & Materiale: Dine koder, reklamemateriale og den obligatoriske mærkning pr. land.",
                "Beskeder: den direkte linje til partnerteamet.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Opbyg team: team-provisionen",
          excerpt: "Vælg partnere, der tilmelder sig med din kode – og tjen penge på deres kunders omsætning.",
          updated: "Status: September 2026",
          body: [
            {
              type: "p",
              text: "Du kan få andre partnere med i dit team. Hvis nogen ansøger via dit team-link (mynextdays.com/p/DIN-KODE?team=1) og tydeligt angiver din kode i ansøgningen, tilhører de dit team efter godkendelse. Du modtager en team-provision på netto-abonnementsindtægterne fra dine team-partneres kunder.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Team-satsen afhænger af DIN rang på betalingstidspunktet – ikke af dit teams størrelse. Satserne findes på programsiden.",
                "Din rang opstår kun fra dine egne betalende kunder. Team-kunder tæller ikke med i rangen.",
                "Præcis ét niveau: Dine team-partnere opbygger ikke deres eget team under dig.",
                "Ingen deltagergebyr, ingen penge for at rekruttere en partner. Team-provision opstår udelukkende fra betalt abonnementsomsætning.",
                "Tolv måneder fra den første betalte regning fra den respektive team-kunde, 30 dages refusionsvindue, tilbagekaldelse ved refusion eller chargeback – som med din egen provision.",
                "Teamprovision opstår kun, når du og din teampartner er godkendt; ellers sættes den på pause.",
              ],
            },
            { type: "h2", text: "Teamevalueringen" },
            {
              type: "p",
              text: "Under \"Team\" ser du hver teampartner med rang, betalende kunder, abonnementsomsætning fra deres kunder (30 dage og totalt) og din teamprovision herfra – åben, udbetalbar, udbetalt – samt udviklingen de seneste tolv måneder. Du kan ikke se kundedetaljer for dine teampartnere; de tilhører dem.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Via \"Team\" kan du kontakte dine teampartnere direkte med en besked – og din sponsor dig.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Samme e-mail-domæne eller samme bankforbindelse mellem sponsor og teampartner markeres og kontrolleres af partnerteamet, før teamprovision udbetales.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Udbetaling, kreditnota og skatter",
          excerpt: "Hvornår provision kan udbetales, hvordan kreditnotaen ser ud, og hvad der gælder skattemæssigt.",
          updated: "Status: September 2026",
          body: [
            {
              type: "steps",
              items: [
                "En provisionslinje opstår med den betalte abonnementsfaktura og er \"åben\" i 30 dage (refusionsvindue).",
                "Derefter kan den udbetales. Den første i måneden samler vi alle udbetalbare linjer pr. valuta.",
                "Hvis summen overstiger minimumsbeløbet i din valuta, opstår en udbetaling med kreditnota (self-billing). Du behøver ikke at udstede en faktura.",
                "Efter overførslen vises udbetalingen som \"Betalt\" med reference i dashboardet.",
              ],
            },
            {
              type: "ul",
              items: [
                "Virksomheder: Kreditnotaen indeholder en omvendt betalingspligt-bemærkning; forudsætningen er et bekræftet momsnummer (VIES-kontrol).",
                "Privatpersoner: Kreditnotaen viser ingen moms; provisionen skal selv beskattes.",
                "Udbetaling via SEPA, Wise eller PayPal – dataene indtaster du i profilen; ændringer kræver dit password.",
                "Ingen omregning: Provision i DKK udbetales i DKK, provision i EUR i EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklame skal være genkendelig som reklame – i begyndelsen af indlægget, på indlæggets sprog. De godkendte formuleringer pr. land finder du under \"Links & Materiale\". Overtrædelser kan føre til udelukkelse.",
            },
          ],
        },
      ],
    },
  ],
};
