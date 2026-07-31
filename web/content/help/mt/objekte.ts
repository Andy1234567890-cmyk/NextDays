import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Proprjetajiet u Faċilitajiet",
  description: "Oħloq u ġġestixxi kmamar u proprjetajiet tal-vaganzi.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Ġestjoni tal-Proprjetajiet",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Proprjetà = unità waħda li tista' tiġi prenotata",
          excerpt: "Għaliex kull proprjetà f'myNextDays hija eżattament unità waħda li tista' tiġi prenotata.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "F'myNextDays, proprjetà hija dejjem eżattament unità waħda li tista' tiġi prenotata — kamra waħda f'lukanda jew proprjetà tal-vaganzi sħiħa. Dan il-prinċipju japplika kemm jekk topera dar tal-vaganzi, appartament tal-vaganzi jew lukanda, u huwa l-bażi għad-disponibbiltà, il-prezzijiet u l-prenotazzjonijiet.",
            },
            { type: "h2", text: "Mhux bini b'kmamar taħtu" },
            {
              type: "p",
              text: "Fehma żbaljata komuni hija li tirrappreżenta bini ta' lukanda bħala proprjetà waħda b'diversi kmamar taħtha. Dan mhuwiex previst f'myNextDays. Jekk pereżempju topera lukanda b'tmien kmamar doppji u erba' kmamar singoli, oħloq tnax-il proprjetà separata — mhux proprjetà waħda b'numru ta' kmamar.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Deliberatament ma jeżisti ebda qasam bħal ‘Numru ta' Kmamar’ fil-livell tal-proprjetà. Kull kamra teħtieġ proprjetà tagħha stess b'kalendarju u prezzijiet tagħha stess.",
            },
            { type: "h2", text: "Proprjetajiet tal-Vaganzi" },
            {
              type: "p",
              text: "Fil-każ ta' dar tal-vaganzi jew appartament tal-vaganzi, il-proprjetà kollha tikkorrispondi għall-unità li tista' tiġi prenotata. Hawn m'hemm ebda suddiviżjoni oħra — proprjetà tal-vaganzi hija dejjem proprjetà indipendenti b'kalendarju tagħha stess.",
            },
            { type: "h2", text: "Għaliex dan huwa importanti" },
            {
              type: "ul",
              items: [
                "Kull proprjetà għandha l-kalendarju tad-disponibbiltà tagħha stess — il-prenotazzjonijiet doppji jiġu evitati b'mod eżatt għal kull proprjetà.",
                "Il-prezzijiet, il-faċilitajiet u r-ritratti japplikaw għal kull proprjetà, mhux għal kull bini.",
                "Proprjetà tappartjeni dejjem eżattament lil sid wieħed — l-ebda assenjazzjoni multipla.",
                "Il-viżibbiltà tal-kanal (Websajt, Suq tal-Pjattaforma, Portali) tiġi kkontrollata għal kull proprjetà.",
              ],
            },
            {
              type: "p",
              text: "Kif tagħżel it-tip xieraq ta' proprjetà għall-kamra jew il-proprjetà tal-vaganzi tiegħek, aqra taħt [Iddefinixxi t-Tip ta' Proprjetà](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Iddefinixxi t-Tip ta' Proprjetà",
          excerpt: "Assenja kategorija, tip ta' proprjetà u tip ta' offerta b'mod korrett.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "It-tip ta' proprjetà jiddetermina kif il-proprjetà tiegħek tiġi kklassifikata u ffiltrata fuq il-portali u s-Suq tal-Pjattaforma. Huwa magħmul minn tliet oqsma ta' għażla li jibnu fuq xulxin, li tgħaddi minnhom meta toħloq jew tibdel proprjetà.",
            },
            { type: "h2", text: "It-tliet livelli ta' għażla" },
            {
              type: "steps",
              items: [
                "Agħżel l-ewwel il-kategorija — pereżempju akkomodazzjoni tal-vaganzi jew lukanda.",
                "Fuq din il-bażi, agħżel it-tip ta' proprjetà — pereżempju appartament tal-vaganzi, dar tal-vaganzi, kamra doppja jew kamra singola.",
                "Agħżel it-tip ta' offerta — pereżempju l-proprjetà kollha jew kamra privata.",
                "Imla l-oqsma addizzjonali li jidhru skont l-għażla, pereżempju t-tip ta' sodda jew is-sular.",
              ],
            },
            { type: "h2", text: "Għaliex l-ordni huwa importanti" },
            {
              type: "p",
              text: "It-tliet listi jiddependu minn xulxin: l-għażla tal-kategorija tillimita t-tipi ta' proprjetà disponibbli, u l-għażla tat-tip ta' proprjetà tillimita min-naħa tagħha t-tipi ta' offerta. B'hekk jinħolqu biss kombinazzjonijiet sensibbli, bħal dawk użati wkoll fuq il-portali l-kbar.",
            },
            {
              type: "note",
              variant: "info",
              text: "Jekk tibdel il-kategorija aktar tard, myNextDays tiċċekkja jekk it-tip ta' proprjetà u t-tip ta' offerta għadhomx jaqblu, u tistedinek tagħżel mill-ġdid jekk ikun meħtieġ.",
            },
            { type: "h2", text: "Editja t-tip ta' proprjetà" },
            {
              type: "p",
              text: "Iftaħ il-proprjetà mixtieqa taħt Proprjetajiet fil-menu u aqleb għat-tab Dejta Bażika. Hemm issib it-tliet listi taħt Tip ta' Proprjetà. Meta tissejvja l-bidla tiegħek, il-klassifikazzjoni l-ġdida tiġi trasferita lill-kanali attivi kollha.",
            },
            {
              type: "ul",
              items: [
                "Kategorija: klassifikazzjoni ġenerali (eż. akkomodazzjoni tal-vaganzi, lukanda)",
                "Tip ta' proprjetà: tip konkret ta' proprjetà (eż. appartament tal-vaganzi, kamra doppja)",
                "Tip ta' offerta: eżattament x'jiġi prenotat (eż. proprjetà sħiħa, kamra privata)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Immaniġġja l-Faċilitajiet",
          excerpt: "Agħżel u żomm aġġornati l-karatteristiċi tal-faċilitajiet.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-faċilitajiet ta' proprjetà jinfluwenzaw b'mod sinifikanti kemm tinstab u tiġi ffiltrata tajjeb fuq il-portali. Il-mistiedna jiffiltraw speċifikament skont karatteristiċi bħal WiFi, kċina jew parkeġġ — dettalji neqsin jistgħu jeskludu proprjetà mir-riżultati tat-tfittxija.",
            },
            { type: "h2", text: "Agħżel il-faċilitajiet" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-tab Faċilitajiet.",
                "Agħżel il-karatteristiċi kollha applikabbli mil-lista mogħtija.",
                "Żid dettalji jekk meħtieġ, bħan-numru ta' postijiet tal-parkeġġ jew it-tip ta' kċina.",
                "Issejvja l-bidliet — jiġu trasferiti awtomatikament lill-portali attivi kollha.",
              ],
            },
            { type: "h2", text: "Minn fejn joriġinaw il-karatteristiċi" },
            {
              type: "p",
              text: "Il-lista tal-faċilitajiet issegwi l-katalogu ta' karatteristiċi tal-portali l-kbar, sabiex id-dettalji tiegħek jistgħu jiġu assenjati korrettament hemmhekk. Karatteristiċi proprji, invintati liberament, mhumiex previsti, peress li ma jistgħux jiġu trasferiti b'mod nadif lill-portali.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Iċċekkja l-faċilitajiet wara kull bidla strutturali — pereżempju arja kkundizzjonata ġdida jew kamra tal-banju addizzjonali — sabiex id-dettalji jibqgħu aġġornati fuq il-kanali kollha.",
            },
            { type: "h2", text: "Gruppi komuni ta' karatteristiċi" },
            {
              type: "ul",
              items: [
                "Faċilitajiet bażiċi: WiFi, tisħin, arja kkundizzjonata",
                "Kċina u ikel: kċina mgħammra għal kollox, magna tal-ħasil tal-platti, magna tal-kafè",
                "Banju u ħwejjeġ: banju privat, magna tal-ħasil, xugamani",
                "Żona ta' barra: gallarija, terrazza, ġnien, parkeġġ",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Ritratti u Deskrizzjoni",
          excerpt: "Stampi u testi konvinċenti għal aktar prenotazzjonijiet.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Ir-ritratti u d-deskrizzjoni huma l-bażi l-aktar importanti li fuqha l-mistiedna jieħdu d-deċiżjoni tagħhom. Proprjetà tista' tiġi ppubblikata biss meta jkun hemm mill-inqas ritratt ewlieni u deskrizzjoni waħda.",
            },
            { type: "h2", text: "Itella' ritratti" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-tab Ritratti.",
                "Iġbed il-fajls tal-istampi fiż-żona tat-tlugħ jew agħżilhom permezz tad-djalogu tal-fajls.",
                "Iddefinixxi ritratt ewlieni — jidher fir-riżultati tat-tfittxija u fil-kartelli.",
                "Organizza l-bqija tar-ritratti f'ordni sensibbli billi ġġibhom.",
              ],
            },
            { type: "h2", text: "Ikteb id-deskrizzjoni" },
            {
              type: "p",
              text: "Aqleb għat-tab Deskrizzjoni u daħħal titlu u test deskrittiv. Iddeskrivi b'mod konkret il-post, il-karatteristiċi speċjali u l-udjenza fil-mira tal-proprjetà — frażijiet ġeneriċi jidhru inqas konvinċenti fuq il-portali minn dettalji tanġibbli.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ma jistgħux jintużaw ritratti ta' proprjetajiet oħra jew mill-internet — il-portali jivverifikaw dan u jistgħu jimblokkaw proprjetajiet f'każ ta' ksur.",
            },
            { type: "h2", text: "Rakkomandazzjonijiet għal ritratti tajbin" },
            {
              type: "ul",
              items: [
                "Mill-inqas ħames ritratti, idealment wieħed għal kull kamra",
                "Format orizzontali, dawl tajjeb, ebda watermark",
                "Ir-ritratt ewlieni juri l-proprjetà b'mod attraenti u ċar kemm jista' jkun",
                "Aġġorna regolarment, speċjalment wara rinnovazzjonijiet",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Okkupazzjoni u Kapaċità",
          excerpt: "Daħħal in-numru massimu ta' mistiedna u t-tqassim tas-sodod b'mod korrett.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-okkupazzjoni tiddetermina kemm-il mistieden tista' tilqa' proprjetà, u tiġi vverifikata f'kull tfittxija u prenotazzjoni. Dettalji żbaljati jwasslu jew għal talbiet miċħuda jew għal okkupazzjoni żejda — it-tnejn għandhom jiġu evitati.",
            },
            { type: "h2", text: "Daħħal l-okkupazzjoni" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-tab Okkupazzjoni.",
                "Daħħal in-numru massimu ta' adulti.",
                "Daħħal in-numru massimu ta' tfal, jekk permessi.",
                "Daħħal it-tqassim tas-sodod għal kull kamra, pereżempju sodda doppja u żewġ sodod singoli.",
              ],
            },
            { type: "h2", text: "Il-limiti tal-okkupazzjoni" },
            {
              type: "p",
              text: "Meta ssir talba għal prenotazzjoni, myNextDays tivverifika awtomatikament jekk in-numru ta' mistiedna mitlub jaqax fl-okkupazzjoni reġistrata. Talbiet li jaqbżu l-kapaċità massima jiġu miċħuda, jew lanqas biss jidhru bħala disponibbli għall-prenotazzjoni.",
            },
            {
              type: "note",
              variant: "info",
              text: "Sodda addizzjonali jew sodda tat-tarbija tgħolli l-kapaċità reali biss jekk tiddaħħal b'mod espliċitu fit-tqassim tas-sodod — inkella n-numru massimu ta' mistiedna jibqa' l-istess.",
            },
            { type: "h2", text: "Sorsi tipiċi ta' żbalji" },
            {
              type: "ul",
              items: [
                "In-numru massimu ta' mistiedna stabbilit għoli wisq, minkejja li hemm ftit sodod biss",
                "In-numru ta' tfal minsi, minkejja li l-proprjetà tattira familji",
                "It-tqassim tas-sodod ma ġiex aġġornat wara rinnovazzjoni",
              ],
            },
            {
              type: "p",
              text: "Jekk l-okkupazzjoni u l-faċilitajiet ma jaqblux, iċċekkja wkoll it-tab [Faċilitajiet](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Status u Viżibbiltà tal-Proprjetà",
          excerpt: "Id-differenza bejn attiv/mhux attiv u t-tliet assi tal-kanali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "myNextDays tiddistingwi bejn żewġ affarijiet differenti li spiss jiġu mħawda: l-istatus tal-proprjetà (attiva jew mhux attiva) u l-viżibbiltà fuq kanali individwali ta' distribuzzjoni. Tikkontrolla t-tnejn separatament minn xulxin.",
            },
            { type: "h2", text: "Status tal-Proprjetà" },
            {
              type: "p",
              text: "L-istatus active ifisser li proprjetà tista' tinbiegħ bażikament. L-istatus inactive iwaqqaf kompletament proprjetà — pereżempju matul rinnovazzjoni fit-tul. Proprjetà mhux attiva ma tistax tiġi prenotata fuq ebda kanal, indipendentement mis-swiċċijiet tal-kanali.",
            },
            { type: "h2", text: "It-tliet assi tal-kanali" },
            {
              type: "p",
              text: "Jekk proprjetà tkun attiva, tliet swiċċijiet indipendenti jiddeċiedu eżattament fejn tkun viżibbli:",
            },
            {
              type: "ul",
              items: [
                "Websajt — viżibbiltà fuq il-websajt proprja tiegħek ta' myNextDays",
                "Suq tal-Pjattaforma — viżibbiltà fuq is-suq globali ta' myBestDays",
                "Portali — viżibbiltà fuq Booking, Airbnb u oħrajn",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dawn it-tliet assi huma kompletament indipendenti mill-istatus tal-proprjetà u minn xulxin. Proprjetà attiva tista', pereżempju, tkun viżibbli biss fuq il-websajt, imma mhux fuq il-portali.",
            },
            { type: "h2", text: "Ibdel l-istatus" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-tab Ħarsa Ġenerali.",
                "Issettja l-istatus għal attiv jew mhux attiv.",
                "Aġġusta wkoll it-tliet swiċċijiet tal-kanali fit-tab Viżibbiltà jekk meħtieġ.",
                "Issejvja l-bidla — tapplika minnufih fuq il-kanali kollha affettwati.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Għal imblukkar fuq perjodu qasir ta' ġranet individwali, uża minflok Stop-Sell fil-kalendarju — dan jimblokka b'mod immirat ġranet fuq il-kanali kollha, mingħajr ma tiddiżattiva l-proprjetà kollha.",
            },
          ],
        },
      ],
    },
  ],
};
