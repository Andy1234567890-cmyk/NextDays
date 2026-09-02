import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Piattaforma (Marketplace)",
  description: "Vendere sul marketplace di myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marketplace",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Il marketplace di myBestDays",
          excerpt: "Il marketplace globale di myBestDays è un canale di prenotazione a sé stante, accanto ai portali e al sito web.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Il marketplace di myBestDays (/plattform) è il canale di prenotazione globale di myBestDays stesso — paragonabile a Booking o Airbnb, ma parte della stessa piattaforma. Qui gli ospiti cercano tra le strutture di tutte le attività collegate e prenotano direttamente.",
            },
            { type: "h2", text: "Non «diretto», ma un canale di pari livello" },
            {
              type: "p",
              text: "Il marketplace non sostituisce la prenotazione diretta tramite il vostro sito web. È un terzo canale di vendita autonomo, con un proprio asse di visibilità, una propria base di ospiti e una propria commissione — esattamente come un portale, solo che è gestito da myBestDays stesso.",
            },
            { type: "h2", text: "Come le strutture arrivano sul marketplace" },
            {
              type: "ul",
              items: [
                "La struttura deve essere attiva (lo stato della struttura consente la vendita).",
                "La visibilità sul marketplace deve essere attivata — separatamente da portali e sito web.",
                "Per il periodo desiderato deve esserci disponibilità nel calendario.",
              ],
            },
            { type: "h2", text: "Prenotazioni dal marketplace" },
            {
              type: "p",
              text: "Una prenotazione dal marketplace blocca immediatamente le notti corrispondenti su tutti gli altri canali — esattamente come una prenotazione da portale o da sito web. Appare nel vostro calendario e nelle prenotazioni come qualsiasi altra prenotazione, contrassegnata con il canale «Piattaforma».",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell e uno stato inattivo della struttura agiscono su tutti i canali e bloccano anche il marketplace — indipendentemente dall'interruttore di visibilità sul marketplace.",
            },
            {
              type: "p",
              text: "Per sapere come abilitare una struttura per il marketplace, consultate [Inserire una struttura nel marketplace](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Inserire una struttura nel marketplace",
          excerpt: "La visibilità sul marketplace è un interruttore a sé stante, separato da portali e sito web.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La visibilità sul marketplace si gestisce tramite un interruttore dedicato sulla struttura — indipendentemente dal fatto che la stessa struttura sia visibile anche sui portali o sul vostro sito web.",
            },
            { type: "h2", text: "Come inserire una struttura" },
            {
              type: "steps",
              items: [
                "Aprite la struttura in Strutture.",
                "Passate alla scheda Visibilità.",
                "Attivate l'interruttore Marketplace della piattaforma.",
                "Verificate che lo stato della struttura sia attivo e che ci sia disponibilità nel calendario.",
              ],
            },
            { type: "h2", text: "Requisito: profilo completo" },
            {
              type: "p",
              text: "Il marketplace mostra solo strutture con dati completi — foto di copertina, descrizione, dotazioni e prezzo base devono essere presenti. Se mancano dati obbligatori, la struttura resta invisibile anche con l'interruttore attivato.",
            },
            {
              type: "ul",
              items: [
                "Almeno una foto di copertina e una descrizione",
                "Caratteristiche delle dotazioni dall'elenco per categoria",
                "Occupazione e prezzo base nella valuta della struttura impostata",
                "Disponibilità nel calendario per il periodo desiderato",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Cliccando su Pubblica, myNextDays abilita contemporaneamente i portali e il sito web. myBestDays è un canale obbligatorio: ogni proprietà è elencata lì e appare non appena abbiamo approvato l'annuncio.",
            },
            { type: "h2", text: "Rimuovere nuovamente la visibilità" },
            {
              type: "p",
              text: "myBestDays non può essere deselezionato singolarmente. Se una proprietà non deve più essere venduta, utilizzi \"Sospendi vendita\" — questo la rimuove dalla vendita su tutti i portali, sul sito web e sul marketplace contemporaneamente. Le prenotazioni già confermate rimangono inalterate e continuano come di consueto, veda [Commissione marketplace](/aiuto/piattaforma-marketplace/commissione-marketplace).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Commissione del marketplace",
          excerpt: "Per ogni prenotazione mediata tramite il marketplace si applica la commissione prevista dal vostro piano tariffario.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Come per qualsiasi portale di prenotazione, per le prenotazioni concluse tramite il marketplace di myBestDays si applica una commissione. Viene calcolata per ogni prenotazione ed è indipendente da eventuali commissioni per i portali.",
            },
            { type: "h2", text: "Come viene calcolata la commissione" },
            {
              type: "p",
              text: "L'importo dipende dalla commissione prevista dal piano tariffario della vostra attività. Potete consultare l'aliquota attuale in qualsiasi momento in Account, nella sezione Fatturazione — lì non viene assunto alcun valore forfettario, ma viene mostrata l'aliquota effettivamente valida per il vostro piano tariffario.",
            },
            { type: "h2", text: "Dove consultare la commissione" },
            {
              type: "steps",
              items: [
                "Aprite il menu Account.",
                "Passate alla sezione Fatturazione.",
                "Aprite una prenotazione del marketplace per vedere nel dettaglio fatturato e commissione.",
                "Controllate il riepilogo delle commissioni per il periodo di fatturazione in corso.",
              ],
            },
            { type: "h2", text: "Differenza rispetto alle commissioni dei portali" },
            {
              type: "ul",
              items: [
                "La commissione del marketplace si applica esclusivamente alle prenotazioni tramite il marketplace di myBestDays.",
                "Le prenotazioni da portale (Booking, Airbnb e altri) sono soggette alle condizioni del rispettivo portale.",
                "Le prenotazioni dal sito web sono soggette alle condizioni previste dal vostro piano tariffario, senza commissione del marketplace.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "La commissione viene determinata automaticamente in base al vostro piano tariffario. Un piano tariffario mancante o poco chiaro genera un messaggio di errore esplicito invece di un valore stimato.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profilo ospite e recensioni",
          excerpt: "Gli ospiti del marketplace dispongono di un profilo con la cronologia delle prenotazioni e possono lasciare recensioni.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Gli ospiti che prenotano tramite il marketplace di myBestDays creano un proprio profilo ospite. Al suo interno si raccolgono le loro prenotazioni, i messaggi con le attività e le recensioni rilasciate — in modo simile a un account ospite su un portale.",
            },
            { type: "h2", text: "Cosa vedete come attività" },
            {
              type: "p",
              text: "Nei dettagli della prenotazione di una prenotazione dal marketplace trovate il profilo dell'ospite con i soggiorni precedenti presso la vostra attività e, se autorizzato dall'ospite, le recensioni pubblicamente visibili relative ad altre strutture.",
            },
            { type: "h2", text: "Recensioni dopo il soggiorno" },
            {
              type: "steps",
              items: [
                "Dopo il check-out, l'ospite riceve un invito a lasciare una recensione.",
                "La recensione appare, dopo una breve verifica, sulla pagina della struttura nel marketplace.",
                "Come attività potete rispondere pubblicamente a ogni recensione.",
                "Le recensioni non pertinenti o offensive possono essere segnalate per la verifica tramite Segnala.",
              ],
            },
            {
              type: "ul",
              items: [
                "Le recensioni sono legate a una prenotazione effettiva — nessuna recensione senza soggiorno.",
                "L'ospite valuta pulizia, comunicazione, posizione e rapporto qualità-prezzo.",
                "La vostra risposta è visibile a tutti i visitatori del marketplace.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le buone recensioni influiscono direttamente sul posizionamento della vostra struttura nella ricerca del marketplace — rispondete alle critiche in modo tempestivo e obiettivo.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Persone bloccate",
          excerpt: "Un'attività può bloccare un ospite, impedendo così messaggi e prenotazioni.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Se sorgono problemi con un ospite, potete bloccarlo come attività. Una persona bloccata non può più inviarvi messaggi né effettuare nuove prenotazioni presso la vostra attività.",
            },
            { type: "h2", text: "Bloccare una persona" },
            {
              type: "steps",
              items: [
                "Aprite la cronologia dei messaggi o la prenotazione relativa all'ospite in questione.",
                "Fate clic su Blocca ospite.",
                "Confermate la finestra di dialogo: il blocco ha effetto immediato.",
                "La persona bloccata compare successivamente in Account sotto Persone bloccate.",
              ],
            },
            { type: "h2", text: "Cosa comporta il blocco" },
            {
              type: "ul",
              items: [
                "L'ospite non può più inviare nuovi messaggi alla vostra attività.",
                "L'ospite non può effettuare nuove prenotazioni presso la vostra attività.",
                "Una prenotazione in corso con un arrivo già confermato entro le prossime due settimane non è interessata dal blocco, in modo che il soggiorno possa svolgersi regolarmente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Il blocco vale esclusivamente per la vostra attività. Le altre attività sul marketplace non vedono il blocco e non ne sono interessate.",
            },
            { type: "h2", text: "Rimuovere nuovamente il blocco" },
            {
              type: "p",
              text: "Aprite Account e quindi Persone bloccate. Selezionate la voce e fate clic su Rimuovi blocco: l'ospite potrà quindi tornare a inviare messaggi e a prenotare.",
            },
          ],
        },
      ],
    },
  ],
};
