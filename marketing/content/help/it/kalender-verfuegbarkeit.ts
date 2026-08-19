import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Calendario e disponibilità",
  description: "Piano di occupazione, stop-sell e soggiorno minimo.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Calendario",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Leggere il piano di occupazione",
          excerpt: "Come leggere correttamente prenotazioni, disponibilità e prezzi nel piano di occupazione.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Il piano di occupazione mostra a colpo d'occhio quali notti sono prenotate, disponibili o bloccate. Per le case vacanza vedete una riga per immobile, per gli hotel una visualizzazione annidata con una riga per ogni categoria di camera e piano tariffario.",
            },
            { type: "h2", text: "Struttura della visualizzazione" },
            {
              type: "steps",
              items: [
                "Aprite il calendario dalla voce di menu «Piano di occupazione».",
                "Selezionate in alto il periodo che desiderate visualizzare.",
                "Se necessario, filtrate per singoli immobili o categorie di camera.",
                "Fate clic su un giorno per aprire i dettagli su prezzo e disponibilità.",
                "Fate clic su un periodo occupato per aprire la relativa prenotazione.",
              ],
            },
            { type: "h2", text: "Colori e simboli" },
            {
              type: "ul",
              items: [
                "Occupato: il periodo è riservato da una prenotazione.",
                "Disponibile: il giorno può essere prenotato su tutti i canali attivi.",
                "Bloccato: il giorno non è prenotabile a causa dello stop-sell o di un blocco manuale.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ogni riga nel piano di occupazione rappresenta esattamente un'unità prenotabile — una camera o una casa vacanza. Non esiste una riga contenitore per più camere contemporaneamente.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Per maggiori informazioni su come aprire e chiudere in modo mirato singoli giorni, consultate [Impostare la disponibilità](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Impostare la disponibilità",
          excerpt: "Aprire e chiudere in modo mirato singoli giorni o periodi.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La disponibilità determina se un immobile può essere prenotato in un determinato giorno. Potete aprire o chiudere singoli giorni o interi periodi, direttamente nel piano di occupazione.",
            },
            { type: "h2", text: "Modificare un periodo" },
            {
              type: "steps",
              items: [
                "Aprite il piano di occupazione dell'immobile desiderato.",
                "Selezionate il periodo desiderato facendo clic e trascinando.",
                "Selezionate nel menu azioni «Modifica disponibilità».",
                "Confermate se il periodo deve essere aperto o chiuso.",
                "Salvate la modifica.",
              ],
            },
            { type: "h2", text: "Effetto sui canali" },
            {
              type: "p",
              text: "Una modifica della disponibilità si ripercuote su tutti i canali di vendita su cui l'immobile è visibile: portali come Booking, Airbnb & Co., la piattaforma propria e l'app. La trasmissione ai portali avviene automaticamente in background.",
            },
            {
              type: "ul",
              items: [
                "Apertura: il giorno diventa prenotabile su tutti i canali attivi.",
                "Chiusura: il giorno scompare dalla prenotabilità, ma resta visibile nel calendario.",
                "Le prenotazioni già esistenti non sono interessate da una modifica della disponibilità.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Non chiudete un periodo con l'intenzione di bloccarlo completamente e permanentemente per la vendita — per questo la funzione corretta è lo stop-sell, vedi [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Lo stop-sell blocca un giorno immediatamente su tutti i canali di vendita contemporaneamente.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Lo stop-sell è il modo più rapido per togliere completamente dalla vendita un singolo giorno. A differenza di una semplice modifica della disponibilità, lo stop-sell agisce in modo netto e immediato su tutti i canali contemporaneamente — sui portali, sulla piattaforma propria e nell'app.",
            },
            { type: "h2", text: "Impostare lo stop-sell" },
            {
              type: "steps",
              items: [
                "Aprite il piano di occupazione dell'immobile interessato.",
                "Selezionate il giorno o il periodo desiderato.",
                "Fate clic nel menu azioni su «Attiva stop-sell».",
                "Confermate il blocco.",
              ],
            },
            { type: "h2", text: "Quando ha senso lo stop-sell" },
            {
              type: "ul",
              items: [
                "Lavori di manutenzione a breve termine o problemi tecnici nell'immobile.",
                "Un caso particolare in cui non volete alcuna nuova prenotazione, immediatamente e senza eccezioni.",
                "Un blocco d'emergenza rapido su tutta la piattaforma, senza dover intervenire singolarmente su ogni canale.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Lo stop-sell non prevede eccezioni specifiche per canale: se un giorno è bloccato, nessun ospite può prenotare tramite alcun canale, nemmeno tramite la reception o una richiesta diretta.",
            },
            {
              type: "note",
              variant: "info",
              text: "Per un uso personale permanente o una manutenzione pianificata è invece più adatto il [Blocco manuale](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Soggiorno minimo e massimo",
          excerpt: "Per quanto tempo, al minimo o al massimo, gli ospiti possono prenotare.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Con il soggiorno minimo e massimo stabilite quante notti un ospite può prenotare, al minimo o al massimo, per un determinato giorno di arrivo. Questo aiuta a evitare brevi prenotazioni «tappabuchi» o a posizionare il vostro immobile in modo mirato per soggiorni più lunghi.",
            },
            { type: "h2", text: "Configurare la regola" },
            {
              type: "steps",
              items: [
                "Aprite nell'immobile il piano di occupazione o la scheda «Prezzi».",
                "Selezionate il periodo interessato.",
                "Inserite in «Soggiorno minimo» il numero minimo di notti.",
                "Inserite facoltativamente in «Soggiorno massimo» un numero massimo di notti.",
                "Salvate la regola.",
              ],
            },
            { type: "h2", text: "Casi d'uso tipici" },
            {
              type: "ul",
              items: [
                "Alta stagione: soggiorno minimo più alto per raggruppare i giorni di cambio.",
                "Bassa stagione: soggiorno minimo più basso per consentire più prenotazioni.",
                "Soggiorno massimo: utile quando un immobile deve poi essere libero per manutenzione o un altro utilizzo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La regola vale per il giorno di arrivo: un ospite non può arrivare per sole due notti in un giorno con soggiorno minimo di tre notti, anche se i singoli giorni sono disponibili.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combinate soggiorni minimi più lunghi con gli [Sconti di soggiorno](/hilfe/preise-raten/aufenthaltsrabatte) per aumentare l'incentivo per gli ospiti.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Blocco manuale",
          excerpt: "Riservare in modo mirato periodi per uso personale o manutenzione.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Un blocco manuale riserva un periodo nel calendario senza che vi sia una vera prenotazione da parte di un ospite — ad esempio per uso personale, lavori di manutenzione pianificati o ristrutturazioni. Il periodo viene visualizzato nel piano di occupazione come una prenotazione, ma è chiaramente riconoscibile come blocco.",
            },
            { type: "h2", text: "Creare un blocco" },
            {
              type: "steps",
              items: [
                "Aprite il piano di occupazione dell'immobile interessato.",
                "Selezionate il periodo desiderato.",
                "Selezionate nel menu azioni «Blocca manualmente».",
                "Indicate un motivo, ad es. «Uso personale» o «Manutenzione».",
                "Salvate il blocco.",
              ],
            },
            { type: "h2", text: "Differenza rispetto allo stop-sell" },
            {
              type: "p",
              text: "Un blocco manuale riserva concretamente un periodo per uno scopo specifico e documentato, e può essere nuovamente liberato in seguito. Per un blocco d'emergenza immediato su tutta la piattaforma, senza un periodo documentato, è invece pensato lo stop-sell.",
            },
            {
              type: "ul",
              items: [
                "Blocco manuale: pianificato, con motivo, per uso personale o manutenzione.",
                "Sblocco possibile in qualsiasi momento, non appena il periodo non è più necessario.",
                "Le notti bloccate non contano come prenotazione di un ospite e non compaiono nella panoramica dei ricavi.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eliminate un blocco manuale non appena il motivo non sussiste più — altrimenti l'immobile resta inutilmente bloccato su tutti i canali.",
            },
            {
              type: "note",
              variant: "info",
              text: "Per un blocco immediato senza un periodo pianificato utilizzate lo [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
