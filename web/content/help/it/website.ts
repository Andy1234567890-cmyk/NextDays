import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Editor del sito web",
  description: "Creare il vostro sito web di prenotazione con l'editor.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Editor del sito web",
      articles: [
        {
          slug: "website-erstellen",
          title: "Creare un sito web",
          excerpt: "Con l'editor create in pochi minuti un vostro sito web di prenotazione.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'editor del sito web vi crea un vostro sito web di prenotazione — un canale di vendita aggiuntivo accanto ai portali e al marketplace myBestDays. Mantenete il pieno controllo su struttura, contenuti e branding.",
            },
            { type: "h2", text: "Come creare un sito web" },
            {
              type: "steps",
              items: [
                "Aprite nel menu Sito web.",
                "Cliccate su Crea sito web.",
                "Scegliete un modello come punto di partenza per il vostro layout.",
                "Confermate con Crea sito web — accedete direttamente all'editor.",
              ],
            },
            { type: "h2", text: "Cosa contiene l'editor" },
            {
              type: "ul",
              items: [
                "Un editor visuale con pagine, livelli e visualizzazione di anteprima",
                "Blocchi predefiniti per elenchi di strutture, gallerie e moduli di contatto",
                "Un percorso di prenotazione diretto, basato sulla disponibilità del vostro calendario",
                "Colori, caratteri e logo personalizzabili in base al vostro marchio",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Iniziate con un modello vicino al tipo della vostra struttura — casa vacanza o hotel — questo vi farà risparmiare tempo in seguito nell'adattare i blocchi.",
            },
            { type: "h2", text: "Passaggi successivi" },
            {
              type: "p",
              text: "Dopo la creazione adattate pagine e layout, vedi [Modificare pagine e layout](/hilfe/website/seiten-layout), e mostrate le vostre strutture sul sito web, vedi [Mostrare le strutture sul sito web](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Modificare pagine e layout",
          excerpt: "Adattare pagine, livelli e blocchi nell'editor visuale.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'editor è suddiviso in tre aree: a sinistra la panoramica di pagine e livelli, al centro l'anteprima del vostro sito web, a destra le impostazioni del blocco selezionato al momento.",
            },
            { type: "h2", text: "Modificare una pagina" },
            {
              type: "steps",
              items: [
                "A sinistra, sotto Pagine, selezionate la pagina desiderata.",
                "Nell'anteprima cliccate su un blocco per selezionarlo.",
                "A destra adattate testo, immagine o spaziatura del blocco.",
                "Trascinate i blocchi con il drag-and-drop per cambiarne l'ordine.",
              ],
            },
            { type: "h2", text: "Aggiungere nuove pagine e blocchi" },
            {
              type: "p",
              text: "Tramite il pulsante Aggiungi pagina create ulteriori sottopagine, ad esempio Chi siamo o Contatti. All'interno di una pagina, tramite Aggiungi blocco inserite nuove sezioni come Galleria, Recensioni o Modulo di contatto.",
            },
            {
              type: "ul",
              items: [
                "Home page, panoramica delle strutture e contatti sono già preimpostate in ogni modello",
                "Altre pagine possono essere nominate liberamente e incluse nella navigazione",
                "I blocchi sono responsive e si adattano a desktop, tablet e smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le modifiche nell'editor sono inizialmente solo una bozza. Solo un clic su Pubblica le applica al vostro sito web pubblico.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Collegare un dominio",
          excerpt: "Collegare un dominio personalizzato al vostro sito web myNextDays.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Per impostazione predefinita il vostro sito web è raggiungibile tramite un sottodominio myNextDays. Se desiderate utilizzare invece un dominio personalizzato, come ad esempio ilvostro-hotel.it, collegatelo nella sezione Dominio.",
            },
            { type: "h2", text: "Impostare il dominio" },
            {
              type: "steps",
              items: [
                "Aprite nel sito web le impostazioni e lì Dominio.",
                "Inserite il vostro dominio personalizzato e cliccate su Collega.",
                "Impostate presso il vostro fornitore di dominio i record DNS mostrati.",
                "Attendete la conferma — il controllo avviene automaticamente in background.",
              ],
            },
            { type: "h2", text: "Impostare correttamente i record DNS" },
            {
              type: "p",
              text: "myNextDays vi mostra esattamente i record necessari per il vostro fornitore di dominio. Il collegamento diventa attivo solo quando questi record sono impostati correttamente e si sono propagati a livello mondiale — a seconda del fornitore ciò può richiedere alcune ore.",
            },
            {
              type: "ul",
              items: [
                "Impostare il record CNAME o A secondo le istruzioni mostrate",
                "Rimuovere prima eventuali record esistenti e in conflitto per lo stesso dominio",
                "Il certificato per https viene rilasciato automaticamente dopo il collegamento riuscito",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza record DNS impostati correttamente, il vostro sito web non è raggiungibile con il dominio personalizzato — verificate con attenzione la scrittura rispetto alle indicazioni del vostro fornitore.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Mostrare le strutture sul sito web",
          excerpt: "Quali strutture sono visibili e prenotabili tramite il sito web si gestisce separatamente per ogni struttura.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Perché una struttura compaia sul vostro sito web, la visibilità sul sito web per questa struttura deve essere attivata. Questo interruttore è indipendente dalla visibilità sul marketplace myBestDays o sui portali.",
            },
            { type: "h2", text: "Attivare una struttura per il sito web" },
            {
              type: "steps",
              items: [
                "Aprite la struttura in Strutture.",
                "Passate alla scheda Visibilità.",
                "Attivate l'interruttore Sito web.",
                "Passate al sito web e verificate il blocco Panoramica delle strutture nell'anteprima.",
              ],
            },
            { type: "h2", text: "Adattare ordine e visualizzazione" },
            {
              type: "p",
              text: "Nel blocco Panoramica delle strutture stabilite se le strutture vengono ordinate automaticamente in base alla disponibilità oppure se impostate un ordine fisso. Ogni struttura mostra la foto principale, il prezzo base nella sua valuta impostata e le caratteristiche più importanti.",
            },
            {
              type: "ul",
              items: [
                "Ordinamento automatico per disponibilità oppure ordine manuale",
                "Filtro per tipo di struttura o dotazioni attivabile facoltativamente",
                "I passaggi di prenotazione avvengono direttamente sul sito web, senza deviazione verso i portali",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Una struttura senza visibilità sul sito web attivata resta nascosta dalla panoramica delle strutture, anche se è visibile sul marketplace o sui portali.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Pubblicare il sito web",
          excerpt: "Le bozze diventano visibili pubblicamente solo con un clic su Pubblica.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Finché lavorate nell'editor, solo voi vedete la bozza attuale. Solo un clic su Pubblica rende le modifiche visibili a tutti i visitatori sul vostro dominio.",
            },
            { type: "h2", text: "Come pubblicare" },
            {
              type: "steps",
              items: [
                "Aprite nell'editor l'anteprima e verificate tutte le pagine.",
                "Cliccate in alto a destra su Pubblica.",
                "Confermate la finestra di dialogo — il sito web è immediatamente dopo online.",
                "Aprite il vostro dominio in una nuova scheda per verificare il risultato.",
              ],
            },
            { type: "h2", text: "Bozze e ripristino" },
            {
              type: "p",
              text: "Finché non avete ancora pubblicato, potete in qualsiasi momento tornare all'ultima versione pubblicata, senza perdere definitivamente la bozza — utilizzate a tale scopo Scarta bozza nelle impostazioni del sito web.",
            },
            {
              type: "ul",
              items: [
                "Le modifiche pubblicate sono immediatamente visibili sul vostro dominio",
                "Una bozza non pubblicata resta interna finché non la confermate",
                "Ogni pubblicazione viene registrata con data nello storico",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Prima di pubblicare, controllate nell'anteprima la visualizzazione mobile — la maggior parte degli ospiti apre i siti web di prenotazione dallo smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
