import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Taken & Schoonmaak",
  description: "Schoonmaakschema's en teamtaken organiseren.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Bedrijf",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Taken aanmaken",
          excerpt: "Zo maakt u een nieuwe taak aan voor een object of een periode.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Taken bundelen alles wat er rond een object moet gebeuren — van de schoonmaak na het uitchecken tot onderhoudswerkzaamheden of gastverzoeken. Elke taak hangt aan precies één object en kan aan een teamlid worden toegewezen.",
            },
            { type: "h2", text: "Nieuwe taak aanmaken" },
            {
              type: "steps",
              items: [
                "Open het gedeelte “Taken” in het hoofdmenu.",
                "Klik op “Nieuwe taak”.",
                "Selecteer het betreffende object.",
                "Geef een titel op en eventueel een beschrijving.",
                "Stel de vervaldatum en het tijdstip in.",
                "Sla de taak op.",
              ],
            },
            { type: "h2", text: "Taaktypen" },
            {
              type: "p",
              text: "Naast vrije taken zijn er door het systeem gegenereerde taken, zoals automatisch geplande schoonmaakbeurten na een check-out. Deze zijn al gekoppeld aan het object en het bijbehorende tijdvenster en hoeven alleen nog aan een teamlid te worden toegewezen.",
            },
            {
              type: "ul",
              items: [
                "Handmatige taak: vrij ingevoerd, bijvoorbeeld onderhoud of speciaal verzoek.",
                "Automatische schoonmaaktaak: afgeleid van de check-outdatum.",
                "Terugkerende taak: voor regelmatige controles of inspecties.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Meer informatie over de automatische planning vindt u onder [Schoonmaakschema's](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Gebruik duidelijke titels — teamleden zien in de mobiele weergave vaak alleen de titel en het object in één oogopslag.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Schoonmaakschema's",
          excerpt: "Schoonmaakbeurten automatisch laten inplannen na het uitchecken.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Een schoonmaakschema zorgt ervoor dat er na elke check-out automatisch een schoonmaaktaak voor het betreffende object wordt aangemaakt — zonder dat u elke boeking afzonderlijk hoeft te volgen. Dit vermindert vergeten overdrachten en zorgt voor een betrouwbaar verloop tussen twee verblijven.",
            },
            { type: "h2", text: "Automatische planning activeren" },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het tabblad “Schoonmaak”.",
                "Schakel “Schoonmaak automatisch inplannen na check-out” in.",
                "Stel in hoeveel tijd er na de check-out voor de schoonmaak wordt ingepland.",
                "Bepaal eventueel een standaardteam of een standaardschoonmaker.",
                "Sla de instelling op.",
              ],
            },
            { type: "h2", text: "Samenspel met de kalender" },
            {
              type: "p",
              text: "Zodra een boeking wordt geannuleerd of verplaatst, past de bijbehorende schoonmaaktaak zich automatisch aan de nieuwe check-outdatum aan. Zo blijft het schoonmaakschema altijd synchroon met de werkelijke bezettingsstatus.",
            },
            {
              type: "ul",
              items: [
                "Schoonmaak wordt automatisch aangemaakt bij elke check-out met een actief schema.",
                "Verschuift de boeking, dan verschuift de schoonmaaktaak mee.",
                "Annuleert een gast het verblijf, dan wordt de schoonmaaktaak verwijderd.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder geactiveerd schoonmaakschema ontstaan er geen automatische taken — maak schoonmaakbeurten dan handmatig aan onder [Taken aanmaken](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Taken toewijzen",
          excerpt: "Taken gericht toewijzen aan schoonmakers of teamleden.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Om ervoor te zorgen dat een taak wordt uitgevoerd, wijst u deze toe aan een concreet teamlid — bijvoorbeeld een schoonmaker of een medewerker met onderhoudsverantwoordelijkheid. Standaard ziet alleen de toegewezen persoon de taak in zijn of haar eigen overzicht.",
            },
            { type: "h2", text: "Taak handmatig toewijzen" },
            {
              type: "steps",
              items: [
                "Open de taak in de lijst “Taken”.",
                "Klik op “Toewijzen”.",
                "Selecteer het verantwoordelijke teamlid uit de lijst.",
                "Bevestig de toewijzing.",
              ],
            },
            { type: "h2", text: "Toewijzing per object" },
            {
              type: "p",
              text: "Is een object al vast toegewezen aan een schoonmaker, dan kunt u taken voor dit object ook automatisch aan deze persoon laten toewijzen. Dat bespaart klikken bij terugkerende schoonmaakbeurten en vermindert vragen achteraf.",
            },
            {
              type: "ul",
              items: [
                "Handmatige toewijzing: u selecteert de persoon zelf per taak.",
                "Vaste objecttoewijzing: nieuwe taken voor dit object gaan automatisch naar de opgegeven persoon.",
                "Een taak heeft altijd precies één verantwoordelijke persoon.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Schoonmakers en medewerkers zien uitsluitend hun eigen toegewezen taken, geen financiële of verkoopgegevens van het object.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Taakstatus volgen",
          excerpt: "De voortgang van taken in realtime in de gaten houden.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Elke taak doorloopt een duidelijke status — van open via in behandeling tot afgerond. Zo ziet u altijd of een schoonmaakbeurt of onderhoud op tijd klaar is voor de volgende check-in.",
            },
            { type: "h2", text: "Statusoverzicht" },
            {
              type: "ul",
              items: [
                "Open: taak is aangemaakt, maar nog niet gestart.",
                "In behandeling: de toegewezen persoon is met de taak begonnen.",
                "Afgerond: de taak is uitgevoerd en bevestigd.",
              ],
            },
            { type: "h2", text: "Status bijwerken" },
            {
              type: "steps",
              items: [
                "Open de taak vanuit de lijst “Taken”.",
                "Selecteer de juiste status, bijvoorbeeld “In behandeling” of “Afgerond”.",
                "Voeg indien nodig een korte notitie toe, bijvoorbeeld over bijzonderheden in het object.",
                "Sla de wijziging op.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Statuswijzigingen verschijnen direct in de gedeelde takenlijst — handmatig herladen is niet nodig.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Staat een schoonmaakbeurt kort voor de volgende check-in nog open, controleer dan eerst de toewijzing voordat u contact opneemt met de gast.",
            },
          ],
        },
      ],
    },
  ],
};
