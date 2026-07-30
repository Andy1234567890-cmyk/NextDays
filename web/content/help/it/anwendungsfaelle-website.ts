import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Sito web",
  description: "Utilizzare al meglio il vostro sito web.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Sito web",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Pubblicare il vostro sito web",
          excerpt: "Come pubblicare il vostro sito web come canale di vendita autonomo.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Il vostro sito web è un canale di vendita a sé stante accanto ai portali e alla piattaforma. Costruite le pagine nell'editor, ma solo con la pubblicazione il sito diventa visibile agli ospiti e i vostri immobili vi appaiono prenotabili.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'editor del sito web e verificate che tutte le pagine desiderate siano popolate con i contenuti.",
                "Nella scheda Immobile scegliete per ogni immobile se deve essere visibile sul sito web — questa visibilità è indipendente da portali e piattaforma.",
                "Controllate l'anteprima nella visualizzazione desktop e mobile prima di pubblicare.",
                "Fate clic su «Pubblica» per rendere il sito web accessibile agli ospiti.",
                "Dopo la pubblicazione verificate l'URL pubblico e testate una prenotazione di esempio tramite il sito web.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La visibilità sul sito web di un immobile è un asse a sé stante — un immobile può essere attivo sui portali ma nascosto sul sito web, e viceversa. Dettagli in [Configurare un dominio personalizzato](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Configurare un dominio personalizzato",
          excerpt: "Come collegare il vostro dominio personalizzato al vostro sito web myNextDays.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Un dominio personalizzato come www.vostra-attivita.it appare più professionale di un indirizzo standard e rafforza il vostro marchio nei confronti degli ospiti che desiderano prenotare direttamente da voi.",
            },
            {
              type: "steps",
              items: [
                "Aprite nell'editor del sito web la sezione «Dominio» e inserite il dominio personalizzato desiderato.",
                "Configurate presso il fornitore del vostro dominio i record DNS indicati (di norma CNAME o record A).",
                "Attendete finché il dominio non viene mostrato come collegato e il certificato SSL come attivo — a seconda del fornitore può richiedere alcune ore.",
                "Testate l'apertura del dominio personalizzato in una finestra del browser in modalità privata, per escludere voci memorizzate nella cache.",
                "Verificate che i vecchi indirizzi standard reindirizzino ancora al nuovo dominio, affinché i link esistenti non vadano a vuoto.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Modificate i record DNS solo come indicato — valori errati possono compromettere le impostazioni e-mail esistenti del vostro dominio. In caso di dubbio verificate con il vostro fornitore di dominio prima di sovrascrivere le voci esistenti.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Aumentare le prenotazioni dirette",
          excerpt: "Come indirizzare più ospiti verso il vostro sito web invece che verso i portali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Le prenotazioni tramite il proprio sito web sono di solito più convenienti per la vostra attività rispetto a quelle tramite i portali, poiché qui non è dovuta alcuna provvigione al portale. Con alcune misure mirate potete aumentare la quota di prenotazioni dirette tramite il vostro sito web come canale autonomo.",
            },
            {
              type: "steps",
              items: [
                "Assicuratevi che tutti gli immobili prenotabili siano visibili sul sito web e dotati di foto e descrizioni aggiornate.",
                "Impostate uno sconto o un vantaggio esclusivo per il sito web, ad esempio una piccola riduzione di prezzo rispetto ai portali.",
                "Inserite un link al vostro dominio nelle conferme di prenotazione e nella comunicazione con gli ospiti che hanno già prenotato in precedenza.",
                "Controllate regolarmente le statistiche di prenotazione per osservare nel tempo la quota del sito web sul totale delle prenotazioni.",
                "Ottimizzate il tempo di caricamento e la visualizzazione mobile del sito web, poiché la maggior parte degli ospiti prenota tramite smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un vantaggio esclusivo del sito web funziona solo se gli ospiti riescono a trovare il sito — rimandatevi attivamente, invece di puntare solo sui portali. Per la pubblicazione vedi [Pubblicare il vostro sito web](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
