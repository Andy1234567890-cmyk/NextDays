import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regole per le richieste di autorità e forze dell'ordine",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "Le presenti regole si rivolgono ad autorità, organi giurisdizionali e forze dell'ordine che richiedano dati a myBestDays o indirizzino un ordine relativo a contenuti. Sono pubbliche qui affinché anche gli utenti possano sapere a quali condizioni comunichiamo dati.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Comunichiamo dati degli utenti solo in presenza di un valido fondamento giuridico e se la richiesta soddisfa i requisiti formali. Una richiesta informale di dati non è sufficiente.",
        "Esaminiamo ogni richiesta quanto a competenza, fondamento giuridico, determinatezza e proporzionalità e comunichiamo soltanto i dati che la richiesta individua.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Requisiti di una richiesta",
      paragraphs: ["Una richiesta dovrebbe contenere:"],
      list: [
        "l'organo richiedente, il numero di fascicolo e i recapiti della persona incaricata, su carta intestata ufficiale;",
        "il fondamento giuridico secondo il diritto nazionale o dell'Unione;",
        "un'indicazione precisa della persona o dell'account interessato — indirizzo e-mail, numero di prenotazione o URL dell'annuncio;",
        "i dati precisamente individuati e il periodo;",
        "ove del caso, un provvedimento giurisdizionale, nella misura in cui il diritto applicabile lo richieda;",
        "un'indicazione qualora informare la persona interessata comprometterebbe le indagini, con menzione del fondamento giuridico.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Ordini ai sensi del regolamento (UE) 2022/2065",
      paragraphs: [
        "Gli ordini di agire contro contenuti illegali (articolo 9) e gli ordini di fornire informazioni (articolo 10) devono contenere gli elementi ivi previsti, in particolare il fondamento giuridico, l'esatta ubicazione elettronica, la motivazione, i mezzi di ricorso e la lingua.",
        "Confermiamo la ricezione e comunichiamo all'autorità emittente quali misure abbiamo adottato e quando.",
        "Informiamo la persona interessata di un ordine al più tardi al momento della sua esecuzione, salvo che l'autorità disponga un differimento indicando il fondamento giuridico.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Situazioni di emergenza",
      paragraphs: [
        "In presenza di un pericolo imminente per la vita o l'integrità fisica comunichiamo i dati necessari a scongiurarlo anche senza previo ordine formale. Contrassegni espressamente tale richiesta come emergenza e descriva il pericolo.",
        "In presenza di indizi di un reato che comporti un pericolo per la vita o la sicurezza di una persona informiamo di nostra iniziativa le autorità competenti (articolo 18 del regolamento (UE) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Quali dati conserviamo",
      paragraphs: [
        "Le categorie di dati che trattiamo e i relativi periodi di conservazione figurano nell'[Informativa sulla privacy](https://mybestdays.dk/rechtliches/datenschutz). Oltre i termini ivi indicati non conserviamo dati.",
        "Non effettuiamo alcuna conservazione eccedente il necessario. Diamo seguito, nei limiti giuridicamente ammissibili, a una richiesta di conservazione provvisoria di dati per un procedimento in corso.",
        "Non disponiamo di dati di pagamento completi; devono essere richiesti al prestatore di servizi di pagamento.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Informazione della persona interessata",
      paragraphs: [
        "Informiamo gli utenti interessati di una richiesta relativa ai loro dati, salvo che una norma di legge o un ordine motivato dell'autorità lo vieti oppure sussista un pericolo imminente per la vita o l'integrità fisica.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. A chi indirizzare le richieste",
      paragraphs: [
        "Indirizzi le richieste al punto di contatto unico per le autorità indicato in [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa). Le trattiamo in tedesco, danese e inglese.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Trasparenza",
      paragraphs: [
        "Indichiamo numero e tipo degli ordini delle autorità nella nostra relazione annuale sulla trasparenza; si veda [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
