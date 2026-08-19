import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Īpašnieki un norēķini",
  description: "Īpašnieku konti, norēķini un komisijas.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Īpašnieki",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Īpašnieka izveide",
          excerpt: "Kā izveidot jaunu īpašnieka kontu myNextDays.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Īpašnieki ir savi konti myNextDays, ar kuru palīdzību pārvaldāt objektus, kas pieder noteiktai personai vai uzņēmumam. Īpašnieka konts saņem ierobežotu, tikai lasāmu ieskatu savos objektos, pats neveicot izmaiņas uzņēmumā.",
            },
            { type: "h2", text: "Jauna īpašnieka konta izveide" },
            {
              type: "steps",
              items: [
                "Galvenajā izvēlnē atveriet sadaļu „Īpašnieki“.",
                "Noklikšķiniet uz „Izveidot jaunu īpašnieku“.",
                "Ievadiet vārdu, e-pasta adresi un kontaktinformāciju.",
                "Ja nepieciešams, norādiet rēķina adresi norēķiniem.",
                "Saglabājiet kontu.",
              ],
            },
            { type: "h2", text: "Piekļuves iestatīšana" },
            {
              type: "p",
              text: "Pēc izveides varat īpašniekam nosūtīt ielūgumu uz savu piekļuvi. Īpašnieks pēc tam piesakās ar saviem piekļuves datiem un redz tikai viņam piesaistītos objektus.",
            },
            {
              type: "ul",
              items: [
                "Īpašnieka kontā var būt vairāki objekti.",
                "Katrs objekts pieder tieši vienam īpašniekam.",
                "Kontaktinformāciju un rēķina adresi jebkurā laikā var vēlāk pielāgot.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kā piesaistīt esošu objektu īpašniekam, lasiet sadaļā [Objekta piesaiste īpašniekam](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Objekta piesaiste īpašniekam",
          excerpt: "Katrs objekts pieder tieši vienam īpašniekam — šādi iestatāt piesaisti.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays katrs objekts pieder tieši vienam īpašniekam. Vairākkārtēja piesaiste nav paredzēta — ja objektam jāpieder citam īpašniekam, vispirms atceliet esošo piesaisti, pirms iestatāt jaunu.",
            },
            { type: "h2", text: "Piesaistes veikšana" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā „Objekti“.",
                "Pārejiet uz cilni „Īpašnieks“.",
                "No saraksta izvēlieties atbildīgo īpašnieku.",
                "Apstipriniet piesaisti.",
                "Saglabājiet izmaiņas objektā.",
              ],
            },
            { type: "h2", text: "Īpašnieka maiņa" },
            {
              type: "p",
              text: "Ja objekta īpašnieks mainās, piemēram, pārdošanas dēļ, esošo piesaisti aizstājiet ar jauno. Jau izveidotie norēķini par pagājušajiem periodiem paliek piesaistīti sākotnējam īpašniekam.",
            },
            {
              type: "ul",
              items: [
                "Objektu jebkurā brīdī var piesaistīt tikai vienam īpašniekam.",
                "Bez piesaistes objekts nav redzams nevienā īpašnieka piekļuvē.",
                "Pagājušie norēķini paliek pie sākotnējā īpašnieka.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Objekta vairākkārtēja piesaiste vairākiem īpašniekiem nav iespējama — sistēma neļauj otru vienlaicīgu piesaisti.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Īpašnieka norēķins (Statement)",
          excerpt: "Kā izveidot statement ar ieņēmumiem, atskaitot komisiju, īpašniekam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Īpašnieka norēķins, saukts arī par statement, izvēlētajam periodam apkopo visus piesaistīto objektu ieņēmumus un atskaita jūsu norunāto komisiju. Rezultāts ir summa, ko izmaksājat īpašniekam.",
            },
            { type: "h2", text: "Statement izveide" },
            {
              type: "steps",
              items: [
                "Atveriet sadaļu „Īpašnieki“ un izvēlieties vēlamo īpašnieku.",
                "Pārejiet uz cilni „Norēķins“.",
                "Izvēlieties norēķinu periodu.",
                "Pārbaudiet norādītās rezervācijas un ieņēmumus par katru objektu.",
                "Ļaujiet izveidot statement ar atskaitīto komisiju.",
              ],
            },
            { type: "h2", text: "Statement uzbūve" },
            {
              type: "p",
              text: "Statement katram objektam norāda bruto ieņēmumus no rezervācijām, no tiem atskaitīto komisiju un izrietošo izmaksas summu. Papildu izmaksas, piemēram, uzkopšana vai maksas, atkarībā no vienošanās var norādīt atsevišķi.",
            },
            {
              type: "ul",
              items: [
                "Bruto ieņēmumi: visu rezervāciju summa periodā par katru objektu.",
                "Komisija: jūsu norunātā daļa, tiek atskaitīta no ieņēmumiem.",
                "Izmaksas summa: ieņēmumi mīnus komisija un, ja piemērojams, citas pozīcijas.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Summas statement vienmēr tiek norādītas objekta valūtā — nav vienotas valūtas noklusējuma vērtības.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Izveidojiet statement regulāri tajā pašā datumā, lai īpašniekiem būtu uzticams ritms viņu izmaksām.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Īpašnieka piekļuve",
          excerpt: "Ko īpašnieki var redzēt savā tikai lasāmajā piekļuvē.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Īpašnieka piekļuve ir sava, tikai lasāma pieslēgšanās myNextDays. Īpašnieki tajā redz tikai viņiem piesaistītos objektus, kā arī ar tiem saistīto aizņemtību un norēķinus — bez iespējas paši mainīt iestatījumus.",
            },
            { type: "h2", text: "Ko īpašnieki redz" },
            {
              type: "ul",
              items: [
                "Savu objektu aizņemtības kalendāru.",
                "Izveidotos statement ar ieņēmumiem un atskaitīto komisiju.",
                "Savu objektu pamatdatus, piemēram, aprīkojumu un aprakstu.",
              ],
            },
            { type: "h2", text: "Piekļuves aktivizēšana" },
            {
              type: "steps",
              items: [
                "Atveriet īpašnieku sadaļā „Īpašnieki“.",
                "Noklikšķiniet uz „Uzaicināt piekļuvei“.",
                "Īpašnieks saņem e-pastu savas paroles iestatīšanai.",
                "Pēc pieteikšanās īpašnieks automātiski redz tikai viņam piesaistītos objektus.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Īpašnieka piekļuve ir stingri tikai lasāma: cenas, pieejamību vai objektu datus var mainīt tikai jūs kā uzņēmums, nevis pats īpašnieks.",
            },
            {
              type: "note",
              variant: "info",
              text: "Vairāk par objektu piesaisti lasiet sadaļā [Objekta piesaiste īpašniekam](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
