// Slowenische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politika piškotkov",
  metaDescription:
    "Katere piškotke uporablja myNextDays: izključno tehnično nujno potrebne in funkcionalne piškotke, brez sledilnih ali oglaševalskih piškotkov.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ta politika pojasnjuje, katere piškotke in primerljive tehnike shranjevanja uporablja ${ANBIETER.firma} na tem spletnem mestu in v platformi myNextDays.`,
    "Na kratko: uporabljamo izključno tehnično nujno potrebne in funkcionalne piškotke. Ni analitičnih, oglaševalskih ali sledilnih piškotkov niti posredovanja podatkov o uporabi oglaševalskim omrežjem.",
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
        "Soglasje morate dati za natanko eno stvar: zaščito pred neželeno pošto v našem kontaktnem obrazcu. Ta prihaja od podjetja Google (reCAPTCHA Enterprise), gre torej za zunanjo storitev, ki se naloži izključno, če ste jo dovolili. Za to vas ob prvem obisku vpraša pasica na spodnjem robu zaslona — z enakovrednima gumboma za „Zavrni” in „Sprejmi” ter brez privzete izbire. Dokler se ne odločite, velja „ni dovoljeno”.",
        "Vaša odločitev je shranjena v pomnilniku vašega brskalnika (Local Storage, vrednost „nd_consent”); vsebuje le kategorijo, čas in številko različice, brez kakršne koli identifikacije vaše osebe. Na koncu te strani jo lahko kadar koli spremenite ali prekličete.",
      ],
    },
    {
      heading: "To spletno mesto",
      paragraphs: [
        "Trženjsko spletno mesto ne nastavlja nobenih piškotkov. Pisave in ikone so gostovane na našem lastnem strežniku — za to se ne kliče nobena storitev ikon ali pisav tretje osebe. Edina zunanja storitev te strani je zaščita pred neželeno pošto v kontaktnem obrazcu, ki se naloži le z vašim soglasjem. Podrobnosti so na voljo v [Politiki zasebnosti](/datenschutz).",
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
            "Beleži vašo odločitev glede zaščite pred neželeno pošto v kontaktnem obrazcu, da vas pasica za soglasje ne vpraša znova ob vsakem obisku. Shranjeni so le kategorija, čas in številka različice. Vrednost ne zapusti vaše naprave in se ne prenese na naš strežnik; velja za ta brskalnik. Če jo izbrišete, vas bo pasica ob naslednjem obisku znova vprašala.",
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
