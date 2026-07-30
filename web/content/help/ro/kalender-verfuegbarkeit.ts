import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Calendar și disponibilitate",
  description: "Planul de ocupare, Stop-Sell și sejurul minim.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Calendar",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Citirea planului de ocupare",
          excerpt: "Cum citiți corect rezervările, disponibilitatea și prețurile în planul de ocupare.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Planul de ocupare vă arată dintr-o privire ce nopți sunt rezervate, disponibile sau blocate. La unitățile de cazare de vacanță vedeți un rând per obiect, la hoteluri o vizualizare ierarhizată, cu un rând pentru fiecare categorie de cameră și plan de tarifare.",
            },
            { type: "h2", text: "Structura vizualizării" },
            {
              type: "steps",
              items: [
                "Deschideți calendarul prin punctul de meniu „Planul de ocupare”.",
                "Alegeți sus perioada pe care doriți să o vizualizați.",
                "Filtrați, dacă este necesar, după obiecte individuale sau categorii de cameră.",
                "Apăsați pe o zi, pentru a deschide detalii despre preț și disponibilitate.",
                "Apăsați pe o perioadă ocupată, pentru a deschide rezervarea aferentă.",
              ],
            },
            { type: "h2", text: "Culori și simboluri" },
            {
              type: "ul",
              items: [
                "Ocupat: perioada este rezervată printr-o rezervare.",
                "Disponibil: ziua poate fi rezervată pe toate canalele active.",
                "Blocat: ziua nu este rezervabilă din cauza Stop-Sell sau a unei blocări manuale.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Fiecare rând din planul de ocupare reprezintă exact o unitate rezervabilă — o cameră sau o unitate de cazare de vacanță. Nu există un rând de tip container pentru mai multe camere simultan.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mai multe despre deschiderea și închiderea în mod țintit a unor zile individuale găsiți la [Setarea disponibilității](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Setarea disponibilității",
          excerpt: "Deschideți și închideți în mod țintit zile individuale sau perioade.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Disponibilitatea stabilește dacă un obiect poate fi rezervat într-o anumită zi. Puteți deschide sau închide zile individuale sau perioade întregi, direct din planul de ocupare.",
            },
            { type: "h2", text: "Editarea unei perioade" },
            {
              type: "steps",
              items: [
                "Deschideți planul de ocupare al obiectului dorit.",
                "Marcați perioada dorită prin clic și tragere.",
                "Alegeți din meniul de acțiuni „Modificare disponibilitate”.",
                "Confirmați dacă perioada trebuie deschisă sau închisă.",
                "Salvați modificarea.",
              ],
            },
            { type: "h2", text: "Efectul asupra canalelor" },
            {
              type: "p",
              text: "O modificare a disponibilității se răsfrânge asupra tuturor canalelor de vânzare pe care este vizibil obiectul: portaluri precum Booking, Airbnb & Co., propria platformă, precum și aplicația. Transmiterea către portaluri are loc automat, în fundal.",
            },
            {
              type: "ul",
              items: [
                "Deschidere: ziua devine rezervabilă pe toate canalele active.",
                "Închidere: ziua dispare din posibilitatea de rezervare, dar rămâne vizibilă în calendar.",
                "Rezervările deja existente nu sunt afectate de o modificare a disponibilității.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nu închideți o perioadă cu intenția de a o bloca complet și permanent pentru vânzare — pentru asta este funcția potrivită Stop-Sell, vezi [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell blochează imediat o zi pe toate canalele de vânzare simultan.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell este cea mai rapidă modalitate de a scoate complet din vânzare o singură zi. Spre deosebire de o simplă modificare a disponibilității, Stop-Sell acționează dur și imediat pe toate canalele simultan — pe portaluri, pe propria platformă și în aplicație.",
            },
            { type: "h2", text: "Setarea Stop-Sell" },
            {
              type: "steps",
              items: [
                "Deschideți planul de ocupare al obiectului vizat.",
                "Alegeți ziua sau perioada dorită.",
                "Apăsați în meniul de acțiuni pe „Activare Stop-Sell”.",
                "Confirmați blocarea.",
              ],
            },
            { type: "h2", text: "Când este util Stop-Sell" },
            {
              type: "ul",
              items: [
                "Lucrări de întreținere pe termen scurt sau probleme tehnice la obiect.",
                "Un caz special în care doriți imediat și fără excepție să nu aveți nicio rezervare nouă.",
                "O blocare de urgență rapidă, la nivel de platformă, fără a edita fiecare canal individual.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell nu cunoaște nicio excepție specifică unui canal: dacă o zi este blocată, niciun oaspete nu poate rezerva prin niciun canal, nici măcar prin recepție sau printr-o cerere directă.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pentru folosire personală permanentă sau întreținere planificată se pretează, în schimb, [Blocarea manuală](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Sejur minim și maxim",
          excerpt: "Cât timp pot rezerva oaspeții cel puțin sau cel mult.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Cu sejurul minim și maxim stabiliți câte nopți poate rezerva cel puțin sau cel mult un oaspete pentru o zi de sosire. Acest lucru ajută la evitarea rezervărilor scurte, care lasă goluri, sau la poziționarea în mod țintit a obiectului dvs. pentru sejururi mai lungi.",
            },
            { type: "h2", text: "Configurarea unei reguli" },
            {
              type: "steps",
              items: [
                "Deschideți în obiect planul de ocupare sau fila „Prețuri”.",
                "Alegeți perioada vizată.",
                "Introduceți la „Sejur minim” numărul minim de nopți.",
                "Introduceți opțional la „Sejur maxim” un număr maxim de nopți.",
                "Salvați regula.",
              ],
            },
            { type: "h2", text: "Cazuri de utilizare tipice" },
            {
              type: "ul",
              items: [
                "Sezon de vârf: sejur minim mai mare, pentru a grupa zilele de schimb.",
                "Sezon slab: sejur minim mai mic, pentru a permite mai multe rezervări.",
                "Sejur maxim: util dacă un obiect trebuie să fie liber ulterior pentru întreținere sau altă utilizare.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Regula se aplică pentru ziua de sosire: un oaspete nu poate sosi pentru doar două nopți într-o zi cu sejur minim de trei nopți, chiar dacă zilele individuale sunt disponibile.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combinați sejururile minime mai lungi cu [Reduceri pentru sejur](/hilfe/preise-raten/aufenthaltsrabatte), pentru a crește stimulentul pentru oaspeți.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Blocarea manuală",
          excerpt: "Rezervați în mod țintit perioade pentru uz personal sau întreținere.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "O blocare manuală rezervă o perioadă în calendar, fără să existe o rezervare reală a unui oaspete — de exemplu pentru uz personal, lucrări de întreținere planificate sau renovări. Perioada este afișată în planul de ocupare ca o rezervare, dar este clar identificabilă drept blocare.",
            },
            { type: "h2", text: "Adăugarea unei blocări" },
            {
              type: "steps",
              items: [
                "Deschideți planul de ocupare al obiectului vizat.",
                "Marcați perioada dorită.",
                "Alegeți din meniul de acțiuni „Blocare manuală”.",
                "Indicați un motiv, de ex. „Uz personal” sau „Întreținere”.",
                "Salvați blocarea.",
              ],
            },
            { type: "h2", text: "Diferența față de Stop-Sell" },
            {
              type: "p",
              text: "O blocare manuală rezervă concret o perioadă pentru un scop determinat, documentat, și poate fi eliberată ulterior din nou. Pentru o blocare de urgență imediată, la nivel de platformă, fără o perioadă documentată, este destinată în schimb Stop-Sell.",
            },
            {
              type: "ul",
              items: [
                "Blocare manuală: planificată, cu motiv, pentru uz personal sau întreținere.",
                "Eliberare posibilă oricând, de îndată ce perioada nu mai este necesară.",
                "Nopțile blocate nu contează ca rezervare a unui oaspete și nu apar în privirea de ansamblu asupra veniturilor.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ștergeți o blocare manuală de îndată ce motivul nu mai este valabil — altfel obiectul rămâne blocat inutil pe toate canalele.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pentru o blocare imediată, fără o perioadă planificată, folosiți [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
