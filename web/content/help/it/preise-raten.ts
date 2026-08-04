import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Prezzi & Tariffe",
  description: "Piani tariffari, prezzi stagionali e prezzi dinamici.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Definizione dei prezzi",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Prezzo base & valuta",
          excerpt: "Ecco come stabilire il prezzo base e assegnare al tuo oggetto la valuta corretta.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Ogni oggetto in myNextDays è esattamente un'unità prenotabile — una singola camera o un alloggio per vacanze. Per questa unità definisci un prezzo base e una valuta centrale, valida per l'intero oggetto.",
            },
            { type: "h2", text: "Impostare la valuta centralmente" },
            {
              type: "p",
              text: "La valuta dell'oggetto viene impostata una volta per oggetto e vale automaticamente per tutti i piani tariffari che crei per questo oggetto. Non esiste una valuta di riserva separata — se manca la valuta, non puoi salvare alcun prezzo.",
            },
            {
              type: "steps",
              items: [
                "Apri il tuo oggetto in «Oggetti».",
                "Passa alla scheda «Prezzi».",
                "In «Valuta dell'oggetto» scegli la valuta corretta.",
                "Inserisci il prezzo base per l'occupazione standard.",
                "Salva le modifiche.",
              ],
            },
            { type: "h2", text: "Cosa succede in caso di cambio valuta" },
            {
              type: "p",
              text: "Se modifichi successivamente la valuta dell'oggetto, la modifica si ripercuote su tutti i piani tariffari esistenti di questo oggetto, poiché sono sempre gestiti nella valuta dell'oggetto. Controlla poi i tuoi prezzi prima di ritrasmetterli ai portali.",
            },
            {
              type: "ul",
              items: [
                "Un oggetto ha esattamente una valuta — non più valute per ogni piano tariffario.",
                "Il prezzo base è il valore di partenza per le tariffe derivate.",
                "Gli importi vengono sempre mostrati nella valuta dell'oggetto memorizzata.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza valuta memorizzata non è possibile salvare alcun prezzo né trasmettere alcuna tariffa ai portali. Controlla prima questo aspetto se una modifica di prezzo fallisce.",
            },
            {
              type: "note",
              variant: "info",
              text: "Maggiori informazioni sui prezzi derivati sono disponibili in [Tariffe derivate](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Creare piani tariffari",
          excerpt: "I piani tariffari raggruppano prezzo, condizioni di cancellazione e trattamento per un oggetto.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Un piano tariffario definisce a quali condizioni un oggetto può essere prenotato: prezzo, regole di cancellazione, trattamento e soggiorno minimo. Un oggetto può offrire più piani tariffari contemporaneamente, ad esempio uno flessibile e uno non rimborsabile.",
            },
            { type: "h2", text: "Creare un nuovo piano tariffario" },
            {
              type: "steps",
              items: [
                "Apri l'oggetto e passa alla scheda «Prezzi».",
                "Fai clic su «Crea nuovo piano tariffario».",
                "Assegna un nome chiaro, ad es. «Flessibile» o «Non rimborsabile».",
                "Stabilisci se il piano è una tariffa base o una tariffa derivata.",
                "Definisci le condizioni di cancellazione e il trattamento.",
                "Salva e attiva il piano tariffario.",
              ],
            },
            { type: "h2", text: "Tariffa base rispetto ad altri piani tariffari" },
            {
              type: "p",
              text: "Crea prima la tua tariffa base (spesso indicata come «BAR», Best Available Rate). Tutti gli altri piani tariffari possono essere gestiti in modo indipendente oppure derivati da questa tariffa base.",
            },
            {
              type: "ul",
              items: [
                "Tariffa base: prezzo base per notte gestito manualmente.",
                "Altri piani tariffari: indipendenti oppure come maggiorazione/sconto sulla tariffa base.",
                "Ogni piano tariffario può essere trasmesso singolarmente ai portali.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Mantieni gestibile il numero di piani tariffari per oggetto — troppe varianti rendono difficile il confronto per gli ospiti e aumentano il carico di gestione.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dettagli su maggiorazioni e sconti sono disponibili in [Tariffe derivate](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Tariffe derivate",
          excerpt: "I piani tariffari derivati vengono calcolati automaticamente a partire da una tariffa base.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Una tariffa derivata è un piano tariffario il cui prezzo non viene gestito manualmente, ma calcolato automaticamente a partire da una tariffa base — come maggiorazione fissa, sconto fisso o percentuale. Questo riduce il carico di gestione, poiché una modifica di prezzo sulla tariffa base aggiorna automaticamente tutti i piani derivati.",
            },
            { type: "h2", text: "Esempio tipico" },
            {
              type: "p",
              text: "Uno schema frequente è un piano con colazione, derivato dalla tariffa base senza trattamento: il prezzo della colazione viene definito come maggiorazione per notte e persona sulla tariffa base. Se modifichi la tariffa base, il prezzo della colazione si adegua automaticamente.",
            },
            { type: "h2", text: "Configurare una tariffa derivata" },
            {
              type: "steps",
              items: [
                "Apri il piano tariffario desiderato nella scheda «Prezzi».",
                "Scegli come fonte del prezzo «Derivato da…» e la tariffa base corrispondente.",
                "Stabilisci se la differenza vale come importo fisso o come percentuale.",
                "Definisci se si tratta di una maggiorazione o di uno sconto.",
                "Salva l'assegnazione.",
              ],
            },
            {
              type: "ul",
              items: [
                "Maggiorazione: ad es. trattamento, cancellazione più flessibile.",
                "Sconto: ad es. piano non rimborsabile con vantaggio di prezzo.",
                "La tariffa base resta l'unica fonte gestita manualmente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una tariffa derivata non può essere contemporaneamente sovrascritta manualmente. Rimuovi prima la derivazione se vuoi impostare un prezzo singolo diverso.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Prezzi stagionali e per il weekend",
          excerpt: "Adatta in modo mirato i prezzi per i periodi stagionali e i weekend.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La domanda varia nel corso dell'anno e all'interno della settimana. Con i prezzi stagionali e per il weekend adatti il prezzo base per determinati periodi o giorni della settimana, senza dover intervenire ogni giorno singolarmente nel calendario.",
            },
            { type: "h2", text: "Creare un periodo stagionale" },
            {
              type: "steps",
              items: [
                "Apri nell'oggetto la scheda «Prezzi» e la sezione «Prezzi stagionali».",
                "Crea un nuovo periodo con data di inizio e di fine.",
                "Inserisci il prezzo o la variazione percentuale rispetto al prezzo base per questo periodo.",
                "Salva il periodo stagionale.",
              ],
            },
            { type: "h2", text: "Prezzi per il weekend" },
            {
              type: "p",
              text: "Inoltre puoi assegnare a singoli giorni della settimana, ad esempio venerdì e sabato, una maggiorazione propria. Questa maggiorazione si applica in aggiunta al prezzo stagionale o base in vigore in quel momento.",
            },
            {
              type: "ul",
              items: [
                "I prezzi stagionali valgono per periodi continuativi.",
                "I prezzi per il weekend valgono per giorno della settimana, indipendentemente dalla stagione.",
                "Entrambe le regole possono essere combinate.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se più periodi stagionali si sovrappongono, si applica la regola creata più di recente o più specifica. Controlla il calendario dopo aver salvato.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Per adattamenti automatici basati sulla domanda è utile anche [Prezzi dinamici](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Prezzi dinamici",
          excerpt: "Adatta automaticamente i prezzi in base a domanda, anticipo di prenotazione e occupazione.",
          updated: "Ultimo aggiornamento: agosto 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "I prezzi dinamici sono un modulo aggiuntivo a pagamento. Lo attivi in «Estensioni», dove trovi anche il prezzo. Senza il modulo l’automazione non calcola nulla.",
            },
            {
              type: "p",
              text: "I prezzi dinamici adattano automaticamente il prezzo base in base a fattori come l'anticipo di prenotazione, l'occupazione attuale e la domanda — in modo simile a quanto fanno i grandi portali con i propri consigli di prezzo. Così reagisci ai cambiamenti del mercato senza dover intervenire manualmente ogni giorno.",
            },
            { type: "h2", text: "Attivare i prezzi dinamici" },
            {
              type: "steps",
              items: [
                "Attiva il modulo in «Strumenti → Estensioni»: senza il modulo l'automatismo non calcola.",
                "Apri «Distribuzione → Prezzi dinamici» dal menu principale.",
                "Nella tabella degli oggetti fai clic sull'icona a matita dell'oggetto desiderato («Imposta prezzo base»).",
                "Scegli la strategia del prezzo base: basata sui dati oppure un prezzo base fisso.",
                "Imposta prezzo minimo e massimo e definisci con «Sensibilità all'occupazione (%)» quanto incide l'occupazione.",
                "Attiva «Prezzi dinamici attivi» e salva.",
              ],
            },
            { type: "h2", text: "Limiti e sicurezza" },
            {
              type: "p",
              text: "Il limite minimo e il limite massimo di prezzo evitano che l'algoritmo automatico imposti prezzi non sostenibili per la tua attività. I piani tariffari derivati seguono automaticamente la tariffa base calcolata dinamicamente.",
            },
            {
              type: "ul",
              items: [
                "Il limite minimo protegge da prezzi troppo bassi in caso di domanda debole.",
                "Il limite massimo protegge da prezzi eccessivi in caso di domanda elevata.",
                "Le tariffe derivate recepiscono automaticamente la nuova tariffa base.",
                "Un prezzo giornaliero impostato manualmente nel calendario ha sempre la precedenza sull'automatismo.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "I prezzi dinamici agiscono solo sulla tariffa base. I piani tariffari impostati manualmente in modo fisso, senza derivazione, non cambiano automaticamente di conseguenza.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Sconti per la durata del soggiorno",
          excerpt: "Configura sconti per soggiorni più lunghi e prenotazioni anticipate.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Gli sconti per la durata del soggiorno premiano gli ospiti per prenotazioni più lunghe o per la prenotazione anticipata. Vengono applicati come percentuale sul prezzo totale del soggiorno e possono essere configurati in modo indipendente per ogni oggetto.",
            },
            { type: "h2", text: "Tipi di sconto" },
            {
              type: "ul",
              items: [
                "Sconto per soggiorni lunghi: a partire da un determinato numero di notti, ad es. da 7 o 28 notti.",
                "Sconto per prenotazione anticipata: per prenotazioni effettuate con sufficiente anticipo.",
                "Sconto last minute: per prenotazioni effettuate a breve termine, vicino alla data di arrivo.",
              ],
            },
            { type: "h2", text: "Configurare uno sconto" },
            {
              type: "steps",
              items: [
                "Apri nell'oggetto la scheda «Prezzi» e la sezione «Sconti».",
                "Scegli il tipo di sconto desiderato.",
                "Stabilisci la soglia, ad es. notti minime o anticipo.",
                "Inserisci lo sconto in percentuale.",
                "Salva la regola.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Gli sconti agiscono sul prezzo totale del rispettivo piano tariffario e vengono mostrati all'ospite già nel riepilogo prezzi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combina gli sconti per soggiorni lunghi con [Soggiorno minimo & massimo](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) per favorire in modo mirato le prenotazioni più lunghe.",
            },
          ],
        },
      ],
    },
  ],
};
