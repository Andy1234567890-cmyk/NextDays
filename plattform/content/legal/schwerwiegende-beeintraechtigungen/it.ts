import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica per eventi gravemente perturbativi",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "A volte un evento impedisce il viaggio o il soggiorno senza che né l'ospite né il fornitore possano farci nulla. La presente politica descrive quali siano tali eventi e cosa si applichi in tal caso.",
    "Prevale sulla condizione di cancellazione scelta nell'annuncio.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Quali eventi sono coperti",
      paragraphs: [
        "Sono coperti gli eventi che si verificano dopo la prenotazione, erano imprevedibili per entrambe le parti e rendono il viaggio o il soggiorno impossibile o giuridicamente inammissibile:",
      ],
      list: [
        "divieti amministrativi di viaggio o di soggiorno, coprifuoco e chiusure di frontiera che riguardino la destinazione o il luogo di partenza;",
        "catastrofi ed eventi naturali che colpiscano la destinazione — terremoto, alluvione, tempesta, grande incendio, eruzione vulcanica;",
        "guerra, conflitti armati, attentati terroristici e disordini nella destinazione;",
        "un'epidemia o pandemia accertata dalle autorità con misure che vietino il soggiorno;",
        "l'interruzione prolungata della fornitura di elettricità, acqua o riscaldamento nella destinazione;",
        "il venir meno totale della possibilità di raggiungere la destinazione a causa di uno degli eventi precedenti.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Quali eventi non sono coperti",
      paragraphs: ["Non sono coperti, in particolare:"],
      list: [
        "malattia o infortunio dell'ospite o dei suoi congiunti — a ciò è destinata un'assicurazione viaggio;",
        "impedimenti professionali, date d'esame o revoca delle ferie;",
        "l'annullamento di un evento per il quale era stato prenotato il viaggio, se l'alloggio resta utilizzabile;",
        "il meteo che non costituisca catastrofe naturale — pioggia, freddo, caldo, assenza di neve;",
        "il venir meno di singoli mezzi di trasporto, finché resta possibile un viaggio ragionevole;",
        "la cancellazione di un volo o uno sciopero presso un'impresa di trasporto — al riguardo sussistono diritti nei confronti dell'impresa di trasporto.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Cosa si applica quando si verifica un evento coperto",
      paragraphs: [
        "Se l'evento riguarda il periodo della Sua prenotazione, può annullare gratuitamente. Le viene rimborsato integralmente l'importo versato tramite la piattaforma.",
        "Se il soggiorno è già iniziato, rimborsiamo la quota relativa alle notti non più utilizzabili.",
        "Da tale cancellazione non deriva alcuno svantaggio per il fornitore nella valutazione della sua affidabilità.",
        "In alternativa può concordare un rinvio con il fornitore; La assistiamo nella modifica.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Come invocare la presente politica",
      paragraphs: [
        "Ci contatti attraverso i canali indicati in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden) indicando numero di prenotazione ed evento.",
        "Verifichiamo sulla base di fonti pubblicamente accessibili — provvedimenti amministrativi, avvisi ufficiali, notizie di fonti giornalistiche riconosciute — e decidiamo rapidamente.",
        "Se la situazione non è ancora valutabile in modo definitivo, attendiamo l'evoluzione fino a poco prima del giorno di arrivo e decidiamo allora. Fino a quel momento la Sua prenotazione resta invariata.",
      ],
    },
  ],
};
