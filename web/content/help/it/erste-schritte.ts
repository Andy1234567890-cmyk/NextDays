import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Primi passi",
  description: "Configurare il conto e iniziare in pochi minuti.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Configurazione",
      articles: [
        {
          slug: "willkommen",
          title: "Benvenuti in myNextDays",
          excerpt: "Una panoramica su PMS, gestione dei canali, marketplace e app.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "myNextDays è la vostra piattaforma centrale per case vacanza e hotel. Invece di più soluzioni isolate, gestite disponibilità, prezzi, prenotazioni e comunicazione con gli ospiti in un unico posto — che gestiate una singola casa vacanza o più camere d'albergo.",
            },
            { type: "h2", text: "I quattro elementi fondamentali" },
            {
              type: "ul",
              items: [
                "PMS (sistema di gestione degli immobili): immobili, calendario, prezzi, prenotazioni, attività e pagamenti.",
                "Gestione dei canali: collegamento a portali come Booking, Airbnb & Co. — un solo inserimento, molti portali sincronizzati.",
                "Marketplace della piattaforma: il marketplace proprio di myNextDays, un canale di prenotazione di pari livello accanto ai portali.",
                "App: l'applicazione mobile per ospiti, proprietari e collaboratori, con gli stessi dati del sito web.",
              ],
            },
            { type: "h2", text: "Come questi elementi interagiscono" },
            {
              type: "p",
              text: "Gestite immobile, prezzi e disponibilità una sola volta, centralmente nel PMS. Da lì myNextDays distribuisce automaticamente i dati a tutti i canali attivi. Una prenotazione — indipendentemente dal canale da cui arriva — blocca immediatamente le notti corrispondenti ovunque, così le doppie prenotazioni sono escluse.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Iniziate con Configurare conto e attività, poi create il vostro primo immobile — questo ordine vi risparmierà correzioni successive.",
            },
            { type: "h2", text: "Prossimi passi" },
            {
              type: "steps",
              items: [
                "Aprite Conto nel menu e completate i dati della vostra attività.",
                "Create il vostro primo immobile in Immobili.",
                "Verificate la completezza di dotazioni, foto e prezzi.",
                "Fate clic su Pubblica per rendere l'immobile visibile su tutti i canali.",
              ],
            },
            {
              type: "p",
              text: "Per maggiori informazioni sui singoli passaggi consultate [Configurare conto e attività](/hilfe/erste-schritte/konto-einrichten) e [Creare il vostro primo immobile](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Configurare conto e attività",
          excerpt: "Inserire correttamente i dati anagrafici, l'indirizzo di fatturazione e la valuta.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Prima di creare gli immobili, configurate la vostra attività nel conto. Questi dati sono necessari per le fatture, i portali e la fatturazione con myNextDays, e per questo dovrebbero essere completi e corretti.",
            },
            { type: "h2", text: "Inserire i dati anagrafici" },
            {
              type: "steps",
              items: [
                "Aprite Conto nel menu.",
                "Inserite in Dati anagrafici la ragione sociale ovvero il nome della ditta individuale, l'indirizzo e i dati di contatto.",
                "Inserite l'indirizzo di fatturazione — comparirà su tutte le fatture emesse.",
                "Selezionate la vostra valuta di base. Questa vale per tutti i prezzi, finché non la modificate singolarmente per un determinato immobile.",
              ],
            },
            { type: "h2", text: "Perché la valuta è importante" },
            {
              type: "p",
              text: "La valuta non viene indovinata né aggiunta automaticamente: se manca, nessun prezzo può essere visualizzato o fatturato correttamente. Per questo myNextDays richiede una scelta consapevole durante la configurazione, invece di impostare un valore predefinito.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Se modificate successivamente la valuta di un immobile, tutti i piani tariffari collegati vengono convertiti di conseguenza. Verificate quindi una volta i prezzi.",
            },
            { type: "h2", text: "Indirizzo di fatturazione e fatturazione" },
            {
              type: "p",
              text: "In Fatturazione, nel conto, trovate le vostre fatture correnti e l'indirizzo di fatturazione inserito. Tenetelo aggiornato, in particolare in caso di modifica della forma giuridica o dell'indirizzo, affinché le fatture vengano emesse correttamente.",
            },
            {
              type: "ul",
              items: [
                "Ragione sociale ovvero nome della ditta individuale",
                "Indirizzo di fatturazione con paese",
                "Codice fiscale ovvero partita IVA, se presente",
                "Valuta di base per i nuovi immobili",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Creare il vostro primo immobile",
          excerpt: "Come creare passo dopo passo il vostro primo immobile prenotabile.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Un immobile in myNextDays è sempre esattamente un'unità prenotabile: o una singola camera in un hotel, oppure un'intera casa vacanza. Se gestite un hotel con più camere, create un immobile separato per ogni camera.",
            },
            { type: "h2", text: "Creare un immobile" },
            {
              type: "steps",
              items: [
                "Aprite Immobili nel menu.",
                "Fate clic su Aggiungi immobile.",
                "Selezionate il tipo di immobile: categoria, tipo di immobile e tipo di offerta.",
                "Completate indirizzo, capacità e prezzo base nella valuta impostata.",
                "Salvate l'immobile come bozza per completarlo in seguito.",
              ],
            },
            { type: "h2", text: "Cosa manca ancora dopo" },
            {
              type: "p",
              text: "Un immobile appena creato è inizialmente una bozza e non è visibile su nessun canale. Completate dotazioni, foto, descrizione e disponibilità nel calendario prima di pubblicarlo — solo un immobile completo può essere commercializzato in modo affidabile.",
            },
            {
              type: "ul",
              items: [
                "Selezionare le caratteristiche di dotazione dall'elenco per categoria",
                "Inserire almeno una foto di copertina e una descrizione",
                "Inserire correttamente la capacità (adulti, bambini, letti)",
                "Verificare il prezzo base e la disponibilità nel calendario",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se gestite più tipologie di camera, ripetete questa procedura per ogni singola camera — non esiste un livello di edificio superiore con camere sottostanti.",
            },
            {
              type: "p",
              text: "Una volta compilati tutti i campi obbligatori, potete pubblicare l'immobile, vedi [Pubblicare un immobile](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Pubblicare un immobile",
          excerpt: "Un clic attiva contemporaneamente marketplace della piattaforma, portali e sito web.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La pubblicazione rende un immobile visibile e prenotabile. Normalmente basta un solo clic per attivare contemporaneamente tutti e tre i canali di vendita — potete tuttavia modificare la visibilità singolarmente per ogni canale in qualsiasi momento.",
            },
            { type: "h2", text: "Come pubblicare" },
            {
              type: "steps",
              items: [
                "Aprite l'immobile in Immobili.",
                "Verificate nella scheda Panoramica che tutti i dati obbligatori siano contrassegnati in verde.",
                "Fate clic su Pubblica.",
                "Confermate la finestra di dialogo — marketplace della piattaforma, portali e sito web vengono attivati.",
              ],
            },
            { type: "h2", text: "Gestire i canali singolarmente" },
            {
              type: "p",
              text: "Dopo la pubblicazione trovate nella scheda Visibilità tre interruttori separati: Sito web, Marketplace della piattaforma e Portali. Se ad esempio volete offrire un immobile solo sul vostro sito web, ma non tramite i portali, disattivate semplicemente l'interruttore corrispondente.",
            },
            {
              type: "ul",
              items: [
                "Sito web: visibilità sul vostro sito web myNextDays",
                "Marketplace della piattaforma: visibilità sul marketplace globale di myNextDays",
                "Portali: visibilità su Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Questi tre interruttori sono indipendenti dallo stato dell'immobile (attivo/inattivo). Un immobile attivo può comunque essere invisibile su singoli canali.",
            },
            { type: "h2", text: "Bloccare temporaneamente un immobile" },
            {
              type: "p",
              text: "Se volete bloccare un singolo giorno invece dell'intero immobile, utilizzate lo stop-sell nel calendario — questo blocca il giorno su tutti i canali contemporaneamente, indipendentemente dagli interruttori di visibilità.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Capire i tre canali di vendita",
          excerpt: "Portali, marketplace della piattaforma e app in sintesi.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "myNextDays commercializza ogni immobile contemporaneamente attraverso più canali di pari livello. Capire come questi interagiscono vi aiuta a gestire in modo mirato visibilità e prezzi.",
            },
            { type: "h2", text: "Portali" },
            {
              type: "p",
              text: "Tramite la gestione dei canali collegate il vostro immobile ai principali portali di prenotazione come Booking, Airbnb & Co. Disponibilità e prezzi vengono sincronizzati automaticamente, così non dovete gestire manualmente più calendari dei portali.",
            },
            { type: "h2", text: "Marketplace della piattaforma" },
            {
              type: "p",
              text: "Il marketplace di myNextDays è un canale di prenotazione proprio e globale — paragonabile a Booking o Airbnb, ma parte della stessa piattaforma. Non è un sostituto della «prenotazione diretta», bensì un canale di pari livello con un proprio asse di visibilità.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "L'app mobile offre a ospiti, proprietari e collaboratori l'accesso agli stessi dati del sito web — ad esempio dettagli delle prenotazioni, messaggi o attività, a seconda del rispettivo ruolo.",
            },
            { type: "h2", text: "Tre assi di visibilità separati" },
            {
              type: "ul",
              items: [
                "Sito web — il vostro sito web myNextDays",
                "Marketplace della piattaforma — il marketplace globale di myNextDays",
                "Portali — Booking, Airbnb & Co. tramite la gestione dei canali",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tutti e tre gli assi sono attivabili/disattivabili in modo indipendente l'uno dall'altro. Lo stop-sell e lo stato dell'immobile agiscono invece trasversalmente su tutti e tre contemporaneamente.",
            },
          ],
        },
      ],
    },
  ],
};
