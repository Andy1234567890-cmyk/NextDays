import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Proprietari e rendiconti",
  description: "Account proprietari, rendiconti e commissioni.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Proprietari",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Creare un proprietario",
          excerpt: "Come creare un nuovo account proprietario in myNextDays.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "I proprietari sono account propri in myNextDays, tramite i quali gestite immobili appartenenti a una determinata persona o società. Un account proprietario riceve un accesso limitato, di sola lettura, ai propri immobili, senza poter apportare modifiche alla gestione.",
            },
            { type: "h2", text: "Creare un nuovo account proprietario" },
            {
              type: "steps",
              items: [
                "Aprite la sezione «Proprietari» nel menu principale.",
                "Cliccate su «Crea nuovo proprietario».",
                "Inserite nome, indirizzo e-mail e dati di contatto.",
                "Se necessario, inserite l'indirizzo di fatturazione per i rendiconti.",
                "Salvate l'account.",
              ],
            },
            { type: "h2", text: "Configurare l'accesso" },
            {
              type: "p",
              text: "Dopo la creazione potete inviare al proprietario un invito per il proprio accesso. Il proprietario si autentica quindi con credenziali proprie e vede esclusivamente gli immobili a lui assegnati.",
            },
            {
              type: "ul",
              items: [
                "Un account proprietario può comprendere più immobili.",
                "Ogni immobile appartiene esattamente a un proprietario.",
                "I dati di contatto e l'indirizzo di fatturazione possono essere modificati in qualsiasi momento in un secondo tempo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Per sapere come assegnare un immobile esistente a un proprietario, consultate [Assegnare un immobile a un proprietario](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Assegnare un immobile a un proprietario",
          excerpt: "Ogni immobile appartiene esattamente a un proprietario — ecco come impostare l'assegnazione.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays ogni immobile appartiene esattamente a un proprietario. Non è prevista un'assegnazione multipla — se un immobile deve appartenere a un altro proprietario, rimuovete prima l'assegnazione esistente prima di impostarne una nuova.",
            },
            { type: "h2", text: "Effettuare l'assegnazione" },
            {
              type: "steps",
              items: [
                "Aprite l'immobile in «Immobili».",
                "Passate alla scheda «Proprietario».",
                "Selezionate dall'elenco il proprietario responsabile.",
                "Confermate l'assegnazione.",
                "Salvate la modifica sull'immobile.",
              ],
            },
            { type: "h2", text: "Cambio di proprietario" },
            {
              type: "p",
              text: "Se il proprietario di un immobile cambia, ad esempio a seguito di una vendita, sostituite l'assegnazione esistente con quella nuova. I rendiconti già creati per periodi passati restano assegnati al proprietario originario.",
            },
            {
              type: "ul",
              items: [
                "Un immobile può essere assegnato in ogni momento a un solo proprietario.",
                "Senza assegnazione l'immobile non compare in nessun accesso proprietario.",
                "I rendiconti passati restano conservati presso il proprietario originario.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L'assegnazione multipla di un immobile a più proprietari è esclusa — il sistema non consente una seconda assegnazione contemporanea.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Rendiconto proprietario (Statement)",
          excerpt: "Come creare uno statement con le entrate al netto della commissione per un proprietario.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Il rendiconto proprietario, chiamato anche statement, riepiloga per un periodo selezionato tutte le entrate degli immobili assegnati e sottrae la commissione concordata. Il risultato è l'importo che pagate al proprietario.",
            },
            { type: "h2", text: "Creare lo statement" },
            {
              type: "steps",
              items: [
                "Aprite la sezione «Proprietari» e selezionate il proprietario desiderato.",
                "Passate alla scheda «Rendiconto».",
                "Selezionate il periodo di rendicontazione.",
                "Controllate le prenotazioni e le entrate elencate per ogni immobile.",
                "Fate creare lo statement con la commissione già dedotta.",
              ],
            },
            { type: "h2", text: "Struttura dello statement" },
            {
              type: "p",
              text: "Uno statement elenca per ogni immobile le entrate lorde dalle prenotazioni, la commissione dedotta e l'importo di pagamento risultante. I costi aggiuntivi come pulizia o commissioni possono, a seconda degli accordi, essere indicati separatamente.",
            },
            {
              type: "ul",
              items: [
                "Entrate lorde: somma di tutte le prenotazioni nel periodo per ogni immobile.",
                "Commissione: la vostra quota concordata, viene dedotta dalle entrate.",
                "Importo di pagamento: entrate al netto della commissione ed eventuali altre voci.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Gli importi nello statement sono sempre indicati nella valuta dell'immobile — non esiste una valuta predefinita generica.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Create gli statement regolarmente alla stessa data di riferimento, in modo che i proprietari abbiano un ritmo affidabile per i loro pagamenti.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Accesso proprietario",
          excerpt: "Cosa possono vedere i proprietari nel loro accesso di sola lettura.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'accesso proprietario è un login proprio, di sola lettura, per myNextDays. Al suo interno i proprietari vedono esclusivamente gli immobili a loro assegnati, nonché le relative occupazioni e i rendiconti — senza possibilità di modificare autonomamente le impostazioni.",
            },
            { type: "h2", text: "Cosa vedono i proprietari" },
            {
              type: "ul",
              items: [
                "Calendario delle occupazioni dei propri immobili.",
                "Statement creati con entrate e commissione dedotta.",
                "Dati di base dei propri immobili, ad esempio dotazioni e descrizione.",
              ],
            },
            { type: "h2", text: "Attivare l'accesso" },
            {
              type: "steps",
              items: [
                "Aprite il proprietario in «Proprietari».",
                "Cliccate su «Invita all'accesso».",
                "Il proprietario riceve un'e-mail per impostare la propria password.",
                "Dopo l'accesso, il proprietario vede automaticamente solo i propri immobili assegnati.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L'accesso proprietario è strettamente di sola lettura: prezzi, disponibilità o dati dell'immobile possono essere modificati solo da voi come gestore, non dal proprietario stesso.",
            },
            {
              type: "note",
              variant: "info",
              text: "Maggiori informazioni sull'assegnazione degli immobili sono disponibili in [Assegnare un immobile a un proprietario](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
