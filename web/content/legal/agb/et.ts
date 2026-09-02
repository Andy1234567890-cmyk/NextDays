import type { LegalDoc } from "../types";

// Estnische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (recommended disclosure language) — Sinn und URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Üldtingimused agentuuridele ja üürileandjatele",
  stand: "Seisuga: 13. august 2026",
  intro: [
    "Käesolevad üldtingimused (edaspidi „tingimused“) reguleerivad tarkvaraplatvormi myNextDays (edaspidi „platvorm“) kasutamist agentuuride, üürileandjate, kinnisvarahaldurite ja muude ärikasutajate (edaspidi „kasutaja“) poolt.",
    "Platvormi pakkuja on myNextDays ApS, Taani õiguse alusel asutatud osaühing (anpartsselskab), Hirtshalsvej 21, 9881 Bindslev, Taani, registreeritud Taani äriregistris (CVR) numbri CVR 46615182 all (edaspidi „myNextDays“ või „meie“).",
    "Platvorm on mõeldud üksnes ettevõtjatele Saksa tsiviilseadustiku (BGB) § 14 või vastava ELi liikmesriigi vastavate sätete tähenduses. Platvorm ei ole mõeldud tarbijatele.",
  ],
  sections: [
    {
      heading: "§ 1 Kohaldamisala",
      paragraphs: [
        "Käesolevad tingimused kehtivad kõigi myNextDaysi ja kasutaja vahel sõlmitavate platvormi kasutamist käsitlevate lepingute ning kõigi platvormi kaudu osutatavate teenuste ja moodulite suhtes.",
        "Kasutaja teistsugused, vastuolus olevad või täiendavad tingimused saavad lepingu osaks üksnes juhul, kui myNextDays on nende kehtivusega tekstivormis sõnaselgelt nõustunud.",
      ],
    },
    {
      heading: "§ 2 Lepingu ese ja teenused",
      paragraphs: [
        "myNextDays annab kasutaja käsutusse pilvepõhise tarkvara puhkusemajutuste ja majutusettevõtete haldamiseks. Funktsioonide ulatus tuleneb kehtivast teenusekirjeldusest ja hõlmab eelkõige järgmist:",
      "Iga kasutaja poolt platvormile lisatud objekt loetletakse ühtlasi platvormi enda turuplatsil myBestDays (kohustuslik kanal). Kasutaja ei saa seda kanalit eraldi välja lülitada; ta saab objekti aga igal ajal funktsiooni „Müügi peatamine“ kaudu kõigist kanalitest korraga müügist eemaldada või selle kustutada. Objekt muutub myBestDays-is nähtavaks alles siis, kui kasutaja on selle avaldanud ja myNextDays on kuulutuse heaks kiitnud; myNextDays võib heakskiidu mõjuval põhjusel keelduda või selle tühistada. myBestDays-i kaudu tehtud broneeringute puhul kehtib tasu vastavalt § 7.",
      ],
      list: [
        "objektide, hõivatuskalendrite ja broneeringute haldamine (majutuse haldussüsteem),",
        "ühendamine kolmandate isikute broneerimiskanalitega (nt Booking.com, Airbnb) kanalihalduri kaudu,",
        "Pakkumiste avaldamine platvormi enda turuplatsi myBestDays kaudu (kohustuslik kanal, vt lõige 2),",
        "oma veebilehtede loomine integreeritud lehekoostaja abil,",
        "raamatupidamis-, arveldus- ja aruandlusfunktsioonid, sealhulgas omanikuaruanded,",
        "suhtlus külalistega ning maksete vastuvõtmine integreeritud maksetöötluse kaudu (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registreerimine, konto ja kasutaja andmed",
      paragraphs: [
        "Platvormi kasutamise eelduseks on konto registreerimine. Kasutaja on kohustatud esitama registreerimisel ja kogu lepingu kehtivuse ajal enda ja oma ettevõtte kohta õigeid, ajakohaseid ja täielikke andmeid ning neid muudatuste korral viivitamata ajakohastama.",
        "Sisselogimisandmeid tuleb hoida salajas ja kaitsta kolmandate isikute juurdepääsu eest. Kasutaja peab myNextDaysi viivitamata teavitama, kui esineb märke tema konto kuritarvitamisest.",
        "Konto ei ole üleantav. Kasutaja tagab, et kõik isikud, kes kontot tema nimel kasutavad, järgivad käesolevaid tingimusi.",
      ],
    },
    {
      heading: "§ 4 myNextDaysi roll broneeringutes",
      paragraphs: [
        "Majutuslepingud platvormil, ühendatud kolmandate isikute kanalites või kasutaja enda veebilehel pakutavate majutuste kohta sõlmitakse üksnes kasutaja (või tema esindatava omaniku) ja vastava külalise vahel. myNextDays ei saa majutuslepingu pooleks.",
        "Pakkumiste sisu (kirjeldused, fotod, hinnad, saadavus, maksud ja lõivud) õigsuse ja õiguspärasuse eest vastutab üksnes kasutaja.",
      ],
    },
    {
      heading: "§ 5 Maksete töötlemine Stripe’i kaudu",
      paragraphs: [
        "Maksetöötlusteenuseid agentuuridele ja üürileandjatele myNextDaysis osutab Stripe ning nende suhtes kehtib [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), mis hõlmab Stripe’i kasutustingimusi (edaspidi koos „Stripe’i teenusleping“). Käesolevate tingimustega nõustumisega või agentuuri või üürileandjana myNextDaysis tegevuse jätkamisega nõustub kasutaja olema seotud Stripe’i teenuslepinguga, mida Stripe võib aeg-ajalt muuta.",
        "Selleks et myNextDays saaks võimaldada maksetöötlusteenuseid Stripe’i kaudu, peab kasutaja esitama myNextDaysile enda ja oma ettevõtte kohta õigeid ja täielikke andmeid. Kasutaja volitab myNextDaysi edastama Stripe’ile need andmed ning tehinguandmed, mis on seotud Stripe’i osutatavate maksetöötlusteenuste kasutamisega.",
        "Õigussuhtes Stripe’iga on määrav lingitud ingliskeelne lepingutekst selle kehtivas redaktsioonis. Euroopa Majanduspiirkonna kasutajate lepingupartner on Stripe’i teenuslepingus nimetatud Stripe’i äriühing (praegu Stripe Payments Europe, Limited, Iirimaa). Stripe töötleb isikuandmeid vastavalt [Stripe’i privaatsuspoliitikale](https://stripe.com/privacy).",
        "Seadusest tulenevate tuvastamis- ja kontrollikohustuste täitmiseks (muu hulgas rahapesu tõkestamine ja põhimõte „tunne oma klienti“) võivad myNextDays ja Stripe igal ajal nõuda täiendavaid andmeid ja tõendeid, eelkõige isikut tõendavaid dokumente ning andmeid tegelike kasusaajate ja pangakonto kohta. Kui nõutud andmeid või tõendeid ei esitata määratud tähtaja jooksul, võidakse maksete vastuvõtmine või väljamaksed täielikult või osaliselt peatada, kuni andmed on täielikud.",
      ],
    },
    {
      heading: "§ 6 Väljamaksed, tagasinõuded ja negatiivsed saldod",
      paragraphs: [
        "Makseviis sõltub broneerimiskanalist. Kasutaja oma broneerimissüsteemi kaudu tehtud broneeringute ja ühendatud jaotusportaalide kaudu tehtud broneeringute puhul laekuvad külaliste maksed otse kasutaja maksekontole; nendel juhtudel on kasutaja külalise suhtes makse saaja ja majutusteenuse lepingupool (§ 4) ning myNextDays ei muutu ühelgi hetkel nende vahendite valdajaks. Selliste broneeringute pealt myNextDays protsentuaalset broneerimistasu ei võta; ühendatud jaotusportaalide kaudu tehtud broneeringute vahendustasu näidatakse eraldi ja esitatakse arve tagantjärele.",
        "myNextDaysi broneerimisportaali kaudu tehtud broneeringute puhul töödeldakse makse myNextDaysi kaudu. myNextDays peab seejuures kinni kehtivas hinnakirjas näidatud vahendustasu koos makse töötlemise kuludega ning kannab ülejäänud summa kasutajale üle alljärgnevate lõigete kohaselt. Tarkvara kasutamise eest võetav tasu (§ 7) jääb muutumatuks.",
        "Väljamaksed tehakse kasutaja esitatud pangakontole. myNextDays võib riskikaalutlustel väljamaksete sagedust kohandada, eelkõige uute kontode, ebatavaliste tehingumustrite või käimasolevate kontrollide korral.",
        "Külalistele tehtavad tagasimaksed kannab majanduslikult kasutaja. Tagasinõuded ja neist tulenevad tasud kannab kasutaja broneeringute puhul, mis on tehtud tema oma broneerimissüsteemi ja ühendatud jaotusportaalide kaudu, kuna kasutaja on neil juhtudel makse saaja; myNextDaysi broneerimisportaali kaudu tehtud broneeringute puhul kannab tagasinõuderiski myNextDays, välja arvatud juhul, kui see tuleneb kasutaja kohustuste rikkumisest (eelkõige majutusteenuse osutamata jätmisest või olulisest kõrvalekaldest). myNextDaysil on õigus tasaarvestada kasutaja kantavad summad tulevaste väljamaksetega.",
        "Kui kasutaja maksekontol tekib negatiivne saldo, peab kasutaja selle viivitamata tasuma. Kasutaja volitab myNextDaysi ja Stripe’i debiteerima negatiivsed saldod esitatud pangakontolt, niivõrd kui see on õiguslikult lubatud.",
      ],
    },
    {
      heading: "§ 7 Tasud ja arveldamine",
      paragraphs: [
        "Platvormi kasutamise tasud tulenevad lepingu sõlmimisel kokku lepitud hinnakirjast või individuaalsest pakkumisest. Kõikidele hindadele lisanduvad kohaldatavad seadusjärgsed maksud ning hinnad on esitatud lepingus märgitud valuutas.",
        "Tehingupõhised tasud (nt makse- või kanalitasud) võidakse kinni pidada või tasaarvestada vahetult vastava tehingu töötlemisel.",
        "Kui kasutaja on maksetega viivituses, võib myNextDays pärast eelnevat teavitamist blokeerida juurdepääsu platvormile kuni võlgnetavate summade tasumiseni.",
      ],
    },
    {
      heading: "§ 8 Kasutaja kohustused; enda õigustekstid",
      paragraphs: [
        "Kasutaja tagab, et tema pakkumised, sisu ja äritavad vastavad kohaldatavatele õigusaktidele, eelkõige majutuse asukohas kehtivale majutus-, registreerimis-, maksu- ja tarbijakaitseõigusele. Vajalikud load, registreeringud ja litsentsid hangib ja hoiab kasutaja omal vastutusel.",
        "Veebilehtede eest, mida kasutaja lehekoostaja kaudu haldab, ning oma pakkumiste eest platvormil vastutab kasutaja ise; see hõlmab eelkõige tema enda külaliste üldtingimusi, enda impressumit (teavet teenuseosutaja kohta) ja enda andmekaitseteavet.",
        "Keelatud on eelkõige: ebaõigete või eksitavate pakkumiste avaldamine, näilike või pettuslike tehingute töötlemine, § 5 kohase maksetöötluse vältimine platvormi kaudu sõlmitud broneeringute puhul ning igasugune kasutus, mis kahjustab platvormi turvalisust või kättesaadavust.",
      ],
    },
    {
      heading: "§ 9 Kolmandate isikute broneerimiskanalid",
      paragraphs: [
        "Kolmandate isikute kanalite (nt Booking.com, Airbnb) ühendamisel kehtivad täiendavalt vastava kanalioperaatori tingimused. Selleks vajalikud lepingud sõlmib kasutaja kanalioperaatoriga ise.",
        "myNextDays teostab saadavuse, hindade ja broneeringuandmete tehnilist sünkroniseerimist, kuid tal puudub mõju kanalioperaatorite sisule, komisjonitasudele ja otsustele ning ta ei vastuta nende kättesaadavuse eest.",
      ],
    },
    {
      heading: "§ 10 Kättesaadavus ja edasiarendamine",
      paragraphs: [
        "myNextDays osutab teenuseid hoolsa ettevõtja hoolsusega ja püüab tagada platvormi kõrge kättesaadavuse. Hooldusaknad, edasiarendused ja myNextDaysi mõjusfäärist väljapoole jäävad asjaolud (nt tõrked kolmandatest isikutest teenusepakkujate juures) võivad kättesaadavust ajutiselt piirata.",
        "myNextDays võib platvormi edasi arendada ja funktsioone muuta, kui see ei ohusta lepingu eesmärki ja muudatus on kasutajale mõistlikult vastuvõetav.",
      ],
    },
    {
      heading: "§ 11 Andmed ja andmekaitse",
      paragraphs: [
        "Kui myNextDays töötleb platvormi pakkumisel isikuandmeid kasutaja nimel (eelkõige külaliste andmeid), sõlmivad pooled isikuandmete kaitse üldmääruse (GDPR) artikli 28 kohase volitatud töötlemise lepingu.",
        "Kasutaja jääb vastutavaks tema esitatud andmete kogumise ja töötlemise andmekaitseõigusliku lubatavuse eest. myNextDaysi andmetöötluse üksikasjad on esitatud platvormi andmekaitseteabes; Stripe’i andmetöötluse suhtes kehtib § 5.",
      ],
    },
    {
      heading: "§ 12 Tehisintellekti kasutamine",
      paragraphs: [
        "myNextDays kasutab üksikutes funktsioonides tehisintellektisüsteeme, eelkõige hinnasoovituste (dünaamiline hinnastamine), sõnumite postkasti vastusesoovituste ja klienditoe abistamise jaoks. Need funktsioonid loovad ettepanekuid; otsus ja vastutus nende kasutamise eest lasuvad kasutajal. Hinnasoovitused ei asenda kasutaja enda ärilist kontrolli.",
        "Kui külalised suhtlevad vahetult tehisintellektisüsteemiga, avaldatakse see neile (määruse (EL) 2024/1689, „tehisintellekti määrus“, artikli 50 lõige 1). Tekstid, mille tehisintellektisüsteem on loonud või oluliselt muutnud ja mida kasutaja külalistele edastab, peab kasutaja tähistama niivõrd, kuivõrd tal on selleks seadusest tulenev kohustus.",
        "myNextDays ei käita tehisintellektisüsteeme, mis on tehisintellekti määruse III lisa kohaselt suure riskiga süsteemid, ega tehisintellekti määruse artikli 5 kohaselt keelatud tavasid. Kasutaja sisestatud andmeid ja tema külaliste andmeid ei kasutata ilma eraldi tellimuseta mudelite treenimiseks.",
        "Kasutaja ei tohi kasutada tehisintellekti funktsioone selleks, et jätta külalistele mulje inimestevahelisest suhtlusest seal, kus kehtib avaldamiskohustus, ega selleks, et anda õiguslikult siduvaid kinnitusi ilma omapoolset kontrolli teostamata.",
        "Kui kasutaja ühendab oma konto selleks ette nähtud liidese kaudu enda tehisintellekti assistendiga (näiteks Anthropic’i Claude), kehtib järgmine: kasutaja sõlmib selle teenuse lepingu ise ja vastutab selle kasutamise eest. Ühendus on tema korraldus myNextDaysile anda vabastatud andmed sinna välja — sealhulgas edastamine kolmandasse riiki, kui teenusepakkuja asukoht on väljaspool Euroopa Liitu. Kasutaja tagab, et tal on selleks õiguslik alus, et tema enda andmekaitseteabes on nimetatud vastuvõtja ja et edastamiseks nõutavad tagatised on olemas.",
        "Sellise ühenduse jaoks kasutab kasutaja juurdepääsu, mille puhul pakkuja pakub volitatud töötlemist ja välistab andmete kasutamise mudelite treenimiseks — Claude’i puhul on need ärikliendi juurdepääsud (Team, Enterprise või API). Erakasutuseks mõeldud juurdepääsud seda üldjuhul ei taga; seetõttu ei sobi need külaliste andmete jaoks. myNextDays ei saa tuvastada, millist juurdepääsu kasutaja kasutab, ja juhib sellele tähelepanu nõusolekuaknas.",
        "Kasutaja arvestab seejuures, et sisu, mille ta kopeerib kasutajaliidesest käsitsi assistendi sisestusväljale, ei ole üldjuhul pakkuja lepinguliste piirangutega kaetud — erinevalt liidese kaudu päritud andmetest.",
        "Broneerimisportaalist pärinevaid andmeid kasutab kasutaja ka liidese kaudu üksnes vastava broneeringu töötlemiseks ja teenindamiseks — mitte isikute hindamiseks, profiilide koostamiseks ega reklaami jaoks. Portaalid näevad selle eesmärgipiirangu ette oma tingimustes.",
      ],
    },
    {
      heading: "§ 13 Kaebused ja vahendus",
      paragraphs: [
        "myNextDays haldab ärikasutajate jaoks tasuta sisemist kaebuste lahendamise süsteemi (määruse (EL) 2019/1150, „P2B määrus“, artikkel 11). Kaebusi — eelkõige käesolevate tingimuste väidetavate rikkumiste, olulise mõjuga tehniliste probleemide või myNextDaysi kasutaja suhtes võetud meetmete kohta — saab esitada vormivabalt aadressil info@mynextdays.dk või rakenduses oleva klienditoe kaudu. Kaebuse kättesaamist kinnitatakse; menetlemine toimub kiiresti ja mõistliku aja jooksul, lihtsate juhtumite puhul üldjuhul 14 päeva jooksul. Tulemus teatatakse kasutajale selges keeles.",
        "Kui kaebemenetluses kokkulepet ei saavutata, on myNextDays valmis pöörduma koos kasutajaga kohtuväliselt järgmiste vahendajate poole (P2B määruse artikkel 12): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Genf 20, Šveits — menetlused ka kaugteel ja mitmes keeles; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Kopenhaagen K, Taani — platvormi pakkuja asukohariik.",
        "Nimetamine ei kohusta kasutajat vahendusmenetlust läbi viima; õigus pöörduda kohtusse jääb puutumata. Vahenduse mõistlikes kuludes osaleb myNextDays; jaotus sõltub vastava vahendaja reglemendist ja üksikjuhtumi asjaoludest.",
        "myNextDays avaldab igal aastal andmed kaebuste hulga, menetlemise kestuse ja võetud meetmete kohta.",
      ],
    },
    {
      heading: "§ 14 Intellektuaalne omand",
      paragraphs: [
        "Kõik õigused platvormile, selle tarkvarale ja sisule (välja arvatud kasutaja lisatud sisu) kuuluvad myNextDaysile või tema litsentsiandjatele. Kasutaja saab lepingu kehtivuse ajaks lihtsa, mitteüleantava õiguse kasutada platvormi lepingus kokku lepitud ulatuses.",
        "Enda lisatud sisu suhtes annab kasutaja myNextDaysile platvormi käitamiseks vajalikud lihtsad kasutusõigused (eelkõige salvestamiseks, reprodutseerimiseks, kuvamiseks ja edastamiseks ühendatud kanalitele).",
      ],
    },
    {
      heading: "§ 15 Vastutus",
      paragraphs: [
        "myNextDays vastutab piiramatult tahtluse ja raske hooletuse eest ning elu, keha või tervise kahjustamisest tuleneva kahju eest.",
        "Kerge hooletuse korral vastutab myNextDays üksnes oluliste lepinguliste kohustuste (kardinaalkohustuste) rikkumise eest, piirdudes lepingule tüüpilise ettenähtava kahjuga. Vastutus tootevastutust reguleerivate õigusaktide alusel ja võetud garantiidest tulenev vastutus jääb puutumata.",
        "Andmete kaotsimineku eest vastutab myNextDays üksnes ulatuses, milles kahju oleks tekkinud ka siis, kui kasutaja oleks andmeid nõuetekohaselt ja korrapäraselt varundanud, välja arvatud juhul, kui andmete varundamine on lepingu kohaselt myNextDaysi kohustus.",
      ],
    },
    {
      heading: "§ 16 Kehtivusaeg, ülesütlemine ja blokeerimine",
      paragraphs: [
        "Lepingu kehtivusaeg ja ülesütlemistähtajad tulenevad vastavast lepingust. Õigus lepingu erakorraliseks ülesütlemiseks mõjuval põhjusel jääb puutumata.",
        "myNextDays võib ajutiselt blokeerida juurdepääsu platvormile või üksikutele funktsioonidele (sealhulgas maksete vastuvõtmisele ja väljamaksetele), kui esinevad konkreetsed märgid käesolevate tingimuste rikkumisest, pettusest või kuritarvitavast kasutamisest või kui myNextDays on selleks kohustatud seaduse või makseteenuse pakkuja korralduse alusel. Kasutajat teavitatakse blokeerimisest, niivõrd kui see on õiguslikult lubatud.",
        "Pärast lepingu lõppemist teeb myNextDays kasutaja andmed tema taotlusel 30 päeva jooksul üldlevinud vormingus eksportimiseks kättesaadavaks; seejärel andmed kustutatakse, kui seadusjärgsed säilitamiskohustused seda ei välista.",
      ],
    },
    {
      heading: "§ 17 Käesolevate tingimuste muutmine",
      paragraphs: [
        "myNextDays võib käesolevaid tingimusi tulevikku suunatud mõjuga muuta, kui see on mõjuvatel põhjustel vajalik (eelkõige õigusaktide muudatused, kohtupraktika muutumine või makseteenuse pakkujate nõuded) ja kasutajat ei seata sellega ebamõistlikult ebasoodsasse olukorda.",
        "Muudatustest teavitatakse kasutajat tekstivormis vähemalt kuus nädalat enne nende jõustumist. Kui kasutaja ei esita teavitamistähtaja jooksul vastuväidet või jätkab platvormi kasutamist pärast muudatuste jõustumist, loetakse muudetud tingimused vastuvõetuks; sellele tagajärjele juhitakse teates eraldi tähelepanu.",
      ],
    },
    {
      heading: "§ 18 Lõppsätted",
      paragraphs: [
        "Kohaldatakse selle riigi õigust, kus on platvormi pakkuja asukoht, välistades ÜRO konventsiooni kaupade rahvusvahelise ostu-müügi lepingute kohta (CISG). Kasutaja asukohariigi imperatiivsed sätted jäävad puutumata.",
        "Kõigi käesolevast lepingust või sellega seoses tekkivate vaidluste ainupädev kohtualluvus on — seadusega lubatud ulatuses — platvormi pakkuja asukoha järgne kohus.",
        "Kui käesolevate tingimuste üksikud sätted on või muutuvad kehtetuks, ei mõjuta see ülejäänud sätete kehtivust.",
      ],
    },
  ],
};
