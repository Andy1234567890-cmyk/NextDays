import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilā lietotne",
  description: "myNextDays lietotne ceļā.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Lietotne",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays lietotne",
          excerpt: "Viens konts, četras pieredzes: viesis, aģentūra, īpašnieks un darbinieks.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays lietotne ir mobilā platforma jūsu visam uzņēmumam. Tas nav atsevišķs produkts, bet gan vienlīdzīgs frontends jūsu tīmekļa vadības panelim — abi izmanto to pašu kontu un tos pašus datus, tikai saskarne ir optimizēta lietošanai ceļā.",
            },
            { type: "h2", text: "Četras pieredzes vienā lietotnē" },
            {
              type: "ul",
              items: [
                "Viesis: skatīt rezervācijas, sazināties ar uzņēmumu, saņemt check-in informāciju.",
                "Aģentūra: pārvaldīt vairākus uzņēmumus un objektus vienuviet.",
                "Īpašnieks: tikai lasāms ieskats savos objektos, aizņemtībā un pārskatos.",
                "Darbinieks: kalendārs, uzdevumi un uzkopšanas plāni ikdienas darbam.",
              ],
            },
            { type: "h2", text: "Kuru pieredzi jūs redzat" },
            {
              type: "p",
              text: "Pēc pieteikšanās lietotne automātiski rāda jūsu lomai atbilstošu pieredzi — to pašu lomu, kas darbojas arī tīmekļa vadības panelī. Darbinieks ar ierobežotām tiesībām lietotnē redz tieši tos pašus ierobežojumus, kas pārlūkā, jo tiesības tiek pārbaudītas servera pusē.",
            },
            {
              type: "note",
              variant: "info",
              text: "Vairāk par lomām un to, ko katra drīkst redzēt, lasiet sadaļā [Lomas un tiesības](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Lietotnei nav vajadzīga atsevišķa reģistrācija — vienkārši piesakieties ar saviem esošajiem myNextDays piekļuves datiem.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Lietotnes instalēšana un pieteikšanās",
          excerpt: "Kā lejupielādēt myNextDays lietotni un pieteikties.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays lietotne ir pieejama iOS un Android sistēmām. Pieteikšanās notiek ar tiem pašiem piekļuves datiem, kas tīmekļa vadības panelī — nav vajadzīgs atsevišķs konts vai atkārtota reģistrācija.",
            },
            { type: "h2", text: "Instalēšana" },
            {
              type: "steps",
              items: [
                "Atveriet App Store (iOS) vai Google Play (Android).",
                "Meklējiet „myNextDays“.",
                "Instalējiet lietotni savā viedtālrunī vai planšetē.",
                "Pēc instalēšanas atveriet lietotni.",
              ],
            },
            { type: "h2", text: "Pieteikšanās" },
            {
              type: "steps",
              items: [
                "Pieskarieties „Pieteikties“.",
                "Ievadiet savu e-pasta adresi un paroli.",
                "Ja nepieciešams, apstipriniet divfaktoru pieprasījumu.",
                "Automātiski nonāksiet jūsu lomai atbilstošajā pieredzē.",
              ],
            },
            {
              type: "ul",
              items: [
                "Piekļuves dati ir identiski ar tīmekļa vadības paneli.",
                "Ja jūsu piekļuve ir atņemta, arī pieteikšanās lietotnē nekavējoties tiek bloķēta.",
                "Ja rodas problēmas ar paroli, izmantojiet „Aizmirsu paroli“ tieši lietotnē.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Piesakieties tikai caur oficiālo App Store ierakstu „myNextDays“; lietotne nekad nepieprasa piekļuves datus ārpus pieteikšanās ekrāna.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Pārvaldība ceļā",
          excerpt: "Apstrādājiet rezervācijas, ziņas un uzdevumus tieši no viedtālruņa.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays lietotne īpaši piemērota darbībai ceļā: redzat aktuālās rezervācijas, atbildat uz viesu ziņām un izpildāt uzdevumus, nesēžot pie datora — izmaiņas reāllaikā parādās arī tīmekļa vadības panelī.",
            },
            { type: "h2", text: "Rezervācijas kontrolē" },
            {
              type: "p",
              text: "Sadaļā „Rezervācijas“ redzat ierašanās un izbraukšanas laikus, ietilpību un statusu katram objektam. Darbinieks un uzkopšana redz tikai viņiem svarīgo informāciju, bez cenām vai pārdošanas detaļām.",
            },
            { type: "h2", text: "Ziņas un uzdevumi" },
            {
              type: "steps",
              items: [
                "Atveriet sadaļu „Ziņas“, lai tieši atbildētu uz viesu pieprasījumiem.",
                "Pārejiet uz „Uzdevumi“, lai redzētu sev piešķirtos veicamos darbus.",
                "Pieskarieties uzdevumam, lai atvērtu detaļas un to pabeigtu.",
                "Atzīmējiet pabeigtos uzkopšanas termiņus tieši uz vietas kā izpildītus.",
              ],
            },
            {
              type: "ul",
              items: [
                "Jaunas ziņas un uzdevumi parādās reāllaikā, bez manuālas atjaunināšanas.",
                "Pabeigtie uzdevumi nekavējoties redzami arī tīmekļa vadības panelī.",
                "Īpašnieki redz savu objektu rezervācijas un pārskatus, taču tikai lasāmā formā.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push paziņojumi jūs informē par jaunām ziņām un piešķirtiem uzdevumiem, tiklīdz tos atļaujat ierīces iestatījumos.",
            },
          ],
        },
      ],
    },
  ],
};
