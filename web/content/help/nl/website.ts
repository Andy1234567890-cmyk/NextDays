import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Website-bouwer",
  description: "Met de bouwer uw eigen boekingswebsite maken.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Website-bouwer",
      articles: [
        {
          slug: "website-erstellen",
          title: "Een website maken",
          excerpt: "Met de bouwer maakt u in enkele minuten uw eigen boekingswebsite aan.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De website-bouwer maakt voor u een eigen boekingswebsite — een extra verkoopkanaal naast portalen en de myBestDays-platform-marktplaats. U behoudt volledige controle over opbouw, inhoud en branding.",
            },
            { type: "h2", text: "Zo maakt u een website aan" },
            {
              type: "steps",
              items: [
                "Open in het menu Website.",
                "Klik op Website maken.",
                "Kies een sjabloon als uitgangspunt voor uw layout.",
                "Bevestig met Website aanmaken — u komt direct in de editor terecht.",
              ],
            },
            { type: "h2", text: "Wat de bouwer bevat" },
            {
              type: "ul",
              items: [
                "Een visuele editor met pagina's, lagen en voorvertoning",
                "Kant-en-klare bouwstenen voor objectlijsten, galerijen en contactformulieren",
                "Een direct boekingstraject dat op uw kalenderbeschikbaarheid is gebaseerd",
                "Aanpasbare kleuren, lettertypen en logo passend bij uw merk",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Begin met een sjabloon die dicht bij uw objecttype ligt — vakantiewoning of hotel — dat scheelt u later tijd bij het aanpassen van de bouwstenen.",
            },
            { type: "h2", text: "Volgende stappen" },
            {
              type: "p",
              text: "Na het aanmaken past u pagina's en layout aan, zie [Pagina's & layout bewerken](/hilfe/website/seiten-layout), en toont u uw objecten op de website, zie [Objecten op de website tonen](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Pagina's & layout bewerken",
          excerpt: "Pagina's, lagen en bouwstenen aanpassen in de visuele editor.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De editor is in drie delen opgebouwd: links het pagina- en laagoverzicht, in het midden de voorvertoning van uw website, rechts de instellingen van de geselecteerde bouwsteen.",
            },
            { type: "h2", text: "Een pagina bewerken" },
            {
              type: "steps",
              items: [
                "Kies links onder Pagina's de gewenste pagina.",
                "Klik in de voorvertoning op een bouwsteen om deze te selecteren.",
                "Pas rechts tekst, afbeelding of afstand van de bouwsteen aan.",
                "Sleep bouwstenen met drag-and-drop om de volgorde te wijzigen.",
              ],
            },
            { type: "h2", text: "Nieuwe pagina's & bouwstenen toevoegen" },
            {
              type: "p",
              text: "Via de knop Pagina toevoegen maakt u extra subpagina's aan, bijvoorbeeld Over ons of Contact. Binnen een pagina voegt u via Bouwsteen toevoegen nieuwe onderdelen toe zoals galerij, beoordelingen of contactformulier.",
            },
            {
              type: "ul",
              items: [
                "Startpagina, objectoverzicht en contact zijn bij elk sjabloon vooraf ingevuld",
                "Extra pagina's zijn vrij te benoemen en op te nemen in de navigatie",
                "Bouwstenen zijn responsief en passen zich aan desktop, tablet en smartphone aan",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Wijzigingen in de editor zijn eerst alleen een concept. Pas een klik op Publiceren zet ze door naar uw openbare website.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Domein koppelen",
          excerpt: "Een eigen domein aan uw myNextDays-website koppelen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Standaard is uw website bereikbaar via een myNextDays-subdomein. Wilt u in plaats daarvan een eigen domein gebruiken, bijvoorbeeld uwbedrijf.nl, dan koppelt u dit in het onderdeel Domein.",
            },
            { type: "h2", text: "Domein vastleggen" },
            {
              type: "steps",
              items: [
                "Open in de website de instellingen en daarin Domein.",
                "Voer uw eigen domein in en klik op Koppelen.",
                "Maak bij uw domeinaanbieder de weergegeven DNS-records aan.",
                "Wacht op de bevestiging — de controle verloopt automatisch op de achtergrond.",
              ],
            },
            { type: "h2", text: "DNS-records correct instellen" },
            {
              type: "p",
              text: "myNextDays toont u precies de vereiste records voor uw domeinaanbieder. De koppeling wordt pas actief zodra deze records correct zijn ingesteld en wereldwijd zijn verspreid — dat kan, afhankelijk van de aanbieder, enkele uren duren.",
            },
            {
              type: "ul",
              items: [
                "CNAME- of A-record instellen volgens de weergegeven handleiding",
                "Bestaande, conflicterende records voor hetzelfde domein vooraf verwijderen",
                "Certificaat voor https wordt na succesvolle koppeling automatisch uitgegeven",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder correct ingestelde DNS-records blijft uw website onder het eigen domein onbereikbaar — controleer de schrijfwijze zorgvuldig tegen de gegevens van uw aanbieder.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Objecten op de website tonen",
          excerpt: "Welke objecten via de website zichtbaar en boekbaar zijn, stuurt u apart per object aan.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Om een object op uw website te tonen, moet de websitezichtbaarheid voor dit object zijn ingeschakeld. Deze schakelaar staat los van de zichtbaarheid op de myBestDays-platform-marktplaats of op portalen.",
            },
            { type: "h2", text: "Object vrijgeven voor de website" },
            {
              type: "steps",
              items: [
                "Open het object onder Objecten.",
                "Ga naar het tabblad Zichtbaarheid.",
                "Schakel de schakelaar Website in.",
                "Ga naar de website en controleer de bouwsteen Objectoverzicht in de voorvertoning.",
              ],
            },
            { type: "h2", text: "Volgorde & weergave aanpassen" },
            {
              type: "p",
              text: "In de bouwsteen Objectoverzicht bepaalt u of objecten automatisch op beschikbaarheid worden gesorteerd of u een vaste volgorde opgeeft. Elk object toont een titelfoto, basisprijs in de vastgelegde valuta en de belangrijkste voorzieningen.",
            },
            {
              type: "ul",
              items: [
                "Automatische sortering op beschikbaarheid of handmatige volgorde",
                "Filter op objecttype of voorzieningen optioneel inschakelbaar",
                "Boekingsstappen verlopen direct op de website, zonder omweg via een portaal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Een object zonder ingeschakelde websitezichtbaarheid blijft verborgen in het objectoverzicht, ook als het zichtbaar is op de platform-marktplaats of bij portalen.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Website publiceren",
          excerpt: "Concepten worden pas openbaar zichtbaar na een klik op Publiceren.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Zolang u in de editor werkt, ziet alleen u het huidige concept. Pas een klik op Publiceren maakt de wijzigingen onder uw domein zichtbaar voor alle bezoekers.",
            },
            { type: "h2", text: "Zo publiceert u" },
            {
              type: "steps",
              items: [
                "Open in de editor de voorvertoning en controleer alle pagina's.",
                "Klik rechtsboven op Publiceren.",
                "Bevestig het dialoogvenster — de website is direct daarna live.",
                "Open uw domein in een nieuw tabblad om het resultaat te controleren.",
              ],
            },
            { type: "h2", text: "Concepten & terugzetten" },
            {
              type: "p",
              text: "Zolang u nog niet hebt gepubliceerd, kunt u op elk moment terugkeren naar de laatst gepubliceerde stand, zonder het concept definitief te verliezen — gebruik hiervoor Concept verwerpen in de website-instellingen.",
            },
            {
              type: "ul",
              items: [
                "Gepubliceerde wijzigingen zijn meteen zichtbaar onder uw domein",
                "Een ongepubliceerd concept blijft intern totdat u het bevestigt",
                "Elke publicatie wordt met datum vastgelegd in de geschiedenis",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Controleer vóór het publiceren de mobiele weergave in de voorvertoning — de meeste gasten openen boekingswebsites via de smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
