import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Maksājuma noteikumi",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šie maksājuma noteikumi regulē, kā tiek apstrādāti maksājumi saistībā ar rezervāciju caur myBestDays. Tie papildina [Lietošanas noteikumus viesiem](https://mybestdays.dk/rechtliches/nutzungsbedingungen); pretrunu gadījumā maksājumu jautājumos priekšroka ir šiem maksājuma noteikumiem.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Mūsu loma maksājumā",
      paragraphs: [
        "myBestDays apstrādā maksājumus sniedzēja vārdā. Mēs neesam maksājumu iestāde un neesam elektroniskās naudas iestāde; pašu maksājumu pakalpojumu sniedz mūsu maksājumu pakalpojumu sniedzējs.",
        "Maksājumus caur Platformu apstrādā Stripe (Stripe Payments Europe, Limited). Karšu datus un citus maksājumu datus tieši ievāc un apstrādā Stripe. myBestDays neuzglabā pilnus karšu datus.",
        "Ja maksājat caur Platformu, Jūsu maksāšanas pienākums pret sniedzēju samaksātās summas apmērā uzskatāms par izpildītu, tiklīdz maksājums mūsu maksājumu pakalpojumu sniedzējam ir sekmīgi autorizēts un iekasēts.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Maksāšanas veidi",
      paragraphs: [
        "Kādi maksāšanas veidi ir pieejami, ir atkarīgs no sludinājuma, sniedzēja valsts un Jūsu valsts. Pieejamie maksāšanas veidi tiek parādīti pirms rezervācijas pabeigšanas.",
        "Atsevišķiem maksāšanas veidiem nepieciešama klienta droša autentificēšana saskaņā ar Direktīvu (ES) 2015/2366. Bez sekmīgas autentificēšanas maksājumu nevar izpildīt.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Termiņš, avanss un atlikums",
      paragraphs: [
        "Kad kura summa kļūst maksājama, nosaka sniedzējs sludinājumā. Parasti ir trīs modeļi: pilna samaksa rezervējot, avanss rezervējot ar atlikumu pirms ierašanās, vai maksājums uz vietas pie sniedzēja.",
        "Jūsu rezervācijai piemērojamais modelis un maksājuma termiņi tiek parādīti pirms rezervācijas pabeigšanas un atkārtoti rezervācijas apstiprinājumā.",
        "Pirms atlikuma termiņa atgādinām Jums uz norādīto e-pasta adresi. Ja atlikums netiek samaksāts, sniedzējs saskaņā ar saviem atcelšanas nosacījumiem var atkāpties no līguma.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valūta",
      paragraphs: [
        "Norēķini notiek sludinājuma valūtā. Šī valūta tiek norādīta pie katras cenas un maksājuma procesā.",
        "Ja summa Jums tiek parādīta arī citā valūtā, tā ir nesaistoša pārrēķināšana orientācijai, nevis saistoša cena.",
        "Ja Jūsu maksājumu pakalpojumu sniedzējs konvertē citā valūtā vai iekasē ārvalstu darījuma maksu, šīs izmaksas sedzat Jūs. Tās nav kopējās cenas sastāvdaļa, un tās ne nosakām, ne iekasējam mēs.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Drošības nauda",
      paragraphs: [
        "Ja sludinājums paredz drošības naudu, tās apmērs tiek norādīts pirms rezervācijas pabeigšanas.",
        "Atkarībā no sludinājuma drošības nauda Jūsu maksāšanas līdzeklī tiek iepriekš autorizēta (summa tiek rezervēta, bet nav norakstīta) vai iekasēta. Iepriekšēja autorizācija var uz laiku samazināt Jūsu kartes pieejamo limitu.",
        "Pēc uzturēšanās iepriekšējā autorizācija tiek atbrīvota vai iekasētā drošības nauda atmaksāta, ciktāl sniedzējs neizvirza prasību par bojājumiem. Ja sniedzējs izvirza prasību par bojājumiem, viņam tie jāpierāda; par pamatotību lemj attiecības starp Jums un sniedzēju.",
        "Ja sniedzējs drošības naudu tā vietā pieprasa uz vietas, tā ir izmaksu uz vietas pozīcija un netiek apstrādāta caur Platformu.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Atmaksas",
      paragraphs: [
        "Atmaksas tiek veiktas uz maksāšanas līdzekli, kas izmantots maksājumam, ja vien nav norunāts citādi vai tas nav tehniski iespējams.",
        "Atmaksu ierosinām nekavējoties, tiklīdz ir noskaidrots tās iemesls. Cik ilgi paies, līdz ieskaitījums kļūs redzams Jūsu kontā vai kartē, nosaka Jūsu maksājumu pakalpojumu sniedzējs; parasti piecas līdz desmit banku darba dienas.",
        "Vai un kādā apmērā pastāv tiesības uz atmaksu, ir atkarīgs no [Atcelšanas nosacījumiem](https://mybestdays.dk/rechtliches/stornierungsbedingungen) un [Pārrezervēšanas un atmaksas politikas](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Neizdevušies maksājumi un atgriešanas",
      paragraphs: [
        "Ja maksājums neizdodas, Jūs informējam un dodam iespēju norādīt citu maksāšanas līdzekli. Ja maksājums netiek veikts, rezervāciju var atcelt.",
        "Ja atgriežat jau veiktu maksājumu bez tiesībām uz atmaksu, sniedzējs joprojām var pieprasīt summu. Izmaksas, kas mums rodas nepamatotas atgriešanas dēļ, varam Jums izrakstīt rēķinā.",
        "Ja maksājumu uzskatām par krāpniecisku, varam to aizturēt vai rezervāciju atcelt. Par to Jūs informējam un lēmumu pamatojam.",
      ],
    },
    {
      id: "belege",
      heading: "8. Dokumenti un norēķini",
      paragraphs: [
        "Par caur Platformu samaksātajām summām nodrošinām Jums dokumentu, ko varat atrast savā kontā sadaļā „Rezervācijas“.",
        "Rēķinu par izmitināšanas pakalpojumu izraksta sniedzējs; viņš ir pakalpojumu sniedzošais komersants. Par nodokļiem sk. [Nodokļu politiku](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Šo maksājuma noteikumu grozījumi",
      paragraphs: [
        "Šo maksājuma noteikumu grozījumiem piemēro [Lietošanas noteikumu](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) A22 iedaļu.",
      ],
    },
  ],
};
