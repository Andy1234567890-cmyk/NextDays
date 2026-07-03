import type { LegalDoc } from "../types";

// Rumänische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort, dann hier nachziehen.
export const agb: LegalDoc = {
  title: "Condiții de utilizare pentru oaspeți (CGA)",
  stand: "Ultima actualizare: 3 iulie 2026",
  intro: [
    "Prezentele condiții de utilizare reglementează utilizarea portalului de rezervări myNextDays (denumit în continuare „Platforma”) de către călători și persoanele care efectuează rezervări (denumiți în continuare „Oaspetele”).",
    "Operatorul Platformei este [denumirea completă a societății, forma juridică, adresa și datele de înregistrare ale operatorului — a se completa înainte de publicare] (denumit în continuare „myNextDays” sau „noi”).",
  ],
  sections: [
    {
      heading: "§ 1 Domeniul de aplicare",
      paragraphs: [
        "Prezentele condiții se aplică utilizării Platformei, în special căutării de unități de cazare și rezervării de servicii de cazare prin intermediul Platformei.",
        "Pentru serviciul de cazare propriu-zis se aplică suplimentar condițiile furnizorului respectiv (de ex. regulamentul de ordine interioară, condițiile de anulare), indicate în ofertă.",
      ],
    },
    {
      heading: "§ 2 Rolul myNextDays; încheierea contractului",
      paragraphs: [
        "myNextDays intermediază servicii de cazare oferite de furnizorii respectivi (agenții, locatori sau proprietari, denumiți în continuare „Furnizorul”). Contractul privind cazarea se încheie exclusiv între Oaspete și Furnizorul respectiv. myNextDays nu devine parte a contractului de cazare.",
        "Furnizorul respectiv este indicat în ofertă și în confirmarea rezervării.",
      ],
    },
    {
      heading: "§ 3 Rezervarea și confirmarea rezervării",
      paragraphs: [
        "Prezentarea unităților de cazare pe Platformă reprezintă o invitație de a face o ofertă de rezervare. Prin finalizarea procesului de rezervare (clic pe butonul de rezervare cu obligație de plată), Oaspetele face o ofertă fermă de încheiere a unui contract de cazare cu Furnizorul.",
        "Contractul se încheie în momentul confirmării rezervării. Confirmarea rezervării este transmisă Oaspetelui la adresa de e-mail indicată.",
        "Oaspetele este obligat să furnizeze date corecte și complete la efectuarea rezervării (în special numele, datele de contact și numărul călătorilor).",
      ],
    },
    {
      heading: "§ 4 Prețuri și plată",
      paragraphs: [
        "Se aplică prețurile indicate în ofertă la momentul rezervării, inclusiv taxele, comisioanele și costurile suplimentare indicate acolo. Prețurile sunt afișate în moneda indicată în ofertă. La fața locului pot fi percepute taxe locale suplimentare (de ex. taxa de stațiune), în măsura în care acest lucru este indicat în ofertă.",
        "Plata este procesată prin prestatorul de servicii de plată Stripe. Datele de plată (de ex. datele cardului) sunt colectate și prelucrate direct de Stripe; myNextDays nu stochează date complete de card. Stripe prelucrează date cu caracter personal în conformitate cu [Politica de confidențialitate Stripe](https://stripe.com/privacy).",
        "Dacă în ofertă este indicată o garanție, aceasta poate fi preautorizată la rezervare sau la sosire și poate fi reținută integral sau parțial în caz de daune; determinante sunt informațiile din ofertă.",
      ],
    },
    {
      heading: "§ 5 Anulare, modificarea rezervării și dreptul de retragere",
      paragraphs: [
        "Dacă și în ce condiții o rezervare poate fi anulată sau modificată gratuit se stabilește potrivit condițiilor de anulare ale Furnizorului indicate în ofertă.",
        "Pentru serviciile de cazare rezervate pentru o perioadă determinată nu există, de regulă, un drept legal de retragere, conform art. 16 lit. (l) din Directiva UE privind drepturile consumatorilor, respectiv dispozițiilor naționale corespunzătoare. Drepturile legale imperative ale Oaspetelui rămân neatinse.",
      ],
    },
    {
      heading: "§ 6 Obligațiile Oaspetelui",
      paragraphs: [
        "Oaspetele utilizează unitatea de cazare conform contractului, respectă numărul maxim de persoane indicat în ofertă și regulamentul de ordine interioară al Furnizorului.",
        "Platforma nu poate fi utilizată în mod abuziv, în special pentru rezervări fictive, plăți frauduloase sau publicarea de conținuturi ilegale (de ex. în recenzii sau mesaje).",
      ],
    },
    {
      heading: "§ 7 Răspunderea myNextDays",
      paragraphs: [
        "Pentru furnizarea serviciului de cazare răspunde exclusiv Furnizorul. myNextDays nu răspunde pentru corectitudinea conținutului ofertelor publicate de furnizori, însă asigură intermedierea și procesarea plăților cu diligența unui comerciant prudent.",
        "myNextDays răspunde nelimitat pentru intenție și neglijență gravă, precum și pentru prejudiciile rezultate din vătămarea vieții, a integrității corporale sau a sănătății. În caz de neglijență simplă, myNextDays răspunde numai pentru încălcarea obligațiilor contractuale esențiale (obligații cardinale), limitat la prejudiciul previzibil, tipic pentru contract. Normele legale imperative privind răspunderea rămân neatinse.",
      ],
    },
    {
      heading: "§ 8 Protecția datelor",
      paragraphs: [
        "myNextDays prelucrează date cu caracter personal ale Oaspetelui pentru realizarea intermedierii și a rezervării. Datele de rezervare sunt transmise Furnizorului respectiv, în măsura în care acest lucru este necesar pentru executarea contractului de cazare. Pentru procesarea plăților se aplică § 4.",
        "Detaliile rezultă din informațiile privind protecția datelor ale Platformei.",
      ],
    },
    {
      heading: "§ 9 Reclamații și soluționarea litigiilor",
      paragraphs: [
        "Reclamațiile privind unitatea de cazare se adresează mai întâi Furnizorului; pentru întrebări privind rezervarea sau plata, echipa de asistență myNextDays este disponibilă prin canalele de contact indicate pe Platformă.",
        "myNextDays nu este obligată și nu este dispusă să participe la proceduri de soluționare a litigiilor în fața unei entități de soluționare alternativă a litigiilor în materie de consum, în măsura în care nu există o obligație legală în acest sens.",
      ],
    },
    {
      heading: "§ 10 Modificarea prezentelor condiții",
      paragraphs: [
        "myNextDays poate modifica prezentele condiții cu efect pentru viitor, în măsura în care acest lucru este necesar din motive întemeiate (în special modificări legislative sau ale jurisprudenței), iar Oaspetele nu este dezavantajat în mod nerezonabil prin aceasta. Pentru rezervările deja încheiate se aplică versiunea în vigoare la momentul rezervării.",
      ],
    },
    {
      heading: "§ 11 Dispoziții finale",
      paragraphs: [
        "Se aplică dreptul statului în care operatorul își are sediul, cu excluderea Convenției ONU asupra contractelor de vânzare internațională de mărfuri. Dacă Oaspetele este consumator, dispozițiile imperative de protecție a consumatorilor din statul în care acesta își are reședința obișnuită rămân neatinse.",
        "În cazul în care anumite dispoziții ale prezentelor condiții sunt sau devin nule, validitatea celorlalte dispoziții rămâne neatinsă.",
      ],
    },
  ],
};
