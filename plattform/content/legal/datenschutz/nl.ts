import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Privacyverklaring",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Deze verklaring beschrijft welke persoonsgegevens myBestDays verwerkt, voor welke doeleinden, op welke rechtsgrondslag en welke rechten u hebt. Zij geldt voor de website, de mobiele applicaties en alle overige toegangen tot het platform.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Verwerkingsverantwoordelijke en functionaris voor gegevensbescherming",
      paragraphs: [
        `Verwerkingsverantwoordelijke in de zin van Verordening (EU) 2016/679 (AVG) is ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denemarken, CVR-nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. De volledige aanbiedergegevens staan in het [Colofon](https://mybestdays.dk/rechtliches/impressum).`,
        "Er is geen functionaris voor gegevensbescherming aangewezen; aan de voorwaarden van artikel 37 AVG is niet voldaan. Vragen over gegevensbescherming richt u aan het hierboven genoemde e-mailadres.",
        "Aanbieders bij wie u boekt, zijn voor de gegevens die zij van ons ontvangen zelfstandig verwerkingsverantwoordelijke. Voor hen gelden de [Privacynormen voor hosts](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Welke gegevens wij verwerken",
      paragraphs: ["Afhankelijk van hoe u het platform gebruikt, verwerken wij:"],
      list: [
        "stamgegevens — naam, e-mailadres, telefoonnummer, taal en valuta, wachtwoord in versleutelde vorm;",
        "boekingsgegevens — geboekte accommodatie, periode, aantal en namen van reizigers, bijzondere wensen, boekingsstatus;",
        "betaalgegevens — bedrag, valuta, betaalstatus, de laatste cijfers van het betaalmiddel alsmede het transactiekenmerk van onze betaaldienstverlener. Volledige kaartgegevens bereiken ons niet;",
        "communicatiegegevens — berichten tussen u en de aanbieder, vragen aan onze klantenservice, klachten;",
        "inhoudsgegevens — beoordelingen, foto's, verlanglijstjes;",
        "gebruiksgegevens — bezochte pagina's, zoekopdrachten, tijdstip van toegang;",
        "technische gegevens — IP-adres, browser- en apparaatkenmerken, besturingssysteem, referrer.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Doeleinden en rechtsgrondslagen",
      paragraphs: [
        "Terbeschikkingstelling van het platform, account, zoeken, boeken, betalingsafwikkeling en communicatie met de aanbieder — artikel 6, lid 1, onder b), AVG (overeenkomst of precontractuele maatregel).",
        "Klantenservice, klachtafhandeling en geschillenbeslechting — artikel 6, lid 1, onder b) en f), AVG.",
        "Opsporen en voorkomen van fraude, misbruik en beveiligingsincidenten, handhaving van onze voorwaarden — artikel 6, lid 1, onder f), AVG (gerechtvaardigd belang bij een veilige marktplaats).",
        "Beoordelingen en de publicatie daarvan — artikel 6, lid 1, onder b) en f), AVG.",
        "Nakoming van wettelijke verplichtingen, met name handels- en fiscale bewaarplichten, de meldplicht op grond van Richtlijn (EU) 2021/514 (DAC7) en de verplichtingen uit Verordening (EU) 2022/2065 — artikel 6, lid 1, onder c), AVG.",
        "Verbetering van het platform door analyse van geaggregeerde gebruiksgegevens — artikel 6, lid 1, onder f), AVG.",
        "Reclame-e-mails en niet-noodzakelijke cookies — artikel 6, lid 1, onder a), AVG (toestemming), die u te allen tijde met werking voor de toekomst kunt intrekken.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Ontvangers",
      paragraphs: [
        "Aanbieders ontvangen de gegevens die zij nodig hebben om uw boeking uit te voeren en hun wettelijke verplichtingen na te komen — met name naam, contactgegevens, periode, aantal reizigers en uw berichten aan hen.",
        "Onze betaaldienstverlener Stripe verwerkt betaalgegevens als zelfstandig verwerkingsverantwoordelijke; aanvullend geldt de [privacyverklaring van Stripe](https://stripe.com/privacy).",
        "Dienstverleners die voor ons hosting, databasebeheer, e-mailverzending, foutdiagnose en klantenservicetools verzorgen, verwerken gegevens uitsluitend volgens instructie op grond van een overeenkomst als bedoeld in artikel 28 AVG.",
        "Instanties en rechterlijke autoriteiten ontvangen alleen gegevens voor zover wij daartoe verplicht zijn; zie [Richtlijnen voor verzoeken van instanties en opsporingsdiensten](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Belastingautoriteiten ontvangen de op grond van DAC7 te melden gegevens over aanbieders.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Doorgifte naar derde landen",
      paragraphs: [
        "Onze servers en die van onze verwerkers staan in de Europese Unie.",
        "Voor zover in een individueel geval verwerking buiten de Europese Economische Ruimte plaatsvindt, gebeurt dat alleen op basis van een adequaatheidsbesluit van de Europese Commissie of de modelcontractbepalingen op grond van artikel 46, lid 2, onder c), AVG met aanvullende beschermingsmaatregelen.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Bewaartermijnen",
      paragraphs: [
        "Accountgegevens bewaren wij zolang uw account bestaat en verwijderen wij daarna, tenzij een bewaarplicht zich daartegen verzet.",
        "Boekings- en betaalgegevens vallen onder handels- en fiscale bewaartermijnen; naar Deens boekhoudrecht bedragen die in de regel vijf jaar na afloop van het boekjaar waarop de gegevens betrekking hebben.",
        "Berichten over een boeking bewaren wij tot drie jaar na afloop van het verblijf, zodat geschillen kunnen worden opgehelderd.",
        "Beoordelingen blijven na verwijdering van uw account in geanonimiseerde vorm bestaan, omdat zij deel uitmaken van de beoordelingsgrondslag van een accommodatie.",
        "Gegevens over fraude- en misbruikzaken bewaren wij zolang dat nodig is om verdere schendingen af te wenden, maar ten hoogste drie jaar na het laatste voorval.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Uw rechten",
      paragraphs: ["Op grond van de AVG hebt u de volgende rechten:"],
      list: [
        "inzage in de over u opgeslagen gegevens (artikel 15);",
        "rectificatie van onjuiste gegevens (artikel 16);",
        "wissing (artikel 17), tenzij een bewaarplicht zich daartegen verzet;",
        "beperking van de verwerking (artikel 18);",
        "overdraagbaarheid van gegevens (artikel 20);",
        "bezwaar tegen een verwerking op grond van gerechtvaardigde belangen (artikel 21), met name tegen direct marketing;",
        "intrekking van een gegeven toestemming met werking voor de toekomst (artikel 7, lid 3);",
        `klacht bij een toezichthoudende autoriteit (artikel 77) — bevoegd is de autoriteit van uw woonplaats, uw werkplek of de plaats van de vermeende inbreuk. Op de vestigingsplaats van de verwerkingsverantwoordelijke is dat ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Denemarken, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Hoe u uw rechten uitoefent",
      paragraphs: [
        `Veel gegevens kunt u rechtstreeks in uw account inzien, wijzigen of verwijderen. Voor al het overige wendt u zich tot ${ANBIETER.email}.`,
        "Wij antwoorden onverwijld, uiterlijk binnen één maand. Kunnen wij die termijn niet halen, dan delen wij u dat met een motivering mee.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Geautomatiseerde besluiten",
      paragraphs: [
        "Wij zetten geautomatiseerde procedures in om fraude, misbruik en onrechtmatige inhoud op te sporen. Leidt zo'n procedure tot een maatregel tegen uw account of uw inhoud, dan motiveren wij die en kunt u een toetsing door een mens verlangen.",
        "Een uitsluitend op geautomatiseerde verwerking gebaseerd besluit met rechtsgevolg in de zin van artikel 22 AVG nemen wij niet.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Verplichting tot verstrekking",
      paragraphs: [
        "De voor een boeking vereiste gegevens moet u verstrekken; zonder die gegevens kan geen overeenkomst worden gesloten en kan de accommodatie niet ter beschikking worden gesteld. Alle overige gegevens zijn vrijwillig.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Wijzigingen van deze verklaring",
      paragraphs: [
        "Wij passen deze verklaring aan wanneer de verwerking of de wetgeving verandert. De telkens geldende versie is hier te raadplegen; de datum van bijwerking staat bovenaan.",
      ],
    },
  ],
};
