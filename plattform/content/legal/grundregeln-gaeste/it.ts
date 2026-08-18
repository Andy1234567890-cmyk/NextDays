import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regole di base per gli ospiti",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "Le presenti regole di base si applicano a ogni soggiorno prenotato tramite myBestDays. Integrano il regolamento della casa del rispettivo fornitore — se questo è più severo, si applica in aggiunta.",
    "Chi viola le regole di base deve attendersi misure fino al blocco dell'account e risponde verso il fornitore dei danni prodotti.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Occupazione",
      paragraphs: [
        "Nell'alloggio pernottano soltanto le persone indicate al momento della prenotazione e al massimo tante quante ne consente l'occupazione massima.",
        "Le visite senza pernottamento sono ammesse, salvo diversa disposizione del regolamento della casa.",
        "L'alloggio non può essere subaffittato né ceduto.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Riguardo e ore di silenzio",
      paragraphs: [
        "Abbia riguardo per il vicinato. Rispetti le ore di silenzio indicate nel regolamento della casa; in mancanza di indicazioni vale il riposo notturno d'uso locale.",
        "Feste ed eventi non sono ammessi senza l'espressa autorizzazione del fornitore. Ciò vale anche quando l'occupazione massima è rispettata.",
        "L'uso commerciale dell'alloggio — per esempio produzioni fotografiche o video, eventi di vendita — richiede il previo consenso del fornitore.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Uso dell'alloggio",
      paragraphs: [
        "Tratti l'alloggio e il suo arredo con cura e lo lasci in ordine.",
        "Segnali senza indugio al fornitore danni e guasti — non solo dopo la partenza. Solo così egli può porvi rimedio e solo così Lei conserva i propri diritti.",
        "Lei risponde dei danni causati da Lei o dai Suoi compagni di viaggio. Se è pattuita una cauzione, può essere utilizzata a tal fine.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Sicurezza",
      paragraphs: [
        "Mantenga liberi e funzionanti rilevatori di fumo, estintori e vie di fuga. I rilevatori di fumo non possono essere coperti né rimossi.",
        "È consentito fumare solo se il regolamento della casa lo permette espressamente e soltanto nelle aree a ciò destinate.",
        "Per piscina, sauna, camino, barbecue o vasca idromassaggio segua le indicazioni del fornitore. I minori possono utilizzare tali impianti solo sotto sorveglianza.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Animali",
      paragraphs: [
        "Può portare animali solo se l'annuncio lo consente e li ha indicati al momento della prenotazione.",
        "I cani di assistenza e i cani guida sono sempre ammessi, anche se l'annuncio esclude gli animali. La preghiamo di annunciarli affinché il fornitore possa prepararsi.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Arrivo e partenza",
      paragraphs: [
        "Rispetti gli orari di arrivo e partenza indicati nell'annuncio. Se necessita di orari diversi, li concordi preventivamente con il fornitore.",
        "Fornisca per tempo i dati necessari al fornitore per la registrazione (scheda di notifica, dati identificativi, tassa di soggiorno).",
        "Non trasmetta a terzi credenziali di accesso, codici e chiavi.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Comunicazione",
      paragraphs: [
        "Effettui prenotazione, pagamento e accordi tramite la piattaforma. Solo così restano documentati e solo così possiamo intervenire in caso di controversia.",
        "Mantenga un tono obiettivo verso il fornitore e il nostro team. Ingiurie e minacce comportano immediatamente misure nei confronti dell'account.",
      ],
    },
  ],
};
