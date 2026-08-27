// Maltesische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politika dwar il-Cookies",
  metaDescription:
    "Liema cookies juża myNextDays: cookies teknikament meħtieġa u — bil-kunsens tiegħek biss — cookies funzjonali, analitiċi u ta' marketing. Kull kategorija tista' tiġi attivata u diżattivata individwalment.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Din il-politika tispjega liema cookies u tekniki simili ta' ħżin jintużaw minn ${ANBIETER.firma} f'dan is-sit web u fil-pjattaforma myNextDays.`,
    "Fil-qosor: Il-cookies meħtieġa huma dawk biss li mingħajrhom il-websajt ma taħdimx kif mitlub. Kull ħaġa oħra teħtieġ il-kunsens tiegħek u ma titgħabba mingħajrha — il-protezzjoni kontra l-ispam tal-formola ta' kuntatt tagħna, il-kejl tal-firxa u l-cookies tal-marketing li nużaw biex ikejlu s-suċċess tar-reklamar tagħna. Tista' tippermetti jew tirrifjuta kull waħda minn dawn il-kategoriji individwalment u tirtira d-deċiżjoni tiegħek fi kwalunkwe ħin.",
  ],
  sections: [
    {
      heading: "X'inhuma l-cookies",
      paragraphs: [
        "Il-cookies huma fajls żgħar ta' test li sit web jaħżen fil-brawżer. Dawn jippermettu li sessjoni tiġi rikonoxxuta — pereżempju sabiex tibqa' konness wara li tidħol. Minbarra l-cookies, il-brawżers jużaw ħżin ieħor bħal-Local Storage, li jaħdem b'mod tekniku simili.",
      ],
    },
    {
      heading: "Għal xiex hemm bżonn il-kunsens tiegħek",
      paragraphs: [
        "Kunsens huwa meħtieġ skont l-Artikolu 9 tar-regolament Daniż dwar il-cookies (Cookie-bekendtgørelsen) (li jittrasponi l-Artikolu 5(3) tad-Direttiva 2002/58/KE) biss meta l-aċċess għall-apparat tiegħek ma jservix esklussivament għat-trażmissjoni ta' messaġġ jew ma jkunx strettament meħtieġ għal servizz li int stess tkun talabt b'mod espliċitu.",
        "Il-cookies kollha li nużaw huma meħtieġa għad-dħul, is-sigurtà tas-sessjoni jew għal xi impostazzjoni li għażilt int stess — għal dan ma nitolbu xejn u lanqas ma nissettjaw xi ħaġa li teħtieġ kunsens.",
        "Għandek tagħti l-kunsens tiegħek għal tliet kategoriji, li kollha ma jitgħabbewx mingħajr il-permess tiegħek: il-protezzjoni kontra l-ispam tal-formola ta' kuntatt tagħna (reCAPTCHA minn Google), il-kejl tal-firxa ta' din il-websajt (Google Analytics 4) u l-cookies tal-marketing (Meta, LinkedIn, Google Ads). Għal dan, tidher tieqa b'lista ta' kategoriji — mal-ewwel żjara, mingħajr għażla minn qabel, kull kategorija bi swiċċ tagħha stess. Sakemm ma tkunx iddeċidejt, tapplika \"mhux permess\", u la jsir evalwazzjoni u lanqas reklamar.",
        "Id-deċiżjoni tiegħek tinżamm fil-ħżin tal-brawżer tiegħek (Local Storage, valur «nd_consent»); fiha biss il-kategorija, il-mument u numru ta' verżjoni, ebda identifikatur personali tiegħek. Permezz tal-ikona tal-cookies fin-naħa ta' isfel tax-xellug ta' kull paġna tista' dejjem tibdilha jew tirtiraha. Wara sitt xhur nerġgħu nistaqsu mill-ġdid — kunsens m'għandux jibqa' validu mingħajr limitu ta' żmien.",
      ],
    },
    {
      heading: "Dan is-sit web",
      paragraphs: [
        "Din il-websajt ma tuża l-ebda cookies minnha nnifisha. Il-fonts u s-simboli jinsabu fuq is-server tagħna stess — l-ebda servizz ta' simboli jew fonts ta' parti terza ma jiġi msejjaħ għal dan. Barra minn hekk, hemm biss is-servizzi li tippermetti: il-protezzjoni kontra l-ispam tal-formola ta' kuntatt, il-kejl tal-firxa u s-servizzi tal-marketing. Liema cookies jiġu ssettjati, b'liema tul ta' żmien u fuq liema host, jinsab hawn taħt fit-taqsima \"Cookies ta' Partijiet Terzi\". Ir-revoka permezz tal-ikona tal-cookie fin-naħa t'isfel tax-xellug — is-servizz rispettiv jintemm immedjatament u l-cookies tiegħu jitħassru. Id-dettalji jinsabu fil-[Politika ta' Privatezza](/datenschutz).",
      ],
    },
    {
      heading: "Cookies tal-pjattaforma",
      paragraphs: [
        "Malli tidħol fid-dashboard, fis-suq jew fil-vista mobbli, jiġu ssettjati l-cookies li ġejjin:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Dħul (tekniku meħtieġ)",
          list: [
            "Skop: jidentifika s-sessjoni miftuħa tiegħek mas-server.",
            "Kontenut: token ta' aċċess ta' żmien qasir; jinqara biss mis-server (HttpOnly), jiġi trażmess biss permezz ta' HTTPS.",
            "Tul ta' żmien: is-sessjoni jew l-iskadenza tat-token.",
          ],
        },
        {
          titel: "nd_refresh — Estensjoni tas-sessjoni (tekniku meħtieġ)",
          list: [
            "Skop: iġedded it-token ta' aċċess sabiex ma jkollokx bżonn tidħol mill-ġdid kontinwament.",
            "Kontenut: token ta' tiġdid; HttpOnly, biss permezz ta' HTTPS.",
            "Tul ta' żmien: sad-diskonnessjoni jew l-iskadenza.",
          ],
        },
        {
          titel: "nd_locale — Għażla tal-lingwa (funzjonali)",
          list: [
            "Skop: jiftakar il-lingwa li għażilt.",
            "Kontenut: kodiċi tal-lingwa, eż. «de» jew «en».",
            "Tul ta' żmien: sal-bidla jew it-tħassir.",
          ],
        },
        {
          titel: "sidebar_state — Barra tan-navigazzjoni (funzjonali)",
          list: [
            "Skop: jiftakar jekk il-barra tan-navigazzjoni hijiex miftuħa jew magħluqa.",
            "Kontenut: «true» jew «false».",
            "Tul ta' żmien: sal-bidla jew it-tħassir.",
          ],
        },
        {
          titel: "sb-… — Dħul bil-Google (tekniku meħtieġ, biss meta jintuża)",
          list: [
            "Skop: iżomm is-sessjoni meta tidħol permezz ta' Google.",
            "Kontenut: token tas-sessjoni tas-servizz ta' dħul.",
            "Tul ta' żmien: is-sessjoni jew l-iskadenza tat-token. Jiġi ssettjat biss jekk tagħżel id-dħul bil-Google.",
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
            "Jirreġistra d-deċiżjoni tiegħek dwar is-servizzi li jeħtieġu kunsens (protezzjoni kontra l-ispam tal-formola ta' kuntatt u kejl tal-firxa).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Jiġi ssettjat biss jekk int stess tiftaħ iċ-chat fuq dan is-sit u tibgħat messaġġ. Huwa ċ-ċavetta tal-konversazzjoni tiegħek stess — mingħajru ma ssibx ir-risposta tagħna wara li tinbidel il-paġna. Ma fih ebda informazzjoni dwarek u jintuża biss għal dan l-iskop.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Jaħżen fil-brawżer jekk tajtx il-kunsens għall-użu tad-dħul bil-vuċi, sabiex il-kunsens ma jintalabx mill-ġdid kull darba li żżur. Il-valur ma jitlaqx mill-apparat tiegħek.",
          ],
        },
      ],
    },
    {
      heading: "Cookies tal-app mobbli",
      paragraphs: [
        "L-app mobbli ma taħdimx bil-cookies. It-tokens ta' aċċess u ta' tiġdid jinħażnu fil-ħażna sigura taċ-ċwievet tal-apparat (iOS Keychain, Android Keystore) u jitħassru mad-diskonnessjoni.",
      ],
    },
    {
      heading: "Cookies ta' terzi",
      paragraphs: [
        "Jekk twettaq ħlas, il-fornitur tas-servizz ta' ħlas (Stripe jew PayPal) jista' jissettja cookies fuq is-sit tiegħu stess, meħtieġa għall-ipproċessar u l-prevenzjoni tal-frodi. Għal dan japplikaw id-dispożizzjonijiet tal-fornitur rispettiv.",
        "Fuq siti web li n-negozji joħolqu bl-għodda tagħna għall-bini ta' siti, in-negozju rispettiv jiddeċiedi dwar cookies addizzjonali u huwa responsabbli għall-informazzjoni hemmhekk.",
        "Biss il-kunsens tiegħek jippermetti lis-servizzi ta' Google fuq din il-websajt biex jistabbilixxu l-cookies li ġejjin — tnejn għall-kejl tal-udjenza, wieħed għall-protezzjoni kontra l-ispam. Mingħajr il-kunsens tiegħek, l-iskript rispettiv ma jitgħabbiex u l-ebda waħda minn dawn il-cookies ma tiġi stabbilita; jekk tirtira l-kunsens tiegħek, aħna nħassruhom.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Kejl tal-prestazzjoni tar-reklami (jeħtieġ kunsens)",
          list: [
            "Għan: jassenja ż-żjara tiegħek lil reklam sabiex inkunu nistgħu nkejlu s-suċċess tal-kampanji tagħna.",
            "Kontenut: identifikatur iġġenerat b'mod każwali; l-ebda isem, email, jew informazzjoni tal-kont mingħandna.",
            "Fornitur: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, l-Irlanda.",
            "Host: mynextdays.com (cookie tal-ewwel parti, issettjat mill-iskript ta' Meta). Tul: madwar tliet xhur.",
          ],
        },
        {
          titel:
            "_gcl_au — Kejl tal-prestazzjoni ta' Google Ads (jeħtieġ kunsens)",
          list: [
            "Għan: jassenja ż-żjara tiegħek lil reklam ta' Google sabiex inkunu nistgħu nkejlu s-suċċess tal-kampanji tagħna.",
            "Kontenut: identifikatur iġġenerat b'mod każwali mingħajr referenza għall-persuna tiegħek.",
            "Fornitur: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, l-Irlanda.",
            "Host: mynextdays.com (cookie tal-ewwel parti). Tul: madwar tliet xhur.",
          ],
        },
        {
          titel: "li_gc u bcookie — Reklamar ta' LinkedIn (jeħtieġ kunsens)",
          list: [
            "Għan: jidentifika l-browser tiegħek lil LinkedIn sabiex ir-reklami u s-suċċess tagħhom ikunu jistgħu jiġu attribwiti; li_gc jaħżen ukoll il-kunsens tiegħek hemmhekk.",
            "Kontenut: identifikatur tal-browser u l-istatus tal-kunsens; l-ebda informazzjoni mill-kont tiegħek magħna.",
            "Fornitur: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, l-Irlanda.",
            "Host: linkedin.com (cookies ta' partijiet terzi). Tul: madwar sitt xhur jew sena.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Protezzjoni kontra l-ispam tal-formola ta' kuntatt (jeħtieġ kunsens)",
          list: [
            "Host: www.google.com (Cookie ta' parti terza).",
            "Għan: tippermetti lil Google tevalwa r-riskju, li tiddistingwi bejn talbiet awtomatizzati tal-massa u talbiet reali.",
            "Kontenut: identifikatur ġenerat minn Google għal din l-evalwazzjoni; l-ebda isem, email jew informazzjoni dwar il-kont mingħandna.",
            "Fornitur: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, l-Irlanda.",
            "Tul ta' żmien: stabbilit minn Google, sa sitt xhur. Jiġi stabbilit biss jekk tkun ippermettiet il-protezzjoni kontra l-ispam u ftaħt il-formola ta' kuntatt.",
          ],
        },
        {
          titel: "_ga — Kejl tal-firxa (kunsens meħtieġ)",
          list: [
            "Host: mynextdays.com (Cookie tal-ewwel parti, issettjat mill-iskript ta' Google).",
            "Għan: jiddistingwi l-viżitaturi sabiex iż-żjarat ripetuti ma jingħaddux darbtejn.",
            "Kontenut: identifikatur iġġenerat b'mod każwali mingħajr referenza għall-persuna tiegħek; l-ebda isem, email jew dettalji tal-kont.",
            "Fornitur: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, l-Irlanda.",
            "Durata: sa sentejn.",
          ],
        },
        {
          titel:
            "_ga_<Kennung> — Status tas-sessjoni tal-kejl (kunsens meħtieġ)",
          list: [
            "Host: mynextdays.com (Cookie tal-ewwel parti, issettjat mill-iskript ta' Google).",
            "Għan: jirreġistra meta bdiet iż-żjara attwali tiegħek sabiex il-paġni miżjura f'sessjoni jappartjenu flimkien.",
            "Kontenut: timestamp u kontatur tas-sessjoni; l-identifikatur fl-isem jirreferi għall-proprjetà tagħna, mhux lilek.",
            "Fornitur: Google Ireland Limited.",
            "Durata: sa sentejn.",
          ],
        },
      ],
    },
    {
      heading: "Tħassir u kontroll tal-cookies",
      paragraphs: [
        "Tista' tħassar jew timblokka l-cookies fi kwalunkwe ħin fl-impostazzjonijiet tal-brawżer tiegħek. Jekk timblokka l-cookies meħtieġa, id-dħul fil-pjattaforma ma jkunx tekniku possibbli — is-sit pubbliku u s-suq jibqgħu jintużaw mingħajr dħul.",
        "Mad-diskonnessjoni, aħna stess inneħħu l-cookies tad-dħul.",
      ],
    },
    {
      heading: "Bidliet f'din il-politika",
      paragraphs: [
        "Jekk jiżdiedu funzjonijiet li jeħtieġu cookies addizzjonali, aġġornaw din il-lista. Dejjem tapplika l-verżjoni ppubblikata hawnhekk; id-data ta' fuq turi l-istatus tal-aġġornament.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
