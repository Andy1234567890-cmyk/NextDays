import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika ta' privatezza",
  stand: "Aġġornat: 18 ta' Awwissu 2026",
  intro: [
    "Din il-politika tiddeskrivi liema data personali tipproċessa myBestDays, għal liema skopijiet, fuq liema bażi legali u liema drittijiet għandek. Tapplika għas-sit web, għall-applikazzjonijiet mobbli u għal kull aċċess ieħor għall-Pjattaforma.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Kontrollur u uffiċjal għall-protezzjoni tad-data",
      paragraphs: [
        `Il-kontrollur fis-sens tar-Regolament (UE) 2016/679 (GDPR) huwa ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, id-Danimarka, CVR nru ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Id-dettalji sħaħ tal-fornitur jinsabu fl-[Informazzjoni legali](https://mybestdays.dk/rechtliches/impressum).`,
        "Uffiċjal għall-protezzjoni tad-data ma nħatarx; il-kundizzjonijiet tal-Artikolu 37 tal-GDPR mhumiex issodisfati. Mistoqsijiet dwar il-protezzjoni tad-data indirizzahom lill-indirizz tal-email imsemmi hawn fuq.",
        "Il-fornituri li għandhom tibbukkja huma kontrolluri indipendenti għad-data li jirċievu mingħandna. Għalihom japplikaw l-[Istandards ta' protezzjoni tad-data għas-sidien](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Liema data nipproċessaw",
      paragraphs: ["Skont kif tuża l-Pjattaforma, nipproċessaw:"],
      list: [
        "data bażika — isem, indirizz tal-email, numru tat-telefon, lingwa u munita, password f'forma kriptata;",
        "data tal-ibbukkjar — l-akkomodazzjoni bbukkjata, il-perjodu, in-numru u l-ismijiet tal-vjaġġaturi, xewqat speċjali, l-istat tal-ibbukkjar;",
        "data tal-ħlas — ammont, munita, stat tal-ħlas, l-aħħar ċifri tal-mezz ta' ħlas u l-identifikatur tat-tranżazzjoni tal-fornitur tagħna ta' servizzi ta' ħlas. Dettalji sħaħ tal-karti ma jaslux għandna;",
        "data ta' komunikazzjoni — messaġġi bejnek u l-fornitur, mistoqsijiet lis-servizz tal-klijenti tagħna, ilmenti;",
        "data ta' kontenut — reviżjonijiet, ritratti, listi tax-xewqat;",
        "data tal-użu — paġni miżjura, mistoqsijiet ta' tfittxija, ħin tal-aċċess;",
        "data teknika — indirizz IP, identifikaturi tal-browser u tal-apparat, sistema operattiva, paġna ta' riferiment.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Skopijiet u bażijiet legali",
      paragraphs: [
        "Il-forniment tal-Pjattaforma, il-kont, it-tfittxija, l-ibbukkjar, l-ipproċessar tal-ħlasijiet u l-komunikazzjoni mal-fornitur — l-Artikolu 6(1)(b) tal-GDPR (kuntratt jew miżuri prekuntrattwali).",
        "Servizz tal-klijenti, trattament tal-ilmenti u riżoluzzjoni ta' tilwim — l-Artikolu 6(1)(b) u (f) tal-GDPR.",
        "Il-kxif u l-prevenzjoni ta' frodi, abbuż u inċidenti ta' sigurtà, l-infurzar tat-termini tagħna — l-Artikolu 6(1)(f) tal-GDPR (interess leġittimu f'suq sikur).",
        "Ir-reviżjonijiet u l-pubblikazzjoni tagħhom — l-Artikolu 6(1)(b) u (f) tal-GDPR.",
        "It-twettiq ta' obbligi legali, b'mod partikolari obbligi kummerċjali u fiskali ta' żamma, obbligi ta' rapportar skont id-Direttiva (UE) 2021/514 (DAC7) u obbligi skont ir-Regolament (UE) 2022/2065 — l-Artikolu 6(1)(c) tal-GDPR.",
        "It-titjib tal-Pjattaforma permezz tal-analiżi ta' data aggregata tal-użu — l-Artikolu 6(1)(f) tal-GDPR.",
        "Emails ta' reklamar u cookies mhux meħtieġa — l-Artikolu 6(1)(a) tal-GDPR (kunsens), li tista' tirtira f'kull ħin b'effett għall-futur.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Riċevituri",
      paragraphs: [
        "Il-fornituri jirċievu d-data li jeħtieġu biex iwettqu l-ibbukkjar tiegħek u biex jissodisfaw l-obbligi legali tagħhom — b'mod partikolari l-isem, id-dettalji ta' kuntatt, il-perjodu, in-numru ta' vjaġġaturi u l-messaġġi tiegħek lilhom.",
        "Il-fornitur tagħna ta' servizzi ta' ħlas Stripe jipproċessa d-data tal-ħlas bħala kontrollur indipendenti; tapplika wkoll il-[Politika ta' privatezza ta' Stripe](https://stripe.com/privacy).",
        "Il-fornituri ta' servizzi li jwettqu għalina l-hosting, it-tħaddim tad-databases, il-bgħit ta' emails, id-dijanjostika tal-iżbalji u l-għodod tas-servizz tal-klijenti jipproċessaw id-data esklużivament skont l-istruzzjonijiet tagħna abbażi ta' kuntratt skont l-Artikolu 28 tal-GDPR.",
        "L-awtoritajiet u l-qrati jirċievu data biss sa fejn inkunu obbligati; ara l-[Politika għal talbiet ta' awtoritajiet u ta' korpi tal-infurzar tal-liġi](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "L-awtoritajiet fiskali jirċievu d-data tal-fornituri li għandha tiġi rrapportata skont DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Trasferiment lejn pajjiżi terzi",
      paragraphs: [
        "Is-servers tagħna u s-servers tal-proċessuri tagħna jinsabu fl-Unjoni Ewropea.",
        "Jekk f'każijiet individwali jsir ipproċessar barra ż-Żona Ekonomika Ewropea, dan isir biss abbażi ta' deċiżjoni ta' adegwatezza tal-Kummissjoni Ewropea jew ta' klawżoli kuntrattwali standard skont l-Artikolu 46(2)(c) tal-GDPR flimkien ma' garanziji supplimentari.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Perjodi ta' żamma",
      paragraphs: [
        "Id-data tal-kont inżommuha sakemm jeżisti l-kont tiegħek u wara nħassruha, sakemm ma jkunx hemm obbligu ta' żamma.",
        "Id-data tal-ibbukkjar u tal-ħlas hija suġġetta għal termini kummerċjali u fiskali ta' żamma; skont il-liġi tal-kontabbiltà Daniża dawn huma bħala regola ħames snin mit-tmiem tas-sena kontabilistika li għaliha tirreferi d-data.",
        "Il-messaġġi relatati ma' ibbukkjar inżommuhom sa tliet snin wara t-tmiem tas-soġġorn, biex ikun possibbli li jiġu ċċarati t-tilwimiet.",
        "Ir-reviżjonijiet jibqgħu wara t-tħassir tal-kont tiegħek f'forma anonimizzata, għaliex huma parti mill-bażi ta' evalwazzjoni tal-akkomodazzjoni.",
        "Id-data dwar każijiet ta' frodi u abbuż inżommuha sakemm ikun meħtieġ biex jiġu evitati ksur ulterjuri, iżda mhux iktar minn tliet snin mill-aħħar każ.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Id-drittijiet tiegħek",
      paragraphs: ["Skont il-GDPR għandek id-drittijiet li ġejjin:"],
      list: [
        "aċċess għad-data maħżuna dwarek (Artikolu 15);",
        "rettifika ta' data skorretta (Artikolu 16);",
        "tħassir (Artikolu 17), sakemm ma jkunx hemm obbligu ta' żamma;",
        "restrizzjoni tal-ipproċessar (Artikolu 18);",
        "portabbiltà tad-data (Artikolu 20);",
        "oġġezzjoni għall-ipproċessar ibbażat fuq interessi leġittimi (Artikolu 21), b'mod partikolari għall-kummerċjalizzazzjoni diretta;",
        "irtirar ta' kunsens mogħti b'effett għall-futur (Artikolu 7(3));",
        `ilment quddiem awtorità superviżorja (Artikolu 77) — kompetenti hija l-awtorità tal-post ta' residenza, tal-post tax-xogħol jew tal-post tal-allegat ksur tiegħek. Fis-sede tal-kontrollur din hija ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, id-Danimarka, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Kif teżerċita d-drittijiet tiegħek",
      paragraphs: [
        `Ħafna data tista' tarawha, tibdilha jew tħassarha direttament fil-kont tiegħek. Għal kull ħaġa oħra ikkuntattja ${ANBIETER.email}.`,
        "Inwieġbu mingħajr dewmien, l-iktar tard fi żmien xahar. Jekk ma nkunux nistgħu nżommu t-terminu, ngħidulek b'motivazzjoni.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Deċiżjonijiet awtomatizzati",
      paragraphs: [
        "Nużaw proċeduri awtomatizzati għall-kxif ta' frodi, abbuż u kontenut illegali. Jekk tali proċedura twassal għal miżura kontra l-kont jew il-kontenut tiegħek, nimmotivawha u tista' titlob eżami minn bniedem.",
        "Deċiżjoni bbażata esklużivament fuq ipproċessar awtomatizzat b'effetti legali fis-sens tal-Artikolu 22 tal-GDPR ma nieħdux.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obbligu li tipprovdi data",
      paragraphs: [
        "Id-data meħtieġa għal ibbukkjar trid tipprovdiha; mingħajrha ma jistax jiġi konkluż kuntratt u lanqas ma tista' tiġi pprovduta akkomodazzjoni. Id-data l-oħra kollha hija volontarja.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Emendi ta' din il-politika",
      paragraphs: [
        "Naġġustaw din il-politika meta l-ipproċessar jew is-sitwazzjoni legali tinbidel. Il-verżjoni fis-seħħ hija disponibbli hawn; id-data tal-aġġornament hija indikata fuq nett.",
      ],
    },
  ],
};
