import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Account e abbonamento",
  description: "Dati anagrafici, tariffa, sicurezza e 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Account",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Dati anagrafici dell'attività",
          excerpt: "Gestite centralmente ragione sociale, indirizzo e dati di contatto della vostra attività.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "In /konto myNextDays riunisce tutte le funzioni dell'attività e dell'account come sezioni su un'unica pagina — non dovete passare tra molte sottopagine. I dati anagrafici dell'attività ne costituiscono la base: ragione sociale, forma giuridica, indirizzo e dati di contatto, utilizzati per le fatture, i portali e la comunicazione con gli ospiti.",
            },
            { type: "h2", text: "Aprire e modificare i dati anagrafici" },
            {
              type: "steps",
              items: [
                "Aprite /konto.",
                "Passate alla sezione «Dati anagrafici dell'attività».",
                "Verificate ragione sociale, indirizzo, numero di telefono e indirizzo e-mail per eventuali richieste.",
                "Apportate le vostre modifiche.",
                "Salvate la sezione.",
              ],
            },
            { type: "h2", text: "Perché questi dati sono importanti" },
            {
              type: "p",
              text: "I dati anagrafici dell'attività confluiscono nelle fatture, nella registrazione presso i portali collegati e nelle indicazioni obbligatorie per legge come le note legali. Un indirizzo incompleto o non aggiornato può causare fatture errate o ritardare i collegamenti ai portali.",
            },
            {
              type: "ul",
              items: [
                "Ragione sociale e forma giuridica compaiono su tutte le fatture emesse.",
                "L'indirizzo è necessario per la registrazione presso i portali.",
                "I dati di contatto fungono da canale alternativo se le notifiche di sistema non arrivano.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se modificate il vostro indirizzo di fatturazione, controllate poi le fatture già emesse in [Fatturazione e calcolatore tariffario](/hilfe/konto-abo/abrechnung-tarifrechner) — i documenti esistenti non vengono adattati retroattivamente.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abbonamento e tariffa",
          excerpt: "La vostra tariffa determina il contingente di strutture — il numero di strutture prenotate è visibile in ogni momento nell'account.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Il vostro abbonamento myNextDays comprende un contingente di strutture: il numero massimo di strutture (camere o case vacanza) che potete gestire attivamente allo stesso tempo. Il numero di strutture attualmente prenotate viene mostrato nella sezione «Abbonamento e tariffa» in /konto, insieme al contingente residuo.",
            },
            { type: "h2", text: "Tenere sotto controllo il contingente" },
            {
              type: "p",
              text: "Il contingente viene applicato lato server: se raggiungete il limite massimo della vostra tariffa, non è possibile creare un'ulteriore struttura finché non disattivate una struttura esistente o ampliate la vostra tariffa. Questo vale indipendentemente dal fatto che la nuova struttura sia una camera o una casa vacanza — entrambe contano allo stesso modo per il contingente.",
            },
            {
              type: "steps",
              items: [
                "Aprite /konto e la sezione «Abbonamento e tariffa».",
                "Verificate il numero di strutture prenotate rispetto al contingente della vostra tariffa.",
                "Se necessario, scegliete una tariffa superiore per creare altre strutture.",
                "Confermate il cambio di tariffa.",
              ],
            },
            {
              type: "ul",
              items: [
                "Ogni struttura conta singolarmente per il contingente, indipendentemente dal tipo di struttura.",
                "Un cambio di tariffa si riflette immediatamente sul contingente disponibile.",
                "Un downgrade è possibile solo se il numero di strutture attive rientra nel nuovo contingente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un downgrade a una tariffa con un contingente inferiore viene rifiutato finché sono attive più strutture di quante ne consenta la nuova tariffa. Disattivate prima le strutture in eccesso.",
            },
            {
              type: "note",
              variant: "info",
              text: "I dettagli su fatture e calcolo tariffario si trovano in [Fatturazione e calcolatore tariffario](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Fatturazione e calcolatore tariffario",
          excerpt: "Indirizzo di fatturazione, fatture precedenti e il calcolatore tariffario per il vostro contingente di strutture.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La sezione «Fatturazione e calcolatore tariffario» in /konto riunisce tutto ciò che riguarda la fatturazione: il vostro indirizzo di fatturazione, l'elenco delle fatture precedenti da scaricare e un calcolatore tariffario con cui potete verificare i costi del vostro contingente di strutture attuale o di uno superiore.",
            },
            { type: "h2", text: "Indirizzo di fatturazione e fatture" },
            {
              type: "p",
              text: "L'indirizzo di fatturazione può differire dall'indirizzo dell'attività, ad esempio se i documenti vengono ricevuti da uno studio commercialista. Le fatture già emesse sono elencate in ordine cronologico; ognuna può essere scaricata in formato PDF.",
            },
            { type: "h2", text: "Usare il calcolatore tariffario" },
            {
              type: "steps",
              items: [
                "Aprite /konto e la sezione «Fatturazione e calcolatore tariffario».",
                "Inserite nel calcolatore tariffario il numero di strutture desiderato.",
                "Confrontate i costi risultanti per ogni livello di tariffa.",
                "Se necessario, passate direttamente dal calcolatore alla tariffa adatta.",
              ],
            },
            {
              type: "ul",
              items: [
                "Il calcolatore tariffario mostra i costi nella valuta impostata per il vostro account.",
                "Le fatture restano disponibili per lo scaricamento in modo permanente.",
                "L'indirizzo di fatturazione può essere gestito indipendentemente dai dati anagrafici dell'attività.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Confrontate regolarmente con il calcolatore tariffario se il vostro contingente di strutture corrisponde ancora al numero di strutture effettivamente prenotate — vedi [Abbonamento e tariffa](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Modificare password ed e-mail",
          excerpt: "Le modifiche critiche per la sicurezza richiedono un nuovo accesso e un passaggio di conferma.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Password e indirizzo e-mail sono tra i dati più critici per la sicurezza del vostro account. myNextDays richiede quindi per entrambe le modifiche una nuova autenticazione — confermate la modifica con la vostra password attuale, anche se siete già collegati.",
            },
            { type: "h2", text: "Modificare la password" },
            {
              type: "steps",
              items: [
                "Aprite /konto e la sezione «Modificare password ed e-mail».",
                "Inserite la vostra password attuale per confermare.",
                "Impostate la nuova password e ripetetela.",
                "Salvate la modifica.",
              ],
            },
            { type: "h2", text: "Modificare l'indirizzo e-mail" },
            {
              type: "p",
              text: "Il cambio dell'indirizzo e-mail avviene con doppia conferma: dopo aver confermato la password attuale, ricevete un link di conferma al NUOVO indirizzo. Solo cliccando su questo link la modifica diventa effettiva — l'indirizzo precedente resta attivo fino ad allora, così l'accesso al vostro account non viene mai interrotto.",
            },
            {
              type: "ul",
              items: [
                "Senza la password attuale non è possibile modificare né la password né l'e-mail.",
                "Il link di conferma per il nuovo indirizzo e-mail ha una validità limitata nel tempo.",
                "Fino alla conferma, il precedente indirizzo e-mail resta attivo per l'accesso e le notifiche.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dopo una modifica dell'e-mail controllate anche l'autenticazione a due fattori — vedi [Autenticazione a due fattori](/hilfe/konto-abo/zwei-faktor) — nel caso in cui i codici di ripristino fossero legati al vecchio indirizzo.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Autenticazione a due fattori",
          excerpt: "Un passaggio di accesso aggiuntivo protegge il vostro account da accessi non autorizzati.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'autenticazione a due fattori (2FA) integra la vostra password con un secondo fattore tramite un'app di autenticazione. Così una password rubata da sola non basta più per accedere al vostro account myNextDays.",
            },
            { type: "h2", text: "Attivare la 2FA" },
            {
              type: "steps",
              items: [
                "Aprite /konto e la sezione «Autenticazione a due fattori».",
                "Confermate la vostra password attuale per la nuova autenticazione.",
                "Scansionate il codice QR mostrato con un'app di autenticazione.",
                "Inserite il codice generato per confermare.",
                "Conservate i codici di ripristino mostrati in un luogo sicuro.",
              ],
            },
            { type: "h2", text: "Disattivare la 2FA" },
            {
              type: "p",
              text: "Anche la disattivazione dell'autenticazione a due fattori richiede una nuova autenticazione con la vostra password attuale. In questo modo myNextDays impedisce che qualcuno con una sessione già aperta disattivi semplicemente la vostra protezione.",
            },
            {
              type: "ul",
              items: [
                "I codici di ripristino consentono l'accesso in caso di smarrimento dell'app di autenticazione.",
                "Ogni codice di ripristino è utilizzabile una sola volta.",
                "Attivazione e disattivazione della 2FA sono ugualmente vincolate a una conferma della password.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Conservate i vostri codici di ripristino separatamente dal dispositivo con l'app di autenticazione, ad esempio in un gestore di password.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Cronologia dei dispositivi",
          excerpt: "Tenete sotto controllo da quali dispositivi è collegato il vostro account.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La cronologia dei dispositivi in /konto vi mostra su quali dispositivi il vostro account è attualmente collegato — con tipo di dispositivo, posizione approssimativa e orario dell'ultima attività. Così riconoscete rapidamente se un accesso proviene effettivamente da voi.",
            },
            { type: "h2", text: "Controllare la cronologia dei dispositivi" },
            {
              type: "steps",
              items: [
                "Aprite /konto e la sezione «Cronologia dei dispositivi».",
                "Esaminate l'elenco dei dispositivi collegati.",
                "Se riconoscete un dispositivo sconosciuto, disconnettetelo.",
                "Successivamente, per sicurezza, modificate la vostra password.",
              ],
            },
            { type: "h2", text: "Quando è utile dare un'occhiata" },
            {
              type: "p",
              text: "Controllate la cronologia dei dispositivi in particolare dopo una modifica della password o dell'e-mail, nonché dopo l'utilizzo di un dispositivo estraneo o pubblico. Una voce sconosciuta è un chiaro segnale di allarme di accesso non autorizzato.",
            },
            {
              type: "ul",
              items: [
                "Ogni voce mostra tipo di dispositivo, posizione approssimativa e ultima attività.",
                "I singoli dispositivi possono essere disconnessi in modo mirato, senza compromettere gli altri.",
                "Un dispositivo non riconosciuto è motivo per un cambio password immediato.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Se non riconoscete un dispositivo, disconnettetelo subito e cambiate poi la vostra password in [Modificare password ed e-mail](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Privacy",
          excerpt: "Gestite l'indicizzazione sui motori di ricerca per ogni struttura ed esportate i vostri dati.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Nella sezione «Privacy» in /konto gestite due aspetti: se le pagine delle vostre strutture possono essere indicizzate dai motori di ricerca e come esportare i dati memorizzati presso myNextDays.",
            },
            { type: "h2", text: "Indicizzazione sui motori di ricerca per struttura" },
            {
              type: "p",
              text: "Per impostazione predefinita, l'indicizzazione sui motori di ricerca è disattivata per le nuove strutture. Solo quando la attivate consapevolmente per ogni struttura, motori di ricerca come Google possono inserire la pagina pubblica della struttura nel proprio indice. In questo modo mantenete il controllo su quali strutture sono reperibili al di fuori dei portali e della piattaforma propria.",
            },
            {
              type: "steps",
              items: [
                "Aprite /konto e la sezione «Privacy».",
                "Selezionate la struttura desiderata dall'elenco.",
                "Attivate o disattivate l'indicizzazione sui motori di ricerca.",
                "In presenza di più strutture, utilizzate l'interruttore collettivo per impostarle tutte in modo uniforme.",
              ],
            },
            { type: "h2", text: "Esportare i dati" },
            {
              type: "p",
              text: "Tramite la funzione di esportazione dati richiedete una copia completa dei dati memorizzati nel vostro account. L'esportazione viene predisposta e successivamente resa disponibile per lo scaricamento.",
            },
            {
              type: "ul",
              items: [
                "L'indicizzazione è gestibile singolarmente per ogni struttura, con interruttore collettivo per tutte le strutture.",
                "Le nuove strutture partono di norma senza indicizzazione sui motori di ricerca.",
                "L'esportazione dati contiene i dati del vostro account e delle strutture in forma strutturata.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L'indicizzazione sui motori di ricerca è indipendente dalla visibilità sui portali e sul marketplace proprio — riguarda esclusivamente la pagina pubblica della struttura sui motori di ricerca.",
            },
          ],
        },
      ],
    },
  ],
};
