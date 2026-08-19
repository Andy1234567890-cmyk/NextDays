import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Gestione dei canali",
  description: "Padroneggiare portali e gestione dei canali.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Gestione dei canali",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Collegare il primo portale",
          excerpt: "Come attivare per la prima volta un portale per un immobile.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: avete creato un immobile, ma non avete ancora collegato nessun portale",
            },
            {
              type: "p",
              text: "Il vostro immobile è configurato completamente in myNextDays, ma non è ancora visibile su nessun portale come Booking.com o Airbnb. Prima che un portale accetti un immobile, il vostro conto necessita una tantum di un collegamento ai portali valido per l'intero conto — dopodiché, per ogni ulteriore immobile basta una semplice mappatura.",
            },
            {
              type: "steps",
              items: [
                "Aprite /konto, sezione «Portali e gestione dei canali», e configurate il collegamento valido per l'intero conto con i dati della vostra attività",
                "Aprite quindi l'immobile in /objekte e passate alla scheda «Portali»",
                "Selezionate il portale desiderato e assegnatelo alla tipologia di camera o di offerta corrispondente",
                "Controllate foto, dotazioni, prezzi e condizioni di cancellazione — i portali richiedono dati completi",
                "Attivate la visibilità; dopo la verifica da parte del portale lo stato passa a «Collegato»",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il collegamento valido per l'intero conto si configura una sola volta. Dettagli in [Collegare Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) e [Collegare Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Collegare Booking.com",
          excerpt: "Come rendere prenotabile un immobile su Booking.com tramite la gestione dei canali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: il vostro immobile deve diventare visibile anche su Booking.com",
            },
            {
              type: "p",
              text: "Booking.com è uno dei portali collegati tramite la gestione dei canali. Il presupposto è il collegamento ai portali valido per l'intero conto — se questo è già configurato, per Booking.com vi serve solo una mappatura per ogni immobile.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'immobile in /objekte, scheda «Portali»",
                "Selezionate «Booking.com» dall'elenco dei portali disponibili",
                "Assegnate la tipologia di camera o di offerta corrispondente e confermate almeno una tariffa con prezzo e condizioni di cancellazione",
                "Inserite un metodo di pagamento valido per il conteggio delle commissioni",
                "Attivate la visibilità per Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L'attivazione da parte di Booking.com può richiedere alcune ore. Lo stato nella scheda «Portali» indica non appena il collegamento è attivo.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Collegare Airbnb",
          excerpt: "Come rendere prenotabile un immobile su Airbnb tramite la gestione dei canali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: il vostro immobile deve diventare visibile anche su Airbnb",
            },
            {
              type: "p",
              text: "Airbnb, come ogni altro portale, viene collegato tramite il collegamento valido per l'intero conto. Una volta configurato, attivate Airbnb per ogni immobile tramite una mappatura — indipendentemente dal fatto che l'immobile sia già visibile su Booking.com o su altri portali.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'immobile in /objekte, scheda «Portali»",
                "Selezionate «Airbnb» dall'elenco dei portali disponibili",
                "Confermate la categoria dell'immobile e la tipologia di offerta assegnata",
                "Completate foto, dotazioni e regole della casa — Airbnb richiede dati completi prima dell'attivazione",
                "Attivate la visibilità per Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza condizioni di cancellazione e regole della casa inserite, Airbnb rifiuta l'attivazione. Completate prima questi dati nell'immobile.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Mantenere i prezzi sincronizzati su tutti i portali",
          excerpt: "Basta un solo calendario — la gestione dei canali distribuisce automaticamente le modifiche di prezzo a tutti i portali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: modificate un prezzo e volete assicurarvi che sia corretto ovunque",
            },
            {
              type: "p",
              text: "I prezzi si gestiscono esclusivamente nel calendario myNextDays dell'immobile — mai singolarmente nei portali stessi. La gestione dei canali trasmette automaticamente ogni modifica a tutti i portali per cui l'immobile ha una mappatura attiva.",
            },
            {
              type: "steps",
              items: [
                "Aprite il calendario prezzi ovvero i piani tariffari dell'immobile",
                "Modificate il prezzo giornaliero, il soggiorno minimo o le restrizioni di arrivo/partenza",
                "Salvate la modifica — inizialmente ha effetto internamente sull'immobile",
                "Controllate nella scheda «Portali» che tutti i portali desiderati abbiano ancora una mappatura attiva",
                "Attendete alcuni minuti finché la modifica non viene trasmessa ai portali",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Non inserite mai i prezzi direttamente nel portale — tali modifiche vengono sovrascritte dal calendario myNextDays alla successiva sincronizzazione.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importare una prenotazione da portale",
          excerpt: "Le prenotazioni da portale arrivano automaticamente nel calendario — qui verificate che l'importazione sia andata a buon fine.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: un ospite ha prenotato tramite un portale e la prenotazione deve arrivare in myNextDays",
            },
            {
              type: "p",
              text: "Se un ospite prenota tramite Booking.com, Airbnb o un altro portale collegato, la gestione dei canali importa automaticamente la prenotazione — non dovete trasferire nulla manualmente. Questa procedura descrive come verificare e confermare l'importazione.",
            },
            {
              type: "steps",
              items: [
                "Aprite il calendario o l'elenco delle prenotazioni dell'immobile interessato",
                "Cercate la nuova prenotazione — riporta un'etichetta di provenienza del portale, ad esempio Booking.com o Airbnb",
                "Controllate che i dati dell'ospite, il periodo e il prezzo siano completi",
                "Verificate che le notti prenotate risultino bloccate su tutti gli altri canali",
                "Se necessario, aprite i dettagli della prenotazione per gestire servizi aggiuntivi o messaggi dell'ospite",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se l'ospite cancella tramite il portale o modifica il periodo, anche questo viene recepito automaticamente e le notti vengono nuovamente liberate.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Risolvere una doppia prenotazione",
          excerpt: "Come procedere se, in via eccezionale, la stessa notte è stata venduta su due canali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: due prenotazioni si sovrappongono per lo stesso immobile e le stesse notti",
            },
            {
              type: "p",
              text: "La gestione dei canali normalmente blocca subito le notti prenotate su tutti i canali. Una doppia prenotazione può comunque verificarsi, ad esempio in caso di prenotazioni simultanee su due portali nello stesso istante, oppure con una prenotazione creata manualmente che entra in conflitto con una prenotazione da portale.",
            },
            {
              type: "steps",
              items: [
                "Aprite il calendario dell'immobile e identificate entrambe le prenotazioni sovrapposte",
                "Controllate il momento della prenotazione e l'etichetta di provenienza di entrambe le prenotazioni",
                "Contattate l'ospite arrivato per ultimo e proponete un immobile alternativo o un periodo alternativo",
                "Cancellate la prenotazione non sostenibile direttamente nel relativo portale, non solo in myNextDays",
                "Impostate quindi lo stop-sell per le notti interessate finché il caso non è completamente risolto",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Cancellate sempre una prenotazione da portale direttamente tramite il portale stesso — una cancellazione solo in myNextDays libera la notte internamente, ma non informa in modo affidabile il portale.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Mettere in pausa temporaneamente un portale",
          excerpt: "Disattivare la visibilità singolarmente per ogni portale, senza perdere la mappatura.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: un immobile non deve essere temporaneamente prenotabile su un portale",
            },
            {
              type: "p",
              text: "La visibilità è attivabile e disattivabile singolarmente per ogni portale — indipendentemente dal sito web e dal marketplace della piattaforma. Se ad esempio volete mettere in pausa Airbnb per un breve periodo ma lasciare attivo Booking.com, disattivate esclusivamente questo unico canale.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'immobile in /objekte, scheda «Portali»",
                "Cercate la voce del portale che volete mettere in pausa",
                "Disattivate la visibilità per questo portale",
                "Salvate — la modifica ha effetto entro pochi minuti, l'immobile scompare dai risultati di ricerca di questo portale",
                "Riattivate la visibilità non appena l'immobile deve tornare prenotabile",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La mappatura resta invariata durante la pausa — in seguito non dovrete ricreare l'associazione con il portale. Per bloccare completamente tutti i canali utilizzate invece lo stop-sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Controllare la mappatura dell'immobile",
          excerpt: "Come verificare se il vostro immobile è ancora correttamente associato alla tipologia di offerta giusta nel portale.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: prezzi o disponibilità su un portale non corrispondono più a myNextDays",
            },
            {
              type: "p",
              text: "Se la visualizzazione nel portale si discosta dal vostro calendario myNextDays, la causa è spesso una mappatura errata o interrotta — cioè il collegamento tra il vostro immobile e la tipologia di camera o di offerta nel portale.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'immobile in /objekte, scheda «Portali»",
                "Controllate lo stato del portale interessato — dovrebbe indicare «Collegato», non «Errore» o «In sospeso»",
                "Verificate se la tipologia di camera o di offerta associata nel portale corrisponde ancora effettivamente all'immobile",
                "In caso di discrepanza: rimuovete la mappatura e create una nuova associazione, quindi riattivate la visibilità",
                "Dopo la correzione attendete alcuni minuti e controllate nuovamente prezzi e disponibilità nel portale",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un immobile può essere associato contemporaneamente a più portali — in caso di incongruenze controllate in modo mirato il singolo portale interessato, non tutti contemporaneamente.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Tariffe diverse per ogni portale",
          excerpt: "Come assegnare a un portale un piano tariffario proprio senza influenzare gli altri canali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: volete offrire su un portale un prezzo diverso rispetto agli altri canali",
            },
            {
              type: "p",
              text: "I piani tariffari possono essere assegnati singolarmente per ogni portale, ad esempio un piano non rimborsabile per un portale e uno flessibile per un altro. I prezzi base restano gestiti centralmente nell'immobile, mentre la mappatura determina quale piano tariffario viene inviato a quale portale.",
            },
            {
              type: "steps",
              items: [
                "Create nell'immobile il piano tariffario aggiuntivo con le condizioni desiderate (prezzo, condizioni di cancellazione, soggiorno minimo)",
                "Aprite la scheda «Portali» e selezionate il portale interessato",
                "Nella mappatura assegnate il nuovo piano tariffario a questo portale",
                "Lasciate invariati gli altri portali sul loro piano tariffario precedente",
                "Salvate e dopo pochi minuti controllate la visualizzazione dei prezzi nel rispettivo portale",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ogni piano tariffario viene trasmesso in modo indipendente — una modifica a un piano tariffario non ha effetto sui portali associati a un altro piano tariffario.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Risolvere gli errori più comuni dei portali",
          excerpt: "Cause tipiche quando un portale rifiuta un immobile o la sincronizzazione si blocca.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza: lo stato di un portale mostra un errore oppure l'immobile non viene accettato",
            },
            {
              type: "p",
              text: "I portali rifiutano un collegamento perlopiù a causa di dati anagrafici mancanti o di informazioni sull'immobile incomplete. Verificate le cause più frequenti in ordine prima di contattare l'assistenza.",
            },
            {
              type: "steps",
              items: [
                "Controllate in /konto se indirizzo, informazioni fiscali e dati di contatto sono inseriti in modo completo",
                "Verificate nell'immobile se descrizione, foto, dotazioni e almeno una tariffa sono completi",
                "Controllate se è inserito un metodo di pagamento valido per le commissioni",
                "Aprite la scheda «Portali» e leggete il messaggio di errore esatto accanto al portale interessato",
                "Risolvete la lacuna indicata e riattivate la visibilità",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un errore di portale riguarda sempre solo quel singolo portale — gli altri canali continuano a funzionare indipendentemente, purché soddisfino i propri requisiti.",
            },
          ],
        },
      ],
    },
  ],
};
