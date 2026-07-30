import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervacije",
  description: "Upravljanje, premikanje in odpovedovanje rezervacij.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervacije",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Ročni vnos rezervacije",
          excerpt:
            "Tako v myNextDays neposredno vnesete rezervacijo, prejeto po telefonu ali e-pošti.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kdaj vnašate ročno" },
            {
              type: "p",
              text: "Ne prispe vsaka rezervacija prek portala ali vaše lastne platforme — povpraševanja po telefonu, e-pošti ali na kraju samem morate ustvariti sami, da je objekt v myNextDays pravilno zaprt in ne pride do dvojne zasedenosti.",
            },
            {
              type: "steps",
              items: [
                "Odprite Rezervacije in kliknite „Nova rezervacija“.",
                "Izberite objekt — vsak objekt v myNextDays je ena rezervljiva enota, torej določena soba ali počitniški objekt.",
                "Določite prihod in odhod ter število gostov.",
                "Navedite podatke gosta (ime, kontakt, po potrebi naslov za račun).",
                "Preverite predlagano ceno in jo po potrebi prilagodite.",
                "Shranite rezervacijo — noči se takoj zaprejo v koledarju.",
              ],
            },
            { type: "h2", text: "Plačilo in potrditev" },
            {
              type: "p",
              text: "Po shranjevanju veljajo enaka pravila plačila kot pri spletnih rezervacijah. Če je povezan ponudnik plačil, lahko gostu neposredno pošljete povezavo za plačilo ali plačilo ročno označite kot prejeto.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Posebne želje (zgodnji prihod, dodatne postelje) vnesite takoj v opombe — ekipa jih vidi v časovnici rezervacije.",
            },
            { type: "h2", text: "Po ustvarjanju" },
            {
              type: "p",
              text: "Nova rezervacija se takoj prikaže v [Časovnici rezervacije](/hilfe/reservierungen/buchungs-zeitleiste) z vsemi nadaljnjimi koraki, kot so sporočila, naloge in plačila, na enem mestu.",
            },
            {
              type: "ul",
              items: [
                "Koledar in portali se samodejno uskladijo takoj, ko shranite.",
                "Gost po potrebi prejme samodejno potrditveno sporočilo.",
                "Spremembe terminov vnesite prek „Premakni rezervacijo“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Časovnica rezervacije",
          excerpt:
            "Časovnica rezervacije na enem mestu združi celoten potek rezervacije.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kaj prikazuje časovnica" },
            {
              type: "p",
              text: "Vsaka rezervacija ima lastno časovnico, ki kronološko prikazuje celoten potek — od povpraševanja za rezervacijo ali uvoza s portala do odjave. Tako na prvi pogled vidite, kaj se je že zgodilo in kaj sledi.",
            },
            {
              type: "ul",
              items: [
                "Sporočila z gostom",
                "Naloge, na primer čiščenje ali priprava",
                "Plačila in računi",
                "Rezervirani dodatki in dodatne storitve",
                "Premiki (Move) in odpovedi",
              ],
            },
            { type: "h2", text: "Uporaba časovnice v vsakdanjiku" },
            {
              type: "steps",
              items: [
                "Odprite Rezervacije in izberite želeno rezervacijo.",
                "Preklopite na zavihek „Časovnica“.",
                "Kronološko preglejte vse dogodke.",
                "Uporabite hitre ukrepe, da neposredno pošljete sporočilo ali ustvarite nalogo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Če se rezervacija premakne ali odpove, se ta korak prav tako prikaže v časovnici — vključno s v koledarju sproščenimi nočmi.",
            },
            { type: "h2", text: "Zakaj je to pomembno" },
            {
              type: "p",
              text: "Ker ekipa, lastniki in podpora vidijo isto časovnico, ne nastanejo informacijske vrzeli med sporočili, nalogami in plačili. Podrobnosti o vračilih najdete pod [Vračila](/hilfe/zahlungen/rueckerstattungen), o dodatnih storitvah pod [Dodatki in dodatne storitve](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Premik rezervacije",
          excerpt:
            "Tako obstoječo rezervacijo premaknete na novo obdobje, ne da bi zmešali koledar.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Preverjanje pred premikom" },
            {
              type: "p",
              text: "Preden premaknete rezervacijo, preverite razpoložljivost v novem obdobju za rezervirani objekt. myNextDays prvotno rezervirane noči sprosti šele, ko je novo obdobje potrjeno — tako ne nastane vrzel, v kateri bi objekt napačno veljal za prostega ali dvojno zasedenega.",
            },
            {
              type: "steps",
              items: [
                "Odprite rezervacijo v Rezervacijah.",
                "Izberite „Premakni“ in vnesite novo obdobje.",
                "Preverite prikazano razpoložljivost za nove datume.",
                "Potrdite premik.",
                "Preverite, ali se zaradi novega števila noči spremeni cena, in jo po potrebi prilagodite.",
              ],
            },
            { type: "h2", text: "Kaj se zgodi samodejno" },
            {
              type: "p",
              text: "Po potrditvi se stare noči v koledarju pravilno sprostijo, nove noči pa zaprejo, povezani portali se posodobijo. Postopek se zabeleži v časovnici rezervacije.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Če je bila rezervacija prejeta prek portala, lahko za premik tam veljajo lastna pravila — pred večjimi spremembami preverite pravilnik portala.",
            },
            { type: "h2", text: "Razlike v plačilu" },
            {
              type: "p",
              text: "Če se zaradi premika spremeni cena, ustrezno prilagodite pravila plačila — glejte [Pravila plačila](/hilfe/zahlungen/zahlungsregeln). Več o celotnem poteku rezervacije najdete pod [Časovnica rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Odpoved in vračilo",
          excerpt:
            "Tako pravilno odpoveste rezervacijo in po potrebi sprožite vračilo.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Odpoved rezervacije" },
            {
              type: "p",
              text: "Odpoved takoj ponovno sprosti objekt za rezervirano obdobje — tako v vašem koledarju kot na vseh povezanih portalih. Pred odpovedjo preverite, kateri pogoji odpovedi veljajo za to rezervacijo.",
            },
            {
              type: "steps",
              items: [
                "Odprite rezervacijo v Rezervacijah.",
                "Izberite „Odpovej“ in navedite razlog.",
                "Preverite predlagan znesek vračila.",
                "Potrdite odpoved.",
              ],
            },
            { type: "h2", text: "Sprožitev vračila" },
            {
              type: "p",
              text: "Če je bilo plačilo obdelano prek povezanega ponudnika plačil, lahko vračilo sprožite neposredno iz rezervacije. Znesek se izkaže v valuti, nastavljeni za ta objekt. Podrobnosti o postopku najdete pod [Vračila](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Mogoče je popolno ali delno vračilo",
                "Postopek se prikaže v časovnici rezervacije",
                "Pri rezervacijah s portalov dodatno veljajo pravila zadevnega portala",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Odpovedi ni mogoče razveljaviti. Pred potrditvijo skrbno preverite obdobje in gosta.",
            },
            { type: "h2", text: "Po odpovedi" },
            {
              type: "p",
              text: "Objekt je od takoj naprej spet rezervljiv, odprte naloge v zvezi z rezervacijo — na primer priprava — se samodejno označijo kot ni več potrebno. Celoten postopek ostaja sledljiv v [Časovnici rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Prijava in odjava",
          excerpt: "Tako v myNextDays dokumentirate prihod in odhod gosta.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Beleženje prijave" },
            {
              type: "p",
              text: "Prijava označi začetek bivanja in je še posebej koristna pri samostojni prijavi ali predaji ključa s strani ekipe, da ostane status vsake rezervacije ažuren.",
            },
            {
              type: "steps",
              items: [
                "Odprite rezervacijo v Rezervacijah.",
                "Na dan prihoda izberite „Prijava“.",
                "Po potrebi navedite opombo, na primer čas ali posebnosti.",
              ],
            },
            { type: "h2", text: "Odjava in predaja" },
            {
              type: "p",
              text: "Ob odjavi bivanje označite kot zaključeno. To v mnogih primerih samodejno sproži nalogo čiščenja za objekt, da se pripravi za naslednjo rezervacijo.",
            },
            {
              type: "ul",
              items: [
                "Prijava in odjava sta del časovnice rezervacije",
                "Čase je mogoče za posamezen objekt določiti v nastavitvah objekta",
                "Pri mobilnem dostopu lahko ekipa prijavo in odjavo zabeleži neposredno na kraju samem",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zamujena odjava samodejno ne blokira nadaljnjih nalog — redno preverjajte zapadle statuse v Rezervacijah.",
            },
            { type: "h2", text: "Povezava z nalogami" },
            {
              type: "p",
              text: "Prijava in odjava sta tesno povezani z nalogami in časovnico. Več o celotnem poteku preberite pod [Časovnica rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Dodatki in dodatne storitve",
          excerpt:
            "Tako gostom ponudite rezervljive dodatne storitve, kot sta zajtrk ali prevoz, in jih vnesete v rezervacijo.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kaj so dodatki" },
            {
              type: "p",
              text: "Dodatki so izbirne dodatne storitve k rezervaciji — na primer zajtrk, zgodnji prihod, prevoz ali pozna odjava. Nastavijo se po posameznem objektu, gost sam ali vaša ekipa pa jih lahko doda k rezervaciji.",
            },
            {
              type: "steps",
              items: [
                "Odprite objekt in pod „Dodatki“ ustvarite želene dodatne storitve s ceno.",
                "Odprite obstoječo rezervacijo v Rezervacijah.",
                "Izberite „Dodaj dodatek“ in izberite želeno storitev.",
                "Potrdite količino in čas storitve.",
              ],
            },
            { type: "h2", text: "Obračun" },
            {
              type: "p",
              text: "Dodatki se obračunajo v valuti zadevnega objekta in se na računu prikažejo kot lastna postavka. Že plačane dodatke je mogoče ob odpovedi sorazmerno povrniti.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Priljubljene dodatke enkrat centralno nastavite pri objektu — tako jih je mogoče pri vsaki novi rezervaciji dodati z nekaj kliki.",
            },
            { type: "h2", text: "Vidnost za gosta" },
            {
              type: "p",
              text: "Če je platforma ali lastna spletna stran aktivna, lahko gostje ustrezne dodatke pogosto izberejo že med samo rezervacijo. Vsaka dopolnitev se nato prikaže v [Časovnici rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Dodatke je mogoče za vsak objekt posamično poimenovati in ceniti",
                "Naknadno dodajanje je kadar koli mogoče prek rezervacije",
                "Odpovedani dodatki se sorazmerno povrnejo",
              ],
            },
          ],
        },
      ],
    },
  ],
};
