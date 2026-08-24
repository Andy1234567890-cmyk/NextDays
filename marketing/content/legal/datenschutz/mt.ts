// Maltesische Fassung der Datenschutzerklärung. Quelle ist
// `content/legal/datenschutz/de.ts` — inhaltliche Änderungen gehören ZUERST
// dorthin und werden von dort hier nachgezogen. Struktur (Abschnitte, Absätze,
// Listen) muss deckungsgleich mit `de.ts` bleiben.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Avviż dwar il-privatezza",
  metaDescription:
    "Kif myNextDays tipproċessa d-data personali: skopijiet, bażijiet legali, riċevituri, perjodi ta’ żamma u d-drittijiet tiegħek skont il-GDPR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Dan l-avviż jiddeskrivi kif ${ANBIETER.firma} tipproċessa data personali — meta żżur dan is-sit web, meta tuża l-pjattaforma myNextDays (id-dashboard, is-suq u l-applikazzjoni mobbli) u fil-qafas tar-relazzjoni kummerċjali mal-klijenti tagħna.`,
    "Il-bażi hija r-Regolament (UE) 2016/679 (GDPR) kif ukoll il-liġi Daniża dwar il-protezzjoni tad-data (databeskyttelsesloven). Aħna ma nbigħux data, ma noħolqux profili u ma nużaw ebda servizz ta’ analitika, tracking jew reklamar fis-siti web tagħna. Għal skopijiet ta’ reklamar nipproċessaw data biss fejn tajt il-kunsens espliċitu tiegħek — jiġifieri għan-newsletter tagħna (ara t-taqsima „Komunikazzjoni“), li tista’ tħassar l-abbonament tagħha fi kwalunkwe ħin bi klikk waħda.",
  ],
  sections: [
    {
      heading: "Kontrollur",
      paragraphs: [
        "Ir-responsabbiltà għall-ipproċessar deskritt f’dan l-avviż hija ta’:",
      ],
      zeilen: [
        {
          label: "Impriża",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Indirizz",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Posta elettronika",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Kamp ta’ applikazzjoni u rwoli",
      unterpunkte: [
        {
          paragraphs: [
            "Fir-rigward taż-żjara f’dan is-sit web, tal-kont tal-klijent tiegħek u tat-twettiq tar-relazzjoni kummerċjali tagħna, aħna l-kontrollur fis-sens tal-Artikolu 4(7) tal-GDPR.",
          ],
        },
        {
          paragraphs: [
            "Fir-rigward tad-data li l-klijenti tagħna (sidien li jikru, lukandi, aġenziji) jipproċessaw fil-pjattaforma dwar l-ospiti, is-sidien u l-impjegati tagħhom, il-klijenti huma l-kontrolluri u aħna l-proċessur skont l-Artikolu 28 tal-GDPR. Id-dettalji jinsabu fil-[ftehim dwar l-ipproċessar tad-data](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Jekk bħala ospitu tibbukkja akkomodazzjoni permezz tas-suq tagħna, nipproċessaw id-data tal-bukkjar u tal-kuntatt tiegħek kemm f’isimna stess (it-tħaddim tas-suq, l-ipproċessar tal-pagamenti) kif ukoll għall-impriża li tospita. Il-kuntratt ta’ akkomodazzjoni jsir esklużivament mal-impriża; l-avviż tal-privatezza tagħha japplika wkoll.",
          ],
        },
      ],
    },
    {
      heading: "Żjara f’dan is-sit web",
      unterpunkte: [
        {
          titel: "Fajls tar-reġistru tas-server",
          paragraphs: [
            "Ma’ kull talba, il-browser tiegħek jibgħat data teknikament meħtieġa li s-server web tagħna jirreġistra: l-indirizz IP, id-data u l-ħin, l-indirizz mitlub, l-ammont ta’ data trasferita, il-kodiċi tal-istatus, ir-referrer u l-identifikatur tal-browser. L-iskop huwa li tiġi pprovduta l-paġna kif ukoll li jiġu identifikati u miġġielda attakki u disturbi. Il-bażi legali hija l-Artikolu 6(1)(f) tal-GDPR; l-interess leġittimu tagħna jinsab f’operat sigur u stabbli. Ir-reġistri jinżammu biss għal daqstant żmien kemm ikun meħtieġ għall-operat u għas-sigurtà, u ma jingħaqdux ma’ data oħra.",
          ],
        },
        {
          titel: "Fonts",
          paragraphs: [
            "Il-fonts użati huma integrati lokalment fis-server tagħna. Ma ssirx ebda konnessjoni ma’ Google Fonts jew ma’ servizz ieħor ta’ fonts.",
          ],
        },
        {
          titel: "Ikoni",
          paragraphs: [
            "L-ikoni ta’ dan is-sit web, bħall-fonts, jinsabu għandna: jiddaħħlu fil-paġna fis-server tagħna u ma jitniżżlux minn servizz ta’ ikoni. B’dan ma ssirx ebda konnessjoni ma’ terza persuna, u l-indirizz IP tiegħek ma jintbagħatx lil ħadd.",
          ],
        },
        {
          titel: "Protezzjoni tal-formola ta’ kuntatt kontra l-ispam (reCAPTCHA)",
          paragraphs: [
            "Il-formola ta’ kuntatt tagħna hija protetta kontra talbiet awtomatizzati bil-massa b’reCAPTCHA Enterprise ta’ Google Ireland Limited. Biss jekk tagħti l-kunsens tiegħek, il-browser tiegħek jitniżżel skript minn www.google.com meta timla l-formola; b’dan l-indirizz IP tiegħek u informazzjoni dwar l-interazzjoni tiegħek mal-formola jintbagħtu lil Google u jiġu evalwati hemm biex jiddistingwu bniedem minn skript. Il-bażi legali hija l-Artikolu 6(1)(a) tal-GDPR (kunsens); b’mod komplementari japplika l-[avviż tal-privatezza ta’ Google](https://policies.google.com/privacy).",
            "Mingħajr il-kunsens tiegħek ma jitniżżel xejn minn Google u ma tgħaddi ebda data hemm; f’dak il-każ ma naċċettawx il-formola, iżda tista’ dejjem tibgħatilna posta elettronika. Il-kunsens tiegħek tista’ tibdlu jew tirtirah fil-[politika dwar il-cookies](/cookie-richtlinie).",
          ],
        },
        {
          titel: "Ebda analitika, ebda reklamar",
          paragraphs: [
            "Ma nużaw ebda servizz ta’ analitika, tracking jew reklamar (ebda Google Analytics, ebda pixels, ebda netwerks ta’ reklamar) u ma noħolqux profili. Liema cookies il-pjattaforma teħtieġ teknikament jinsab fil-[politika dwar il-cookies](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kont tal-klijent u użu tal-pjattaforma",
      paragraphs: [
        "Għar-reġistrazzjoni u għat-tħaddim ta’ kont nipproċessaw l-informazzjoni li tidħol minnek jew mill-impriża tiegħek: isem, isem kummerċjali u forma legali, indirizz, indirizz tal-posta elettronika, numru tat-telefon, rwol u permessi, data tar-reġistru (pereżempju n-numru tar-reġistru kummerċjali jew tal-VAT), dettalji bankarji għall-pagamenti, kif ukoll il-kontenut li jinħoloq fil-kont.",
        "Biex nissalvagwardjaw l-aċċess, nipproċessaw ukoll reġistri tal-illoggjar (il-ħin, l-indirizz IP, l-apparat u l-browser tal-illoggjar) u — jekk tkun attivata — id-data tal-awtentikazzjoni b’żewġ fatturi.",
        "Illoggjar bi Google: minflok b’posta elettronika u password tista’ tilloggja wkoll bi kont ta’ Google. Jekk tagħżel din it-triq, minn Google Ireland Limited nirċievu biss l-indirizz tal-posta elettronika tiegħek, ismek, ir-ritratt tal-profil tiegħek u identifikatur tal-kont Google tiegħek (l-ambiti „openid“, „email“, „profile“) — espliċitament ebda aċċess għall-messaġġi elettroniċi, il-kuntatti, il-fajls jew il-kalendarji tiegħek. Il-password ta’ Google tiegħek ma nkunux nafuha. Google tipproċessa l-proċess tal-illoggjar bħala kontrollur indipendenti; japplika l-[avviż tal-privatezza ta’ Google](https://policies.google.com/privacy). Il-bażi legali hija l-Artikolu 6(1)(b) tal-GDPR, billi l-illoggjar iservi għat-twettiq tal-kuntratt; l-għażla ta’ din it-triq tal-illoggjar hija volontarja u tista’ dejjem tinbidel bl-illoggjar bil-posta elettronika u l-password.",
        "Il-bażi legali hija l-Artikolu 6(1)(b) tal-GDPR (twettiq tal-kuntratt tal-użu, ara t-[termini u l-kundizzjonijiet](" +
          AGB_URL +
          ")), għas-salvagwardja tal-aċċess l-Artikolu 6(1)(f) tal-GDPR u għaż-żamma meħtieġa mil-liġi fiskali u kummerċjali l-Artikolu 6(1)(c) tal-GDPR.",
      ],
    },
    {
      heading: "Bukkjar, data tal-ospiti u tal-proprjetajiet",
      paragraphs: [
        "Permezz tal-pjattaforma jiġu pproċessati riżervazzjonijiet, data tal-ospiti, messaġġi, kompiti u kontijiet. Fost dawn jidħlu b’mod partikolari l-isem u d-dettalji tal-kuntatt tal-ospitu, id-dati tal-wasla u tat-tluq, in-numru ta’ vjaġġaturi, il-prezzijiet u l-istatus tal-pagament, l-istorja tal-messaġġi, kif ukoll — sakemm l-impriża tirreġistrahom — data tar-reġistrazzjoni u talbiet speċjali.",
        "Dan l-ipproċessar isir għall-inkarigu u fuq l-istruzzjonijiet tal-impriża kkonċernata. Aħna ma nużawx din id-data għal skopijiet tagħna, għal reklamar jew għat-taħriġ ta’ mudelli tal-intelliġenza artifiċjali.",
        "Fl-impriża, id-data hija separata skont l-irwoli: il-persunal tat-tindif u tas-servizz ma jarax data finanzjarja u ta’ bejgħ, is-sidien jaraw biss il-proprjetajiet tagħhom stess. Bejn impriżi differenti d-data hija separata teknikament (regoli ta’ aċċess għal kull inkwilin fid-database).",
      ],
    },
    {
      heading: "Ipproċessar tal-pagamenti",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Il-pagamenti bil-kard u l-ħlasijiet lil hinn jgħaddu minn Stripe Payments Europe, Limited, l-Irlanda. B’dan tintbagħat lil Stripe id-data meħtieġa għall-pagament (l-ammont, il-munita, il-mezz tal-pagament, l-isem, l-indirizz tal-posta elettronika, ir-referenza tal-bukkjar) kif ukoll, għall-kontijiet tal-klijenti tagħna, id-data ta’ identifikazzjoni meħtieġa mil-liġi (id-detentur, is-sidien benefiċjarji, id-data tad-dokument tal-identità, id-dettalji bankarji). Id-data sħiħa tal-kard ma tasalx fis-sistemi tagħna. Il-bażijiet legali huma l-Artikolu 6(1)(b) tal-GDPR u, għall-obbligi ta’ identifikazzjoni u kontra l-ħasil tal-flus, l-Artikolu 6(1)(c) tal-GDPR. Id-dettalji huma rregolati fl-[avviż tal-privatezza ta’ Stripe](https://stripe.com/privacy).",
            "Links tal-pagament għal servizzi addizzjonali: jekk impriża toħroġ kont lill-ospitu tagħha għal servizz addizzjonali (pereżempju tindif jew ħwejjeġ) permezz ta’ link tal-pagament, dan il-link iwassal għal paġna tal-pagament imħaddma minn Stripe. Għal dan nibgħatu lil Stripe l-isem tas-servizz, l-ammont, il-munita kif ukoll referenza interna għall-bukkjar u għall-impriża; il-logo tal-impriża jintbagħat lill-kont Stripe tagħha biex il-paġna turi l-marka tagħha. Fil-paġna tal-pagament innifisha, Stripe tiġbor id-data tal-pagament u tal-apparat tal-ospitu taħt ir-responsabbiltà tagħha stess. Lura għandna jaslu biss l-istatus tal-pagament, l-ammont, l-ammonti miżmuma u l-identifikaturi tal-pagament — ebda data tal-kard.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Jekk l-impriża toffri PayPal bħala metodu ta’ pagament, id-data tal-pagament tintbagħat lil PayPal (Europe) S.à r.l. et Cie, S.C.A., il-Lussemburgu. Japplika l-[avviż tal-privatezza ta’ PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Kanali ta’ distribuzzjoni u portali",
      paragraphs: [
        "Meta impriża tbigħ il-proprjetajiet tagħha permezz ta’ portali bħal Booking.com, Airbnb jew Expedia, id-disponibbiltà, il-prezzijiet, ir-restrizzjonijiet u d-data tal-bukkjar jiġu skambjati mal-portal ikkonċernat permezz tal-fornitur tas-servizz ta’ konnessjoni tagħna Channex.io Ltd, ir-Renju Unit. Minn din id-direzzjoni nirċievu d-data tal-bukkjar u tal-ospiti tal-portal.",
        "Għall-portal ikkonċernat japplikaw id-dispożizzjonijiet tiegħu stess dwar il-protezzjoni tad-data; f’dak ir-rigward il-portal huwa responsabbli b’mod indipendenti. Il-bażi legali tat-trasferiment hija l-Artikolu 6(1)(b) tal-GDPR flimkien mal-inkarigu tal-impriża.",
      ],
    },
    {
      heading: "Komunikazzjoni",
      unterpunkte: [
        {
          titel: "Posta elettronika",
          paragraphs: [
            "Il-messaġġi elettroniċi fil-qafas tal-użu (konfermi ta’ bukkjar, messaġġi tas-sistema, appoġġ, links ta’ konferma u ta’ stedina) nibagħtuhom u nirċevuhom permezz ta’ server tal-posta tagħna stess, li nħaddmu aħna. Għal dawn il-messaġġi ma huwa integrat ebda servizz estern tal-bagħt.",
          ],
        },
        {
          titel: "Newsletter u reġistrazzjoni bil-quddiem",
          paragraphs: [
            "Fis-sit web tagħna tista’ tirreġistra għal aħbarijiet dwar myNextDays (reġistrazzjoni bil-quddiem / newsletter). B’dan jiġu pproċessati l-indirizz tal-posta elettronika tiegħek, il-lingwa u l-post fejn irreġistrajt.",
            "Ir-reġistrazzjoni ssir bil-proċedura tad-double opt-in: wara r-reġistrazzjoni tirċievi messaġġ elettroniku bi link ta’ konferma; ir-reġistrazzjoni tidħol fis-seħħ biss meta tikklikkja fuqu. Bħala prova tal-kunsens naħżnu l-ħin tar-reġistrazzjoni u tal-konferma, l-indirizz IP użat, l-identifikatur tal-browser kif ukoll it-testo li aċċettajt. Din l-informazzjoni sservi esklużivament bħala prova skont l-Artikolu 7(1) tal-GDPR u ma tiġix evalwata għal skopijiet ta’ reklamar.",
            "Il-bażi legali hija l-kunsens tiegħek skont l-Artikolu 6(1)(a) tal-GDPR; iż-żamma tal-prova nibbażawha fuq l-Artikolu 6(1)(c) flimkien mal-Artikolu 7(1) tal-GDPR. Tista’ tirtira l-kunsens fi kwalunkwe ħin b’effett għall-futur — permezz tal-link tat-tħassir tal-abbonament f’kull messaġġ tan-newsletter jew b’messaġġ elettroniku informali lilna. L-irtirar ma jaffettwax il-legalità tal-ipproċessar li sar sa dak il-mument.",
            "Għall-amministrazzjoni u l-bagħt tan-newsletters nużaw Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Franza; fergħa Ġermaniża: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) bħala proċessur. Jintbagħtu l-indirizz tal-posta elettronika tiegħek u l-informazzjoni addizzjonali msemmija (lingwa, sors). Id-data tiġi pproċessata fuq servers fl-Unjoni Ewropea (Franza u l-Ġermanja); ma’ Brevo jeżisti ftehim dwar l-ipproċessar tad-data skont l-Artikolu 28 tal-GDPR. Japplika l-[avviż tal-privatezza ta’ Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Meta nibagħtu newsletter, Brevo tkejjel għall-inkarigu tagħna jekk il-messaġġ infetaħ u jekk saru klikks fuq il-links li fih. Dan il-kejl jgħinna nadattaw il-kontenut u l-frekwenza; huwa parti mill-kunsens u jintemm bit-tħassir tal-abbonament tiegħek. Ma jsirx tgħaqqid ma’ sorsi oħra ta’ data u lanqas tfassil ta’ profili.",
            "Sakemm il-konferma tkun pendenti, l-indirizz tiegħek ma jiġix ikkuntattjat u ma jintbagħatx lil Brevo; reġistrazzjoni mhux ikkonfermata tiskadi wara sebat ijiem. Wara t-tħassir tal-abbonament nimblukkaw l-indirizz għall-bagħt u nżommu l-prova tal-kunsens u tat-tħassir sakemm minnha jistgħu jitqajmu pretensjonijiet; fuq talba nħassruha kollha kemm hi.",
          ],
        },
        {
          titel: "Messaġġi fil-pjattaforma",
          paragraphs: [
            "Il-messaġġi bejn l-ospitu u l-impriża jinħażnu fil-pjattaforma, biex iż-żewġ naħat ikunu jistgħu jaraw l-istorja. Jekk impriża timblokka ospitu, il-kanal tal-messaġġi jiġi magħluq; il-messaġġi eżistenti jinżammu għal skopijiet ta’ traċċabbiltà.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Jekk impriża tuża l-konnessjoni ta’ WhatsApp, il-kontenut tal-messaġġi u n-numri tat-telefon tal-partijiet involuti jintbagħtu permezz tal-WhatsApp Business Platform ta’ Meta Platforms Ireland Limited. L-użu ta’ din il-funzjoni jiddeċiedih l-impriża; mingħajr attivazzjoni ma jsir ebda trasferiment.",
          ],
        },
      ],
    },
    {
      heading: "Funzjonijiet awtomatizzati u intelliġenza artifiċjali",
      paragraphs: [
        "Għall-funzjonijiet deskritti hawn japplika, flimkien mal-GDPR, ir-Regolament (UE) 2024/1689 (ir-Regolament dwar l-Intelliġenza Artifiċjali, „AI Act“), li l-obbligi ta’ trasparenza tiegħu skont l-Artikolu 50 japplikaw mit-2 ta’ Awwissu 2026.",
      ],
      unterpunkte: [
        {
          titel: "Suġġerimenti ta’ tweġiba",
          paragraphs: [
            "Għal suġġerimenti ta’ tweġiba fl-inbox tal-messaġġi nużaw — sakemm il-funzjoni tkun attivata għall-impriża — l-offerta ta’ mudelli tal-lingwa ta’ Groq, Inc., l-Istati Uniti. B’dan jintbagħat lis-servizz il-kuntest tal-messaġġ ikkonċernat. Is-suġġerimenti ma jintbagħtux awtomatikament; dwar il-bagħt jiddeċiedi dejjem bniedem. Ma jsirx teħid ta’ deċiżjonijiet awtomatizzat b’effett legali fis-sens tal-Artikolu 22 tal-GDPR.",
            "Għaldaqstant ma jirrigwardax sistema tal-IA li, fis-sens tal-Artikolu 50(1) tar-Regolament dwar l-Intelliġenza Artifiċjali, tinteraġixxi direttament ma’ persuni fiżiċi: l-obbligu jippresupponi interazzjoni DIRETTA, fejn l-IA nnifisha tikkomunika mal-persuna u mhux permezz ta’ intermedjarju uman. Hawnhekk il-funzjoni tissuġġerixxi lill-impriża test li impjegat jiċċekkja, jista’ jibdel u jibgħat huwa stess — l-impjegat huwa dan l-intermedjarju, u l-ospitu jikkorrispondi mal-impriża u mhux ma’ chatbot. Ma huwiex użat assistent li jwieġeb awtomatikament. Skont il-klassifikazzjoni tagħna, il-funzjoni lanqas tissodisfa xi wieħed mill-każijiet ta’ IA b’riskju għoli skont l-Anness III tar-Regolament dwar l-Intelliġenza Artifiċjali.",
            "Barra minn hekk, il-messaġġi lill-ospiti ma humiex „test dwar kwistjonijiet ta’ interess pubbliku“ fis-sens tal-Artikolu 50(4) tar-Regolament dwar l-Intelliġenza Artifiċjali: ma jiġux ippubblikati, iżda jintbagħtu individwalment lil persuna partikolari, u jirrigwardaw l-organizzazzjoni ta’ soġġorn. Indipendentement minn dan, hawnhekk tapplika l-verifika umana mill-impjegat li jibgħat.",
            "Jekk fil-futur tiġi offruta funzjoni li twieġeb lill-ospiti b’mod awtonomu — mingħajr approvazzjoni umana — l-ospitu jiġi infurmat b’mod viżibbli fil-bidu tad-djalogu li huwa qed jikteb ma’ sistema tal-IA. Mingħajr dan l-avviż, tali funzjoni ma tiġix ipprovduta.",
          ],
        },
        {
          titel: "Rwoli skont ir-Regolament dwar l-Intelliġenza Artifiċjali",
          paragraphs: [
            "Fir-rigward tal-funzjonijiet tal-IA integrati fil-prodott aħna implimentaturi fis-sens tal-Artikolu 3(4) tar-Regolament dwar l-Intelliġenza Artifiċjali; il-fornituri tal-mudelli tal-lingwa sottostanti huma l-fornituri tal-mudelli rispettivi. Jekk impriża tuża dawn il-funzjonijiet fil-qafas tal-attività professjonali tagħha, hija min-naħa tagħha implimentatur u jaqa’ fuqha l-obbligu tal-litteriżmu fl-IA skont l-Artikolu 4 tar-Regolament dwar l-Intelliġenza Artifiċjali, li mit-2 ta’ Frar 2025 japplika indipendentement mid-daqs tal-impriża. Mis-27 ta’ Lulju 2026 japplika fil-verżjoni tar-Regolament (UE) 2026/1744: il-fornituri u l-implimentaturi jieħdu miżuri biex jappoġġjaw l-iżvilupp tal-litteriżmu fl-IA tal-persunal tagħhom; livell partikolari espliċitament ma għandux jiġi garantit. Aħna nappoġġjaw permezz ta’ avviżi fl-applikazzjoni u fiċ-ċentru tal-għajnuna tagħna; it-taħriġ tal-impjegati tagħha jibqa’ kompitu tal-impriża.",
            "Jekk impriża tqabbad il-kont tagħha ma’ assistent tal-IA tagħha stess (ara l-punt li jmiss), hija implimentatur ukoll għal dan fis-sens tar-Regolament dwar l-Intelliġenza Artifiċjali — hija tiddeċiedi dwar l-użu u tifformula t-talbiet. L-interfaċċa nnifisha ma hijiex sistema tal-IA: taqra data mid-database u toħroġha, mingħajr ma tasal għal konklużjonijiet; il-premessa 12 tar-Regolament dwar l-Intelliġenza Artifiċjali tiddistingwi espliċitament tali sistemi mill-IA.",
          ],
        },
        {
          titel: "Konnessjoni ma’ assistent tal-IA tagħha stess",
          paragraphs: [
            "Impriża tista’ tqabbad il-kont tagħha permezz ta’ interfaċċa ma’ assistent tal-IA li hija stess għażlet u li magħha għandha kuntratt tagħha stess — pereżempju Claude ta’ Anthropic PBC, l-Istati Uniti. Meta tali konnessjoni tkun mogħtija, l-assistent jista’, fuq talba tal-impriża, jaqra: l-okkupazzjoni, id-disponibbiltà u l-prezzijiet ta’ kuljum; il-bukkjar bl-isem tal-ospitu, il-perjodu tas-soġġorn, il-proprjetà, il-kanal tal-bukkjar, l-istatus kif ukoll l-ammont u l-munita, sakemm ir-rwol tal-kont li jagħmel it-talba jkun jista’ jara l-ammonti; u l-ħarsa ġenerali tal-konversazzjonijiet fl-inbox. Mingħajr konnessjoni mogħtija ma jsir ebda trasferiment.",
            "Ma jintbagħtux l-indirizzi tal-posta elettronika u n-numri tat-telefon tal-ospiti, id-data tal-kard, id-dettalji bankarji u l-irċevuti tal-pagamenti, il-kodiċijiet tal-aċċess kif ukoll id-dossiers tal-proprjetajiet. In-noti tal-bukkjar u l-kontenut tal-messaġġi tal-ospiti huma esklużi awtomatikament, għax jistgħu jinkludu informazzjoni dwar is-saħħa jew kategoriji speċjali oħra skont l-Artikolu 9 tal-GDPR; l-impriża trid tapprovahom espliċitament u separatament meta tagħti l-konnessjoni.",
            "Il-konnessjoni tista’ tingħata biss minn kont bir-rwol „amministratur“, mhux minn kull kont li għandu aċċess. Kull talba tiġi rreġistrata u tista’ tarahom l-impriża taħt „Kont → Konnessjonijiet“; hemm tista’ taqta’ l-konnessjoni fi kwalunkwe ħin, u l-aċċess jintemm immedjatament b’dan.",
            "Legalment dan it-trasferiment huwa istruzzjoni tal-impriża lilna (l-Artikolu 28(3)(a) tal-GDPR). Il-fornitur tal-assistent ma huwiex subproċessur tagħna — aħna ma ninkarigawhx u ma nagħtuhx istruzzjonijiet; huwa jipproċessa d-data abbażi tal-kuntratt li l-impriża stess ikkonkludiet miegħu. Għalhekk għall-bażi legali ta’ dan l-ipproċessar, għall-informazzjoni tal-ospiti tagħha u għall-garanziji ta’ trasferiment lejn pajjiż terz hija responsabbli l-impriża.",
          ],
        },
        {
          titel: "Traduzzjonijiet",
          paragraphs: [
            "It-testi tal-proprjetajiet u tal-kontenut jistgħu jiġu tradotti permezz tal-Cloud Translation API ta’ Google Ireland Limited. B’dan jintbagħtu t-testi li għandhom jiġu tradotti; data personali biss sakemm tkun inkluża f’dawn it-testi.",
          ],
        },
        {
          titel: "Rakkomandazzjonijiet tal-prezzijiet",
          paragraphs: [
            "Għar-rakkomandazzjonijiet tal-prezzijiet naċċessaw data tas-suq, tat-temp u tar-rati tal-kambju minn sorsi esterni. Dawn it-talbiet ma jinkludux data personali, iżda biss il-post, il-perjodu u l-karatteristiċi tal-proprjetà.",
          ],
        },
      ],
    },
    {
      heading: "Siti web u dominji tal-klijenti tagħna",
      paragraphs: [
        "Jekk impriża toħloq sit web tagħha stess bi dominju tagħha stess permezz tal-għodda tal-bini, aħna namministraw ir-rekords tad-DNS meħtieġa għal dan permezz ta’ Cloudflare, Inc. B’dan jintbagħtu data tad-dominju u tal-konfigurazzjoni; id-data tal-viżitaturi tas-sit web tal-klijent nipproċessawha kif deskritt f’dan l-avviż.",
        "Għall-kontenut, l-informazzjoni legali u l-avviżi tal-privatezza tas-sit web tal-klijent hija responsabbli l-impriża kkonċernata.",
      ],
    },
    {
      heading: "Hosting u ħażna",
      paragraphs: [
        "Il-pjattaforma, id-database, il-midja u s-server tal-posta jaħdmu fuq servers ta’ Hetzner Online GmbH, il-Ġermanja, fiċ-ċentru tad-data ta’ Helsinki (il-Finlandja) — jiġifieri fl-Unjoni Ewropea. Ma’ Hetzner jeżisti ftehim dwar l-ipproċessar tad-data.",
        "Il-kopji ta’ sigurtà jinħolqu kriptati u jinżammu kriptati għand fornitur ta’ ħażna fl-UE.",
      ],
    },
    {
      heading: "Ħarsa ġenerali tar-riċevituri",
      paragraphs: [
        "Minbarra l-fornituri tas-servizzi msemmija, ngħaddu data personali biss meta nkunu obbligati bil-liġi (pereżempju lill-awtoritajiet tat-taxxa, lill-awtoritajiet tal-infurzar) jew meta int jew l-impriża responsabbli titlobha.",
      ],
      list: [
        "Hetzner Online GmbH (il-Ġermanja/il-Finlandja) — hosting, database, midja, server tal-posta",
        "Stripe Payments Europe, Limited (l-Irlanda) — pagamenti, ħlasijiet, verifika tal-identità",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (il-Lussemburgu) — pagamenti, jekk attivat",
        "Channex.io Ltd (ir-Renju Unit) — konnessjoni mal-portali tal-bukkjar",
        "Meta Platforms Ireland Limited (l-Irlanda) — messaġġi WhatsApp, jekk attivat",
        "Sendinblue SAS / Brevo (Franza, il-Ġermanja) — amministrazzjoni u bagħt tan-newsletter, biss bil-kunsens",
        "Google Ireland Limited (l-Irlanda) — traduzzjonijiet; protezzjoni tal-formola ta’ kuntatt kontra l-ispam (reCAPTCHA Enterprise), biss bil-kunsens; illoggjar bi Google, jekk użat",
        "Groq, Inc. (l-Istati Uniti) — suġġerimenti ta’ tweġiba, jekk attivati",
        "Cloudflare, Inc. (l-Istati Uniti) — amministrazzjoni tad-DNS għad-dominji tal-klijenti",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "F’din il-lista ma jidhrux servizzi li impriża tiftiehem dwarhom hija stess ma’ terza persuna u li tqabbad mal-kont tagħha permezz tal-interfaċċa — pereżempju assistent tal-IA bħal Claude ta’ Anthropic PBC, l-Istati Uniti. Dawn ma humiex fornituri tas-servizzi inkarigati minna, iżda riċevituri fuq istruzzjoni tal-impriża kkonċernata; mingħajr il-konnessjoni tagħha ma tgħaddi ebda data hemm. Skont il-lista ufficjali tal-parteċipanti tad-Dipartiment tal-Kummerċ tal-Istati Uniti, Anthropic ma hijiex ċertifikata taħt l-EU-US Data Privacy Framework; trasferiment għalhekk jistrieħ fuq il-klawżoli standard tal-protezzjoni tad-data, li għalihom trid tagħti kont l-impriża kkonċernata bħala kontrollur.",
          ],
        },
      ],
    },
    {
      heading: "Trasferiment lejn pajjiżi terzi",
      paragraphs: [
        "L-ipproċessar isir bħala regola fl-UE. Fil-każ tas-servizzi msemmija hawn fuq bi sede barra l-UE jista’ jkun hemm trasferiment lejn pajjiż terz.",
        "Għal Groq, Inc. u Cloudflare, Inc. (l-Istati Uniti) nibbażaw it-trasferiment fuq il-klawżoli standard tal-protezzjoni tad-data tal-Kummissjoni Ewropea skont l-Artikolu 46(2)(c) tal-GDPR, sakemm ir-riċevitur ma jkunx jista’ jistrieħ fuq deċiżjoni ta’ adegwatezza (EU-US Data Privacy Framework).",
      "Il-parti kontraenti tal-ipproċessar tal-pagamenti hija Stripe Payments Europe, Limited (l-Irlanda). Sakemm Stripe tirrikorri għal Stripe, LLC (l-Istati Uniti), din hija ċertifikata taħt l-EU-US Data Privacy Framework; f’dak ir-rigward it-trasferiment jistrieħ fuq id-deċiżjoni ta’ adegwatezza tal-Kummissjoni Ewropea skont l-Artikolu 45 tal-GDPR. B’mod komplementari japplikaw il-klawżoli standard tal-protezzjoni tad-data mill-[ftehim ta’ Stripe dwar l-ipproċessar tad-data](https://stripe.com/legal/dpa).",
        "Għal Channex.io Ltd (ir-Renju Unit) tapplika d-deċiżjoni ta’ adegwatezza tal-Kummissjoni Ewropea għar-Renju Unit; jekk din taqa’, jidħlu fis-seħħ il-klawżoli standard tal-protezzjoni tad-data.",
      ],
    },
    {
      heading: "Aċċess minn awtoritajiet ta’ pajjiżi terzi (US CLOUD Act)",
      paragraphs: [
        "Fornituri li huma soġġetti għall-ġurisdizzjoni tal-Istati Uniti jistgħu, skont l-US CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018), jiġu obbligati jgħaddu data lill-awtoritajiet tal-Istati Uniti — anki meta din id-data tinsab fuq servers fl-Unjoni Ewropea. Tali aċċess jista’ jkun f’kunflitt mal-GDPR, u l-fornitur jista’ jkun legalment imwaqqaf milli jinforma lilna jew lilek dwaru. La d-deċiżjoni ta’ adegwatezza dwar l-EU-US Data Privacy Framework u lanqas il-klawżoli standard tal-protezzjoni tad-data ma jeskludu dan ir-riskju.",
        "Aħna nillimitaw dan ir-riskju billi s-sistemi ewlenin — il-pjattaforma, id-database, il-midja, is-server tal-posta u l-kopji ta’ sigurtà — jitħaddmu għand fornituri Ewropej fl-Unjoni Ewropea, fejn ma tapplikax il-ġurisdizzjoni tal-Istati Uniti.",
      ],
      unterpunkte: [
        {
          titel: "Servizzi kkonċernati",
          paragraphs: [
            "Ġurisdizzjoni tal-Istati Uniti tista’ tidħol fil-kwistjoni esklużivament fil-każ tas-servizzi addizzjonali li ġejjin, li huma delimitati b’mod ċar:",
          ],
          list: [
            "Groq, Inc. (l-Istati Uniti) — suġġerimenti ta’ tweġiba fl-inbox tal-messaġġi, biss jekk l-impriża tattiva l-funzjoni. Jintbagħat il-kuntest tal-messaġġ ikkonċernat.",
            "Cloudflare, Inc. (l-Istati Uniti) — amministrazzjoni tad-DNS għad-dominji tal-klijenti. Jintbagħtu data tad-dominju u tal-konfigurazzjoni, ebda data tal-ospiti.",
            "Google LLC (l-Istati Uniti) — biss fil-każ tal-illoggjar bi Google u tat-traduzzjonijiet; il-parti kontraenti hija f’kull każ Google Ireland Limited, iżda aċċess mill-kumpanija omm tal-Istati Uniti xorta ma huwiex eskluż.",
          ],
        },
        {
          titel: "Possibbiltà li jiġu evitati",
          paragraphs: [
            "L-użu tal-pjattaforma huwa possibbli mingħajr dawn is-servizzi: is-suġġerimenti ta’ tweġiba jistgħu jintefew, l-amministrazzjoni tad-DNS tikkonċerna biss klijenti bi dominju tagħhom stess, u l-illoggjar bi Google huwa alternattiva volontarja għall-illoggjar bil-posta elettronika u l-password.",
          ],
        },
        {
          titel: "Distinzjoni mil-liġi Ewropea",
          paragraphs: [
            "Il-CLOUD Act huwa liġi tal-Istati Uniti, mhux liġi tal-Unjoni Ewropea. Għandu jkun distint mill-EU Data Act (ir-Regolament (UE) 2023/2854), li jirregola l-bidla u l-portabbiltà fis-servizzi tal-ipproċessar tad-data, kif ukoll mill-Cloud and AI Development Act, li fid-data ta’ dan l-avviż jinsab fil-proċedura leġiżlattiva Ewropea.",
          ],
        },
      ],
    },
    {
      heading: "Perjodi ta’ żamma",
      list: [
        "Data tal-kont: għat-tul tar-relazzjoni kummerċjali; wara dan tħassir, sakemm ma jkunx jeżisti obbligu ta’ żamma.",
        "Data tal-bukkjar, tal-fatturi u tal-pagamenti: skont il-liġi Daniża tal-kontabbiltà, ħames snin wara t-tmiem tas-sena finanzjarja li għaliha jappartjenu; għal klijenti bi sede fil-Ġermanja jistgħu japplikaw perjodi itwal tal-liġi kummerċjali u fiskali.",
        "Messaġġi u data tal-ospiti fil-pjattaforma: fuq istruzzjoni tal-impriża responsabbli, l-aktar tard sat-tħassir minnha jew sat-tmiem tal-kuntratt.",
        "Newsletter: sal-irtirar tal-kunsens; reġistrazzjonijiet mhux ikkonfermati jiskadu wara sebat ijiem. Il-prova tal-kunsens u tat-tħassir tal-abbonament tinżamm barra minn hekk sakemm tkun meħtieġa bħala prova.",
        "Reġistri tal-illoggjar u avvenimenti ta’ sigurtà: għal żmien qasir, għall-identifikazzjoni ta’ attakki.",
        "Fajls tar-reġistru tas-server: biss għal daqstant żmien kemm ikun meħtieġ għall-operat u għas-sigurtà.",
        "Kopji ta’ sigurtà: b’rotazzjoni, sakemm jiġu mibdula b’kopji aktar riċenti.",
      ],
    },
    {
      heading: "Id-drittijiet tiegħek",
      paragraphs: [
        "Għandek id-dritt ta’ aċċess (Artikolu 15), ta’ rettifika (Artikolu 16), ta’ tħassir (Artikolu 17), ta’ restrizzjoni tal-ipproċessar (Artikolu 18), ta’ portabbiltà tad-data (Artikolu 20) u ta’ oġġezzjoni għal ipproċessar ibbażat fuq interessi leġittimi (Artikolu 21 tal-GDPR). Kunsens mogħti tista’ tirtirah fi kwalunkwe ħin b’effett għall-futur.",
        `Għal dan ikkuntattja [${ANBIETER.email}](mailto:${ANBIETER.email}). Jekk id-data tiegħek tikkonċerna l-użu tal-pjattaforma minn impriża, ngħaddu t-talba tiegħek lill-impriża responsabbli jew nappoġġjawha fit-tweġiba.`,
        `Barra minn hekk tista’ tressaq ilment ma’ awtorità superviżorja tal-protezzjoni tad-data — għalina l-kompetenti hija ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Tista’ tikkuntattja wkoll l-awtorità superviżorja tal-post tar-residenza tiegħek.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Tħassir tal-kont u tad-data tal-applikazzjoni",
      paragraphs: [
        "It-tħassir tal-kont tiegħek tista’ titolbu int stess fi kwalunkwe ħin — fl-applikazzjoni taħt ‚Profil → Kont‘ jew permezz tal-formola tagħna fuq il-web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "It-triq fuq il-web taħdem deliberatament ukoll meta ma jkollokx l-applikazzjoni installata jew ma tkunx tista’ tilloggja aktar. Għall-protezzjoni kontra abbuż dan isir fi żewġ passi: iddaħħal l-indirizz tal-posta elettronika tal-kont tiegħek u tirċievi eżattament fuq dan l-indirizz link ta’ konferma. Biss meta tiftaħha t-talba tissir valida — indirizz imdaħħal waħdu ma jwassal għal xejn. Aħna nitrattaw it-talba fi żmien 30 jum u nwieġbu bil-posta elettronika.",
        "Mal-kont inħassru d-data tal-aċċess tiegħek, il-profil tiegħek, id-data tal-proprjetajiet u tal-kalendarju tiegħek kif ukoll il-messaġġi tiegħek. Ma jitħassrux dokumenti li għalihom jeżisti obbligu legali ta’ żamma — b’mod partikolari fatturi u dokumenti tal-bukkjar ta’ perjodi mħallsa (obbligu tal-kontabbiltà skont il-liġi Daniża, bħala regola ħames snin). Dawn id-dokumenti jiġu mblukkati għat-tul tal-perjodu, jiġifieri jinżammu esklużivament għat-twettiq ta’ dan l-obbligu u wara dan jitħassru.",
      ],
    },
    {
      heading: "Sigurtà tal-ipproċessar",
      paragraphs: [
        "Aħna nissalvagwardjaw l-ipproċessar bi miżuri tekniċi u organizzattivi skont l-Artikolu 32 tal-GDPR, b’mod partikolari: kriptaġġ kontinwu tat-trasport (TLS), regoli ta’ aċċess għal kull inkwilin direttament fid-database, permessi bbażati fuq l-irwoli bis-separazzjoni tad-data finanzjarja u tas-servizz, awtentikazzjoni b’żewġ fatturi fakultattiva, limitazzjoni tat-tentattivi ta’ illoggjar, kopji ta’ sigurtà kriptati b’test regolari ta’ rkupru kif ukoll ir-reġistrazzjoni ta’ avvenimenti rilevanti għas-sigurtà.",
      ],
    },
    {
      heading: "Obbligu li tingħata d-data",
      paragraphs: [
        "L-informazzjoni li neħtieġu għall-konklużjoni tal-kuntratt, għall-kontijiet u għall-obbligi legali hija meħtieġa — mingħajrha ma nistgħux nipprovdu l-pjattaforma. Kull informazzjoni oħra tingħata volontarjament.",
      ],
    },
    {
      heading: "Bidliet f’dan l-avviż",
      paragraphs: [
        "Aħna nadattaw dan l-avviż meta jinbidlu l-ipproċessar, il-fornituri tas-servizzi użati jew is-sitwazzjoni legali. Tapplika f’kull każ il-verżjoni ppubblikata hawn; id-data fuq turi minn meta tgħodd.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so.
export default datenschutz;
