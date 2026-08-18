import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica sui cookie",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "La presente politica illustra quali cookie e tecnologie analoghe myBestDays utilizza, per quale finalità, per quanto tempo sono conservati e come può gestirli.",
    "Integra l'[Informativa sulla privacy](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Cosa sono i cookie",
      paragraphs: [
        "I cookie sono piccoli file di testo che un sito web memorizza nel Suo browser. Tecnologie analoghe sono la memoria locale del browser e i pixel di tracciamento nelle e-mail.",
        "I cookie strettamente necessari al funzionamento della piattaforma possono essere impostati senza il Suo consenso. Per tutti gli altri raccogliamo il Suo consenso (articolo 5, paragrafo 3, della direttiva 2002/58/CE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Cookie necessari",
      paragraphs: [
        "Questi cookie sono necessari al funzionamento e non possono essere disattivati. Attualmente impostiamo:",
      ],
      list: [
        "«nd_access»: mantiene attiva la Sua sessione. Leggibile solo dal server (HttpOnly), durata corrispondente alla validità della sessione.",
        "«nd_refresh»: rinnova l'accesso affinché non debba autenticarsi continuamente. Leggibile solo dal server, durata 30 giorni.",
        "«nd_gast_locale»: memorizza la lingua scelta. Durata un anno.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Cookie funzionali, statistici e pubblicitari",
      paragraphs: [
        "myBestDays attualmente non imposta cookie per statistiche, misurazione dell'audience o pubblicità e non incorpora reti pubblicitarie o servizi di analisi.",
        "Qualora ciò cambiasse, raccoglieremmo preventivamente il Suo consenso mediante una finestra di scelta in cui rifiutare sia semplice quanto accettare, e integreremmo la presente politica con i cookie concreti.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Contenuti di terzi incorporati",
      paragraphs: [
        "Nelle pagine di dettaglio possono essere incorporate mappe. Carichiamo tali contenuti solo dopo una Sua attivazione espressa; solo allora possono essere trasmessi dati al rispettivo fornitore.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Come gestire i cookie",
      paragraphs: [
        "Può modificare o revocare il Suo consenso in qualsiasi momento tramite le impostazioni dei cookie nel piè di pagina.",
        "Può inoltre eliminare o bloccare i cookie nel Suo browser. Eliminando i cookie necessari verrà disconnesso e la piattaforma funzionerà in modo limitato.",
      ],
    },
  ],
};
