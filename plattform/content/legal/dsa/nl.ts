import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Digitaledienstenverordening",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "myBestDays is een tussenhandelsdienst en een onlineplatform in de zin van Verordening (EU) 2022/2065 betreffende een eengemaakte markt voor digitale diensten (de digitaledienstenverordening, DSA). Deze pagina bundelt de vermeldingen en procedures die die verordening verlangt.",
    "myBestDays is geen zeer groot onlineplatform in de zin van artikel 33 van de verordening. De daarvoor geldende aanvullende verplichtingen — het in kaart brengen van systeemrisico's, onafhankelijke audit, advertentiearchief en publicatie van het maandelijkse gebruikersaantal volgens de daar voorziene procedure — treffen ons daarom niet.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Contactpunten (artikelen 11 en 12)",
      paragraphs: [
        `Centraal contactpunt voor instanties van de lidstaten, de Commissie en de Europese Raad voor digitale diensten: ${ANBIETER.email}, per post ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denemarken.`,
        `Centraal contactpunt voor gebruikers: ${ANBIETER.email}. U bereikt ons daar rechtstreeks en zonder geautomatiseerde voorschakeling.`,
        "Met beide contactpunten kan in het Duits, Deens en Engels worden gecommuniceerd.",
        "Een wettelijke vertegenwoordiger in de Unie op grond van artikel 13 hoeft niet te worden aangewezen: de exploitant is in Denemarken en daarmee in de Unie gevestigd.",
        `Bevoegde coördinator voor digitale diensten op grond van artikel 49: ${DSA_KOORDINATOR.name}, Denemarken ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Onrechtmatige inhoud melden (artikel 16)",
      paragraphs: [
        "Iedereen kan bij ons inhoud melden die hij onrechtmatig acht. Gebruik daarvoor de meldfunctie die bij elke advertentie, elke beoordeling en elk bericht beschikbaar is, of het contactpunt voor gebruikers.",
        "Om een melding zonder diepgaand juridisch onderzoek te kunnen beoordelen, zou zij moeten bevatten:",
      ],
      list: [
        "een voldoende onderbouwde toelichting waarom de inhoud onrechtmatig is;",
        "de exacte elektronische locatie, met name de URL;",
        "naam en e-mailadres van de melder — behalve bij meldingen over strafbare feiten tegen de seksuele zelfbeschikking van kinderen, waar die opgave vrijwillig is;",
        "de verklaring dat de gegevens naar beste weten juist en volledig zijn.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hoe wij meldingen behandelen",
      paragraphs: [
        "Wij bevestigen de ontvangst onverwijld en beslissen tijdig, zorgvuldig, niet-willekeurig en objectief.",
        "Bevat een melding de gegevens uit onderdeel 2, dan geeft zij ons kennis in de zin van artikel 6 van de verordening.",
        "Over onze beslissing informeren wij de melder en wijzen wij op de rechtsmiddelen.",
        "Bij geautomatiseerde behandeling delen wij dat mee.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivering van maatregelen (artikel 17)",
      paragraphs: [
        "Beperken wij de zichtbaarheid van inhoud, verwijderen wij die, blokkeren wij de toegang ertoe, schorten wij betalingen op, blokkeren wij de dienstverlening of het account, dan ontvangt de betrokkene een duidelijke en specifieke motivering.",
        "De motivering vermeldt aard en omvang van de maatregel, de territoriale en temporele reikwijdte, de feiten en omstandigheden van de beslissing, of geautomatiseerde verwerking betrokken was, de rechtsgrondslag of de geschonden contractsbepaling en de beschikbare rechtsmiddelen.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Vermoeden van strafbare feiten (artikel 18)",
      paragraphs: [
        "Bestaan er aanwijzingen voor een strafbaar feit dat een gevaar oplevert voor het leven of de veiligheid van een persoon, dan informeren wij onverwijld de bevoegde opsporings- of rechterlijke instanties.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Interne klachtenprocedure (artikel 20)",
      paragraphs: [
        "Tegen elke maatregel op grond van onderdeel 4 en tegen de afwijzing van een melding kan binnen zes maanden kosteloos worden geklaagd.",
        "Klachten worden tijdig, niet-discriminerend en zorgvuldig behandeld — onder toezicht van gekwalificeerde personen en niet uitsluitend met geautomatiseerde middelen.",
        "Blijkt een klacht gegrond, dan trekken wij de maatregel in. De weg beschrijft [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Buitengerechtelijke geschillenbeslechting (artikel 21)",
      paragraphs: [
        "Voor geschillen over maatregelen op grond van onderdeel 4 kunnen gebruikers zich wenden tot een door de bevoegde coördinator voor digitale diensten gecertificeerde buitengerechtelijke geschillenbeslechtingsinstantie. De Europese Commissie houdt de lijst van gecertificeerde instanties bij.",
        "De beslissingen van die instanties zijn voor ons niet bindend; tot deelname aan procedures van onafhankelijke aanbieders zijn wij niet verplicht. De gang naar de rechter blijft onaangetast.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Betrouwbare flaggers (artikel 22)",
      paragraphs: [
        "Meldingen die door een als betrouwbare flagger erkende melder binnen diens vakgebied worden ingediend, behandelen wij met voorrang.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Maatregelen tegen misbruik (artikel 23)",
      paragraphs: [
        "Accounts waarmee vaak kennelijk onrechtmatige inhoud wordt aangeboden, blokkeren wij na voorafgaande waarschuwing voor een redelijke periode.",
        "De behandeling van meldingen en klachten schorten wij op voor personen die vaak kennelijk ongegronde meldingen of klachten indienen — eveneens na voorafgaande waarschuwing.",
        "Wij beoordelen daarbij steeds het individuele geval: aantal, aandeel en ernst van de betrokken gevallen alsmede het oogmerk.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Transparantieverslagen (artikelen 15 en 24)",
      paragraphs: [
        "Wij publiceren jaarlijks een verslag over inhoudsmoderatie: het aantal bevelen van instanties, het aantal en de aard van meldingen, de genomen maatregelen, het aantal klachten en de uitkomst daarvan, gegevens over de inzet van geautomatiseerde middelen alsmede het aantal geschillen voor buitengerechtelijke instanties.",
        `Micro- en kleine ondernemingen zijn op grond van artikel 19 van de verordening van een deel van deze verplichtingen vrijgesteld. Zolang de vrijstelling geldt, stellen wij de gegevens op verzoek beschikbaar via ${ANBIETER.email}; zodra het eerste verslag is gepubliceerd, wordt het hier gelinkt.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Traceerbaarheid van handelaren (artikelen 30 tot en met 32)",
      paragraphs: [
        "Aanbieders die op het platform bedrijfsmatig handelen, mogen pas aanbieden wanneer zij ons naam, adres, telefoonnummer, e-mailadres, registergegevens, btw-identificatienummer en betaalrekening hebben verstrekt en hun gegevens plausibel zijn.",
        "Die gegevens tonen wij in de advertentie voor zover de verordening dat voorschrijft.",
        "Vernemen wij dat een advertentie een onrechtmatig product of een onrechtmatige dienst betrof, dan informeren wij de betrokken gasten, voor zover wij hun contactgegevens hebben.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Aanbevelingssystemen (artikel 27)",
      paragraphs: [
        "De belangrijkste parameters van de volgorde van zoekresultaten en van aanbevelingen alsmede de mogelijkheid die te beïnvloeden, zijn beschreven onder [Prijzen, rangschikking en aanbevelingen](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reclame (artikel 26)",
      paragraphs: [
        "Wij tonen momenteel geen betaalde reclame van derden en geen betaalde plaatsingen in de zoekresultaten.",
        "Mochten wij reclame invoeren, dan merken wij die duidelijk aan, noemen wij de adverteerder en de belangrijkste parameters van de uitlevering. Reclame op basis van bijzondere categorieën persoonsgegevens op grond van artikel 9 van Verordening (EU) 2016/679 en reclame aan minderjarigen op basis van profilering sluiten wij uit.",
      ],
    },
  ],
};
