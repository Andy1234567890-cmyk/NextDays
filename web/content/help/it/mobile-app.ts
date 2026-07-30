import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "App mobile",
  description: "L'app myNextDays per chi è in movimento.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "L'app myNextDays",
          excerpt: "Un conto, quattro esperienze: ospite, agenzia, owner e collaboratore.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'app myNextDays è la piattaforma mobile per l'intera vostra attività. Non è un prodotto separato, bensì un'interfaccia di pari livello rispetto alla vostra dashboard web — entrambe accedono allo stesso conto e agli stessi dati, solo l'interfaccia è ottimizzata per l'uso in mobilità.",
            },
            { type: "h2", text: "Quattro esperienze in un'unica app" },
            {
              type: "ul",
              items: [
                "Ospite: visualizzare le prenotazioni, comunicare con l'attività, consultare le informazioni sul check-in.",
                "Agenzia: gestire in una panoramica più attività e immobili.",
                "Owner: accesso in sola lettura ai propri immobili, all'occupazione e ai report.",
                "Collaboratore: calendario, attività e piani di pulizia per la gestione operativa quotidiana.",
              ],
            },
            { type: "h2", text: "Quale esperienza visualizzate" },
            {
              type: "p",
              text: "Dopo l'accesso, l'app mostra automaticamente l'esperienza adatta al vostro ruolo — lo stesso ruolo valido anche nella dashboard web. Un collaboratore con diritti limitati vede nell'app esattamente le stesse limitazioni del browser, poiché l'autorizzazione viene verificata lato server.",
            },
            {
              type: "note",
              variant: "info",
              text: "Per maggiori informazioni sui ruoli e su cosa ciascuno può visualizzare, consultate [Ruoli e autorizzazioni](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Non è necessaria una registrazione separata per l'app — accedete semplicemente con le vostre credenziali myNextDays già esistenti.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Installare l'app e accedere",
          excerpt: "Come scaricare l'app myNextDays e accedere.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'app myNextDays è disponibile per iOS e Android. L'accesso avviene con le stesse credenziali della dashboard web — non è necessario un conto separato né una nuova registrazione.",
            },
            { type: "h2", text: "Installazione" },
            {
              type: "steps",
              items: [
                "Aprite l'App Store (iOS) o Google Play (Android).",
                "Cercate «myNextDays».",
                "Installate l'app sul vostro smartphone o tablet.",
                "Aprite l'app dopo l'installazione.",
              ],
            },
            { type: "h2", text: "Accesso" },
            {
              type: "steps",
              items: [
                "Toccate «Accedi».",
                "Inserite il vostro indirizzo e-mail e la vostra password.",
                "Confermate, se richiesto, la verifica a due fattori.",
                "Accederete automaticamente all'esperienza corrispondente al vostro ruolo.",
              ],
            },
            {
              type: "ul",
              items: [
                "Le credenziali di accesso sono identiche a quelle della dashboard web.",
                "Se il vostro accesso è stato revocato, anche l'accesso nell'app viene bloccato immediatamente.",
                "In caso di problemi con la password, utilizzate «Password dimenticata» direttamente nell'app.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Accedete esclusivamente tramite la scheda ufficiale «myNextDays» dell'app store; l'app non richiede mai le credenziali al di fuori della schermata di accesso.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Gestire in mobilità",
          excerpt: "Gestire prenotazioni, messaggi e attività direttamente dallo smartphone.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'app myNextDays è particolarmente adatta alla gestione corrente in mobilità: visualizzate le prenotazioni attuali, rispondete ai messaggi degli ospiti e portate a termine le attività senza dover essere seduti al computer — le modifiche compaiono in tempo reale anche nella dashboard web.",
            },
            { type: "h2", text: "Prenotazioni sotto controllo" },
            {
              type: "p",
              text: "Nella sezione «Prenotazioni» vedete arrivi e partenze, occupazione e stato per ogni immobile. I collaboratori e il personale delle pulizie vedono in questo caso solo le informazioni rilevanti per loro, senza prezzi o dettagli di vendita.",
            },
            { type: "h2", text: "Messaggi e attività" },
            {
              type: "steps",
              items: [
                "Aprite la sezione «Messaggi» per rispondere direttamente alle richieste degli ospiti.",
                "Passate a «Attività» per visualizzare i to-do a voi assegnati.",
                "Toccate un'attività per aprirne i dettagli e completarla.",
                "Contrassegnate come completati gli appuntamenti di pulizia svolti, direttamente sul posto.",
              ],
            },
            {
              type: "ul",
              items: [
                "I nuovi messaggi e le nuove attività compaiono in tempo reale, senza aggiornamento manuale.",
                "Le attività completate sono immediatamente visibili anche nella dashboard web.",
                "Gli owner vedono prenotazioni e report dei propri immobili, ma solo in sola lettura.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le notifiche push vi informano su nuovi messaggi e attività assegnate, non appena le abilitate nelle impostazioni del dispositivo.",
            },
          ],
        },
      ],
    },
  ],
};
