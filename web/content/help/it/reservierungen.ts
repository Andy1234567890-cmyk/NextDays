import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Prenotazioni e soggiorni",
  description: "Gestire, spostare e cancellare le prenotazioni.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Prenotazioni",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Registrare manualmente una prenotazione",
          excerpt:
            "Come registrare direttamente in myNextDays una prenotazione ricevuta per telefono o e-mail.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Quando registrare manualmente" },
            {
              type: "p",
              text: "Non tutte le prenotazioni arrivano tramite un portale o la vostra piattaforma — le richieste ricevute per telefono, e-mail o di persona dovete inserirle voi stessi, in modo che l'immobile risulti correttamente bloccato in myNextDays e non si verifichi una doppia occupazione.",
            },
            {
              type: "steps",
              items: [
                "Aprite Prenotazioni e cliccate su «Nuova prenotazione».",
                "Selezionate l'immobile — ogni immobile in myNextDays è un'unica unità prenotabile, ovvero una camera specifica o una casa vacanze.",
                "Impostate data di arrivo e partenza, oltre al numero di ospiti.",
                "Inserite i dati dell'ospite (nome, contatto, eventualmente indirizzo per la fattura).",
                "Verificate il prezzo proposto e adattatelo se necessario.",
                "Salvate la prenotazione — le notti vengono bloccate immediatamente nel calendario.",
              ],
            },
            { type: "h2", text: "Pagamento e conferma" },
            {
              type: "p",
              text: "Dopo il salvataggio si applicano le stesse regole di pagamento delle prenotazioni online. Se è collegato un fornitore di pagamento, potete inviare direttamente un link di pagamento all'ospite oppure contrassegnare manualmente il pagamento come ricevuto.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Inserite subito le richieste particolari (arrivo anticipato, letti aggiuntivi) nelle note — il team le vedrà nella cronologia della prenotazione.",
            },
            { type: "h2", text: "Dopo la creazione" },
            {
              type: "p",
              text: "La nuova prenotazione compare subito nella [La cronologia della prenotazione](/hilfe/reservierungen/buchungs-zeitleiste), con tutti i passaggi successivi come messaggi, attività e pagamenti riuniti in un unico posto.",
            },
            {
              type: "ul",
              items: [
                "Calendario e portali vengono sincronizzati automaticamente non appena salvate.",
                "Se necessario, l'ospite riceve un messaggio di conferma automatico.",
                "Le modifiche alle date si registrano tramite «Sposta prenotazione».",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "La cronologia della prenotazione",
          excerpt:
            "La cronologia della prenotazione riunisce l'intero svolgimento di una prenotazione in un unico posto.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Cosa mostra la cronologia" },
            {
              type: "p",
              text: "Ogni prenotazione ha una propria cronologia che rappresenta in ordine cronologico l'intero svolgimento — dalla richiesta di prenotazione o dall'importazione dal portale fino al check-out. Così potete vedere a colpo d'occhio cosa è già successo e cosa è in programma.",
            },
            {
              type: "ul",
              items: [
                "Messaggi con l'ospite",
                "Attività, ad esempio pulizie o preparazione",
                "Pagamenti e fatture",
                "Add-on e servizi aggiuntivi prenotati",
                "Spostamenti (move) e cancellazioni",
              ],
            },
            { type: "h2", text: "Usare la cronologia nella pratica quotidiana" },
            {
              type: "steps",
              items: [
                "Aprite Prenotazioni e selezionate la prenotazione desiderata.",
                "Passate alla scheda «Cronologia».",
                "Scorrete in ordine cronologico tutti gli eventi.",
                "Usate le azioni rapide per inviare subito un messaggio o creare un'attività.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se una prenotazione viene spostata o cancellata, anche questo passaggio compare nella cronologia — comprese le notti liberate nel calendario.",
            },
            { type: "h2", text: "Perché è importante" },
            {
              type: "p",
              text: "Poiché team, proprietari e assistenza vedono la stessa cronologia, non si creano lacune informative tra messaggi, attività e pagamenti. I dettagli sui rimborsi si trovano in [Rimborsi](/hilfe/zahlungen/rueckerstattungen), quelli sui servizi aggiuntivi in [Add-on e servizi aggiuntivi](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Spostare una prenotazione",
          excerpt:
            "Come spostare una prenotazione esistente su un nuovo periodo senza creare confusione nel calendario.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Da verificare prima dello spostamento" },
            {
              type: "p",
              text: "Prima di spostare una prenotazione, verificate la disponibilità dell'immobile prenotato nel nuovo periodo. myNextDays libera le notti originariamente riservate solo dopo la conferma del nuovo periodo — così non si crea alcuna lacuna in cui l'immobile risulti erroneamente libero o doppiamente occupato.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione in Prenotazioni.",
                "Selezionate «Sposta» e inserite il nuovo periodo.",
                "Verificate la disponibilità mostrata per le nuove date.",
                "Confermate lo spostamento.",
                "Verificate se il prezzo cambia in base al nuovo numero di notti e adattatelo se necessario.",
              ],
            },
            { type: "h2", text: "Cosa avviene automaticamente" },
            {
              type: "p",
              text: "Dopo la conferma, le vecchie notti vengono correttamente liberate nel calendario e le nuove notti bloccate; i portali collegati vengono aggiornati. L'operazione viene registrata nella cronologia della prenotazione.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Se la prenotazione è arrivata tramite un portale, uno spostamento potrebbe essere soggetto a regole proprie del portale — verificate le condizioni del portale prima di apportare modifiche importanti.",
            },
            { type: "h2", text: "Differenze di pagamento" },
            {
              type: "p",
              text: "Se il prezzo cambia a seguito dello spostamento, adattate di conseguenza le regole di pagamento — vedi [Regole di pagamento](/hilfe/zahlungen/zahlungsregeln). Per maggiori informazioni sull'intero svolgimento di una prenotazione consultate [La cronologia della prenotazione](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Cancellazione e rimborso",
          excerpt:
            "Come cancellare correttamente una prenotazione e avviare, se necessario, un rimborso.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Cancellare una prenotazione" },
            {
              type: "p",
              text: "Una cancellazione libera immediatamente l'immobile per il periodo prenotato — sia nel vostro calendario, sia su tutti i portali collegati. Prima di procedere alla cancellazione, verificate quali condizioni di cancellazione si applicano a questa prenotazione.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione in Prenotazioni.",
                "Selezionate «Cancella» e indicate un motivo.",
                "Verificate l'importo di rimborso proposto.",
                "Confermate la cancellazione.",
              ],
            },
            { type: "h2", text: "Avviare un rimborso" },
            {
              type: "p",
              text: "Se il pagamento è stato gestito tramite un fornitore di pagamento collegato, potete avviare il rimborso direttamente dalla prenotazione. L'importo viene indicato nella valuta impostata per questo immobile. I dettagli sulla procedura si trovano in [Rimborsi](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "È possibile un rimborso totale o parziale",
                "L'operazione compare nella cronologia della prenotazione",
                "Per le prenotazioni da portale si applicano inoltre le regole del rispettivo portale",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una cancellazione non può essere annullata. Verificate con attenzione periodo e ospite prima di confermare.",
            },
            { type: "h2", text: "Dopo la cancellazione" },
            {
              type: "p",
              text: "L'immobile torna immediatamente prenotabile; le attività aperte legate alla prenotazione — ad esempio la preparazione — vengono automaticamente contrassegnate come non più necessarie. L'intera operazione resta tracciabile nella [Cronologia della prenotazione](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in e check-out",
          excerpt: "Come documentare in myNextDays l'arrivo e la partenza di un ospite.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Registrare il check-in" },
            {
              type: "p",
              text: "Il check-in segna l'inizio del soggiorno ed è particolarmente utile in caso di check-in autonomo o consegna delle chiavi da parte del team, per mantenere aggiornato lo stato di ogni prenotazione.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione in Prenotazioni.",
                "Selezionate «Check-in» il giorno dell'arrivo.",
                "Se necessario, aggiungete una nota, ad esempio l'orario o particolarità.",
              ],
            },
            { type: "h2", text: "Check-out e consegna" },
            {
              type: "p",
              text: "Con il check-out contrassegnate il soggiorno come concluso. In molti casi ciò genera automaticamente un'attività di pulizia per l'immobile, in modo che venga preparato per la prenotazione successiva.",
            },
            {
              type: "ul",
              items: [
                "Check-in e check-out fanno parte della cronologia della prenotazione",
                "Gli orari si possono definire per ogni immobile nelle impostazioni dell'immobile",
                "Con l'accesso da mobile il team può registrare check-in e check-out direttamente sul posto",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un check-out mancato non blocca automaticamente le attività successive — verificate regolarmente gli stati scaduti in Prenotazioni.",
            },
            { type: "h2", text: "Collegamento con le attività" },
            {
              type: "p",
              text: "Check-in e check-out sono strettamente collegati alle attività e alla cronologia. Per maggiori informazioni sull'intero svolgimento consultate [La cronologia della prenotazione](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-on e servizi aggiuntivi",
          excerpt:
            "Come offrire agli ospiti servizi aggiuntivi prenotabili come colazione o transfer e registrarli nella prenotazione.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Cosa sono gli add-on" },
            {
              type: "p",
              text: "Gli add-on sono servizi aggiuntivi opzionali per una prenotazione — ad esempio colazione, arrivo anticipato, transfer o check-out posticipato. Vengono impostati per ogni immobile e possono essere aggiunti alla prenotazione dall'ospite stesso o dal vostro team.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'immobile e create in «Add-on» i servizi aggiuntivi desiderati con il relativo prezzo.",
                "Aprite una prenotazione esistente in Prenotazioni.",
                "Selezionate «Aggiungi add-on» e scegliete il servizio desiderato.",
                "Confermate quantità e momento del servizio.",
              ],
            },
            { type: "h2", text: "Fatturazione" },
            {
              type: "p",
              text: "Gli add-on vengono fatturati nella valuta del rispettivo immobile e compaiono come voce separata sulla fattura. Gli add-on già pagati possono essere rimborsati proporzionalmente in caso di cancellazione.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Impostate una volta gli add-on più richiesti a livello centrale sull'immobile — così potrete aggiungerli a ogni nuova prenotazione con pochi clic.",
            },
            { type: "h2", text: "Visibilità per l'ospite" },
            {
              type: "p",
              text: "Se la piattaforma o il proprio sito web sono attivi, gli ospiti possono spesso selezionare gli add-on più adatti già durante la prenotazione stessa. Ogni aggiunta compare poi nella [Cronologia della prenotazione](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Gli add-on possono essere denominati e prezzati individualmente per ogni immobile",
                "È possibile aggiungerli in un secondo momento in qualsiasi momento tramite la prenotazione",
                "Gli add-on cancellati vengono rimborsati proporzionalmente",
              ],
            },
          ],
        },
      ],
    },
  ],
};
