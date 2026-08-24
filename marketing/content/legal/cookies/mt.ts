// Maltesische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politika dwar il-Cookies",
  metaDescription:
    "Liema cookies tuża myNextDays: esklussivament cookies tekniċi meħtieġa u funzjonali, l-ebda cookie ta' traċċar jew ta' reklamar.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Din il-politika tispjega liema cookies u tekniki simili ta' ħżin jintużaw minn ${ANBIETER.firma} f'dan is-sit web u fil-pjattaforma myNextDays.`,
    "Fil-qosor: aħna nużaw esklussivament cookies tekniċi meħtieġa u funzjonali. M'hemm ebda cookies ta' analiżi, ta' reklamar jew ta' traċċar, u l-ebda trasferiment ta' data dwar l-użu lil netwerks ta' reklamar.",
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
        "Trid tagħti l-kunsens għal ħaġa waħda biss: il-protezzjoni kontra l-ispam tal-formola ta' kuntatt tagħna. Din tiġi minn Google (reCAPTCHA Enterprise), għalhekk hija servizz estern, u tinġieb biss jekk tkun ippermettejtha. Għal dan, meta żżur għall-ewwel darba, tidher barra fl-isfel tal-iskrin b'buttuni ta' importanza ndaqs għal Irrifjuta u Aċċetta u mingħajr ebda għażla minn qabel. Sakemm ma tkunx iddeċidejt, tapplika «mhux permess».",
        "Id-deċiżjoni tiegħek tinżamm fil-ħżin tal-brawżer tiegħek (Local Storage, valur «nd_consent»); fiha biss il-kategorija, il-mument u numru ta' verżjoni, ebda identifikatur personali tiegħek. Permezz tal-ikona tal-cookies fin-naħa ta' isfel tax-xellug ta' kull paġna tista' dejjem tibdilha jew tirtiraha. Wara sitt xhur nerġgħu nistaqsu mill-ġdid — kunsens m'għandux jibqa' validu mingħajr limitu ta' żmien.",
      ],
    },
    {
      heading: "Dan is-sit web",
      paragraphs: [
        "Is-sit web tal-marketing ma jissettjax cookies. It-tipi tal-karattri u l-ikoni jinsabu fuq is-server tagħna stess — għal dan ma jissejjaħ ebda servizz ta' tip ta' karattri jew ikoni ta' terza persuna. L-uniku servizz estern ta' dan is-sit huwa l-protezzjoni kontra l-ispam tal-formola ta' kuntatt, li tiġi biss bil-kunsens tiegħek. Id-dettalji jinsabu fil-[Politika ta' Privatezza](/datenschutz).",
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
            "Iżomm id-deċiżjoni tiegħek dwar il-protezzjoni kontra l-ispam tal-formola ta' kuntatt, sabiex il-barra tal-kunsens ma terġax titlob kull darba li żżur. Jinżammu biss il-kategorija, il-mument u numru ta' verżjoni. Il-valur ma jitlaqx mill-apparat tiegħek u ma jiġix trażmess lis-server tagħna; japplika għal dan il-brawżer. Validità: sitt xhur — wara dan il-barra terġa' titlob mill-ġdid. Jekk tħassar il-valur, il-barra terġa' titlob fiż-żjara li jmiss.",
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
