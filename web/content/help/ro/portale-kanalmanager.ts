import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portaluri și managerul de canale",
  description: "Controlați centralizat Booking, Airbnb, Expedia & Co.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Conectarea portalurilor",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Ce este managerul de canale?",
          excerpt:
            "Managerul de canale sincronizează automat prețurile, disponibilitatea și rezervările între myNextDays și portaluri.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "O singură conexiune pentru toate portalurile" },
            {
              type: "p",
              text: "Managerul de canale este puntea dintre myNextDays și portalurile mari de rezervare precum Booking, Airbnb & Co. În loc să gestionați prețurile, disponibilitatea și ocuparea separat, în fiecare portal, introduceți totul o singură dată în myNextDays — managerul de canale le distribuie automat către toate portalurile conectate.",
            },
            { type: "h2", text: "Ce se sincronizează automat" },
            {
              type: "ul",
              items: [
                "Disponibilitate — fiecare rezervare blochează imediat noaptea pe toate portalurile",
                "Prețuri și sejururi minime din calendarul dvs. de prețuri",
                "Rezervările primite prin portal sunt importate automat în myNextDays",
                "Anulările și Stop-Sell acționează transversal pe canale",
              ],
            },
            { type: "h2", text: "Ce nu mai trebuie să faceți manual" },
            {
              type: "p",
              text: "Fără manager de canale, ar trebui să blocați manual noaptea în fiecare portal după fiecare rezervare — un motiv frecvent pentru suprarezervări. Cu managerul de canale activ, myNextDays preia această sincronizare în ambele direcții, de mai multe ori pe zi și în timp real la rezervările noi.",
            },
            {
              type: "note",
              variant: "info",
              text: "Conexiunea cu portalurile se configurează o singură dată, la nivel de cont. Pentru fiecare obiect individual activați ulterior doar maparea — mai multe la [Asocierea unui obiect cu un portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Configurarea conexiunii cu portalurile",
          excerpt:
            "Conexiunea cu portalurile o configurați o singură dată, la nivel de cont — nu din nou pentru fiecare obiect.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "O singură dată pentru întregul cont" },
            {
              type: "p",
              text: "Conectarea la portaluri este o setare la nivel de cont: vă conectați contul myNextDays exact o dată cu managerul de canale. Toate obiectele pe care le adăugați ulterior folosesc automat această conexiune unică — nu trebuie să o reconstruiți pentru fiecare obiect.",
            },
            { type: "h2", text: "Cum configurați conexiunea" },
            {
              type: "steps",
              items: [
                "Deschideți /konto și alegeți secțiunea „Portaluri și managerul de canale”",
                "Apăsați pe „Configurare conexiune” și confirmați datele companiei dvs. (adresă, contact, formă juridică)",
                "Verificați datele de bază preluate automat — acestea sunt transmise tuturor portalurilor",
                "Finalizați configurarea; statusul trece pe „Conectat”",
              ],
            },
            { type: "h2", text: "Pasul următor: asocierea obiectelor" },
            {
              type: "p",
              text: "După configurarea unică, niciun obiect nu este încă vizibil — pentru aceasta asociați fiecare obiect individual cu un portal (mapare) și conectați portalurile dorite, precum Booking.com sau Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără date de bază complete (adresă, informații fiscale, contact), portalurile resping conexiunea. Verificați mai întâi aceste date în /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Asocierea unui obiect cu un portal",
          excerpt:
            "După conexiunea la nivel de cont, activați per obiect doar maparea către portalul respectiv.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Mapare, nu o nouă conexiune" },
            {
              type: "p",
              text: "Odată configurată conexiunea cu portalurile la nivel de cont, conectați fiecare obiect doar printr-o așa-numită mapare: stabiliți ce obiect myNextDays corespunde cărui tip de cameră, respectiv de ofertă, din portal. Acesta este un pas unic per obiect.",
            },
            { type: "h2", text: "Cum asociați un obiect" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte și treceți la fila „Portaluri”",
                "Alegeți portalul dorit, de exemplu Booking.com sau Airbnb",
                "Asociați obiectul cu tipul de cameră, respectiv de ofertă, potrivit din portal",
                "Activați sincronizarea — prețurile și disponibilitatea sunt transmise din acest moment",
              ],
            },
            { type: "h2", text: "Un obiect, mai multe portaluri" },
            {
              type: "p",
              text: "Un singur obiect poate fi asociat simultan cu mai multe portaluri. Fiecare asociere este independentă — puteți face, de exemplu, un obiect vizibil pe Booking.com și Airbnb, dar să îl lăsați deocamdată dezactivat pe Expedia.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Verificați vizibilitatea imediat după mapare — vezi [Vizibilitate per portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Conectarea Booking.com",
          excerpt: "Cum activați Booking.com ca și canal de vânzare pentru un obiect.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Condiție prealabilă: conexiunea la nivel de cont" },
            {
              type: "p",
              text: "Înainte de a activa Booking.com pentru un obiect, trebuie configurată conexiunea la portaluri, la nivel de cont (vezi [Configurarea conexiunii cu portalurile](/hilfe/portale-kanalmanager/portal-verbindung)). După aceea, Booking.com este pentru fiecare obiect suplimentar doar o chestiune de mapare.",
            },
            { type: "h2", text: "Activarea Booking.com" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Alegeți „Booking.com” din lista portalurilor disponibile",
                "Asociați tipul de cameră, respectiv de ofertă, potrivit și confirmați planurile de tarifare",
                "Activați vizibilitatea — obiectul va fi pus live după verificarea de către Booking.com",
              ],
            },
            { type: "h2", text: "Ce așteaptă Booking.com de la dvs." },
            {
              type: "ul",
              items: [
                "Descrierea completă a obiectului, imagini și dotări",
                "Cel puțin un tarif cu preț și condiții de anulare",
                "O metodă de plată validă pentru comisioane",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Activarea de către Booking.com poate dura câteva ore. Statusul din fila obiectului „Portaluri” arată dacă conexiunea este deja activă.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Conectarea Airbnb",
          excerpt: "Cum faceți un obiect rezervabil pe Airbnb prin managerul de canale.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Airbnb ca portal suplimentar" },
            {
              type: "p",
              text: "Airbnb este conectat ca orice alt portal, prin conexiunea la nivel de cont. Odată configurată aceasta, activați Airbnb per obiect prin mapare — indiferent dacă obiectul este deja vizibil pe Booking.com sau pe alte portaluri.",
            },
            { type: "h2", text: "Activarea Airbnb pentru un obiect" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Alegeți „Airbnb” din lista portalurilor disponibile",
                "Confirmați categoria obiectului și tipul de ofertă asociat",
                "Verificați fotografiile, dotările și regulile casei — Airbnb solicită date complete înainte de activare",
                "Activați vizibilitatea pentru Airbnb",
              ],
            },
            { type: "h2", text: "După activare" },
            {
              type: "p",
              text: "De îndată ce Airbnb a aprobat obiectul, prețurile și disponibilitatea funcționează automat prin managerul de canale. Rezervările primite pe Airbnb apar apoi automat în calendarul dvs. de rezervări.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără condiții de anulare și regulament al casei înregistrate, Airbnb respinge activarea. Completați mai întâi aceste date în obiect.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sincronizarea prețurilor și disponibilității",
          excerpt:
            "Prețurile și disponibilitatea se transmit automat către toate portalurile conectate.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Un singur calendar, toate portalurile" },
            {
              type: "p",
              text: "Gestionați prețurile și disponibilitatea exclusiv în calendarul myNextDays al obiectului respectiv. Managerul de canale transmite automat fiecare modificare către toate portalurile pentru care obiectul este mapat activ — fără să introduceți nimic de două ori.",
            },
            { type: "h2", text: "Ce se transmite" },
            {
              type: "ul",
              items: [
                "Prețuri zilnice din calendarul dvs. de prețuri, respectiv din planurile de tarifare",
                "Nopți disponibile și blocări",
                "Sejur minim și restricții de sosire/plecare",
                "Zilele Stop-Sell — acestea blochează automat pe toate portalurile",
              ],
            },
            { type: "h2", text: "Cât de repede acționează sincronizarea" },
            {
              type: "p",
              text: "Modificările prețurilor și disponibilității sunt transmise portalurilor în câteva minute. Rezervările noi blochează imediat nopțile afectate, astfel încât aceeași noapte să nu poată fi vândută din nou pe niciun alt canal.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mai multe despre blocarea transversală a zilelor individuale găsiți la [Evitarea suprarezervărilor](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Primirea rezervărilor de pe portaluri",
          excerpt: "Rezervările de pe Booking, Airbnb & Co. ajung automat în calendarul dvs.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Import automat" },
            {
              type: "p",
              text: "Dacă un oaspete rezervă printr-un portal precum Booking.com sau Airbnb, managerul de canale importă automat rezervarea în myNextDays. Nu trebuie să transmiteți nimic manual — rezervarea apare în calendar și în lista de rezervări a obiectului afectat.",
            },
            { type: "h2", text: "Ce se întâmplă la o rezervare de pe portal" },
            {
              type: "steps",
              items: [
                "Portalul anunță noua rezervare managerului de canale",
                "myNextDays creează rezervarea cu datele oaspetelui, perioada și prețul",
                "Nopțile rezervate sunt blocate imediat pe toate celelalte canale",
                "Primiți o notificare și găsiți rezervarea în calendar",
              ],
            },
            { type: "h2", text: "Anulări și modificări" },
            {
              type: "p",
              text: "Dacă un oaspete anulează prin portal sau modifică perioada, acest lucru este de asemenea transmis automat către myNextDays, iar nopțile afectate sunt eliberate din nou.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rezervările de pe portaluri sunt recunoscute în detaliile rezervării prin insigna lor de origine, de exemplu Booking.com sau Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Evitarea suprarezervărilor",
          excerpt:
            "Stop-Sell și blocările automate previn dublele rezervări pe mai multe portaluri.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "De ce apar suprarezervările" },
            {
              type: "p",
              text: "Fără o gestionare centralizată, se poate întâmpla ușor ca aceeași noapte să fie vândută simultan pe două portaluri — de exemplu atunci când prețurile și disponibilitatea sunt gestionate manual în mai multe sisteme. Managerul de canale închide acest gol, prin faptul că fiecare rezervare, pe orice canal, blochează imediat toate celelalte canale.",
            },
            { type: "h2", text: "Instrumentele dvs. împotriva suprarezervărilor" },
            {
              type: "ul",
              items: [
                "Blocare automată: fiecare rezervare nouă — indiferent de canal — blochează nopțile peste tot",
                "Stop-Sell: blochează manual o zi pe toate canalele simultan, de exemplu pentru uz personal sau întreținere",
                "Sejurul minim și restricțiile de sosire previn rezervările scurte nepotrivite",
              ],
            },
            { type: "h2", text: "Setarea Stop-Sell" },
            {
              type: "steps",
              items: [
                "Deschideți calendarul de ocupare al obiectului",
                "Marcați ziua sau perioada afectată",
                "Alegeți „Stop-Sell” — ziua este apoi blocată pe toate portalurile, precum și pe site-ul web și pe piață",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell se aplică fără excepție tuturor canalelor. Nu există posibilitatea de a bloca o zi doar pentru un singur portal și de a o lăsa deschisă pentru celelalte.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Vizibilitate per portal",
          excerpt:
            "Fiecare portal poate fi activat sau dezactivat independent de site-ul web și de piață.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Trei căi de vânzare independente" },
            {
              type: "p",
              text: "Un obiect poate fi vândut simultan prin mai multe căi: prin portaluri (Booking, Airbnb & Co.), prin piața myBestDays și prin propriul dvs. site web. Fiecare cale are propriul comutator de vizibilitate — acestea sunt complet independente unul de celălalt.",
            },
            { type: "h2", text: "Controlul vizibilității per portal" },
            {
              type: "p",
              text: "În interiorul portalurilor, fiecare portal individual poate fi activat separat. Un obiect poate fi, de exemplu, activ pe Booking.com, dar dezactivat pe Airbnb — ambele asocieri rămân neafectate.",
            },
            { type: "h2", text: "Cum modificați vizibilitatea" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Activați sau dezactivați individual canalul dorit (portal individual, site web sau piață)",
                "Salvați — modificarea acționează în câteva minute",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Starea obiectului (activ/inactiv), precum și Stop-Sell, acționează la nivel superior, asupra tuturor canalelor. Comutatoarele de vizibilitate controlează doar pe ce canale suplimentare apare un obiect deja activ.",
            },
          ],
        },
        {
          slug: "bewertungen",
          title: "Recenzii din toate canalele",
          excerpt: "Recenziile din portaluri și de pe myBestDays se adună într-o singură listă — acolo răspunzi și tu.",
          updated: "Actualizat: august 2026",
          body: [
            { type: "h2", text: "O listă pentru toate canalele" },
            {
              type: "p",
              text: "În /bewertungen vedeți fiecare recenzie a proprietăților dumneavoastră într-un singur loc: cele din portaluri (Booking.com, Airbnb, Expedia) și cele de pe piața myBestDays. Portalurile notează pe 10, myBestDays pe 5 stele — se afișează stele, iar nota originală apare alături, ca nimic să nu pară denaturat.",
            },
            { type: "h2", text: "Cum răspundeți la o recenzie" },
            {
              type: "steps",
              items: [
                "Deschideți /bewertungen și filtrați, la nevoie, pe „Doar fără răspuns”",
                "Apăsați „Răspunde” la recenzie și scrieți răspunsul",
                "Trimiteți — la un portal răspunsul merge întâi acolo și abia apoi apare aici ca răspuns dat",
              ],
            },
            { type: "h2", text: "Ce mai vedeți" },
            {
              type: "ul",
              items: [
                "Media, numărul și rata de răspuns pe canal, ca indicatori",
                "„Încă nepublicată”: cealaltă parte nu a lăsat încă recenzie și termenul de 14 zile curge",
                "„Termenul de răspuns a expirat”: portalul nu mai acceptă un răspuns",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Recenziile portalurilor sunt vizibile doar pentru dumneavoastră. Pe piața myBestDays și pe site-ul propriu apar exclusiv recenziile dumneavoastră myBestDays verificate — Booking.com și Airbnb permit republicarea recenziilor lor doar limitat.",
            },
          ],
        },
      ],
    },
  ],
};
