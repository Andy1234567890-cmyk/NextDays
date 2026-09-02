import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Programma partner",
  description: "Consigliare strutture, creare un team e guadagnare con gli abbonamenti.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Come funziona",
      articles: [
        {
          slug: "ueberblick",
          title: "Panoramica del programma partner",
          excerpt: "Chi può partecipare, come si generano le commissioni e cosa si vede.",
          updated: "Aggiornato al: settembre 2026",
          body: [
            {
              type: "p",
              text: "Come partner, lei consiglia myNextDays a proprietari, agenzie e hotel. Se una struttura si registra con il suo codice o tramite il suo link e paga le fatture dell'abbonamento, lei riceverà una percentuale del fatturato netto dell'abbonamento per dodici mesi. La scala in base ai clienti paganti è disponibile in tempo reale sulla pagina del programma.",
            },
            { type: "h2", text: "Chi può diventare partner" },
            {
              type: "ul",
              items: [
                "Persone e aziende nell'UE, in Svizzera o nel Regno Unito con un canale autentico verso gli host: influencer, consulenti, agenzie, studi fiscali, associazioni.",
                "Anche i clienti myNextDays stessi – un abbonamento non è un prerequisito.",
                "Obbligatorio nella candidatura: almeno un account sui social media (Instagram, TikTok, YouTube, Facebook, LinkedIn…) con indirizzo, handle e portata. Sito web o newsletter sono un plus.",
              ],
            },
            { type: "h2", text: "Come le viene assegnata una struttura" },
            {
              type: "steps",
              items: [
                "Lei condivide il suo link (mynextdays.com/p/IL-SUO-CODICE) o il suo codice.",
                "La struttura vede il codice al momento della registrazione nel campo \"Consigliato da\" e lo conferma inviando il modulo – senza cookie.",
                "Con la prima fattura di abbonamento pagata inizia il periodo di dodici mesi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Lei vede i suoi clienti in forma pseudonima (Cliente #1, #2…) con paese, stato e importi – mai nome o e-mail. Una struttura viene assegnata a un solo partner; il primo vince.",
            },
            { type: "h2", text: "Cosa trova nella dashboard" },
            {
              type: "ul",
              items: [
                "Panoramica: Rango, clic, strutture registrate e paganti, commissioni aperte, pagabili e pagate.",
                "Commissioni: ogni fattura di abbonamento pagata come riga con base, aliquota, importo e stato.",
                "Pagamenti: mensili per valuta a partire dall'importo minimo, con accredito (self-billing) come prova.",
                "Link e materiale: i suoi codici, materiale pubblicitario e l'etichettatura obbligatoria per paese.",
                "Messaggi: il contatto diretto con il team partner.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Costruire un team: la commissione team",
          excerpt: "Reclutare partner che si uniscono con il suo codice – e guadagnare con il fatturato dei loro clienti.",
          updated: "Aggiornato al: settembre 2026",
          body: [
            {
              type: "p",
              text: "Lei può includere altri partner nel suo team. Se qualcuno si candida tramite il suo link team (mynextdays.com/p/IL-SUO-CODICE?team=1) e inserisce visibilmente il suo codice nella candidatura, dopo l'approvazione farà parte del suo team. Sul fatturato netto degli abbonamenti dei clienti dei suoi partner team, lei riceverà una commissione team.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "L'aliquota team dipende dal SUO rango al momento del pagamento – non dalla dimensione del suo team. Le aliquote sono disponibili sulla pagina del programma.",
                "Il suo rango deriva solo dai suoi clienti paganti. I clienti team non contano per il rango.",
                "Esattamente un livello: i suoi partner team non costruiscono un proprio team sotto di lei.",
                "Nessun costo di partecipazione, nessun denaro per il reclutamento di un partner. La commissione team deriva esclusivamente dal fatturato degli abbonamenti pagati.",
                "Dodici mesi dalla prima fattura pagata del rispettivo cliente team, finestra di rimborso di 30 giorni, storno in caso di rimborso o chargeback – come per la propria commissione.",
                "La commissione del team viene generata solo se tu e il tuo partner di team siete stati approvati; altrimenti, verrà sospesa.",
              ],
            },
            { type: "h2", text: "La valutazione del team" },
            {
              type: "p",
              text: "Sotto \"Team\" vedrai ogni partner di team con il suo rango, i clienti paganti, il fatturato degli abbonamenti dei suoi clienti (30 giorni e totale) e la tua commissione di team da essi — aperta, pagabile, pagata — così come l'andamento degli ultimi dodici mesi. Non vedrai i dettagli dei clienti dei tuoi partner di team; appartengono a loro.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tramite \"Team\" puoi contattare direttamente i tuoi partner di team tramite messaggio — e il tuo sponsor può contattare te.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Lo stesso dominio e-mail o lo stesso conto bancario tra sponsor e partner di team verranno contrassegnati e verificati dal team dei partner prima che la commissione del team venga pagata.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Pagamento, accredito e tasse",
          excerpt: "Quando la commissione diventa pagabile, come appare l'accredito e cosa si applica fiscalmente.",
          updated: "Aggiornato: settembre 2026",
          body: [
            {
              type: "steps",
              items: [
                "Una riga di commissione viene creata con la fattura dell'abbonamento pagata ed è \"aperta\" per 30 giorni (finestra di rimborso).",
                "Successivamente, è pagabile. Il primo del mese raggruppiamo tutte le righe pagabili per valuta.",
                "Se la somma supera l'importo minimo della tua valuta, viene generato un pagamento con accredito (self-billing). Non è necessario emettere una fattura.",
                "Dopo il bonifico, il pagamento appare come \"Pagato\" con riferimento nella dashboard.",
              ],
            },
            {
              type: "ul",
              items: [
                "Aziende: L'accredito riporta la dicitura \"reverse charge\"; il prerequisito è un numero di partita IVA confermato (verifica VIES).",
                "Privati: L'accredito non mostra l'IVA; la commissione deve essere tassata autonomamente.",
                "Pagamento tramite SEPA, Wise o PayPal — i dati vengono inseriti nel profilo; le modifiche richiedono la tua password.",
                "Nessuna conversione: la commissione in DKK viene pagata in DKK, la commissione in EUR in EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La pubblicità deve essere riconoscibile come tale — all'inizio del post, nella lingua del post. Le formulazioni comprovate per ogni paese si trovano sotto \"Link e Materiale\". Le violazioni possono portare al blocco.",
            },
          ],
        },
      ],
    },
  ],
};
