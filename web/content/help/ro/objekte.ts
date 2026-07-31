import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Obiecte și dotări",
  description: "Adăugați și gestionați camere și unități de cazare de vacanță.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Gestionarea obiectelor",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Obiect = o unitate rezervabilă",
          excerpt: "De ce fiecare obiect din myNextDays este exact o unitate rezervabilă.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "În myNextDays, un obiect este întotdeauna exact o unitate rezervabilă — o singură cameră dintr-un hotel sau o unitate de cazare de vacanță completă. Acest principiu se aplică indiferent dacă administrați o casă de vacanță, un apartament de vacanță sau un hotel și stă la baza disponibilității, prețurilor și rezervărilor.",
            },
            { type: "h2", text: "Nicio clădire cu camere subordonate" },
            {
              type: "p",
              text: "O neînțelegere frecventă este reprezentarea unei clădiri de hotel ca un singur obiect cu mai multe camere subordonate. Acest lucru nu este prevăzut în myNextDays. Dacă, de exemplu, administrați un hotel cu opt camere duble și patru camere single, adăugați douăsprezece obiecte individuale — nu un singur obiect cu un număr de camere.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Un câmp precum „numărul de camere” la nivel de obiect nu există în mod intenționat. Fiecare cameră are nevoie de propriul obiect, cu propriul calendar și propriile prețuri.",
            },
            { type: "h2", text: "Unități de cazare de vacanță" },
            {
              type: "p",
              text: "În cazul unei case sau al unui apartament de vacanță, întregul obiect corespunde unității rezervabile. Aici nu există o subdivizare suplimentară — o unitate de cazare de vacanță este întotdeauna un obiect de sine stătător, cu propriul calendar.",
            },
            { type: "h2", text: "De ce este important acest lucru" },
            {
              type: "ul",
              items: [
                "Fiecare obiect are propriul calendar de disponibilitate — suprarezervările sunt prevenite exact la nivel de obiect.",
                "Prețurile, dotările și fotografiile se aplică per obiect, nu per clădire.",
                "Un obiect aparține întotdeauna exact unui singur proprietar — nicio atribuire multiplă.",
                "Vizibilitatea pe canale (site web, piață, portaluri) este controlată per obiect.",
              ],
            },
            {
              type: "p",
              text: "Cum alegeți tipul de obiect potrivit pentru camera sau unitatea dvs. de cazare de vacanță, citiți la [Stabilirea tipului de obiect](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Stabilirea tipului de obiect",
          excerpt: "Atribuiți corect categoria, tipul de imobil și tipul de ofertă.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Tipul de obiect determină modul în care obiectul dvs. este clasificat și filtrat pe portaluri și pe piață. Acesta constă din trei câmpuri de selecție interdependente, pe care le parcurgeți la adăugarea sau editarea unui obiect.",
            },
            { type: "h2", text: "Cele trei niveluri de selecție" },
            {
              type: "steps",
              items: [
                "Alegeți mai întâi categoria — de exemplu, cazare de vacanță sau hotel.",
                "Alegeți apoi, pe baza acesteia, tipul de imobil — de exemplu, apartament de vacanță, casă de vacanță, cameră dublă sau cameră single.",
                "Alegeți tipul de ofertă — de exemplu, întregul obiect sau o cameră privată.",
                "Completați câmpurile suplimentare afișate în funcție de selecție, de exemplu tipul de pat sau etajul.",
              ],
            },
            { type: "h2", text: "De ce contează ordinea" },
            {
              type: "p",
              text: "Cele trei liste derulante sunt interdependente: selectarea categoriei restrânge tipurile de imobil disponibile, iar selectarea tipului de imobil restrânge, la rândul ei, tipurile de ofertă. Astfel apar doar combinații rezonabile, similare celor folosite pe portalurile mari.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dacă modificați ulterior categoria, myNextDays verifică dacă tipul de imobil și tipul de ofertă mai corespund și, dacă este necesar, vă solicită o nouă selecție.",
            },
            { type: "h2", text: "Editarea tipului de obiect" },
            {
              type: "p",
              text: "Deschideți obiectul dorit în secțiunea Obiecte și treceți la fila Date de bază. Acolo găsiți cele trei liste derulante la Tipul obiectului. Dacă salvați modificarea, noua clasificare este transmisă către toate canalele active.",
            },
            {
              type: "ul",
              items: [
                "Categorie: clasificare de nivel superior (de ex. cazare de vacanță, hotel)",
                "Tip de imobil: tipul concret al obiectului (de ex. apartament de vacanță, cameră dublă)",
                "Tip de ofertă: ce anume se rezervă (de ex. întregul obiect, cameră privată)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Gestionarea dotărilor",
          excerpt: "Selectați și mențineți la zi caracteristicile dotării.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Dotarea unui obiect influențează decisiv cât de bine este găsit și filtrat pe portaluri. Oaspeții filtrează în mod specific după caracteristici precum Wi-Fi, bucătărie sau parcare — informațiile lipsă pot exclude un obiect din rezultatele căutării.",
            },
            { type: "h2", text: "Selectarea dotărilor" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la fila Dotări.",
                "Selectați toate caracteristicile aplicabile din lista predefinită.",
                "Completați, dacă este necesar, detalii precum numărul de locuri de parcare sau tipul de bucătărie.",
                "Salvați modificările — acestea sunt transmise automat către toate portalurile active.",
              ],
            },
            { type: "h2", text: "De unde provin caracteristicile" },
            {
              type: "p",
              text: "Lista de dotări urmează catalogul de caracteristici al portalurilor mari, astfel încât datele dvs. să poată fi atribuite corect acolo. Nu sunt prevăzute caracteristici proprii, inventate liber, deoarece acestea nu ar putea fi transmise corect către portaluri.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Verificați dotările după fiecare modificare structurală — de exemplu un aparat de aer condiționat nou sau o baie suplimentară — pentru ca informațiile să rămână actuale pe toate canalele.",
            },
            { type: "h2", text: "Grupe de caracteristici frecvente" },
            {
              type: "ul",
              items: [
                "Dotări de bază: Wi-Fi, încălzire, aer condiționat",
                "Bucătărie și masă: bucătărie complet utilată, mașină de spălat vase, aparat de cafea",
                "Baie și lenjerie: baie proprie, mașină de spălat, prosoape",
                "Zonă exterioară: balcon, terasă, grădină, parcare",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotografii și descriere",
          excerpt: "Imagini și texte convingătoare pentru mai multe rezervări.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Fotografiile și descrierea sunt cel mai important criteriu de decizie pentru oaspeți. Un obiect poate fi publicat abia atunci când există cel puțin o fotografie principală și o descriere.",
            },
            { type: "h2", text: "Încărcarea fotografiilor" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la fila Fotografii.",
                "Trageți fișierele imagine în zona de încărcare sau selectați-le prin dialogul de fișiere.",
                "Stabiliți o fotografie principală — aceasta va apărea în rezultatele căutării și în carduri.",
                "Ordonați celelalte fotografii prin tragere, într-o ordine logică.",
              ],
            },
            { type: "h2", text: "Redactarea descrierii" },
            {
              type: "p",
              text: "Treceți la fila Descriere și introduceți un titlu, precum și un text descriptiv. Descrieți concret amplasarea, particularitățile și publicul-țintă al obiectului — formulările generale sunt mai puțin convingătoare pe portaluri decât detaliile concrete.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Nu este permisă folosirea fotografiilor altor obiecte sau preluate de pe internet — portalurile verifică acest lucru și pot suspenda obiectele în caz de încălcare.",
            },
            { type: "h2", text: "Recomandări pentru fotografii bune" },
            {
              type: "ul",
              items: [
                "Cel puțin cinci fotografii, ideal câte una pentru fiecare cameră",
                "Format orizontal, expunere bună, fără filigran",
                "Fotografia principală arată obiectul cât mai atrăgător și clar posibil",
                "Actualizare regulată, în special după renovări",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Ocupare și capacitate",
          excerpt: "Completați corect numărul maxim de oaspeți și distribuția paturilor.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Ocuparea stabilește câți oaspeți poate primi un obiect și este verificată la fiecare căutare și rezervare. Datele incorecte duc fie la respingerea cererilor, fie la supraocupare — ambele situații trebuie evitate.",
            },
            { type: "h2", text: "Introducerea ocupării" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la fila Ocupare.",
                "Introduceți numărul maxim de adulți.",
                "Introduceți numărul maxim de copii, dacă sunt acceptați.",
                "Completați distribuția paturilor pe cameră, de exemplu un pat dublu și două paturi single.",
              ],
            },
            { type: "h2", text: "Limitele ocupării" },
            {
              type: "p",
              text: "La o cerere de rezervare, myNextDays verifică automat dacă numărul de oaspeți solicitat se încadrează în ocuparea înregistrată. Cererile care depășesc capacitatea maximă sunt respinse, respectiv nici măcar nu sunt afișate ca fiind rezervabile.",
            },
            {
              type: "note",
              variant: "info",
              text: "Un pat suplimentar sau un pătuț pentru copii crește capacitatea reală doar dacă îl introduceți explicit în distribuția paturilor — altfel numărul maxim de oaspeți rămâne neschimbat.",
            },
            { type: "h2", text: "Surse tipice de erori" },
            {
              type: "ul",
              items: [
                "Numărul maxim de oaspeți setat prea mare, deși există puține paturi",
                "Numărul de copii uitat, deși obiectul se adresează familiilor",
                "Distribuția paturilor neactualizată după o renovare",
              ],
            },
            {
              type: "p",
              text: "Dacă ocuparea și dotările nu se potrivesc, verificați suplimentar fila [Dotări](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Starea obiectului și vizibilitatea",
          excerpt: "Diferența dintre activ/inactiv și cele trei axe de canal.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "myNextDays face distincție între două lucruri diferite, care sunt adesea confundate: starea obiectului (activ sau inactiv) și vizibilitatea pe canalele individuale de vânzare. Ambele se controlează separat una de cealaltă.",
            },
            { type: "h2", text: "Starea obiectului" },
            {
              type: "p",
              text: "Starea active înseamnă că un obiect este, în principiu, disponibil pentru vânzare. Starea inactive scoate complet un obiect din uz — de exemplu în cazul unei renovări pe termen lung. Un obiect inactiv nu poate fi rezervat pe niciun canal, indiferent de comutatoarele de canal.",
            },
            { type: "h2", text: "Cele trei axe de canal" },
            {
              type: "p",
              text: "Dacă un obiect este activ, trei comutatoare independente decid exact unde este vizibil:",
            },
            {
              type: "ul",
              items: [
                "Site web — vizibilitate pe propriul dvs. site myNextDays",
                "Piață — vizibilitate pe piața globală myBestDays",
                "Portaluri — vizibilitate pe Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Aceste trei axe sunt complet independente de starea obiectului și una de cealaltă. Un obiect activ poate fi, de exemplu, vizibil doar pe site-ul web, dar nu pe portaluri.",
            },
            { type: "h2", text: "Modificarea stării" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la fila Prezentare generală.",
                "Setați starea pe activ sau inactiv.",
                "Ajustați, dacă este necesar, și cele trei comutatoare de canal din fila Vizibilitate.",
                "Salvați modificarea — aceasta acționează imediat pe toate canalele afectate.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pentru o blocare pe termen scurt a unor zile individuale, folosiți în schimb Stop-Sell în calendar — acesta blochează în mod țintit zile pe toate canalele, fără a dezactiva întregul obiect.",
            },
          ],
        },
      ],
    },
  ],
};
