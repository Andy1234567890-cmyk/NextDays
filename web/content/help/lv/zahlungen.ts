import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Maksājumi un rēķini",
  description: "Maksājumu pakalpojumu sniedzēji, maksājumu noteikumi un rēķini.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Maksājumi",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Maksājumu pakalpojumu sniedzēja savienošana",
          excerpt:
            "Kā savienot Stripe vai PayPal ar myNextDays, lai automātiski apstrādātu maksājumus.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Pieejamie sniedzēji" },
            {
              type: "p",
              text: "myNextDays maksājumus apstrādā, izmantojot savienotus maksājumu pakalpojumu sniedzējus. Pašlaik atbalstīti Stripe un PayPal — varat savienot vienu vai abus sniedzējus vienlaikus un izmantot atkarībā no objekta vai viesa vēlmes.",
            },
            {
              type: "steps",
              items: [
                "Atveriet Konts un pārejiet uz sadaļu „Maksājumi“.",
                "Izvēlieties vēlamo sniedzēju — Stripe vai PayPal.",
                "Sekojiet savienojuma dialogam un piesakieties pie sniedzēja vai izveidojiet jaunu kontu.",
                "Apstipriniet savienojumu — statuss mainīsies uz „savienots“.",
              ],
            },
            { type: "h2", text: "Kas notiek pēc tam" },
            {
              type: "p",
              text: "Tiklīdz sniedzējs ir savienots, varat nosūtīt maksājumu saites, iekasēt priekšapmaksas un sākt atmaksas tieši no rezervācijas. Visas summas tiek apstrādātas attiecīgā objekta norādītajā valūtā.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez savienota sniedzēja maksājumus varat atzīmēt tikai manuāli kā saņemtus — automātiska iekasēšana tad nav iespējama.",
            },
            { type: "h2", text: "Vairāki objekti, viens sniedzējs" },
            {
              type: "p",
              text: "Reiz izveidots savienojums attiecas uz visu kontu un visiem jūsu objektiem. Kā notiek iekasēšanas detaļas, nosakāt ar [Maksājumu noteikumi](/hilfe/zahlungen/zahlungsregeln). Izmaksas jums pēc tam notiek caur attiecīgo sniedzēju, skatiet [Izmaksas](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe piemērots kartes maksājumiem un daudziem vietējiem maksāšanas veidiem",
                "PayPal piedāvā viesiem pazīstamu alternatīvu",
                "Abus sniedzējus var neatkarīgi vienu no otra atvienot un no jauna savienot",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Maksājumu noteikumi",
          excerpt: "Nosakiet, kad kļūst maksājama rezervācijas priekšapmaksa un atlikuma maksājums.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Priekšapmaksa un atlikuma maksājums" },
            {
              type: "p",
              text: "Maksājumu noteikumi nosaka, kā finansiāli tiek apstrādāta rezervācija — piemēram, priekšapmaksa rezervācijas brīdī un atlikuma maksājums pirms ierašanās, vai pilna apmaksa uzreiz. Noteikumi attiecas uz katru objektu un tos var jebkurā laikā pielāgot.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz sadaļu „Maksājumu noteikumi“.",
                "Izvēlieties, vai tiek iekasēta priekšapmaksa, un nosakiet tās daļu.",
                "Nosakiet, kad kļūst maksājams atlikuma maksājums, piemēram, noteiktu dienu skaitu pirms ierašanās.",
                "Saglabājiet iestatījumus.",
              ],
            },
            { type: "h2", text: "Automātiska iekasēšana" },
            {
              type: "p",
              text: "Ja ir savienots maksājumu pakalpojumu sniedzējs, myNextDays automātiski iekasē priekšapmaksu un atlikuma maksājumu norādītajā laikā un iepriekš informē viesi ar ziņu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Maksājumu noteikumi darbojas tikai rezervācijām ar savienotu maksājumu pakalpojumu sniedzēju. Bez sniedzēja maksājumus atzīmējat manuāli rezervācijā.",
            },
            { type: "h2", text: "Atšķirības pa kanāliem" },
            {
              type: "p",
              text: "Portālos var būt spēkā to pašu maksājumu apstrāde — šajā gadījumā pārbaudiet attiecīgā portāla noteikumus. Rezervācijām caur pašu platformu vai vietni vienmēr piemēro jūsu šeit norādītos noteikumus. Detaļas par sniedzēja pieslēgšanu lasiet sadaļā [Maksājumu pakalpojumu sniedzēja savienošana](/hilfe/zahlungen/zahlungsanbieter-verbinden), par rēķinu izrakstīšanu — sadaļā [Rēķinu izveide](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Priekšapmaksu var noteikt kā fiksētu summu vai procentuālo daļu",
                "Atlikuma maksājuma termiņu var brīvi izvēlēties",
                "Izmaiņas attiecas tikai uz jaunām rezervācijām, ne uz atpakaļejošu spēku",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Rēķinu izveide",
          excerpt: "Kā izveidot rezervācijai rēķinu ar pareizu rēķina adresi.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Rēķina izveide" },
            {
              type: "p",
              text: "Katrai rezervācijai var izveidot rēķinu — pašam viesim vai citam uzņēmumam, ja rezervācija veikta darījumdarbībai.",
            },
            {
              type: "steps",
              items: [
                "Atveriet rezervāciju sadaļā Rezervācijas.",
                "Izvēlieties „Izveidot rēķinu“.",
                "Pārbaudiet vai papildiniet rēķina adresi.",
                "Pārbaudiet norādītās pozīcijas — nakšņošanu, papildpakalpojumus, maksas.",
                "Izveidojiet rēķinu un nosūtiet to viesim.",
              ],
            },
            { type: "h2", text: "Rēķina adreses uzturēšana" },
            {
              type: "p",
              text: "Rēķina adresi varat norādīt tieši rezervācijā vai lūgt viesim to papildināt, izmantojot rezervācijas apstiprinājumu. Bez pilnīgas adreses dažās valstīs nevar izsniegt juridiski spēkā esošu rēķinu.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Uzņēmumu klientiem īpaši pārbaudiet uzņēmuma nosaukumu un adresi — vēlākas korekcijas prasa korekcijas rēķinu.",
            },
            { type: "h2", text: "Summas un valūta" },
            {
              type: "p",
              text: "Visas pozīcijas tiek norādītas objektam noteiktajā valūtā. Jau veiktie maksājumi rēķinā tiek atzīmēti kā maksājuma saņemšana. Kā rodas priekšapmaksa un atlikuma maksājums, lasiet sadaļā [Maksājumu noteikumi](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Rēķinus var lejupielādēt kā PDF",
                "Korekcijas rēķini iespējami jebkurā laikā izmaiņu gadījumā",
                "Papildpakalpojumi parādās kā atsevišķa pozīcija",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Atmaksas",
          excerpt:
            "Kā pilnībā vai daļēji atmaksāt maksājumu, ja rezervācija tiek anulēta vai mainīta.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kad nepieciešama atmaksa" },
            {
              type: "p",
              text: "Atmaksa parasti nepieciešama anulēšanas gadījumā, taču tā var būt nepieciešama arī vēlākas cenas korekcijas vai anulēta papildpakalpojuma gadījumā.",
            },
            {
              type: "steps",
              items: [
                "Atveriet skarto rezervāciju sadaļā Rezervācijas.",
                "Rezervācijas maksājumu sadaļā izvēlieties „Atmaksa“.",
                "Ievadiet atmaksājamo summu — pilnībā vai daļēji.",
                "Apstipriniet atmaksu.",
              ],
            },
            { type: "h2", text: "Norise caur maksājumu pakalpojumu sniedzēju" },
            {
              type: "p",
              text: "Atmaksa tiek veikta ar maksājumā izmantoto sniedzēju — Stripe vai PayPal — un tieši pārskaitīta uz viesa sākotnējo maksāšanas līdzekli. Process automātiski tiek atzīmēts rezervācijas laika skalā.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez savienota maksājumu pakalpojumu sniedzēja atmaksu nevar sākt automātiski — šādā gadījumā par atmaksu vienojieties tieši ar viesi.",
            },
            { type: "h2", text: "Ietekme uz komisijām" },
            {
              type: "p",
              text: "Jau norēķinātas tirgus vai portāla komisijas atmaksas gadījumā tiek proporcionāli pielāgotas. Vairāk par to lasiet sadaļā [Komisiju izpratne](/hilfe/zahlungen/provisionen-verstehen). Detaļas par pašu anulēšanu lasiet sadaļā [Anulēšana un atmaksa](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Daļējas atmaksas iespējamas atsevišķām pozīcijām",
                "Apstrādes statuss rezervācijā vienmēr redzams",
                "Atmaksas notiek tikai caur sākotnēji izmantoto sniedzēju",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Izmaksas",
          excerpt:
            "Kā saņemt savu rezervāciju ieņēmumus no savienotajiem maksājumu pakalpojumu sniedzējiem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kā darbojas izmaksas" },
            {
              type: "p",
              text: "Ienākošie maksājumi vispirms uzkrājas pie savienotā maksājumu pakalpojumu sniedzēja. No turienes notiek izmaksa uz jūsu norādīto bankas kontu pēc attiecīgā sniedzēja parastā ritma.",
            },
            {
              type: "steps",
              items: [
                "Atveriet Konts un pārejiet uz sadaļu „Maksājumi“.",
                "Sadaļā „Izmaksas“ pārbaudiet attiecīgā sniedzēja statusu.",
                "Pēc vajadzības atveriet sniedzēja detalizēto skatu pilnai izmaksu vēsturei.",
              ],
            },
            { type: "h2", text: "Kas tiek atskaitīts pirms izmaksas" },
            {
              type: "p",
              text: "Pirms izmaksas tiek ņemtas vērā piemērojamās tirgus un portāla komisijas, kā arī sniedzēja maksas. Izmaksātā summa tāpēc ne vienmēr atbilst sākotnējai rezervācijas summai.",
            },
            {
              type: "note",
              variant: "info",
              text: "Precīzu atskaitījumu struktūru izskaidro [Komisiju izpratne](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Vairāki objekti un īpašnieki" },
            {
              type: "p",
              text: "Ja pārvaldāt objektus dažādiem īpašniekiem, izmaksas tiek attiecinātas atbilstoši norādītajām īpašnieku abrēķina shēmām. Neatbilstību gadījumā vispirms pārbaudiet pamatā esošo rezervāciju statusu sadaļā Rezervācijas.",
            },
            {
              type: "ul",
              items: [
                "Izmaksas ritmu un metodi nosaka attiecīgais sniedzējs",
                "Aizturētas summas, piemēram, notiekošu atmaksu dēļ, ir atzīmētas",
                "Pilna vēsture ir pieejama tieši pie sniedzēja",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Komisiju izpratne",
          excerpt:
            "Pārskats par to, kā veidojas tirgus un portāla komisijas un kur tās tiek norēķinātas.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Divi komisiju veidi" },
            {
              type: "p",
              text: "Rezervācijām caur myNextDays var rasties divas dažādas komisijas: tirgus komisija par rezervācijām caur pašu platformu, kā arī portāla komisijas par rezervācijām, kas ienāk caur pievienotiem portāliem, piemēram, Booking vai Airbnb. Abas ir neatkarīgas viena no otras un var atšķirties atkarībā no rezervācijas pārdošanas veida.",
            },
            {
              type: "ul",
              items: [
                "Tirgus komisija: rodas rezervācijām caur myNextDays platformu",
                "Portāla komisija: to aprēķina attiecīgais portāls pēc saviem noteikumiem",
                "Tiešās rezervācijas jūsu pašu vietnē jāaplūko neatkarīgi no tā",
              ],
            },
            { type: "h2", text: "Kur komisijas ir redzamas" },
            {
              type: "steps",
              items: [
                "Atveriet Konts un pārejiet uz sadaļu „Norēķini“.",
                "Izvēlieties vēlamo mēnesi.",
                "Pārbaudiet sarakstu pa rezervācijām ar attiecīgo komisiju.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Caur kuru kanālu ienāca rezervācija, redzat tieši pie rezervācijas — tas izskaidro, kāda komisija katrā gadījumā tika piemērota.",
            },
            { type: "h2", text: "Saistība ar izmaksām" },
            {
              type: "p",
              text: "Komisijas tiek atskaitītas no rezervācijas summas pirms izmaksas. Detaļas par izmaksas procesu lasiet sadaļā [Izmaksas](/hilfe/zahlungen/auszahlungen). Atmaksas gadījumā attiecīgā komisija tiek proporcionāli koriģēta — pilnu rezervācijas gaitu rāda [Rezervācijas laika skala](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
