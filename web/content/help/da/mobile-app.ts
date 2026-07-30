import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilapp",
  description: "myNextDays-appen til når du er på farten.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays-appen",
          excerpt: "Én konto, fire oplevelser: gæst, bureau, owner og medarbejder.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-appen er den mobile platform til hele din virksomhed. Det er ikke et separat produkt, men et ligeværdigt frontend til dit web-dashboard — begge tilgår den samme konto og de samme data, kun brugerfladen er optimeret til brug på farten.",
            },
            { type: "h2", text: "Fire oplevelser i én app" },
            {
              type: "ul",
              items: [
                "Gæst: se reservationer, kommunikere med virksomheden, hente check-in-oplysninger.",
                "Bureau: administrere flere virksomheder og boliger i overblik.",
                "Owner: skrivebeskyttet indblik i egne boliger, belægning og rapporter.",
                "Medarbejder: kalender, opgaver og rengøringsplaner til den daglige drift.",
              ],
            },
            { type: "h2", text: "Hvilken oplevelse du ser" },
            {
              type: "p",
              text: "Efter login viser appen automatisk den passende oplevelse for din rolle — den samme rolle, som også gælder i web-dashboardet. En medarbejder med begrænsede rettigheder ser i appen præcis de samme begrænsninger som i browseren, da tilladelsen kontrolleres serverside.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mere om roller, og hvad de hver især må se, finder du under [Roller & tilladelser](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Du behøver ikke en separat registrering til appen — log blot ind med dine eksisterende myNextDays-oplysninger.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Installér app & log ind",
          excerpt: "Sådan downloader du myNextDays-appen og logger ind.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-appen fås til iOS og Android. Login foregår med de samme oplysninger som i web-dashboardet — der kræves hverken en separat konto eller ny registrering.",
            },
            { type: "h2", text: "Installation" },
            {
              type: "steps",
              items: [
                "Åbn App Store (iOS) eller Google Play (Android).",
                "Søg efter »myNextDays«.",
                "Installér appen på din smartphone eller tablet.",
                "Åbn appen efter installationen.",
              ],
            },
            { type: "h2", text: "Login" },
            {
              type: "steps",
              items: [
                "Tryk på »Log ind«.",
                "Indtast din e-mailadresse og adgangskode.",
                "Bekræft eventuelt tofaktorforespørgslen.",
                "Du kommer automatisk til den oplevelse, der passer til din rolle.",
              ],
            },
            {
              type: "ul",
              items: [
                "Loginoplysningerne er identiske med web-dashboardet.",
                "Er din adgang blevet fjernet, er login i appen også øjeblikkeligt spærret.",
                "Ved problemer med adgangskoden bruger du »Glemt adgangskode« direkte i appen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Log kun ind via den officielle app-store-post »myNextDays«; appen spørger aldrig efter loginoplysninger uden for login-skærmen.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Administrer på farten",
          excerpt: "Behandl reservationer, beskeder og opgaver direkte fra smartphonen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-appen egner sig særligt til den løbende drift på farten: Du ser aktuelle reservationer, besvarer gæstebeskeder og udfører opgaver uden at skulle sidde ved computeren — ændringer vises i realtid også i web-dashboardet.",
            },
            { type: "h2", text: "Overblik over reservationer" },
            {
              type: "p",
              text: "I området »Reservationer« ser du ankomster og afrejser, belægning og status pr. bolig. Medarbejder og rengøring ser kun de oplysninger, der er relevante for dem, uden priser eller salgsdetaljer.",
            },
            { type: "h2", text: "Beskeder & opgaver" },
            {
              type: "steps",
              items: [
                "Åbn området »Beskeder« for at besvare gæsteforespørgsler direkte.",
                "Skift til »Opgaver« for at se dine tildelte to-dos.",
                "Tryk på en opgave for at åbne detaljer og afslutte den.",
                "Markér udførte rengøringstidspunkter som afsluttet direkte på stedet.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nye beskeder og opgaver vises live uden manuel opdatering.",
                "Afsluttede opgaver er straks synlige også i web-dashboardet.",
                "Owner ser reservationer og rapporter for deres boliger, dog rent læsende.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push-notifikationer informerer dig om nye beskeder og tildelte opgaver, så snart du tillader dem i enhedsindstillingerne.",
            },
          ],
        },
      ],
    },
  ],
};
