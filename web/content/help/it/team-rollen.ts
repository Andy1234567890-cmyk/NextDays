import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Team e autorizzazioni",
  description: "Collaboratori, ruoli e diritti di accesso.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Accesso",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Invitare collaboratori",
          excerpt: "Come invitare nuovi collaboratori al vostro account myNextDays.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Alla vostra attività potete invitare un numero qualsiasi di collaboratori — ad esempio per reception, pulizie o amministrazione. Ogni invito è legato a un indirizzo e-mail e assegna immediatamente un ruolo fisso, che determina l'accesso sul web e nell'app myNextDays.",
            },
            { type: "h2", text: "Inviare l'invito" },
            {
              type: "steps",
              items: [
                "Aprite «Account» e passate alla sezione «Team».",
                "Cliccate su «Invita collaboratore».",
                "Inserite l'indirizzo e-mail della persona.",
                "Selezionate il ruolo appropriato, ad esempio Collaboratore o Pulizie.",
                "Confermate l'invito.",
              ],
            },
            { type: "h2", text: "Cosa succede dopo" },
            {
              type: "p",
              text: "La persona invitata riceve un'e-mail con un link per impostare una propria password e accedere. Il login vale allo stesso modo per la dashboard web e per l'app myNextDays — non esiste un account separato per ciascun frontend.",
            },
            {
              type: "ul",
              items: [
                "Un invito resta valido finché non viene accettato o revocato.",
                "Gli inviti in sospeso sono visibili nella sezione «Team» con lo stato «In attesa».",
                "Il ruolo può essere modificato in qualsiasi momento in un secondo tempo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Per sapere quale ruolo può vedere quali aree, consultate [Ruoli e autorizzazioni](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Assegnate fin dall'inizio il ruolo più restrittivo appropriato — i diritti possono sempre essere ampliati in seguito.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Ruoli e autorizzazioni",
          excerpt: "I cinque ruoli in myNextDays e cosa è consentito a ciascuno.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distingue cinque ruoli: Admin, Co-Admin, Collaboratore, Pulizie e Proprietario. Ogni ruolo determina quali aree sono visibili nella dashboard web e nell'app myNextDays — i diritti vengono applicati lato server, non semplicemente nascosti nell'interfaccia.",
            },
            { type: "h2", text: "I ruoli in sintesi" },
            {
              type: "ul",
              items: [
                "Admin: accesso completo a tutte le aree, incluse finanze, vendite e gestione del team.",
                "Co-Admin: accesso quasi completo come l'Admin, per il secondo livello dirigenziale dell'attività.",
                "Collaboratore: accesso operativo a prenotazioni, calendario e attività, senza accesso a finanze o vendite.",
                "Pulizie: accesso esclusivo alle attività di pulizia assegnate e ai dettagli dell'immobile, senza accesso a finanze o vendite.",
                "Proprietario: visualizzazione di sola lettura dei propri immobili, nessuna gestione di immobili altrui.",
              ],
            },
            { type: "h2", text: "Assegnare o modificare il ruolo" },
            {
              type: "steps",
              items: [
                "Aprite «Account» → «Team».",
                "Selezionate dall'elenco il collaboratore interessato.",
                "Cliccate su «Modifica ruolo».",
                "Selezionate il nuovo ruolo e confermate.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Collaboratore e Pulizie non vedono mai prezzi, fatturato o canali di prenotazione — questa esclusione vale lato server e non può essere aggirata tramite l'interfaccia.",
            },
            {
              type: "note",
              variant: "info",
              text: "Una panoramica per ogni ruolo è disponibile in [Cosa vede ciascun ruolo](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Cosa vede ciascun ruolo",
          excerpt: "Aree e visualizzazioni concrete per ogni ruolo sul web e nell'app.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Oltre ai diritti di base descritti in [Ruoli e autorizzazioni](/hilfe/team-rollen/rollen-berechtigungen), uno sguardo concreto alle singole aree aiuta a impostare le aspettative corrette durante l'onboarding di nuovi collaboratori.",
            },
            { type: "h2", text: "Calendario e prenotazioni" },
            {
              type: "p",
              text: "Admin, Co-Admin e Collaboratore vedono il piano di occupazione completo con i dati degli ospiti e le attività. Pulizie vede solo gli appuntamenti a lei assegnati, con indirizzo dell'immobile e checklist, ma non i nomi degli ospiti né i prezzi. I proprietari vedono il calendario delle occupazioni esclusivamente per i propri immobili, in sola lettura.",
            },
            { type: "h2", text: "Finanze e vendite" },
            {
              type: "ul",
              items: [
                "Fatturato, commissioni e fatture: solo Admin e Co-Admin.",
                "Portali (collegamento OTA) e visibilità sulla piattaforma: solo Admin e Co-Admin.",
                "Collaboratore e Pulizie: nessun accesso alle aree finanziarie o di vendita, nemmeno alle pagine di dettaglio.",
              ],
            },
            { type: "h2", text: "Team e impostazioni" },
            {
              type: "p",
              text: "La gestione di collaboratori, ruoli e impostazioni dell'account resta riservata ad Admin e Co-Admin. I proprietari e i ruoli operativi non vedono affatto questa area, né nell'app myNextDays né nella dashboard web.",
            },
            {
              type: "note",
              variant: "info",
              text: "Questa suddivisione vale in modo identico nella dashboard web e nell'app myNextDays, poiché entrambi i frontend interrogano lo stesso ruolo dal vostro account.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Dopo l'invito, testate brevemente i nuovi ruoli insieme al collaboratore, per evitare malintesi sulle aree visibili.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Revocare l'accesso",
          excerpt: "Rimuovere immediatamente e completamente l'accesso di un collaboratore.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Se un collaboratore lascia la vostra attività o la collaborazione cambia, rimuovete l'accesso direttamente nell'account. La revoca ha effetto lato server e immediato — non solo dopo la scadenza di una sessione esistente.",
            },
            { type: "h2", text: "Rimuovere l'accesso" },
            {
              type: "steps",
              items: [
                "Aprite «Account» → «Team».",
                "Selezionate il collaboratore interessato.",
                "Cliccate su «Revoca accesso».",
                "Confermate l'operazione.",
              ],
            },
            { type: "h2", text: "Effetto sulle sessioni in corso" },
            {
              type: "p",
              text: "Dopo la revoca, la persona non potrà più accedere né alla dashboard web né all'app myNextDays. Le attività o gli appuntamenti di pulizia già assegnati dovrebbero essere prima riassegnati a un altro collaboratore, affinché nulla resti in sospeso.",
            },
            {
              type: "ul",
              items: [
                "Riassegnare le attività aperte prima della revoca.",
                "L'accesso può essere ripristinato in seguito con un nuovo invito.",
                "La revoca riguarda solo questa attività, non altri account della persona.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Revocate l'accesso tempestivamente non appena termina una collaborazione — altrimenti gli account dei collaboratori attivi restano un rischio di sicurezza inutile.",
            },
          ],
        },
      ],
    },
  ],
};
