import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Plăți",
  description: "Procesați corect plățile.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Plăți",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Configurarea unui avans",
          excerpt: "Cum solicitați la rezervare doar o sumă parțială, în loc de suma integrală.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "În loc să încasați imediat suma integrală a rezervării, puteți stabili un avans ca regulă de plată. Oaspetele plătește la rezervare doar o sumă parțială, prin Stripe sau PayPal, iar restul mai târziu, printr-o plată finală.",
            },
            {
              type: "steps",
              items: [
                "Deschideți în obiect secțiunea „Reguli de plată”.",
                "Adăugați o regulă nouă de tip „Avans”.",
                "Determinați suma avansului ca procentaj sau sumă fixă din suma totală.",
                "Stabiliți când devine scadent avansul, de regulă imediat la rezervare.",
                "Salvați regula și verificați-o la o rezervare de test.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Avansul este procesat prin furnizorul de plăți înregistrat la obiect. Suma potrivită la restul sumei o configurați la [Automatizarea plății finale](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizarea plății finale",
          excerpt: "Cum este încasat automat suma restantă înainte de sosire.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "După un avans rămâne o sumă restantă. În loc să o urmăriți manual, configurați o regulă de plată care încasează automat plata finală la un moment fix, înainte de sosire, prin Stripe sau PayPal.",
            },
            {
              type: "steps",
              items: [
                "Deschideți în obiect secțiunea „Reguli de plată”.",
                "Adăugați o regulă nouă de tip „Plată finală”, dacă există deja o regulă de avans.",
                "Determinați cu câte zile înainte de sosire devine scadentă plata finală.",
                "Activați încasarea automată, pentru ca furnizorul de plăți înregistrat să debiteze de la sine suma.",
                "Verificați apoi statusul plății finale în linia de timp a rezervării respective.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dacă încasarea automată eșuează, de exemplu din cauza unui card expirat, rezervarea nu este anulată automat. Verificați prompt plățile finale eșuate și contactați direct oaspetele.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Efectuarea unei rambursări",
          excerpt: "Cum rambursați unui oaspete o sumă integral sau parțial.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "În cazul unei anulări sau reclamații, puteți rambursa unui oaspete suma plătită, integral sau parțial. Rambursarea se realizează prin același furnizor de plăți prin care s-a plătit inițial — Stripe sau PayPal.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea afectată în linia de timp a rezervării.",
                "Alegeți în secțiunea „Plăți” plata inițială care urmează să fie rambursată.",
                "Alegeți între rambursare integrală sau parțială.",
                "Introduceți, la o rambursare parțială, suma dorită.",
                "Confirmați rambursarea și verificați statusul actualizat al plății în linia de timp.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "O rambursare nu modifică automat nimic la statusul rezervării sau la nopțile ocupate în calendar. Verificați, în caz de anulare, suplimentar dacă nopțile afectate trebuie eliberate din nou în planul de ocupare.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Gestionarea unei garanții",
          excerpt: "Cum configurați o garanție și o eliberați din nou după sejur.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "O garanție vă protejează împotriva daunelor apărute în timpul sejurului. Este înregistrată ca o regulă de plată proprie și, prin Stripe sau PayPal, este fie autorizată în avans, fie încasată, în funcție de configurația obiectului.",
            },
            {
              type: "steps",
              items: [
                "Deschideți în obiect secțiunea „Reguli de plată” și adăugați o regulă de tip „Garanție”.",
                "Determinați suma garanției și momentul autorizării, de regulă cu puțin timp înainte de sosire.",
                "Verificați starea obiectului după check-out.",
                "Eliberați garanția integral prin rezervare, dacă starea este ireproșabilă.",
                "Rambursați, în caz de daună, doar partea nenecesară și documentați motivul reținerii.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O garanție autorizată, dar neîncasată, expiră automat, în funcție de furnizorul de plăți, după un anumit termen. Eliberați garanția prompt după check-out sau încasați la timp suma necesară.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Corectarea unei facturi",
          excerpt: "Cum corectați ulterior o factură deja emisă.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Dacă o factură deja emisă conține o eroare, de exemplu la adresa de facturare sau la o poziție, o corectați prin rezervare, în loc să ștergeți pur și simplu factura originală.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea afectată în linia de timp a rezervării și treceți la secțiunea „Facturi”.",
                "Alegeți factura eronată.",
                "Creați o corecție, respectiv o factură de stornare, față de factura originală.",
                "Adăugați apoi o factură nouă, corectată, cu datele corecte.",
                "Trimiteți din nou factura corectată către oaspete, respectiv către adresa de facturare.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "O factură deja trimisă nu ar trebui suprascrisă direct, din motive de trasabilitate. Corecția printr-o factură de stornare păstrează documentul original și face modificarea trasabilă.",
            },
          ],
        },
      ],
    },
  ],
};
