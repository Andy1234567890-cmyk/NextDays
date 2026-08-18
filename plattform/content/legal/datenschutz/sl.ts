import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika zasebnosti",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta politika opisuje, katere osebne podatke myBestDays obdeluje, za katere namene, na kateri pravni podlagi in katere pravice imate. Velja za spletno mesto, mobilne aplikacije in vse druge dostope do Platforme.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Upravljavec in pooblaščena oseba za varstvo podatkov",
      paragraphs: [
        `Upravljavec v smislu Uredbe (EU) 2016/679 (GDPR) je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska, št. CVR ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Popolni podatki o ponudniku so navedeni v [Pravnih informacijah](https://mybestdays.dk/rechtliches/impressum).`,
        "Pooblaščena oseba za varstvo podatkov ni imenovana; pogoji člena 37 GDPR niso izpolnjeni. Vprašanja o varstvu podatkov naslovite na zgoraj navedeni e-naslov.",
        "Ponudniki, pri katerih rezervirate, so za podatke, ki jih prejmejo od nas, samostojni upravljavci. Zanje veljajo [Standardi varstva podatkov za gostitelje](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Katere podatke obdelujemo",
      paragraphs: ["Glede na to, kako uporabljate Platformo, obdelujemo:"],
      list: [
        "osnovne podatke — ime, e-naslov, telefonsko številko, jezik in valuto, geslo v šifrirani obliki;",
        "podatke o rezervaciji — rezervirano nastanitev, obdobje, število in imena potnikov, posebne želje, stanje rezervacije;",
        "plačilne podatke — znesek, valuto, stanje plačila, zadnje števke plačilnega sredstva in identifikator transakcije našega ponudnika plačilnih storitev. Popolni podatki o karticah do nas ne pridejo;",
        "komunikacijske podatke — sporočila med vami in ponudnikom, vprašanja naši službi za stranke, pritožbe;",
        "vsebinske podatke — ocene, fotografije, sezname želja;",
        "podatke o uporabi — obiskane strani, iskalne poizvedbe, čas dostopa;",
        "tehnične podatke — naslov IP, identifikatorje brskalnika in naprave, operacijski sistem, napotitveno stran.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Nameni in pravne podlage",
      paragraphs: [
        "Zagotavljanje Platforme, račun, iskanje, rezervacija, izvedba plačil in komunikacija s ponudnikom — člen 6(1)(b) GDPR (pogodba ali predpogodbeni ukrepi).",
        "Služba za stranke, obravnava pritožb in reševanje sporov — člen 6(1)(b) in (f) GDPR.",
        "Odkrivanje in preprečevanje goljufij, zlorab in varnostnih incidentov, uveljavljanje naših pogojev — člen 6(1)(f) GDPR (zakoniti interes za varno tržnico).",
        "Ocene in njihova objava — člen 6(1)(b) in (f) GDPR.",
        "Izpolnjevanje pravnih obveznosti, zlasti gospodarskih in davčnih obveznosti hrambe, obveznosti poročanja po Direktivi (EU) 2021/514 (DAC7) in obveznosti po Uredbi (EU) 2022/2065 — člen 6(1)(c) GDPR.",
        "Izboljševanje Platforme z analizo združenih podatkov o uporabi — člen 6(1)(f) GDPR.",
        "Oglasna e-poštna sporočila in piškotki, ki niso nujni — člen 6(1)(a) GDPR (privolitev), ki jo lahko kadar koli prekličete z učinkom za naprej.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Prejemniki",
      paragraphs: [
        "Ponudniki prejmejo podatke, ki jih potrebujejo za izvedbo vaše rezervacije in za izpolnjevanje svojih pravnih obveznosti — zlasti ime, kontaktne podatke, obdobje, število potnikov in vaša sporočila zanje.",
        "Naš ponudnik plačilnih storitev Stripe obdeluje plačilne podatke kot samostojni upravljavec; dodatno velja [Politika zasebnosti Stripe](https://stripe.com/privacy).",
        "Ponudniki storitev, ki za nas izvajajo gostovanje, upravljanje podatkovnih zbirk, pošiljanje e-pošte, diagnostiko napak in orodja službe za stranke, podatke obdelujejo izključno po naših navodilih na podlagi pogodbe po členu 28 GDPR.",
        "Organi in sodišča prejmejo podatke le v obsegu, v katerem smo k temu zavezani; glej [Politiko za zahteve organov in organov pregona](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Davčni organi prejmejo podatke o ponudnikih, o katerih se poroča po DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Prenos v tretje države",
      paragraphs: [
        "Naši strežniki in strežniki naših obdelovalcev so v Evropski uniji.",
        "Če v posameznih primerih pride do obdelave zunaj Evropskega gospodarskega prostora, se to zgodi le na podlagi sklepa Evropske komisije o ustreznosti ali standardnih pogodbenih klavzul po členu 46(2)(c) GDPR skupaj z dopolnilnimi jamstvi.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Roki hrambe",
      paragraphs: [
        "Podatke računa hranimo, dokler obstaja vaš račun, nato pa jih izbrišemo, kolikor temu ne nasprotuje obveznost hrambe.",
        "Za podatke o rezervaciji in plačilu veljajo gospodarski in davčni roki hrambe; po danskem računovodskem pravu so to praviloma pet let od konca poslovnega leta, na katero se podatki nanašajo.",
        "Sporočila k rezervaciji hranimo do tri leta po koncu bivanja, da je mogoče razjasniti spore.",
        "Ocene po izbrisu vašega računa ostanejo v anonimizirani obliki, ker so del ocenjevalne podlage nastanitve.",
        "Podatke o primerih goljufij in zlorab hranimo tako dolgo, kot je potrebno za preprečitev nadaljnjih kršitev, vendar največ tri leta od zadnjega primera.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Vaše pravice",
      paragraphs: ["Po GDPR imate naslednje pravice:"],
      list: [
        "dostop do podatkov, shranjenih o vas (člen 15);",
        "popravek netočnih podatkov (člen 16);",
        "izbris (člen 17), kolikor temu ne nasprotuje obveznost hrambe;",
        "omejitev obdelave (člen 18);",
        "prenosljivost podatkov (člen 20);",
        "ugovor zoper obdelavo, ki temelji na zakonitih interesih (člen 21), zlasti zoper neposredno trženje;",
        "preklic dane privolitve z učinkom za naprej (člen 7(3));",
        `pritožbo pri nadzornem organu (člen 77) — pristojen je organ vašega prebivališča, delovnega mesta ali kraja domnevne kršitve. Na sedežu upravljavca je to ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danska, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Kako uveljavljate svoje pravice",
      paragraphs: [
        `Mnoge podatke lahko prikažete, spremenite ali izbrišete neposredno v svojem računu. Za vse drugo se obrnite na ${ANBIETER.email}.`,
        "Odgovorimo nemudoma, najpozneje v enem mesecu. Če roka ne moremo upoštevati, vam to sporočimo z obrazložitvijo.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Avtomatizirane odločitve",
      paragraphs: [
        "Uporabljamo avtomatizirane postopke za odkrivanje goljufij, zlorab in protipravne vsebine. Če tak postopek vodi do ukrepa zoper vaš račun ali vsebino, ga obrazložimo, vi pa lahko zahtevate presojo s strani človeka.",
        "Odločitve, ki temelji izključno na avtomatizirani obdelavi in ima pravne učinke v smislu člena 22 GDPR, ne sprejemamo.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obveznost posredovanja podatkov",
      paragraphs: [
        "Podatke, potrebne za rezervacijo, morate posredovati; brez njih ni mogoče skleniti pogodbe niti zagotoviti nastanitve. Vsi drugi podatki so prostovoljni.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Spremembe te politike",
      paragraphs: [
        "To politiko prilagajamo, kadar se spremeni obdelava ali pravno stanje. Vsakokrat veljavna različica je na voljo tukaj; datum posodobitve je naveden zgoraj.",
      ],
    },
  ],
};
