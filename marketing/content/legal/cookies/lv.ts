// Lettische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Sīkdatņu politika",
  metaDescription:
    "Kādas sīkdatnes izmanto myNextDays: tikai tehniski nepieciešamas un funkcionālas sīkdatnes, bez izsekošanas vai reklāmas sīkdatnēm.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Šī politika paskaidro, kādas sīkdatnes un līdzīgas datu glabāšanas tehnoloģijas ${ANBIETER.firma} izmanto šajā tīmekļa vietnē un myNextDays platformā.`,
    "Īsumā: mēs izmantojam tikai tehniski nepieciešamas un funkcionālas sīkdatnes. Nav analītisko, reklāmas vai izsekošanas sīkdatņu, un lietošanas dati netiek nodoti reklāmas tīkliem.",
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
        "Piekrišana jums jādod tikai vienā jautājumā: mūsu kontaktformas aizsardzībai pret surogātpastu. To nodrošina Google (reCAPTCHA Enterprise), tātad tas ir ārējs pakalpojums, un tas tiek ielādēts tikai tad, ja esat to atļāvis. Šim nolūkam pirmajā apmeklējumā ekrāna apakšā parādās josla ar vienlīdzīgas nozīmes pogām „Noraidīt“ un „Piekrist“ un bez iepriekšējas atlases. Kamēr neesat izlēmis, spēkā ir „nav atļauts“.",
        "Jūsu izvēle tiek saglabāta jūsu pārlūkprogrammas krātuvē (Local Storage, vērtība „nd_consent“); tā satur tikai kategoriju, laiku un versijas numuru, bez jūsu personas identifikatora. Šīs lapas beigās to jebkurā laikā varat mainīt vai atsaukt.",
      ],
    },
    {
      heading: "Šī tīmekļa vietne",
      paragraphs: [
        "Mārketinga tīmekļa vietne neuzstāda sīkdatnes. Fonti un ikonas atrodas mūsu pašu serverī — tāpēc netiek izmantots neviens trešās puses fontu vai ikonu pakalpojums. Vienīgais šīs vietnes ārējais pakalpojums ir kontaktformas aizsardzība pret surogātpastu, kas tiek ielādēta tikai ar jūsu piekrišanu. Sīkāka informācija ir pieejama [Privātuma politikā](/datenschutz).",
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
          titel: "sb-… — Pieteikšanās ar Google (tehniski nepieciešama, tikai lietošanas gadījumā)",
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
            "Saglabā jūsu izvēli par kontaktformas aizsardzību pret surogātpastu, lai piekrišanas josla katrā apmeklējumā nejautātu no jauna. Tiek saglabāta tikai kategorija, laiks un versijas numurs. Vērtība nepamet jūsu ierīci un netiek pārsūtīta uz mūsu serveri; tā attiecas uz šo pārlūkprogrammu. To dzēšot, josla nākamajā apmeklējumā jautās atkal.",
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
