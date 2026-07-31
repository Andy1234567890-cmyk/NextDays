import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Pirmie soļi",
  description: "Iestatiet kontu un sāciet darbu dažu minūšu laikā.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Iestatīšana",
      articles: [
        {
          slug: "willkommen",
          title: "Laipni lūdzam myNextDays",
          excerpt: "Pārskats par PMS, kanālu pārvaldnieku, tirgu un lietotni.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays ir jūsu centrālā platforma brīvdienu mājokļiem un viesnīcām. Tā vietā, lai izmantotu vairākus atsevišķus risinājumus, jūs pārvaldāt pieejamību, cenas, rezervācijas un saziņu ar viesiem vienā vietā — neatkarīgi no tā, vai jums pieder viena brīvdienu māja vai vairāki viesnīcas numuri.",
            },
            { type: "h2", text: "Četri pamatelementi" },
            {
              type: "ul",
              items: [
                "PMS (īpašumu pārvaldības sistēma): objekti, kalendārs, cenas, rezervācijas, uzdevumi un maksājumi.",
                "Kanālu pārvaldnieks: savienojums ar portāliem, piemēram, Booking, Airbnb un citiem — viena ievade, daudzi portāli sinhroni.",
                "Platformas tirgus: pašu myBestDays tirgus, vienlīdzīgs rezervāciju kanāls blakus portāliem.",
                "Lietotne: mobilā lietojumprogramma viesiem, īpašniekiem un darbiniekiem ar tiem pašiem datiem, kas tīmeklī.",
              ],
            },
            { type: "h2", text: "Kā elementi mijiedarbojas" },
            {
              type: "p",
              text: "Objektu, cenas un pieejamību uzturat vienuviet, centralizēti PMS. No turienes myNextDays automātiski izplata datus visiem aktīvajiem kanāliem. Rezervācija — neatkarīgi no tā, caur kuru kanālu tā ienāk — nekavējoties bloķē attiecīgās naktis visur, tāpēc dubultrezervācijas nav iespējamas.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sāciet ar konta un uzņēmuma iestatīšanu, tad izveidojiet savu pirmo objektu — šī secība vēlāk ietaupīs labošanas darbu.",
            },
            { type: "h2", text: "Nākamie soļi" },
            {
              type: "steps",
              items: [
                "Izvēlnē atveriet Konts un papildiniet sava uzņēmuma datus.",
                "Sadaļā Objekti izveidojiet savu pirmo objektu.",
                "Pārbaudiet, vai ir aizpildīti visi dati — aprīkojums, fotogrāfijas un cenas.",
                "Noklikšķiniet uz Publicēt, lai objektu padarītu redzamu visos kanālos.",
              ],
            },
            {
              type: "p",
              text: "Vairāk par katru soli lasiet sadaļās [Konta un uzņēmuma iestatīšana](/hilfe/erste-schritte/konto-einrichten) un [Jūsu pirmā objekta izveide](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Konta un uzņēmuma iestatīšana",
          excerpt: "Pareizi norādiet pamatdatus, rēķina adresi un valūtu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Pirms objektu izveides iestatiet savu uzņēmumu kontā. Šie dati ir nepieciešami rēķiniem, portāliem un norēķiniem ar myNextDays, tāpēc tiem jābūt pilnīgiem un pareiziem.",
            },
            { type: "h2", text: "Pamatdatu norādīšana" },
            {
              type: "steps",
              items: [
                "Izvēlnē atveriet Konts.",
                "Sadaļā Pamatdati norādiet uzņēmuma nosaukumu vai individuālā komersanta vārdu, adresi un kontaktinformāciju.",
                "Norādiet rēķina adresi — tā parādīsies uz visiem izsniegtajiem rēķiniem.",
                "Izvēlieties savu bāzes valūtu. Tā attiecas uz visām cenām, kamēr to mērķtiecīgi nemaināt katram objektam atsevišķi.",
              ],
            },
            { type: "h2", text: "Kāpēc valūta ir svarīga" },
            {
              type: "p",
              text: "Valūta netiek uzminēta vai papildināta automātiski: ja tās nav, nevienu cenu nevar pareizi parādīt vai norēķināt. Tāpēc myNextDays iestatīšanas laikā pieprasa apzinātu izvēli, nevis piemēro noklusējuma vērtību.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ja vēlāk mainīsiet objekta valūtu, mainīsies arī visi ar to saistītie cenu plāni. Pēc tam vienreiz pārbaudiet cenas.",
            },
            { type: "h2", text: "Rēķina adrese un norēķini" },
            {
              type: "p",
              text: "Kontā, sadaļā Norēķini, redzat savus aktuālos rēķinus un norādīto rēķina adresi. Uzturiet tos aktuālus, jo īpaši mainoties uzņēmuma juridiskajai formai vai adresei, lai rēķini tiktu izsniegti pareizi.",
            },
            {
              type: "ul",
              items: [
                "Uzņēmuma nosaukums vai individuālā komersanta vārds",
                "Rēķina adrese ar valsti",
                "Nodokļu vai PVN maksātāja numurs, ja tāds ir",
                "Bāzes valūta jauniem objektiem",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Jūsu pirmā objekta izveide",
          excerpt: "Soli pa solim, kā izveidot savu pirmo rezervējamo objektu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Objekts myNextDays vienmēr ir tieši viena rezervējama vienība: vai nu viens numurs viesnīcā, vai pilns brīvdienu mājoklis. Ja pārvaldāt viesnīcu ar vairākiem numuriem, katram numuram izveidojiet atsevišķu objektu.",
            },
            { type: "h2", text: "Objekta izveide" },
            {
              type: "steps",
              items: [
                "Izvēlnē atveriet Objekti.",
                "Noklikšķiniet uz Pievienot objektu.",
                "Izvēlieties objekta tipu: kategoriju, nekustamā īpašuma tipu un piedāvājuma veidu.",
                "Papildiniet adresi, ietilpību un bāzes cenu savā norādītajā valūtā.",
                "Saglabājiet objektu kā melnrakstu, lai vēlāk to pabeigtu.",
              ],
            },
            { type: "h2", text: "Kas vēl trūkst pēc tam" },
            {
              type: "p",
              text: "Tikko izveidots objekts sākotnēji ir melnraksts un nav redzams nevienā kanālā. Pirms publicēšanas papildiniet aprīkojumu, fotogrāfijas, aprakstu un kalendāra pieejamību — tikai pilnīgu objektu var uzticami tirgot.",
            },
            {
              type: "ul",
              items: [
                "Izvēlēties aprīkojuma pazīmes no kategorijas saraksta",
                "Norādīt vismaz vienu titulfoto un aprakstu",
                "Pareizi ievadīt ietilpību (pieaugušie, bērni, gultas)",
                "Pārbaudīt bāzes cenu un kalendāra pieejamību",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ja pārvaldāt vairākus numuru tipus, atkārtojiet šo procesu katram atsevišķam numuram — nav pārējas ēkas līmeņa ar numuriem zem tā.",
            },
            {
              type: "p",
              text: "Kad visi obligātie lauki ir aizpildīti, varat publicēt objektu, skatiet [Objekta publicēšana](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Objekta publicēšana",
          excerpt: "Viens klikšķis vienlaikus aktivizē platformas tirgu, portālus un vietni.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Publicēšana padara objektu redzamu un rezervējamu. Parasti pietiek ar vienu klikšķi, lai vienlaikus aktivizētu visus trīs pārdošanas kanālus — taču redzamību katram kanālam varat jebkurā laikā pielāgot atsevišķi.",
            },
            { type: "h2", text: "Kā publicēt" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā Objekti.",
                "Cilnē Pārskats pārbaudiet, vai visi obligātie dati ir atzīmēti zaļi.",
                "Noklikšķiniet uz Publicēt.",
                "Apstipriniet dialoglodziņu — tiks aktivizēts platformas tirgus, portāli un vietne.",
              ],
            },
            { type: "h2", text: "Kanālu pārvaldība atsevišķi" },
            {
              type: "p",
              text: "Pēc publicēšanas cilnē Redzamība atradīsiet trīs atsevišķus slēdžus: vietne, platformas tirgus un portāli. Ja, piemēram, vēlaties piedāvāt objektu tikai savā vietnē, bet ne caur portāliem, vienkārši izslēdziet attiecīgo slēdzi.",
            },
            {
              type: "ul",
              items: [
                "Vietne: redzamība jūsu pašu myNextDays vietnē",
                "Platformas tirgus: redzamība globālajā myBestDays tirgū",
                "Portāli: redzamība Booking, Airbnb un citos",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Šie trīs slēdži nav atkarīgi no objekta statusa (aktīvs/neaktīvs). Aktīvs objekts tomēr var būt neredzams atsevišķos kanālos.",
            },
            { type: "h2", text: "Objekta pagaidu bloķēšana" },
            {
              type: "p",
              text: "Ja vēlaties bloķēt vienu dienu, nevis visu objektu, izmantojiet Stop-Sell kalendārā — tas bloķē dienu visos kanālos vienlaikus, neatkarīgi no redzamības slēdžiem.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Trīs pārdošanas kanālu izpratne",
          excerpt: "Pārskats par portāliem, platformas tirgu un lietotni.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays vienlaikus tirgo katru objektu vairākos vienlīdzīgos veidos. Izprast, kā tie mijiedarbojas, palīdz jums mērķtiecīgi pārvaldīt redzamību un cenas.",
            },
            { type: "h2", text: "Portāli" },
            {
              type: "p",
              text: "Ar kanālu pārvaldnieka palīdzību savienojat savu objektu ar lielajiem rezervāciju portāliem, piemēram, Booking, Airbnb un citiem. Pieejamība un cenas tiek sinhronizētas automātiski, tāpēc jums nav manuāli jāuztur vairāki portālu kalendāri.",
            },
            { type: "h2", text: "Platformas tirgus" },
            {
              type: "p",
              text: "myBestDays tirgus ir pašu, globāls rezervāciju kanāls — salīdzināms ar Booking vai Airbnb, taču ir daļa no tās pašas platformas. Tas nav „tiešās rezervācijas“ aizstājējs, bet gan vienlīdzīgs kanāls ar savu redzamības asi.",
            },
            { type: "h2", text: "Lietotne" },
            {
              type: "p",
              text: "Mobilā lietotne dod viesiem, īpašniekiem un darbiniekiem piekļuvi tiem pašiem datiem, kas ir tīmeklī — piemēram, rezervācijas detaļām, ziņām vai uzdevumiem, atkarībā no attiecīgās lomas.",
            },
            { type: "h2", text: "Trīs atsevišķas redzamības asis" },
            {
              type: "ul",
              items: [
                "Vietne — jūsu pašu myNextDays vietne",
                "Platformas tirgus — globālais myBestDays tirgus",
                "Portāli — Booking, Airbnb un citi caur kanālu pārvaldnieku",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Visas trīs asis var ieslēgt un izslēgt neatkarīgi vienu no otras. Turpretī Stop-Sell un objekta statuss darbojas visos kanālos vienlaikus.",
            },
          ],
        },
      ],
    },
  ],
};
