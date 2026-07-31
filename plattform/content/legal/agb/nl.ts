import type { LegalDoc } from "../types";

// Niederländische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort. Zielgruppe sind Verbraucher (Gäste).
export const agb: LegalDoc = {
  title: "Gebruiksvoorwaarden voor gasten (algemene voorwaarden)",
  stand: "Laatst bijgewerkt: 3 juli 2026",
  intro: [
    "Deze gebruiksvoorwaarden regelen het gebruik van het boekingsportaal myBestDays (hierna “Platform”) door reizigers en boekers (hierna “Gast”).",
    "Het Platform wordt geëxploiteerd door [volledige bedrijfsnaam, rechtsvorm, adres en registergegevens van de exploitant — vóór publicatie aanvullen] (hierna “myBestDays” of “wij”).",
  ],
  sections: [
    {
      heading: "§ 1 Toepassingsgebied",
      paragraphs: [
        "Deze voorwaarden gelden voor het gebruik van het Platform, in het bijzonder voor het zoeken naar accommodaties en het boeken van logiesdiensten via het Platform.",
        "Voor de logiesdienst zelf gelden aanvullend de voorwaarden van de betreffende aanbieder (bijv. huisregels, annuleringsvoorwaarden) die in de aanbieding zijn vermeld.",
      ],
    },
    {
      heading: "§ 2 Rol van myBestDays; totstandkoming van de overeenkomst",
      paragraphs: [
        "myBestDays bemiddelt bij logiesdiensten die door de betreffende aanbieders (agentschappen, verhuurders of eigenaren, hierna “Aanbieder”) worden aangeboden. De overeenkomst over de accommodatie komt uitsluitend tot stand tussen de Gast en de betreffende Aanbieder. myBestDays wordt geen partij bij de logiesovereenkomst.",
        "De betreffende Aanbieder wordt in de aanbieding en in de boekingsbevestiging genoemd.",
      ],
    },
    {
      heading: "§ 3 Boeking en boekingsbevestiging",
      paragraphs: [
        "De weergave van de accommodaties op het Platform is een uitnodiging tot het doen van een boekingsaanbod. Met het afronden van het boekingsproces (klik op de tot betaling verplichtende boekingsknop) doet de Gast een bindend aanbod tot het sluiten van een logiesovereenkomst met de Aanbieder.",
        "De overeenkomst komt tot stand wanneer de boeking wordt bevestigd. De boekingsbevestiging wordt aan de Gast verzonden op het opgegeven e-mailadres.",
        "De Gast is verplicht bij de boeking juiste en volledige gegevens te verstrekken (in het bijzonder naam, contactgegevens en het aantal reizigers).",
      ],
    },
    {
      heading: "§ 4 Prijzen en betaling",
      paragraphs: [
        "Er gelden de prijzen die op het moment van de boeking in de aanbieding zijn vermeld, inclusief de daar vermelde belastingen, kosten en bijkomende kosten. Prijzen worden weergegeven in de valuta die in de aanbieding is vermeld. Ter plaatse kunnen aanvullende lokale heffingen (bijv. toeristenbelasting) verschuldigd zijn, voor zover dit in de aanbieding is vermeld.",
        "De betaling wordt afgewikkeld via de betaaldienstverlener Stripe. Betaalgegevens (bijv. kaartgegevens) worden rechtstreeks door Stripe verzameld en verwerkt; myBestDays slaat geen volledige kaartgegevens op. Stripe verwerkt persoonsgegevens overeenkomstig de [privacyverklaring van Stripe](https://stripe.com/privacy).",
        "Voor zover in de aanbieding een borgsom is vermeld, kan deze bij de boeking of bij aankomst vooraf worden geautoriseerd en bij schade geheel of gedeeltelijk worden ingehouden; bepalend zijn de gegevens in de aanbieding.",
      ],
    },
    {
      heading: "§ 5 Annulering, omboeking en herroeping",
      paragraphs: [
        "Of en onder welke voorwaarden een boeking kosteloos kan worden geannuleerd of gewijzigd, wordt bepaald door de in de aanbieding vermelde annuleringsvoorwaarden van de Aanbieder.",
        "Voor logiesdiensten die voor een bepaalde periode worden geboekt, bestaat op grond van artikel 16, onder l), van de EU-richtlijn consumentenrechten respectievelijk de overeenkomstige nationale bepalingen in de regel geen wettelijk herroepingsrecht. Dwingende wettelijke rechten van de Gast blijven onverlet.",
      ],
    },
    {
      heading: "§ 6 Verplichtingen van de Gast",
      paragraphs: [
        "De Gast gebruikt de accommodatie conform de overeenkomst, houdt zich aan de in de aanbieding vermelde maximale bezetting en neemt de huisregels van de Aanbieder in acht.",
        "Het Platform mag niet worden misbruikt, in het bijzonder niet voor schijnboekingen, frauduleuze betalingen of het plaatsen van onrechtmatige content (bijv. in beoordelingen of berichten).",
      ],
    },
    {
      heading: "§ 7 Aansprakelijkheid van myBestDays",
      paragraphs: [
        "Voor het verlenen van de logiesdienst is uitsluitend de Aanbieder verantwoordelijk. myBestDays is niet aansprakelijk voor de juistheid van de door Aanbieders geplaatste aanbiedingsinhoud, maar verzorgt de bemiddeling en de betalingsverwerking met de zorgvuldigheid van een goed ondernemer.",
        "myBestDays is onbeperkt aansprakelijk voor opzet en grove nalatigheid alsmede voor schade als gevolg van letsel aan leven, lichaam of gezondheid. Bij lichte nalatigheid is myBestDays alleen aansprakelijk voor de schending van wezenlijke contractuele verplichtingen (kardinale verplichtingen), beperkt tot de voor de overeenkomst typische, voorzienbare schade. Dwingende wettelijke aansprakelijkheidsregels blijven onverlet.",
      ],
    },
    {
      heading: "§ 8 Gegevensbescherming",
      paragraphs: [
        "myBestDays verwerkt persoonsgegevens van de Gast voor de uitvoering van de bemiddeling en de boeking. Boekingsgegevens worden aan de betreffende Aanbieder doorgegeven voor zover dit voor de uitvoering van de logiesovereenkomst noodzakelijk is. Voor de betalingsverwerking geldt § 4.",
        "Details blijken uit de privacy-informatie van het Platform.",
      ],
    },
    {
      heading: "§ 9 Klachten en geschillenbeslechting",
      paragraphs: [
        "Klachten over de accommodatie richt de Gast eerst aan de Aanbieder; bij vragen over de boeking of de betaling helpt de support van myBestDays via de op het Platform vermelde contactkanalen.",
        "myBestDays is niet verplicht en niet bereid deel te nemen aan geschillenbeslechtingsprocedures voor een geschillencommissie voor consumentenzaken, voor zover er geen wettelijke verplichting bestaat.",
      ],
    },
    {
      heading: "§ 10 Wijzigingen van deze voorwaarden",
      paragraphs: [
        "myBestDays kan deze voorwaarden met werking voor de toekomst wijzigen, voor zover dit om gegronde redenen noodzakelijk is (in het bijzonder wetswijzigingen of wijzigingen in de rechtspraak) en de Gast daardoor niet onredelijk wordt benadeeld. Voor reeds gesloten boekingen geldt de versie die op het moment van de boeking van kracht was.",
      ],
    },
    {
      heading: "§ 11 Slotbepalingen",
      paragraphs: [
        "Het recht van de staat waarin de exploitant haar zetel heeft is van toepassing, met uitsluiting van het Weens Koopverdrag. Is de Gast consument, dan blijven de dwingende consumentenbeschermingsbepalingen van de staat waarin hij zijn gewone verblijfplaats heeft onverlet.",
        "Indien afzonderlijke bepalingen van deze voorwaarden ongeldig zijn of worden, blijft de geldigheid van de overige bepalingen onverlet.",
      ],
    },
  ],
};
