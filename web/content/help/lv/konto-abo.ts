import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konts un abonements",
  description: "Pamatdati, tarifs, drošība un 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konts",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Uzņēmuma pamatdati",
          excerpt: "Centralizēti uzturiet sava uzņēmuma nosaukumu, adresi un kontaktinformāciju.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Sadaļā /konto myNextDays apvieno visas uzņēmuma un konta funkcijas kā sadaļas vienā lapā — nav jāpārslēdzas starp daudzām apakšlapām. Uzņēmuma pamatdati ir šeit pamats: uzņēmuma nosaukums, juridiskā forma, adrese un kontaktinformācija, ko izmanto rēķiniem, portāliem un saziņai ar viesiem.",
            },
            { type: "h2", text: "Pamatdatu atvēršana un rediģēšana" },
            {
              type: "steps",
              items: [
                "Atveriet /konto.",
                "Pārejiet uz sadaļu „Uzņēmuma pamatdati“.",
                "Pārbaudiet uzņēmuma nosaukumu, adresi, tālruņa numuru un e-pasta adresi jautājumu gadījumam.",
                "Veiciet savas izmaiņas.",
                "Saglabājiet sadaļu.",
              ],
            },
            { type: "h2", text: "Kāpēc šie dati ir svarīgi" },
            {
              type: "p",
              text: "Uzņēmuma pamatdati tiek iekļauti rēķinos, reģistrācijā pie pievienotajiem portāliem un juridiski obligātajos datos, piemēram, tiešsaistes atklāšanas informācijā. Nepilnīga vai novecojusi adrese var izraisīt kļūdainu rēķinu izrakstīšanu vai portālu pieslēgumu kavēšanos.",
            },
            {
              type: "ul",
              items: [
                "Uzņēmuma nosaukums un juridiskā forma parādās visos izsniegtajos rēķinos.",
                "Adrese ir nepieciešama reģistrācijai pie portāliem.",
                "Kontaktinformācija kalpo kā rezerves kanāls, ja sistēmas paziņojumi nesasniedz mērķi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mainot rēķina adresi, pēc tam pārbaudiet jau izsniegtos rēķinus sadaļā [Norēķini un tarifu kalkulators](/hilfe/konto-abo/abrechnung-tarifrechner) — esošie dokumenti netiek pielāgoti ar atpakaļejošu spēku.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonements un tarifs",
          excerpt: "Jūsu tarifs nosaka objektu kvotu — rezervēto objektu skaitu redzat jebkurā laikā kontā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Jūsu myNextDays abonements ietver objektu kvotu: maksimālo skaitu objektu (numuru vai brīvdienu mājokļu), ko varat vienlaikus aktīvi pārvaldīt. Pašreiz rezervēto objektu skaitu redzat sadaļā „Abonements un tarifs“ /konto, kopā ar atlikušo kvotu.",
            },
            { type: "h2", text: "Kvotas uzraudzība" },
            {
              type: "p",
              text: "Kvota tiek noteikta servera pusē: sasniedzot jūsu tarifa augšējo robežu, nevar izveidot nevienu jaunu objektu, kamēr nedeaktivizējat esošu objektu vai nepaplašinat savu tarifu. Tas attiecas neatkarīgi no tā, vai jaunais objekts ir numurs vai brīvdienu mājoklis — abi vienādi tiek skaitīti kvotā.",
            },
            {
              type: "steps",
              items: [
                "Atveriet /konto un sadaļu „Abonements un tarifs“.",
                "Pārbaudiet rezervēto objektu skaitu attiecībā pret jūsu tarifa kvotu.",
                "Pēc vajadzības izvēlieties lielāku tarifu, lai izveidotu vairāk objektu.",
                "Apstipriniet tarifa maiņu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Katrs objekts atsevišķi tiek skaitīts kvotā, neatkarīgi no objekta tipa.",
                "Tarifa maiņa nekavējoties ietekmē pieejamo kvotu.",
                "Samazināšana iespējama tikai tad, ja aktīvo objektu skaits atbilst jaunajai kvotai.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Samazinājums uz tarifu ar mazāku kvotu tiek noraidīts, kamēr ir aktīvi vairāk objektu, nekā jaunais tarifs atļauj. Vispirms deaktivizējiet lieko objektu skaitu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detaļas par rēķiniem un tarifa aprēķinu lasiet sadaļā [Norēķini un tarifu kalkulators](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Norēķini un tarifu kalkulators",
          excerpt: "Rēķina adrese, iepriekšējie rēķini un tarifu kalkulators jūsu objektu kvotai.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Sadaļa „Norēķini un tarifu kalkulators“ /konto apvieno visu, kas saistīts ar rēķinu izrakstīšanu: jūsu rēķina adresi, iepriekšējo rēķinu sarakstu lejupielādei, kā arī tarifu kalkulatoru, ar kura palīdzību varat apzināties izmaksas savai pašreizējai vai lielākai objektu kvotai.",
            },
            { type: "h2", text: "Rēķina adrese un rēķini" },
            {
              type: "p",
              text: "Rēķina adrese var atšķirties no jūsu uzņēmuma adreses, piemēram, ja dokumentus saņem grāmatvedības birojs. Jau izsniegtos rēķinus atradīsiet hronoloģiski sakārtotus; katru var lejupielādēt kā PDF.",
            },
            { type: "h2", text: "Tarifu kalkulatora izmantošana" },
            {
              type: "steps",
              items: [
                "Atveriet /konto un sadaļu „Norēķini un tarifu kalkulators“.",
                "Tarifu kalkulatorā ievadiet vēlamo objektu skaitu.",
                "Salīdziniet izmaksas katram tarifa līmenim.",
                "Pēc vajadzības no kalkulatora pārejiet tieši uz atbilstošo tarifu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tarifu kalkulators rāda izmaksas jūsu kontam norādītajā valūtā.",
                "Rēķini pastāvīgi ir pieejami lejupielādei.",
                "Rēķina adresi var uzturēt neatkarīgi no uzņēmuma pamatdatiem.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ar tarifu kalkulatoru regulāri pārbaudiet, vai jūsu objektu kvota joprojām atbilst faktiski rezervēto objektu skaitam — skatiet [Abonements un tarifs](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Paroles un e-pasta maiņa",
          excerpt: "Drošībai kritiskas izmaiņas prasa atkārtotu pieteikšanos un apstiprinājuma soli.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Parole un e-pasta adrese ir vieni no jūsu konta drošības ziņā vissvarīgākajiem datiem. Tāpēc myNextDays abu izmaiņu gadījumā pieprasa atkārtotu autentifikāciju — izmaiņu apstiprināt ar pašreizējo paroli, pat ja jau esat pieteicies.",
            },
            { type: "h2", text: "Paroles maiņa" },
            {
              type: "steps",
              items: [
                "Atveriet /konto un sadaļu „Paroles un e-pasta maiņa“.",
                "Apstiprinājumam ievadiet savu pašreizējo paroli.",
                "Piešķiriet jauno paroli un atkārtojiet to.",
                "Saglabājiet izmaiņas.",
              ],
            },
            { type: "h2", text: "E-pasta adreses maiņa" },
            {
              type: "p",
              text: "E-pasta adreses maiņa notiek kā dubultā piekrišana: pēc pašreizējās paroles apstiprināšanas jūs saņemat apstiprinājuma saiti uz JAUNO adresi. Tikai noklikšķinot uz šīs saites, izmaiņas stājas spēkā — vecā adrese līdz tam paliek aktīva, lai piekļuve jūsu kontam nekad netiktu pārtraukta.",
            },
            {
              type: "ul",
              items: [
                "Bez pašreizējās paroles nevar mainīt ne paroli, ne e-pastu.",
                "Apstiprinājuma saite jaunajai e-pasta adresei ir derīga ierobežotu laiku.",
                "Līdz apstiprinājumam iepriekšējā e-pasta adrese paliek aktīva pieteikšanās un paziņojumu saņemšanai.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pēc e-pasta maiņas pārbaudiet arī divfaktoru autentifikāciju — skatiet [Divfaktoru autentifikācija](/hilfe/konto-abo/zwei-faktor) — ja atgūšanas kodi bija piesaistīti vecajai adresei.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Divfaktoru autentifikācija",
          excerpt: "Papildu pieteikšanās solis aizsargā jūsu kontu no nesankcionētas piekļuves.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Divfaktoru autentifikācija (2FA) papildina jūsu paroli ar otru faktoru, izmantojot autentifikatora lietotni. Tā vien nozagta parole vairs nepietiek, lai pieteiktos jūsu myNextDays kontā.",
            },
            { type: "h2", text: "2FA iestatīšana" },
            {
              type: "steps",
              items: [
                "Atveriet /konto un sadaļu „Divfaktoru autentifikācija“.",
                "Apstipriniet savu pašreizējo paroli atkārtotai autentifikācijai.",
                "Noskenējiet parādīto QR kodu ar autentifikatora lietotni.",
                "Ievadiet ģenerēto kodu apstiprinājumam.",
                "Saglabājiet parādītos atgūšanas kodus drošā vietā.",
              ],
            },
            { type: "h2", text: "2FA deaktivizēšana" },
            {
              type: "p",
              text: "Arī divfaktoru autentifikācijas deaktivizēšana prasa atkārtotu autentifikāciju ar jūsu pašreizējo paroli. Tā myNextDays novērš, ka kāds ar jau atvērtu sesiju vienkārši izslēdz jūsu aizsardzību.",
            },
            {
              type: "ul",
              items: [
                "Atgūšanas kodi ļauj piekļūt kontam, ja autentifikatora lietotne tiek pazaudēta.",
                "Katrs atgūšanas kods ir izmantojams tikai vienreiz.",
                "2FA ieslēgšana un izslēgšana vienādi prasa paroles apstiprinājumu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Glabājiet atgūšanas kodus atsevišķi no ierīces ar autentifikatora lietotni, piemēram, paroļu pārvaldniekā.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Ierīču vēsture",
          excerpt: "Sekojiet līdzi, no kurām ierīcēm jūsu konts ir pieteikts.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Ierīču vēsture /konto rāda, uz kurām ierīcēm jūsu konts pašlaik ir pieteikts — ar ierīces tipu, aptuveno atrašanās vietu un pēdējās aktivitātes laiku. Tā ātri atpazīsiet, vai pieteikšanās patiešām nāk no jums.",
            },
            { type: "h2", text: "Ierīču vēstures pārbaude" },
            {
              type: "steps",
              items: [
                "Atveriet /konto un sadaļu „Ierīču vēsture“.",
                "Apskatiet pieteikto ierīču sarakstu.",
                "Ja atpazīstat nezināmu ierīci, atslēdziet to.",
                "Pēc tam drošības apsvērumu dēļ nomainiet paroli.",
              ],
            },
            { type: "h2", text: "Kad ir vērts pārbaudīt" },
            {
              type: "p",
              text: "Pārbaudiet ierīču vēsturi īpaši pēc paroles vai e-pasta maiņas, kā arī pēc svešas vai publiskas ierīces izmantošanas. Nezināms ieraksts ir skaidrs brīdinājuma signāls par nesankcionētu piekļuvi.",
            },
            {
              type: "ul",
              items: [
                "Katrs ieraksts rāda ierīces tipu, aptuveno atrašanās vietu un pēdējo aktivitāti.",
                "Atsevišķas ierīces var mērķtiecīgi atslēgt, neietekmējot citas.",
                "Neatpazīta ierīce ir iemesls nekavējoties nomainīt paroli.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ja neatpazīstat ierīci, nekavējoties to atslēdziet un pēc tam nomainiet paroli sadaļā [Paroles un e-pasta maiņa](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Datu aizsardzība",
          excerpt: "Pārvaldiet meklētājprogrammu indeksēšanu katram objektam un eksportējiet savus datus.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Sadaļā „Datu aizsardzība“ /konto pārvaldāt divas lietas: vai jūsu objektu lapas drīkst indeksēt meklētājprogrammas un kā eksportēt savus myNextDays saglabātos datus.",
            },
            { type: "h2", text: "Meklētājprogrammu indeksēšana katram objektam" },
            {
              type: "p",
              text: "Pēc noklusējuma jauniem objektiem meklētājprogrammu indeksēšana ir deaktivizēta. Tikai tad, kad to apzināti ieslēdzat katram objektam, meklētājprogrammas, piemēram, Google, drīkst iekļaut publisko objekta lapu savā indeksā. Tā saglabājat kontroli pār to, kuri objekti ir atrodami ārpus portāliem un pašu platformas.",
            },
            {
              type: "steps",
              items: [
                "Atveriet /konto un sadaļu „Datu aizsardzība“.",
                "No saraksta izvēlieties vēlamo objektu.",
                "Ieslēdziet vai izslēdziet meklētājprogrammu indeksēšanu.",
                "Ja objektu vairāk, izmantojiet kopīgo slēdzi, lai vienoti iestatītu visus objektus.",
              ],
            },
            { type: "h2", text: "Datu eksportēšana" },
            {
              type: "p",
              text: "Izmantojot datu eksporta funkciju, pieprasāt pilnu kopiju no jūsu kontā saglabātajiem datiem. Eksports tiek sagatavots un pēc tam jums nodots lejupielādei.",
            },
            {
              type: "ul",
              items: [
                "Indeksēšanu var pārvaldīt atsevišķi katram objektam, ar kopīgo slēdzi visiem objektiem.",
                "Jauni objekti principā sākas bez meklētājprogrammu indeksēšanas.",
                "Datu eksports satur jūsu konta un objektu datus strukturētā formā.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Meklētājprogrammu indeksēšana nav atkarīga no redzamības portālos un pašu tirgū — tā attiecas tikai uz publisko objekta lapu meklētājprogrammās.",
            },
          ],
        },
      ],
    },
  ],
};
