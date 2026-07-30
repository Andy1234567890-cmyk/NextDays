import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Team & bevoegdheden",
  description: "Medewerkers, rollen en toegangsrechten.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Toegang",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Medewerkers uitnodigen",
          excerpt: "Zo nodigt u nieuwe medewerkers uit voor uw myNextDays-account.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Voor uw bedrijf kunt u een willekeurig aantal medewerkers uitnodigen — bijvoorbeeld voor receptie, schoonmaak of beheer. Elke uitnodiging is gekoppeld aan een e-mailadres en kent direct een vaste rol toe, die de toegang op het web en in de myNextDays-app bepaalt.",
            },
            { type: "h2", text: "Uitnodiging versturen" },
            {
              type: "steps",
              items: [
                "Open “Account” en ga naar het onderdeel “Team”.",
                "Klik op “Medewerker uitnodigen”.",
                "Voer het e-mailadres van de persoon in.",
                "Kies de passende rol, bijvoorbeeld Medewerker of Schoonmaak.",
                "Bevestig de uitnodiging.",
              ],
            },
            { type: "h2", text: "Wat er daarna gebeurt" },
            {
              type: "p",
              text: "De uitgenodigde persoon ontvangt een e-mail met een link om een eigen wachtwoord in te stellen en in te loggen. De login geldt gelijk voor het webdashboard en de myNextDays-app — er is geen apart account per frontend.",
            },
            {
              type: "ul",
              items: [
                "Een uitnodiging blijft geldig totdat deze wordt geaccepteerd of ingetrokken.",
                "Openstaande uitnodigingen ziet u in het onderdeel “Team” met status “In behandeling”.",
                "De rol kan op elk moment achteraf worden aangepast.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Welke rol welke onderdelen mag zien, leest u onder [Rollen & bevoegdheden](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ken vanaf het begin de nauwst passende rol toe — rechten kunnen later altijd worden uitgebreid.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Rollen & bevoegdheden",
          excerpt: "De vijf rollen in myNextDays en wat zij elk mogen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays onderscheidt vijf rollen: beheerder, mede-beheerder, medewerker, schoonmaak en eigenaar. Elke rol bepaalt welke onderdelen zichtbaar zijn in het webdashboard en in de myNextDays-app — de rechten worden daarbij serverzijdig afgedwongen, niet alleen in de interface verborgen.",
            },
            { type: "h2", text: "De rollen in overzicht" },
            {
              type: "ul",
              items: [
                "Beheerder: volledige toegang tot alle onderdelen, inclusief financiën, verkoop en teambeheer.",
                "Mede-beheerder: bijna volledige toegang zoals beheerder, voor het tweede leidinggevende niveau van het bedrijf.",
                "Medewerker: operationele toegang tot boekingen, kalender en taken, zonder inzicht in financiën of verkoop.",
                "Schoonmaak: uitsluitend toegang tot toegewezen schoonmaaktaken en objectdetails, zonder inzicht in financiën of verkoop.",
                "Eigenaar: alleen-lezen inzicht in de eigen objecten, geen beheer van andermans objecten.",
              ],
            },
            { type: "h2", text: "Rol toewijzen of wijzigen" },
            {
              type: "steps",
              items: [
                "Open “Account” → “Team”.",
                "Selecteer de betreffende medewerker uit de lijst.",
                "Klik op “Rol wijzigen”.",
                "Kies de nieuwe rol en bevestig.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Medewerker en schoonmaak zien in beginsel geen prijzen, omzetten of boekingskanalen — deze uitsluiting geldt serverzijdig en kan niet via de interface worden omzeild.",
            },
            {
              type: "note",
              variant: "info",
              text: "Een overzicht per rol vindt u onder [Wat elke rol ziet](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Wat elke rol ziet",
          excerpt: "Concrete onderdelen en weergaven per rol op het web en in de app.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Naast de algemene rechten uit [Rollen & bevoegdheden](/hilfe/team-rollen/rollen-berechtigungen) helpt een concrete blik op afzonderlijke onderdelen om bij het onboarden van nieuwe medewerkers de juiste verwachting te scheppen.",
            },
            { type: "h2", text: "Kalender & boekingen" },
            {
              type: "p",
              text: "Beheerder, mede-beheerder en medewerker zien het volledige belegplan met gastgegevens en taken. Schoonmaak ziet alleen de aan haar toegewezen afspraken samen met objectadres en checklist, maar geen gastnamen of prijzen. Eigenaren zien de belegkalender uitsluitend voor hun eigen objecten, en alleen lezend.",
            },
            { type: "h2", text: "Financiën & verkoop" },
            {
              type: "ul",
              items: [
                "Omzetten, provisies en facturen: alleen beheerder en mede-beheerder.",
                "Portalen (OTA-koppeling) en platformzichtbaarheid: alleen beheerder en mede-beheerder.",
                "Medewerker en schoonmaak: geen toegang tot financiële of verkooponderdelen, ook niet tot detailpagina's.",
              ],
            },
            { type: "h2", text: "Team & instellingen" },
            {
              type: "p",
              text: "Het beheer van medewerkers, rollen en accountinstellingen blijft voorbehouden aan beheerder en mede-beheerder. Eigenaren en operationele rollen zien dit onderdeel in de myNextDays-app en in het webdashboard helemaal niet.",
            },
            {
              type: "note",
              variant: "info",
              text: "Deze indeling geldt identiek in het webdashboard en in de myNextDays-app, omdat beide frontends dezelfde rol uit uw account opvragen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Test nieuwe rollen na de uitnodiging kort samen met de medewerker om misverstanden over zichtbare onderdelen te voorkomen.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Toegang intrekken",
          excerpt: "Medewerkerstoegang direct en volledig verwijderen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Verlaat een medewerker uw bedrijf of verandert de samenwerking, verwijder dan de toegang direct in het account. Het intrekken werkt serverzijdig en onmiddellijk — niet pas na afloop van een bestaande sessie.",
            },
            { type: "h2", text: "Toegang verwijderen" },
            {
              type: "steps",
              items: [
                "Open “Account” → “Team”.",
                "Selecteer de betreffende medewerker.",
                "Klik op “Toegang intrekken”.",
                "Bevestig de handeling.",
              ],
            },
            { type: "h2", text: "Gevolg voor lopende sessies" },
            {
              type: "p",
              text: "Na het intrekken kan de persoon zich noch in het webdashboard noch in de myNextDays-app opnieuw aanmelden. Reeds toegewezen taken of schoonmaakafspraken moet u vooraf aan een andere medewerker toewijzen, zodat niets onbehandeld blijft.",
            },
            {
              type: "ul",
              items: [
                "Wijs openstaande taken vóór het intrekken opnieuw toe.",
                "Toegang kan later opnieuw worden hersteld via een uitnodiging.",
                "Het intrekken betreft alleen dit bedrijf, niet andere accounts van de persoon.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Trek de toegang tijdig in zodra een samenwerking eindigt — openstaande medewerkersaccounts blijven anders een onnodig veiligheidsrisico.",
            },
          ],
        },
      ],
    },
  ],
};
