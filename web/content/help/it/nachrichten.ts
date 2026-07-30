import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Messaggi e ospiti",
  description: "Posta in arrivo, modelli e comunicazione con gli ospiti.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Comunicazione",
      articles: [
        {
          slug: "posteingang",
          title: "La posta in arrivo della piattaforma",
          excerpt: "Tutti i messaggi degli ospiti delle vostre strutture confluiscono centralmente nella posta in arrivo della piattaforma.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Una posta in arrivo per tutte le strutture" },
            {
              type: "p",
              text: "La posta in arrivo della piattaforma riunisce in un unico punto tutti i messaggi dei vostri ospiti — indipendentemente dalla struttura o dal periodo a cui si riferisce la conversazione. La aprite in /nachrichten e vedete lì ogni conversazione come thread separato.",
            },
            { type: "h2", text: "Struttura della posta in arrivo" },
            {
              type: "ul",
              items: [
                "Colonna sinistra: elenco di tutte le conversazioni, le più recenti in alto",
                "Colonna centrale: la cronologia dei messaggi attiva con l'ospite",
                "Colonna destra: contesto della prenotazione — periodo, struttura, dati dell'ospite",
              ],
            },
            { type: "h2", text: "Rispondere a un messaggio" },
            {
              type: "steps",
              items: [
                "Aprite /nachrichten e selezionate la conversazione desiderata",
                "Scrivete la vostra risposta nel campo di testo oppure utilizzate una risposta rapida",
                "Inviate il messaggio — l'ospite lo riceve nello stesso modo in cui ha scritto",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La posta in arrivo della piattaforma mostra esclusivamente la comunicazione diretta tra voi e i vostri ospiti su myNextDays — i messaggi provenienti dai portali continuate a gestirli lì.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Risposte rapide",
          excerpt: "I modelli per le domande frequenti fanno risparmiare tempo nel contatto con gli ospiti.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Cosa sono le risposte rapide" },
            {
              type: "p",
              text: "Le risposte rapide sono blocchi di testo preformulati per domande ricorrenti — ad esempio sull'arrivo, sulla password del Wi-Fi o sulla situazione dei parcheggi. Invece di digitare ogni volta una nuova risposta, inserite con un clic il modello adatto nella [posta in arrivo della piattaforma](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Creare una risposta rapida" },
            {
              type: "steps",
              items: [
                "Aprite /nachrichten e cliccate su «Gestisci risposte rapide»",
                "Cliccate su «Nuovo modello» e assegnate un titolo, ad esempio «Informazioni check-in»",
                "Scrivete il testo della risposta; i segnaposto come nome dell'ospite o data di arrivo vengono inseriti automaticamente all'invio",
                "Salvate il modello — da quel momento è disponibile in ogni conversazione",
              ],
            },
            { type: "h2", text: "Usare le risposte rapide nella pratica quotidiana" },
            {
              type: "p",
              text: "Nella finestra dei messaggi aprite l'elenco dei modelli tramite l'icona a fulmine, selezionate la risposta adatta e, se necessario, la personalizzate ulteriormente prima di inviarla.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Create modelli per le cinque-dieci domande più frequenti — nella pratica ciò copre la maggior parte dei messaggi in arrivo.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Messaggi automatici",
          excerpt: "Conferme, informazioni di check-in e promemoria possono essere inviati automaticamente agli ospiti.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Automatizzare i messaggi ricorrenti" },
            {
              type: "p",
              text: "Invece di inviare manualmente conferme di prenotazione, indicazioni per il check-in o messaggi di ringraziamento, impostateli una volta come regola — myNextDays li invia poi automaticamente al momento giusto prima, durante o dopo il soggiorno.",
            },
            { type: "h2", text: "Trigger tipici per i messaggi automatici" },
            {
              type: "ul",
              items: [
                "Subito dopo la prenotazione — conferma con i dati principali",
                "Pochi giorni prima dell'arrivo — informazioni di check-in e codice di accesso",
                "Il giorno della partenza — ringraziamento e richiesta di una recensione",
              ],
            },
            { type: "h2", text: "Impostare un messaggio automatico" },
            {
              type: "steps",
              items: [
                "Aprite /nachrichten, sezione «Messaggi automatici»",
                "Selezionate il trigger, ad esempio «X giorni prima dell'arrivo»",
                "Inserite il testo — segnaposto come nome dell'ospite, struttura o data di arrivo vengono compilati automaticamente",
                "Attivate la regola; vale per tutte le strutture, salvo diversa limitazione",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "I messaggi automatici compaiono normalmente nella [posta in arrivo della piattaforma](/hilfe/nachrichten/posteingang) e possono essere consultati lì in qualsiasi momento anche in seguito.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Bloccare i messaggi",
          excerpt: "Potete bloccare una persona direttamente dalla cronologia dei messaggi per ulteriori contatti.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Quando ha senso un blocco" },
            {
              type: "p",
              text: "In caso di messaggi offensivi, molestie o comportamento ripetutamente inappropriato, potete bloccare una persona direttamente dal thread dei messaggi. Una persona bloccata non potrà più scrivervi nuovi messaggi né effettuare nuove prenotazioni presso di voi.",
            },
            { type: "h2", text: "Bloccare una persona dal thread" },
            {
              type: "steps",
              items: [
                "Aprite la conversazione interessata nella [posta in arrivo della piattaforma](/hilfe/nachrichten/posteingang)",
                "Cliccate in alto nel thread sul menu e selezionate «Blocca persona»",
                "Confermate l'operazione — il blocco è immediatamente attivo",
              ],
            },
            { type: "h2", text: "Cosa comporta il blocco — e cosa no" },
            {
              type: "ul",
              items: [
                "I nuovi messaggi della persona bloccata non vengono più recapitati",
                "Le nuove richieste di prenotazione della persona vengono rifiutate",
                "Se è in corso una prenotazione di questa persona, la comunicazione resta eccezionalmente possibile per la durata del soggiorno",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un blocco può essere revocato in qualsiasi momento nella panoramica «Persone bloccate» nell'account. Prima di bloccare, verificate se è già in corso una prenotazione.",
            },
          ],
        },
      ],
    },
  ],
};
