import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Sporočila in gostje",
  description: "Prejeta pošta, predloge in komunikacija z gosti.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Komunikacija",
      articles: [
        {
          slug: "posteingang",
          title: "Prejeta pošta platforme",
          excerpt: "Vsa sporočila gostov vaših objektov se centralno zbirajo v prejeti pošti platforme.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Ena prejeta pošta za vse objekte" },
            {
              type: "p",
              text: "Prejeta pošta platforme na enem mestu združi vsa sporočila vaših gostov — ne glede na to, prek katerega objekta ali obdobja poteka pogovor. Odprete jo pod /nachrichten in tam vsak pogovor vidite kot lasten pogovorni niz.",
            },
            { type: "h2", text: "Zgradba prejete pošte" },
            {
              type: "ul",
              items: [
                "Leva stolpec: seznam vseh pogovorov, najnovejši na vrhu",
                "Srednji stolpec: aktivna zgodovina sporočil z gostom",
                "Desni stolpec: kontekst rezervacije — obdobje, objekt, podatki gosta",
              ],
            },
            { type: "h2", text: "Odgovor na sporočilo" },
            {
              type: "steps",
              items: [
                "Odprite /nachrichten in izberite želeni pogovor",
                "Napišite odgovor v besedilno polje ali uporabite hitri odgovor",
                "Pošljite sporočilo — gost ga prejme po isti poti, po kateri je pisal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Prejeta pošta platforme prikazuje izključno neposredno komunikacijo med vami in vašimi gosti na myNextDays — sporočila s portalov še naprej urejate tam.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Hitri odgovori",
          excerpt: "Predloge za pogosta vprašanja prihranijo čas pri stiku z gosti.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kaj so hitri odgovori" },
            {
              type: "p",
              text: "Hitri odgovori so vnaprej pripravljeni besedilni bloki za ponavljajoča se vprašanja — na primer o prihodu, geslu za WLAN ali parkiranju. Namesto da vsak odgovor natipkate na novo, ustrezno predlogo z enim klikom vstavite v [Prejeto pošto platforme](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Ustvarjanje hitrega odgovora" },
            {
              type: "steps",
              items: [
                "Odprite /nachrichten in kliknite „Upravljanje hitrih odgovorov“",
                "Kliknite „Nova predloga“ in vnesite naslov, na primer „Informacije za prijavo“",
                "Napišite besedilo odgovora; ograde, kot so ime gosta ali datum prihoda, se ob pošiljanju samodejno vstavijo",
                "Shranite predlogo — od zdaj je na voljo v vsakem pogovoru",
              ],
            },
            { type: "h2", text: "Uporaba hitrih odgovorov v vsakdanjiku" },
            {
              type: "p",
              text: "V oknu sporočil odprete seznam predlog prek ikone strele, izberete ustrezen odgovor in ga po potrebi še individualno prilagodite, preden ga pošljete.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ustvarite predloge za pet do deset najpogostejših vprašanj — to v praksi pokrije večino prejetih sporočil.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Samodejna sporočila",
          excerpt: "Potrditve, informacije za prijavo in opomniki se lahko gostom pošljejo samodejno.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Avtomatizacija ponavljajočih se sporočil" },
            {
              type: "p",
              text: "Namesto da potrditve rezervacij, napotke za prijavo ali zahvalna sporočila pošiljate ročno, jih enkrat določite kot pravilo — myNextDays jih nato samodejno pošlje ob ustreznem trenutku pred, med ali po bivanju.",
            },
            { type: "h2", text: "Tipični sprožilci za samodejna sporočila" },
            {
              type: "ul",
              items: [
                "Takoj po rezervaciji — potrditev z najpomembnejšimi podatki",
                "Nekaj dni pred prihodom — informacije za prijavo in dostopna koda",
                "Na dan odhoda — zahvala in prošnja za oceno",
              ],
            },
            { type: "h2", text: "Nastavitev samodejnega sporočila" },
            {
              type: "steps",
              items: [
                "Odprite /nachrichten, razdelek „Samodejna sporočila“",
                "Izberite sprožilec, na primer „X dni pred prihodom“",
                "Vnesite besedilo — ograde, kot so ime gosta, objekt ali datum prihoda, se samodejno izpolnijo",
                "Aktivirajte pravilo; velja za vse objekte, če ni drugače omejeno",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Samodejna sporočila se povsem običajno prikažejo v [Prejeti pošti platforme](/hilfe/nachrichten/posteingang) in jih je tam mogoče kadar koli naknadno pregledati.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blokiranje sporočil",
          excerpt: "Osebo lahko neposredno iz zgodovine sporočil zaprete za nadaljnji stik.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kdaj je blokiranje smiselno" },
            {
              type: "p",
              text: "Ob žaljivih sporočilih, nadlegovanju ali ponavljajočem se neprimernem vedenju lahko osebo blokirate neposredno iz niza sporočil. Blokirana oseba vam nato ne more več pisati novih sporočil in pri vas ne more ustvariti nove rezervacije.",
            },
            { type: "h2", text: "Blokiranje osebe iz niza" },
            {
              type: "steps",
              items: [
                "Odprite zadevni pogovor v [Prejeti pošti platforme](/hilfe/nachrichten/posteingang)",
                "Zgoraj v nizu kliknite meni in izberite „Blokiraj osebo“",
                "Potrdite postopek — blokada velja takoj",
              ],
            },
            { type: "h2", text: "Kaj blokada pomeni — in kaj ne" },
            {
              type: "ul",
              items: [
                "Nova sporočila blokirane osebe se ne dostavijo več",
                "Nove zahteve za rezervacijo te osebe se zavrnejo",
                "Če trenutno poteka rezervacija te osebe, komunikacija za trajanje bivanja izjemoma ostane mogoča",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokado je mogoče kadar koli znova preklicati v pregledu „Blokirane osebe“ v računu. Pred blokiranjem preverite, ali že obstaja tekoča rezervacija.",
            },
          ],
        },
      ],
    },
  ],
};
