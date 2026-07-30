import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Managerul de canale",
  description: "Stăpâniți portalurile și managerul de canale.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Managerul de canale",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Conectarea primului dvs. portal",
          excerpt: "Cum activați pentru prima dată un portal pentru un obiect.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: ați adăugat un obiect, dar nu ați conectat încă niciun portal",
            },
            {
              type: "p",
              text: "Obiectul dvs. este complet configurat în myNextDays, dar nu este încă vizibil pe niciun portal, precum Booking.com sau Airbnb. Înainte ca un portal să accepte un obiect, contul dvs. are nevoie o singură dată de o conexiune cu portalurile, la nivel de cont — după aceea, pentru fiecare obiect suplimentar este suficientă doar o mapare.",
            },
            {
              type: "steps",
              items: [
                "Deschideți /konto, secțiunea „Portaluri și managerul de canale”, și configurați conexiunea la nivel de cont, cu datele companiei dvs.",
                "Deschideți apoi obiectul în /objekte și treceți la fila „Portaluri”",
                "Alegeți portalul dorit și asociați-l cu tipul de cameră, respectiv de ofertă, potrivit",
                "Verificați fotografiile, dotările, prețurile și condițiile de anulare — portalurile solicită date complete",
                "Activați vizibilitatea; statusul trece, după verificarea de către portal, pe „Conectat”",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Conexiunea la nivel de cont o configurați o singură dată. Detalii la [Conectarea Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) și [Conectarea Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Conectarea Booking.com",
          excerpt: "Cum faceți un obiect rezervabil pe Booking.com prin managerul de canale.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: obiectul dvs. trebuie să devină vizibil suplimentar pe Booking.com",
            },
            {
              type: "p",
              text: "Booking.com este unul dintre portalurile conectate prin managerul de canale. Condiția prealabilă este conexiunea la nivel de cont cu portalurile — dacă aceasta este deja configurată, aveți nevoie pentru Booking.com doar de o mapare per obiect.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Alegeți „Booking.com” din lista portalurilor disponibile",
                "Asociați tipul de cameră, respectiv de ofertă, potrivit și confirmați cel puțin un tarif, cu preț și condiții de anulare",
                "Înregistrați o metodă de plată validă pentru decontarea comisionului",
                "Activați vizibilitatea pentru Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Activarea de către Booking.com poate dura câteva ore. Statusul din fila „Portaluri” arată de îndată ce conexiunea este activă.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Conectarea Airbnb",
          excerpt: "Cum faceți un obiect rezervabil pe Airbnb prin managerul de canale.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: obiectul dvs. trebuie să devină vizibil suplimentar pe Airbnb",
            },
            {
              type: "p",
              text: "Airbnb este conectat ca orice alt portal, prin conexiunea la nivel de cont. Odată configurată aceasta, activați Airbnb per obiect printr-o mapare — indiferent dacă obiectul este deja vizibil pe Booking.com sau pe alte portaluri.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Alegeți „Airbnb” din lista portalurilor disponibile",
                "Confirmați categoria obiectului și tipul de ofertă asociat",
                "Completați fotografiile, dotările și regulile casei — Airbnb solicită date complete înainte de activare",
                "Activați vizibilitatea pentru Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără condiții de anulare și regulament al casei înregistrate, Airbnb respinge activarea. Completați mai întâi aceste date în obiect.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Menținerea prețurilor sincronizate pe toate portalurile",
          excerpt: "Un singur calendar este suficient — managerul de canale distribuie automat modificările de preț către toate portalurile.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: modificați un preț și doriți să vă asigurați că este corect peste tot",
            },
            {
              type: "p",
              text: "Gestionați prețurile exclusiv în calendarul myNextDays al obiectului — niciodată separat, în portalurile înseși. Managerul de canale transmite automat fiecare modificare către toate portalurile pentru care obiectul este mapat activ.",
            },
            {
              type: "steps",
              items: [
                "Deschideți calendarul de prețuri, respectiv planurile de tarifare ale obiectului",
                "Ajustați prețul zilnic, sejurul minim sau restricția de sosire/plecare",
                "Salvați modificarea — aceasta acționează mai întâi intern, la obiect",
                "Verificați în fila „Portaluri” dacă toate portalurile dorite sunt în continuare mapate activ",
                "Așteptați câteva minute, până când modificarea este transmisă către portaluri",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nu introduceți niciodată prețuri direct în portal — astfel de modificări sunt suprascrise la următoarea sincronizare de către calendarul myNextDays.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importul unei rezervări de pe portal",
          excerpt: "Rezervările de pe portal ajung automat în calendar — aici verificați dacă importul a reușit.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: un oaspete a rezervat printr-un portal, iar rezervarea trebuie să ajungă în myNextDays",
            },
            {
              type: "p",
              text: "Dacă un oaspete rezervă prin Booking.com, Airbnb sau alt portal conectat, managerul de canale importă automat rezervarea — nu trebuie să transmiteți nimic manual. Acest flux descrie cum verificați și confirmați importul.",
            },
            {
              type: "steps",
              items: [
                "Deschideți calendarul sau lista de rezervări a obiectului afectat",
                "Căutați noua rezervare — aceasta poartă o insignă de origine a portalului, de exemplu Booking.com sau Airbnb",
                "Verificați dacă datele oaspetelui, perioada și prețul sunt complete",
                "Verificați dacă nopțile rezervate sunt afișate ca blocate pe toate celelalte canale",
                "Deschideți, dacă este necesar, detaliile rezervării, pentru a prelucra servicii suplimentare sau mesaje ale oaspetelui",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dacă oaspetele anulează prin portal sau modifică perioada, acest lucru este de asemenea preluat automat, iar nopțile sunt eliberate din nou.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Rezolvarea unei duble rezervări",
          excerpt: "Cum procedați atunci când aceeași noapte a fost vândută, în mod excepțional, pe două canale.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: două rezervări se suprapun pentru același obiect și aceleași nopți",
            },
            {
              type: "p",
              text: "Managerul de canale blochează în mod normal imediat, transversal, nopțile rezervate. O dublă rezervare poate apărea totuși, de exemplu la rezervări simultane pe două portaluri, în același moment, sau la o rezervare adăugată manual, care intră în coliziune cu o rezervare de pe portal.",
            },
            {
              type: "steps",
              items: [
                "Deschideți calendarul obiectului și identificați ambele rezervări suprapuse",
                "Verificați momentul rezervării și insigna de origine ale ambelor rezervări",
                "Contactați oaspetele care a intrat cel mai recent și oferiți un obiect alternativ sau o perioadă alternativă",
                "Anulați rezervarea nesustenabilă în portalul respectiv, nu doar în myNextDays",
                "Setați apoi Stop-Sell pentru nopțile afectate, până când cazul este complet clarificat",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Anulați întotdeauna o rezervare de portal prin portalul însuși — o anulare doar în myNextDays eliberează, ce-i drept, noaptea intern, dar nu informează portalul în mod fiabil.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Punerea în pauză temporară a unui portal",
          excerpt: "Dezactivați vizibilitatea per portal, individual, fără a pierde maparea.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: un obiect nu trebuie să fie temporar rezervabil pe un portal",
            },
            {
              type: "p",
              text: "Vizibilitatea poate fi activată individual, per portal — independent de site-ul web și de piață. Dacă doriți, de exemplu, să puneți în pauză Airbnb pe termen scurt, dar să lăsați Booking.com să funcționeze în continuare, dezactivați exclusiv acest unic canal.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Căutați intrarea portalului pe care doriți să îl puneți în pauză",
                "Dezactivați vizibilitatea pentru acest portal",
                "Salvați — modificarea acționează în câteva minute, obiectul dispare din rezultatele căutării acestui portal",
                "Reactivați vizibilitatea de îndată ce obiectul trebuie să fie din nou rezervabil",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Maparea rămâne păstrată la punerea în pauză — nu trebuie să reconfigurați ulterior asocierea cu portalul. Pentru o blocare completă a tuturor canalelor folosiți în schimb Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Verificarea mapării obiectului",
          excerpt: "Cum controlați dacă obiectul dvs. mai este asociat corect cu tipul de ofertă potrivit din portal.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: prețurile sau disponibilitatea nu mai corespund pe un portal cu myNextDays",
            },
            {
              type: "p",
              text: "Dacă afișarea din portal diferă de calendarul dvs. myNextDays, cauza este adesea o mapare eronată sau întreruptă — legătura dintre obiectul dvs. și tipul de cameră, respectiv de ofertă, din portal.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în /objekte, fila „Portaluri”",
                "Verificați statusul portalului afectat — ar trebui să arate „Conectat”, nu „Eroare” sau „În așteptare”",
                "Controlați dacă tipul de cameră, respectiv de ofertă, asociat în portal mai corespunde obiectului real",
                "În caz de abatere: separați maparea și reasociați-o, apoi reactivați vizibilitatea",
                "Așteptați câteva minute după corectare și verificați din nou prețurile și disponibilitatea în portal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un obiect poate fi asociat simultan cu mai multe portaluri — verificați, în caz de neconcordanțe, în mod țintit portalul afectat, nu toate deodată.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Tarife diferite per portal",
          excerpt: "Cum atribuiți unui portal un plan de tarifare propriu, fără a influența celelalte canale.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: doriți să oferiți pe un portal un preț diferit față de celelalte canale",
            },
            {
              type: "p",
              text: "Planurile de tarifare pot fi asociate individual per portal, de exemplu un plan nerambursabil pentru un portal și unul flexibil pentru altul. Prețurile de bază rămân gestionate centralizat, la obiect, iar maparea stabilește ce plan de tarifare merge către ce portal.",
            },
            {
              type: "steps",
              items: [
                "Adăugați în obiect planul de tarifare suplimentar, cu condițiile dorite (preț, condiții de anulare, sejur minim)",
                "Deschideți fila „Portaluri” și alegeți portalul afectat",
                "Asociați în mapare noul plan de tarifare acestui portal",
                "Lăsați celelalte portaluri neschimbate, pe planul lor de tarifare actual",
                "Salvați și verificați, după câteva minute, afișarea prețului în portalul respectiv",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Fiecare plan de tarifare este transmis independent — o modificare la un plan de tarifare nu se răsfrânge asupra portalurilor asociate unui alt plan de tarifare.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Rezolvarea erorilor frecvente de portal",
          excerpt: "Cauze tipice atunci când un portal respinge un obiect sau sincronizarea se blochează.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare: statusul unui portal arată o eroare sau obiectul nu este preluat",
            },
            {
              type: "p",
              text: "Portalurile resping de regulă o conexiune din cauza datelor de bază lipsă sau a datelor incomplete despre obiect. Parcurgeți pe rând cauzele cele mai frecvente, înainte de a contacta suportul.",
            },
            {
              type: "steps",
              items: [
                "Verificați la /konto dacă adresa, informațiile fiscale și datele de contact sunt complete",
                "Controlați la obiect dacă descrierea, fotografiile, dotările și cel puțin un tarif sunt complete",
                "Verificați dacă este înregistrată o metodă de plată validă pentru comisioane",
                "Deschideți fila „Portaluri” și citiți mesajul de eroare exact, lângă portalul afectat",
                "Remediați lipsa indicată și reactivați vizibilitatea",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O eroare de portal afectează întotdeauna doar acest unic portal — celelalte canale funcționează independent în continuare, atât timp cât propriile lor cerințe sunt îndeplinite.",
            },
          ],
        },
      ],
    },
  ],
};
