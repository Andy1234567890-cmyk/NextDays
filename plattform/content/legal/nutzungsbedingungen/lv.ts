import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Lietošanas noteikumi viesiem",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šie lietošanas noteikumi regulē rezervācijas portāla myBestDays (turpmāk – „Platforma“) izmantošanu, ko veic ceļotāji un rezervētāji (turpmāk – „Viesis“ vai „Jūs“).",
    `Platformas operators ir ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dānija, CVR Nr. ${ANBIETER.cvr} (turpmāk – „myBestDays“ vai „mēs“). myBestDays ir šīs sabiedrības preču zīme, nevis atsevišķa juridiska persona. Pilnīgi pakalpojuma sniedzēja dati atrodami [Juridiskajā informācijā](https://mybestdays.dk/rechtliches/impressum).`,
    "Izmantojot Platformu, Jūs piekrītat šiem noteikumiem. Lūdzam tos rūpīgi izlasīt.",
  ],
  summary: {
    heading: "Šo noteikumu kopsavilkums",
    paragraphs: [
      "myBestDays ir tirdzniecības vieta. Mēs nodrošinām Platformu, kurā sniedzēji piedāvā savas naktsmītnes — pašu naktsmītni nesniedzam mēs. Izmitināšanas līgums tiek noslēgts starp Jums un sniedzēju, nevis ar mums.",
      "Tas, ko redzat sludinājumā, nāk no sniedzēja: apraksts, attēli, aprīkojums, cena, atcelšanas nosacījumi un iekšējās kārtības noteikumi. Sludinājumus pārbaudām, taču nevaram galvot par katru sniedzēja norādi.",
      "Cena, ko redzat, pabeidzot rezervāciju, ir kopējā cena par rezervētajiem pakalpojumiem. Papildu summas, kas maksājamas tikai uz vietas (piemēram, kūrorta nodeva vai drošības nauda), norādām iepriekš atsevišķi.",
      "Ja kaut kas noiet greizi, vispirms vērsieties pie mums. A15 iedaļā aprakstīts, kā iesniegt sūdzību un kādi ceļi Jums pēc tam ir pieejami.",
      "Šis kopsavilkums izskaidro noteikumus, taču tos neaizstāj. Noteicošais ir pilnais teksts.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Visas rezervācijas caur myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definīcijas",
          paragraphs: [
            "Šajos noteikumos lietotie jēdzieni ir izskaidroti vārdnīcā dokumenta beigās. Svarīgākie ir:",
          ],
          list: [
            "„Platforma“ – tīmekļa vietne, mobilās lietotnes un visas citas piekļuves vietas, ar kurām myBestDays attēlo naktsmītnes un starpnieko rezervācijās.",
            "„Sniedzējs“ – fiziska vai juridiska persona, kas piedāvā naktsmītni caur Platformu (saimnieks, iznomātājs, aģentūra, viesnīca vai izmitināšanas uzņēmums).",
            "„Naktsmītne“ – sniedzēja piedāvātais izmitināšanas pakalpojums, proti, brīvdienu objekts vai kādas istabas vai objekta veida vienība.",
            "„Rezervācija“ – caur Platformu noslēgta naktsmītnes rezervācija noteiktam laikposmam.",
            "„Kopējā cena“ – summa, kas norādīta, pabeidzot rezervāciju, ieskaitot visus nodokļus, maksas un piemaksas, kas tiek aprēķinātas caur Platformu.",
            "„Izmaksas uz vietas“ – summas, kas netiek aprēķinātas caur Platformu, bet kļūst maksājamas sniedzējam (piem., kūrorta nodeva, drošības nauda, gala uzkopšana pēc sniedzēja izvēles).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Par šiem noteikumiem",
          paragraphs: [
            "Šie noteikumi attiecas uz jebkuru Platformas izmantošanu neatkarīgi no tā, vai izveidojat kontu un vai notiek rezervācija.",
            "A iedaļa attiecas uz visām rezervācijām. B iedaļā ietverti papildu noteikumi par naktsmītnēm. Pretrunu gadījumā priekšroka ir B iedaļai.",
            "Pašam izmitināšanas pakalpojumam papildus piemēro attiecīgā sniedzēja noteikumus (jo īpaši iekšējās kārtības noteikumus un atcelšanas nosacījumus), kas norādīti sludinājumā. Šie sniedzēja noteikumi papildina mūsējos; tie nevar atkāpties no mūsu noteikumiem attiecībā uz Jūsu attiecībām ar mums.",
            "Šie noteikumi pieejami visās 24 Eiropas Savienības oficiālajās valodās. Atšķirību gadījumā starp valodu versijām noteicošā ir vācu valodas versija, ja vien Jūsu dzīvesvietas valsts imperatīvās normas nenosaka citādi.",
            "Imperatīvās patērētāju tiesības saskaņā ar Jūsu dzīvesvietas valsts tiesībām šie noteikumi neietekmē.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Par myBestDays",
          paragraphs: [
            "myBestDays ir tiešsaistes tirdzniecības vieta brīvdienu naktsmītnēm un izmitināšanas uzņēmumiem. Mēs pārvaldām Platformu, kurā sniedzēji prezentē savas naktsmītnes, bet viesi tās var rezervēt.",
            "Mēs esam starpnieks, nevis izmitinātājs. Nevienu no Platformā piedāvātajām naktsmītnēm mēs nepārvaldām, neekspluatējam, neadministrējam un nekontrolējam, un neesam izmitināšanas līguma puse.",
            "myBestDays ir starpniecības pakalpojums Regulas (ES) 2022/2065 par digitālajiem pakalpojumiem izpratnē. Mūsu dati un procedūras saskaņā ar šo regulu atrodami sadaļā [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays nav ceļojumu rīkotājs. Mēs nesastādām kompleksus ceļojumus Direktīvas (ES) 2015/2302 izpratnē; par saistītiem ceļojumu pakalpojumiem sk. A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Mūsu Platforma",
          paragraphs: [
            "Sludinājuma saturs – apraksts, fotoattēli, aprīkojums, noslogojuma ierobežojumi, cenas, pieejamība, atcelšanas nosacījumi un iekšējās kārtības noteikumi – nāk no attiecīgā sniedzēja. Sniedzējs atbild par tā pareizību un pilnīgumu.",
            "Sludinājumus pārbaudām pirms publicēšanas un pastāvīgi attiecībā uz acīmredzamiem mūsu [Piemērota satura noteikumu](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) pārkāpumiem. Pienākuma vispārīgi uzraudzīt visu saturu nav, un tas saskaņā ar Regulas (ES) 2022/2065 8. pantu arī nebūtu pieļaujams.",
            "Kā kārtojam meklēšanas rezultātus un kādas pazīmes nosaka secību, skaidrojam sadaļā [Informācija par cenām, ranžēšanu un ieteikumiem](https://mybestdays.dk/rechtliches/preisangaben).",
            "Cenšamies nodrošināt pastāvīgi pieejamu Platformu, taču nesolām nepārtrauktu pieejamību. Iespējama apkope, traucējumi un pielāgojumi.",
            "Sniedzēju satura tulkojumi var būt veidoti mašīnas ceļā. Noteicošā ir sniedzēja ievadītā oriģinālā versija.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Mūsu vērtības",
          paragraphs: [
            "No viesiem un sniedzējiem sagaidām cieņpilnu attieksmi. Diskriminācija izcelsmes, ādas krāsas, reliģijas, pārliecības, dzimuma, dzimtes identitātes, seksuālās orientācijas, invaliditātes, vecuma vai līdzīgu pazīmju dēļ Platformā netiek pieļauta – sk. [Pretdiskriminācijas politiku](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Uzvedībai uzturēšanās laikā piemēro [Pamatnoteikumus viesiem](https://mybestdays.dk/rechtliches/grundregeln-gaeste), sniedzējiem – [Sniedzēju rīcības kodeksu](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Jūsu konts un Platformas izmantošana",
          paragraphs: [
            "Rezervācijai varat izveidot kontu. Jūs atbildat par savu piekļuves datu konfidencialitāti un nekavējoties mūs informējat, ja rodas aizdomas par neatļautu izmantošanu.",
            "Platformu drīkstat izmantot tikai tad, ja esat rīcībspējīgs un varat spēkā esoši slēgt līgumus.",
            "Jūsu dati reģistrējoties un rezervējot jābūt pareiziem un pilnīgiem – jo īpaši vārds, kontaktinformācija un ceļotāju skaits. Sniedzējam šie dati nepieciešami, lai nodrošinātu naktsmītni un izpildītu savus reģistrācijas pienākumus.",
            "Jo īpaši nav atļauts:",
          ],
          list: [
            "fiktīvas rezervācijas, krāpnieciski maksājumi vai svešu maksāšanas līdzekļu izmantošana bez pilnvarojuma;",
            "automatizēta datu ieguve no Platformas (scraping, crawler) ārpus tā, ko atļauj mūsu robots.txt fails;",
            "darbības, kas traucē vai pārslogo Platformu vai tās infrastruktūru vai apiet to drošības pasākumus;",
            "prettiesiska, aizskaroša vai maldinoša satura ievietošana atsauksmēs, ziņojumos vai profila datos;",
            "mēģinājums rezervāciju noformēt ārpus Platformas pēc tam, kad kontakts radies caur to – sk. [Maksas ārpus platformas](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Cenas",
          paragraphs: [
            "Visas cenas tiek rādītas kā kopējā cena, ieskaitot nodokļus un visas caur Platformu aprēķinātās maksas, tiklīdz zināmi ceļojuma dati (laikposms un ceļotāju skaits). Ja kāda daļa maksājama tikai uz vietas, to norādām atsevišķi pirms rezervācijas pabeigšanas.",
            "Cenas tiek rādītas sludinājuma valūtā. Ja summa Jums tiek rādīta arī citā valūtā, tā ir nesaistoša pārrēķināšana orientācijai; norēķini notiek sludinājuma valūtā, ja vien maksājuma laikā nav norādīts citādi.",
            "Cenas var mainīties līdz rezervācijas pabeigšanai, piemēram, tāpēc, ka sniedzējs tās pielāgo vai mainās pieejamība. Noteicošā ir cena, kas Jums tiek rādīta tieši pirms saistošas rezervācijas un norādīta rezervācijas apstiprinājumā.",
            "Acīmredzamas cenas kļūdas (piem., summa, kas kļūdaina par kārtām) nesaista ne mūs, ne sniedzēju. Konstatējot šādu kļūdu, nekavējoties Jūs informējam; rezervāciju tad varat atcelt bez maksas.",
            "Kā veidojas pakalpojuma maksas, norādīts sadaļā [Informācija par pakalpojuma maksām](https://mybestdays.dk/rechtliches/servicegebuehren). Par nodokļiem un nodevām sk. [Nodokļu politiku](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Maksājums",
          paragraphs: [
            "Maksājumus caur Platformu apstrādā maksājumu pakalpojumu sniedzējs Stripe. Maksājumu datus (piem., kartes datus) tieši ievāc un apstrādā Stripe; myBestDays neuzglabā pilnus karšu datus.",
            "Kad kura summa kļūst maksājama – avanss, atlikums vai maksājums uz vietas – ir atkarīgs no sludinājuma un tiek norādīts pirms rezervācijas pabeigšanas. Sīkāk regulē [Maksājuma noteikumi](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Ja sludinājumā norādīta drošības nauda, tā var tikt iepriekš autorizēta vai iekasēta un bojājuma gadījumā pilnīgi vai daļēji ieturēta; noteicošas ir sludinājuma norādes.",
            "Ja maksājums neizdodas vai tiek atgriezts, rezervāciju var atcelt. Sniedzējs joprojām var pieprasīt summas, kas radušās saskaņā ar viņa atcelšanas nosacījumiem.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politikas",
          paragraphs: [
            "Papildus šiem noteikumiem piemēro šādas politikas, kas ir līguma starp Jums un mums sastāvdaļa:",
          ],
          list: [
            "[Piemērota satura noteikumi](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Atsauksmju politika](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Pretdiskriminācijas politika](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Pamatnoteikumi viesiem](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Atcelšanas nosacījumi](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Pārrezervēšanas un atmaksas politika](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politika smagu traucējumu gadījumā](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Autortiesību politika](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Datu aizsardzība un sīkdatnes",
          paragraphs: [
            "Kā apstrādājam personas datus, norādīts [Privātuma politikā](https://mybestdays.dk/rechtliches/datenschutz). Kādas sīkdatnes un līdzīgas tehnoloģijas izmantojam, norādīts [Sīkdatņu politikā](https://mybestdays.dk/rechtliches/cookies).",
            "Rezervācijai nododam sniedzējam datus, kas viņam nepieciešami izmitināšanas pakalpojuma sniegšanai. Sniedzējs par tiem ir patstāvīgs pārzinis; uz viņu attiecas [Datu aizsardzības standarti saimniekiem](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Piekļūstamība",
          paragraphs: [
            "Platformas piekļūstamības stāvokli un šķēršļu ziņošanas ceļu apraksta [Piekļūstamības paziņojums](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Norādes par naktsmītnes piekļūstamību nāk no sniedzēja. Ja esat atkarīgs no konkrētām pazīmēm, noskaidrojiet tās pirms rezervācijas ar sniedzēju, izmantojot ziņojumu funkciju.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Atsauksmes un lietotāju saturs",
          paragraphs: [
            "Pēc uzturēšanās varat atstāt atsauksmi. Atsauksmi drīkst atstāt tikai tas, kurš rezervējis caur Platformu un uzturēšanos sācis vai varējis sākt – tā nodrošinām, ka publicētās atsauksmes nāk no faktiskiem viesiem.",
            "Par atsauksmēm nemaksājam, to saturu nemainām un atsauksmi neapslāpējam tikai tāpēc, ka tā ir negatīva. Sīkāk un iemesli, kuru dēļ atsauksmi noņemam, norādīti [Atsauksmju politikā](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Par saturu, ko ievietojat – atsauksmēm, fotoattēliem, ziņojumiem, profila datiem – atbildīgs paliekat Jūs. Jūs piešķirat mums neekskluzīvas, telpiski un laikā neierobežotas, bezatlīdzības tiesības šo saturu Platformas darbības un reklāmas ietvaros pavairot, pārstrādāt (piem., apgriezt, tulkot) un publiskot. Savu saturu varat dzēst; jau veiktās izmantošanas jau publicētos apkopojumos tas neietekmē.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Ziņojumi un saziņa ar sniedzēju",
          paragraphs: [
            "Ziņojumi starp Jums un sniedzēju notiek caur Platformu. Mēs nodrošinām ziņojumu funkciju, taču neesam satura sūtītājs vai saņēmējs.",
            "Ziņojumus drīkstam automatizēti pārbaudīt attiecībā uz šo noteikumu pārkāpumiem (piem., kontaktinformācija Platformas apiešanai, krāpšanas shēmas, prettiesisks saturs) un attiecīgos ziņojumus aizturēt vai noņemt. Par noņemšanu Jūs informējam ar pamatojumu saskaņā ar A17.",
            "Ziņojumus par Jūsu rezervāciju (apstiprinājumu, izmaiņas, informāciju par ierašanos) sūtām uz norādīto e-pasta adresi. Šie ziņojumi ir līgumiskā saziņa, un no tiem nevar atteikties, kamēr rezervācija pastāv. Reklāmas ziņojumus saņemat tikai tiktāl, ciktāl esat devis piekrišanu vai tiesības to atļauj bez piekrišanas; varat jebkurā brīdī iebilst.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Intelektuālā īpašuma tiesības",
          paragraphs: [
            "Platforma, tās dizains, programmatūra, datubāzes, teksti un preču zīmes ir aizsargātas. Jūs saņemat neekskluzīvas, nenododamas tiesības izmantot Platformu naktsmītņu meklēšanai un rezervēšanai – ne vairāk.",
            "Mūsu preču zīmju un logotipu izmantošanu regulē [Preču zīmju noteikumi](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Ja uzskatāt, ka Platformas saturs pārkāpj Jūsu autortiesības, rīkojieties saskaņā ar [Autortiesību politiku](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Ko darīt, ja kaut kas noiet greizi",
          paragraphs: [
            "Ja problēma attiecas uz pašu naktsmītni, vispirms vērsieties pie sniedzēja – izmantojot ziņojumu funkciju vai uz vietas. Daudzas problēmas tā atrisināmas visātrāk.",
            "Ja ar sniedzēju netiekat uz priekšu vai problēma attiecas uz Platformu, maksājumu vai rezervācijas noformēšanu, vērsieties pie mums. Kā mūs sasniegt un kā izskatām sūdzības, norādīts sadaļā [Sūdzības un strīdu risināšana](https://mybestdays.dk/rechtliches/beschwerden).",
            "Sagatavojiet: rezervācijas numuru, rezervācijas e-pasta adresi, īsu problēmas aprakstu ar vēlmi, kā mums palīdzēt, un attiecīgos pierādījumus (fotoattēlus, ziņojumus, kvītis).",
            "Ja naktsmītne ierodoties nav pieejama vai būtiski atšķiras no sludinājuma, piemēro [Pārrezervēšanas un atmaksas politiku](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Eiropas Komisijas strīdu izšķiršanas tiešsaistē platforma tika atcelta ar Regulu (ES) 2024/3228 un pārtrauca darbību; kā ceļš tā vairs nav pieejama. Kuras institūcijas to aizstāj, norādīts sadaļā [Sūdzības un strīdu risināšana](https://mybestdays.dk/rechtliches/beschwerden).",
            "Ja esam veikuši pasākumu pret Jūsu saturu vai kontu, papildus mūsu iekšējai sūdzību procedūrai varat vērsties arī ārpustiesas strīdu risināšanas institūcijā, kas sertificēta saskaņā ar Regulas (ES) 2022/2065 21. pantu. Tās lēmumi mums nav saistoši.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Pasākumi pret nepiemērotu rīcību",
          paragraphs: [
            "Ja pārkāpjat šos noteikumus vai kādu no A9 minētajām politikām, varam – pakāpeniski atbilstoši pārkāpuma smagumam, biežumam un ietekmei – noņemt saturu vai ierobežot tā redzamību, bloķēt funkcijas, atcelt rezervācijas vai uz laiku vai pastāvīgi bloķēt Jūsu kontu.",
            "Pirms pasākuma izvērtējam konkrēto gadījumu. Acīmredzami prettiesiska satura, apdraudējuma personām vai krāpšanas gadījumā varam rīkoties nekavējoties.",
            "Katru pasākumu Jums pamatojam un norādām sūdzību ceļu – sk. A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Ziņošana par prettiesisku saturu un pasākumu pamatojums",
          paragraphs: [
            "Ikviens var mums ziņot par saturu, ko uzskata par prettiesisku. Ziņošanas procedūra saskaņā ar Regulas (ES) 2022/2065 16. pantu, mūsu kontaktpunkti un ziņojumu izskatīšana aprakstīti sadaļā [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa).",
            "Ja veicam pasākumu pret Jūsu ievietoto saturu vai pret Jūsu kontu, saņemat pamatojumu, kurā norādīts iemesls, faktiskais pamats, tiesiskais pamats vai pārkāptais līguma noteikums, kā arī sūdzību iespējas.",
            "Pret katru pasākumu sešu mēnešu laikā varat bez maksas iesniegt sūdzību. Sūdzības izskata cilvēki, nevis tikai automatizēti līdzekļi.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Atbildības ierobežojums",
          paragraphs: [
            "Neierobežoti atbildam par nodomu un rupju neuzmanību, par kaitējumu, kas radies dzīvības, ķermeņa vai veselības aizskāruma dēļ, kā arī mūsu uzņemtās garantijas apjomā. Prasījumi saskaņā ar produktu atbildības tiesībām netiek skarti.",
            "Pārējā daļā mūsu atbildība ir ierobežota ar paredzamo kaitējumu, kas parasti izriet no tādu pienākumu pārkāpuma, uz kuru izpildi Jūs drīkstat paļauties – un tikai tiktāl, ciktāl piemērojamās tiesības šādu ierobežojumu pieļauj.",
            "Neatbildam par paša izmitināšanas pakalpojuma sniegšanu, kā arī par sniedzēju vai citu viesu rīcību. Izmitināšanas pakalpojuma līgumpartneris ir sniedzējs.",
            "Neatbildam par sniedzēju ievadīto datu pareizību, ciktāl tos nezinājām un arī nebija jāzina. Uzzinot par prettiesisku norādi, rīkojamies nekavējoties.",
            "Plašāka atbildība ir izslēgta. Imperatīvie likumiskie prasījumi, jo īpaši patērētāju tiesības, netiek skarti.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Piemērojamās tiesības un piekritība",
          paragraphs: [
            "Piemēro Dānijas tiesības – operatora juridiskā adrese ir Dānijā – izslēdzot ANO Konvenciju par starptautiskajiem preču pirkuma-pārdevuma līgumiem. Imperatīvās patērētāju aizsardzības normas valstī, kurā ir Jūsu pastāvīgā dzīvesvieta, netiek skartas saskaņā ar Regulas (EK) Nr. 593/2008 (Roma I) 6. pantu.",
            "Kā patērētājs varat mūs iesūdzēt savas dzīvesvietas tiesā vai mūsu juridiskajā adresē Dānijā; mēs Jūs varam iesūdzēt tikai Jūsu dzīvesvietas tiesā (Regulas (ES) Nr. 1215/2012 17.–19. pants).",
            "Izmitināšanas līgumam parasti piemēro tās valsts tiesības, kurā atrodas naktsmītne; prasībām no nekustamā īpašuma nomas izņēmuma piekritība ir tās tiesām.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Saistīti ceļojumu pakalpojumi",
          paragraphs: [
            "myBestDays starpnieko tikai izmitināšanas pakalpojumos. Nepiedāvājam lidojumus, auto nomu, pārvadājumu pakalpojumus, ekskursijas vai apskates objektus un nesastādām kompleksus ceļojumus Direktīvas (ES) 2015/2302 izpratnē.",
            "Ja nākotnē starpniekotu arī citos ceļojumu pakalpojumos, pirms rezervācijas ar tiesību aktos noteikto standarta veidlapu Jūs informēsim, vai rodas komplekss ceļojums vai saistīts ceļojumu pakalpojums un kādas tiesības Jums no tā izriet.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Termiņš, bloķēšana un izbeigšana",
          paragraphs: [
            "Līgums par Platformas izmantošanu ir noslēgts uz nenoteiktu laiku. Savu kontu varat jebkurā brīdī bez iemesla norādīšanas dzēst; esošās rezervācijas tas neietekmē un tās tiek izpildītas saskaņā ar attiecīgā sniedzēja noteikumiem.",
            "Izmantošanas līgumu varam izbeigt ar 14 dienu termiņu. Smaga šo noteikumu pārkāpuma gadījumā varam izbeigt bez termiņa un bloķēt kontu.",
            "Pēc izbeigšanas Jūsu datus dzēšam, ciktāl tam nav pretrunā likumisks glabāšanas pienākums vai pamatota interese glabāt; sīkāk regulē [Privātuma politika](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Grozījumu klauzula",
          paragraphs: [
            "Šos noteikumus varam grozīt, ja tam ir objektīvs iemesls – piemēram, mainījies tiesiskais regulējums, augstāko tiesu judikatūra, jaunas vai atceltas Platformas funkcijas vai regulējuma nepilnību novēršana.",
            "Par grozījumiem paziņojam teksta formā vismaz 30 dienas pirms spēkā stāšanās. Ja līdz spēkā stāšanās brīdim neiebilstat, grozītie noteikumi uzskatāmi par pieņemtiem; uz šīm sekām paziņojumā īpaši norādām. Ja iebilstat, izmantošanas līgumu varam izbeigt ar spēkā stāšanās dienu.",
            "Jau noslēgtām rezervācijām piemēro noteikumus tajā redakcijā, kas bija spēkā rezervācijas brīdī.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Naktsmītnes",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Šīs iedaļas tvērums",
          paragraphs: [
            "Šī iedaļa attiecas uz naktsmītņu rezervēšanu caur Platformu – gan brīvdienu objektiem, gan izmitināšanas uzņēmumu istabām un vienībām.",
            "Tā papildina A iedaļu. Pretrunu gadījumā priekšroka ir šai B iedaļai.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Līgumiskās attiecības",
          paragraphs: [
            "Izmitināšanas līgums tiek noslēgts tikai starp Jums un sniedzēju. myBestDays nav līguma puse.",
            "Naktsmītnes attēlojums Platformā ir uzaicinājums Jums iesniegt rezervācijas piedāvājumu. Nospiežot rezervācijas pogu ar maksāšanas pienākumu, Jūs iesniedzat saistošu piedāvājumu.",
            "Līgums tiek noslēgts, kad rezervācija tiek apstiprināta. Rezervācijas apstiprinājumu sūtām uz Jūsu norādīto e-pasta adresi; tajā minēts sniedzējs, rezervētais pakalpojums, laikposms, kopējā cena un atcelšanas nosacījumi.",
            "Naktsmītnēm ar rezervāciju pēc pieprasījuma līgums tiek noslēgts tikai ar sniedzēja akceptu. Līdz tam Jūsu maksāšanas līdzeklis var tikt iepriekš autorizēts, bet ne debetēts.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Ko darām mēs",
          paragraphs: [
            "Nodrošinām Platformu, attēlojam sniedzēju sludinājumus, pieņemam Jūsu rezervāciju, nododam to sniedzējam un nosūtām Jums rezervācijas apstiprinājumu.",
            "Apstrādājam maksājumu, ciktāl sludinājums paredz maksājumu caur Platformu, un nodrošinām ziņojumu funkciju starp Jums un sniedzēju.",
            "Naktsmītni nenodrošinām, to neekspluatējam un negalvojam par tās stāvokli. Neesam Jūsu ceļojumu rīkotājs.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Kas Jums jādara",
          paragraphs: [
            "Pirms rezervācijas pilnībā pārbaudiet sludinājumu: aprīkojumu, noslogojuma ierobežojumu, ierašanās un izbraukšanas laikus, iekšējās kārtības noteikumus, atcelšanas nosacījumus un izmaksas, kas rodas tikai uz vietas.",
            "Ievērojiet sludinājumā norādīto maksimālo noslogojumu. Ja ierodas vairāk personu, nekā rezervēts, sniedzējs var atteikt uzņemšanu vai pieprasīt piemaksu.",
            "Ievērojiet sniedzēja iekšējās kārtības noteikumus un [Pamatnoteikumus viesiem](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Pret naktsmītni izturaties saudzīgi un atbildat par bojājumiem, ko radījāt Jūs vai Jūsu ceļabiedri.",
            "Ja sniedzējam vai iestādei nepieciešami dati reģistrācijai (piem., reģistrācijas veidlapa, personu apliecinoša dokumenta dati, kūrorta nodevas deklarācija), nodrošinat tos savlaicīgi.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Cenas un maksājums",
          paragraphs: [
            "Kopējā cena ietver nakšņošanas cenu par rezervēto laikposmu un sludinājumā norādītās piemaksas un maksas, kas tiek aprēķinātas caur Platformu.",
            "Uz vietas var rasties papildu summas – jo īpaši kūrorta nodeva vai vietējās nodevas, drošības nauda, kā arī papildu pakalpojumi, ko pasūtāt tikai uz vietas. Tos pirms rezervācijas pabeigšanas norādām kā izmaksas uz vietas, ciktāl sniedzējs tos ir norādījis.",
            "Ja sludinājums paredz avansu, atlikums kļūst maksājams sludinājumā norādītajā brīdī. Ja atlikums netiek samaksāts, sniedzējs saskaņā ar saviem atcelšanas nosacījumiem var atkāpties no līguma.",
            "Maksājumus sniedzējam ārpus Platformas nepieņemam un nevaram izsekot; tie neietilpst mūsu maksājumu apstrādē – sk. [Maksas ārpus platformas](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Izmaiņas, atcelšanas un atmaksas",
          paragraphs: [
            "Vai un ar kādiem nosacījumiem rezervāciju var bez maksas atcelt vai mainīt, ir atkarīgs no sludinājumā norādītajiem sniedzēja atcelšanas nosacījumiem. Nosacījumus, ko piedāvājam sniedzējiem izvēlei, apraksta [Atcelšanas nosacījumi](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Izmitināšanas pakalpojumiem, kas rezervēti noteiktam laikposmam, parasti nepastāv likumiskās atteikuma tiesības saskaņā ar Direktīvas 2011/83/ES 16. panta l) punktu vai attiecīgajām valsts normām. Imperatīvās likumiskās tiesības netiek skartas.",
            "Ja atceļ sniedzējs, pilnībā atmaksājam caur Platformu samaksāto summu. Papildus piemēro [Pārrezervēšanas un atmaksas politiku](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Ja abu pušu kontrolei nepakļauts notikums neļauj ceļot vai uzturēties, piemēro [Politiku smagu traucējumu gadījumā](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Atmaksas tiek veiktas uz maksāšanas līdzekli, kas izmantots maksājumam, ja vien nav norunāts citādi.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Kas Jums vēl jāzina",
          paragraphs: [
            "Sniedzēji var būt privāti saimnieki vai komersanti. Vai sniedzējs darbojas kā komersants, norādām sludinājumā. Ja tas nav komersants, Savienības patērētāju aizsardzības normas izmitināšanas līgumam nepiemēro – uz šo apstākli sludinājumā Jums norādām.",
            "Norādes par atrašanās vietu, apkārtni, attālumiem un trešo personu vērtējumi kalpo orientācijai. Saistošas ir norādes par pašu rezervēto pakalpojumu.",
            "Teritorijās ar īstermiņa izīrēšanas reģistrācijas pienākumu sludinājumā norādām sniedzēja sniegto reģistrācijas numuru; sk. [Īstermiņa izīrēšana](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Ja ir vairākas identiskas objekta vai istabas veida vienības, Jūs rezervējat vienu šā veida vienību. Kuru konkrēto vienību saņemat, nosaka sniedzējs.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Vārdnīca",
      paragraphs: [
        "Turpmāk minētajiem jēdzieniem šajos noteikumos ir šeit norādītā nozīme.",
      ],
      definitions: [
        {
          term: "Sniedzējs",
          description:
            "Fiziska vai juridiska persona, kas piedāvā naktsmītni caur Platformu un kļūst par izmitināšanas līguma pusi.",
        },
        {
          term: "Rezervācija pēc pieprasījuma",
          description:
            "Rezervācija, kas tiek noslēgta tikai pēc sniedzēja skaidra akcepta, atšķirībā no tūlītējas rezervācijas.",
        },
        {
          term: "Rezervācijas apstiprinājums",
          description:
            "Ziņojums, ar kuru apstiprinām Jums izmitināšanas līguma noslēgšanu; tajā ietverts sniedzējs, pakalpojums, laikposms, kopējā cena un atcelšanas nosacījumi.",
        },
        {
          term: "Vienība",
          description:
            "Konkrētais rezervējamais objekts objekta vai istabas veida ietvaros. Tiek pārdota vienība, bet aprakstīts un cenots veids.",
        },
        {
          term: "Kopējā cena",
          description:
            "Summa, kas norādīta, pabeidzot rezervāciju, ieskaitot visus nodokļus un visas caur Platformu aprēķinātās maksas.",
        },
        {
          term: "Maksimālais noslogojums",
          description:
            "Sludinājumā norādītais lielākais pieļaujamais personu skaits, kas drīkst nakšņot naktsmītnē.",
        },
        {
          term: "Drošības nauda",
          description:
            "Summa, ko sniedzējs pieprasa kā nodrošinājumu pret bojājumiem un kas tiek iepriekš autorizēta vai iekasēta un pēc uzturēšanās atbrīvota vai ieskaitīta.",
        },
        {
          term: "Kūrorta nodeva",
          description:
            "Vietēja nodeva par nakšņošanu, ko atkarībā no pašvaldības iekasē uz vietas vai caur sniedzēju; tas nav myBestDays pakalpojums.",
        },
        {
          term: "Platforma",
          description:
            "Tīmekļa vietne, mobilās lietotnes un visas citas piekļuves vietas, ar kurām myBestDays attēlo naktsmītnes un starpnieko rezervācijās.",
        },
        {
          term: "Pakalpojuma maksa",
          description:
            "Atlīdzība par myBestDays starpniecības pakalpojumu. Kas to sedz un kā tā tiek norādīta, minēts informācijā par pakalpojuma maksām.",
        },
        {
          term: "Atcelšanas nosacījumi",
          description:
            "Sniedzēja izvēlētie noteikumi par to, līdz kuram brīdim un ar kādām izmaksām rezervāciju var atcelt vai mainīt.",
        },
        {
          term: "Naktsmītne",
          description:
            "Sniedzēja piedāvātais izmitināšanas pakalpojums – brīvdienu objekts vai istabas vai objekta veida vienība.",
        },
        {
          term: "Izmaksas uz vietas",
          description:
            "Summas, kas netiek aprēķinātas caur Platformu, bet kļūst maksājamas sniedzējam, piemēram, kūrorta nodeva, drošības nauda vai uz vietas pasūtīti papildu pakalpojumi.",
        },
      ],
    },
  ],
};
