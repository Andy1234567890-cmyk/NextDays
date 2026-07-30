import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Team & tilladelser",
  description: "Medarbejdere, roller og adgangsrettigheder.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Adgang",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Inviter medarbejdere",
          excerpt: "Sådan inviterer du nye medarbejdere til din myNextDays-konto.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Til din virksomhed kan du invitere så mange medarbejdere, du vil — for eksempel til reception, rengøring eller administration. Hver invitation er knyttet til en e-mailadresse og tildeler med det samme en fast rolle, der bestemmer adgangen på nettet og i myNextDays-appen.",
            },
            { type: "h2", text: "Send en invitation" },
            {
              type: "steps",
              items: [
                "Åbn »Konto« og skift til afsnittet »Team«.",
                "Klik på »Inviter medarbejder«.",
                "Indtast personens e-mailadresse.",
                "Vælg den passende rolle, f.eks. medarbejder eller rengøring.",
                "Bekræft invitationen.",
              ],
            },
            { type: "h2", text: "Hvad der sker derefter" },
            {
              type: "p",
              text: "Den inviterede person modtager en e-mail med et link til at oprette sin egen adgangskode og logge ind. Login gælder både for web-dashboardet og myNextDays-appen — der findes ikke en separat konto per frontend.",
            },
            {
              type: "ul",
              items: [
                "En invitation er gyldig, indtil den accepteres eller trækkes tilbage.",
                "Åbne invitationer ser du i afsnittet »Team« med status »Afventer«.",
                "Rollen kan altid justeres senere.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hvilken rolle der må se hvilke områder, kan du læse om under [Roller & tilladelser](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tildel den snævreste passende rolle fra starten — rettigheder kan altid udvides senere.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Roller & tilladelser",
          excerpt: "De fem roller i myNextDays, og hvad de hver især må.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays skelner mellem fem roller: admin, co-admin, medarbejder, rengøring og ejer. Hver rolle bestemmer, hvilke områder der er synlige i web-dashboardet og i myNextDays-appen — rettighederne håndhæves serverside og skjules ikke kun i brugerfladen.",
            },
            { type: "h2", text: "Rollerne i overblik" },
            {
              type: "ul",
              items: [
                "Admin: fuld adgang til alle områder, inklusive økonomi, salg og teamstyring.",
                "Co-admin: næsten fuld adgang som admin, til virksomhedens andet ledelsesniveau.",
                "Medarbejder: operativ adgang til reservationer, kalender og opgaver, uden indblik i økonomi eller salg.",
                "Rengøring: udelukkende adgang til tildelte rengøringsopgaver og boligdetaljer, uden indblik i økonomi eller salg.",
                "Ejer: skrivebeskyttet indblik i egne boliger, ingen administration af andres boliger.",
              ],
            },
            { type: "h2", text: "Tildel eller ændr rolle" },
            {
              type: "steps",
              items: [
                "Åbn »Konto« → »Team«.",
                "Vælg den pågældende medarbejder fra listen.",
                "Klik på »Skift rolle«.",
                "Vælg den nye rolle, og bekræft.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Medarbejder og rengøring ser som udgangspunkt aldrig priser, omsætning eller bookingkanaler — denne udelukkelse gælder serverside og kan ikke omgås via brugerfladen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Et overblik pr. rolle finder du under [Hvad hver rolle ser](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Hvad hver rolle ser",
          excerpt: "Konkrete områder og visninger pr. rolle på nettet og i appen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Ud over de grundlæggende rettigheder fra [Roller & tilladelser](/hilfe/team-rollen/rollen-berechtigungen) hjælper et konkret blik på enkelte områder dig med at sætte de rigtige forventninger, når du onboarder nye medarbejdere.",
            },
            { type: "h2", text: "Kalender & reservationer" },
            {
              type: "p",
              text: "Admin, co-admin og medarbejder ser den fulde belægningsplan med gæstedata og opgaver. Rengøring ser kun de tildelte tidspunkter med boligadresse og tjekliste, men ikke gæstenavne eller priser. Ejere ser belægningskalenderen udelukkende for egne boliger, rent læsende.",
            },
            { type: "h2", text: "Økonomi & salg" },
            {
              type: "ul",
              items: [
                "Omsætning, provisioner og fakturaer: kun admin og co-admin.",
                "Portaler (OTA-tilslutning) og synlighed på Platform: kun admin og co-admin.",
                "Medarbejder og rengøring: ingen adgang til økonomi- eller salgsområder, heller ikke til detaljesider.",
              ],
            },
            { type: "h2", text: "Team & indstillinger" },
            {
              type: "p",
              text: "Administration af medarbejdere, roller og kontoindstillinger er forbeholdt admin og co-admin. Ejere og operative roller ser slet ikke dette område hverken i myNextDays-appen eller i web-dashboardet.",
            },
            {
              type: "note",
              variant: "info",
              text: "Denne opdeling gælder identisk i web-dashboardet og i myNextDays-appen, da begge frontends henter den samme rolle fra din konto.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Test nye roller kort sammen med medarbejderen efter invitationen for at undgå misforståelser om synlige områder.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Fjern adgang",
          excerpt: "Fjern medarbejderadgang øjeblikkeligt og fuldstændigt.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Forlader en medarbejder din virksomhed, eller ændrer samarbejdet sig, fjerner du adgangen direkte i kontoen. Fjernelsen virker serverside og med det samme — ikke først når en eksisterende session udløber.",
            },
            { type: "h2", text: "Fjern adgang" },
            {
              type: "steps",
              items: [
                "Åbn »Konto« → »Team«.",
                "Vælg den pågældende medarbejder.",
                "Klik på »Fjern adgang«.",
                "Bekræft handlingen.",
              ],
            },
            { type: "h2", text: "Konsekvens for igangværende sessioner" },
            {
              type: "p",
              text: "Efter fjernelsen kan personen hverken logge ind igen i web-dashboardet eller i myNextDays-appen. Allerede tildelte opgaver eller rengøringstidspunkter bør du på forhånd tildele en anden medarbejder, så intet forbliver ubehandlet.",
            },
            {
              type: "ul",
              items: [
                "Tildel åbne opgaver på ny før fjernelsen.",
                "Adgang kan senere genoprettes via en ny invitation.",
                "Fjernelsen påvirker kun denne virksomhed, ikke personens andre konti.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Fjern adgangen hurtigt, så snart et samarbejde ophører — åbne medarbejderkonti er ellers en unødvendig sikkerhedsrisiko.",
            },
          ],
        },
      ],
    },
  ],
};
