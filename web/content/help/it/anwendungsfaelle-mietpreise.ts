import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Prezzi di affitto",
  description: "Impostare i prezzi di affitto in modo ottimale.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Prezzi di affitto",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Ottimizzare i prezzi per l'alta stagione",
          excerpt: "Come aumentare in modo mirato i prezzi per i periodi ad alta richiesta.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "In alta stagione la domanda aumenta notevolmente, mentre il vostro prezzo base rimane uguale al resto dell'anno. Senza un adeguamento stagionale rinunciate a fatturato proprio nel periodo più forte dell'anno — l'adeguamento avviene tramite il piano tariffario del vostro immobile, non sovrascrivendo manualmente singoli giorni.",
            },
            {
              type: "steps",
              items: [
                "Aprite il piano tariffario dell'immobile interessato e create una regola stagionale per il periodo desiderato.",
                "Impostate la maggiorazione come valore percentuale o importo fisso sopra il prezzo base — il piano tariffario adotta automaticamente la valuta dell'immobile.",
                "Verificate nel calendario che il nuovo prezzo per il periodo di alta stagione venga visualizzato correttamente prima di attivarlo.",
                "Controllate il soggiorno minimo per l'alta stagione — spesso una durata minima di prenotazione più alta è utile per mantenere l'occupazione pianificabile.",
                "Dopo l'attivazione osservate l'andamento delle prenotazioni nei primi giorni e adeguate la maggiorazione se necessario.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Una regola stagionale agisce trasversalmente su tutti i canali — portali, piattaforma e sito web — allo stesso modo. I dettagli sulla struttura delle regole si trovano in [Piani tariffari](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Promuovere i soggiorni più lunghi con uno sconto",
          excerpt: "Come premiare gli ospiti con soggiorni più lunghi e ridurre il lavoro di cambio.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "I soggiorni brevi comportano più arrivi e partenze, più pulizie e un maggiore rischio di sfitto tra una prenotazione e l'altra. Uno sconto soggiorno scaglionato rende le prenotazioni più lunghe più interessanti per gli ospiti e riduce sensibilmente questo carico di lavoro.",
            },
            {
              type: "steps",
              items: [
                "Aprite il piano tariffario dell'immobile e create uno sconto soggiorno.",
                "Definite almeno uno scaglione, ad esempio a partire da 7 notti o da 28 notti, con la relativa percentuale di sconto.",
                "Verificate che gli scaglioni non si sovrappongano e che lo sconto si applichi solo a partire dalla rispettiva durata minima.",
                "Testate nel calendario una prenotazione di esempio che superi la soglia dello sconto, per confermarne la corretta applicazione.",
                "Attivate lo sconto e osservate l'effetto sulla durata media del soggiorno e sull'occupazione.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Gli sconti soggiorno possono essere combinati con le regole stagionali — il piano tariffario calcola entrambi gli adeguamenti insieme. Per maggiori informazioni vedi [Piani tariffari](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
