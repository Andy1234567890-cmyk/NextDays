import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partneru programma",
  description: "Iesakiet uzņēmumus, veidojiet komandu un nopelniet no abonēšanas ieņēmumiem.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Kā tas darbojas",
      articles: [
        {
          slug: "ueberblick",
          title: "Partneru programmas pārskats",
          excerpt: "Kas var piedalīties, kā rodas komisijas maksa un ko jūs redzat.",
          updated: "Statuss: 2026. gada septembris",
          body: [
            {
              type: "p",
              text: "Kā partneris jūs iesakāt myNextDays izīrētājiem, aģentūrām un viesnīcām. Ja uzņēmums reģistrējas ar jūsu kodu vai caur jūsu saiti un apmaksā savus abonēšanas rēķinus, jūs divpadsmit mēnešus saņemat daļu no neto abonēšanas ieņēmumiem. Maksājošo klientu līmenis ir redzams tiešraidē programmas lapā.",
            },
            { type: "h2", text: "Kas var kļūt par partneri" },
            {
              type: "ul",
              items: [
                "Personas un uzņēmumi ES, Šveicē vai Apvienotajā Karalistē ar reālu kanālu uzņēmējiem: ietekmētāji, konsultanti, aģentūras, nodokļu biroji, asociācijas.",
                "Arī paši myNextDays klienti — abonements nav priekšnoteikums.",
                "Obligāti pieteikumā: vismaz viens sociālo mediju konts (Instagram, TikTok, YouTube, Facebook, LinkedIn …) ar adresi, lietotājvārdu un sasniedzamību. Vietne vai jaunumu vēstule ir papildu priekšrocība.",
              ],
            },
            { type: "h2", text: "Kā uzņēmums tiek piesaistīts jums" },
            {
              type: "steps",
              items: [
                "Jūs kopīgojat savu saiti (mynextdays.com/p/JŪSU-KODS) vai savu kodu.",
                "Uzņēmums reģistrācijas laikā redz kodu laukā „Ieteica” un apstiprina to, nosūtot — bez sīkdatnes.",
                "Ar pirmo apmaksāto abonēšanas rēķinu sākas divpadsmit mēnešu periods.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jūs redzat savus klientus pseidonīmi (Klients #1, #2 …) ar valsti, statusu un summām — nekad vārdu vai e-pastu. Uzņēmums tiek piesaistīts tieši vienam partnerim; pirmais uzvar.",
            },
            { type: "h2", text: "Ko jūs atradīsiet informācijas panelī" },
            {
              type: "ul",
              items: [
                "Pārskats: rangs, klikšķi, reģistrētie un maksājošie uzņēmumi, atvērtās, izmaksājamās un izmaksātās komisijas maksas.",
                "Komisijas maksas: katrs apmaksātais abonēšanas rēķins kā rinda ar pamatu, likmi, summu un statusu.",
                "Izmaksas: katru mēnesi par katru valūtu, sākot no minimālās summas, ar kredītu (pašrēķins) kā pierādījumu.",
                "Saites un materiāli: jūsu kodi, reklāmas materiāli un obligātā marķēšana katrai valstij.",
                "Ziņas: tiešais saziņas kanāls ar partneru komandu.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Veidojiet komandu: komandas komisijas maksa",
          excerpt: "Piesaistiet partnerus, kuri pievienojas ar jūsu kodu — un nopelniet no viņu klientu ieņēmumiem.",
          updated: "Statuss: 2026. gada septembris",
          body: [
            {
              type: "p",
              text: "Jūs varat piesaistīt citus partnerus savai komandai. Ja kāds piesakās, izmantojot jūsu komandas saiti (mynextdays.com/p/JŪSU-KODS?team=1) un pieteikumā skaidri norāda jūsu kodu, viņš pēc apstiprināšanas piederēs jūsu komandai. No jūsu komandas partneru klientu neto abonēšanas ieņēmumiem jūs saņemat komandas komisijas maksu.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Komandas likme ir atkarīga no JŪSU ranga maksājuma brīdī — nevis no jūsu komandas lieluma. Likmes ir norādītas programmas lapā.",
                "Jūsu rangs veidojas tikai no jūsu pašu maksājošajiem klientiem. Komandas klienti netiek ieskaitīti rangā.",
                "Tieši viens līmenis: jūsu komandas partneri neveido savu komandu zem jums.",
                "Nav dalības maksas, nav naudas par partnera piesaistīšanu. Komandas komisijas maksa rodas tikai no apmaksātiem abonēšanas ieņēmumiem.",
                "Divpadsmit mēneši no attiecīgā komandas klienta pirmā apmaksātā rēķina, 30 dienu atmaksas periods, atcelšana atmaksas vai atgriešanas gadījumā — tāpat kā ar savu komisijas maksu.",
                "Komandas komisija tiek ģenerēta tikai tad, ja jūs un jūsu komandas partneris esat apstiprināti; pretējā gadījumā tā tiek apturēta.",
              ],
            },
            { type: "h2", text: "Komandas novērtējums" },
            {
              type: "p",
              text: "Sadaļā “Komanda” redzēsiet katru komandas partneri ar rangu, maksājošiem klientiem, viņu klientu abonēšanas ieņēmumiem (30 dienas un kopā) un jūsu komandas komisiju no tā — atvērtu, izmaksājamu, izmaksātu — kā arī pēdējo divpadsmit mēnešu vēsturi. Jūs neredzat savu komandas partneru klientu datus; tie pieder viņiem.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Izmantojot “Komanda”, jūs varat tieši sazināties ar saviem komandas partneriem, un jūsu sponsors var sazināties ar jums.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Vienāds e-pasta domēns vai vienādi bankas rekvizīti starp sponsoru un komandas partneri tiek atzīmēti un pārbaudīti partneru komandā, pirms tiek izmaksāta komandas komisija.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Izmaksa, kredīts un nodokļi",
          excerpt: "Kad komisija kļūst izmaksājama, kā izskatās kredīts un kas attiecas uz nodokļiem.",
          updated: "Statuss: 2026. gada septembris",
          body: [
            {
              type: "steps",
              items: [
                "Komisijas rinda tiek ģenerēta ar apmaksātu abonēšanas rēķinu un ir “atvērta” 30 dienas (atmaksas periods).",
                "Pēc tam tā ir izmaksājama. Katra mēneša pirmajā dienā mēs apkopojam visas izmaksājamās rindas katrā valūtā.",
                "Ja summa pārsniedz jūsu valūtas minimālo summu, tiek veikta izmaksa ar kredītu (pašrēķins). Jums nav jāizraksta rēķins.",
                "Pēc pārskaitījuma izmaksa tiek parādīta kā “Apmaksāta” ar atsauci informācijas panelī.",
              ],
            },
            {
              type: "ul",
              items: [
                "Uzņēmumi: Kredīts satur apgrieztās maksas piezīmi; priekšnoteikums ir apstiprināts PVN reģistrācijas numurs (VIES pārbaude).",
                "Privātpersonas: Kredīts neuzrāda PVN; komisija ir jāapliek ar nodokli pašam.",
                "Izmaksa ar SEPA, Wise vai PayPal — datus ievadiet profilā; izmaiņām nepieciešama jūsu parole.",
                "Nav konvertācijas: Komisija DKK tiek izmaksāta DKK, komisija EUR tiek izmaksāta EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklāmai jābūt atpazīstamai kā reklāmai — ieraksta sākumā, ieraksta valodā. Apstiprinātos formulējumus katrai valstij varat atrast sadaļā “Saites un materiāli”. Pārkāpumi var novest pie bloķēšanas.",
            },
          ],
        },
      ],
    },
  ],
};
