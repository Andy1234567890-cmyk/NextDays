import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Gradnik spletnih strani",
  description: "Ustvarite lastno rezervacijsko spletno stran z gradnikom.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Gradnik spletnih strani",
      articles: [
        {
          slug: "website-erstellen",
          title: "Ustvarjanje spletne strani",
          excerpt: "Z gradnikom v nekaj minutah ustvarite lastno rezervacijsko spletno stran.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Gradnik spletnih strani vam ustvari lastno rezervacijsko spletno stran — dodaten prodajni kanal poleg portalov in tržnice myNextDays. Ohranite popoln nadzor nad zgradbo, vsebino in blagovno znamko.",
            },
            { type: "h2", text: "Tako ustvarite spletno stran" },
            {
              type: "steps",
              items: [
                "V meniju odprite Website.",
                "Kliknite Ustvari spletno stran.",
                "Izberite predlogo kot izhodišče za svojo postavitev.",
                "Potrdite z Ustvari spletno stran — znajdete se neposredno v urejevalniku.",
              ],
            },
            { type: "h2", text: "Kaj vsebuje gradnik" },
            {
              type: "ul",
              items: [
                "Vizualni urejevalnik s stranmi, plastmi in pogledom predogleda",
                "Vnaprej pripravljene gradnike za sezname objektov, galerije in kontaktne obrazce",
                "Neposredno rezervacijsko pot, ki temelji na razpoložljivosti vašega koledarja",
                "Prilagodljive barve, pisave in logotip, skladne z vašo blagovno znamko",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Začnite s predlogo, ki se približa vrsti vašega objekta — počitniški objekt ali hotel — to vam pozneje prihrani čas pri prilagajanju gradnikov.",
            },
            { type: "h2", text: "Naslednji koraki" },
            {
              type: "p",
              text: "Po ustvarjanju prilagodite strani in postavitev, glejte [Urejanje strani in postavitve](/hilfe/website/seiten-layout), ter prikažite svoje objekte na spletni strani, glejte [Prikaz objektov na spletni strani](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Urejanje strani in postavitve",
          excerpt: "Prilagajanje strani, plasti in gradnikov v vizualnem urejevalniku.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Urejevalnik je razdeljen na tri območja: levo pregled strani in plasti, na sredini predogled vaše spletne strani, desno nastavitve trenutno izbranega gradnika.",
            },
            { type: "h2", text: "Urejanje strani" },
            {
              type: "steps",
              items: [
                "Levo pod Strani izberite želeno stran.",
                "V predogledu kliknite na gradnik, da ga izberete.",
                "Desno prilagodite besedilo, sliko ali razmik gradnika.",
                "Gradnike povlecite z vlečenjem in spuščanjem, da spremenite vrstni red.",
              ],
            },
            { type: "h2", text: "Dodajanje novih strani in gradnikov" },
            {
              type: "p",
              text: "Prek gumba Dodaj stran ustvarite dodatne podstrani, na primer O nas ali Kontakt. Znotraj strani prek Dodaj gradnik vstavite nove razdelke, kot so galerija, ocene ali kontaktni obrazec.",
            },
            {
              type: "ul",
              items: [
                "Domača stran, pregled objektov in kontakt so pri vsaki predlogi vnaprej pripravljeni",
                "Dodatne strani je mogoče prosto poimenovati in vključiti v navigacijo",
                "Gradniki so odzivni in se prilagodijo namizju, tablici in pametnemu telefonu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Spremembe v urejevalniku so najprej le osnutek. Šele klik na Objavi jih prevzame na vašo javno spletno stran.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Povezava domene",
          excerpt: "Povezovanje lastne domene z vašo spletno stranjo myNextDays.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Privzeto je vaša spletna stran dosegljiva prek poddomene myNextDays. Če želite namesto tega uporabljati lastno domeno, na primer vas-obrat.si, jo povežete v razdelku Domena.",
            },
            { type: "h2", text: "Nastavitev domene" },
            {
              type: "steps",
              items: [
                "Na spletni strani odprite nastavitve in tam Domena.",
                "Vnesite svojo lastno domeno in kliknite Poveži.",
                "Pri svojem ponudniku domene ustvarite prikazane vnose DNS.",
                "Počakajte na potrditev — preverjanje poteka samodejno v ozadju.",
              ],
            },
            { type: "h2", text: "Pravilna nastavitev vnosov DNS" },
            {
              type: "p",
              text: "myNextDays vam prikaže natančno zahtevane vnose za vašega ponudnika domene. Povezava postane aktivna šele, ko so ti vnosi pravilno nastavljeni in se razširijo po svetu — to lahko traja nekaj ur, odvisno od ponudnika.",
            },
            {
              type: "ul",
              items: [
                "Vnos CNAME ali A nastavite po prikazanih navodilih",
                "Obstoječe, nasprotujoče si vnose za isto domeno najprej odstranite",
                "Certifikat za https se po uspešni povezavi izda samodejno",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez pravilno nastavljenih vnosov DNS vaša spletna stran pod lastno domeno ostane nedosegljiva — skrbno preverite zapis glede na podatke svojega ponudnika.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Prikaz objektov na spletni strani",
          excerpt: "Kateri objekti so vidni in rezervljivi prek spletne strani, upravljate ločeno za vsak objekt.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Da se objekt prikaže na vaši spletni strani, mora biti zanj vklopljena vidnost na spletni strani. To stikalo je neodvisno od vidnosti na tržnici myNextDays ali na portalih.",
            },
            { type: "h2", text: "Odpiranje objekta za spletno stran" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod Objekti.",
                "Preklopite na zavihek Vidnost.",
                "Aktivirajte stikalo Spletna stran.",
                "Preklopite na spletno stran in preverite gradnik Pregled objektov v predogledu.",
              ],
            },
            { type: "h2", text: "Prilagajanje vrstnega reda in prikaza" },
            {
              type: "p",
              text: "V gradniku Pregled objektov določite, ali se objekti razvrstijo samodejno po razpoložljivosti ali določite trden vrstni red. Vsak objekt prikazuje naslovno fotografijo, osnovno ceno v svoji nastavljeni valuti in najpomembnejše lastnosti opreme.",
            },
            {
              type: "ul",
              items: [
                "Samodejno razvrščanje po razpoložljivosti ali ročni vrstni red",
                "Filtriranje po tipu objekta ali opremi je mogoče izbirno aktivirati",
                "Koraki rezervacije potekajo neposredno na spletni strani, brez ovinka prek portala",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekt brez aktivirane vidnosti na spletni strani ostane skrit iz pregleda objektov, tudi če je viden na tržnici ali pri portalih.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Objava spletne strani",
          excerpt: "Osnutki postanejo javno vidni šele s klikom na Objavi.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Dokler delate v urejevalniku, trenutni osnutek vidite le vi. Šele klik na Objavi naredi spremembe vidne vsem obiskovalcem pod vašo domeno.",
            },
            { type: "h2", text: "Tako objavite" },
            {
              type: "steps",
              items: [
                "V urejevalniku odprite predogled in preverite vse strani.",
                "Zgoraj desno kliknite Objavi.",
                "Potrdite pogovorno okno — spletna stran je takoj po tem v živo.",
                "Odprite svojo domeno v novem zavihku, da preverite rezultat.",
              ],
            },
            { type: "h2", text: "Osnutki in ponastavitev" },
            {
              type: "p",
              text: "Dokler še niste objavili, se lahko kadar koli vrnete na zadnje objavljeno stanje, ne da bi za vedno izgubili osnutek — za to v nastavitvah spletne strani uporabite Zavrzi osnutek.",
            },
            {
              type: "ul",
              items: [
                "Objavljene spremembe so takoj vidne pod vašo domeno",
                "Neobjavljen osnutek ostane interen, dokler ga ne potrdite",
                "Vsaka objava se z datumom zabeleži v zgodovini",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pred objavo v predogledu preverite mobilni prikaz — večina gostov rezervacijske spletne strani odpre prek pametnega telefona.",
            },
          ],
        },
      ],
    },
  ],
};
