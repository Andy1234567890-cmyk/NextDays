import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Web-stranica",
  description: "Optimalno koristite svoju web-stranicu.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Web-stranica",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Objava vaše web-stranice uživo",
          excerpt: "Kako objaviti svoju vlastitu web-stranicu kao samostalan prodajni kanal.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Vaša web-stranica vlastiti je prodajni kanal uz portale i platformu. Stranice izgrađujete u uređivaču, no tek objavljivanjem web-stranica postaje vidljiva gostima i vaši se objekti tamo pojavljuju kao dostupni za rezervaciju.",
            },
            {
              type: "steps",
              items: [
                "Otvorite uređivač web-stranice i provjerite jesu li sve željene stranice ispunjene sadržajem.",
                "Na kartici objekta po objektu odaberite treba li biti vidljiv na web-stranici — ta je vidljivost neovisna o portalima i platformi.",
                "Prije nego što idete uživo, provjerite pregled u stolnom i mobilnom prikazu.",
                "Kliknite „Objavi” kako biste web-stranicu učinili dostupnom gostima.",
                "Nakon objave provjerite javnu URL adresu i testirajte primjer rezervacije preko web-stranice.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vidljivost web-stranice pojedinog objekta vlastita je os — objekt može biti aktivan na portalima, a skriven na web-stranici i obrnuto. Detalje pod [Postavljanje vlastite domene](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Postavljanje vlastite domene",
          excerpt: "Kako povezati vlastitu domenu sa svojom myNextDays web-stranicom.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Vlastita domena poput www.vase-poslovanje.hr djeluje profesionalnije od standardne adrese i jača vaš brend prema gostima koji žele rezervirati izravno kod vas.",
            },
            {
              type: "steps",
              items: [
                "U uređivaču web-stranice otvorite područje „Domena” i unesite željenu vlastitu domenu.",
                "Kod pružatelja svoje domene postavite prikazane DNS zapise (obično CNAME ili A zapis).",
                "Pričekajte da se domena prikaže kao povezana, a SSL certifikat kao aktivan — to ovisno o pružatelju može potrajati nekoliko sati.",
                "Testirajte otvaranje vlastite domene u privatnom prozoru preglednika kako biste isključili spremljene stare zapise.",
                "Provjerite preusmjeravaju li se stare standardne adrese i dalje na novu domenu, kako postojeće poveznice ne bi bile beskorisne.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "DNS zapise mijenjajte samo onako kako je prikazano — pogrešne vrijednosti mogu poremetiti postojeće postavke e-pošte vaše domene. U slučaju dvojbe provjerite s pružateljem domene prije nego što prebrišete postojeće zapise.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Povećanje izravnih rezervacija",
          excerpt: "Kako usmjeriti više gostiju na svoju vlastitu web-stranicu umjesto na portale.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Rezervacije preko vlastite web-stranice za vaše poslovanje obično su jeftinije nego preko portala, jer ovdje nema provizije portala. S nekoliko ciljanih mjera povećavate udio izravnih rezervacija preko svoje web-stranice kao samostalnog kanala.",
            },
            {
              type: "steps",
              items: [
                "Provjerite jesu li svi objekti koji se mogu rezervirati vidljivi na web-stranici te opremljeni aktualnim fotografijama i opisima.",
                "Postavite pogodnost ili popust isključivo za web-stranicu, primjerice manji popust u odnosu na portale.",
                "Povežite svoju vlastitu domenu u potvrdama rezervacije i komunikaciji s gostima koji su već jednom rezervirali.",
                "Redovito provjeravajte statistiku rezervacija kako biste pratili udio web-stranice u svim rezervacijama tijekom vremena.",
                "Optimizirajte brzinu učitavanja i mobilni prikaz web-stranice, jer velik dio gostiju rezervira preko pametnog telefona.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pogodnost isključivo za web-stranicu funkcionira samo ako gosti uopće pronađu web-stranicu — aktivno na nju upućujte, umjesto da se oslanjate samo na portale. Za objavljivanje vidi [Objava vaše web-stranice uživo](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
