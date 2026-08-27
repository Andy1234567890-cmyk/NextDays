// Lettische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Sīkdatņu politika",
  metaDescription:
    "Kādas sīkdatnes iestata myNextDays: tehniski nepieciešamās sīkdatnes un — tikai ar jūsu piekrišanu — funkcionālās, analītiskās un mārketinga sīkdatnes. Katru kategoriju var atsevišķi ieslēgt un izslēgt.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Šī politika paskaidro, kādas sīkdatnes un līdzīgas datu glabāšanas tehnoloģijas ${ANBIETER.firma} izmanto šajā tīmekļa vietnē un myNextDays platformā.`,
    "Īsumā: nepieciešamas ir tikai tās sīkdatnes, bez kurām vietne nedarbojas, kā pieprasīts. Viss pārējais prasa jūsu piekrišanu un netiek ielādēts bez tās — mūsu kontaktu veidlapas surogātpasta aizsardzība, sasniedzamības mērīšana un mārketinga sīkdatnes, ar kurām mēs mērām mūsu reklāmas panākumus. Jūs varat atļaut vai noraidīt katru no šīm kategorijām atsevišķi un jebkurā laikā atsaukt savu lēmumu.",
  ],
  sections: [
    {
      heading: "Kas ir sīkdatnes",
      paragraphs: [
        "Sīkdatnes ir mazi teksta faili, ko tīmekļa vietne saglabā pārlūkprogrammā. Tās ļauj atpazīt sesiju — piemēram, lai pēc pieteikšanās jūs paliktu pieteicies. Papildus sīkdatnēm pārlūkprogrammas izmanto arī citas krātuves, piemēram, Local Storage, kas darbojas tehniski līdzīgi.",
      ],
    },
    {
      heading: "Kam nepieciešama jūsu piekrišana",
      paragraphs: [
        "Piekrišana saskaņā ar Dānijas sīkdatņu noteikumu (Cookie-bekendtgørelsen) 9. pantu (ar ko īsteno Direktīvas 2002/58/EK 5. panta 3. punktu) ir nepieciešama tikai tad, ja piekļuve jūsu ierīcei nekalpo vienīgi ziņojuma pārraidīšanai vai nav obligāti nepieciešama jūsu tieši pieprasītam pakalpojumam.",
        "Visas sīkdatnes, ko mēs izmantojam, ir nepieciešamas pieteikšanās, sesijas drošības vai jūsu paša izvēlēta iestatījuma nodrošināšanai — tāpēc mēs neko neprasām un arī neuzstādām neko, kam būtu nepieciešama piekrišana.",
        "Jums ir jāpiekrīt trim kategorijām, kuras visas netiek ielādētas bez jūsu atļaujas: mūsu kontaktu veidlapas surogātpasta aizsardzība (reCAPTCHA no Google), šīs vietnes sasniedzamības mērīšana (Google Analytics 4) un mārketinga sīkdatnes (Meta, LinkedIn, Google Ads). Šim nolūkam tiek parādīts logs ar kategoriju sarakstu — pirmajā apmeklējuma reizē, bez iepriekšējas atlases, katra kategorija ar savu slēdzi. Kamēr neesat pieņēmis lēmumu, tiek piemērots „nav atļauts“, un netiek veikta ne analīze, ne reklāma.",
        "Jūsu izvēle tiek saglabāta jūsu pārlūkprogrammas krātuvē (Local Storage, vērtība „nd_consent“); tā satur tikai kategoriju, laiku un versijas numuru, bez jūsu personas identifikatora. Izmantojot sīkdatņu ikonu katras lapas kreisajā apakšējā stūrī, to jebkurā laikā varat mainīt vai atsaukt. Pēc sešiem mēnešiem mēs jautāsim atkārtoti — piekrišanai nav jābūt spēkā neierobežoti.",
      ],
    },
    {
      heading: "Šī tīmekļa vietne",
      paragraphs: [
        "Šī vietne pati par sevi neiestata sīkdatnes. Fonti un simboli atrodas mūsu pašu serverī — netiek izmantots neviens trešās puses simbolu vai fontu pakalpojums. Tiek pievienoti tikai tie pakalpojumi, kurus jūs atļaujat: kontaktu veidlapas surogātpasta aizsardzība, sasniedzamības mērīšana un mārketinga pakalpojumi. Kādas sīkdatnes tiek iestatītas, ar kādu derīguma termiņu un uz kāda resursdatora, ir norādīts zemāk sadaļā „Trešo pušu sīkdatnes“. Atsaukšana, izmantojot sīkdatnes ikonu apakšējā kreisajā stūrī — attiecīgais pakalpojums nekavējoties beidzas un tā sīkdatnes tiek dzēstas. Sīkāka informācija ir atrodama [Privātuma politikā](/datenschutz).",
      ],
    },
    {
      heading: "Platformas sīkdatnes",
      paragraphs: [
        "Tiklīdz piesakāties vadības panelī, tirdzniecības vietā vai mobilajā skatā, tiek uzstādītas šādas sīkdatnes:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Pieteikšanās (tehniski nepieciešama)",
          list: [
            "Mērķis: apliecina serverim jūsu pieteikto sesiju.",
            "Saturs: īslaicīgs piekļuves marķieris; lasāms tikai serverim (HttpOnly), pārraidīts tikai caur HTTPS.",
            "Derīguma termiņš: sesijas laiks vai marķiera derīguma termiņa beigas.",
          ],
        },
        {
          titel: "nd_refresh — Sesijas pagarināšana (tehniski nepieciešama)",
          list: [
            "Mērķis: atjauno piekļuves marķieri, lai jums nebūtu pastāvīgi jāpiesakās no jauna.",
            "Saturs: atjaunošanas marķieris; HttpOnly, tikai caur HTTPS.",
            "Derīguma termiņš: līdz izrakstīšanās brīdim vai derīguma termiņa beigām.",
          ],
        },
        {
          titel: "nd_locale — Valodas izvēle (funkcionāla)",
          list: [
            "Mērķis: iegaumē jūsu izvēlēto valodu.",
            "Saturs: valodas kods, piemēram, „de“ vai „en“.",
            "Derīguma termiņš: līdz maiņai vai dzēšanai.",
          ],
        },
        {
          titel: "sidebar_state — Sānjosla (funkcionāla)",
          list: [
            "Mērķis: iegaumē, vai navigācijas josla ir izvērsta vai sakļauta.",
            "Saturs: „true“ vai „false“.",
            "Derīguma termiņš: līdz maiņai vai dzēšanai.",
          ],
        },
        {
          titel:
            "sb-… — Pieteikšanās ar Google (tehniski nepieciešama, tikai lietošanas gadījumā)",
          list: [
            "Mērķis: uztur sesiju, kad piesakāties, izmantojot Google.",
            "Saturs: pieteikšanās pakalpojuma sesijas marķieris.",
            "Derīguma termiņš: sesijas laiks vai marķiera derīguma termiņa beigas. Tiek uzstādīta tikai tad, ja izvēlaties pieteikšanos ar Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Fiksē Jūsu lēmumu par pakalpojumiem, kuriem nepieciešama piekrišana (kontaktu veidlapas surogātpasta aizsardzība un auditorijas mērīšana).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Tiek uzstādīts tikai tad, ja pats atverat tērzēšanu šajā tīmekļa vietnē un nosūtāt ziņojumu. Tā ir jūsu paša sarunas atslēga — bez tās pēc lapas maiņas jūs neatrastu mūsu atbildi. Tas nesatur nekādu informāciju par jums un tiek izmantots tikai šim nolūkam.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Pārlūkprogrammā saglabā, vai esat piekritis balss ievades izmantošanai, lai piekrišana katrā apmeklējumā netiktu jautāta no jauna. Vērtība nepamet jūsu ierīci.",
          ],
        },
      ],
    },
    {
      heading: "Mobilās lietotnes sīkdatnes",
      paragraphs: [
        "Mobilā lietotne nedarbojas ar sīkdatnēm. Piekļuves un atjaunošanas marķieri tiek glabāti ierīces drošajā atslēgu krātuvē (iOS Keychain, Android Keystore) un dzēsti, izrakstoties.",
      ],
    },
    {
      heading: "Trešo pušu sīkdatnes",
      paragraphs: [
        "Ja veicat maksājumu, maksājumu pakalpojumu sniedzējs (Stripe vai PayPal) savā vietnē var uzstādīt sīkdatnes, kas nepieciešamas darījuma apstrādei un krāpšanas novēršanai. Tām piemēro attiecīgā pakalpojumu sniedzēja noteikumus.",
        "Tīmekļa vietnēs, ko uzņēmumi izveido, izmantojot mūsu vietņu veidotāju, par papildu sīkdatnēm lemj attiecīgais uzņēmums, un tas ir atbildīgs par tur sniegto informāciju.",
        "Tikai ar jūsu piekrišanu Google pakalpojumi šajā vietnē izmanto šādus sīkfailus — divus veiktspējas mērīšanai, vienu surogātpasta aizsardzībai. Bez jūsu piekrišanas attiecīgais skripts netiks ielādēts un neviens no šiem sīkfailiem netiks iestatīts; atsaucot piekrišanu, mēs tos dzēšam.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Reklāmas veiksmes mērīšana (nepieciešama piekrišana)",
          list: [
            "Mērķis: piesaista jūsu apmeklējumu reklāmai, lai mēs varētu novērtēt mūsu kampaņu panākumus.",
            "Saturs: nejauši ģenerēts identifikators; nav vārda, e-pasta vai konta informācijas no mums.",
            "Pakalpojumu sniedzējs: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Īrija.",
            "Resursdators: mynextdays.com (pirmās puses sīkfails, ko iestatījis Meta skripts). Derīguma termiņš: aptuveni trīs mēneši.",
          ],
        },
        {
          titel:
            "_gcl_au — Google Ads veiksmes mērīšana (nepieciešama piekrišana)",
          list: [
            "Mērķis: piesaista jūsu apmeklējumu Google reklāmai, lai mēs varētu novērtēt mūsu kampaņu panākumus.",
            "Saturs: nejauši ģenerēts identifikators bez saistības ar jūsu personu.",
            "Pakalpojumu sniedzējs: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Īrija.",
            "Resursdators: mynextdays.com (pirmās puses sīkfails). Derīguma termiņš: aptuveni trīs mēneši.",
          ],
        },
        {
          titel:
            "li_gc un bcookie — LinkedIn reklāma (nepieciešama piekrišana)",
          list: [
            "Mērķis: identificē jūsu pārlūkprogrammu LinkedIn, lai varētu piesaistīt reklāmas un to panākumus; li_gc papildus saglabā jūsu piekrišanu.",
            "Saturs: pārlūkprogrammas identifikators un piekrišanas statuss; nav informācijas no jūsu konta pie mums.",
            "Pakalpojumu sniedzējs: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Īrija.",
            "Resursdators: linkedin.com (trešo pušu sīkfaili). Derīguma termiņš: aptuveni seši mēneši vai viens gads.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Kontaktu veidlapas surogātpasta aizsardzība (nepieciešama piekrišana)",
          list: [
            "Resurss: www.google.com (trešās puses sīkfails).",
            "Mērķis: ļauj Google veikt riska novērtējumu, kas atšķir automatizētus masveida sūtījumus no reāliem pieprasījumiem.",
            "Saturs: Google ģenerēts identifikators šim novērtējumam; nav mūsu vārda, e-pasta vai konta informācijas.",
            "Pakalpojumu sniedzējs: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Īrija.",
            "Darbības ilgums: nosaka Google, līdz sešiem mēnešiem. Tas tiek iestatīts tikai tad, ja esat atļāvis surogātpasta aizsardzību un atvēris kontaktu veidlapu.",
          ],
        },
        {
          titel: "_ga — Auditorijas mērīšana (nepieciešama piekrišana)",
          list: [
            "Resurss: mynextdays.com (pirmās puses sīkfails, ko iestatījis Google skripts).",
            "Mērķis: atšķir apmeklētājus, lai atkārtoti apmeklējumi netiktu skaitīti divreiz.",
            "Saturs: nejauši ģenerēts identifikators bez saistības ar Jūsu personu; nav vārda, e-pasta vai konta informācijas.",
            "Piegādātājs: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Īrija.",
            "Darbības laiks: līdz diviem gadiem.",
          ],
        },
        {
          titel:
            "_ga_<ID> — Mērījumu sesijas statuss (nepieciešama piekrišana)",
          list: [
            "Resurss: mynextdays.com (pirmās puses sīkfails, ko iestatījis Google skripts).",
            "Mērķis: fiksē, kad sākās Jūsu pašreizējais apmeklējums, lai lapu skatījumi vienā sesijā piederētu kopā.",
            "Saturs: laika zīmogs un sesijas skaitītājs; ID nosaukumā apzīmē mūsu īpašumu, nevis Jūs.",
            "Piegādātājs: Google Ireland Limited.",
            "Darbības laiks: līdz diviem gadiem.",
          ],
        },
      ],
    },
    {
      heading: "Sīkdatņu dzēšana un pārvaldība",
      paragraphs: [
        "Sīkdatnes jebkurā laikā varat dzēst vai bloķēt savas pārlūkprogrammas iestatījumos. Bloķējot nepieciešamās sīkdatnes, pieteikšanās platformā tehniski nav iespējama — publiskā tīmekļa vietne un tirdzniecības vieta paliek lietojamas bez pieteikšanās.",
        "Izrakstoties, pieteikšanās sīkdatnes noņemam mēs paši.",
      ],
    },
    {
      heading: "Šīs politikas izmaiņas",
      paragraphs: [
        "Ja tiek pievienotas funkcijas, kurām nepieciešamas papildu sīkdatnes, mēs atjauninām šo sarakstu. Vienmēr ir spēkā šeit publicētā versija; datums augšā norāda atjaunināšanas laiku.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
