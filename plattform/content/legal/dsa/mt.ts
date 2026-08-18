import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Att dwar is-Servizzi Diġitali",
  stand: "Aġġornat: 18 ta' Awwissu 2026",
  intro: [
    "myBestDays huwa servizz intermedjarju u pjattaforma online fis-sens tar-Regolament (UE) 2022/2065 dwar Suq Uniku għas-Servizzi Diġitali (Att dwar is-Servizzi Diġitali, DSA). Din il-paġna tiġbor id-dettalji u l-proċeduri li dan ir-regolament jitlob.",
    "myBestDays mhijiex pjattaforma online kbira ħafna fis-sens tal-Artikolu 33 tar-regolament. L-obbligi addizzjonali applikabbli għal dawk — l-identifikazzjoni ta' riskji sistemiċi, awditjar indipendenti, arkivju tar-reklami u l-pubblikazzjoni tan-numru ta' utenti fix-xahar bil-proċedura prevista hemm — għalhekk ma jikkonċernawniex.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Punti ta' kuntatt (Artikoli 11 u 12)",
      paragraphs: [
        `Punt uniku ta' kuntatt għall-awtoritajiet tal-Istati Membri, għall-Kummissjoni u għall-Bord Ewropew għas-Servizzi Diġitali: ${ANBIETER.email}, bil-posta ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, id-Danimarka.`,
        `Punt uniku ta' kuntatt għall-utenti: ${ANBIETER.email}. Hemm tilħaqna direttament u mingħajr stadju awtomatizzat intermedju.`,
        "Maż-żewġ punti ta' kuntatt tista' ssir komunikazzjoni bil-Ġermaniż, bid-Daniż u bl-Ingliż.",
        "Rappreżentant legali fl-Unjoni skont l-Artikolu 13 mhuwiex meħtieġ: l-operatur huwa stabbilit fid-Danimarka u għalhekk fl-Unjoni.",
        `Koordinatur kompetenti tas-Servizzi Diġitali skont l-Artikolu 49: ${DSA_KOORDINATOR.name}, id-Danimarka ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Rapportar ta' kontenut illegali (Artikolu 16)",
      paragraphs: [
        "Kull persuna tista' tirrapportalna kontenut li tqis illegali. Uża għal dan il-funzjoni ta' rapportar disponibbli f'kull reklam, f'kull reviżjoni u f'kull messaġġ, jew il-punt ta' kuntatt għall-utenti.",
        "Biex inkunu nistgħu nevalwaw rapport mingħajr eżami legali dettaljat, dan għandu jinkludi:",
      ],
      list: [
        "spjegazzjoni motivata biżżejjed dwar għaliex il-kontenut huwa illegali;",
        "il-post elettroniku eżatt, b'mod partikolari l-URL;",
        "l-isem u l-indirizz tal-email tal-persuna li tirrapporta — ħlief għal rapporti dwar reati kontra l-awtodeterminazzjoni sesswali tat-tfal, fejn din l-indikazzjoni hija volontarja;",
        "dikjarazzjoni li d-dettalji huma, skont l-aħjar għarfien, korretti u sħaħ.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kif nittrattaw ir-rapporti",
      paragraphs: [
        "Nikkonfermaw l-irċevuta mingħajr dewmien u niddeċiedu fil-ħin, bir-reqqa, mingħajr arbitrarjetà u b'mod oġġettiv.",
        "Jekk rapport ikun fih id-dettalji tat-taqsima 2, dan jistabbilixxi l-għarfien tagħna fis-sens tal-Artikolu 6 tar-regolament.",
        "Dwar id-deċiżjoni tagħna ninfurmaw lill-persuna li rrapportat u nindikaw ir-rimedji legali.",
        "F'każ ta' trattament awtomatizzat ngħidu dan.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivazzjoni tal-miżuri (Artikolu 17)",
      paragraphs: [
        "Jekk nillimitaw il-viżibbiltà ta' kontenut, inneħħuh, nimblukkaw l-aċċess għalih, nissospendu ħlasijiet, il-forniment tas-servizz jew il-kont, il-persuna kkonċernata tirċievi motivazzjoni ċara u speċifika.",
        "Il-motivazzjoni ssemmi n-natura u l-portata tal-miżura, il-kamp ta' applikazzjoni territorjali u temporali tagħha, il-fatti u ċ-ċirkostanzi tad-deċiżjoni, jekk kienx involut ipproċessar awtomatizzat, il-bażi legali jew id-dispożizzjoni kuntrattwali miksura u r-rimedji legali disponibbli.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Suspett ta' reat (Artikolu 18)",
      paragraphs: [
        "Jekk ikun hemm indikazzjonijiet ta' reat li joħloq periklu għall-ħajja jew għas-sigurtà ta' persuna, ninfurmaw mingħajr dewmien lill-awtoritajiet kompetenti tal-infurzar tal-liġi jew ġudizzjarji.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Proċedura interna tal-ilmenti (Artikolu 20)",
      paragraphs: [
        "Kontra kull miżura tat-taqsima 4 u kontra ċ-ċaħda ta' rapport jista' jitressaq ilment bla ħlas fi żmien sitt xhur.",
        "L-ilmenti jiġu ttrattati fil-ħin, mingħajr diskriminazzjoni u bir-reqqa — taħt is-superviżjoni ta' persuni kwalifikati u mhux esklużivament b'mezzi awtomatizzati.",
        "Jekk ilment jirriżulta fondat, nirtiraw il-miżura. It-triq hija deskritta fit-taqsima [Ilmenti u riżoluzzjoni ta' tilwim](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Riżoluzzjoni extraġudizzjarja ta' tilwim (Artikolu 21)",
      paragraphs: [
        "Għal tilwim dwar miżuri tat-taqsima 4 l-utenti jistgħu jirrikorru għal korp ta' riżoluzzjoni extraġudizzjarja ta' tilwim iċċertifikat mill-Koordinatur kompetenti tas-Servizzi Diġitali. Il-lista tal-korpi ċċertifikati tinżamm mill-Kummissjoni Ewropea.",
        "Id-deċiżjonijiet ta' dawn il-korpi mhumiex vinkolanti għalina; m'aħniex obbligati nipparteċipaw fi proċeduri ta' fornituri indipendenti. It-triq lejn il-qrati tibqa' intatta.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Flaggers fdati (Artikolu 22)",
      paragraphs: [
        "Ir-rapporti mressqa minn entità rikonoxxuta bħala flagger fdat fil-qasam ta' kompetenza tagħha nittrattawhom bi prijorità.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Miżuri kontra l-abbuż (Artikolu 23)",
      paragraphs: [
        "Il-kontijiet li permezz tagħhom jiġi pprovdut spiss kontenut manifestament illegali nimblukkawhom wara twissija minn qabel għal perjodu raġonevoli.",
        "It-trattament ta' rapporti u lmenti nissospenduh għal persuni li ripetutament iressqu rapporti jew ilmenti manifestament infondati — ukoll wara twissija minn qabel.",
        "Dejjem neżaminaw il-każ individwali: in-numru, is-sehem u l-gravità tal-atti kkonċernati kif ukoll l-intenzjoni.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Rapporti ta' trasparenza (Artikoli 15 u 24)",
      paragraphs: [
        "Nippubblikaw kull sena rapport dwar il-moderazzjoni tal-kontenut: in-numru ta' ordnijiet uffiċjali, in-numru u t-tip ta' rapporti, il-miżuri meħuda, in-numru ta' lmenti u l-eżitu tagħhom, dettalji dwar l-użu ta' proċeduri awtomatizzati kif ukoll in-numru ta' tilwim quddiem korpi extraġudizzjarji.",
        `L-intrapriżi mikro u ż-żgħar huma eżentati skont l-Artikolu 19 tar-regolament minn parti minn dawn l-obbligi. Sakemm tapplika l-eżenzjoni, nipprovdu d-dettalji fuq talba fuq ${ANBIETER.email}; hekk kif jiġi ppubblikat l-ewwel rapport, dan jiġi llinkjat hawn.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Traċċabbiltà tal-kummerċjanti (Artikoli 30 sa 32)",
      paragraphs: [
        "Il-fornituri li jaġixxu fuq il-Pjattaforma fil-qafas tal-attività kummerċjali tagħhom jistgħu joffru biss wara li jkunu bagħtulna l-isem, l-indirizz, in-numru tat-telefown, l-indirizz tal-email, id-dettalji tar-reġistru, in-numru ta' identifikazzjoni tal-VAT u l-kont tal-ħlas u d-dettalji tagħhom ikunu plawżibbli.",
        "Dawn id-dettalji nurwuhom fir-reklam, sa fejn ir-regolament jipprevedi dan.",
        "Jekk insiru nafu li reklam kien jikkonċerna prodott illegali jew servizz illegali, ninfurmaw lill-mistednin ikkonċernati, sakemm ikollna d-dettalji ta' kuntatt tagħhom.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Sistemi ta' rakkomandazzjoni (Artikolu 27)",
      paragraphs: [
        "Il-parametri prinċipali tal-ordni tar-riżultati tat-tfittxija u tar-rakkomandazzjonijiet, kif ukoll il-possibbiltà li tinfluwenzahom, huma deskritti fit-taqsima [Prezzijiet, klassifikazzjoni u rakkomandazzjonijiet](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklamar (Artikolu 26)",
      paragraphs: [
        "Bħalissa ma nurux reklamar imħallas ta' terzi u lanqas pożizzjonamenti mħallsa fir-riżultati tat-tfittxija.",
        "Jekk nintroduċu r-reklamar, nimmarkawh b'mod ċar, insemmu lil min jirreklama u l-parametri prinċipali tat-tqassim. Ir-reklamar ibbażat fuq kategoriji speċjali ta' data personali skont l-Artikolu 9 tar-Regolament (UE) 2016/679 u r-reklamar lil minorenni abbażi ta' tfassil ta' profili neskluduhom.",
      ],
    },
  ],
};
