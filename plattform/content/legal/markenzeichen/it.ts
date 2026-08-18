import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regole sui marchi",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "«myBestDays», il logo myBestDays e gli elementi grafici collegati sono segni distintivi del gestore. Le presenti regole descrivono come possono essere utilizzati.",
  ],
  sections: [
    {
      id: "erlaubt",
      heading: "1. Cosa è consentito senza autorizzazione specifica",
      paragraphs: [
        "Può citare il nome «myBestDays» in senso descrittivo per rinviare veridicamente alla piattaforma — per esempio «Questo alloggio è prenotabile su myBestDays».",
        "I fornitori possono collegare dal proprio sito il rispettivo annuncio su myBestDays e citarne il nome.",
        "In contributi redazionali e servizi informativi il nome può essere citato e il logo riprodotto nella misura necessaria all'informazione.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "2. Cosa non è consentito",
      paragraphs: ["Senza il nostro previo consenso scritto non è consentito, in particolare:"],
      list: [
        "modificare, ridisegnare, deformare o ricolorare il logo o combinarlo con altri segni;",
        "utilizzare il nome o il logo in modo da ingenerare l'impressione di una partnership, certificazione, raccomandazione o appartenenza inesistente;",
        "usare «myBestDays» o segni confondibili in una denominazione sociale, in un nome di prodotto, in un nome a dominio o in un nome di account o profilo;",
        "acquistare il nome o il logo come parola chiave nella pubblicità a pagamento sui motori di ricerca;",
        "utilizzare i nostri segni su merci, in applicazioni o in modelli destinati alla vendita o alla diffusione.",
      ],
    },
    {
      id: "darstellung",
      heading: "3. Rappresentazione",
      paragraphs: [
        "Utilizzi il logo solo nella versione da noi fornita, in proporzioni invariate e con sufficiente spazio libero. Su superfici scure utilizzi la versione chiara.",
        "Scriva sempre il nome come «myBestDays» — una sola parola, m minuscola, B e D maiuscole. Abbreviazioni come «BestDays» non sono ammesse.",
      ],
    },
    {
      id: "abgrenzung",
      heading: "4. Distinzione da myNextDays",
      paragraphs: [
        "«myNextDays» è un segno distintivo autonomo per il software gestionale del gestore. I due marchi non possono essere confusi né usati indifferentemente.",
      ],
    },
    {
      id: "verstoesse",
      heading: "5. Violazioni",
      paragraphs: [
        "In caso di violazioni intimiamo la cessazione dell'uso e ci riserviamo ulteriori azioni legali. I fornitori che violano le presenti regole devono inoltre attendersi misure nei confronti del proprio account.",
        "Le domande sull'utilizzo vanno rivolte ai recapiti indicati nelle [Informazioni legali](https://mybestdays.dk/rechtliches/impressum).",
      ],
    },
  ],
};
