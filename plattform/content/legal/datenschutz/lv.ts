import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Privātuma politika",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šī politika apraksta, kādus personas datus apstrādā myBestDays, kādiem nolūkiem, uz kāda tiesiskā pamata un kādas tiesības Jums ir. Tā attiecas uz tīmekļa vietni, mobilajām lietotnēm un visām citām piekļuvēm Platformai.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Pārzinis un datu aizsardzības speciālists",
      paragraphs: [
        `Pārzinis Regulas (ES) 2016/679 (VDAR) izpratnē ir ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dānija, CVR Nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Pilnīgi pakalpojuma sniedzēja dati norādīti [Juridiskajā informācijā](https://mybestdays.dk/rechtliches/impressum).`,
        "Datu aizsardzības speciālists nav iecelts; VDAR 37. panta nosacījumi nav izpildīti. Jautājumus par datu aizsardzību sūtiet uz iepriekš norādīto e-pasta adresi.",
        "Sniedzēji, pie kuriem rezervējat, par datiem, ko saņem no mums, ir patstāvīgi pārziņi. Uz tiem attiecas [Datu aizsardzības standarti saimniekiem](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Kādus datus apstrādājam",
      paragraphs: ["Atkarībā no tā, kā izmantojat Platformu, apstrādājam:"],
      list: [
        "pamatdatus – vārdu, e-pasta adresi, tālruņa numuru, valodu un valūtu, paroli šifrētā veidā;",
        "rezervācijas datus – rezervēto naktsmītni, laikposmu, ceļotāju skaitu un vārdus, īpašas vēlmes, rezervācijas statusu;",
        "maksājumu datus – summu, valūtu, maksājuma statusu, maksāšanas līdzekļa pēdējos ciparus un mūsu maksājumu pakalpojumu sniedzēja darījuma identifikatoru. Pilni karšu dati pie mums nenonāk;",
        "saziņas datus – ziņojumus starp Jums un sniedzēju, jautājumus mūsu klientu apkalpošanai, sūdzības;",
        "satura datus – atsauksmes, fotoattēlus, vēlmju sarakstus;",
        "izmantošanas datus – apmeklētās lapas, meklēšanas pieprasījumus, piekļuves laiku;",
        "tehniskos datus – IP adresi, pārlūkprogrammas un ierīces identifikatorus, operētājsistēmu, novirzošo lapu.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Nolūki un tiesiskie pamati",
      paragraphs: [
        "Platformas nodrošināšana, konts, meklēšana, rezervēšana, maksājumu apstrāde un saziņa ar sniedzēju – VDAR 6. panta 1. punkta b) apakšpunkts (līgums vai pirmslīguma pasākumi).",
        "Klientu apkalpošana, sūdzību izskatīšana un strīdu risināšana – VDAR 6. panta 1. punkta b) un f) apakšpunkts.",
        "Krāpšanas, ļaunprātīgas izmantošanas un drošības incidentu atklāšana un novēršana, mūsu noteikumu izpilde – VDAR 6. panta 1. punkta f) apakšpunkts (leģitīma interese par drošu tirdzniecības vietu).",
        "Atsauksmes un to publicēšana – VDAR 6. panta 1. punkta b) un f) apakšpunkts.",
        "Juridisko pienākumu izpilde, jo īpaši komerciālo un nodokļu glabāšanas pienākumu, ziņošanas pienākumu saskaņā ar Direktīvu (ES) 2021/514 (DAC7) un pienākumu saskaņā ar Regulu (ES) 2022/2065 – VDAR 6. panta 1. punkta c) apakšpunkts.",
        "Platformas uzlabošana, analizējot apkopotus izmantošanas datus – VDAR 6. panta 1. punkta f) apakšpunkts.",
        "Reklāmas e-pasta vēstules un sīkdatnes, kas nav nepieciešamas – VDAR 6. panta 1. punkta a) apakšpunkts (piekrišana), ko varat jebkurā brīdī atsaukt ar spēku uz nākotni.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Saņēmēji",
      paragraphs: [
        "Sniedzēji saņem datus, kas viņiem nepieciešami Jūsu rezervācijas izpildei un savu juridisko pienākumu izpildei – jo īpaši vārdu, kontaktinformāciju, laikposmu, ceļotāju skaitu un Jūsu ziņojumus viņiem.",
        "Mūsu maksājumu pakalpojumu sniedzējs Stripe apstrādā maksājumu datus kā patstāvīgs pārzinis; papildus piemēro [Stripe privātuma politiku](https://stripe.com/privacy).",
        "Pakalpojumu sniedzēji, kas mums nodrošina mitināšanu, datubāzu darbību, e-pasta sūtīšanu, kļūdu diagnostiku un klientu apkalpošanas rīkus, apstrādā datus tikai pēc mūsu norādījumiem, pamatojoties uz līgumu saskaņā ar VDAR 28. pantu.",
        "Iestādes un tiesas saņem datus tikai tiktāl, ciktāl mums ir pienākums; sk. [Politiku par iestāžu un tiesībaizsardzības pieprasījumiem](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Nodokļu iestādes saņem saskaņā ar DAC7 ziņojamos sniedzēju datus.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Nosūtīšana uz trešām valstīm",
      paragraphs: [
        "Mūsu serveri un mūsu apstrādātāju serveri atrodas Eiropas Savienībā.",
        "Ja atsevišķos gadījumos apstrāde notiek ārpus Eiropas Ekonomikas zonas, tas notiek tikai, pamatojoties uz Eiropas Komisijas lēmumu par aizsardzības līmeņa pietiekamību vai standarta līguma klauzulām saskaņā ar VDAR 46. panta 2. punkta c) apakšpunktu kopā ar papildu garantijām.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Glabāšanas termiņi",
      paragraphs: [
        "Konta datus glabājam, kamēr pastāv Jūsu konts, un pēc tam tos dzēšam, ciktāl tam nav pretrunā glabāšanas pienākums.",
        "Rezervācijas un maksājumu datiem piemēro komerciālos un nodokļu glabāšanas termiņus; saskaņā ar Dānijas grāmatvedības tiesībām tie parasti ir pieci gadi no tā pārskata gada beigām, uz kuru dati attiecas.",
        "Ziņojumus par rezervāciju glabājam līdz trim gadiem pēc uzturēšanās beigām, lai varētu noskaidrot strīdus.",
        "Atsauksmes pēc Jūsu konta dzēšanas paliek anonimizētā veidā, jo tās ir naktsmītnes vērtējuma pamata daļa.",
        "Datus par krāpšanas un ļaunprātīgas izmantošanas gadījumiem glabājam tik ilgi, cik nepieciešams turpmāku pārkāpumu novēršanai, taču ne ilgāk kā trīs gadus no pēdējā gadījuma.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Jūsu tiesības",
      paragraphs: ["Saskaņā ar VDAR Jums ir šādas tiesības:"],
      list: [
        "piekļūt par Jums saglabātajiem datiem (15. pants);",
        "labot nepareizus datus (16. pants);",
        "dzēst (17. pants), ciktāl tam nav pretrunā glabāšanas pienākums;",
        "ierobežot apstrādi (18. pants);",
        "uz datu pārnesamību (20. pants);",
        "iebilst pret apstrādi, kas balstīta uz leģitīmām interesēm (21. pants), jo īpaši pret tiešo tirgvedību;",
        "atsaukt doto piekrišanu ar spēku uz nākotni (7. panta 3. punkts);",
        `iesniegt sūdzību uzraudzības iestādē (77. pants) – kompetenta ir Jūsu dzīvesvietas, darba vietas vai iespējamā pārkāpuma vietas iestāde. Pārziņa juridiskajā adresē tā ir ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dānija, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Kā īstenot savas tiesības",
      paragraphs: [
        `Daudzus datus varat apskatīt, mainīt vai dzēst tieši savā kontā. Visos pārējos gadījumos vērsieties ${ANBIETER.email}.`,
        "Atbildam nekavējoties, vēlākais viena mēneša laikā. Ja termiņu nevaram ievērot, paziņojam Jums ar pamatojumu.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatizēti lēmumi",
      paragraphs: [
        "Izmantojam automatizētas procedūras krāpšanas, ļaunprātīgas izmantošanas un prettiesiska satura atklāšanai. Ja šāda procedūra noved pie pasākuma pret Jūsu kontu vai saturu, to pamatojam, un Jūs varat pieprasīt cilvēka veiktu pārskatīšanu.",
        "Lēmumu, kas balstīts tikai uz automatizētu apstrādi ar juridiskām sekām VDAR 22. panta izpratnē, nepieņemam.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Pienākums sniegt datus",
      paragraphs: [
        "Rezervācijai nepieciešamie dati Jums jāsniedz; bez tiem līgumu nevar noslēgt un naktsmītni nevar nodrošināt. Visi pārējie dati ir brīvprātīgi.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Šīs politikas grozījumi",
      paragraphs: [
        "Šo politiku pielāgojam, kad mainās apstrāde vai tiesiskais stāvoklis. Pašlaik spēkā esošā redakcija pieejama šeit; atjaunināšanas datums norādīts augšpusē.",
      ],
    },
  ],
};
