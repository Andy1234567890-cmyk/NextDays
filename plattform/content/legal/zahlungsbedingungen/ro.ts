import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condiții de plată",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezentele condiții de plată reglementează modul în care sunt procesate plățile în legătură cu o rezervare prin myBestDays. Ele completează [Condițiile de utilizare pentru oaspeți](https://mybestdays.dk/rechtliches/nutzungsbedingungen); în caz de contradicții privind chestiuni de plată, prevalează prezentele condiții de plată.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Rolul nostru la plată",
      paragraphs: [
        "myBestDays procesează plățile în numele furnizorului. Nu suntem instituție de plată și nici instituție emitentă de monedă electronică; serviciul de plată propriu-zis este prestat de prestatorul nostru de servicii de plată.",
        "Plățile prin Platformă sunt procesate de Stripe (Stripe Payments Europe, Limited). Datele cardurilor și celelalte date de plată sunt colectate și prelucrate direct de Stripe. myBestDays nu stochează date complete de card.",
        "Dacă plătiți prin Platformă, obligația dumneavoastră de plată față de furnizor se consideră îndeplinită până la concurența sumei plătite de îndată ce plata este autorizată și încasată cu succes de prestatorul nostru de servicii de plată.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Modalități de plată",
      paragraphs: [
        "Ce modalități de plată sunt disponibile depinde de anunț, de țara furnizorului și de țara dumneavoastră. Modalitățile de plată disponibile vă sunt afișate înainte de finalizarea rezervării.",
        "Pentru anumite modalități de plată este necesară o autentificare strictă a clientului conform Directivei (UE) 2015/2366. Fără o autentificare reușită, plata nu poate fi executată.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Exigibilitate, avans și plata restului",
      paragraphs: [
        "Când devine exigibilă fiecare sumă stabilește furnizorul în anunț. Uzuale sunt trei modele: plata integrală la rezervare, avans la rezervare cu plata restului înainte de sosire, sau plata la fața locului la furnizor.",
        "Modelul aplicabil rezervării dumneavoastră și scadențele sunt afișate înainte de finalizarea rezervării și repetate în confirmarea rezervării.",
        "Înainte de scadența plății restului vă transmitem o notificare la adresa de e-mail indicată. Dacă plata restului nu intervine, furnizorul poate rezilia contractul conform condițiilor sale de anulare.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Moneda",
      paragraphs: [
        "Decontarea se face în moneda anunțului. Această monedă este indicată la fiecare preț și în procesul de plată.",
        "Dacă vi se afișează o sumă și în altă monedă, aceasta este o conversie neangajantă, cu scop orientativ, și nu un preț obligatoriu.",
        "Dacă prestatorul dumneavoastră de servicii de plată convertește în altă monedă sau percepe un comision valutar, aceste costuri sunt suportate de dumneavoastră. Ele nu fac parte din prețul total și nu sunt stabilite și nici încasate de noi.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Garanția",
      paragraphs: [
        "Dacă anunțul prevede o garanție, cuantumul acesteia este indicat înainte de finalizarea rezervării.",
        "În funcție de anunț, garanția este preautorizată pe mijlocul dumneavoastră de plată (suma este rezervată, dar nu debitată) sau este încasată. O preautorizare vă poate reduce temporar plafonul disponibil al cardului.",
        "După ședere, preautorizarea este eliberată sau garanția încasată este rambursată, în măsura în care furnizorul nu invocă o daună. Dacă furnizorul invocă o daună, trebuie să o dovedească; asupra temeiniciei decide raportul dintre dumneavoastră și furnizor.",
        "Dacă furnizorul solicită garanția în schimb la fața locului, aceasta este un cost la fața locului și nu se derulează prin Platformă.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Rambursări",
      paragraphs: [
        "Rambursările se efectuează la mijlocul de plată utilizat pentru plată, cu excepția cazului în care s-a convenit altfel sau acest lucru nu este posibil tehnic.",
        "Inițiem o rambursare fără întârziere, de îndată ce motivul acesteia este stabilit. Cât durează până când creditarea devine vizibilă în contul sau pe cardul dumneavoastră este stabilit de prestatorul dumneavoastră de servicii de plată; uzual sunt cinci până la zece zile bancare lucrătoare.",
        "Dacă și în ce cuantum există un drept la rambursare depinde de [Condițiile de anulare](https://mybestdays.dk/rechtliches/stornierungsbedingungen) și de [Politica de remodificare și rambursare](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Plăți eșuate și stornări",
      paragraphs: [
        "Dacă o plată eșuează, vă informăm și vă oferim posibilitatea de a înregistra un alt mijloc de plată. Dacă plata nu intervine, rezervarea poate fi anulată.",
        "Dacă stornați o plată deja executată fără să existe un drept la rambursare, furnizorul poate solicita în continuare suma. Costurile care ne revin dintr-o stornare nejustificată vi le putem factura.",
        "Dacă apreciem că o plată este frauduloasă, o putem reține sau putem anula rezervarea. Vă informăm despre aceasta și motivăm decizia.",
      ],
    },
    {
      id: "belege",
      heading: "8. Documente și deconturi",
      paragraphs: [
        "Pentru sumele plătite prin Platformă vă punem la dispoziție un document justificativ, pe care îl puteți accesa în contul dumneavoastră la „Rezervări”.",
        "Factura pentru serviciul de cazare este emisă de furnizor; el este profesionistul prestator. Privind taxele, a se vedea [Politica fiscală](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Modificări ale prezentelor condiții de plată",
      paragraphs: [
        "Pentru modificările prezentelor condiții de plată se aplică secțiunea A22 din [Condițiile de utilizare](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
