import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portali & Gestore dei canali",
  description: "Gestisci centralmente Booking, Airbnb, Expedia & Co.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Collegare i portali",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Cos'è il gestore dei canali?",
          excerpt:
            "Il gestore dei canali allinea automaticamente prezzi, disponibilità e prenotazioni tra myNextDays e i portali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Un collegamento per tutti i portali" },
            {
              type: "p",
              text: "Il gestore dei canali è il ponte tra myNextDays e i grandi portali di prenotazione come Booking, Airbnb & Co. Invece di gestire prezzi, disponibilità e occupazione separatamente in ogni portale, inserisci tutto una sola volta in myNextDays — il gestore dei canali lo distribuisce automaticamente a tutti i portali collegati.",
            },
            { type: "h2", text: "Cosa viene sincronizzato automaticamente" },
            {
              type: "ul",
              items: [
                "Disponibilità — ogni prenotazione blocca subito la notte su tutti i portali",
                "Prezzi e soggiorni minimi dal tuo calendario prezzi",
                "Le prenotazioni in arrivo dai portali vengono importate automaticamente in myNextDays",
                "Cancellazioni e stop-vendita agiscono su tutti i canali contemporaneamente",
              ],
            },
            { type: "h2", text: "Cosa non dovrai più fare manualmente" },
            {
              type: "p",
              text: "Senza il gestore dei canali, dopo ogni prenotazione dovresti bloccare manualmente la notte in ogni portale — un motivo frequente di doppie prenotazioni. Con il gestore dei canali attivo, myNextDays si occupa di questo allineamento in entrambe le direzioni, più volte al giorno e in tempo reale per le nuove prenotazioni.",
            },
            {
              type: "note",
              variant: "info",
              text: "Il collegamento ai portali si configura una sola volta per l'intero conto. Per ogni singolo oggetto attivi poi solo il mapping — maggiori informazioni in [Assegnare un oggetto a un portale](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Configurare il collegamento ai portali",
          excerpt:
            "Il collegamento ai portali si configura una sola volta per l'intero conto — non di nuovo per ogni oggetto.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Una sola volta per l'intero conto" },
            {
              type: "p",
              text: "Il collegamento ai portali è un'impostazione valida per l'intero conto: colleghi il tuo conto myNextDays esattamente una volta al gestore dei canali. Tutti gli oggetti che crei in seguito utilizzano automaticamente questo unico collegamento — non serve ricrearlo per ogni oggetto.",
            },
            { type: "h2", text: "Come configurare il collegamento" },
            {
              type: "steps",
              items: [
                "Apri /konto e seleziona la sezione «Portali & gestore dei canali»",
                "Fai clic su «Configura collegamento» e conferma i dati della tua attività (indirizzo, contatto, forma giuridica)",
                "Controlla i dati anagrafici ripresi automaticamente — vengono trasmessi a tutti i portali",
                "Completa la configurazione; lo stato passa a «Collegato»",
              ],
            },
            { type: "h2", text: "Passo successivo: assegnare gli oggetti" },
            {
              type: "p",
              text: "Dopo la configurazione una tantum, non è ancora visibile alcun oggetto — per questo assegni ogni oggetto singolarmente a un portale (mapping) e colleghi i portali desiderati come Booking.com o Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza dati anagrafici completi (indirizzo, informazioni fiscali, contatto) i portali rifiutano il collegamento. Controlla prima questi dati in /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Assegnare un oggetto a un portale",
          excerpt:
            "Dopo il collegamento a livello di conto, per ogni oggetto attivi solo il mapping verso il rispettivo portale.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Mapping invece di un nuovo collegamento" },
            {
              type: "p",
              text: "Una volta configurato il collegamento ai portali per l'intero conto, colleghi ogni oggetto solo tramite un cosiddetto mapping: stabilisci quale oggetto myNextDays corrisponde a quale tipo di camera o di offerta nel portale. Questo è un passaggio da fare una sola volta per ogni oggetto.",
            },
            { type: "h2", text: "Come assegnare un oggetto" },
            {
              type: "steps",
              items: [
                "Apri l'oggetto in /objekte e passa alla scheda «Portali»",
                "Scegli il portale desiderato, ad esempio Booking.com o Airbnb",
                "Assegna l'oggetto al tipo di camera o di offerta corrispondente nel portale",
                "Attiva la sincronizzazione — da questo momento prezzi e disponibilità vengono trasmessi",
              ],
            },
            { type: "h2", text: "Un oggetto, più portali" },
            {
              type: "p",
              text: "Un singolo oggetto può essere assegnato contemporaneamente a più portali. Ogni assegnazione è indipendente — puoi ad esempio rendere un oggetto visibile su Booking.com e Airbnb, ma lasciarlo momentaneamente disattivato su Expedia.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Dopo il mapping controlla subito la visibilità — vedi [Visibilità per portale](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Collegare Booking.com",
          excerpt: "Ecco come attivare Booking.com come canale di vendita per un oggetto.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Prerequisito: collegamento a livello di conto" },
            {
              type: "p",
              text: "Prima di attivare Booking.com per un oggetto, il collegamento ai portali a livello di conto deve essere già configurato (vedi [Configurare il collegamento ai portali](/hilfe/portale-kanalmanager/portal-verbindung)). Dopodiché Booking.com per ogni ulteriore oggetto è solo una questione di mapping.",
            },
            { type: "h2", text: "Attivare Booking.com" },
            {
              type: "steps",
              items: [
                "Apri l'oggetto in /objekte, scheda «Portali»",
                "Scegli «Booking.com» dall'elenco dei portali disponibili",
                "Assegna il tipo di camera o di offerta corrispondente e conferma i piani tariffari",
                "Attiva la visibilità — l'oggetto viene messo online dopo la verifica di Booking.com",
              ],
            },
            { type: "h2", text: "Cosa si aspetta Booking.com da te" },
            {
              type: "ul",
              items: [
                "Descrizione completa dell'oggetto, foto e dotazioni",
                "Almeno una tariffa con prezzo e condizioni di cancellazione",
                "Un metodo di pagamento valido per le commissioni",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L'attivazione da parte di Booking.com può richiedere alcune ore. Lo stato nella scheda oggetto «Portali» mostra se il collegamento è già attivo.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Collegare Airbnb",
          excerpt: "Ecco come rendere un oggetto prenotabile su Airbnb tramite il gestore dei canali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Airbnb come ulteriore portale" },
            {
              type: "p",
              text: "Airbnb viene collegato come qualsiasi altro portale tramite il collegamento a livello di conto. Una volta configurato, attivi Airbnb per ogni oggetto tramite il mapping — indipendentemente dal fatto che l'oggetto sia già visibile su Booking.com o su altri portali.",
            },
            { type: "h2", text: "Attivare Airbnb per un oggetto" },
            {
              type: "steps",
              items: [
                "Apri l'oggetto in /objekte, scheda «Portali»",
                "Scegli «Airbnb» dall'elenco dei portali disponibili",
                "Conferma la categoria dell'oggetto e il tipo di offerta assegnato",
                "Controlla foto, dotazioni e regole della casa — Airbnb richiede dati completi prima dell'attivazione",
                "Attiva la visibilità per Airbnb",
              ],
            },
            { type: "h2", text: "Dopo l'attivazione" },
            {
              type: "p",
              text: "Non appena Airbnb ha approvato l'oggetto, prezzi e disponibilità vengono gestiti automaticamente tramite il gestore dei canali. Le prenotazioni in arrivo su Airbnb compaiono poi automaticamente nel tuo calendario delle prenotazioni.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza condizioni di cancellazione e regole della casa memorizzate, Airbnb rifiuta l'attivazione. Completa prima questi dati nell'oggetto.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sincronizzare prezzi e disponibilità",
          excerpt:
            "Prezzi e disponibilità vengono trasmessi automaticamente a tutti i portali collegati.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Un calendario, tutti i portali" },
            {
              type: "p",
              text: "Gestisci prezzi e disponibilità esclusivamente nel calendario myNextDays del rispettivo oggetto. Il gestore dei canali trasmette automaticamente ogni modifica a tutti i portali a cui l'oggetto è collegato tramite mapping attivo — senza che tu debba inserire nulla due volte.",
            },
            { type: "h2", text: "Cosa viene trasmesso" },
            {
              type: "ul",
              items: [
                "Prezzi giornalieri dal tuo calendario prezzi o dai piani tariffari",
                "Notti disponibili e blocchi",
                "Soggiorno minimo e restrizioni di arrivo/partenza",
                "Giorni di stop-vendita — questi si bloccano automaticamente su tutti i portali",
              ],
            },
            { type: "h2", text: "Quanto velocemente agisce la sincronizzazione" },
            {
              type: "p",
              text: "Le modifiche a prezzi e disponibilità vengono trasmesse ai portali entro pochi minuti. Le nuove prenotazioni bloccano immediatamente le notti interessate, così la stessa notte non può essere venduta di nuovo su nessun altro canale.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Maggiori informazioni sul blocco di singoli giorni su tutti i canali sono disponibili in [Evitare le overbooking](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Ricevere le prenotazioni dai portali",
          excerpt: "Le prenotazioni da Booking, Airbnb & Co. arrivano automaticamente nel tuo calendario.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Importazione automatica" },
            {
              type: "p",
              text: "Se un ospite prenota tramite un portale come Booking.com o Airbnb, il gestore dei canali importa automaticamente la prenotazione in myNextDays. Non devi trasferire nulla manualmente — la prenotazione compare nel calendario e nell'elenco delle prenotazioni dell'oggetto interessato.",
            },
            { type: "h2", text: "Cosa succede con una prenotazione da portale" },
            {
              type: "steps",
              items: [
                "Il portale segnala la nuova prenotazione al gestore dei canali",
                "myNextDays crea la prenotazione con dati dell'ospite, periodo e prezzo",
                "Le notti prenotate vengono bloccate immediatamente su tutti gli altri canali",
                "Ricevi una notifica e trovi la prenotazione nel calendario",
              ],
            },
            { type: "h2", text: "Cancellazioni e modifiche" },
            {
              type: "p",
              text: "Se un ospite cancella tramite il portale o modifica il periodo, anche questo viene trasmesso automaticamente a myNextDays e le notti interessate vengono nuovamente liberate.",
            },
            {
              type: "note",
              variant: "info",
              text: "Le prenotazioni da portale sono riconoscibili nei dettagli della prenotazione dal badge di provenienza, ad esempio Booking.com o Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Evitare le overbooking",
          excerpt: "Stop-vendita e blocchi automatici impediscono le doppie prenotazioni su più portali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Perché si verificano le overbooking" },
            {
              type: "p",
              text: "Senza una gestione centralizzata capita facilmente che la stessa notte venga venduta contemporaneamente su due portali — ad esempio quando prezzi e disponibilità vengono gestiti manualmente in più sistemi. Il gestore dei canali chiude questa falla: ogni prenotazione su ogni canale blocca immediatamente tutti gli altri canali.",
            },
            { type: "h2", text: "I tuoi strumenti contro le overbooking" },
            {
              type: "ul",
              items: [
                "Blocco automatico: ogni nuova prenotazione — indipendentemente dal canale — blocca le notti ovunque",
                "Stop-vendita: blocca manualmente un giorno su tutti i canali contemporaneamente, ad esempio per uso personale o manutenzione",
                "Soggiorno minimo e restrizioni di arrivo evitano prenotazioni brevi non desiderate",
              ],
            },
            { type: "h2", text: "Impostare lo stop-vendita" },
            {
              type: "steps",
              items: [
                "Apri il calendario di occupazione dell'oggetto",
                "Seleziona il giorno o il periodo interessato",
                "Scegli «Stop-vendita» — il giorno risulta poi bloccato su tutti i portali oltre che su sito web e piattaforma",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Lo stop-vendita vale senza eccezioni per tutti i canali. Non è possibile bloccare un giorno solo per un singolo portale e lasciarlo aperto per gli altri.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Visibilità per portale",
          excerpt: "Ogni portale può essere attivato o disattivato indipendentemente dal sito web e dal marketplace della piattaforma.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Tre canali di vendita indipendenti" },
            {
              type: "p",
              text: "Un oggetto può essere venduto contemporaneamente tramite più canali: i portali (Booking, Airbnb & Co.), il marketplace della piattaforma myBestDays e il tuo sito web personale. Ogni canale ha un proprio interruttore di visibilità — sono completamente indipendenti tra loro.",
            },
            { type: "h2", text: "Gestire la visibilità per portale" },
            {
              type: "p",
              text: "All'interno dei portali, anche ogni singolo portale è commutabile separatamente. Un oggetto può essere ad esempio attivo su Booking.com ma disattivato su Airbnb — entrambe le assegnazioni restano comunque valide.",
            },
            { type: "h2", text: "Come modificare la visibilità" },
            {
              type: "steps",
              items: [
                "Apri l'oggetto in /objekte, scheda «Portali»",
                "Attiva o disattiva singolarmente il canale desiderato (singolo portale, sito web o marketplace della piattaforma)",
                "Salva — la modifica ha effetto entro pochi minuti",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Lo stato dell'oggetto (attivo/inattivo) e lo stop-vendita agiscono in modo sovraordinato su tutti i canali. Gli interruttori di visibilità controllano solo su quali canali aggiuntivi appare un oggetto già attivo.",
            },
          ],
        },
        {
          slug: "bewertungen",
          title: "Recensioni di tutti i canali",
          excerpt: "Le recensioni dei portali e di myBestDays confluiscono in un unico elenco — ed è lì che rispondi.",
          updated: "Aggiornato: agosto 2026",
          body: [
            { type: "h2", text: "Un elenco per tutti i canali" },
            {
              type: "p",
              text: "In /bewertungen vede ogni recensione dei suoi alloggi in un unico posto: quelle dei portali (Booking.com, Airbnb, Expedia) e quelle del marketplace myBestDays. I portali valutano su 10, myBestDays su 5 stelle — vengono mostrate le stelle, con accanto il voto originale, così nulla appare distorto.",
            },
            { type: "h2", text: "Rispondere a una recensione" },
            {
              type: "steps",
              items: [
                "Apra /bewertungen e filtri all’occorrenza su «Solo senza risposta»",
                "Clicchi su «Rispondi» sulla recensione e scriva la sua risposta",
                "Invii — per un portale la risposta va prima lì e solo dopo compare qui come risposta data",
              ],
            },
            { type: "h2", text: "Cos’altro vede" },
            {
              type: "ul",
              items: [
                "Media, numero e tasso di risposta per canale come indicatori",
                "«Non ancora pubblicata»: l’altra parte non ha ancora recensito e i 14 giorni scorrono",
                "«Termine di risposta scaduto»: il portale non accetta più una risposta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le recensioni dei portali sono visibili solo a lei. Sul marketplace myBestDays e sul suo sito compaiono esclusivamente le sue recensioni myBestDays verificate — Booking.com e Airbnb consentono la ripubblicazione delle loro recensioni solo in misura limitata.",
            },
          ],
        },
      ],
    },
  ],
};
