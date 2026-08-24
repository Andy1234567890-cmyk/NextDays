// Maltesische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter) und werden von dort
// in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Ftehim dwar l-Ipproċessar tad-Data",
  metaDescription:
    "Ipproċessar tad-data f’isem il-kontrollur skont l-Artikolu 28 tal-GDPR bejn myNextDays ApS u n-negozji li jużaw il-pjattaforma: suġġett, istruzzjonijiet, sigurtà, subproċessuri.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Dan il-ftehim (minn hawn ’il quddiem id-“DPA”) japplika bejn in-negozju li juża l-pjattaforma myNextDays (minn hawn ’il quddiem il-“kontrollur”) u ${ANBIETER.firma} (minn hawn ’il quddiem il-“proċessur” jew “aħna”) u jagħti effett konkret lill-obbligi li jirriżultaw mill-Artikolu 28 tar-Regolament (UE) 2016/679 (GDPR).`,
    `Huwa inkorporat permezz tat-[Termini u Kundizzjonijiet Ġenerali](${AGB_URL}) u japplika għat-tul kollu tal-użu tal-pjattaforma. Jipprevali fuq it-Termini u Kundizzjonijiet Ġenerali sa fejn ikun involut l-ipproċessar ta’ data personali f’isem il-kontrollur.`,
    "B’mod supplimentari, l-[Avviż dwar il-Protezzjoni tad-Data](/datenschutz) japplika għad-data li nipproċessaw bħala kontrolluri fid-dritt tagħna stess — b’mod partikolari d-data tal-kont u tar-relazzjoni kummerċjali.",
  ],
  sections: [
    {
      heading: "Suġġett u tqassim tar-rwoli",
      unterpunkte: [
        {
          paragraphs: [
            "Is-suġġett huwa l-ipproċessar ta’ data personali li l-kontrollur idaħħal fil-pjattaforma jew jiġbor permezz tagħha, sabiex inkunu nistgħu nipprovdu s-servizzi miftiehma kuntrattwalment: il-ġestjoni ta’ proprjetajiet, riżervazzjonijiet u okkupazzjoni, il-komunikazzjoni mal-mistednin, l-ipproċessar tal-ħlasijiet, il-kontabbiltà u r-rendikonti tas-sidien, il-konnessjoni ma’ portali ta’ prenotazzjoni, il-page builder għas-siti web, kif ukoll il-ġestjoni tal-kompiti u tat-tim.",
          ],
        },
        {
          paragraphs: [
            "Il-kontrollur jiddeċiedi dwar l-għanijiet u l-mezzi ta’ dan l-ipproċessar. Aħna nipproċessaw id-data esklussivament fuq l-istruzzjoni dokumentata tiegħu u mhux għal għanijiet tagħna stess.",
          ],
        },
        {
          paragraphs: [
            "Fir-rigward tad-data tal-kont, tal-fatturazzjoni tas-servizzi tagħna stess, tas-sigurtà tas-sistemi u taż-żamma statutorja, aħna stess inkunu l-kontrollur. Dan l-ipproċessar mhuwiex is-suġġett ta’ dan id-DPA.",
          ],
        },
      ],
    },
    {
      heading: "Natura, ambitu u għan tal-ipproċessar",
      paragraphs: [
        "L-ipproċessar isir bil-ġbir, il-ħażna, il-wiri, il-modifika, it-trażmissjoni lil riċevituri magħżula mill-kontrollur (eż. portali ta’ prenotazzjoni, fornituri ta’ servizzi ta’ ħlas), ir-restrizzjoni u t-tħassir — f’forma awtomatizzata fil-pjattaforma.",
        "Il-post tal-ipproċessar huwa l-Unjoni Ewropea; l-eċċezzjonijiet huma elenkati b’mod eżawrjenti fit-Taqsima 8.",
      ],
    },
    {
      heading: "Kategoriji ta’ suġġetti tad-data",
      list: [
        "Mistednin u persuni li jagħmlu l-prenotazzjoni, inklużi l-persuni li jivvjaġġaw magħhom",
        "Persuni interessati li jagħmlu mistoqsijiet jew jibagħtu messaġġi",
        "Sidien tal-proprjetajiet amministrati",
        "Impjegati tal-kontrollur (tim, tindif, servizz, reception)",
        "Persuni ta’ kuntatt ta’ sħab u ta’ fornituri ta’ servizzi tal-kontrollur",
      ],
    },
    {
      heading: "Kategoriji ta’ data personali",
      list: [
        "Data bażika: isem, indirizz, data tat-twelid jekk tiġi rreġistrata, ċittadinanza jekk tiġi rreġistrata għall-obbligu ta’ reġistrazzjoni",
        "Data ta’ kuntatt: indirizz elettroniku, numru tat-telefon",
        "Data tal-prenotazzjoni: perjodu, proprjetà, numru ta’ vjaġġaturi, prezzijiet, servizzi addizzjonali, kanċellazzjonijiet",
        "Data tal-ħlas: ammont, munita, metodu ta’ ħlas, stat tal-ħlas, referenzi (id-dettalji sħaħ tal-karta ma jaslux fis-sistemi tagħna)",
        "Data ta’ komunikazzjoni: messaġġi, noti, reċensjonijiet",
        "Data ta’ aċċess u ta’ użu tal-impjegati: rwol, permessi, ħin tal-login, apparat u indirizz IP tal-login",
        "Kategoriji speċjali skont l-Artikolu 9 tal-GDPR mhumiex is-suġġett tal-inkarigu; il-kontrollur ma jdaħħalx tali data fl-oqsma ta’ test liberu.",
      ],
    },
    {
      heading: "Istruzzjonijiet",
      unterpunkte: [
        {
          paragraphs: [
            "L-istruzzjonijiet jingħataw mill-kontrollur permezz tal-użu u tal-konfigurazzjoni tal-pjattaforma, kif ukoll f’forma testwali lill-indirizz ta’ kuntatt tagħna. L-istruzzjonijiet orali nikkonfermawhom f’forma testwali.",
          ],
        },
        {
          paragraphs: [
            "Jekk inqisu istruzzjoni bħala illegali, ninfurmaw dwar dan mingħajr dewmien żejjed u nistgħu nissospendu l-implimentazzjoni sakemm il-kontrollur jikkonfermaha jew jibdilha.",
          ],
        },
        {
          paragraphs: [
            "Jekk inkunu obbligati bil-liġi li nipproċessaw (pereżempju fil-konfront tal-awtoritajiet), ninfurmaw lill-kontrollur bil-quddiem, sa fejn dan ikun legalment permess.",
          ],
        },
        {
          titel: "Konnessjoni ta’ servizzi proprji tal-kontrollur",
          paragraphs: [
            "Il-kontrollur jista’ jgħaqqad il-kont tiegħu permezz ta’ interfaċċa ma’ servizz li huwa stess għażel u li miegħu kkonkluda kuntratt tiegħu — pereżempju assistent tal-intelliġenza artifiċjali. Jekk jagħti tali konnessjoni, dik hija l-istruzzjoni espressa tiegħu skont l-Artikolu 28(3)(a) tal-GDPR biex id-data rilaxxata tingħata lil dan is-servizz. Hija tinkludi espressament ukoll trażmissjoni marbuta magħha lejn pajjiż terz, jekk is-servizz ikun stabbilit barra mill-Unjoni Ewropea.",
            "Fil-qosor: dwar tali konnessjoni jiddeċiedi l-kontrollur waħdu, u għas-servizz konness huwa stess ikun responsabbli.",
            "Tista’ tingħata biss minn kont bil-permess li jamministra konnessjonijiet esterni. Dan il-permess huwa riservat għar-rwol “Amministratur”; kontijiet bi drittijiet limitati — inkluż ir-rwol “Ko-amministratur” — ma jistgħux jagħtu konnessjoni. Aħna nirreġistraw min tahom, meta u għal liema servizz, liema tipi ta’ data ġew rilaxxati u liema aċċessi saru; dan ir-reġistru huwa disponibbli għall-kontrollur fl-interfaċċa taħt “Kont → Konnessjonijiet”, sabiex ikun jista’ jissodisfa l-obbligu tiegħu ta’ rendikont u jwieġeb talbiet ta’ aċċess.",
            "Is-servizz konness mhuwiex subproċessur tagħna: aħna ma nagħtuhx inkarigu, ma nagħżluhx u ma nagħtuhx istruzzjonijiet. Huwa jipproċessa d-data abbażi tal-kuntratt li l-kontrollur innifsu kkonkluda miegħu. Għal dan l-ipproċessar, għall-bażi legali tiegħu u għall-garanziji tat-trażmissjoni lejn pajjiż terz huwa għalhekk il-kontrollur li huwa responsabbli; dan mhuwiex is-suġġett ta’ dan id-DPA.",
            "L-oqsma ta’ test liberu — in-noti tal-prenotazzjoni u l-kontenut tal-messaġġi tal-mistednin — huma esklużi b’mod awtomatiku minn tali konnessjoni. Jistgħu jinkludu kategoriji speċjali ta’ data personali skont l-Artikolu 9 tal-GDPR, pereżempju informazzjoni dwar is-saħħa. Il-kontrollur għandu jirrilaxxahom separatament meta jagħti l-konnessjoni; mingħajr dan ir-rilaxx ma jiġux trażmessi.",
            "Il-kontrollur jista’ jaqta’ konnessjoni mogħtija fi kwalunkwe ħin fl-interfaċċa. It-tokens ta’ tiġdid jitħassru b’dan, u f’kull aċċess ulterjuri jiġi vverifikat jekk il-kunsens ikun għadu jeżisti — servizz maqtugħ għalhekk ma jkunx jista’ jaqra iżjed xejn immedjatament, u mhux biss wara li jiskadi t-token ta’ aċċess tiegħu.",
          ],
        },
      ],
    },
    {
      heading: "Kunfidenzjalità",
      paragraphs: [
        "Il-persuni kollha li, skont l-inkarigu, jista’ jkollhom aċċess għad-data huma marbuta bil-kunfidenzjalità u jiġu mgħallma regolarment dwar il-protezzjoni tad-data. L-aċċess huwa limitat għall-punt meħtieġ għall-kompitu rispettiv.",
        "L-aċċessi tal-impjegati tagħna għad-data tal-klijenti jsiru biss għall-korrezzjoni ta’ ħsarat, fuq talba ta’ appoġġ jew għat-twettiq ta’ obbligi statutorji.",
      ],
    },
    {
      heading: "Sigurtà tal-ipproċessar",
      paragraphs: [
        "Aħna nieħdu l-miżuri tekniċi u organizzattivi meħtieġa skont l-Artikolu 32 tal-GDPR. B’mod partikolari huma implimentati:",
      ],
      list: [
        "Kriptaġġ tat-trasport (TLS) għall-konnessjonijiet kollha, headers ta’ sigurtà HTTP inkluża Content-Security-Policy stretta",
        "Separazzjoni tad-data ta’ kull negozju direttament fid-database: regoli ta’ aċċess fuq il-livell tar-ringieli (Row Level Security) flimkien ma’ drittijiet tat-tabelli revokati għad-data sensittiva, b’mod li aċċess barra min-negozju proprju jkun eskluż ukoll permezz tat-triq diretta tad-database",
        "Permessi bbażati fuq ir-rwoli b’separazzjoni tad-data: il-persunal tas-servizz u tat-tindif ma jirċevix data finanzjarja u ta’ bejgħ, is-sidien jirċievu biss il-proprjetajiet tagħhom stess; id-data tal-mistednin tiġi maskrata għar-rwoli mhux awtorizzati",
        "Awtentikazzjoni b’żewġ fatturi (TOTP) disponibbli għall-kontijiet; login mill-ġdid f’każ ta’ bidliet kritiċi għas-sigurtà",
        "Reġistru tal-logins bl-apparat, il-ħin u l-indirizz IP, li jista’ jarah il-kontrollur",
        "Konnessjonijiet ma’ servizzi esterni jistgħu jingħataw biss minn kont bir-rwol “Amministratur”; kull aċċess permezz ta’ tali konnessjoni jiġi rreġistrat (għodda, ħin, ambitu — mingħajr il-kontenut innifsu) u jista’ jarah il-kontrollur. Konnessjoni maqtugħa titlef l-aċċess immedjatament: f’kull aċċess jiġi vverifikat jekk il-kunsens ikun għadu jeżisti",
        "Limitazzjoni tal-frekwenza tat-talbiet kontra attakki awtomatizzati, verifika tal-firem tas-sejħiet Webhook li jaslu",
        "Kopji ta’ sigurtà kriptati, miżmuma barra mis-sistema ta’ produzzjoni, bi test regolari ta’ rkupru",
        "Ambjenti separati għall-iżvilupp u għat-tħaddim; bidliet fid-database esklussivament permezz ta’ migrazzjonijiet verżjonati",
      ],
    },
    {
      heading: "Subproċessuri",
      paragraphs: [
        "Il-kontrollur japprova l-użu tas-subproċessuri li ġejjin. Ma’ kull wieħed minnhom jeżistu kuntratti skont l-Artikolu 28(4) tal-GDPR bi obbligi li jikkorrispondu għal dan id-DPA.",
      ],
      list: [
        "Hetzner Online GmbH, il-Ġermanja (servers, database, midja, mail server; ċentru tad-data f’Helsinki, il-Finlandja)",
        "Stripe Payments Europe, Limited, l-Irlanda (ħlasijiet, pagamenti, verifika statutorja tal-identità)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., il-Lussemburgu (ħlasijiet, jekk il-kontrollur jattivahom)",
        "Channex.io Ltd, ir-Renju Unit (konnessjoni ma’ portali ta’ prenotazzjoni, jekk attivata)",
        "Meta Platforms Ireland Limited, l-Irlanda (messaġġi WhatsApp, jekk attivati)",
        "Google Ireland Limited, l-Irlanda (traduzzjoni ta’ kontenut; login bil-Google, jekk jintuża)",
        "Groq, Inc., l-Istati Uniti (proposti ta’ tweġiba fil-kaxxa tad-dħul, jekk attivati)",
        "Cloudflare, Inc., l-Istati Uniti (ġestjoni tar-rekords DNS għal dominji proprji, jekk jintuża)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Bidla jew żieda nikkomunikawha mill-inqas 30 jum bil-quddiem. Il-kontrollur jista’ joġġezzjona f’dan it-terminu għal raġuni importanti marbuta mal-protezzjoni tad-data; jekk l-oġġezzjoni ma tiġix riżolta, huwa jista’ jittermina l-parti tas-servizz ikkonċernata jew il-kuntratt.",
          ],
        },
        {
          paragraphs: [
            "Servizzi li l-kontrollur jiftiehem huwa stess ma’ parti terza mhumiex subipproċessar, iżda trażmissjoni mnedija minnu. Dan japplika għal portal ta’ prenotazzjoni li miegħu jkollu kuntratt tiegħu, kif ukoll għal assistent tal-intelliġenza artifiċjali jew programm ieħor li jgħaqqad mal-kont tiegħu permezz tal-interfaċċa (ara t-Taqsima “Istruzzjonijiet”).",
            "Dak li jgħodd mhuwiex minn liema sistemi tgħaddi d-data, iżda min iġib is-servizz: subipproċessar jinħoloq meta AĦNA nagħtu inkarigu lil fornitur ta’ servizz ulterjuri sabiex nipprovdu s-servizz tagħna. Jekk il-kontrollur jagħżel is-servizz huwa stess u jikkonkludi l-kuntratt miegħu, dak is-servizz jipproċessa għall-kontrollur — mhux għalina. Din id-distinzjoni tikkorrispondi għall-prattika kuntrattwali ta’ fornituri komparabbli fir-rigward ta’ servizzi ta’ partijiet terzi konnessi mill-klijent.",
          ],
        },
      ],
    },
    {
      heading: "Trażmissjoni lejn pajjiżi terzi",
      paragraphs: [
        "It-trażmissjonijiet lil riċevituri barra mill-UE huma limitati għas-servizzi msemmija hawn fuq li huma stabbiliti fl-Istati Uniti jew fir-Renju Unit. Il-bażi hija l-klawżoli kuntrattwali standard tal-Kummissjoni Ewropea skont l-Artikolu 46(2)(c) tal-GDPR jew deċiżjoni ta’ adegwatezza fis-seħħ; jiġu applikati miżuri ta’ protezzjoni supplimentari (kriptaġġ, minimizzazzjoni tad-data).",
      ],
    },
    {
      heading: "Appoġġ għall-kontrollur",
      unterpunkte: [
        {
          paragraphs: [
            "Aħna nappoġġjaw lill-kontrollur fit-tweġiba tat-talbiet tas-suġġetti tad-data (l-Artikoli 15 sa 22 tal-GDPR). Il-pjattaforma toffri għal dan l-aċċess, ir-rettifika, l-esportazzjoni u t-tħassir tad-data direttament fl-interfaċċa. Jekk suġġetti tad-data jindirizzaw lilna direttament, aħna nirreferuhom lill-kontrollur u ninfurmawh.",
          ],
        },
        {
          paragraphs: [
            "Aħna nappoġġjaw ukoll fil-valutazzjonijiet tal-impatt fuq il-protezzjoni tad-data, fl-osservanza tal-obbligi li jirriżultaw mill-Artikoli 32 sa 36 tal-GDPR u fit-talbiet tal-awtoritajiet superviżorji.",
          ],
        },
      ],
    },
    {
      heading: "Ksur tal-protezzjoni tad-data personali",
      paragraphs: [
        "Jekk isir magħruf lilna ksur tal-protezzjoni tad-data personali li jaffettwa d-data tal-kontrollur, ninfurmawh mingħajr dewmien żejjed, l-aktar tard fi żmien 48 siegħa minn meta nsiru nafu, f’forma testwali.",
        "Il-komunikazzjoni tinkludi, sa fejn ikun magħruf, in-natura u l-ħin tal-inċident, il-kategoriji ta’ data u l-gruppi ta’ persuni affettwati, il-konsegwenzi probabbli u l-miżuri meħuda kif ukoll dawk proposti. Aħna nappoġġjaw lill-kontrollur fl-obbligi tiegħu ta’ notifika u ta’ komunikazzjoni skont l-Artikoli 33 u 34 tal-GDPR.",
      ],
    },
    {
      heading: "Provi u kontrolli",
      unterpunkte: [
        {
          paragraphs: [
            "Aħna nuru l-konformità ma’ dan id-DPA fuq talba, b’mod partikolari permezz ta’ informazzjoni dwar il-miżuri meħuda u dwar is-subproċessuri użati.",
          ],
        },
        {
          paragraphs: [
            "Il-kontrollur jista’ jwettaq kontrolli fl-ambitu meħtieġ jew jitlob li jsiru minn awditur indipendenti li ma jkunx f’kompetizzjoni magħna. Il-kontrolli jsiru wara avviż bi terminu raġonevoli, matul il-ħinijiet tax-xogħol tas-soltu u mingħajr tfixkil tal-operat. L-ispejjeż ta’ verifika li tmur lil hinn mill-informazzjoni jinġarru mill-kontrollur, sakemm il-verifika ma tkunx ikkawżata minn inċident li nkunu kkawżajna aħna.",
          ],
        },
      ],
    },
    {
      heading: "Tħassir u restituzzjoni",
      paragraphs: [
        "Wara t-tmiem tal-kuntratt, fuq talba, aħna nqiegħdu d-data tal-kontrollur għad-dispożizzjoni għall-esportazzjoni fi żmien 30 jum f’format komuni u li jinqara mill-magni. Wara dan inħassru d-data, inklużi l-kopji.",
        "Hija eskluża d-data li għaliha jeżisti obbligu statutorju ta’ żamma (b’mod partikolari data tal-fatturi u tal-kontabbiltà); din tiġi mblukkata u titħassar wara li jiskadi t-terminu. Il-kopji ta’ sigurtà jiġu sovraskritti biċ-ċiklu regolari ta’ rotazzjoni.",
      ],
    },
    {
      heading: "Responsabbiltà u ordni ta’ prijorità",
      paragraphs: [
        "Japplika l-Artikolu 82 tal-GDPR. Fir-relazzjoni bejn il-partijiet japplikaw ukoll, flimkien miegħu, ir-regoli tar-responsabbiltà tat-Termini u Kundizzjonijiet Ġenerali, sa fejn ma jmorrux kontra l-GDPR.",
        "Jekk it-Termini u Kundizzjonijiet Ġenerali u dan id-DPA jmorru kontra xulxin fir-rigward tal-ipproċessar f’isem il-kontrollur, japplika dan id-DPA. Jekk dispożizzjoni ssir invalida, il-kontenut li jifdal jibqa’ validu; il-partijiet jissostituwuha bi regola ammissibbli bl-istess għan.",
      ],
    },
    {
      heading: "Bidliet f’dan il-ftehim",
      paragraphs: [
        "Aħna nistgħu naġġustaw dan id-DPA sa fejn dan ikun meħtieġ minħabba bidliet fil-liġi, rekwiżiti tal-awtoritajiet superviżorji, rekwiżiti tal-fornituri ta’ servizzi ta’ ħlas jew żviluppi tekniċi, u l-kontrollur ma jitqiegħedx f’pożizzjoni agħar b’dan.",
        "Il-bidliet inħabbruhom f’forma testwali mill-inqas 30 jum qabel ma jidħlu fis-seħħ. Jekk il-kontrollur ma joġġezzjonax f’dan it-terminu, jitqiesu aċċettati; din il-konsegwenza tiġi indikata fit-tħabbira. F’każ ta’ oġġezzjoni, kull parti tista’ tittermina l-kuntratt fid-data tad-dħul fis-seħħ.",
      ],
    },
    {
      heading: "Kuntatt",
      paragraphs: [
        `It-talbiet dwar dan il-ftehim, l-istruzzjonijiet u n-notifiki indirizzahom lil [${ANBIETER.email}](mailto:${ANBIETER.email}) jew lil ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
