import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Prvi koraki",
  description: "Nastavite račun in začnite v nekaj minutah.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Nastavitev",
      articles: [
        {
          slug: "willkommen",
          title: "Dobrodošli v myNextDays",
          excerpt: "Pregled PMS, upravitelja kanalov, tržnice in aplikacije.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "myNextDays je vaša osrednja platforma za počitniške objekte in hotele. Namesto več ločenih rešitev na enem mestu upravljate razpoložljivost, cene, rezervacije in komunikacijo z gosti — ne glede na to, ali upravljate eno samo počitniško hišo ali več hotelskih sob.",
            },
            { type: "h2", text: "Štirje gradniki" },
            {
              type: "ul",
              items: [
                "PMS (sistem za upravljanje nepremičnin): objekti, koledar, cene, rezervacije, naloge in plačila.",
                "Upravitelj kanalov: povezava s portali, kot so Booking, Airbnb in drugi — en vnos, mnogo usklajenih portalov.",
                "Tržnica platforme: lastna tržnica myBestDays, enakovreden rezervacijski kanal poleg portalov.",
                "Aplikacija: mobilna aplikacija za goste, lastnike in zaposlene z istimi podatki kot v spletni različici.",
              ],
            },
            { type: "h2", text: "Kako gradniki delujejo skupaj" },
            {
              type: "p",
              text: "Objekt, cene in razpoložljivost urejate enkrat, centralno v PMS. Od tam myNextDays podatke samodejno posreduje vsem aktivnim kanalom. Rezervacija — ne glede na to, prek katerega kanala prispe — takoj zapre ustrezne noči povsod, tako da so dvojne rezervacije izključene.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Začnite z nastavitvijo računa in obrata, nato ustvarite svoj prvi objekt — ta vrstni red vam kasneje prihrani popravke.",
            },
            { type: "h2", text: "Naslednji koraki" },
            {
              type: "steps",
              items: [
                "V meniju odprite Konto in dopolnite podatke svojega obrata.",
                "Pod Objekti ustvarite svoj prvi objekt.",
                "Preverite popolnost opreme, fotografij in cen.",
                "Kliknite Objavi, da objekt postane viden na vseh kanalih.",
              ],
            },
            {
              type: "p",
              text: "Več o posameznih korakih najdete v [Nastavitev računa in obrata](/hilfe/erste-schritte/konto-einrichten) in [Ustvarite svoj prvi objekt](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Nastavitev računa in obrata",
          excerpt: "Pravilna nastavitev osnovnih podatkov, naslova za izstavitev računov in valute.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Preden ustvarite objekte, v računu nastavite svoj obrat. Ti podatki so potrebni za račune, portale in obračun z myNextDays, zato morajo biti popolni in pravilni.",
            },
            { type: "h2", text: "Vnos osnovnih podatkov" },
            {
              type: "steps",
              items: [
                "V meniju odprite Konto.",
                "Pod Osnovni podatki vnesite ime podjetja oz. ime samostojnega podjetnika, naslov in kontaktne podatke.",
                "Navedite naslov za izstavitev računov — pojavi se na vseh izdanih računih.",
                "Izberite svojo osnovno valuto. Ta velja za vse cene, dokler je ciljno ne spremenite za posamezen objekt.",
              ],
            },
            { type: "h2", text: "Zakaj je valuta pomembna" },
            {
              type: "p",
              text: "Valuta se ne ugiba niti ne dopolni samodejno: če manjka, cene ni mogoče pravilno prikazati ali obračunati. Zato myNextDays ob nastavitvi zahteva zavesten izbor, namesto da bi uporabil privzeto vrednost.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Če naknadno spremenite valuto objekta, se vsi cenovni načrti, vezani nanjo, prav tako preklopijo. Nato še enkrat preverite cene.",
            },
            { type: "h2", text: "Naslov za izstavitev računov in obračun" },
            {
              type: "p",
              text: "Pod Obračun v računu vidite svoje tekoče račune in nastavljen naslov za izstavitev računov. Te podatke ohranjajte aktualne, zlasti ob spremembi pravne oblike ali naslova, da bodo računi izdani pravilno.",
            },
            {
              type: "ul",
              items: [
                "Ime podjetja oz. ime samostojnega podjetnika",
                "Naslov za izstavitev računov z državo",
                "Davčna oz. ID za DDV, če obstaja",
                "Osnovna valuta za nove objekte",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Ustvarite svoj prvi objekt",
          excerpt: "Tako korak za korakom ustvarite svoj prvi rezervljivi objekt.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Objekt v myNextDays je vedno natanko ena rezervljiva enota: bodisi ena sama soba v hotelu bodisi celoten počitniški objekt. Če upravljate hotel z več sobami, za vsako sobo ustvarite lasten objekt.",
            },
            { type: "h2", text: "Ustvarjanje objekta" },
            {
              type: "steps",
              items: [
                "V meniju odprite Objekti.",
                "Kliknite Dodaj objekt.",
                "Izberite tip objekta: kategorijo, tip nepremičnine in vrsto ponudbe.",
                "Dopolnite naslov, zasedenost in osnovno ceno v vaši nastavljeni valuti.",
                "Shranite objekt kot osnutek, da ga dopolnite pozneje.",
              ],
            },
            { type: "h2", text: "Kaj še manjka po tem" },
            {
              type: "p",
              text: "Na novo ustvarjen objekt je najprej osnutek in ni viden na nobenem kanalu. Pred objavo dopolnite opremo, fotografije, opis in razpoložljivost v koledarju — le popoln objekt je mogoče zanesljivo tržiti.",
            },
            {
              type: "ul",
              items: [
                "Izberite lastnosti opreme s seznama kategorij",
                "Navedite vsaj eno naslovno fotografijo in opis",
                "Pravilno vnesite zasedenost (odrasli, otroci, postelje)",
                "Preverite osnovno ceno in razpoložljivost v koledarju",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Če upravljate več tipov sob, ta postopek ponovite za vsako posamezno sobo — nadrejene ravni stavbe s sobami pod njo ni.",
            },
            {
              type: "p",
              text: "Ko so izpolnjena vsa obvezna polja, lahko objekt objavite, glejte [Objava objekta](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Objava objekta",
          excerpt: "En klik hkrati odpre tržnico platforme, portale in spletno stran.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Objava naredi objekt viden in rezervljiv. Običajno zadostuje en sam klik, da hkrati aktivirate vse tri prodajne kanale — vidnost za posamezen kanal pa lahko kadar koli prilagodite ločeno.",
            },
            { type: "h2", text: "Tako objavite" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod Objekti.",
                "V zavihku Pregled preverite, ali so vsi obvezni podatki označeni zeleno.",
                "Kliknite Objavi.",
                "Potrdite pogovorno okno — tržnica platforme, portali in spletna stran se aktivirajo.",
              ],
            },
            { type: "h2", text: "Ločeno upravljanje kanalov" },
            {
              type: "p",
              text: "Po objavi v zavihku Vidnost najdete tri ločena stikala: spletna stran, tržnica platforme in portali. Če želite objekt ponuditi na primer samo na svoji spletni strani, ne pa prek portalov, preprosto izklopite ustrezno stikalo.",
            },
            {
              type: "ul",
              items: [
                "Spletna stran: vidnost na vaši lastni spletni strani myNextDays",
                "Tržnica platforme: vidnost na globalni tržnici myBestDays",
                "Portali: vidnost na Booking, Airbnb in drugih",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ta tri stikala so neodvisna od statusa objekta (aktiven/neaktiven). Aktiven objekt je lahko kljub temu na posameznih kanalih neviden.",
            },
            { type: "h2", text: "Začasna zapora objekta" },
            {
              type: "p",
              text: "Če želite zapreti posamezen dan namesto celotnega objekta, uporabite Stop-Sell v koledarju — ta zapre dan hkrati na vseh kanalih, neodvisno od stikal za vidnost.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Razumevanje treh prodajnih kanalov",
          excerpt: "Pregled portalov, tržnice platforme in aplikacije.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "myNextDays vsak objekt trži hkrati prek več enakovrednih poti. Razumevanje njihovega medsebojnega delovanja vam pomaga ciljno upravljati vidnost in cene.",
            },
            { type: "h2", text: "Portali" },
            {
              type: "p",
              text: "Prek upravitelja kanalov povežete svoj objekt z velikimi rezervacijskimi portali, kot so Booking, Airbnb in drugi. Razpoložljivost in cene se samodejno usklajujejo, tako da vam ni treba ročno urejati več koledarjev portalov.",
            },
            { type: "h2", text: "Tržnica platforme" },
            {
              type: "p",
              text: "Tržnica myBestDays je lasten, globalen rezervacijski kanal — primerljiv z Booking ali Airbnb, vendar del iste platforme. Ni nadomestek za „neposredno rezervacijo“, temveč enakovreden kanal z lastno osjo vidnosti.",
            },
            { type: "h2", text: "Aplikacija" },
            {
              type: "p",
              text: "Mobilna aplikacija gostom, lastnikom in zaposlenim omogoča dostop do istih podatkov kot spletna različica — na primer podrobnosti rezervacij, sporočila ali naloge, odvisno od posamezne vloge.",
            },
            { type: "h2", text: "Tri ločene osi vidnosti" },
            {
              type: "ul",
              items: [
                "Spletna stran — vaša lastna spletna stran myNextDays",
                "Tržnica platforme — globalna tržnica myBestDays",
                "Portali — Booking, Airbnb in drugi prek upravitelja kanalov",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vse tri osi je mogoče preklapljati neodvisno druga od druge. Stop-Sell in status objekta pa nasprotno delujeta kanalsko preseženo na vse tri hkrati.",
            },
          ],
        },
      ],
    },
  ],
};
