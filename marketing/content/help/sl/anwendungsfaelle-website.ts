import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Spletna stran",
  description: "Optimalna uporaba vaše spletne strani.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Spletna stran",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Objavite svojo spletno stran",
          excerpt: "Tako objavite svojo spletno stran kot samostojen prodajni kanal.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Vaša spletna stran je samostojen prodajni kanal poleg portalov in platforme. Strani sestavite v urejevalniku, vendar postane spletna stran za goste vidna šele z objavo, vaši objekti pa se tam prikažejo kot rezervljivi.",
            },
            {
              type: "steps",
              items: [
                "Odprite urejevalnik spletne strani in preverite, ali so vse želene strani zapolnjene z vsebino.",
                "V zavihku objekta za vsak objekt izberite, ali naj bo viden na spletni strani — ta vidnost je neodvisna od portalov in platforme.",
                "Pred objavo preverite predogled v namizni in mobilni različici.",
                "Kliknite »Objavi«, da spletno stran odprete za goste.",
                "Po objavi preverite javni naslov URL in preizkusite vzorčno rezervacijo prek spletne strani.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vidnost objekta na spletni strani je lastna os — objekt je lahko aktiven na portalih, na spletni strani pa skrit, in obratno. Podrobnosti pod [Nastavitev lastne domene](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Nastavitev lastne domene",
          excerpt: "Tako povežete svojo lastno domeno s spletno stranjo myNextDays.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Lastna domena, na primer www.vaš-obrat.si, deluje bolj profesionalno kot standardni naslov in krepi vašo blagovno znamko pri gostih, ki želijo rezervirati neposredno pri vas.",
            },
            {
              type: "steps",
              items: [
                "V urejevalniku spletne strani odprite razdelek »Domena« in vnesite želeno lastno domeno.",
                "Pri ponudniku vaše domene nastavite prikazane vnose DNS (običajno CNAME ali zapis A).",
                "Počakajte, da je domena prikazana kot povezana in SSL-certifikat kot aktiven — to lahko traja nekaj ur, odvisno od ponudnika.",
                "Preizkusite dostop do lastne domene v zasebnem oknu brskalnika, da izključite predpomnjene stare vnose.",
                "Preverite, da stari standardni naslovi še naprej preusmerjajo na novo domeno, da obstoječe povezave ne ostanejo neveljavne.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vnose DNS spreminjajte le tako, kot je prikazano — napačne vrednosti lahko motijo obstoječe nastavitve e-pošte vaše domene. V dvomih se pred prepisom obstoječih vnosov posvetujte s ponudnikom domene.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Povečanje neposrednih rezervacij",
          excerpt: "Tako usmerite več gostov na svojo spletno stran namesto na portale.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Rezervacije prek lastne spletne strani so za vaš obrat večinoma ugodnejše kot prek portalov, saj tu ne nastane provizija portala. Z nekaj ciljno usmerjenimi ukrepi povečate delež neposrednih rezervacij prek svoje spletne strani kot samostojnega kanala.",
            },
            {
              type: "steps",
              items: [
                "Zagotovite, da so vsi rezervljivi objekti vidni na spletni strani ter opremljeni z aktualnimi fotografijami in opisi.",
                "Vzpostavite popust ali ugodnost, ki velja izključno za spletno stran, na primer manjši popust v primerjavi s portali.",
                "Povežite svojo lastno domeno v potrditvah rezervacij in komunikaciji z gosti, ki so že enkrat rezervirali.",
                "Redno preverjajte statistiko rezervacij, da spremljate delež spletne strani med vsemi rezervacijami skozi čas.",
                "Optimizirajte hitrost nalaganja in mobilni prikaz spletne strani, saj velik del gostov rezervira prek pametnega telefona.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ugodnost, ki velja izključno za spletno stran, deluje le, če gosti spletno stran sploh najdejo — nanjo aktivno opozarjajte, namesto da se zanašate samo na portale. O objavi glejte [Objavite svojo spletno stran](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
