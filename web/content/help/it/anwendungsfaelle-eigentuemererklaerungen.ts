import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Rendiconti proprietari",
  description: "Creare rendiconti per i proprietari.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Rendiconti proprietari",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Generare un rendiconto per il proprietario",
          excerpt: "Come creare per un proprietario un rendiconto chiaro del suo periodo.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Se gestite immobili per conto di proprietari, questi hanno regolarmente bisogno di una panoramica chiara di entrate, provvigione trattenuta e liquidazione dei loro immobili per un determinato periodo — il rendiconto proprietario riassume automaticamente questi dati.",
            },
            {
              type: "steps",
              items: [
                "Aprite nel conto la sezione Proprietari e selezionate il proprietario interessato.",
                "Selezionate il periodo di fatturazione per cui creare il rendiconto.",
                "Verificate che tutti gli immobili di questo proprietario siano assegnati correttamente, poiché solo gli immobili assegnati confluiscono nel rendiconto.",
                "Generate il rendiconto e controllate che le prenotazioni elencate siano complete.",
                "Mettete il rendiconto a disposizione del proprietario tramite l'accesso proprietario oppure esportatelo come documento.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il rendiconto mostra ogni prenotazione con l'importo nella rispettiva valuta dell'immobile — non esiste un'indicazione di valuta generica, poiché più immobili possono avere anche valute diverse. Per maggiori informazioni sull'assegnazione vedi [Assegnare un immobile a un proprietario](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Conteggiare la provvigione con il proprietario",
          excerpt: "Come assicurarvi che la vostra provvigione venga calcolata correttamente dalle entrate del proprietario.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "La vostra provvigione per la gestione di un immobile è memorizzata nella tariffa del proprietario e viene detratta automaticamente dalle entrate lorde in ogni rendiconto. Affinché il conteggio sia corretto, l'aliquota di provvigione deve essere impostata correttamente prima della prima prenotazione nel periodo.",
            },
            {
              type: "steps",
              items: [
                "Aprite nel conto la tariffa del proprietario interessato e verificate l'aliquota di provvigione memorizzata.",
                "Adattate l'aliquota se necessario prima che arrivino nuove prenotazioni nel prossimo periodo di fatturazione.",
                "Generate il rendiconto proprietario per il periodo e verificate che la provvigione per ogni prenotazione sia indicata correttamente.",
                "Controllate la plausibilità del totale di entrate lorde, provvigione detratta e liquidazione netta.",
                "Chiarite eventuali discrepanze direttamente con il proprietario prima di approvare il rendiconto, invece di modificarlo successivamente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una modifica successiva dell'aliquota di provvigione ha effetto solo sui periodi futuri, non retroattivamente sui rendiconti già generati. Verificate quindi l'aliquota per tempo prima dell'inizio di un nuovo periodo di fatturazione — vedi anche [Rendiconto proprietario (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
