import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica fiscale",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "La presente pagina illustra quali imposte e tributi possono maturare in occasione di una prenotazione tramite myBestDays, chi ne è debitore e quali obblighi di comunicazione ci incombono in qualità di gestore della piattaforma.",
    "Non costituisce consulenza fiscale. Per il Suo trattamento fiscale specifico si rivolga a un consulente fiscale.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Cosa riguarda gli ospiti",
      paragraphs: [
        "Il prezzo totale indicato comprende le imposte regolate tramite la piattaforma — in particolare l'IVA sulla prestazione ricettiva, nella misura in cui il fornitore ne sia debitore.",
        "I tributi locali quali la tassa di soggiorno, l'imposta sui posti letto o il contributo turistico sono, a seconda del comune, regolati tramite la piattaforma oppure riscossi in loco. Indichiamo quale caso ricorra prima della conclusione della prenotazione.",
        "La fattura della prestazione ricettiva è emessa dal fornitore; è lui il professionista che eroga la prestazione. Se necessita di una fattura con IVA esposta, la richieda al fornitore.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Cosa riguarda i fornitori",
      paragraphs: [
        "I fornitori sono responsabili del corretto trattamento fiscale dei propri redditi — imposta sui redditi o sulle società, IVA e tributi locali.",
        "Se una locazione sia soggetta a IVA e con quale aliquota dipende dal diritto dello Stato in cui si trova l'alloggio (luogo della prestazione per i beni immobili).",
        "I fornitori inseriscono nell'immobile i tributi applicabili al proprio alloggio affinché siano indicati correttamente nell'annuncio.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Comunicazione alle autorità fiscali (DAC7)",
      paragraphs: [
        "In qualità di gestore di una piattaforma digitale siamo tenuti, ai sensi della direttiva (UE) 2021/514 («DAC7») e delle disposizioni nazionali di attuazione, a comunicare annualmente all'autorità fiscale competente dati sui fornitori soggetti a comunicazione e sui corrispettivi conseguiti tramite la piattaforma.",
        "Sono comunicati in particolare nome, indirizzo, codice fiscale, data di nascita o numero di registrazione, coordinate del conto per i pagamenti, indirizzo dell'alloggio nonché i corrispettivi versati per trimestre e le commissioni trattenute.",
        "I fornitori ricevono copia dei dati comunicati che li riguardano.",
        "Se un fornitore non fornisce i dati necessari alla comunicazione nonostante due solleciti, siamo tenuti a trattenere i pagamenti e a bloccare l'account.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Ritenute",
      paragraphs: [
        "Ove il diritto di uno Stato ci obblighi a operare e versare una ritenuta su un pagamento, vi provvediamo e indichiamo la ritenuta nel conteggio.",
      ],
    },
  ],
};
