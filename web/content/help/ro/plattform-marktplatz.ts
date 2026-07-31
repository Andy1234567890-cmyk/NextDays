import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platformă (Piață)",
  description: "Vindeți pe piața myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Piață",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Piața myBestDays",
          excerpt: "Piața globală myBestDays este un canal de rezervare propriu, alături de portaluri și site-ul web.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Piața myBestDays (/plattform) este canalul global de rezervare al myBestDays însuși — comparabil cu Booking sau Airbnb, dar parte a aceleiași platforme. Aici oaspeții caută obiecte de la toate companiile conectate și rezervă direct.",
            },
            { type: "h2", text: "Nu este „direct”, ci un canal de rang egal" },
            {
              type: "p",
              text: "Piața nu înlocuiește rezervarea directă prin propriul dvs. site web. Este o a treia cale de vânzare de sine stătătoare, cu propria axă de vizibilitate, propria bază de oaspeți și propriul comision — exact ca un portal, doar că este operată chiar de myBestDays.",
            },
            { type: "h2", text: "Cum ajung obiectele pe piață" },
            {
              type: "ul",
              items: [
                "Obiectul trebuie să fie activ (starea obiectului permite vânzarea).",
                "Vizibilitatea pe piață trebuie să fie activată — separat de portaluri și site web.",
                "Pentru perioada dorită trebuie să existe disponibilitate în calendar.",
              ],
            },
            { type: "h2", text: "Rezervări de pe piață" },
            {
              type: "p",
              text: "O rezervare de pe piață blochează imediat nopțile corespunzătoare pe toate celelalte canale — exact ca o rezervare prin portal sau prin site web. Aceasta apare în calendarul dvs. și în rezervări ca oricare altă rezervare, marcată cu canalul „Piață”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell și o stare inactivă a obiectului acționează transversal pe canale și blochează și piața — independent de comutatorul de vizibilitate al pieței.",
            },
            {
              type: "p",
              text: "Cum activați un obiect pentru piață, citiți la [Listarea unui obiect pe piață](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Listarea unui obiect pe piață",
          excerpt: "Vizibilitatea pe piață este un comutator propriu, separat de portaluri și site web.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Vizibilitatea pe piață o controlați printr-un comutator propriu la obiect — independent dacă același obiect este vizibil și pe portaluri sau pe site-ul dvs. web.",
            },
            { type: "h2", text: "Cum listați un obiect" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în secțiunea Obiecte.",
                "Treceți la fila Vizibilitate.",
                "Activați comutatorul Piață.",
                "Verificați dacă starea obiectului este activă și dacă există disponibilitate în calendar.",
              ],
            },
            { type: "h2", text: "Condiție prealabilă: profil complet" },
            {
              type: "p",
              text: "Piața afișează doar obiecte cu date complete — fotografie principală, descriere, dotări și preț de bază trebuie completate. Dacă lipsesc date obligatorii, obiectul rămâne invizibil, în ciuda comutatorului activat.",
            },
            {
              type: "ul",
              items: [
                "Cel puțin o fotografie principală și o descriere",
                "Caracteristici de dotare din lista de categorii",
                "Ocupare și preț de bază în moneda obiectului înregistrată",
                "Disponibilitate în calendar pentru perioada dorită",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Apăsând pe Publicare, myNextDays activează în mod normal simultan piața, portalurile și site-ul web — puteți oricând dezactiva ulterior, individual, comutatorul pieței.",
            },
            { type: "h2", text: "Eliminarea vizibilității" },
            {
              type: "p",
              text: "Dacă dezactivați comutatorul Piață, obiectul dispare din căutarea de pe piață. Rezervările deja confirmate rămân neafectate și continuă ca de obicei, vezi [Comisionul pieței](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Comisionul pieței",
          excerpt: "Pentru fiecare rezervare mediată prin piață se aplică comisionul înregistrat în tarif.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Ca la orice portal de rezervare, pentru rezervările realizate prin piața myBestDays se aplică un comision. Acesta se calculează per rezervare și este independent de eventualele comisioane pentru portaluri.",
            },
            { type: "h2", text: "Cum se calculează comisionul" },
            {
              type: "p",
              text: "Valoarea se stabilește în funcție de comisionul înregistrat în tariful companiei dvs. Găsiți cota actuală oricând în Cont, în secțiunea Facturare — acolo nu se presupune o valoare generală, ci este afișată cota efectiv valabilă pentru tariful dvs.",
            },
            { type: "h2", text: "Unde vizualizați comisionul" },
            {
              type: "steps",
              items: [
                "Deschideți Cont din meniu.",
                "Treceți la secțiunea Facturare.",
                "Deschideți o rezervare de pe piață, pentru a vedea în detaliu venitul și comisionul.",
                "Verificați privirea de ansamblu a comisioanelor pentru perioada de facturare curentă.",
              ],
            },
            { type: "h2", text: "Delimitare față de comisioanele de portal" },
            {
              type: "ul",
              items: [
                "Comisionul pieței se aplică exclusiv rezervărilor prin piața myBestDays.",
                "Rezervările prin portal (Booking, Airbnb & Co.) se supun condițiilor portalului respectiv.",
                "Rezervările prin site web se supun condițiilor înregistrate pentru tariful dvs., fără comisionul pieței.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Comisionul se determină automat din tariful dvs. Un tarif lipsă sau neclar duce la un mesaj de eroare clar, nu la o valoare estimată.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profilul oaspetelui și recenzii",
          excerpt: "Oaspeții de pe piață au un profil cu istoricul rezervărilor și pot lăsa recenzii.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Oaspeții care rezervă prin piața myBestDays își creează un profil propriu de oaspete. Acolo se adună rezervările lor, mesajele cu companiile și recenziile lăsate — similar unui cont de oaspete de portal.",
            },
            { type: "h2", text: "Ce vedeți dvs. ca și companie" },
            {
              type: "p",
              text: "În detaliile rezervării unei rezervări de pe piață găsiți profilul oaspetelui, cu sejururile anterioare la compania dvs. și, dacă a fost aprobat de oaspete, recenzii vizibile public despre alte unități de cazare.",
            },
            { type: "h2", text: "Recenzii după sejur" },
            {
              type: "steps",
              items: [
                "După check-out, oaspetele primește o solicitare de recenzie.",
                "Recenzia apare, după o scurtă verificare, pe pagina obiectului de pe piață.",
                "Puteți răspunde public, ca și companie, la fiecare recenzie.",
                "Recenziile lipsite de obiectivitate sau abuzive pot fi trimise spre verificare prin Raportare.",
              ],
            },
            {
              type: "ul",
              items: [
                "Recenziile sunt legate de o rezervare reală — nicio recenzie fără sejur.",
                "Oaspetele evaluează curățenia, comunicarea, amplasarea și raportul calitate-preț.",
                "Răspunsul dvs. este vizibil tuturor vizitatorilor pieței.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Recenziile bune influențează direct poziționarea obiectului dvs. în căutarea de pe piață — reacționați prompt și obiectiv la critici.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Persoane blocate",
          excerpt: "O companie poate bloca un oaspete, astfel încât mesajele și rezervările sunt blocate.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Dacă apar probleme cu un oaspete, îl puteți bloca ca și companie. O persoană blocată nu vă mai poate trimite mesaje și nu mai poate crea nicio rezervare nouă la compania dvs.",
            },
            { type: "h2", text: "Blocarea unei persoane" },
            {
              type: "steps",
              items: [
                "Deschideți istoricul de mesaje sau rezervarea cu oaspetele respectiv.",
                "Apăsați pe Blocare oaspete.",
                "Confirmați dialogul — blocarea se aplică imediat.",
                "Persoana blocată apare apoi în Cont, la Persoane blocate.",
              ],
            },
            { type: "h2", text: "Ce face blocarea" },
            {
              type: "ul",
              items: [
                "Oaspetele nu mai poate trimite mesaje noi companiei dvs.",
                "Oaspetele nu mai poate crea o rezervare nouă la compania dvs.",
                "O rezervare în curs, cu o sosire deja confirmată în următoarele două săptămâni, rămâne neafectată de blocare, pentru ca sejurul să poată fi desfășurat corect.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blocarea se aplică exclusiv pentru compania dvs. Alte companii de pe piață nu văd blocarea și nu sunt afectate de ea.",
            },
            { type: "h2", text: "Ridicarea blocării" },
            {
              type: "p",
              text: "Deschideți Cont și acolo Persoane blocate. Alegeți intrarea și apăsați pe Ridicare blocare — oaspetele poate apoi trimite din nou mesaje și poate rezerva.",
            },
          ],
        },
      ],
    },
  ],
};
