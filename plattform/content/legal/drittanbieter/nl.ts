import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Derden en betaaldiensten",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "myBestDays zet voor de exploitatie van het platform diensten van derden in. Deze pagina noemt ze en legt uit welke rol zij hebben en wiens voorwaarden telkens gelden.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Uitgangspunt",
      paragraphs: [
        "Waar een derde een dienst rechtstreeks aan u verricht, gelden diens voorwaarden en privacyverklaring naast de onze. Wij wijzen daarop op de betreffende plaats.",
        "Waar een derde uitsluitend in onze opdracht verwerkt, blijven wij uw aanspreekpunt. Welke verwerkers wij inzetten, staat in de [Privacyverklaring](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Betaaldienstverlener",
      paragraphs: [
        "Betalingen via het platform wikkelt Stripe af. Stripe verzamelt en verwerkt betaalgegevens rechtstreeks en is daarvoor zelfstandig verwerkingsverantwoordelijke. Aanvullend geldt de [privacyverklaring van Stripe](https://stripe.com/privacy).",
        "Voor de uitbetaling aan hosts voert Stripe de wettelijk voorgeschreven identiteitscontrole uit.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Betaaldienstenrichtlijn en toegang door derden",
      paragraphs: [
        "Richtlijn (EU) 2015/2366 („PSD2“) vereist voor veel betalingen sterke cliëntauthenticatie. Uw bank of kaartuitgever voert die uit; zonder geslaagde authenticatie kan een betaling worden geweigerd.",
        "myBestDays is geen betalingsinitiatie- of rekeninginformatiedienst en heeft geen toegang tot uw bankrekeningen.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Kaarten, afbeeldingen en ingesloten inhoud",
      paragraphs: [
        "Voor kaartweergaven en locatiegegevens sluiten wij kaartdiensten van derden in. Bij het laden van dergelijke inhoud kunnen gegevens naar de betreffende aanbieder worden verzonden; bijzonderheden en de toestemmingsinstelling staan in het [Cookiebeleid](https://mybestdays.dk/rechtliches/cookies).",
        "Afbeeldingen en beschrijvingen in advertenties komen van de betreffende aanbieder, niet van ons.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Gelinkte sites",
      paragraphs: [
        "Het platform kan naar sites van derden linken. Op de inhoud daarvan hebben wij geen invloed en daarvoor aanvaarden wij geen verantwoordelijkheid. Krijgen wij kennis van een rechtsinbreuk, dan verwijderen wij de link onverwijld.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. App-stores",
      paragraphs: [
        "Betrekt u de myBestDays-app via een app-store, dan gelden aanvullend de voorwaarden van de betreffende storebeheerder. De storebeheerder is geen partij bij de overeenkomst tussen u en ons en is noch support noch garantie voor de app verschuldigd.",
      ],
    },
  ],
};
