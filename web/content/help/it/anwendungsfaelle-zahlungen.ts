import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Pagamenti",
  description: "Gestire correttamente i pagamenti.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Pagamenti",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Configurare un acconto",
          excerpt: "Come richiedere al momento della prenotazione solo un importo parziale invece della somma totale.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Invece di addebitare subito l'intero importo della prenotazione, potete stabilire un acconto come regola di pagamento. Al momento della prenotazione l'ospite paga solo un importo parziale tramite Stripe o PayPal, il resto in seguito con un saldo.",
            },
            {
              type: "steps",
              items: [
                "Aprite nell'immobile la sezione «Regole di pagamento».",
                "Create una nuova regola di tipo «Acconto».",
                "Stabilite l'importo dell'acconto come percentuale o importo fisso della somma totale.",
                "Definite quando l'acconto è dovuto, di norma immediatamente al momento della prenotazione.",
                "Salvate la regola e verificatela con una prenotazione di prova.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L'acconto viene gestito tramite il fornitore di pagamenti configurato per l'immobile. L'importo corrispondente al saldo rimanente si configura in [Automatizzare il saldo](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizzare il saldo",
          excerpt: "Come viene addebitato automaticamente l'importo residuo prima dell'arrivo.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Dopo un acconto rimane un importo residuo da saldare. Invece di monitorarlo manualmente, configurate una regola di pagamento che addebita automaticamente il saldo in un momento prestabilito prima dell'arrivo tramite Stripe o PayPal.",
            },
            {
              type: "steps",
              items: [
                "Aprite nell'immobile la sezione «Regole di pagamento».",
                "Create una nuova regola di tipo «Saldo», a condizione che esista già una regola di acconto.",
                "Stabilite quanti giorni prima dell'arrivo il saldo diventa esigibile.",
                "Attivate l'addebito automatico affinché il fornitore di pagamenti configurato prelevi l'importo autonomamente.",
                "Controllate quindi lo stato del saldo nella sequenza temporale della relativa prenotazione.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Se l'addebito automatico fallisce, ad esempio a causa di una carta scaduta, la prenotazione non viene cancellata automaticamente. Controllate tempestivamente i saldi non riusciti e contattate direttamente l'ospite.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Effettuare un rimborso",
          excerpt: "Come rimborsare a un ospite un importo totalmente o parzialmente.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "In caso di cancellazione o reclamo potete rimborsare a un ospite l'importo pagato, totalmente o parzialmente. Il rimborso avviene tramite lo stesso fornitore di pagamenti con cui è stato effettuato il pagamento originale — Stripe o PayPal.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione interessata nella sequenza temporale della prenotazione.",
                "Selezionate nella sezione «Pagamenti» il pagamento originale da rimborsare.",
                "Scegliete tra rimborso totale o parziale.",
                "In caso di rimborso parziale inserite l'importo desiderato.",
                "Confermate il rimborso e controllate lo stato di pagamento aggiornato nella sequenza temporale.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un rimborso non modifica automaticamente lo stato della prenotazione né le notti occupate nel calendario. In caso di cancellazione, verificate inoltre se le notti interessate devono essere nuovamente liberate nel planning delle occupazioni.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Gestire una cauzione",
          excerpt: "Come configurare una cauzione e liberarla nuovamente dopo il soggiorno.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Una cauzione vi tutela contro eventuali danni durante il soggiorno. Viene impostata come regola di pagamento propria e, a seconda della configurazione dell'immobile, viene preautorizzata oppure addebitata tramite Stripe o PayPal.",
            },
            {
              type: "steps",
              items: [
                "Aprite nell'immobile la sezione «Regole di pagamento» e create una regola di tipo «Cauzione».",
                "Stabilite l'importo della cauzione e il momento dell'autorizzazione, di norma poco prima dell'arrivo.",
                "Dopo il check-out verificate le condizioni dell'immobile.",
                "In caso di condizioni impeccabili, liberate completamente la cauzione tramite la prenotazione.",
                "In caso di danno rimborsate solo la parte non necessaria e documentate il motivo della trattenuta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una cauzione autorizzata ma non addebitata decade automaticamente, a seconda del fornitore di pagamenti, dopo un determinato periodo. Liberate la cauzione tempestivamente dopo il check-out oppure addebitate l'importo necessario per tempo.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Correggere una fattura",
          excerpt: "Come correggere successivamente una fattura già emessa.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "h2",
              text: "Situazione di partenza",
            },
            {
              type: "p",
              text: "Se una fattura già emessa contiene un errore, ad esempio nell'indirizzo di fatturazione o in una voce, correggetela tramite la prenotazione invece di eliminare semplicemente la fattura originale.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione interessata nella sequenza temporale della prenotazione e passate alla sezione «Fatture».",
                "Selezionate la fattura errata.",
                "Create una nota di correzione ovvero una fattura di storno rispetto alla fattura originale.",
                "Create quindi una nuova fattura corretta con i dati esatti.",
                "Inviate nuovamente la fattura corretta all'ospite ovvero all'indirizzo di fatturazione.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Per motivi di tracciabilità, una fattura già inviata non dovrebbe essere sovrascritta direttamente. La correzione tramite una fattura di storno conserva il documento originale e rende la modifica tracciabile.",
            },
          ],
        },
      ],
    },
  ],
};
