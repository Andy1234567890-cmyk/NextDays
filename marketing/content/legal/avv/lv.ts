// Lettische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `./de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen) und werden von dort in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Līgums par personas datu apstrādi",
  metaDescription:
    "Personas datu apstrāde saskaņā ar VDAR 28. pantu starp myNextDays ApS un uzņēmumiem, kas izmanto platformu: priekšmets, norādījumi, drošība, apakšapstrādātāji.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Šis līgums (turpmāk — „Apstrādes līgums”) ir spēkā starp uzņēmumu, kas izmanto platformu myNextDays (turpmāk — „pārzinis”), un ${ANBIETER.firma} (turpmāk — „apstrādātājs” vai „mēs”) un precizē pienākumus, kas noteikti Regulas (ES) 2016/679 (VDAR) 28. pantā.`,
    `Tas tiek iekļauts līgumā ar [Vispārīgajiem darījumu noteikumiem](${AGB_URL}) un ir spēkā visā platformas lietošanas laikā. Tam ir priekšroka pret vispārīgajiem darījumu noteikumiem, ciktāl runa ir par personas datu apstrādi pārziņa uzdevumā.`,
    "Papildus tam [privātuma politika](/datenschutz) attiecas uz datiem, ko mēs apstrādājam kā patstāvīgs pārzinis — jo īpaši uz konta un darījumu attiecību datiem.",
  ],
  sections: [
    {
      heading: "Priekšmets un lomu sadalījums",
      unterpunkte: [
        {
          paragraphs: [
            "Priekšmets ir tādu personas datu apstrāde, ko pārzinis ievada platformā vai ievāc ar tās starpniecību, lai mēs varētu sniegt līgumā noteiktos pakalpojumus: objektu, rezervāciju un noslodzes pārvaldību, saziņu ar viesiem, maksājumu apstrādi, grāmatvedību un īpašnieku norēķinus, pieslēgumu rezervāciju portāliem, tīmekļa vietņu veidotāju, kā arī uzdevumu un komandas pārvaldību.",
          ],
        },
        {
          paragraphs: [
            "Pārzinis lemj par šīs apstrādes nolūkiem un līdzekļiem. Mēs apstrādājam datus vienīgi pēc viņa dokumentētiem norādījumiem un ne saviem nolūkiem.",
          ],
        },
        {
          paragraphs: [
            "Attiecībā uz konta datiem, mūsu pašu pakalpojumu norēķiniem, sistēmas drošību un likumā noteikto glabāšanu pārziņi esam mēs paši. Šī apstrāde nav šā Apstrādes līguma priekšmets.",
          ],
        },
      ],
    },
    {
      heading: "Apstrādes veids, apjoms un nolūks",
      paragraphs: [
        "Apstrāde notiek, datus ievācot, glabājot, attēlojot, grozot, nododot pārziņa izraudzītiem saņēmējiem (piemēram, rezervāciju portāliem, maksājumu pakalpojumu sniedzējiem), ierobežojot un dzēšot — automatizētā veidā platformā.",
        "Apstrādes vieta ir Eiropas Savienība; izņēmumi ir izsmeļoši uzskaitīti 8. sadaļā.",
      ],
    },
    {
      heading: "Datu subjektu kategorijas",
      list: [
        "Viesi un rezervētāji, tostarp līdzceļotāji",
        "Interesenti, kas iesniedz pieprasījumus vai sūta ziņas",
        "Pārvaldīto objektu īpašnieki",
        "Pārziņa darbinieki (komanda, uzkopšana, apkalpošana, reģistratūra)",
        "Pārziņa partneru un pakalpojumu sniedzēju kontaktpersonas",
      ],
    },
    {
      heading: "Personas datu kategorijas",
      list: [
        "Pamatdati: vārds, adrese, dzimšanas datums, ja tas tiek reģistrēts, valstspiederība, ja tā tiek reģistrēta paziņošanas pienākuma izpildei",
        "Kontaktinformācija: e-pasta adrese, tālruņa numurs",
        "Rezervācijas dati: laikposms, objekts, ceļotāju skaits, cenas, papildpakalpojumi, atcelšanas",
        "Maksājumu dati: summa, valūta, maksāšanas veids, maksājuma statuss, atsauces (pilnīgi maksājumu kartes dati mūsu sistēmās nenonāk)",
        "Saziņas dati: ziņas, piezīmes, atsauksmes",
        "Darbinieku piekļuves un lietošanas dati: loma, atļaujas, pieteikšanās laiks, pieteikšanās ierīce un IP adrese",
        "Īpašas datu kategorijas VDAR 9. panta izpratnē nav uzdevuma priekšmets; pārzinis šādus datus brīvā teksta laukos neievada.",
      ],
    },
    {
      heading: "Norādījumi",
      unterpunkte: [
        {
          paragraphs: [
            "Norādījumus pārzinis sniedz, lietojot un konfigurējot platformu, kā arī teksta formā uz mūsu kontaktadresi. Mutvārdos sniegtus norādījumus mēs apstiprinām teksta formā.",
          ],
        },
        {
          paragraphs: [
            "Ja mēs kādu norādījumu uzskatām par pretlikumīgu, mēs to nekavējoties paziņojam un varam apturēt tā izpildi, līdz pārzinis to apstiprina vai groza.",
          ],
        },
        {
          paragraphs: [
            "Ja apstrāde mums ir noteikta likumā (piemēram, attiecībā pret iestādēm), mēs par to informējam pārzini iepriekš, ciktāl tas mums ir juridiski atļauts.",
          ],
        },
        {
          titel: "Pārziņa paša pakalpojumu savienošana",
          paragraphs: [
            "Pārzinis var ar saskarnes starpniecību savienot savu kontu ar pakalpojumu, ko viņš pats ir izraudzījies un ar kuru viņš ir noslēdzis savu līgumu — piemēram, ar MI asistentu. Ja viņš izveido tādu savienojumu, tas ir viņa nepārprotams norādījums VDAR 28. panta 3. punkta a) apakšpunkta izpratnē nodot atļautos datus šim pakalpojumam. Tas nepārprotami ietver arī ar to saistīto nodošanu uz trešo valsti, ja pakalpojuma atrašanās vieta ir ārpus Eiropas Savienības.",
            "Īsi sakot: par tādu savienojumu lemj vienīgi pārzinis, un par pievienoto pakalpojumu viņš ir atbildīgs pats.",
            "Izveidot to var tikai konts, kuram ir atļauja pārvaldīt ārējos savienojumus. Šī atļauja ir paredzēta vienīgi lomai „Administrators”; konti ar ierobežotām tiesībām — arī loma „Līdzadministrators” — savienojumu izveidot nevar. Mēs reģistrējam, kas, kad un kuram pakalpojumam to ir izveidojis, kādi datu veidi tika atļauti un kādi izsaukumi ir notikuši; šis reģistrs pārzinim ir pieejams saskarnē sadaļā „Konts → Savienojumi”, lai viņš varētu izpildīt savu pārskatatbildības pienākumu un atbildēt uz piekļuves pieprasījumiem.",
            "Pievienotais pakalpojums nav mūsu apakšapstrādātājs: mēs to nepilnvarojam, neizraugāmies un tam nedodam norādījumus. Tas apstrādā datus, pamatojoties uz līgumu, ko pārzinis ar to ir noslēdzis pats. Tāpēc par šo apstrādi, par tās juridisko pamatu un par nodošanas uz trešo valsti garantijām ir atbildīgs pārzinis; tā nav šā Apstrādes līguma priekšmets.",
            "Brīvā teksta lauki — rezervāciju piezīmes un viesu ziņu saturs — no tāda savienojuma pēc noklusējuma ir izslēgti. Tie var ietvert īpašas personas datu kategorijas VDAR 9. panta izpratnē, piemēram, ziņas par veselību. Pārzinim tie savienojuma izveidē ir jāatļauj atsevišķi; bez šīs atļaujas tie netiek nodoti.",
            "Izveidotu savienojumu pārzinis var jebkurā laikā saskarnē pārtraukt. Atjaunošanas marķieri tādā gadījumā tiek dzēsti, un ikreiz, kad tiek veikts nākamais izsaukums, tiek pārbaudīts, vai piekrišana vēl pastāv — tāpēc pārtraukts pakalpojums nekavējoties vairs neko nevar nolasīt, nevis tikai pēc tā piekļuves marķiera termiņa beigām.",
          ],
        },
      ],
    },
    {
      heading: "Konfidencialitāte",
      paragraphs: [
        "Visām personām, kurām uzdevuma izpildes gaitā var būt piekļuve datiem, ir pienākums ievērot konfidencialitāti, un tās regulāri tiek informētas par datu aizsardzību. Piekļuve ir ierobežota līdz attiecīgā uzdevuma izpildei nepieciešamajam apjomam.",
        "Mūsu darbinieki klientu datiem piekļūst tikai kļūdu novēršanai, pēc atbalsta pieprasījuma vai likumā noteikto pienākumu izpildei.",
      ],
    },
    {
      heading: "Apstrādes drošība",
      paragraphs: [
        "Mēs veicam VDAR 32. pantā prasītos tehniskos un organizatoriskos pasākumus. Jo īpaši ir ieviesti:",
      ],
      list: [
        "Pārraides šifrēšana (TLS) visiem savienojumiem, HTTP drošības galvenes, tostarp strikta Content-Security-Policy",
        "Atsevišķu uzņēmumu datu nodalīšana tieši datubāzē: rindu līmeņa piekļuves noteikumi (Row Level Security) un atsauktas tabulu tiesības sensitīviem datiem, tādējādi piekļuve ārpus paša uzņēmuma ir izslēgta arī tiešā datubāzes ceļā",
        "Uz lomām balstītas atļaujas ar datu nodalīšanu: apkalpošanas un uzkopšanas darbinieki nesaņem finanšu un pārdošanas datus, īpašnieki — tikai savus objektus; viesu dati lomām bez attiecīgām tiesībām tiek maskēti",
        "Divu faktoru autentifikācija (TOTP) ir pieejama kontiem; atkārtota pieteikšanās drošībai kritisku izmaiņu gadījumā",
        "Pieteikšanos reģistrs ar ierīci, laiku un IP adresi, kas ir pieejams pārzinim",
        "Savienojumus ar ārējiem pakalpojumiem var izveidot tikai konts ar lomu „Administrators”; katrs izsaukums ar tāda savienojuma starpniecību tiek protokolēts (rīks, laiks, apjoms — bez pašiem saturiem) un ir pārzinim pieejams. Pārtraukts savienojums piekļuvi zaudē nekavējoties: ikreiz, kad tiek veikts izsaukums, tiek pārbaudīts, vai piekrišana vēl pastāv",
        "Pieprasījumu biežuma ierobežošana pret automatizētiem uzbrukumiem, ienākošo Webhook izsaukumu parakstu pārbaude",
        "Šifrētas, ārpus ražošanas sistēmas glabātas rezerves kopijas ar regulāru atjaunošanas pārbaudi",
        "Nodalītas izstrādes un ekspluatācijas vides; izmaiņas datubāzē tikai ar versionētu migrāciju starpniecību",
      ],
    },
    {
      heading: "Apakšapstrādātāji",
      paragraphs: [
        "Pārzinis apstiprina turpmāk minēto apakšapstrādātāju iesaisti. Ar katru no tiem ir noslēgti līgumi saskaņā ar VDAR 28. panta 4. punktu, kuros noteiktie pienākumi atbilst šim Apstrādes līgumam.",
      ],
      list: [
        "Hetzner Online GmbH, Vācija (serveri, datubāze, mediji, pasta serveris; datu centrs Helsinkos, Somijā)",
        "Stripe Payments Europe, Limited, Īrija (maksājumi, izmaksas, likumā noteiktā identitātes pārbaude)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburga (maksājumi, ja pārzinis tos aktivizē)",
        "Channex.io Ltd, Apvienotā Karaliste (pieslēgums rezervāciju portāliem, ja tas ir aktivizēts)",
        "Meta Platforms Ireland Limited, Īrija (WhatsApp ziņas, ja tās ir aktivizētas)",
        "Google Ireland Limited, Īrija (satura tulkošana; pieteikšanās ar Google, ja tā tiek izmantota)",
        "Groq, Inc., ASV (atbilžu ieteikumi iesūtnē, ja tie ir aktivizēti)",
        "Cloudflare, Inc., ASV (savu domēnu DNS ierakstu pārvaldība, ja tā tiek izmantota)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Par nomaiņu vai papildinājumu mēs paziņojam vismaz 30 dienas iepriekš. Šajā termiņā pārzinis var iebilst svarīga, ar datu aizsardzību saistīta iemesla dēļ; ja iebildums netiek novērsts, viņš var izbeigt attiecīgo pakalpojuma daļu vai līgumu.",
          ],
        },
        {
          paragraphs: [
            "Pakalpojumi, par kuriem pārzinis pats vienojas ar trešo personu, nav apakšapstrāde, bet gan viņa ierosināta datu nodošana. Tas attiecas gan uz rezervāciju portālu, ar kuru viņam ir savs līgums, gan arī uz MI asistentu vai citu programmu, ko viņš ar saskarnes starpniecību savieno ar savu kontu (skat. sadaļu „Norādījumi”).",
            "Noteicošais nav tas, caur kā sistēmām dati plūst, bet gan tas, kas pakalpojumu piesaista: apakšapstrāde rodas tad, ja MĒS pilnvarojam vēl vienu pakalpojumu sniedzēju, lai sniegtu savu pakalpojumu. Ja pārzinis pakalpojumu izraugās pats un noslēdz ar to līgumu, šis pakalpojums apstrādā datus pārziņa, nevis mūsu vajadzībām. Šis nošķīrums atbilst līdzīgu pakalpojumu sniedzēju līgumu praksei attiecībā uz klienta pievienotiem trešo personu pakalpojumiem.",
          ],
        },
      ],
    },
    {
      heading: "Nodošana uz trešām valstīm",
      paragraphs: [
        "Datu nodošana saņēmējiem ārpus ES aprobežojas ar iepriekš minētajiem pakalpojumiem, kuru atrašanās vieta ir ASV vai Apvienotā Karaliste. Pamats ir Eiropas Komisijas standarta līgumklauzulas saskaņā ar VDAR 46. panta 2. punkta c) apakšpunktu vai spēkā esošs lēmums par aizsardzības līmeņa pietiekamību; tiek piemēroti papildu aizsardzības pasākumi (šifrēšana, datu minimizēšana).",
      ],
    },
    {
      heading: "Pārziņa atbalstīšana",
      unterpunkte: [
        {
          paragraphs: [
            "Mēs atbalstām pārzini datu subjektu pieprasījumu izpildē (VDAR 15.–22. pants). Platforma šim nolūkam piedāvā informācijas sniegšanu, labošanu, eksportu un datu dzēšanu tieši saskarnē. Ja datu subjekti vēršas tieši pie mums, mēs viņus novirzām pie pārziņa un informējam viņu par to.",
          ],
        },
        {
          paragraphs: [
            "Turklāt mēs sniedzam atbalstu datu aizsardzības ietekmes novērtējumu veikšanā, VDAR 32.–36. pantā noteikto pienākumu izpildē un uzraudzības iestāžu pieprasījumu gadījumā.",
          ],
        },
      ],
    },
    {
      heading: "Personas datu aizsardzības pārkāpumi",
      paragraphs: [
        "Ja mums kļūst zināms personas datu aizsardzības pārkāpums, kas attiecas uz pārziņa datiem, mēs viņu nekavējoties, ne vēlāk kā 48 stundu laikā pēc uzzināšanas, informējam teksta formā.",
        "Paziņojumā, ciktāl tas ir zināms, tiek norādīts incidenta veids un laiks, attiecīgās datu kategorijas un personu grupas, iespējamās sekas, kā arī veiktie un ierosinātie pasākumi. Mēs atbalstām pārzini viņa ziņošanas un paziņošanas pienākumu izpildē saskaņā ar VDAR 33. un 34. pantu.",
      ],
    },
    {
      heading: "Pierādījumi un pārbaudes",
      unterpunkte: [
        {
          paragraphs: [
            "Pēc pieprasījuma mēs apliecinām šā Apstrādes līguma izpildi, jo īpaši sniedzot informāciju par veiktajiem pasākumiem un par iesaistītajiem apakšapstrādātājiem.",
          ],
        },
        {
          paragraphs: [
            "Pārzinis var veikt pārbaudes nepieciešamajā apjomā vai uzticēt tās neatkarīgam revidentam, kas nekonkurē ar mums. Pārbaudes notiek pēc iepriekšēja paziņojuma ar samērīgu termiņu, parastajā darba laikā un netraucējot darbību. Izmaksas par pārbaudi, kas pārsniedz informācijas sniegšanu, sedz pārzinis, ja vien pārbaudi nav izraisījis mūsu radīts incidents.",
          ],
        },
      ],
    },
    {
      heading: "Dzēšana un atdošana",
      paragraphs: [
        "Pēc līguma beigām mēs pēc pieprasījuma 30 dienu laikā nodrošinām pārziņa datus eksportam ierastā, mašīnlasāmā formātā. Pēc tam mēs datus, tostarp kopijas, dzēšam.",
        "Izņēmums ir dati, kuriem ir likumā noteikts glabāšanas pienākums (jo īpaši rēķinu un grāmatvedības dati); tie tiek bloķēti un pēc termiņa beigām dzēsti. Rezerves kopijas tiek pārrakstītas ar parasto rotācijas ciklu.",
      ],
    },
    {
      heading: "Atbildība un noteikumu hierarhija",
      paragraphs: [
        "Piemēro VDAR 82. pantu. Pušu savstarpējās attiecībās papildus piemēro vispārīgo darījumu noteikumu atbildības noteikumus, ciktāl tie nav pretrunā ar VDAR.",
        "Ja vispārīgie darījumu noteikumi un šis Apstrādes līgums attiecībā uz apstrādi pārziņa uzdevumā ir pretrunā, noteicošais ir šis Apstrādes līgums. Ja kāds noteikums kļūst spēkā neesošs, pārējais saturs paliek spēkā; puses to aizstāj ar pieļaujamu noteikumu ar tādu pašu mērķi.",
      ],
    },
    {
      heading: "Šā līguma izmaiņas",
      paragraphs: [
        "Mēs varam pielāgot šo Apstrādes līgumu, ciktāl to prasa tiesību normu izmaiņas, uzraudzības iestāžu prasības, maksājumu pakalpojumu sniedzēju noteikumi vai tehniskā attīstība un ciktāl pārziņa stāvoklis ar to nepasliktinās.",
        "Par izmaiņām mēs paziņojam teksta formā vismaz 30 dienas pirms to spēkā stāšanās. Ja pārzinis šajā termiņā neiebilst, tās uzskata par pieņemtām; uz šīm sekām paziņojumā tiek norādīts. Iebilduma gadījumā katra puse var izbeigt līgumu ar spēkā stāšanās dienu.",
      ],
    },
    {
      heading: "Kontaktinformācija",
      paragraphs: [
        `Pieprasījumus par šo līgumu, norādījumus un paziņojumus lūdzam sūtīt uz [${ANBIETER.email}](mailto:${ANBIETER.email}) vai uz ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
