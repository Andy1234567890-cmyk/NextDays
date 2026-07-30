import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Prenotazioni e calendario",
  description: "Tenere sotto controllo prenotazioni e calendario.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Prenotazioni e calendario",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Evitare in modo affidabile gli overbooking",
          excerpt: "Come assicurarvi che un immobile non venga mai prenotato due volte.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Un immobile viene venduto contemporaneamente su più canali — portali come Booking, Airbnb & Co., la piattaforma propria e l'app. Un overbooking si verifica quando la disponibilità su un canale non viene bloccata in tempo dopo che è stata effettuata una prenotazione su un altro canale.",
            },
            {
              type: "steps",
              items: [
                "Verificate nel piano di occupazione che ogni immobile corrisponda esattamente a una riga con un'unità prenotabile — nessuna capacità condivisa tra più camere.",
                "Fate creare le nuove prenotazioni esclusivamente tramite il piano di occupazione o i canali collegati, mai descrivendo manualmente singoli giorni.",
                "Dopo ogni prenotazione controllate che le notti prenotate appaiano immediatamente come occupate nel calendario.",
                "In caso di problemi tecnici o manutenzione utilizzate subito lo stop-sell, invece di lasciare il giorno aperto.",
                "In caso di dubbi controllate la cronologia della prenotazione interessata per ricostruire la sequenza temporale.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Non modificate mai manualmente notti o blocchi al di fuori del piano di occupazione — solo così si garantisce che tutti i canali vedano lo stesso stato di disponibilità e non si crei alcuna finestra per una doppia prenotazione.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Spostare una prenotazione in un altro immobile",
          excerpt: "Come spostare correttamente una prenotazione esistente su un altro immobile.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "A volte un ospite deve trasferirsi da un immobile a un altro, ad esempio a causa di un guasto tecnico o su richiesta dell'ospite. Durante il trasferimento le notti di calendario precedenti vengono liberate automaticamente e occupate nuovamente nell'immobile di destinazione.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione interessata nella cronologia della prenotazione.",
                "Selezionate nel menu azioni «Cambia immobile» ovvero «Trasferisci».",
                "Selezionate l'immobile di destinazione e verificatene la disponibilità nel periodo scelto.",
                "Confermate il trasferimento.",
                "Verificate quindi nel piano di occupazione che le vecchie notti nell'immobile di origine vengano nuovamente mostrate come disponibili.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il sistema si occupa automaticamente di liberare le vecchie notti — non è necessario aprire manualmente il periodo di origine. Informate l'ospite del cambio di immobile, soprattutto se dotazione o accesso sono diversi.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Creare una prenotazione a lungo termine",
          excerpt: "Come creare correttamente una prenotazione per un periodo più lungo.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Per gli ospiti a lungo termine — ad esempio diverse settimane o mesi — create una prenotazione come di consueto, ma prestate inoltre attenzione al soggiorno minimo, alle regole di pagamento e alla visibilità sui canali dell'immobile per l'intero periodo.",
            },
            {
              type: "steps",
              items: [
                "Aprite il piano di occupazione dell'immobile desiderato e selezionate l'intero periodo.",
                "Create la prenotazione con i dati dell'ospite e le date di arrivo e partenza previste.",
                "Impostate se necessario una regola di pagamento con acconto e saldo, invece di rendere subito esigibile l'importo completo.",
                "Verificate che nessuna regola di soggiorno minimo o massimo sia in contraddizione con il periodo lungo.",
                "Salvate la prenotazione e controllate che l'intero periodo venga visualizzato correttamente come occupato nel calendario.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Per soggiorni molto lunghi si consiglia un saldo suddiviso in più rate anziché un'unica grande scadenza — così il rischio di pagamento resta contenuto. Per i dettagli vedi [Automatizzare il saldo](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
