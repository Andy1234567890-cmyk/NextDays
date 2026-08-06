// KOPIE aus web/content/legal/agb/lv.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Lettische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (recommended disclosure language) — Wortlaut und URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Vispārīgie myNextDays platformas lietošanas noteikumi aģentūrām un izīrētājiem.",
  numbered: false,
  toc: true,
  title: "Vispārīgie darījumu noteikumi aģentūrām un izīrētājiem",
  stand: "Redakcija: 2026. gada 30. jūlijs",
  intro: [
    "Šie vispārīgie darījumu noteikumi (turpmāk — „Noteikumi”) regulē programmatūras platformas myNextDays (turpmāk — „Platforma”) lietošanu, ko veic aģentūras, izīrētāji, īpašumu pārvaldītāji un citi komerciāli lietotāji (turpmāk — „Lietotājs”).",
    "Platformas nodrošinātāja ir myNextDays ApS, sabiedrība ar ierobežotu atbildību (anpartsselskab) saskaņā ar Dānijas tiesībām, Hirtshalsvej 21, 9881 Bindslev, Dānija, reģistrēta Dānijas Centrālajā uzņēmumu reģistrā (CVR) ar CVR Nr. 46615182 (turpmāk — „myNextDays” vai „mēs”).",
    "Platforma ir paredzēta vienīgi uzņēmējiem Vācijas Civillikuma (BGB) 14. panta vai attiecīgās ES dalībvalsts atbilstošo tiesību normu izpratnē. Tā nav paredzēta patērētājiem.",
  ],
  sections: [
    {
      heading: "§ 1 Piemērošanas joma",
      paragraphs: [
        "Šie Noteikumi attiecas uz visiem līgumiem par Platformas lietošanu starp myNextDays un Lietotāju, kā arī uz visiem ar tās starpniecību sniegtajiem pakalpojumiem un moduļiem.",
        "Lietotāja atšķirīgi, pretēji vai papildinoši darījumu noteikumi kļūst par līguma sastāvdaļu tikai tad, ja myNextDays to piemērošanai ir nepārprotami piekritusi teksta formā.",
      ],
    },
    {
      heading: "§ 2 Līguma priekšmets un pakalpojumi",
      paragraphs: [
        "myNextDays nodrošina Lietotājam mākoņdatošanas programmatūru brīvdienu mājokļu un izmitināšanas uzņēmumu pārvaldībai. Funkciju apjoms izriet no attiecīgā brīža spēkā esošā pakalpojumu apraksta un jo īpaši ietver:",
      ],
      list: [
        "objektu, noslodzes kalendāru un rezervāciju pārvaldību (īpašumu pārvaldības sistēma),",
        "pieslēgumu trešo personu rezervāciju kanāliem (piemēram, Booking.com, Airbnb), izmantojot kanālu pārvaldnieku,",
        "piedāvājumu publicēšanu Platformas pašas rezervāciju kanālā myNextDays,",
        "savu tīmekļa vietņu izveidi ar integrēto lapu veidotāju,",
        "grāmatvedības, norēķinu un pārskatu funkcijas, tostarp īpašnieku norēķinus,",
        "saziņu ar viesiem un maksājumu pieņemšanu, izmantojot integrēto maksājumu apstrādi (§ 5).",
      ],
    },
    {
      heading: "§ 3 Reģistrācija, konts un Lietotāja sniegtā informācija",
      paragraphs: [
        "Platformas lietošanai ir nepieciešama konta reģistrācija. Lietotājam ir pienākums reģistrējoties un visā līguma darbības laikā sniegt pareizu, aktuālu un pilnīgu informāciju par sevi un savu uzņēmumu un izmaiņu gadījumā to nekavējoties atjaunināt.",
        "Piekļuves dati ir jāglabā slepenībā un jāaizsargā pret trešo personu piekļuvi. Lietotājam ir nekavējoties jāinformē myNextDays, ja pastāv norādes uz viņa konta ļaunprātīgu izmantošanu.",
        "Konts nav nododams citām personām. Lietotājs nodrošina, ka visas personas, kas viņa vārdā izmanto kontu, ievēro šos Noteikumus.",
      ],
    },
    {
      heading: "§ 4 myNextDays loma rezervācijās",
      paragraphs: [
        "Izmitināšanas līgumi par naktsmītnēm, kas tiek piedāvātas Platformā, pieslēgtajos trešo personu kanālos vai Lietotāja paša tīmekļa vietnē, tiek noslēgti vienīgi starp Lietotāju (vai viņa pārstāvēto īpašnieku) un attiecīgo viesi. myNextDays nekļūst par izmitināšanas līguma pusi.",
        "Par piedāvājumu satura (aprakstu, fotogrāfiju, cenu, pieejamības, nodokļu un nodevu) pareizību un likumību ir atbildīgs vienīgi Lietotājs.",
      ],
    },
    {
      heading: "§ 5 Maksājumu apstrāde, ko veic Stripe",
      paragraphs: [
        "Maksājumu apstrādes pakalpojumus aģentūrām un izīrētājiem myNextDays platformā sniedz Stripe, un uz tiem attiecas [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), kas ietver Stripe pakalpojumu sniegšanas noteikumus (kopā — „Stripe pakalpojumu līgums”). Piekrītot šiem Noteikumiem vai turpinot darboties myNextDays platformā kā aģentūra vai izīrētājs, Lietotājs piekrīt, ka viņam ir saistošs Stripe pakalpojumu līgums, kuru Stripe laiku pa laikam var grozīt.",
        "Priekšnoteikums tam, lai myNextDays nodrošinātu maksājumu apstrādes pakalpojumus ar Stripe starpniecību, ir tas, ka Lietotājs sniedz myNextDays pareizu un pilnīgu informāciju par sevi un savu uzņēmumu. Lietotājs pilnvaro myNextDays nodot Stripe šo informāciju, kā arī darījumu datus, kas saistīti ar Stripe sniegto maksājumu apstrādes pakalpojumu izmantošanu.",
        "Tiesiskajām attiecībām ar Stripe noteicošais ir saitē norādītais līguma teksts angļu valodā tā attiecīgi spēkā esošajā redakcijā. Līgumslēdzēja puse lietotājiem Eiropas Ekonomikas zonā ir Stripe pakalpojumu līgumā norādītā Stripe sabiedrība (pašlaik Stripe Payments Europe, Limited, Īrija). Stripe apstrādā personas datus saskaņā ar [Stripe privātuma politiku](https://stripe.com/privacy).",
        "Lai izpildītu likumā noteiktos identifikācijas un pārbaudes pienākumus (tostarp noziedzīgi iegūtu līdzekļu legalizācijas novēršanas un „pazīsti savu klientu” prasības), myNextDays un Stripe jebkurā laikā var pieprasīt papildu informāciju un apliecinošus dokumentus, jo īpaši identitātes dokumentus, informāciju par patiesajiem labuma guvējiem un bankas konta rekvizītus. Ja pieprasītā informācija vai dokumenti netiek iesniegti noteiktajā termiņā, maksājumu pieņemšana vai izmaksas var tikt pilnībā vai daļēji apturētas, līdz informācija ir pilnīga.",
      ],
    },
    {
      heading: "§ 6 Izmaksas, atgrieztie maksājumi un negatīvs atlikums",
      paragraphs: [
        "Maksājuma ceļš ir atkarīgs no rezervācijas kanāla. Rezervācijām, kas veiktas ar Lietotāja paša rezervāciju sistēmu, un rezervācijām ar pievienoto izplatīšanas portālu starpniecību viesu maksājumi tiek saņemti tieši Lietotāja maksājumu kontā; šajos gadījumos Lietotājs attiecībā pret viesi ir maksājuma saņēmējs un izmitināšanas pakalpojuma līgumslēdzēja puse (§ 4), un myNextDays nevienā brīdī nekļūst par šo līdzekļu turētāju. Par šādām rezervācijām myNextDays neiekasē procentuālu rezervācijas maksu; komisijas maksa par rezervācijām ar pievienoto izplatīšanas portālu starpniecību tiek norādīta atsevišķi un tiek izrakstīts rēķins vēlāk.",
        "Rezervācijām, kas veiktas ar myNextDays rezervāciju portāla starpniecību, maksājums tiek apstrādāts ar myNextDays starpniecību. myNextDays šajā gadījumā ietur spēkā esošajā cenrādī norādīto starpniecības komisijas maksu, ieskaitot maksājuma apstrādes izmaksas, un pārskaita atlikušo summu Lietotājam saskaņā ar turpmākajām daļām. Atlīdzība par programmatūras lietošanu (§ 7) paliek neskarta.",
        "Izmaksas tiek veiktas uz Lietotāja norādīto bankas kontu. myNextDays riska apsvērumu dēļ var pielāgot izmaksu grafiku, jo īpaši jaunu kontu, neparastu darījumu modeļu vai notiekošu pārbaužu gadījumā.",
        "Atmaksas viesiem ekonomiski sedz Lietotājs. Atgrieztos maksājumus un no tiem izrietošās maksas sedz Lietotājs rezervācijām, kas veiktas ar viņa paša rezervāciju sistēmu un ar pievienoto izplatīšanas portālu starpniecību, jo šajos gadījumos Lietotājs ir maksājuma saņēmējs; rezervācijām, kas veiktas ar myNextDays rezervāciju portāla starpniecību, atgriezto maksājumu risku sedz myNextDays, izņemot gadījumus, kad tas izriet no Lietotāja pienākumu pārkāpuma (jo īpaši izmitināšanas pakalpojuma nesniegšanas vai būtiskas neatbilstības). myNextDays ir tiesīga ieskaitīt Lietotāja sedzamās summas pret nākotnes izmaksām.",
        "Ja Lietotāja maksājumu kontā rodas negatīvs atlikums, Lietotājam tas ir nekavējoties jāsedz. Lietotājs pilnvaro myNextDays un Stripe iekasēt negatīvo atlikumu no norādītā bankas konta, ciktāl tas ir tiesiski pieļaujams.",
      ],
    },
    {
      heading: "§ 7 Maksas un norēķini",
      paragraphs: [
        "Maksas par Platformas lietošanu izriet no līguma noslēgšanas brīdī saskaņotā cenrāža vai individuālā piedāvājuma. Visas cenas ir norādītas bez attiecīgi piemērojamiem likumā noteiktajiem nodokļiem un līgumā norādītajā valūtā.",
        "No darījumiem atkarīgās maksas (piemēram, maksājumu vai kanālu maksas) var tikt ieturētas vai ieskaitītas tieši attiecīgā darījuma apstrādes brīdī.",
        "Ja Lietotājs kavē maksājumus, myNextDays pēc iepriekšēja paziņojuma var bloķēt piekļuvi Platformai, līdz nesamaksātie prasījumi ir segti.",
      ],
    },
    {
      heading: "§ 8 Lietotāja pienākumi; paša juridiskie teksti",
      paragraphs: [
        "Lietotājs nodrošina, ka viņa piedāvājumi, saturs un komercdarbības prakse atbilst attiecīgi piemērojamiem tiesību aktiem, jo īpaši izmitināšanas, reģistrācijas, nodokļu un patērētāju aizsardzības tiesību normām naktsmītnes atrašanās vietā. Nepieciešamās atļaujas, reģistrācijas un licences Lietotājs uztur uz savu atbildību.",
        "Par tīmekļa vietnēm, ko Lietotājs uztur ar lapu veidotāju, kā arī par saviem piedāvājumiem Platformā ir atbildīgs pats Lietotājs; tas jo īpaši ietver paša noteikumus viesiem, paša juridisko informāciju (impresumu) un paša privātuma informāciju.",
        "Jo īpaši ir aizliegts: publicēt nepareizus vai maldinošus piedāvājumus, veikt fiktīvus vai krāpnieciskus darījumus, apiet § 5 paredzēto maksājumu apstrādi rezervācijām, kas noslēgtas ar Platformas starpniecību, kā arī jebkāda lietošana, kas apdraud Platformas drošību vai pieejamību.",
      ],
    },
    {
      heading: "§ 9 Trešo personu rezervāciju kanāli",
      paragraphs: [
        "Pieslēdzot trešo personu kanālus (piemēram, Booking.com, Airbnb), papildus ir spēkā attiecīgā kanāla operatora noteikumi. Šim nolūkam nepieciešamos līgumus ar kanāla operatoru Lietotājs slēdz pats.",
        "myNextDays veic pieejamības, cenu un rezervāciju datu tehnisko sinhronizāciju, taču tā nevar ietekmēt kanālu operatoru saturu, komisijas maksas vai lēmumus un neatbild par to pieejamību.",
      ],
    },
    {
      heading: "§ 10 Pieejamība un turpmākā attīstība",
      paragraphs: [
        "myNextDays sniedz pakalpojumus ar krietna komersanta rūpību un tiecas nodrošināt augstu Platformas pieejamību. Apkopes logi, turpmākā attīstība un apstākļi, kas ir ārpus myNextDays ietekmes (piemēram, traucējumi pie trešo personu pakalpojumu sniedzējiem), var īslaicīgi ierobežot pieejamību.",
        "myNextDays drīkst Platformu pilnveidot un mainīt funkcijas, ciktāl tādējādi netiek apdraudēts līguma mērķis un izmaiņas Lietotājam ir saprātīgi pieņemamas.",
      ],
    },
    {
      heading: "§ 11 Dati un datu aizsardzība",
      paragraphs: [
        "Ciktāl myNextDays, nodrošinot Platformu, apstrādā personas datus Lietotāja uzdevumā (jo īpaši viesu datus), puses noslēdz līgumu par apstrādi saskaņā ar VDAR 28. pantu.",
        "Lietotājs paliek atbildīgs par viņa iesniegto datu vākšanas un apstrādes pieļaujamību datu aizsardzības tiesību izpratnē. Sīkāka informācija par datu apstrādi, ko veic myNextDays, ir izklāstīta Platformas privātuma informācijā; datu apstrādei, ko veic Stripe, piemēro § 5.",
      ],
    },
    {
      heading: "§ 12 Intelektuālais īpašums",
      paragraphs: [
        "Visas tiesības uz Platformu, tās programmatūru un saturu (izņemot Lietotāja ievietoto saturu) pieder myNextDays vai tās licences devējiem. Lietotājs uz līguma darbības laiku saņem vienkāršas, nenododamas tiesības lietot Platformu līgumā noteiktajā apjomā.",
        "Attiecībā uz Lietotāja ievietoto saturu Lietotājs piešķir myNextDays Platformas darbībai nepieciešamās vienkāršās lietošanas tiesības (jo īpaši glabāšanai, pavairošanai, attēlošanai un pārsūtīšanai uz pieslēgtajiem kanāliem).",
      ],
    },
    {
      heading: "§ 13 Atbildība",
      paragraphs: [
        "myNextDays atbild bez ierobežojumiem par nodomu un rupju neuzmanību, kā arī par kaitējumu, kas radies dzīvības, ķermeņa vai veselības aizskāruma dēļ.",
        "Vieglas neuzmanības gadījumā myNextDays atbild tikai par būtisku līgumsaistību (kardinālo pienākumu) pārkāpumu, un atbildība ir ierobežota ar līgumam tipisko, paredzamo kaitējumu. Atbildība saskaņā ar produktatbildības tiesību aktiem, kā arī no uzņemtajām garantijām paliek neskarta.",
        "Par datu zudumu myNextDays atbild tikai tādā apmērā, kādā kaitējums būtu radies arī tad, ja Lietotājs būtu veicis pienācīgu, regulāru datu rezerves kopēšanu, ja vien datu rezerves kopēšana saskaņā ar līgumu nav myNextDays pienākums.",
      ],
    },
    {
      heading: "§ 14 Termiņš, izbeigšana un bloķēšana",
      paragraphs: [
        "Līguma termiņš un uzteikuma termiņi izriet no attiecīgā līguma. Tiesības uz ārkārtas izbeigšanu svarīga iemesla dēļ paliek neskartas.",
        "myNextDays var uz laiku bloķēt piekļuvi Platformai vai atsevišķām funkcijām (tostarp maksājumu pieņemšanai un izmaksām), ja pastāv konkrētas norādes uz šo Noteikumu pārkāpumu, krāpšanu vai ļaunprātīgu izmantošanu vai ja myNextDays to prasa likums vai maksājumu pakalpojumu sniedzēja rīkojums. Lietotājs par bloķēšanu tiek informēts, ciktāl tas ir tiesiski pieļaujams.",
        "Pēc līguma beigām myNextDays pēc pieprasījuma 30 dienu laikā nodrošina Lietotājam viņa datus eksportam vispārpieņemtā formātā; pēc tam dati tiek dzēsti, ja vien tam nav pretrunā likumā noteiktie glabāšanas pienākumi.",
      ],
    },
    {
      heading: "§ 15 Šo Noteikumu grozījumi",
      paragraphs: [
        "myNextDays var grozīt šos Noteikumus ar spēku nākotnē, ciktāl tas ir nepieciešams pamatotu iemeslu dēļ (jo īpaši tiesību aktu grozījumu, judikatūras izmaiņu vai maksājumu pakalpojumu sniedzēju prasību dēļ) un Lietotājs tādējādi netiek nesamērīgi nostādīts neizdevīgākā stāvoklī.",
        "Par grozījumiem Lietotājam paziņo teksta formā vismaz sešas nedēļas pirms to stāšanās spēkā. Ja Lietotājs paziņošanas termiņā neiebilst vai pēc grozījumu stāšanās spēkā turpina lietot Platformu, grozītie Noteikumi ir uzskatāmi par pieņemtiem; uz šīm sekām paziņojumā tiek īpaši norādīts.",
      ],
    },
    {
      heading: "§ 16 Nobeiguma noteikumi",
      paragraphs: [
        "Piemērojamas ir tās valsts tiesības, kurā nodrošinātājai ir juridiskā adrese, izslēdzot ANO Konvenciju par starptautiskajiem preču pirkuma-pārdevuma līgumiem. Tās valsts imperatīvās tiesību normas, kurā Lietotājam ir juridiskā adrese, paliek neskartas.",
        "Ekskluzīvā piekritība visiem strīdiem, kas izriet no šā līguma vai ir ar to saistīti, — ciktāl tas ir tiesiski pieļaujams — ir nodrošinātājas juridiskās adreses vietā.",
        "Ja atsevišķas šo Noteikumu normas ir vai kļūst spēkā neesošas, tas neietekmē pārējo normu spēkā esamību.",
      ],
    },
  ],
};
