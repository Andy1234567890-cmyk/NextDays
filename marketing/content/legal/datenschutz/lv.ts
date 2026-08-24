// Lettische Fassung der Datenschutzerklärung. Quelle ist
// `content/legal/datenschutz/de.ts` — inhaltliche Änderungen gehören ZUERST
// dorthin und werden von dort hier nachgezogen. Struktur (Abschnitte, Absätze,
// Listen) muss deckungsgleich mit `de.ts` bleiben.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Privātuma paziņojums",
  metaDescription:
    "Kā myNextDays apstrādā personas datus: nolūki, tiesiskais pamats, saņēmēji, glabāšanas termiņi un jūsu tiesības saskaņā ar VDAR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Šis paziņojums apraksta, kā ${ANBIETER.firma} apstrādā personas datus — apmeklējot šo tīmekļa vietni, lietojot platformu myNextDays (vadības paneli, tirdzniecības vietu un mobilo lietotni) un uzturot darījumu attiecības ar mūsu klientiem.`,
    "Pamats ir Regula (ES) 2016/679 (VDAR), kā arī Dānijas datu aizsardzības likums (databeskyttelsesloven). Mēs nepārdodam datus, neveidojam profilus un savās tīmekļa vietnēs neizmantojam nekādus analītikas, izsekošanas vai reklāmas pakalpojumus. Reklāmas nolūkos datus apstrādājam tikai tur, kur esat skaidri devis piekrišanu — proti, mūsu jaunumu vēstkopai (sk. sadaļu „Saziņa“), no kuras jebkurā laikā varat atteikties ar vienu klikšķi.",
  ],
  sections: [
    {
      heading: "Pārzinis",
      paragraphs: [
        "Par šajā paziņojumā aprakstīto apstrādi atbild:",
      ],
      zeilen: [
        {
          label: "Uzņēmums",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adrese",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-pasts",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefons",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Piemērošanas joma un lomas",
      unterpunkte: [
        {
          paragraphs: [
            "Attiecībā uz šīs tīmekļa vietnes apmeklēšanu, jūsu klienta kontu un mūsu darījumu attiecību izpildi mēs esam pārzinis VDAR 4. panta 7. punkta izpratnē.",
          ],
        },
        {
          paragraphs: [
            "Attiecībā uz datiem, ko mūsu klienti (izīrētāji, viesnīcas, aģentūras) platformā apstrādā par saviem viesiem, īpašniekiem un darbiniekiem, pārziņi ir klienti, bet mēs esam apstrādātājs saskaņā ar VDAR 28. pantu. Sīkāka informācija ir norādīta [datu apstrādes līgumā](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Ja kā viesis rezervējat naktsmītni mūsu tirdzniecības vietā, jūsu rezervācijas un kontaktinformāciju apstrādājam gan savā vārdā (tirdzniecības vietas darbība, maksājumu apstrāde), gan uzņemošā uzņēmuma vajadzībām. Naktsmītnes līgums tiek noslēgts tikai ar attiecīgo uzņēmumu; papildus piemēro tā privātuma paziņojumu.",
          ],
        },
      ],
    },
    {
      heading: "Šīs tīmekļa vietnes apmeklēšana",
      unterpunkte: [
        {
          titel: "Servera žurnālfaili",
          paragraphs: [
            "Katrā atvēršanas reizē jūsu pārlūkprogramma nosūta tehniski nepieciešamos datus, ko reģistrē mūsu tīmekļa serveris: IP adresi, datumu un laiku, pieprasīto adresi, pārsūtīto datu apjomu, statusa kodu, atsauces adresi un pārlūkprogrammas identifikatoru. Nolūks ir vietnes nodrošināšana, kā arī uzbrukumu un traucējumu atklāšana un novēršana. Tiesiskais pamats ir VDAR 6. panta 1. punkta f) apakšpunkts; mūsu leģitīmās intereses ir droša un stabila darbība. Žurnālus glabājam tikai tik ilgi, cik tas nepieciešams darbībai un drošībai, un neapvienojam tos ar citiem datiem.",
          ],
        },
        {
          titel: "Fonti",
          paragraphs: [
            "Izmantotie fonti ir iekļauti lokāli mūsu serverī. Savienojums ar Google Fonts vai citu fontu pakalpojumu netiek izveidots.",
          ],
        },
        {
          titel: "Ikonas",
          paragraphs: [
            "Šīs tīmekļa vietnes ikonas, tāpat kā fonti, atrodas pie mums: tās lapā tiek ievietotas mūsu serverī un netiek papildus ielādētas no kāda ikonu pakalpojuma. Savienojums ar trešo personu tādēļ netiek izveidots, un jūsu IP adrese nevienam netiek nosūtīta.",
          ],
        },
        {
          titel: "Kontaktformas aizsardzība pret surogātpastu (reCAPTCHA)",
          paragraphs: [
            "Mūsu kontaktforma pret automatizētiem masu pieprasījumiem ir aizsargāta ar Google Ireland Limited pakalpojumu reCAPTCHA Enterprise. Tikai tad, ja tam piekrītat, jūsu pārlūkprogramma, aizpildot formu, ielādē skriptu no www.google.com; pie tam jūsu IP adrese un dati par jūsu darbībām formā tiek nosūtīti Google un tur izvērtēti, lai atšķirtu cilvēku no skripta. Tiesiskais pamats ir VDAR 6. panta 1. punkta a) apakšpunkts (piekrišana); papildus piemēro [Google privātuma paziņojumu](https://policies.google.com/privacy).",
            "Bez jūsu piekrišanas no Google netiek ielādēts nekas un dati tur neplūst; formu tādā gadījumā nepieņemam, taču jebkurā laikā varat mums rakstīt e-pastu. Savu piekrišanu varat mainīt vai atsaukt [sīkdatņu politikā](/cookie-richtlinie).",
          ],
        },
        {
          titel: "Nekāda analītika, nekāda reklāma",
          paragraphs: [
            "Mēs neizmantojam nekādus analītikas, izsekošanas vai reklāmas pakalpojumus (nekādu Google Analytics, nekādus pikseļus, nekādus reklāmas tīklus) un neveidojam profilus. Kādas sīkdatnes platformai ir tehniski nepieciešamas, ir norādīts [sīkdatņu politikā](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Klienta konts un platformas lietošana",
      paragraphs: [
        "Konta reģistrēšanai un uzturēšanai apstrādājam datus, ko ievadāt jūs vai jūsu uzņēmums: vārdu, uzņēmuma nosaukumu un juridisko formu, adresi, e-pasta adresi, tālruņa numuru, lomu un piekļuves tiesības, reģistra datus (piem., komercreģistra vai PVN maksātāja numuru), bankas konta rekvizītus izmaksām, kā arī kontā izveidoto saturu.",
        "Piekļuves aizsardzībai papildus apstrādājam pieteikšanās žurnālus (pieteikšanās laiku, IP adresi, ierīci un pārlūkprogrammu) un — ja tā ir aktivizēta — divu faktoru autentifikācijas datus.",
        "Pieteikšanās ar Google: e-pasta adreses un paroles vietā varat pieteikties arī ar Google kontu. Izvēloties šo veidu, no Google Ireland Limited saņemam tikai jūsu e-pasta adresi, vārdu, profila attēlu un jūsu Google konta identifikatoru (jomas „openid“, „email“, „profile“) — skaidri nekādu piekļuvi jūsu e-pastiem, kontaktiem, failiem vai kalendāriem. Jūsu Google paroli neuzzinām. Pieteikšanās procesu Google apstrādā kā patstāvīgs pārzinis; piemēro [Google privātuma paziņojumu](https://policies.google.com/privacy). Tiesiskais pamats ir VDAR 6. panta 1. punkta b) apakšpunkts, jo pieteikšanās kalpo līguma izpildei; šī pieteikšanās veida izvēle ir brīvprātīga un jebkurā laikā aizstājama ar pieteikšanos, izmantojot e-pasta adresi un paroli.",
        "Tiesiskais pamats ir VDAR 6. panta 1. punkta b) apakšpunkts (lietošanas līguma izpilde, sk. [lietošanas noteikumus](" +
          AGB_URL +
          ")), piekļuves aizsardzībai — VDAR 6. panta 1. punkta f) apakšpunkts, bet nodokļu un komerctiesību noteiktajai glabāšanai — VDAR 6. panta 1. punkta c) apakšpunkts.",
      ],
    },
    {
      heading: "Rezervācijas, viesu un objektu dati",
      paragraphs: [
        "Platformā tiek apstrādātas rezervācijas, viesu dati, ziņojumi, uzdevumi un norēķini. Pie tiem jo īpaši pieder viesa vārds un kontaktinformācija, ierašanās un izbraukšanas datums, ceļotāju skaits, cenas un maksājuma statuss, sarakstes vēsture, kā arī — ja uzņēmums tos apkopo — reģistrācijas dati un īpašās vēlmes.",
        "Šī apstrāde notiek attiecīgā uzņēmuma uzdevumā un pēc tā norādījumiem. Šos datus neizmantojam saviem nolūkiem, reklāmai vai mākslīgā intelekta modeļu apmācībai.",
        "Uzņēmuma ietvaros dati ir nodalīti pēc lomām: uzkopšanas un apkalpošanas darbinieki neredz finanšu un pārdošanas datus, īpašnieki — tikai savus objektus. Dažādu uzņēmumu dati ir tehniski nodalīti (klientu līmeņa piekļuves noteikumi pašā datubāzē).",
      ],
    },
    {
      heading: "Maksājumu apstrāde",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Kartes maksājumi un izmaksas notiek caur Stripe Payments Europe, Limited, Īrija. Stripe tiek nosūtīti maksājumam nepieciešamie dati (summa, valūta, maksāšanas līdzeklis, vārds, e-pasta adrese, rezervācijas numurs), bet mūsu klientu kontu gadījumā — tiesību aktos noteiktie identifikācijas dati (turētājs, faktiskie labuma guvēji, personu apliecinoša dokumenta dati, bankas konts). Pilni kartes dati mūsu sistēmas nesasniedz. Tiesiskais pamats ir VDAR 6. panta 1. punkta b) apakšpunkts un, attiecībā uz identifikācijas un noziedzīgi iegūtu līdzekļu legalizācijas novēršanas pienākumiem, VDAR 6. panta 1. punkta c) apakšpunkts. Sīkāku kārtību nosaka [Stripe privātuma paziņojums](https://stripe.com/privacy).",
            "Maksājumu saites papildpakalpojumiem: ja uzņēmums savam viesim par papildpakalpojumu (piem., uzkopšanu vai veļas mazgāšanu) izraksta rēķinu ar maksājuma saiti, šī saite ved uz Stripe uzturētu maksājumu lapu. Tam Stripe nosūtām pakalpojuma nosaukumu, summu, valūtu, kā arī iekšēju atsauci uz rezervāciju un uzņēmumu; uzņēmuma logotips tiek nosūtīts uz tā Stripe kontu, lai lapa parādītu tā zīmolu. Pašā maksājumu lapā viesa maksājumu un ierīces datus Stripe iegūst savā atbildībā. Pie mums atgriežas tikai maksājuma statuss, summa, ieturētās summas un maksājuma identifikatori — nekādi kartes dati.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Ja uzņēmums piedāvā PayPal kā maksāšanas veidu, maksājuma dati tiek nosūtīti PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburga. Piemēro [PayPal privātuma paziņojumu](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Izplatīšanas kanāli un portāli",
      paragraphs: [
        "Kad uzņēmums savus objektus pārdod caur portāliem, tādiem kā Booking.com, Airbnb vai Expedia, pieejamība, cenas, ierobežojumi un rezervāciju dati ar attiecīgo portālu tiek apmainīti caur mūsu savienojuma pakalpojumu sniedzēju Channex.io Ltd, Apvienotā Karaliste. No šī virziena saņemam portāla rezervāciju un viesu datus.",
        "Attiecīgajam portālam piemēro tā paša datu aizsardzības noteikumus; šajā ziņā portāls ir patstāvīgi atbildīgs. Nosūtīšanas tiesiskais pamats ir VDAR 6. panta 1. punkta b) apakšpunkts saistībā ar uzņēmuma uzdevumu.",
      ],
    },
    {
      heading: "Saziņa",
      unterpunkte: [
        {
          titel: "E-pasts",
          paragraphs: [
            "E-pastus saistībā ar lietošanu (rezervācijas apstiprinājumus, sistēmas ziņojumus, atbalsta saraksti, apstiprinājuma un ielūguma saites) sūtām un saņemam caur savu pašu uzturētu pasta serveri. Šiem ziņojumiem nav pieslēgts neviens ārējs sūtīšanas pakalpojums.",
          ],
        },
        {
          titel: "Jaunumu vēstkopa un iepriekšēja pieteikšanās",
          paragraphs: [
            "Mūsu tīmekļa vietnē varat pieteikties jaunumiem par myNextDays (iepriekšēja pieteikšanās / jaunumu vēstkopa). Pie tam tiek apstrādāta jūsu e-pasta adrese, valoda un vieta, kurā pieteicāties.",
            "Pieteikšanās notiek dubultas piekrišanas (double opt-in) kārtībā: pēc pieteikšanās saņemat e-pastu ar apstiprinājuma saiti; pieteikšanās kļūst spēkā tikai pēc tās nospiešanas. Piekrišanas pierādīšanai saglabājam pieteikšanās un apstiprinājuma laiku, pie tam izmantoto IP adresi, pārlūkprogrammas identifikatoru, kā arī teksta formulējumu, kuram piekritāt. Šie dati kalpo tikai pierādīšanai saskaņā ar VDAR 7. panta 1. punktu un netiek analizēti reklāmas nolūkos.",
            "Tiesiskais pamats ir jūsu piekrišana saskaņā ar VDAR 6. panta 1. punkta a) apakšpunktu; pierādījuma glabāšanu balstām uz VDAR 6. panta 1. punkta c) apakšpunktu saistībā ar 7. panta 1. punktu. Piekrišanu jebkurā laikā varat atsaukt ar spēku uz nākotni — izmantojot atteikšanās saiti katrā vēstkopas e-pastā vai brīvā formā rakstot mums e-pastu. Atsaukums neietekmē līdz tam veiktās apstrādes likumību.",
            "Vēstkopu pārvaldībai un izsūtīšanai kā apstrādātāju izmantojam Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Francija; Vācijas pārstāvniecība: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin). Tiek nosūtīta jūsu e-pasta adrese un minētie papildu dati (valoda, avots). Datus apstrādā serveros Eiropas Savienībā (Francijā un Vācijā); ar Brevo ir noslēgts datu apstrādes līgums saskaņā ar VDAR 28. pantu. Piemēro [Brevo privātuma paziņojumu](https://www.brevo.com/legal/privacypolicy/).",
            "Kad izsūtām vēstkopu, Brevo mūsu uzdevumā mēra, vai ziņojums ir atvērts un vai ir nospiestas tajā ietvertās saites. Šis mērījums palīdz pielāgot saturu un biežumu; tas ir daļa no piekrišanas un beidzas ar jūsu atteikšanos. Apvienošana ar citiem datu avotiem vai profilēšana nenotiek.",
            "Kamēr apstiprinājums nav saņemts, uz jūsu adresi nerakstām un to Brevo nenosūtām; neapstiprināts ieraksts zaudē spēku pēc septiņām dienām. Pēc atteikšanās adresi bloķējam izsūtīšanai un piekrišanas un atteikšanās pierādījumu glabājam tik ilgi, kamēr no tā var izrietēt prasījumi; pēc pieprasījuma to izdzēšam pilnībā.",
          ],
        },
        {
          titel: "Ziņojumi platformā",
          paragraphs: [
            "Ziņojumi starp viesi un uzņēmumu tiek saglabāti platformā, lai abas puses varētu aplūkot sarakstes vēsturi. Ja uzņēmums bloķē viesi, ziņojumu kanāls tiek slēgts; esošie ziņojumi tiek saglabāti izsekojamības nolūkos.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Ja uzņēmums izmanto WhatsApp savienojumu, ziņojumu saturs un iesaistīto personu tālruņa numuri tiek nosūtīti caur Meta Platforms Ireland Limited uzturēto WhatsApp Business Platform. Par šīs funkcijas izmantošanu lemj uzņēmums; bez aktivizēšanas nekāda nosūtīšana nenotiek.",
          ],
        },
      ],
    },
    {
      heading: "Automatizētas funkcijas un mākslīgais intelekts",
      paragraphs: [
        "Šeit aprakstītajām funkcijām papildus VDAR piemēro Regulu (ES) 2024/1689 (Mākslīgā intelekta regula, „AI Act“), kuras 50. pantā noteiktās pārredzamības prasības ir piemērojamas no 2026. gada 2. augusta.",
      ],
      unterpunkte: [
        {
          titel: "Atbilžu ieteikumi",
          paragraphs: [
            "Atbilžu ieteikumiem ziņojumu iesūtnē izmantojam — ja funkcija uzņēmumam ir aktivizēta — Groq, Inc., ASV, valodas modeļu piedāvājumu. Pie tam pakalpojumam tiek nosūtīts attiecīgais ziņojuma konteksts. Ieteikumi netiek nosūtīti automātiski; par nosūtīšanu vienmēr lemj cilvēks. Automatizēta lēmumu pieņemšana ar juridiskām sekām VDAR 22. panta izpratnē nenotiek.",
            "Tādējādi tā nav MI sistēma, kas Mākslīgā intelekta regulas 50. panta 1. punkta izpratnē tieši mijiedarbojas ar fiziskām personām: šis pienākums paredz TIEŠU mijiedarbību, kurā MI pats sazinās ar personu, nevis caur cilvēku kā starpnieku. Šeit funkcija piedāvā uzņēmumam tekstu, ko darbinieks pārbauda, var mainīt un nosūta pats — darbinieks ir šis starpnieks, un viesis sarakstās ar uzņēmumu, nevis ar tērzēšanas robotu. Automātiski atbildošs asistents netiek izmantots. Pēc mūsu vērtējuma funkcija neatbilst arī nevienam no Mākslīgā intelekta regulas III pielikumā noteiktajiem augsta riska MI gadījumiem.",
            "Turklāt ziņojumi viesiem nav „teksts par sabiedrības interešu jautājumiem“ Mākslīgā intelekta regulas 50. panta 4. punkta izpratnē: tie netiek publicēti, bet gan individuāli nosūtīti konkrētai personai un attiecas uz uzturēšanās organizēšanu. Neatkarīgi no tā šeit darbojas nosūtošā darbinieka veiktā cilvēka pārbaude.",
            "Ja nākotnē tiktu piedāvāta funkcija, kas patstāvīgi — bez cilvēka apstiprinājuma — atbildētu viesiem, viesis dialoga sākumā tiktu redzami informēts, ka viņš sarakstās ar MI sistēmu. Bez šāda norādījuma tāda funkcija netiks nodrošināta.",
          ],
        },
        {
          titel: "Lomas saskaņā ar Mākslīgā intelekta regulu",
          paragraphs: [
            "Attiecībā uz produktā iebūvētajām MI funkcijām mēs esam uzturētājs Mākslīgā intelekta regulas 3. panta 4. punkta izpratnē; pamatā esošo valodas modeļu nodrošinātāji ir attiecīgie modeļu piegādātāji. Ja uzņēmums šīs funkcijas izmanto savā profesionālajā darbībā, tas savukārt ir uzturētājs un uz to attiecas MI pratības pienākums saskaņā ar Mākslīgā intelekta regulas 4. pantu, kas no 2025. gada 2. februāra ir piemērojams neatkarīgi no uzņēmuma lieluma. No 2026. gada 27. jūlija tas ir piemērojams Regulas (ES) 2026/1744 redakcijā: nodrošinātāji un uzturētāji veic pasākumus, lai atbalstītu sava personāla MI pratības attīstību; noteikts līmenis pie tam skaidri nav jāgarantē. Mēs sniedzam atbalstu ar norādēm lietojumprogrammā un mūsu palīdzības centrā; savu darbinieku apmācība paliek uzņēmuma uzdevums.",
            "Ja uzņēmums savieno savu kontu ar paša izvēlētu MI asistentu (sk. nākamo punktu), tas arī attiecībā uz to ir uzturētājs Mākslīgā intelekta regulas izpratnē — tas lemj par izmantošanu un formulē pieprasījumus. Pati saskarne nav MI sistēma: tā nolasa datus no datubāzes un tos izsniedz, neizdarot secinājumus; Mākslīgā intelekta regulas 12. apsvērumā tādas sistēmas ir skaidri nošķirtas no MI.",
          ],
        },
        {
          titel: "Savienojums ar paša izvēlētu MI asistentu",
          paragraphs: [
            "Uzņēmums var caur saskarni savienot savu kontu ar MI asistentu, ko tas pats ir izvēlējis un ar ko tam ir savs līgums — piemēram, Claude no Anthropic PBC, ASV. Ja šāds savienojums ir piešķirts, asistents pēc uzņēmuma pieprasījuma var nolasīt: noslogojumu, pieejamību un dienas cenas; rezervācijas ar viesa vārdu, uzturēšanās laikposmu, objektu, rezervācijas kanālu, statusu, kā arī summu un valūtu, ciktāl pieprasītājkonta loma ir tiesīga redzēt summas; un sarakstes pārskatu iesūtnē. Bez piešķirta savienojuma nekāda nosūtīšana nenotiek.",
            "Nosūtītas netiek viesu e-pasta adreses un tālruņa numuri, kartes dati, bankas konta rekvizīti un maksājumu dokumenti, piekļuves kodi, kā arī objektu lietas. Rezervāciju piezīmes un viesu ziņojumu saturs pēc noklusējuma ir izslēgti, jo tie var ietvert datus par veselību vai citas īpašas kategorijas saskaņā ar VDAR 9. pantu; uzņēmumam tie savienojuma piešķiršanas brīdī ir skaidri un atsevišķi jāatļauj.",
            "Savienojumu var piešķirt tikai konts ar lomu „administrators“, nevis jebkurš konts ar piekļuvi. Katrs pieprasījums tiek reģistrēts un uzņēmumam ir aplūkojams sadaļā „Konts → Savienojumi“; tas tur jebkurā laikā var savienojumu pārtraukt, un piekļuve tādējādi uzreiz beidzas.",
            "Juridiski šī nosūtīšana ir uzņēmuma norādījums mums (VDAR 28. panta 3. punkta a) apakšpunkts). Asistenta nodrošinātājs nav mūsu apakšapstrādātājs — mēs to nepiesaistām un tam nedodam norādījumus; tas apstrādā datus, pamatojoties uz līgumu, ko uzņēmums ar to noslēdzis pats. Tādēļ par šīs apstrādes tiesisko pamatu, par savu viesu informēšanu un par garantijām nosūtīšanai uz trešo valsti atbild uzņēmums.",
          ],
        },
        {
          titel: "Tulkojumi",
          paragraphs: [
            "Objektu un satura tekstus var tulkot ar Google Ireland Limited Cloud Translation API. Pie tam tiek nosūtīti tulkojamie teksti; personas dati — tikai ciktāl tie ir ietverti šajos tekstos.",
          ],
        },
        {
          titel: "Cenu ieteikumi",
          paragraphs: [
            "Cenu ieteikumiem izmantojam ārējo avotu tirgus, laikapstākļu un valūtas kursu datus. Šie pieprasījumi neietver personas datus, bet tikai vietu, laikposmu un objekta pazīmes.",
          ],
        },
      ],
    },
    {
      heading: "Mūsu klientu tīmekļa vietnes un domēni",
      paragraphs: [
        "Ja uzņēmums ar vietņu veidotāju izveido savu tīmekļa vietni ar savu domēnu, tam nepieciešamos DNS ierakstus pārvaldām caur Cloudflare, Inc. Pie tam tiek nosūtīti domēna un konfigurācijas dati; klienta tīmekļa vietnes apmeklētāju datus apstrādājam tā, kā aprakstīts šajā paziņojumā.",
        "Par klienta tīmekļa vietnes saturu, obligāto informāciju un privātuma paziņojumiem atbild attiecīgais uzņēmums.",
      ],
    },
    {
      heading: "Mitināšana un datu glabāšana",
      paragraphs: [
        "Platforma, datubāze, mediji un pasta serveris darbojas Hetzner Online GmbH, Vācija, serveros Helsinku datu centrā (Somijā) — tātad Eiropas Savienībā. Ar Hetzner ir noslēgts datu apstrādes līgums.",
        "Rezerves kopijas tiek izveidotas šifrētas un šifrētas glabātas pie glabāšanas pakalpojumu sniedzēja ES teritorijā.",
      ],
    },
    {
      heading: "Saņēmēju pārskats",
      paragraphs: [
        "Izņemot minētos pakalpojumu sniedzējus, personas datus nododam tālāk tikai tad, ja tas mums ir noteikts tiesību aktos (piem., nodokļu iestādēm, tiesībaizsardzības iestādēm) vai ja to pieprasāt jūs vai atbildīgais uzņēmums.",
      ],
      list: [
        "Hetzner Online GmbH (Vācija/Somija) — mitināšana, datubāze, mediji, pasta serveris",
        "Stripe Payments Europe, Limited (Īrija) — maksājumi, izmaksas, identitātes pārbaude",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luksemburga) — maksājumi, ja aktivizēts",
        "Channex.io Ltd (Apvienotā Karaliste) — savienojums ar rezervāciju portāliem",
        "Meta Platforms Ireland Limited (Īrija) — WhatsApp ziņojumi, ja aktivizēts",
        "Sendinblue SAS / Brevo (Francija, Vācija) — jaunumu vēstkopas pārvaldība un izsūtīšana, tikai ar piekrišanu",
        "Google Ireland Limited (Īrija) — tulkojumi; kontaktformas aizsardzība pret surogātpastu (reCAPTCHA Enterprise), tikai ar piekrišanu; pieteikšanās ar Google, ja tiek izmantota",
        "Groq, Inc. (ASV) — atbilžu ieteikumi, ja aktivizēti",
        "Cloudflare, Inc. (ASV) — klientu domēnu DNS pārvaldība",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Šajā sarakstā nav pakalpojumu, par kuriem uzņēmums vienojas ar trešo personu pats un ko caur saskarni savieno ar savu kontu — piemēram, MI asistenta, tāda kā Claude no Anthropic PBC, ASV. Tie nav mūsu piesaistīti pakalpojumu sniedzēji, bet gan saņēmēji pēc attiecīgā uzņēmuma norādījuma; bez tā savienojuma dati tur neplūst. Saskaņā ar ASV Tirdzniecības departamenta oficiālo dalībnieku sarakstu Anthropic nav sertificēta atbilstoši ES un ASV datu privātuma regulējumam (EU-US Data Privacy Framework); tādēļ nosūtīšana balstās uz standarta datu aizsardzības klauzulām, par kurām kā pārzinis atbild attiecīgais uzņēmums.",
          ],
        },
      ],
    },
    {
      heading: "Datu nodošana uz trešām valstīm",
      paragraphs: [
        "Apstrāde principā notiek Eiropas Savienībā. Izmantojot iepriekš minētos pakalpojumus, kuru sniedzēji atrodas ārpus ES, dati var tikt nodoti uz trešo valsti.",
        "Attiecībā uz Groq, Inc. un Cloudflare, Inc. (ASV) nosūtīšanu balstām uz Eiropas Komisijas standarta datu aizsardzības klauzulām saskaņā ar VDAR 46. panta 2. punkta c) apakšpunktu, ciktāl saņēmējs nevar atsaukties uz lēmumu par aizsardzības līmeņa pietiekamību (EU-US Data Privacy Framework).",
      "Maksājumu apstrādes līgumpartneris ir Stripe Payments Europe, Limited (Īrija). Ciktāl Stripe pie tam izmanto Stripe, LLC (ASV), tā ir sertificēta atbilstoši ES un ASV datu privātuma regulējumam (EU-US Data Privacy Framework); šajā ziņā nosūtīšana balstās uz Eiropas Komisijas lēmumu par aizsardzības līmeņa pietiekamību saskaņā ar VDAR 45. pantu. Papildus piemēro standarta datu aizsardzības klauzulas no [Stripe datu apstrādes līguma](https://stripe.com/legal/dpa).",
        "Attiecībā uz Channex.io Ltd (Apvienotā Karaliste) piemēro Eiropas Komisijas lēmumu par aizsardzības līmeņa pietiekamību Apvienotajai Karalistei; ja tas zaudē spēku, piemēro standarta datu aizsardzības klauzulas.",
      ],
    },
    {
      heading: "Trešo valstu iestāžu piekļuve (ASV CLOUD Act)",
      paragraphs: [
        "Pakalpojumu sniedzējiem, uz kuriem attiecas ASV jurisdikcija, saskaņā ar ASV CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) var būt pienākums izsniegt datus ASV iestādēm — arī tad, ja šie dati atrodas serveros Eiropas Savienībā. Tāda piekļuve var būt pretrunā VDAR, un pakalpojumu sniedzējam juridiski var būt liegts par to informēt mūs vai jūs. Ne lēmums par aizsardzības līmeņa pietiekamību attiecībā uz ES un ASV datu privātuma regulējumu, ne standarta datu aizsardzības klauzulas šo risku neizslēdz.",
        "Šo risku ierobežojam ar to, ka nesošās sistēmas — platforma, datubāze, mediji, pasta serveris un rezerves kopijas — darbojas pie Eiropas pakalpojumu sniedzējiem Eiropas Savienībā, kur ASV jurisdikcija nav piemērojama.",
      ],
      unterpunkte: [
        {
          titel: "Attiecīgie pakalpojumi",
          paragraphs: [
            "ASV jurisdikcija var attiekties tikai uz šiem skaidri norobežotajiem papildpakalpojumiem:",
          ],
          list: [
            "Groq, Inc. (ASV) — atbilžu ieteikumi ziņojumu iesūtnē, tikai tad, ja uzņēmums funkciju aktivizē. Tiek nosūtīts attiecīgais ziņojuma konteksts.",
            "Cloudflare, Inc. (ASV) — klientu domēnu DNS pārvaldība. Tiek nosūtīti domēna un konfigurācijas dati, nekādi viesu dati.",
            "Google LLC (ASV) — tikai pieteikšanās ar Google un tulkojumu gadījumā; līgumpartneris katrā gadījumā ir Google Ireland Limited, taču ASV mātesuzņēmuma piekļuve tomēr nav izslēgta.",
          ],
        },
        {
          titel: "Izvairīšanās iespēja",
          paragraphs: [
            "Platformu var lietot arī bez šiem pakalpojumiem: atbilžu ieteikumus var izslēgt, DNS pārvaldība attiecas tikai uz klientiem ar savu domēnu, un pieteikšanās ar Google ir brīvprātīga alternatīva pieteikšanās veidam ar e-pasta adresi un paroli.",
          ],
        },
        {
          titel: "Nošķiršana no Eiropas tiesībām",
          paragraphs: [
            "CLOUD Act ir ASV tiesības, nevis Eiropas Savienības tiesības. Tas ir jānošķir no EU Data Act (Regula (ES) 2023/2854), kas regulē datu apstrādes pakalpojumu maiņu un datu pārnesamību, kā arī no Cloud and AI Development Act, kas šī paziņojuma sagatavošanas brīdī atrodas Eiropas likumdošanas procesā.",
          ],
        },
      ],
    },
    {
      heading: "Glabāšanas termiņi",
      list: [
        "Konta dati: darījumu attiecību laikā; pēc tam dzēšana, ciktāl nav glabāšanas pienākuma.",
        "Rezervāciju, rēķinu un maksājumu dati: saskaņā ar Dānijas grāmatvedības likumu pieci gadi pēc tā finanšu gada beigām, kuram tie attiecināmi; klientiem ar juridisko adresi Vācijā var būt piemērojami ilgāki komerctiesību un nodokļu tiesību termiņi.",
        "Ziņojumi un viesu dati platformā: pēc atbildīgā uzņēmuma norādījumiem, ilgākais līdz tā veiktai dzēšanai vai līdz līguma beigām.",
        "Jaunumu vēstkopa: līdz piekrišanas atsaukumam; neapstiprinātas pieteikšanās zaudē spēku pēc septiņām dienām. Piekrišanas un atteikšanās pierādījums tiek glabāts arī pēc tam, kamēr tas nepieciešams kā pierādījums.",
        "Pieteikšanās žurnāli un drošības notikumi: īslaicīgi, uzbrukumu atklāšanai.",
        "Servera žurnālfaili: tikai tik ilgi, cik tas nepieciešams darbībai un drošībai.",
        "Rezerves kopijas: rotējoši, līdz tās aizstāj jaunākas kopijas.",
      ],
    },
    {
      heading: "Jūsu tiesības",
      paragraphs: [
        "Jums ir tiesības piekļūt datiem (15. pants), tos labot (16. pants), dzēst (17. pants), ierobežot apstrādi (18. pants), tiesības uz datu pārnesamību (20. pants) un tiesības iebilst pret apstrādi, kas balstīta uz leģitīmām interesēm (VDAR 21. pants). Doto piekrišanu jebkurā laikā varat atsaukt ar spēku uz nākotni.",
        `Šajā nolūkā vērsieties [${ANBIETER.email}](mailto:${ANBIETER.email}). Ja jūsu dati attiecas uz to, kā platformu lieto kāds uzņēmums, jūsu pieprasījumu pārsūtām atbildīgajam uzņēmumam vai atbalstām to atbildes sagatavošanā.`,
        `Turklāt varat iesniegt sūdzību datu aizsardzības uzraudzības iestādei — attiecībā uz mums kompetentā ir ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Varat vērsties arī savas dzīvesvietas uzraudzības iestādē.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Konta un lietotnes datu dzēšana",
      paragraphs: [
        "Sava konta dzēšanu jebkurā laikā varat pieprasīt pats — lietotnē sadaļā ‚Profils → Konts‘ vai izmantojot mūsu veidlapu tīmeklī:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Ceļš tīmeklī apzināti darbojas arī tad, ja lietotne vairs nav uzinstalēta vai vairs nevarat pieteikties. Aizsardzībai pret ļaunprātīgu izmantošanu tas notiek divos soļos: ievadāt sava konta e-pasta adresi un tieši uz šo adresi saņemat apstiprinājuma saiti. Pieprasījums kļūst derīgs tikai pēc tās atvēršanas — tikai ievadīta adrese vien nedod nekādas sekas. Pieprasījumu izskatām 30 dienu laikā un atbildam pa e-pastu.",
        "Kopā ar kontu dzēšam jūsu piekļuves datus, profilu, objektu un kalendāra datus, kā arī jūsu ziņojumus. Netiek dzēsti dokumenti, uz kuriem attiecas tiesību aktos noteikts glabāšanas pienākums — jo īpaši norēķinu periodu rēķini un rezervāciju attaisnojuma dokumenti (grāmatvedības pienākums saskaņā ar Dānijas tiesībām, parasti pieci gadi). Šie dokumenti termiņa laikā tiek bloķēti, tas ir, glabāti tikai šī pienākuma izpildei, un pēc tam dzēsti.",
      ],
    },
    {
      heading: "Apstrādes drošība",
      paragraphs: [
        "Apstrādi nodrošinām ar tehniskiem un organizatoriskiem pasākumiem saskaņā ar VDAR 32. pantu, jo īpaši: pastāvīgu pārraides šifrēšanu (TLS), klientu līmeņa piekļuves noteikumiem tieši datubāzē, uz lomām balstītām atļaujām ar finanšu un apkalpošanas datu nodalīšanu, izvēles divu faktoru autentifikāciju, pieteikšanās mēģinājumu ierobežošanu, šifrētām rezerves kopijām ar regulāru atjaunošanas pārbaudi, kā arī drošībai būtisku notikumu reģistrēšanu.",
      ],
    },
    {
      heading: "Pienākums sniegt datus",
      paragraphs: [
        "Dati, kas mums nepieciešami līguma noslēgšanai, norēķiniem un tiesību aktos noteikto pienākumu izpildei, ir obligāti — bez tiem platformu nodrošināt nevaram. Visi pārējie dati ir sniedzami brīvprātīgi.",
      ],
    },
    {
      heading: "Šī paziņojuma izmaiņas",
      paragraphs: [
        "Šo paziņojumu pielāgojam, ja mainās apstrāde, piesaistītie pakalpojumu sniedzēji vai tiesiskais regulējums. Katrā gadījumā ir spēkā šeit publicētā redakcija; datums augšā norāda tās sagatavošanas brīdi.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so.
export default datenschutz;
