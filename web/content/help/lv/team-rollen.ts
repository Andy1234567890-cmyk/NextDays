import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Komanda un tiesības",
  description: "Darbinieki, lomas un piekļuves tiesības.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Piekļuve",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Darbinieka uzaicināšana",
          excerpt: "Kā uzaicināt jaunus darbiniekus uz savu myNextDays kontu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Uz savu uzņēmumu varat uzaicināt jebkādu skaitu darbinieku — piemēram, reģistratūrai, uzkopšanai vai administrācijai. Katrs uzaicinājums ir piesaistīts e-pasta adresei un nekavējoties piešķir fiksētu lomu, kas nosaka piekļuvi tīmeklī un myNextDays lietotnē.",
            },
            { type: "h2", text: "Uzaicinājuma nosūtīšana" },
            {
              type: "steps",
              items: [
                "Atveriet „Konts“ un pārejiet uz sadaļu „Komanda“.",
                "Noklikšķiniet uz „Uzaicināt darbinieku“.",
                "Ievadiet personas e-pasta adresi.",
                "Izvēlieties atbilstošo lomu, piem., darbinieks vai uzkopšana.",
                "Apstipriniet uzaicinājumu.",
              ],
            },
            { type: "h2", text: "Kas notiek pēc tam" },
            {
              type: "p",
              text: "Uzaicinātā persona saņem e-pastu ar saiti, lai iestatītu savu paroli un pieteiktos. Pieteikšanās attiecas vienādi gan uz tīmekļa vadības paneli, gan myNextDays lietotni — nav atsevišķa konta katram frontendam.",
            },
            {
              type: "ul",
              items: [
                "Uzaicinājums ir spēkā, kamēr tas nav pieņemts vai atsaukts.",
                "Atklātos uzaicinājumus redzat sadaļā „Komanda“ ar statusu „Gaidāms“.",
                "Lomu jebkurā laikā var vēlāk pielāgot.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kura loma kurus apgabalus var redzēt, uzziniet sadaļā [Lomas un tiesības](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "No paša sākuma piešķiriet vismazāko piemēroto lomu — tiesības jebkurā laikā var vēlāk paplašināt.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Lomas un tiesības",
          excerpt: "Piecas lomas myNextDays un ko tās katra drīkst.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays izšķir piecas lomas: administrators, koadministrators, darbinieks, uzkopšana un īpašnieks. Katra loma nosaka, kuri apgabali ir redzami tīmekļa vadības panelī un myNextDays lietotnē — tiesības tiek noteiktas servera pusē, nevis tikai paslēptas saskarnē.",
            },
            { type: "h2", text: "Lomu pārskats" },
            {
              type: "ul",
              items: [
                "Administrators: pilna piekļuve visiem apgabaliem, ieskaitot finanses, pārdošanu un komandas pārvaldību.",
                "Koadministrators: gandrīz pilna piekļuve kā administratoram, otrajam uzņēmuma vadības līmenim.",
                "Darbinieks: operatīva piekļuve rezervācijām, kalendāram un uzdevumiem, bez ieskata finansēs vai pārdošanā.",
                "Uzkopšana: tikai piekļuve piešķirtajiem uzkopšanas uzdevumiem un objektu detaļām, bez ieskata finansēs vai pārdošanā.",
                "Īpašnieks: tikai lasāms ieskats savos objektos, bez svešu objektu pārvaldības.",
              ],
            },
            { type: "h2", text: "Lomas piešķiršana vai maiņa" },
            {
              type: "steps",
              items: [
                "Atveriet „Konts“ → „Komanda“.",
                "Izvēlieties attiecīgo darbinieku no saraksta.",
                "Noklikšķiniet uz „Mainīt lomu“.",
                "Izvēlieties jauno lomu un apstipriniet.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Darbinieki un uzkopšana principā neredz cenas, apgrozījumus vai rezervāciju kanālus — šis izslēgums darbojas servera pusē un to nevar apiet caur saskarni.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pārskatu par katru lomu atradīsiet sadaļā [Ko redz katra loma](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Ko redz katra loma",
          excerpt: "Konkrēti apgabali un skati katrai lomai tīmeklī un lietotnē.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Papildus pamattiesībām no [Lomas un tiesības](/hilfe/team-rollen/rollen-berechtigungen), konkrēts skatījums uz atsevišķiem apgabaliem palīdz jums pareizi noteikt gaidas, uzņemot jaunus darbiniekus.",
            },
            { type: "h2", text: "Kalendārs un rezervācijas" },
            {
              type: "p",
              text: "Administrators, koadministrators un darbinieks redz pilnu aizņemtības plānu ar viesu datiem un uzdevumiem. Uzkopšana redz tikai viņai piešķirtos termiņus kopā ar objekta adresi un kontrolsarakstu, bet nevis viesu vārdus vai cenas. Īpašnieki redz aizņemtības kalendāru tikai saviem objektiem, tikai lasāmā formā.",
            },
            { type: "h2", text: "Finanses un pārdošana" },
            {
              type: "ul",
              items: [
                "Apgrozījumi, komisijas un rēķini: tikai administrators un koadministrators.",
                "Portāli (OTA piesaiste) un platformas redzamība: tikai administrators un koadministrators.",
                "Darbinieks un uzkopšana: bez piekļuves finanšu vai pārdošanas apgabaliem, arī ne detalizētajām lapām.",
              ],
            },
            { type: "h2", text: "Komanda un iestatījumi" },
            {
              type: "p",
              text: "Darbinieku, lomu un konta iestatījumu pārvaldība paliek tikai administratoram un koadministratoram. Īpašnieki un operatīvās lomas šo apgabalu myNextDays lietotnē un tīmekļa vadības panelī vispār neredz.",
            },
            {
              type: "note",
              variant: "info",
              text: "Šis sadalījums ir identisks gan tīmekļa vadības panelī, gan myNextDays lietotnē, jo abi frontendi izmanto to pašu lomu no jūsu konta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pēc uzaicinājuma īsi kopā ar darbinieku pārbaudiet jauno lomu, lai izvairītos no pārpratumiem par redzamajiem apgabaliem.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Piekļuves atņemšana",
          excerpt: "Nekavējoties un pilnībā noņemiet darbinieka piekļuvi.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Ja darbinieks pamet jūsu uzņēmumu vai mainās sadarbība, piekļuvi noņemiet tieši kontā. Atņemšana darbojas servera pusē un nekavējoties — nevis tikai pēc esošas sesijas beigām.",
            },
            { type: "h2", text: "Piekļuves noņemšana" },
            {
              type: "steps",
              items: [
                "Atveriet „Konts“ → „Komanda“.",
                "Izvēlieties attiecīgo darbinieku.",
                "Noklikšķiniet uz „Atņemt piekļuvi“.",
                "Apstipriniet darbību.",
              ],
            },
            { type: "h2", text: "Ietekme uz notiekošām sesijām" },
            {
              type: "p",
              text: "Pēc atņemšanas persona vairs nevar no jauna pieteikties ne tīmekļa vadības panelī, ne myNextDays lietotnē. Jau piešķirtos uzdevumus vai uzkopšanas termiņus pirms tam jāpiešķir citam darbiniekam, lai nekas nepaliktu neapstrādāts.",
            },
            {
              type: "ul",
              items: [
                "Pirms atņemšanas no jauna piešķiriet atklātos uzdevumus.",
                "Piekļuvi vēlāk var atkal atjaunot, izmantojot uzaicinājumu.",
                "Atņemšana attiecas tikai uz šo uzņēmumu, ne uz citiem personas kontiem.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Atņemiet piekļuvi savlaicīgi, tiklīdz sadarbība beidzas — atklāti darbinieku konti pretējā gadījumā paliek nevajadzīgs drošības risks.",
            },
          ],
        },
      ],
    },
  ],
};
