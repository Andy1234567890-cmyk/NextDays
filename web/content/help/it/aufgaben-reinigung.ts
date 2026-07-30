import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Attività e pulizie",
  description: "Organizzare piani di pulizia e attività del team.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Gestione",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Creare attività",
          excerpt: "Come creare una nuova attività per un immobile o un periodo.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Le attività raggruppano tutto ciò che deve essere svolto in relazione a un immobile — dalla pulizia dopo il check-out ai lavori di manutenzione o alle richieste degli ospiti. Ogni attività è collegata a un solo immobile e può essere assegnata a un membro del team.",
            },
            { type: "h2", text: "Creare una nuova attività" },
            {
              type: "steps",
              items: [
                "Aprite la sezione «Attività» nel menu principale.",
                "Cliccate su «Nuova attività».",
                "Selezionate l'immobile interessato.",
                "Assegnate un titolo e, facoltativamente, una descrizione.",
                "Impostate data e ora di scadenza.",
                "Salvate l'attività.",
              ],
            },
            { type: "h2", text: "Tipi di attività" },
            {
              type: "p",
              text: "Oltre alle attività libere esistono attività generate automaticamente dal sistema, come le pulizie pianificate automaticamente dopo un check-out. Queste sono già collegate all'immobile e alla fascia oraria corretta e devono soltanto essere assegnate a un membro del team.",
            },
            {
              type: "ul",
              items: [
                "Attività manuale: inserita liberamente, ad esempio manutenzione o richiesta speciale.",
                "Attività di pulizia automatica: generata a partire dalla data di check-out.",
                "Attività ricorrente: per controlli o ispezioni regolari.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "I dettagli sulla pianificazione automatica sono disponibili in [Piani di pulizia](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Scegliete titoli precisi — nella vista mobile i membri del team spesso vedono a colpo d'occhio solo il titolo e l'immobile.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Piani di pulizia",
          excerpt: "Pianificare automaticamente le pulizie dopo il check-out.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Un piano di pulizia fa sì che dopo ogni check-out venga creata automaticamente un'attività di pulizia per l'immobile interessato — senza che dobbiate monitorare ogni prenotazione singolarmente. Questo riduce i passaggi di consegna dimenticati e garantisce uno svolgimento affidabile tra due soggiorni.",
            },
            { type: "h2", text: "Attivare la pianificazione automatica" },
            {
              type: "steps",
              items: [
                "Aprite l'immobile e passate alla scheda «Pulizia».",
                "Attivate «Pianifica automaticamente la pulizia dopo il check-out».",
                "Stabilite quanto tempo dopo il check-out viene previsto per la pulizia.",
                "Definite facoltativamente un team standard o un addetto alle pulizie predefinito.",
                "Salvate l'impostazione.",
              ],
            },
            { type: "h2", text: "Interazione con il calendario" },
            {
              type: "p",
              text: "Non appena una prenotazione viene annullata o spostata, l'attività di pulizia corrispondente si adatta automaticamente alla nuova data di check-out. In questo modo il piano di pulizia rimane sempre sincronizzato con lo stato di occupazione effettivo.",
            },
            {
              type: "ul",
              items: [
                "La pulizia viene creata automaticamente a ogni check-out con piano attivo.",
                "Se la prenotazione viene spostata, anche l'attività di pulizia viene spostata di conseguenza.",
                "Se l'ospite annulla il soggiorno, l'attività di pulizia viene rimossa.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza un piano di pulizia attivato non vengono create attività automatiche — create quindi le pulizie manualmente in [Creare attività](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Assegnare attività",
          excerpt: "Assegnare attività in modo mirato ad addetti alle pulizie o membri del team.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Affinché un'attività venga svolta, assegnatela a un membro specifico del team — ad esempio un addetto alle pulizie o un collaboratore responsabile della manutenzione. Per impostazione predefinita, solo la persona assegnata vede l'attività nella propria panoramica.",
            },
            { type: "h2", text: "Assegnare un'attività manualmente" },
            {
              type: "steps",
              items: [
                "Aprite l'attività nell'elenco «Attività».",
                "Cliccate su «Assegna».",
                "Selezionate dall'elenco il membro del team responsabile.",
                "Confermate l'assegnazione.",
              ],
            },
            { type: "h2", text: "Assegnazione per immobile" },
            {
              type: "p",
              text: "Se un addetto alle pulizie è già assegnato in modo fisso a un immobile, potete far assegnare automaticamente a questa persona anche le attività relative a quell'immobile. Questo fa risparmiare passaggi nelle pulizie ricorrenti e riduce le richieste di chiarimento.",
            },
            {
              type: "ul",
              items: [
                "Assegnazione manuale: scegliete voi stessi la persona per ogni attività.",
                "Assegnazione fissa dell'immobile: le nuove attività per questo immobile vanno automaticamente alla persona indicata.",
                "Un'attività ha sempre esattamente una persona responsabile.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Gli addetti alle pulizie e i collaboratori vedono esclusivamente le proprie attività assegnate, senza dati finanziari o di vendita dell'immobile.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Monitorare lo stato delle attività",
          excerpt: "Tenere sotto controllo in tempo reale lo stato di avanzamento delle attività.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Ogni attività attraversa uno stato chiaro — da aperta a in lavorazione fino a completata. Così potete vedere in ogni momento se una pulizia o una manutenzione sarà terminata in tempo prima del prossimo check-in.",
            },
            { type: "h2", text: "Panoramica degli stati" },
            {
              type: "ul",
              items: [
                "Aperta: l'attività è stata creata ma non ancora iniziata.",
                "In lavorazione: la persona assegnata ha iniziato l'attività.",
                "Completata: l'attività è stata svolta e confermata.",
              ],
            },
            { type: "h2", text: "Aggiornare lo stato" },
            {
              type: "steps",
              items: [
                "Aprite l'attività dall'elenco «Attività».",
                "Selezionate lo stato appropriato, ad esempio «In lavorazione» o «Completata».",
                "Se necessario, aggiungete una breve nota, ad esempio su anomalie riscontrate nell'immobile.",
                "Salvate la modifica.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Le modifiche di stato compaiono immediatamente nell'elenco condiviso delle attività — non è necessario un ricaricamento manuale.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Se una pulizia risulta ancora aperta poco prima del prossimo check-in, verificate prima l'assegnazione prima di contattare l'ospite.",
            },
          ],
        },
      ],
    },
  ],
};
