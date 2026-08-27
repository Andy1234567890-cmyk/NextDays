// Slowenische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politika piškotkov",
  metaDescription:
    "Katere piškotke uporablja myNextDays: tehnično nujne piškotke in – samo z vašim soglasjem – funkcionalne, analitične in tržne piškotke. Vsako kategorijo je mogoče posamično vklopiti in izklopiti.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ta politika pojasnjuje, katere piškotke in primerljive tehnike shranjevanja uporablja ${ANBIETER.firma} na tem spletnem mestu in v platformi myNextDays.`,
    "Na kratko: nujni so le piškotki, brez katerih spletno mesto ne deluje, kot je zahtevano. Vse ostalo potrebuje vaše soglasje in se brez njega ne naloži – zaščita pred vsiljeno pošto našega kontaktnega obrazca, merjenje dosega in tržni piškotki, s katerimi merimo uspeh našega oglaševanja. Vsako od teh kategorij lahko posamično dovolite ali zavrnete in svojo odločitev kadar koli prekličete.",
  ],
  sections: [
    {
      heading: "Kaj so piškotki",
      paragraphs: [
        "Piškotki so majhne besedilne datoteke, ki jih spletno mesto shrani v brskalniku. Omogočajo prepoznavanje seje — na primer, da po prijavi ostanete prijavljeni. Poleg piškotkov brskalniki uporabljajo tudi druge oblike shranjevanja, kot je Local Storage, ki delujejo tehnično podobno.",
      ],
    },
    {
      heading: "Za kaj potrebujemo vaše soglasje",
      paragraphs: [
        "Soglasje je v skladu s členom 9 danske uredbe o piškotkih (Cookie-bekendtgørelsen) (ki prenaša člen 5(3) Direktive 2002/58/ES) potrebno le, kadar dostop do vaše naprave ne služi izključno prenosu sporočila ali ni nujno potreben za izrecno zahtevano storitev.",
        "Vsi piškotki, ki jih nastavimo, so potrebni za prijavo, varnost seje ali nastavitev, ki ste jo izbrali sami — zato zanje ne zahtevamo ničesar, obratno pa tudi ne nastavljamo ničesar, za kar bi bilo potrebno soglasje.",
        "Soglasje morate dati za tri kategorije, ki se brez vašega dovoljenja ne naložijo: zaščita pred vsiljeno pošto našega kontaktnega obrazca (reCAPTCHA podjetja Google), merjenje dosega te spletne strani (Google Analytics 4) in tržni piškotki (Meta, LinkedIn, Google Ads). Za to se pri prvem obisku prikaže okno s seznamom kategorij, brez predizbire, vsaka kategorija z lastnim stikalom. Dokler se ne odločite, velja „ni dovoljeno“ in se ne izvaja nobena analiza ali oglaševanje.",
        "Vaša odločitev je shranjena v pomnilniku vašega brskalnika (Local Storage, vrednost „nd_consent”); vsebuje le kategorijo, čas in številko različice, brez kakršne koli identifikacije vaše osebe. Prek ikone piškotkov v spodnjem levem kotu vsake strani jo lahko kadar koli spremenite ali prekličete. Po šestih mesecih bomo vprašali znova — soglasje ne bi smelo veljati neomejeno.",
      ],
    },
    {
      heading: "To spletno mesto",
      paragraphs: [
        "Ta spletna stran sama po sebi ne uporablja piškotkov. Pisave in simboli so na našem lastnem strežniku – za to se ne kliče nobena storitev simbolov ali pisav tretjih oseb. Dodane so le storitve, ki jih dovolite: zaščita pred vsiljeno pošto kontaktnega obrazca, merjenje dosega in tržne storitve. Kateri piškotki se pri tem nastavijo, s kakšno življenjsko dobo in na katerem gostitelju, je navedeno spodaj v razdelku „Piškotki tretjih oseb“. Preklic prek ikone piškotka spodaj levo – zadevna storitev se takoj konča in njeni piškotki se izbrišejo. Podrobnosti so v [Izjavi o varovanju podatkov](/datenschutz).",
      ],
    },
    {
      heading: "Piškotki platforme",
      paragraphs: [
        "Takoj ko se prijavite v nadzorno ploščo, na tržnico ali v mobilni pogled, se nastavijo naslednji piškotki:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Prijava (tehnično nujno potrebno)",
          list: [
            "Namen: identificira vašo prijavljeno sejo pred strežnikom.",
            "Vsebina: kratkotrajni dostopni žeton; berljiv le za strežnik (HttpOnly), prenaša se le prek HTTPS.",
            "Trajanje: seja oziroma do poteka žetona.",
          ],
        },
        {
          titel: "nd_refresh — Podaljšanje seje (tehnično nujno potrebno)",
          list: [
            "Namen: obnavlja dostopni žeton, da se vam ni treba nenehno znova prijavljati.",
            "Vsebina: žeton za obnovitev; HttpOnly, le prek HTTPS.",
            "Trajanje: do odjave ali poteka.",
          ],
        },
        {
          titel: "nd_locale — Izbira jezika (funkcionalno)",
          list: [
            "Namen: si zapomni izbrani jezik.",
            "Vsebina: jezikovna okrajšava, npr. „de” ali „en”.",
            "Trajanje: do spremembe ali izbrisa.",
          ],
        },
        {
          titel: "sidebar_state — Stranska vrstica (funkcionalno)",
          list: [
            "Namen: si zapomni, ali je navigacijska vrstica razširjena ali strnjena.",
            "Vsebina: „true” ali „false”.",
            "Trajanje: do spremembe ali izbrisa.",
          ],
        },
        {
          titel:
            "sb-… — Prijava z Googlom (tehnično nujno potrebno, le v primeru uporabe)",
          list: [
            "Namen: ohranja sejo, ko se prijavite prek Googla.",
            "Vsebina: žeton seje prijavne storitve.",
            "Trajanje: seja oziroma do poteka žetona. Nastavi se le, če izberete prijavo z Googlom.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Beleži vašo odločitev o storitvah, ki zahtevajo soglasje (zaščita pred vsiljeno pošto kontaktnega obrazca in merjenje dosega).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Nastavi se le, če sami odprete klepet na tem spletnem mestu in pošljete sporočilo. Je ključ do vašega lastnega pogovora — brez njega po menjavi strani ne bi več našli našega odgovora. Ne vsebuje nobenih podatkov o vas in se uporablja izključno za ta namen.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "V brskalniku shrani, ali ste se strinjali z uporabo glasovnega vnosa, da se soglasje ne zahteva znova ob vsakem obisku. Vrednost ne zapusti vaše naprave.",
          ],
        },
      ],
    },
    {
      heading: "Piškotki mobilne aplikacije",
      paragraphs: [
        "Mobilna aplikacija ne uporablja piškotkov. Dostopni in obnovitveni žetoni se shranjujejo v varnem shranjevalniku ključev naprave (iOS Keychain, Android Keystore) in se ob odjavi izbrišejo.",
      ],
    },
    {
      heading: "Piškotki tretjih oseb",
      paragraphs: [
        "Če izvedete plačilo, lahko ponudnik plačilnih storitev (Stripe ali PayPal) na svoji lastni strani nastavi piškotke, potrebne za obdelavo in preprečevanje goljufij. Zanje veljajo določbe zadevnega ponudnika.",
        "Na spletnih mestih, ki jih obrati ustvarijo z našim graditeljem strani, o dodatnih piškotkih odloča zadevni obrat, ki je odgovoren tudi za tamkajšnja obvestila.",
        "Samo z vašim soglasjem storitve Google na tem spletnem mestu nastavijo naslednje piškotke — merjenje dosega dva, zaščita pred vsiljeno pošto enega. Brez vašega soglasja zadevni skript ne bo naložen in noben od teh piškotkov ne bo nastavljen; v primeru preklica jih izbrišemo.",
      ],
      unterpunkte: [
        {
          titel:
            "_fbp – Merjenje uspešnosti oglaševanja (potrebno je soglasje)",
          list: [
            "Namen: vaš obisk poveže z oglasom, da lahko merimo uspešnost naših kampanj.",
            "Vsebina: naključno ustvarjen identifikator; ne vsebuje vašega imena, e-pošte ali podatkov o računu.",
            "Ponudnik: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irska.",
            "Gostitelj: mynextdays.com (piškotek prve stranke, nastavi ga Metin skript). Trajanje: približno tri mesece.",
          ],
        },
        {
          titel:
            "_gcl_au – Merjenje uspešnosti Google Ads (potrebno je soglasje)",
          list: [
            "Namen: vaš obisk poveže z Googlovim oglasom, da lahko merimo uspešnost naših kampanj.",
            "Vsebina: naključno ustvarjen identifikator brez povezave z vami.",
            "Ponudnik: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irska.",
            "Gostitelj: mynextdays.com (piškotek prve stranke). Trajanje: približno tri mesece.",
          ],
        },
        {
          titel:
            "li_gc in bcookie – LinkedIn oglaševanje (potrebno je soglasje)",
          list: [
            "Namen: identificira vaš brskalnik za LinkedIn, da se lahko oglasi in njihova uspešnost povežejo; li_gc dodatno shrani vaše soglasje.",
            "Vsebina: identifikator brskalnika in stanje soglasja; ne vsebuje podatkov iz vašega računa pri nas.",
            "Ponudnik: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irska.",
            "Gostitelj: linkedin.com (piškotki tretjih oseb). Trajanje: približno šest mesecev oziroma eno leto.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — zaščita kontaktnega obrazca pred vsiljeno pošto (potrebno soglasje)",
          list: [
            "Gostitelj: www.google.com (piškotek tretje stranke).",
            "Namen: Googlu omogoča oceno tveganja, s katero se avtomatizirana množična sporočila razlikujejo od resničnih povpraševanj.",
            "Vsebina: identifikator, ki ga je ustvaril Google za to oceno; ne vsebuje imena, e-pošte ali podatkov o računu.",
            "Ponudnik: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irska.",
            "Trajanje: določi Google, do šest mesecev. Nastavi se šele, ko dovolite zaščito pred vsiljeno pošto in odprete kontaktni obrazec.",
          ],
        },
        {
          titel: "_ga — Merjenje dosega (potrebno soglasje)",
          list: [
            "Gostitelj: mynextdays.com (piškotek prve stranke, nastavljen z Googlovim skriptom).",
            "Namen: razlikuje obiskovalce, da se ponavljajoči se ogledi ne štejejo dvakrat.",
            "Vsebina: naključno ustvarjen identifikator brez povezave z vašo osebo; brez imena, e-pošte ali podatkov o računu.",
            "Ponudnik: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irska.",
            "Trajanje: do dve leti.",
          ],
        },
        {
          titel: "_ga_<ID> — Stanje seje merjenja (potrebno soglasje)",
          list: [
            "Gostitelj: mynextdays.com (piškotek prve stranke, nastavljen z Googlovim skriptom).",
            "Namen: beleži, kdaj se je začel vaš trenutni obisk, da so ogledi strani znotraj seje povezani.",
            "Vsebina: časovni žig in števec seje; identifikator v imenu označuje našo lastnost, ne vas.",
            "Ponudnik: Google Ireland Limited.",
            "Trajanje: do dve leti.",
          ],
        },
      ],
    },
    {
      heading: "Brisanje in upravljanje piškotkov",
      paragraphs: [
        "Piškotke lahko kadar koli izbrišete ali blokirate v nastavitvah svojega brskalnika. Če blokirate potrebne piškotke, prijava v platformo tehnično ni mogoča — javno spletno mesto in tržnica ostajata uporabna tudi brez prijave.",
        "Ob odjavi piškotke za prijavo odstranimo sami.",
      ],
    },
    {
      heading: "Spremembe te politike",
      paragraphs: [
        "Če dodamo funkcije, ki zahtevajo dodatne piškotke, bomo ta seznam posodobili. Vedno velja tukaj objavljena različica; datum zgoraj prikazuje stanje posodobitve.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
