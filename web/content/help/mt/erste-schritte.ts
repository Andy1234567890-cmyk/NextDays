import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "L-Ewwel Passi",
  description: "Waqqaf il-kont tiegħek u ibda f'ftit minuti.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Konfigurazzjoni",
      articles: [
        {
          slug: "willkommen",
          title: "Merħba għand myNextDays",
          excerpt: "Ħarsa ġenerali lejn il-PMS, il-maniġer tal-kanali, is-suq u l-app.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "myNextDays hija l-pjattaforma ċentrali tiegħek għal proprjetajiet tal-vaganzi u lukandi. Minflok bosta soluzzjonijiet separati, timmaniġġja d-disponibbiltà, il-prezzijiet, ir-riżervazzjonijiet u l-komunikazzjoni mal-mistiedna f'post wieħed — kemm jekk topera dar tal-vaganzi waħda kif ukoll bosta kmamar tal-lukanda.",
            },
            { type: "h2", text: "L-erba' bċejjeċ ewlenin" },
            {
              type: "ul",
              items: [
                "PMS (Sistema tal-Ġestjoni tal-Proprjetà): proprjetajiet, kalendarju, prezzijiet, riżervazzjonijiet, kompiti u ħlasijiet.",
                "Maniġer tal-Kanali: konnessjoni ma' portali bħal Booking, Airbnb u oħrajn — dħul wieħed, ħafna portali sinkronizzati.",
                "Suq tal-Pjattaforma: is-suq proprju ta' myNextDays, kanal ta' prenotazzjoni fl-istess livell tal-portali.",
                "App: l-applikazzjoni mobbli għall-mistiedna, is-sidien u l-impjegati bl-istess dejta tal-verżjoni tal-web.",
              ],
            },
            { type: "h2", text: "Kif il-bċejjeċ jaħdmu flimkien" },
            {
              type: "p",
              text: "Il-proprjetà, il-prezzijiet u d-disponibbiltà jitmexxew darba biss, ċentralment fil-PMS. Minn hemm, myNextDays tqassam id-dejta awtomatikament lill-kanali attivi kollha. Prenotazzjoni — ikun xi jkun il-kanal minn fejn tidħol — timblokka minnufih il-ljieli korrispondenti kullimkien, sabiex prenotazzjonijiet doppji jkunu esklużi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ibda billi tikkonfigura Kont u Negozju, imbagħad oħloq l-ewwel proprjetà tiegħek — dan l-ordni jfaddal korrezzjonijiet aktar tard.",
            },
            { type: "h2", text: "Il-passi li jmiss" },
            {
              type: "steps",
              items: [
                "Iftaħ Kont fil-menu u ikkompleta d-dettalji tan-negozju tiegħek.",
                "Oħloq l-ewwel proprjetà tiegħek taħt Proprjetajiet.",
                "Iċċekkja li l-faċilitajiet, ir-ritratti u l-prezzijiet ikunu kompluti.",
                "Ikklikkja Ippubblika biex tagħmel il-proprjetà viżibbli fuq il-kanali kollha.",
              ],
            },
            {
              type: "p",
              text: "Aktar dettalji dwar kull pass issibhom f'[Ikkonfigura l-Kont u n-Negozju](/hilfe/erste-schritte/konto-einrichten) u [Oħloq l-ewwel proprjetà tiegħek](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Ikkonfigura l-Kont u n-Negozju",
          excerpt: "Daħħal id-dejta bażika, l-indirizz tal-fatturazzjoni u l-munita b'mod korrett.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Qabel toħloq proprjetajiet, ikkonfigura n-negozju tiegħek fil-Kont. Din id-dejta hija meħtieġa għall-fatturi, il-portali u l-fatturazzjoni ma' myNextDays, u għalhekk għandha tkun kompluta u korretta.",
            },
            { type: "h2", text: "Daħħal id-dejta bażika" },
            {
              type: "steps",
              items: [
                "Iftaħ Kont fil-menu.",
                "Daħħal taħt Dejta Bażika l-isem tal-kumpanija jew l-isem tan-negozju individwali, l-indirizz u d-dettalji ta' kuntatt.",
                "Daħħal l-indirizz tal-fatturazzjoni — jidher fuq il-fatturi kollha maħruġa.",
                "Agħżel il-munita bażika tiegħek. Din tapplika għall-prezzijiet kollha sakemm tibdilha b'mod speċifiku għal kull proprjetà.",
              ],
            },
            { type: "h2", text: "Għaliex il-munita hija importanti" },
            {
              type: "p",
              text: "Il-munita ma tiġix indovinata jew miżjuda awtomatikament: jekk tkun nieqsa, ebda prezz ma jista' jintwera jew jiġi fatturat b'mod korrett. Għalhekk myNextDays titlob għażla konxja waqt il-konfigurazzjoni, minflok tuża valur default.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jekk tibdel il-munita ta' proprjetà aktar tard, il-pjani tal-prezzijiet kollha marbuta magħha jinbidlu wkoll. Wara dan, iċċekkja l-prezzijiet darba oħra.",
            },
            { type: "h2", text: "Indirizz tal-Fatturazzjoni u Fatturazzjoni" },
            {
              type: "p",
              text: "Taħt Fatturazzjoni fil-Kont tara l-fatturi kurrenti tiegħek u l-indirizz tal-fatturazzjoni reġistrat. Żommhom aġġornati, speċjalment meta tinbidel il-forma legali jew l-indirizz, sabiex il-fatturi jinħarġu korrettament.",
            },
            {
              type: "ul",
              items: [
                "Isem il-kumpanija jew isem in-negozju individwali",
                "Indirizz tal-fatturazzjoni bil-pajjiż",
                "Numru tat-taxxa jew tal-VAT, jekk applikabbli",
                "Munita bażika għal proprjetajiet ġodda",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Oħloq l-ewwel proprjetà tiegħek",
          excerpt: "Hekk toħloq pass pass l-ewwel proprjetà tiegħek li tista' tiġi prenotata.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Proprjetà f'myNextDays hija dejjem unità waħda li tista' tiġi prenotata: jew kamra waħda f'lukanda jew proprjetà tal-vaganzi sħiħa. Jekk topera lukanda b'diversi kmamar, oħloq proprjetà separata għal kull kamra.",
            },
            { type: "h2", text: "Oħloq proprjetà" },
            {
              type: "steps",
              items: [
                "Iftaħ Proprjetajiet fil-menu.",
                "Ikklikkja Żid Proprjetà.",
                "Agħżel it-tip ta' proprjetà: kategorija, tip ta' proprjetà u tip ta' offerta.",
                "Żid l-indirizz, l-okkupazzjoni u l-prezz bażiku fil-munita reġistrata tiegħek.",
                "Issejvja l-proprjetà bħala abbozz biex tikkompletaha aktar tard.",
              ],
            },
            { type: "h2", text: "X'jonqos wara" },
            {
              type: "p",
              text: "Proprjetà maħluqa ġdida hija fil-bidu biss abbozz u mhix viżibbli fuq ebda kanal. Żid il-faċilitajiet, ir-ritratti, id-deskrizzjoni u d-disponibbiltà tal-kalendarju qabel ma tippubblikaha — biss proprjetà kompluta tista' tiġi kkumerċjalizzata b'mod affidabbli.",
            },
            {
              type: "ul",
              items: [
                "Agħżel il-karatteristiċi tal-faċilitajiet mil-lista tal-kategoriji",
                "Żid mill-inqas ritratt ewlieni wieħed u deskrizzjoni waħda",
                "Daħħal l-okkupazzjoni (adulti, tfal, sodod) b'mod korrett",
                "Iċċekkja l-prezz bażiku u d-disponibbiltà tal-kalendarju",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jekk topera diversi tipi ta' kmamar, irrepeti dan il-proċess għal kull kamra individwali — ma teżisti ebda livell superjuri tal-bini bil-kmamar taħtu.",
            },
            {
              type: "p",
              text: "Meta l-oqsma obbligatorji kollha jkunu mimlija, tista' tippubblika l-proprjetà, ara [Ippubblika proprjetà](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Ippubblika proprjetà",
          excerpt: "Klikk waħda tattiva s-Suq tal-Pjattaforma, il-portali u l-websajt flimkien.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-pubblikazzjoni tagħmel proprjetà viżibbli u disponibbli għall-prenotazzjoni. Normalment klikk waħda biss hija biżżejjed biex tattiva t-tliet kanali ta' distribuzzjoni fl-istess ħin — madankollu tista' taġġusta l-viżibbiltà għal kull kanal individwalment fi kwalunkwe ħin.",
            },
            { type: "h2", text: "Kif tippubblika" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt Proprjetajiet.",
                "Fit-tab Ħarsa Ġenerali, iċċekkja li d-dettalji obbligatorji kollha jkunu mmarkati bl-aħdar.",
                "Ikklikkja Ippubblika.",
                "Ikkonferma d-djalogu — is-Suq tal-Pjattaforma, il-portali u l-websajt jiġu attivati.",
              ],
            },
            { type: "h2", text: "Ikkontrolla l-kanali individwalment" },
            {
              type: "p",
              text: "Wara l-pubblikazzjoni ssib fit-tab Viżibbiltà tliet swiċċijiet separati: Websajt, Suq tal-Pjattaforma u Portali. Jekk pereżempju tixtieq toffri proprjetà biss fuq il-websajt proprja tiegħek, imma mhux permezz tal-portali, sempliċement iddiżattiva s-swiċċ korrispondenti.",
            },
            {
              type: "ul",
              items: [
                "Websajt: viżibbiltà fuq il-websajt proprja tiegħek ta' myNextDays",
                "Suq tal-Pjattaforma: viżibbiltà fuq is-suq globali ta' myNextDays",
                "Portali: viżibbiltà fuq Booking, Airbnb u oħrajn",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dawn it-tliet swiċċijiet huma indipendenti mill-istatus tal-proprjetà (attiva/mhux attiva). Proprjetà attiva xorta tista' tkun mhux viżibbli fuq kanali individwali.",
            },
            { type: "h2", text: "Imblokka proprjetà temporanjament" },
            {
              type: "p",
              text: "Jekk tixtieq timblokka ġurnata waħda minflok il-proprjetà kollha, uża Stop-Sell fil-kalendarju — dan jimblokka l-ġurnata fuq il-kanali kollha fl-istess ħin, indipendentement mis-swiċċijiet tal-viżibbiltà.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Ifhem it-tliet kanali ta' distribuzzjoni",
          excerpt: "Ħarsa ġenerali lejn il-portali, is-Suq tal-Pjattaforma u l-app.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "myNextDays tikkumerċjalizza kull proprjetà permezz ta' diversi mogħdijiet fl-istess livell fl-istess ħin. Li tifhem kif dawn jaħdmu flimkien jgħinek tikkontrolla l-viżibbiltà u l-prezzijiet b'mod immirat.",
            },
            { type: "h2", text: "Portali" },
            {
              type: "p",
              text: "Permezz tal-maniġer tal-kanali, tqabbad il-proprjetà tiegħek ma' portali kbar ta' prenotazzjoni bħal Booking, Airbnb u oħrajn. Id-disponibbiltà u l-prezzijiet jiġu sinkronizzati awtomatikament, sabiex ma jkollokx bżonn iżżomm bosta kalendarji tal-portali manwalment.",
            },
            { type: "h2", text: "Suq tal-Pjattaforma" },
            {
              type: "p",
              text: "Is-suq ta' myNextDays huwa kanal ta' prenotazzjoni globali proprju — komparabbli ma' Booking jew Airbnb, iżda parti mill-istess pjattaforma. Mhuwiex sostitut għal ‘prenotazzjoni diretta’, imma kanal fl-istess livell b'assi ta' viżibbiltà tiegħu stess.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "L-app mobbli toffri lill-mistiedna, is-sidien u l-impjegati aċċess għall-istess dejta bħall-verżjoni tal-web — bħal dettalji tal-prenotazzjoni, messaġġi jew kompiti, skont ir-rwol rispettiv.",
            },
            { type: "h2", text: "Tliet assi ta' viżibbiltà separati" },
            {
              type: "ul",
              items: [
                "Websajt — il-websajt proprja tiegħek ta' myNextDays",
                "Suq tal-Pjattaforma — is-suq globali ta' myNextDays",
                "Portali — Booking, Airbnb u oħrajn permezz tal-maniġer tal-kanali",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "It-tliet assi jistgħu jiġu attivati jew diżattivati b'mod indipendenti minn xulxin. Stop-Sell u l-istatus tal-proprjetà, min-naħa l-oħra, jaffettwaw it-tliet kanali fl-istess ħin.",
            },
          ],
        },
      ],
    },
  ],
};
