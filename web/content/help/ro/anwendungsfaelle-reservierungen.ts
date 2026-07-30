import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervări și calendar",
  description: "Țineți sub control rezervările și calendarul.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervări și calendar",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Evitarea fiabilă a suprarezervărilor",
          excerpt: "Cum vă asigurați că un obiect nu este niciodată rezervat de două ori.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Un obiect este vândut simultan prin mai multe canale — portaluri precum Booking, Airbnb & Co., propria platformă, precum și aplicația. O suprarezervare apare atunci când disponibilitatea nu este blocată la timp pe un canal, după ce s-a rezervat pe un alt canal.",
            },
            {
              type: "steps",
              items: [
                "Verificați în planul de ocupare că fiecare obiect are exact un rând, cu o singură unitate rezervabilă — fără capacitate comună a mai multor camere.",
                "Lăsați rezervările noi să fie adăugate exclusiv prin planul de ocupare sau prin canalele conectate, niciodată prin descrierea manuală a zilelor individuale.",
                "Verificați, după fiecare rezervare, dacă nopțile rezervate apar imediat ca ocupate în calendar.",
                "Folosiți imediat Stop-Sell la probleme tehnice sau întreținere, în loc să lăsați ziua deschisă.",
                "Verificați, în caz de neclarități, linia de timp a rezervării afectate, pentru a înțelege desfășurarea în timp.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nu modificați niciodată manual nopțile sau blocările în afara planului de ocupare — doar astfel rămâne asigurat că toate canalele văd aceeași stare a disponibilității și nu apare niciun gol pentru o dublă rezervare.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Mutarea unei rezervări către un alt obiect",
          excerpt: "Cum mutați corect o rezervare existentă către un alt obiect.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Uneori un oaspete trebuie să se mute dintr-un obiect în altul, de exemplu din cauza unui defect tehnic sau la dorința oaspetelui. La mutare, nopțile din calendar deja ocupate sunt eliberate automat și ocupate din nou în obiectul destinație.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea afectată în linia de timp a rezervării.",
                "Alegeți în meniul de acțiuni „Schimbare obiect”, respectiv „Mutare”.",
                "Alegeți obiectul destinație și verificați disponibilitatea acestuia în perioada aleasă.",
                "Confirmați mutarea.",
                "Verificați apoi în planul de ocupare că nopțile vechi sunt afișate din nou ca disponibile în obiectul de origine.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Eliberarea nopților vechi este preluată automat de sistem — nu trebuie să deschideți dvs. manual perioada de origine. Informați oaspetele despre schimbarea de obiect, în special dacă dotările sau accesul diferă.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Adăugarea unei rezervări pe termen lung",
          excerpt: "Cum adăugați corect o rezervare pentru o perioadă mai lungă.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Pentru oaspeții pe termen lung — de exemplu mai multe săptămâni sau luni — adăugați o rezervare ca de obicei, dar aveți în vedere suplimentar sejurul minim, regulile de plată și vizibilitatea pe canal a obiectului pe întreaga perioadă.",
            },
            {
              type: "steps",
              items: [
                "Deschideți planul de ocupare al obiectului dorit și marcați întreaga perioadă.",
                "Adăugați rezervarea cu datele oaspetelui și datele planificate de sosire și plecare.",
                "Configurați, dacă este necesar, o regulă de plată cu avans și plată finală, în loc să faceți scadentă imediat suma integrală.",
                "Verificați dacă nu există nicio regulă de sejur minim sau maxim care contrazice perioada lungă.",
                "Salvați rezervarea și verificați dacă întreaga perioadă apare corect ocupată în calendar.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "La sejururi foarte lungi se recomandă o plată finală în mai multe tranșe, în loc de o singură scadență mare — astfel riscul de plată rămâne gestionabil. Detalii la [Automatizarea plății finale](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
