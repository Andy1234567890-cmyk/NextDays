import type { LegalDoc } from "../types";

// Lettische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Lietošanas noteikumi viesiem",
  stand: "Redakcija: 2026. gada 3. jūlijs",
  intro: [
    "Šie lietošanas noteikumi regulē rezervāciju portāla myBestDays (turpmāk — „Platforma”) lietošanu, ko veic ceļotāji un rezervētāji (turpmāk — „Viesis”).",
    "Platformas operatore ir [pirms publicēšanas norādīt operatora pilnu juridisko nosaukumu, juridisko formu, adresi un reģistrācijas datus] (turpmāk — „myBestDays” vai „mēs”).",
  ],
  sections: [
    {
      heading: "§ 1 Piemērošanas joma",
      paragraphs: [
        "Šie noteikumi attiecas uz Platformas lietošanu, jo īpaši uz naktsmītņu meklēšanu un izmitināšanas pakalpojumu rezervēšanu ar Platformas starpniecību.",
        "Pašam izmitināšanas pakalpojumam papildus piemēro attiecīgā pakalpojumu sniedzēja noteikumus (piemēram, iekšējās kārtības noteikumus, atcelšanas nosacījumus), kas norādīti piedāvājumā.",
      ],
    },
    {
      heading: "§ 2 myBestDays loma; līguma noslēgšana",
      paragraphs: [
        "myBestDays ir starpniece izmitināšanas pakalpojumiem, kurus piedāvā attiecīgie pakalpojumu sniedzēji (aģentūras, izīrētāji vai īpašnieki, turpmāk — „Pakalpojumu sniedzējs”). Līgums par naktsmītni tiek noslēgts vienīgi starp Viesi un attiecīgo Pakalpojumu sniedzēju. myBestDays nekļūst par izmitināšanas līguma pusi.",
        "Attiecīgais Pakalpojumu sniedzējs tiek norādīts piedāvājumā un rezervācijas apstiprinājumā.",
      ],
    },
    {
      heading: "§ 3 Rezervācija un rezervācijas apstiprinājums",
      paragraphs: [
        "Naktsmītņu attēlojums Platformā ir uzaicinājums iesniegt rezervācijas piedāvājumu. Pabeidzot rezervācijas procesu (noklikšķinot uz rezervācijas pogas, kas uzliek pienākumu maksāt), Viesis iesniedz saistošu piedāvājumu noslēgt izmitināšanas līgumu ar Pakalpojumu sniedzēju.",
        "Līgums tiek noslēgts, kad rezervācija tiek apstiprināta. Rezervācijas apstiprinājums Viesim tiek nosūtīts uz norādīto e-pasta adresi.",
        "Viesim, veicot rezervāciju, ir pienākums sniegt pareizu un pilnīgu informāciju (jo īpaši vārdu, kontaktinformāciju un ceļotāju skaitu).",
      ],
    },
    {
      heading: "§ 4 Cenas un maksājumi",
      paragraphs: [
        "Ir spēkā rezervācijas brīdī piedāvājumā norādītās cenas, ieskaitot tur norādītos nodokļus, maksas un papildu izmaksas. Cenas tiek rādītas piedāvājumā norādītajā valūtā. Uz vietas var tikt piemērotas papildu vietējās nodevas (piemēram, kūrorta nodeva), ciktāl tas ir norādīts piedāvājumā.",
        "Maksājumi tiek apstrādāti ar maksājumu pakalpojumu sniedzēja Stripe starpniecību. Maksājumu datus (piemēram, kartes datus) tieši vāc un apstrādā Stripe; myBestDays neglabā pilnus kartes datus. Stripe apstrādā personas datus saskaņā ar [Stripe privātuma politiku](https://stripe.com/privacy).",
        "Ja piedāvājumā ir norādīts drošības depozīts, tas rezervācijas vai ierašanās brīdī var tikt iepriekš autorizēts un kaitējuma gadījumā pilnībā vai daļēji ieturēts; noteicošā ir piedāvājumā norādītā informācija.",
      ],
    },
    {
      heading: "§ 5 Atcelšana, pārrezervēšana un atteikuma tiesības",
      paragraphs: [
        "Tas, vai un ar kādiem nosacījumiem rezervāciju var bez maksas atcelt vai mainīt, ir atkarīgs no piedāvājumā norādītajiem Pakalpojumu sniedzēja atcelšanas nosacījumiem.",
        "Izmitināšanas pakalpojumiem, kas tiek rezervēti konkrētam laikposmam, saskaņā ar ES Patērētāju tiesību direktīvas 16. panta l) punktu vai attiecīgajām valsts tiesību normām parasti nepastāv likumā noteiktās atteikuma tiesības. Viesa imperatīvās likumiskās tiesības paliek neskartas.",
      ],
    },
    {
      heading: "§ 6 Viesa pienākumi",
      paragraphs: [
        "Viesis izmanto naktsmītni atbilstoši līgumam, ievēro piedāvājumā norādīto maksimālo viesu skaitu un Pakalpojumu sniedzēja iekšējās kārtības noteikumus.",
        "Platformu nedrīkst izmantot ļaunprātīgi, jo īpaši fiktīvām rezervācijām, krāpnieciskiem maksājumiem vai prettiesiska satura ievietošanai (piemēram, atsauksmēs vai ziņās).",
      ],
    },
    {
      heading: "§ 7 myBestDays atbildība",
      paragraphs: [
        "Par izmitināšanas pakalpojuma sniegšanu ir atbildīgs vienīgi Pakalpojumu sniedzējs. myBestDays neatbild par Pakalpojumu sniedzēju ievietotā piedāvājumu satura pareizību, taču veic starpniecību un maksājumu apstrādi ar krietna komersanta rūpību.",
        "myBestDays atbild bez ierobežojumiem par nodomu un rupju neuzmanību, kā arī par kaitējumu, kas radies dzīvības, ķermeņa vai veselības aizskāruma dēļ. Vieglas neuzmanības gadījumā myBestDays atbild tikai par būtisku līgumsaistību (kardinālo pienākumu) pārkāpumu, un atbildība ir ierobežota ar līgumam tipisko, paredzamo kaitējumu. Imperatīvās likumā noteiktās atbildības normas paliek neskartas.",
      ],
    },
    {
      heading: "§ 8 Datu aizsardzība",
      paragraphs: [
        "myBestDays apstrādā Viesa personas datus starpniecības un rezervācijas veikšanai. Rezervācijas dati tiek nodoti attiecīgajam Pakalpojumu sniedzējam, ciktāl tas ir nepieciešams izmitināšanas līguma izpildei. Maksājumu apstrādei piemēro § 4.",
        "Sīkāka informācija ir izklāstīta Platformas privātuma informācijā.",
      ],
    },
    {
      heading: "§ 9 Sūdzības un strīdu izšķiršana",
      paragraphs: [
        "Ar iebildumiem par naktsmītni Viesis vispirms vēršas pie Pakalpojumu sniedzēja; jautājumos par rezervāciju vai maksājumiem palīdz myBestDays atbalsta dienests, izmantojot Platformā norādītos saziņas kanālus.",
        "myBestDays nav ne pienākuma, ne gatavības piedalīties strīdu izšķiršanas procedūrās patērētāju strīdu izšķiršanas iestādē, ciktāl nepastāv likumā noteikts pienākums.",
      ],
    },
    {
      heading: "§ 10 Šo noteikumu grozījumi",
      paragraphs: [
        "myBestDays var grozīt šos noteikumus ar spēku nākotnē, ciktāl tas ir nepieciešams pamatotu iemeslu dēļ (jo īpaši tiesību aktu grozījumu vai judikatūras izmaiņu dēļ) un Viesis tādējādi netiek nesamērīgi nostādīts neizdevīgākā stāvoklī. Jau noslēgtajām rezervācijām piemēro rezervācijas brīdī spēkā esošo redakciju.",
      ],
    },
    {
      heading: "§ 11 Nobeiguma noteikumi",
      paragraphs: [
        "Piemērojamas ir tās valsts tiesības, kurā operatorei ir juridiskā adrese, izslēdzot ANO Konvenciju par starptautiskajiem preču pirkuma-pārdevuma līgumiem. Ja Viesis ir patērētājs, tās valsts imperatīvās patērētāju aizsardzības normas, kurā ir viņa pastāvīgā mītnesvieta, paliek neskartas.",
        "Ja atsevišķas šo noteikumu normas ir vai kļūst spēkā neesošas, tas neietekmē pārējo normu spēkā esamību.",
      ],
    },
  ],
};
