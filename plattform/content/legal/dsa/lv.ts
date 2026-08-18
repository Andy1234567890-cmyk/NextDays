import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Digitālo pakalpojumu akts",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "myBestDays ir starpniecības pakalpojums un tiešsaistes platforma Regulas (ES) 2022/2065 par digitālo pakalpojumu vienoto tirgu (Digitālo pakalpojumu akts, DSA) izpratnē. Šī lapa apkopo datus un procedūras, ko šī regula prasa.",
    "myBestDays nav ļoti liela tiešsaistes platforma regulas 33. panta izpratnē. Tāpēc uz mums neattiecas papildu pienākumi – sistēmisku risku noteikšana, neatkarīga revīzija, reklāmu arhīvs un mēneša lietotāju skaita publicēšana tur paredzētajā kārtībā.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktpunkti (11. un 12. pants)",
      paragraphs: [
        `Vienotais kontaktpunkts dalībvalstu iestādēm, Komisijai un Eiropas Digitālo pakalpojumu padomei: ${ANBIETER.email}, pa pastu ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dānija.`,
        `Vienotais kontaktpunkts lietotājiem: ${ANBIETER.email}. Tur mūs sasniedzat tieši un bez automatizēta starpposma.`,
        "Ar abiem kontaktpunktiem var sazināties vācu, dāņu un angļu valodā.",
        "Juridiskais pārstāvis Savienībā saskaņā ar 13. pantu nav jāieceļ: operators ir reģistrēts Dānijā un tādējādi Savienībā.",
        `Kompetentais digitālo pakalpojumu koordinators saskaņā ar 49. pantu: ${DSA_KOORDINATOR.name}, Dānija ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Ziņošana par prettiesisku saturu (16. pants)",
      paragraphs: [
        "Ikviens var mums ziņot par saturu, ko uzskata par prettiesisku. Izmantojiet tam ziņošanas funkciju, kas pieejama pie katra sludinājuma, katras atsauksmes un katra ziņojuma, vai kontaktpunktu lietotājiem.",
        "Lai ziņojumu varētu izvērtēt bez padziļinātas juridiskas analīzes, tajā jāietver:",
      ],
      list: [
        "pietiekami pamatots skaidrojums, kāpēc saturs ir prettiesisks;",
        "precīza elektroniskā atrašanās vieta, jo īpaši URL adrese;",
        "ziņotāja vārds un e-pasta adrese – izņemot ziņojumus par noziedzīgiem nodarījumiem pret bērnu dzimumneaizskaramību, kur šī norāde ir brīvprātīga;",
        "apliecinājums, ka norādes, cik zināms, ir pareizas un pilnīgas.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kā izskatām ziņojumus",
      paragraphs: [
        "Saņemšanu nekavējoties apstiprinām un lemjam savlaicīgi, rūpīgi, bez patvaļas un objektīvi.",
        "Ja ziņojumā ietvertas 2. iedaļas norādes, tas pamato mūsu zināšanu regulas 6. panta izpratnē.",
        "Par savu lēmumu informējam ziņotāju un norādām tiesiskās aizsardzības līdzekļus.",
        "Automatizētas izskatīšanas gadījumā to paziņojam.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Pasākumu pamatošana (17. pants)",
      paragraphs: [
        "Ja ierobežojam satura redzamību, to noņemam, bloķējam piekļuvi tam, apturam maksājumus, pakalpojuma sniegšanu vai kontu, skartā persona saņem skaidru un konkrētu pamatojumu.",
        "Pamatojumā norādīts pasākuma veids un apjoms, tā teritoriālā un laika piemērošanas joma, lēmuma fakti un apstākļi, vai bija iesaistīta automatizēta apstrāde, tiesiskais pamats vai pārkāptais līguma noteikums un pieejamie tiesiskās aizsardzības līdzekļi.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Aizdomas par noziedzīgu nodarījumu (18. pants)",
      paragraphs: [
        "Ja ir norādes uz noziedzīgu nodarījumu, kas rada apdraudējumu personas dzīvībai vai drošībai, nekavējoties informējam kompetentās tiesībaizsardzības vai tiesu iestādes.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Iekšējā sūdzību procedūra (20. pants)",
      paragraphs: [
        "Par katru 4. iedaļā minēto pasākumu un par ziņojuma noraidīšanu sešu mēnešu laikā var bez maksas iesniegt sūdzību.",
        "Sūdzības izskatām savlaicīgi, nediskriminējoši un rūpīgi – kvalificētu personu uzraudzībā un ne tikai ar automatizētiem līdzekļiem.",
        "Ja sūdzība izrādās pamatota, pasākumu atceļam. Ceļu apraksta sadaļa [Sūdzības un strīdu risināšana](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Ārpustiesas strīdu risināšana (21. pants)",
      paragraphs: [
        "Strīdos par 4. iedaļā minētajiem pasākumiem lietotāji var vērsties ārpustiesas strīdu risināšanas iestādē, ko sertificējis kompetentais digitālo pakalpojumu koordinators. Sertificēto iestāžu sarakstu uztur Eiropas Komisija.",
        "Šo iestāžu lēmumi mums nav saistoši; piedalīties neatkarīgu sniedzēju procedūrās mums nav pienākuma. Ceļš uz tiesām paliek neskarts.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Uzticamie signalizētāji (22. pants)",
      paragraphs: [
        "Ziņojumus, ko iesniedz subjekts, kas atzīts par uzticamu signalizētāju savā kompetences jomā, izskatām prioritāri.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Pasākumi pret ļaunprātīgu izmantošanu (23. pants)",
      paragraphs: [
        "Kontus, caur kuriem bieži tiek sniegts acīmredzami prettiesisks saturs, pēc iepriekšēja brīdinājuma uz samērīgu laiku bloķējam.",
        "Ziņojumu un sūdzību izskatīšanu apturam personām, kas bieži iesniedz acīmredzami nepamatotus ziņojumus vai sūdzības – arī pēc iepriekšēja brīdinājuma.",
        "Vienmēr izvērtējam konkrēto gadījumu: attiecīgo darbību skaitu, īpatsvaru un smagumu, kā arī nodomu.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Pārredzamības ziņojumi (15. un 24. pants)",
      paragraphs: [
        "Katru gadu publicējam ziņojumu par satura moderēšanu: iestāžu rīkojumu skaitu, ziņojumu skaitu un veidu, veiktos pasākumus, sūdzību skaitu un to iznākumu, datus par automatizētu procedūru izmantošanu, kā arī strīdu skaitu ārpustiesas iestādēs.",
        `Mikrouzņēmumi un mazie uzņēmumi saskaņā ar regulas 19. pantu ir atbrīvoti no daļas šo pienākumu. Kamēr atbrīvojums ir spēkā, datus pēc pieprasījuma sniedzam uz ${ANBIETER.email}; tiklīdz pirmais ziņojums būs publicēts, šeit tiks pievienota saite.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Tirgotāju izsekojamība (30.–32. pants)",
      paragraphs: [
        "Sniedzēji, kas Platformā darbojas komerciālos nolūkos, drīkst piedāvāt tikai pēc tam, kad mums iesnieguši vārdu, adresi, tālruņa numuru, e-pasta adresi, reģistra datus, PVN maksātāja numuru un maksājumu kontu un viņu norādes ir ticamas.",
        "Šīs norādes attēlojam sludinājumā, ciktāl regula to paredz.",
        "Uzzinot, ka sludinājums attiecās uz prettiesisku produktu vai prettiesisku pakalpojumu, informējam skartos viesus, ciktāl mums ir viņu kontaktinformācija.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Ieteikumu sistēmas (27. pants)",
      paragraphs: [
        "Meklēšanas rezultātu secības un ieteikumu galvenie parametri, kā arī iespēja tos ietekmēt, aprakstīti sadaļā [Cenas, ranžēšana un ieteikumi](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklāma (26. pants)",
      paragraphs: [
        "Pašlaik nerādām trešo pušu apmaksātu reklāmu un apmaksātas izvietošanas meklēšanas rezultātos.",
        "Ieviešot reklāmu, to skaidri apzīmēsim, norādīsim reklāmdevēju un galvenos rādīšanas parametrus. Reklāmu, kas balstīta uz īpašu kategoriju personas datiem saskaņā ar Regulas (ES) 2016/679 9. pantu, un reklāmu nepilngadīgajiem, balstoties uz profilēšanu, izslēdzam.",
      ],
    },
  ],
};
