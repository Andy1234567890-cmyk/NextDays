import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerprogramma",
  description: "Beveel bedrijven aan, bouw een team op en verdien mee aan abonnementsinkomsten.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Hoe het werkt",
      articles: [
        {
          slug: "ueberblick",
          title: "Het partnerprogramma in één oogopslag",
          excerpt: "Wie kan deelnemen, hoe commissie ontstaat en wat u ziet.",
          updated: "Status: september 2026",
          body: [
            {
              type: "p",
              text: "Als partner beveelt u myNextDays aan bij verhuurders, bureaus en hotels. Als een bedrijf zich registreert met uw code of via uw link en zijn abonnementsfacturen betaalt, ontvangt u twaalf maanden lang een deel van de netto-abonnementsinkomsten. De staffel op basis van betalende klanten is live te zien op de programmapagina.",
            },
            { type: "h2", text: "Wie partner kan worden" },
            {
              type: "ul",
              items: [
                "Personen en bedrijven in de EU, Zwitserland of het Verenigd Koninkrijk met een echt kanaal naar hosts: influencers, consultants, bureaus, belastingadvieskantoren, verenigingen.",
                "Ook myNextDays-klanten zelf – een abonnement is geen vereiste.",
                "Verplicht bij de aanmelding: minimaal één socialmedia-account (Instagram, TikTok, YouTube, Facebook, LinkedIn …) met adres, handle en bereik. Website of nieuwsbrief is een pluspunt.",
              ],
            },
            { type: "h2", text: "Hoe een bedrijf aan u wordt toegewezen" },
            {
              type: "steps",
              items: [
                "U deelt uw link (mynextdays.com/p/UW-CODE) of uw code.",
                "Het bedrijf ziet de code bij de registratie in het veld „Aanbevolen door” en bevestigt deze door te verzenden – zonder cookie.",
                "Met de eerste betaalde abonnementsfactuur begint de looptijd van twaalf maanden.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "U ziet uw klanten pseudoniem (Klant #1, #2 …) met land, status en bedragen – nooit naam of e-mail. Een bedrijf wordt aan precies één partner toegewezen; de eerste wint.",
            },
            { type: "h2", text: "Wat u in het dashboard vindt" },
            {
              type: "ul",
              items: [
                "Overzicht: rang, klikken, geregistreerde en betalende bedrijven, openstaande, uitbetaalbare en uitbetaalde commissie.",
                "Commissies: elke betaalde abonnementsfactuur als regel met basis, tarief, bedrag en status.",
                "Uitbetalingen: maandelijks per valuta vanaf het minimumbedrag, met creditnota (self-billing) als bewijs.",
                "Links & materiaal: uw codes, promotiemateriaal en de verplichte markering per land.",
                "Berichten: de directe lijn naar het partnerteam.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Team opbouwen: de teamcommissie",
          excerpt: "Werf partners die met uw code lid worden – en verdien mee aan de omzet van hun klanten.",
          updated: "Status: september 2026",
          body: [
            {
              type: "p",
              text: "U kunt andere partners in uw team opnemen. Als iemand zich aanmeldt via uw teamlink (mynextdays.com/p/UW-CODE?team=1) en uw code zichtbaar invult in de aanmelding, behoort hij na goedkeuring tot uw team. Op de netto-abonnementsinkomsten van de klanten van uw teampartners ontvangt u een teamcommissie.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Het teamtarief is afhankelijk van UW rang op het moment van betaling – niet van de grootte van uw team. De tarieven staan op de programmapagina.",
                "Uw rang ontstaat alleen uit uw eigen betalende klanten. Teamklanten tellen niet mee voor de rang.",
                "Precies één niveau: uw teampartners bouwen geen eigen team onder u op.",
                "Geen deelnamekosten, geen geld voor het werven van een partner. Teamcommissie ontstaat uitsluitend uit betaalde abonnementsinkomsten.",
                "Twaalf maanden vanaf de eerste betaalde factuur van de betreffende teamklant, 30 dagen restitutieperiode, terugname bij restitutie of chargeback – zoals bij de eigen commissie.",
                "Teamprovisie ontstaat alleen als u en uw teampartner zijn goedgekeurd; anders wordt deze opgeschort.",
              ],
            },
            { type: "h2", text: "De teamevaluatie" },
            {
              type: "p",
              text: "Onder “Team” ziet u elke teampartner met rang, betalende klanten, abonnementsomzet van zijn klanten (30 dagen en totaal) en uw teamprovisie daaruit — open, uitbetaalbaar, uitbetaald — evenals het verloop van de laatste twaalf maanden. Klantdetails van uw teampartners ziet u niet; die zijn van hen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Via “Team” bereikt u uw teampartners direct per bericht — en uw sponsor u.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Hetzelfde e-maildomein of dezelfde bankrekening tussen sponsor en teampartner worden gemarkeerd en door het partnerteam gecontroleerd voordat teamprovisie wordt uitbetaald.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Uitbetaling, creditnota en belastingen",
          excerpt: "Wanneer provisie uitbetaalbaar wordt, hoe de creditnota eruitziet en wat fiscaal van toepassing is.",
          updated: "Status: september 2026",
          body: [
            {
              type: "steps",
              items: [
                "Een provisieregel ontstaat met de betaalde abonnementsfactuur en is 30 dagen “open” (terugbetalingsperiode).",
                "Daarna is deze uitbetaalbaar. Op de eerste van de maand bundelen we alle uitbetaalbare regels per valuta.",
                "Als het totaalbedrag boven het minimumbedrag van uw valuta ligt, ontstaat een uitbetaling met creditnota (self-billing). U hoeft geen factuur te sturen.",
                "Na de overboeking staat de uitbetaling als “Betaald” met referentie in het dashboard.",
              ],
            },
            {
              type: "ul",
              items: [
                "Bedrijven: De creditnota bevat de reverse-charge-vermelding; voorwaarde is een bevestigd btw-nummer (VIES-controle).",
                "Particulieren: De creditnota vermeldt geen btw; de provisie moet zelf worden belast.",
                "Uitbetaling via SEPA, Wise of PayPal — de gegevens vult u in uw profiel in; wijzigingen vereisen uw wachtwoord.",
                "Geen omrekening: Provisie in DKK wordt in DKK uitbetaald, provisie in EUR in EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reclame moet herkenbaar zijn als reclame — aan het begin van de post, in de taal van de post. De goedgekeurde formuleringen per land vindt u onder “Links & Materiaal”. Overtredingen kunnen leiden tot blokkering.",
            },
          ],
        },
      ],
    },
  ],
};
