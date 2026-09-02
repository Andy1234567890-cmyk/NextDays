// Partner-AGB — Lettisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "myNextDays partnerprogrammas dalības nosacījumi: piesaiste, komisijas maksas pamats, līmenis, komandas komisijas maksa, aizliegumi, marķēšana, izmaksa.",
  numbered: false,
  toc: true,
  title: "Partnerprogrammas dalības nosacījumi (Partneru noteikumi un nosacījumi) — projekts",
  standIso: "2026-09-02",
  intro: [
    "PROJEKTS — Šie nosacījumi ir myNextDays darba versija un vēl nav juridiski pārbaudīti. Līdz pārbaudītās versijas izlaišanai tie tiek uzskatīti par programmas aprakstu, nevis par galīgo līguma tekstu. Pārbaudītā versija tiks publicēta šajā adresē ar jaunu versijas numuru; partneriem tiks lūgts atkārtoti piekrist nākamajā pieteikšanās reizē.",
    `Šie dalības nosacījumi regulē dalību partnerprogrammā (filiāļu programmā) ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (turpmāk tekstā „myNextDays“ vai „mēs“) ar partneru (turpmāk tekstā „Partneris“) starpniecību.`,
    "Partnerprogramma ir paredzēta personām un uzņēmumiem, kas atrodas ES, Šveicē vai Apvienotajā Karalistē un kas iesaka uzņēmumus (izīrētājus, aģentūras, viesnīcas) myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Dalība un apstiprināšana",
      paragraphs: [
        "Dalība prasa pieteikumu, izmantojot partnera informācijas paneli. Obligātie dati ir vārds vai uzņēmuma nosaukums, juridiskā forma, valsts, vismaz viens sociālo mediju konts ar adresi, lietotājvārdu un sasniedzamību, kā arī uzņēmumiem — PVN identifikācijas numurs.",
        "myNextDays personīgi pārbauda katru pieteikumu un brīvi lemj par apstiprināšanu. Nav tiesību uz uzņemšanu. Dalība ir bezmaksas; myNextDays abonements nav priekšnoteikums.",
        "Partneris uztur savus datus aktuālus, jo īpaši kanālus, juridisko formu, nodokļu un izmaksu datus.",
        "Norādītā sasniedzamība sākotnēji ir pašnovērtējums. Partneris var brīvprātīgi savienot savus YouTube, Instagram, Facebook un TikTok kontus; tad sekotāji un skatījumi tiek nolasīti no platformas un parādīti kā verificēti. Neverificēta sasniedzamība tiek mazāk ņemta vērā apstiprināšanas un turpmāko pārbaužu laikā. Savienojumu var jebkurā laikā atvienot informācijas panelī; sīkāka informācija par apstrādi ir pieejama privātuma politikā.",
      ],
    },
    {
      heading: "§ 2 Uzņēmumu piesaiste (Attribution)",
      paragraphs: [
        "Uzņēmums tiek piesaistīts Partnerim, ja tas reģistrējas ar Partnera ieteikuma kodu. Kods tiek redzami parādīts uzņēmumam reģistrācijas laikā un apstiprināts, nosūtot. Izsekošanas sīkfaili netiek iestatīti.",
        "Uzņēmums tiek piesaistīts tieši vienam Partnerim; noteicošais ir reģistrācijas laikā apstiprinātais kods. Vēlāka pārkārtošana notiek tikai myNextDays, ja tiek pierādīta kļūda.",
        "Netiek piesaistīti paša Partnera, tā dalībnieku, darbinieku vai radinieku uzņēmumi, kā arī uzņēmumi, kas jau ir vai ir bijuši myNextDays klienti.",
      ],
    },
    {
      heading: "§ 3 Komisijas maksa par pašu klientiem",
      paragraphs: [
        "Komisijas maksas pamats ir piesaistītā uzņēmuma neto abonementa ieņēmumi (pamat tarifs un moduļi) no apmaksātiem rēķiniem — bez PVN, bez portāla komisijas maksām, papildu pakalpojumiem, papildu aprēķiniem un citiem caurplūdes posteņiem.",
        "Komisijas likme ir atkarīga no partnera ranga maksājuma brīdī. Rangi un likmes ir publicētas programmas lapā. Rangs tiek noteikts pēc maksājošo klientu skaita partnera struktūrā: viņa paša maksājošie klienti un viņa komandas partneru maksājošie klienti (§ 4), katrs klients vienu reizi. Rangs tiek noteikts katru mēnesi atskaites datumā; paaugstināšana stājas spēkā nekavējoties, pazemināšana tikai tad, ja divos secīgos atskaites datumos skaits ir bijis zem sliekšņa.",
        "Ja partneris pirmo reizi sasniedz rangu no „Aufsteiger“, viņš vienreiz saņem šim rangam programmas lapā norādīto paaugstināšanas bonusu (pašlaik 50,00 EUR par katru rangu, visiem partneriem eiro). Katrs rangs tiek apmaksāts tikai vienu reizi, arī pēc pazemināšanas un atkārtotas paaugstināšanas. Bonuss ir pakļauts atmaksas periodam saskaņā ar § 7.",
        "Komisija rodas par katru uzņēmumu divpadsmit mēnešus no tā pirmā maksas abonementa rēķina; ar partnera starpniecību nodrošināts bezmaksas testa periods un bezmaksas mēnesis netiek ieskaitīti. Ja abonements beidzas agrāk, komisija beidzas ar pēdējo apmaksāto rēķinu.",
        "No ranga „Elite-Partner“ partneris papildus saņem superkomisiju programmas lapā norādītajā apmērā (pašlaik 2,5 %) no visu viņa struktūras klientu neto abonementa apgrozījuma — pašu klientu un viņa komandas partneru klientu — bez divpadsmit mēnešu ierobežojuma, kamēr attiecīgais klients uztur maksas abonementu un partneris maksājuma brīdī ieņem šo rangu. Tā rodas papildus komisijai saskaņā ar 2. teikumu un § 4.",
        "Par katru myBestDays saņemto un apmaksāto rezervāciju no uzņēmuma, kas ir piesaistīts partnerim vai kādam no viņa komandas partneriem, partneris saņem rezervācijas daļu programmas lapā norādītajā apmērā (pašlaik 0,5 %) no viesa samaksātās rezervācijas summas rezervācijas valūtā, bez laika ierobežojuma, kamēr piesaiste pastāv. Drošības naudas nav rezervācijas summa. Atmaksas viesim proporcionāli samazina daļu (§ 7).",
      ],
    },
    {
      heading: "§ 4 Komandas komisija",
      paragraphs: [
        "No ranga „Aufsteiger“ partneris drīkst vadīt komandas partnerus. Ja cits partneris piesakās, izmantojot partnera komandas saiti, un redzami apstiprina tā kodu savā pieteikumā, viņš pēc apstiprināšanas tiek piesaistīts partnera (turpmāk „Sponsors“) komandai. Ja Sponsors pieteikuma brīdī neieņem šo rangu, pieteikums paliek spēkā, komandas piesaiste nerodas.",
        "Sponsors saņem komandas komisiju no savu komandas partneru klientu neto abonementa apgrozījuma, kas ir starpība starp viņa paša komisijas likmi un komandas partnera komisijas likmi, katra atbilstoši rangam maksājuma brīdī. Ja abi ir vienā rangā vai komandas partneris ir augstākā rangā, komandas komisija nerodas. Komandas partnera komisija un Sponsora komandas komisija kopā nekad nepārsniedz augstāko likmi skalā (pašlaik 30 %).",
        "Komandas komisijas maksa ir tikai vienu līmeni dziļa: komandas partneri nesaņem komandas komisijas maksu par partneriem, kurus viņi paši piesaista. Par partnera piesaistīšanu netiek maksāta atlīdzība; dalības maksa netiek iekasēta. Komandas komisijas maksa rodas tikai no apmaksātiem abonēšanas ieņēmumiem.",
        "Komandas komisijas maksa katram komandas klientam tiek piemērota divpadsmit mēnešus no viņa pirmā apmaksātā rēķina, uz to attiecas tas pats atmaksas periods, un tā tiek proporcionāli atcelta atmaksas vai atgriešanas gadījumā (§ 7). Tā rodas tikai tad, ja sponsors un komandas partneris ir apstiprināti; pretējā gadījumā tā tiek apturēta līdz atrisināšanai.",
        "Komandas piešķiršana ir vienreizēja. Izmaiņas veic tikai myNextDays ar dokumentētu pamatojumu.",
      ],
    },
    {
      heading: "§ 5 Partnera pienākumi un marķēšana",
      paragraphs: [
        "Partneris katru ieteikumu marķē ar savu saiti vai kodu kā reklāmu — ieraksta sākumā, ieraksta valodā, atbilstoši savas valsts prasībām (Vācijā, cita starpā, § 5a Abs. 4 UWG, Dānijā markedsføringsloven § 6 Abs. 4). myNextDays nodrošina tekstu katrai valstij partnera informācijas panelī.",
        "Partneris sniedz myNextDays tikai informāciju, kas atbilst publicētajiem pakalpojumu aprakstiem, un nesniedz nekādus solījumus myNextDays vārdā. Aizliegti ir jo īpaši veiksmes un garantijas solījumi (piemēram, „garantēta pilna noslodze trīs dienās”), kā arī paziņojumi par ienākumiem, kas neizriet no publicētajiem pakalpojumu aprakstiem.",
        "Katrs video un katrs ieraksts, kurā minēts myNextDays vai kurā ir partnera saite, pirms publicēšanas tiek iesniegts pārbaudei partnera informācijas panelī kā fails. Partnera saite rodas tikai pēc myNextDays rakstiskas apstiprināšanas; publicēšana bez apstiprināšanas ir aizliegta. myNextDays var atsaukt apstiprinājumu; jau radušās komisijas maksas paliek nemainīgas.",
        "Logotipiem, ekrānuzņēmumiem, B-Roll, pārklājumiem un ekrānuzņēmumiem partneris izmanto tikai myNextDays nodrošināto reklāmas materiālu. Pašu, nepārbaudītu programmatūras ierakstu izmantošana nav atļauta.",
      ],
    },
    {
      heading: "§ 6 Aizliegtās prakses",
      paragraphs: ["Jo īpaši aizliegts ir:"],
      list: [
        "Zīmola solīšana: maksas reklāmas par zīmolu „myNextDays”, rakstības variantiem un kombinācijām (piemēram, „myNextDays cenas”) meklētājprogrammās un tīklos;",
        "Sīkdatņu nomešana, slēptas pāradresācijas, iFrames, automatizēta partnera saites izsaukšana vai cita tehniska piešķiršanas manipulācija;",
        "Pašreklāma: savu uzņēmumu, akcionāru, darbinieku vai radinieku reģistrācija, izmantojot savu kodu vai komandas partnera kodu;",
        "Pirkta sasniedzamība (pirkti sekotāji, klikšķu fermas, botu trafiks), kā arī stimuli uzņēmumiem reģistrācijai (atmaksas, dāvanas, loterijas);",
        "Rekrutēšanas solījumi: partneru piesaistīšana ar ienākumu solījumiem, kas nav no apmaksātiem abonēšanas ieņēmumiem, vai programmas attēlošana kā ienākumu avots, piesaistot citus partnerus;",
        "Spams, neatļauta tiešā mārketinga un trešo pušu preču zīmju vai satura izmantošana bez tiesībām.",
      ],
    },
    {
      heading: "§ 7 Atmaksas periods, atcelšana, aizturēšana",
      paragraphs: [
        "Katrs komisijas maksas ieraksts ir atvērts 30 dienas (atmaksas periods) pēc tā rašanās un pēc tam ir izmaksājams. Ja pamatā esošais rēķins tiek pilnībā vai daļēji atmaksāts vai atcelts (Chargeback), komisijas maksa — ieskaitot uz to balstītu komandas komisijas maksu — tiek proporcionāli atcelta, arī pēc izmaksas, veicot ieskaitu ar nākotnes komisijas maksām.",
        "Ja ir aizdomas par § 2, § 5 vai § 6 pārkāpumu, myNextDays drīkst aizturēt piešķīrumus un komisijas maksas līdz situācijas noskaidrošanai. Ja pārkāpums apstiprinās, attiecīgās komisijas maksas tiek anulētas.",
      ],
    },
    {
      heading: "§ 8 Izmaksa un kredīts",
      paragraphs: [
        "Izmaksājamās komisijas maksas tiek apkopotas katru mēnesi pa valūtām un izmaksātas, tiklīdz tās sasniedz programmas lapā vai informācijas panelī norādīto minimālo summu attiecīgajā valūtā. Valūtu konvertācija nenotiek.",
        "Norēķini notiek, izmantojot kredīta procedūru (pašfakturēšana, momsloven § 52a): myNextDays katrai izmaksai izveido kredīta noti; Partneris neizsniedz rēķinu. Partneris piekrīt kredīta procedūrai.",
        "Uzņēmēji saņem kredīta noti ar norādi par pakalpojuma saņēmēja nodokļu saistībām (Reverse Charge); priekšnoteikums ir derīgs, apstiprināts PVN reģistrācijas numurs. Privātpersonas saņem kredīta noti bez PVN un pašas deklarē komisijas maksu.",
        "Izmaksa tiek veikta, izmantojot SEPA pārskaitījumu, Wise vai PayPal uz Partnera informācijas panelī norādītajiem datiem.",
      ],
    },
    {
      heading: "§ 9 Dati un ieskats",
      paragraphs: [
        "Partneris redz piešķirtos uzņēmumus pseidonīmi (numurs, valsts, statuss, summas). Uzņēmumu nosaukumi, e-pasta adreses vai rezervācijas dati netiek atklāti. Sponsors redz savu komandas partneru vārdu vai uzņēmuma nosaukumu, rangu, maksājošo klientu skaitu un no tā izrietošo komandas komisijas maksu, nevis klientu detaļas.",
        "Par saistītajiem kontiem un izveidotajiem ierakstiem myNextDays redz sekotājus, skatījumus, mijiedarbības, kā arī klikšķus un klientus katram ierakstam. Neparastības (piemēram, sekotāju lēciens bez atbilstošiem skatījumiem vai ievērojama atšķirība starp pašdeklarēto un verificēto vērtību) ir norādes personīgai pārbaudei saskaņā ar § 6 un § 10, nevis automātiska bloķēšana.",
        "Personas datu apstrāde partneru programmā ir aprakstīta privātuma politikā.",
      ],
    },
    {
      heading: "§ 10 Termiņš, bloķēšana un izbeigšana",
      paragraphs: [
        "Dalība ir beztermiņa un to var izbeigt abas puses jebkurā laikā rakstiskā formā. Jau radušās, izmaksājamās komisijas maksas tiek izmaksātas saskaņā ar § 8; pēc izbeigšanas jaunas komisijas maksas nerodas.",
        "myNextDays drīkst bloķēt Partneri, ja tiek pārkāpti šie noteikumi. Bloķēšanas laikā komisijas maksas tiek aizturētas; ja pārkāpums apstiprinās, tās tiek anulētas.",
      ],
    },
    {
      heading: "§ 11 Izmaiņas",
      paragraphs: [
        "myNextDays var drīkst mainīt šos noteikumus un līmeņus ar spēkā stāšanos nākotnē. Izmaiņas tiks publicētas partneru informācijas panelī un šajā lapā ar versijas numuru; būtiskas izmaiņas gadījumā partnerim tiks lūgts atkārtoti piekrist. Jau radušās komisijas maksas paliek nemainīgas.",
      ],
    },
    {
      heading: "§ 12 Piemērojamās tiesības",
      paragraphs: [
        "Tiek piemērotas Dānijas tiesības, izņemot kolīziju normas. Obligātie patērētāju aizsardzības noteikumi valstī, kurā privātam partnerim ir pastāvīgā dzīvesvieta, paliek neskarti.",
      ],
    },
  ],
};
