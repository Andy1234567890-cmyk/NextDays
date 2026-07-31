import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Hjemmesidebygger",
  description: "Opret din egen bookinghjemmeside med hjemmesidebyggeren.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Hjemmesidebygger",
      articles: [
        {
          slug: "website-erstellen",
          title: "Opret en hjemmeside",
          excerpt: "Med byggeren opretter du din egen bookinghjemmeside på få minutter.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Hjemmesidebyggeren opretter din egen bookinghjemmeside — en ekstra salgskanal ved siden af portaler og myBestDays-markedspladsen. Du bevarer fuld kontrol over opbygning, indhold og branding.",
            },
            { type: "h2", text: "Sådan opretter du en hjemmeside" },
            {
              type: "steps",
              items: [
                "Åbn Hjemmeside i menuen.",
                "Klik på Opret hjemmeside.",
                "Vælg en skabelon som udgangspunkt for dit layout.",
                "Bekræft med Opret hjemmeside — du kommer direkte ind i editoren.",
              ],
            },
            { type: "h2", text: "Hvad byggeren indeholder" },
            {
              type: "ul",
              items: [
                "En visuel editor med sider, lag og forhåndsvisning",
                "Færdige moduler til boliglister, gallerier og kontaktformularer",
                "Et direkte bookingflow, der bygger på din kalendertilgængelighed",
                "Tilpasselige farver, skrifttyper og logo, der matcher dit brand",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Begynd med en skabelon, der ligger tæt på din boligtype — feriebolig eller hotel — det sparer dig tid senere, når du tilpasser modulerne.",
            },
            { type: "h2", text: "Næste skridt" },
            {
              type: "p",
              text: "Efter oprettelsen tilpasser du sider og layout, se [Rediger sider & layout](/hilfe/website/seiten-layout), og viser dine boliger på hjemmesiden, se [Vis boliger på hjemmesiden](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Rediger sider & layout",
          excerpt: "Tilpas sider, lag og moduler i den visuelle editor.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Editoren er opdelt i tre områder: til venstre oversigten over sider og lag, i midten forhåndsvisningen af din hjemmeside, til højre indstillingerne for det valgte modul.",
            },
            { type: "h2", text: "Rediger en side" },
            {
              type: "steps",
              items: [
                "Vælg den ønskede side til venstre under Sider.",
                "Klik på et modul i forhåndsvisningen for at vælge det.",
                "Tilpas modulets tekst, billede eller afstand til højre.",
                "Træk moduler med drag-and-drop for at ændre rækkefølgen.",
              ],
            },
            { type: "h2", text: "Tilføj nye sider & moduler" },
            {
              type: "p",
              text: "Via knappen Tilføj side opretter du flere undersider, f.eks. Om os eller Kontakt. På en side tilføjer du via Tilføj modul nye afsnit som galleri, anmeldelser eller kontaktformular.",
            },
            {
              type: "ul",
              items: [
                "Forside, boligoversigt og kontakt er forudindstillet i alle skabeloner",
                "Yderligere sider kan navngives frit og tilføjes til navigationen",
                "Moduler er responsive og tilpasser sig computer, tablet og smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ændringer i editoren er indledningsvis kun et udkast. Først et klik på Udgiv overfører dem til din offentlige hjemmeside.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Forbind domæne",
          excerpt: "Knyt dit eget domæne til din myNextDays-hjemmeside.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Som standard kan din hjemmeside tilgås via et myNextDays-underdomæne. Ønsker du i stedet at bruge dit eget domæne, f.eks. din-virksomhed.dk, forbinder du det i afsnittet Domæne.",
            },
            { type: "h2", text: "Angiv domæne" },
            {
              type: "steps",
              items: [
                "Åbn indstillingerne i hjemmesiden og dér Domæne.",
                "Indtast dit eget domæne, og klik på Forbind.",
                "Opret de viste DNS-poster hos din domæneudbyder.",
                "Vent på bekræftelsen — kontrollen sker automatisk i baggrunden.",
              ],
            },
            { type: "h2", text: "Angiv DNS-poster korrekt" },
            {
              type: "p",
              text: "myNextDays viser dig præcis de poster, der kræves hos din domæneudbyder. Forbindelsen bliver først aktiv, når disse poster er sat korrekt og har spredt sig globalt — det kan tage nogle timer afhængigt af udbyderen.",
            },
            {
              type: "ul",
              items: [
                "Angiv CNAME- eller A-post i henhold til den viste vejledning",
                "Fjern eksisterende, modstridende poster for samme domæne på forhånd",
                "Certifikat til https udstedes automatisk efter en vellykket forbindelse",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden korrekt angivne DNS-poster forbliver din hjemmeside utilgængelig under dit eget domæne — kontrollér stavemåden omhyggeligt mod oplysningerne fra din udbyder.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Vis boliger på hjemmesiden",
          excerpt: "Hvilke boliger der er synlige og bookbare via hjemmesiden, styrer du separat pr. bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "For at en bolig skal vises på din hjemmeside, skal hjemmeside-synligheden for denne bolig være slået til. Denne kontakt er uafhængig af synligheden på myBestDays-markedspladsen eller på portaler.",
            },
            { type: "h2", text: "Frigiv bolig til hjemmesiden" },
            {
              type: "steps",
              items: [
                "Åbn boligen under Boliger.",
                "Skift til fanen Synlighed.",
                "Aktivér kontakten Hjemmeside.",
                "Skift til hjemmesiden, og kontrollér modulet Boligoversigt i forhåndsvisningen.",
              ],
            },
            { type: "h2", text: "Tilpas rækkefølge & visning" },
            {
              type: "p",
              text: "I modulet Boligoversigt bestemmer du, om boliger sorteres automatisk efter tilgængelighed, eller om du angiver en fast rækkefølge. Hver bolig viser titelfoto, grundpris i sin angivne valuta og de vigtigste facilitetsangivelser.",
            },
            {
              type: "ul",
              items: [
                "Automatisk sortering efter tilgængelighed eller manuel rækkefølge",
                "Filter efter boligtype eller faciliteter kan aktiveres valgfrit",
                "Bookingtrin foregår direkte på hjemmesiden uden omvejen via et portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En bolig uden aktiveret hjemmeside-synlighed forbliver skjult fra boligoversigten, selv hvis den er synlig på markedspladsen eller hos portaler.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Udgiv hjemmesiden",
          excerpt: "Udkast bliver først offentligt synlige, når du klikker på Udgiv.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Så længe du arbejder i editoren, er det kun dig, der ser det aktuelle udkast. Først et klik på Udgiv gør ændringerne synlige for alle besøgende under dit domæne.",
            },
            { type: "h2", text: "Sådan udgiver du" },
            {
              type: "steps",
              items: [
                "Åbn forhåndsvisningen i editoren, og kontrollér alle sider.",
                "Klik på Udgiv øverst til højre.",
                "Bekræft dialogen — hjemmesiden er live umiddelbart derefter.",
                "Åbn dit domæne i en ny fane for at kontrollere resultatet.",
              ],
            },
            { type: "h2", text: "Udkast & nulstilling" },
            {
              type: "p",
              text: "Så længe du endnu ikke har udgivet, kan du til enhver tid vende tilbage til den senest udgivne version uden at miste udkastet permanent — brug Forkast udkast i hjemmesidens indstillinger til dette.",
            },
            {
              type: "ul",
              items: [
                "Udgivne ændringer er straks synlige under dit domæne",
                "Et uudgivet udkast forbliver internt, indtil du bekræfter det",
                "Hver udgivelse registreres med dato i historikken",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollér den mobile visning i forhåndsvisningen, før du udgiver — de fleste gæster besøger bookinghjemmesider via smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
