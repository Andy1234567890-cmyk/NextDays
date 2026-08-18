import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica de confidențialitate",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezenta politică descrie ce date cu caracter personal prelucrează myBestDays, în ce scopuri, în ce temei juridic și ce drepturi aveți. Ea se aplică site-ului web, aplicațiilor mobile și tuturor celorlalte puncte de acces la Platformă.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Operatorul și responsabilul cu protecția datelor",
      paragraphs: [
        `Operator în sensul Regulamentului (UE) 2016/679 (RGPD) este ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemarca, nr. CVR ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Datele complete ale furnizorului sunt indicate în [Informații juridice](https://mybestdays.dk/rechtliches/impressum).`,
        "Nu a fost desemnat un responsabil cu protecția datelor; condițiile articolului 37 RGPD nu sunt îndeplinite. Întrebările privind protecția datelor le adresați la adresa de e-mail de mai sus.",
        "Furnizorii la care rezervați sunt operatori independenți pentru datele pe care le primesc de la noi. Pentru ei se aplică [Standardele de protecție a datelor pentru gazde](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Ce date prelucrăm",
      paragraphs: ["În funcție de modul în care utilizați Platforma, prelucrăm:"],
      list: [
        "date de bază — nume, adresă de e-mail, număr de telefon, limbă și monedă, parolă în formă criptată;",
        "date de rezervare — unitatea de cazare rezervată, perioada, numărul și numele călătorilor, cerințe speciale, statutul rezervării;",
        "date de plată — suma, moneda, statutul plății, ultimele cifre ale mijlocului de plată și identificatorul tranzacției de la prestatorul nostru de servicii de plată. Datele complete de card nu ajung la noi;",
        "date de comunicare — mesaje între dumneavoastră și furnizor, solicitări către serviciul nostru clienți, plângeri;",
        "date de conținut — recenzii, fotografii, liste de dorințe;",
        "date de utilizare — pagini vizitate, interogări de căutare, ora accesului;",
        "date tehnice — adresă IP, identificatori de browser și de dispozitiv, sistem de operare, pagină de referință.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Scopuri și temeiuri juridice",
      paragraphs: [
        "Punerea la dispoziție a Platformei, contul, căutarea, rezervarea, procesarea plăților și comunicarea cu furnizorul — articolul 6 alineatul (1) litera (b) RGPD (contract sau măsuri precontractuale).",
        "Serviciul clienți, tratarea plângerilor și soluționarea litigiilor — articolul 6 alineatul (1) literele (b) și (f) RGPD.",
        "Detectarea și prevenirea fraudelor, abuzurilor și incidentelor de securitate, aplicarea condițiilor noastre — articolul 6 alineatul (1) litera (f) RGPD (interes legitim privind o piață sigură).",
        "Recenziile și publicarea acestora — articolul 6 alineatul (1) literele (b) și (f) RGPD.",
        "Îndeplinirea obligațiilor legale, în special a obligațiilor comerciale și fiscale de păstrare, a obligațiilor de raportare conform Directivei (UE) 2021/514 (DAC7) și a obligațiilor conform Regulamentului (UE) 2022/2065 — articolul 6 alineatul (1) litera (c) RGPD.",
        "Îmbunătățirea Platformei prin analiza datelor agregate de utilizare — articolul 6 alineatul (1) litera (f) RGPD.",
        "E-mailuri publicitare și cookie-uri care nu sunt necesare — articolul 6 alineatul (1) litera (a) RGPD (consimțământ), pe care îl puteți retrage oricând cu efect pentru viitor.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Destinatari",
      paragraphs: [
        "Furnizorii primesc datele de care au nevoie pentru a executa rezervarea dumneavoastră și pentru a-și îndeplini obligațiile legale — în special numele, datele de contact, perioada, numărul de călători și mesajele dumneavoastră adresate lor.",
        "Prestatorul nostru de servicii de plată Stripe prelucrează datele de plată în calitate de operator independent; suplimentar se aplică [Politica de confidențialitate Stripe](https://stripe.com/privacy).",
        "Prestatorii de servicii care realizează pentru noi găzduirea, operarea bazelor de date, expedierea de e-mailuri, diagnosticarea erorilor și instrumentele de serviciu clienți prelucrează datele exclusiv conform instrucțiunilor noastre, în temeiul unui contract conform articolului 28 RGPD.",
        "Autoritățile și instanțele primesc date numai în măsura în care suntem obligați; a se vedea [Politica pentru cererile autorităților și ale organelor de urmărire penală](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Autoritățile fiscale primesc datele furnizorilor care fac obiectul raportării DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Transferul către țări terțe",
      paragraphs: [
        "Serverele noastre și serverele persoanelor noastre împuternicite se află în Uniunea Europeană.",
        "Dacă în cazuri individuale are loc o prelucrare în afara Spațiului Economic European, aceasta se face numai în temeiul unei decizii de adecvare a Comisiei Europene sau al unor clauze contractuale standard conform articolului 46 alineatul (2) litera (c) RGPD, împreună cu garanții suplimentare.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Durate de stocare",
      paragraphs: [
        "Datele contului le stocăm atât timp cât există contul dumneavoastră și apoi le ștergem, în măsura în care nu se opune o obligație de păstrare.",
        "Datele de rezervare și de plată sunt supuse termenelor comerciale și fiscale de păstrare; conform dreptului contabil danez, acestea sunt de regulă cinci ani de la sfârșitul exercițiului la care se referă.",
        "Mesajele aferente unei rezervări le stocăm până la trei ani după încheierea șederii, pentru a fi posibilă clarificarea litigiilor.",
        "Recenziile rămân, după ștergerea contului dumneavoastră, în formă anonimizată, deoarece fac parte din baza de evaluare a unității de cazare.",
        "Datele privind cazurile de fraudă și abuz le stocăm atât timp cât este necesar pentru prevenirea unor noi încălcări, dar cel mult trei ani de la ultimul caz.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Drepturile dumneavoastră",
      paragraphs: ["Conform RGPD aveți următoarele drepturi:"],
      list: [
        "accesul la datele stocate despre dumneavoastră (articolul 15);",
        "rectificarea datelor incorecte (articolul 16);",
        "ștergerea (articolul 17), în măsura în care nu se opune o obligație de păstrare;",
        "restricționarea prelucrării (articolul 18);",
        "portabilitatea datelor (articolul 20);",
        "opoziția față de prelucrarea întemeiată pe interese legitime (articolul 21), în special față de marketingul direct;",
        "retragerea unui consimțământ acordat, cu efect pentru viitor (articolul 7 alineatul (3));",
        `plângerea la o autoritate de supraveghere (articolul 77) — competentă este autoritatea de la domiciliul, locul de muncă sau locul presupusei încălcări. La sediul operatorului aceasta este ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danemarca, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Cum vă exercitați drepturile",
      paragraphs: [
        `Multe date le puteți vedea, modifica sau șterge direct în contul dumneavoastră. Pentru toate celelalte adresați-vă la ${ANBIETER.email}.`,
        "Răspundem fără întârziere, cel târziu în termen de o lună. Dacă nu putem respecta termenul, vă comunicăm acest lucru cu o motivare.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Decizii automatizate",
      paragraphs: [
        "Utilizăm procedee automatizate pentru detectarea fraudelor, abuzurilor și conținutului ilegal. Dacă un astfel de procedeu conduce la o măsură împotriva contului sau conținutului dumneavoastră, o motivăm și puteți solicita o reexaminare de către o persoană.",
        "Nu luăm decizii bazate exclusiv pe prelucrare automatizată cu efecte juridice în sensul articolului 22 RGPD.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obligația de a furniza date",
      paragraphs: [
        "Datele necesare pentru o rezervare trebuie furnizate; fără ele nu se poate încheia un contract și nu poate fi pusă la dispoziție o unitate de cazare. Toate celelalte date sunt facultative.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Modificări ale prezentei politici",
      paragraphs: [
        "Adaptăm prezenta politică atunci când prelucrarea sau cadrul juridic se modifică. Versiunea în vigoare este disponibilă aici; data actualizării este indicată mai sus.",
      ],
    },
  ],
};
