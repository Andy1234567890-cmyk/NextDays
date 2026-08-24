// Rumänische Fassung der Vereinbarung zur Auftragsverarbeitung (Art. 28 DSGVO).
// Referenz ist ./de.ts — inhaltliche Änderungen gehören ZUERST dorthin und
// werden von dort in alle Sprachfassungen übernommen. Struktur (Abschnitte,
// Unterpunkte, Listen) muss mit ./de.ts deckungsgleich bleiben.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Acord privind prelucrarea datelor cu caracter personal",
  metaDescription:
    "Prelucrarea datelor în numele operatorului conform articolului 28 din RGPD, între myNextDays ApS și unitățile care utilizează platforma: obiect, instrucțiuni, securitate, subîmputerniciți.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Prezentul acord (denumit în continuare „APD”) se aplică între unitatea care utilizează platforma myNextDays (denumită în continuare „operatorul”) și ${ANBIETER.firma} (denumită în continuare „persoana împuternicită de operator” sau „noi”) și detaliază obligațiile prevăzute la articolul 28 din Regulamentul (UE) 2016/679 (RGPD).`,
    `Acesta este încorporat prin [Condițiile generale de afaceri](${AGB_URL}) și se aplică pe toată durata utilizării platformei. El prevalează asupra CGA în ceea ce privește prelucrarea datelor cu caracter personal în numele operatorului.`,
    "În completare, [Politica de confidențialitate](/datenschutz) se aplică datelor pe care le prelucrăm în calitate de operator propriu — în special datelor contului și ale relației comerciale.",
  ],
  sections: [
    {
      heading: "Obiectul și repartizarea rolurilor",
      unterpunkte: [
        {
          paragraphs: [
            "Obiectul îl constituie prelucrarea datelor cu caracter personal pe care operatorul le introduce în platformă sau le colectează prin intermediul acesteia, pentru ca noi să putem presta serviciile convenite contractual: administrarea proprietăților, a rezervărilor și a ocupării, comunicarea cu oaspeții, procesarea plăților, contabilitatea și decontarea pentru proprietari, conectarea la portalurile de rezervări, generatorul de site-uri web, precum și administrarea sarcinilor și a echipei.",
          ],
        },
        {
          paragraphs: [
            "Operatorul decide cu privire la scopurile și mijloacele acestei prelucrări. Prelucrăm datele exclusiv la instrucțiunea sa documentată și nu în scopuri proprii.",
          ],
        },
        {
          paragraphs: [
            "Pentru datele contului, pentru facturarea propriilor noastre servicii, pentru securitatea sistemului și pentru păstrarea impusă de lege suntem noi înșine operator. Această prelucrare nu face obiectul prezentului APD.",
          ],
        },
      ],
    },
    {
      heading: "Natura, întinderea și scopul prelucrării",
      paragraphs: [
        "Prelucrarea se realizează prin colectare, stocare, afișare, modificare, transmitere către destinatarii aleși de operator (de ex. portaluri de rezervări, prestatori de servicii de plată), restricționare și ștergere — în formă automatizată, în cadrul platformei.",
        "Locul prelucrării este Uniunea Europeană; excepțiile sunt enumerate limitativ în secțiunea 8.",
      ],
    },
    {
      heading: "Categoriile de persoane vizate",
      list: [
        "Oaspeți și persoane care efectuează rezervări, inclusiv însoțitorii",
        "Persoane interesate care transmit solicitări sau mesaje",
        "Proprietarii imobilelor administrate",
        "Angajații operatorului (echipă, curățenie, service, recepție)",
        "Persoanele de contact ale partenerilor și prestatorilor operatorului",
      ],
    },
    {
      heading: "Categoriile de date cu caracter personal",
      list: [
        "Date de identificare: nume, adresă, data nașterii dacă este colectată, naționalitatea dacă este colectată în scopul obligației de raportare",
        "Date de contact: adresă de e-mail, număr de telefon",
        "Date privind rezervarea: perioadă, proprietate, numărul de călători, prețuri, servicii suplimentare, anulări",
        "Date de plată: sumă, monedă, modalitate de plată, starea plății, referințe (datele complete ale cardului nu ajung în sistemele noastre)",
        "Date de comunicare: mesaje, note, recenzii",
        "Datele de acces și de utilizare ale angajaților: rol, permisiuni, momentul autentificării, dispozitivul și adresa IP ale autentificării",
        "Categoriile speciale prevăzute la articolul 9 din RGPD nu fac obiectul contractului; operatorul nu introduce astfel de date în câmpurile de text liber.",
      ],
    },
    {
      heading: "Instrucțiuni",
      unterpunkte: [
        {
          paragraphs: [
            "Operatorul dă instrucțiuni prin utilizarea și configurarea platformei, precum și în formă text, la adresa noastră de contact. Instrucțiunile verbale le confirmăm în formă text.",
          ],
        },
        {
          paragraphs: [
            "Dacă considerăm că o instrucțiune este nelegală, comunicăm acest lucru fără întârziere și putem suspenda punerea în aplicare până când operatorul o confirmă sau o modifică.",
          ],
        },
        {
          paragraphs: [
            "Dacă avem obligația legală de a prelucra datele (de exemplu față de autorități), îl informăm în prealabil pe operator, în măsura în care legea ne permite acest lucru.",
          ],
        },
        {
          titel: "Conectarea propriilor servicii ale operatorului",
          paragraphs: [
            "Operatorul își poate conecta contul, prin intermediul unei interfețe, la un serviciu pe care l-a ales el însuși și cu care a încheiat un contract propriu — de exemplu un asistent AI. Dacă acordă o astfel de conexiune, aceasta constituie instrucțiunea sa expresă în sensul articolului 28 alineatul (3) litera a) din RGPD de a transmite datele partajate către acel serviciu. Ea include în mod expres și o transmitere aferentă către o țară terță, dacă serviciul are sediul în afara Uniunii Europene.",
            "În esență: asupra unei astfel de conexiuni decide exclusiv operatorul, iar pentru serviciul conectat răspunde el însuși.",
            "O poate acorda numai un cont care are permisiunea de a administra conexiuni externe. Această permisiune este rezervată rolului „Administrator”; conturile cu drepturi limitate — inclusiv rolul „Co-administrator” — nu pot acorda o conexiune. Consemnăm cine a acordat-o, când și pentru ce serviciu, ce categorii de date au fost partajate și ce accesări au avut loc; această consemnare este pusă la dispoziția operatorului în interfață, la „Cont → Conexiuni”, pentru ca el să își poată îndeplini obligația de responsabilitate și să răspundă cererilor de informare.",
            "Serviciul conectat nu este un subîmputernicit al nostru: nu îl mandatăm, nu îl selectăm și nu îi dăm instrucțiuni. El prelucrează datele în baza contractului pe care operatorul l-a încheiat el însuși cu acesta. Pentru această prelucrare, pentru temeiul său juridic și pentru garanțiile transmiterii către o țară terță răspunde, prin urmare, operatorul; ea nu face obiectul prezentului APD.",
            "Câmpurile de text liber — notele privind rezervarea și conținutul mesajelor oaspeților — sunt exceptate în mod implicit de la o astfel de conexiune. Ele pot conține categorii speciale de date cu caracter personal în sensul articolului 9 din RGPD, de exemplu date privind sănătatea. Operatorul trebuie să le partajeze separat la momentul acordării; fără această partajare, ele nu sunt transmise.",
            "Operatorul poate întrerupe oricând, în interfață, o conexiune acordată. Token-urile de reînnoire sunt astfel șterse, iar la fiecare accesare ulterioară se verifică dacă acordul mai există — un serviciu deconectat nu mai poate, prin urmare, citi nimic imediat, nu doar după expirarea token-ului său de acces.",
          ],
        },
      ],
    },
    {
      heading: "Confidențialitate",
      paragraphs: [
        "Toate persoanele care pot avea acces la date în executarea contractului sunt obligate la confidențialitate și sunt instruite periodic în materie de protecție a datelor. Accesul este limitat la ceea ce este necesar pentru sarcina respectivă.",
        "Accesările datelor clienților de către angajații noștri au loc numai pentru remedierea erorilor, la o solicitare de asistență sau pentru îndeplinirea obligațiilor legale.",
      ],
    },
    {
      heading: "Securitatea prelucrării",
      paragraphs: [
        "Luăm măsurile tehnice și organizatorice necesare potrivit articolului 32 din RGPD. Sunt puse în aplicare în special:",
      ],
      list: [
        "Criptarea transportului (TLS) pentru toate conexiunile, header-e de securitate HTTP, inclusiv o Content-Security-Policy strictă",
        "Separarea clienților direct în baza de date: reguli de acces la nivel de rând (Row Level Security) plus retragerea drepturilor pe tabele pentru datele sensibile, astfel încât un acces în afara unității proprii este exclus și pe calea directă a bazei de date",
        "Permisiuni bazate pe roluri, cu separarea datelor: personalul de service și de curățenie nu primește date financiare și comerciale, proprietarii doar propriile proprietăți; datele oaspeților sunt mascate pentru rolurile neautorizate",
        "Autentificare în doi factori (TOTP) disponibilă pentru conturi; reautentificare în cazul modificărilor critice pentru securitate",
        "Jurnal al autentificărilor, cu dispozitiv, moment și adresă IP, consultabil de către operator",
        "Conexiunile către servicii externe pot fi acordate numai de un cont cu rolul „Administrator”; fiecare accesare prin intermediul unei astfel de conexiuni este consemnată (instrument, moment, întindere — fără conținuturile propriu-zise) și poate fi consultată de operator. O conexiune întreruptă pierde imediat accesul: la fiecare accesare se verifică dacă acordul mai există",
        "Limitarea frecvenței cererilor împotriva atacurilor automatizate, verificarea semnăturilor apelurilor Webhook primite",
        "Copii de siguranță criptate, păstrate în afara sistemului de producție, cu test periodic de restaurare",
        "Medii separate pentru dezvoltare și exploatare; modificările bazei de date exclusiv prin migrări versionate",
      ],
    },
    {
      heading: "Subîmputerniciți",
      paragraphs: [
        "Operatorul autorizează recurgerea la următorii subîmputerniciți. Cu fiecare dintre ei există contracte în temeiul articolului 28 alineatul (4) din RGPD, cu obligații care corespund prezentului APD.",
      ],
      list: [
        "Hetzner Online GmbH, Germania (server, bază de date, media, server de e-mail; centru de date Helsinki, Finlanda)",
        "Stripe Payments Europe, Limited, Irlanda (plăți, virări către beneficiari, verificarea identității impusă de lege)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg (plăți, în măsura în care operatorul le activează)",
        "Channex.io Ltd, Regatul Unit (conectarea la portalurile de rezervări, în măsura în care este activată)",
        "Meta Platforms Ireland Limited, Irlanda (mesaje WhatsApp, în măsura în care sunt activate)",
        "Google Ireland Limited, Irlanda (traducerea conținuturilor; autentificare cu Google, în măsura în care este utilizată)",
        "Groq, Inc., SUA (sugestii de răspuns în mesageria de intrare, în măsura în care sunt activate)",
        "Cloudflare, Inc., SUA (administrarea înregistrărilor DNS pentru domenii proprii, în măsura în care este utilizată)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "O schimbare sau o completare o comunicăm cu cel puțin 30 de zile înainte. Operatorul se poate opune în acest termen pentru un motiv important, legat de protecția datelor; dacă opoziția nu este înlăturată, el poate rezilia partea de serviciu afectată sau contractul.",
          ],
        },
        {
          paragraphs: [
            "Serviciile pe care operatorul le convine el însuși cu un terț nu constituie o subîmputernicire, ci o transmitere dispusă de el. Acest lucru este valabil pentru un portal de rezervări cu care are un contract propriu, la fel ca pentru un asistent AI sau pentru un alt program pe care îl conectează la contul său prin intermediul interfeței (a se vedea secțiunea „Instrucțiuni”).",
            "Determinant nu este prin sistemele cui circulă datele, ci cine recurge la serviciu: o subîmputernicire apare atunci când NOI mandatăm un alt prestator pentru a presta serviciul nostru. Dacă operatorul alege el însuși serviciul și încheie contractul cu acesta, serviciul respectiv prelucrează pentru operator — nu pentru noi. Această delimitare corespunde practicii contractuale a furnizorilor comparabili în privința serviciilor terțe conectate de client.",
          ],
        },
      ],
    },
    {
      heading: "Transmiterea către țări terțe",
      paragraphs: [
        "Transmiterile către destinatari din afara UE se limitează la serviciile menționate mai sus cu sediul în SUA, respectiv în Regatul Unit. Baza acestora sunt clauzele contractuale standard ale Comisiei Europene în temeiul articolului 46 alineatul (2) litera (c) din RGPD sau o decizie privind caracterul adecvat al nivelului de protecție aflată în vigoare; se aplică măsuri de protecție suplimentare (criptare, reducerea la minimum a datelor).",
      ],
    },
    {
      heading: "Sprijinirea operatorului",
      unterpunkte: [
        {
          paragraphs: [
            "Îl sprijinim pe operator în soluționarea cererilor persoanelor vizate (articolele 15–22 din RGPD). Platforma oferă în acest scop informare, rectificare, export și ștergere a datelor direct în interfață. Dacă persoanele vizate se adresează direct nouă, le îndrumăm către operator și îl informăm.",
          ],
        },
        {
          paragraphs: [
            "Sprijinim de asemenea la evaluările impactului asupra protecției datelor, la respectarea obligațiilor prevăzute la articolele 32–36 din RGPD și la solicitările autorităților de supraveghere.",
          ],
        },
      ],
    },
    {
      heading: "Încălcări ale securității datelor cu caracter personal",
      paragraphs: [
        "Dacă luăm cunoștință de o încălcare a securității datelor cu caracter personal care afectează datele operatorului, îl informăm fără întârziere, cel mai târziu în termen de 48 de ore de la luarea la cunoștință, în formă text.",
        "Comunicarea cuprinde, în măsura în care sunt cunoscute, natura și momentul incidentului, categoriile de date și grupurile de persoane afectate, consecințele probabile, precum și măsurile luate și cele propuse. Îl sprijinim pe operator în îndeplinirea obligațiilor sale de notificare și de informare prevăzute la articolele 33 și 34 din RGPD.",
      ],
    },
    {
      heading: "Dovezi și controale",
      unterpunkte: [
        {
          paragraphs: [
            "La cerere, dovedim respectarea prezentului APD, în special prin informații privind măsurile luate și privind subîmputerniciții la care s-a recurs.",
          ],
        },
        {
          paragraphs: [
            "Operatorul poate efectua controale în măsura necesară sau le poate încredința unui auditor independent, care nu se află în concurență cu noi. Controalele se desfășoară după anunțare, cu un termen rezonabil, în timpul orelor obișnuite de lucru și fără perturbarea activității. Costul unei verificări care depășește simpla informare este suportat de operator, cu excepția cazului în care verificarea este determinată de un incident cauzat de noi.",
          ],
        },
      ],
    },
    {
      heading: "Ștergerea și restituirea",
      paragraphs: [
        "După încetarea contractului, punem la dispoziție datele operatorului pentru export, la cererea acestuia, în termen de 30 de zile, într-un format uzual, care poate fi citit automat. Ulterior ștergem datele, inclusiv copiile.",
        "Sunt exceptate datele pentru care există o obligație legală de păstrare (în special datele de facturare și cele contabile); acestea sunt blocate și șterse după expirarea termenului. Copiile de siguranță sunt suprascrise în cadrul ciclului obișnuit de rotație.",
      ],
    },
    {
      heading: "Răspunderea și ordinea de prioritate",
      paragraphs: [
        "Se aplică articolul 82 din RGPD. În raportul dintre părți se aplică suplimentar regulile de răspundere din CGA, în măsura în care nu contravin RGPD.",
        "Dacă CGA și prezentul APD se contrazic în privința prelucrării în numele operatorului, se aplică prezentul APD. Dacă o dispoziție devine nulă, restul conținutului rămâne valabil; părțile o înlocuiesc cu o reglementare admisibilă având același scop.",
      ],
    },
    {
      heading: "Modificări ale prezentului acord",
      paragraphs: [
        "Putem adapta prezentul APD în măsura în care acest lucru devine necesar ca urmare a modificărilor legislative, a cerințelor autorităților de supraveghere, a cerințelor prestatorilor de servicii de plată sau a evoluțiilor tehnice, iar operatorul nu este dezavantajat prin aceasta.",
        "Modificările le anunțăm în formă text cu cel puțin 30 de zile înainte de intrarea în vigoare. Dacă operatorul nu se opune în acest termen, ele se consideră acceptate; asupra acestei consecințe se atrage atenția în anunț. În caz de opoziție, fiecare parte poate rezilia contractul la data intrării în vigoare.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Solicitările privind prezentul acord, instrucțiunile și notificările se transmit la [${ANBIETER.email}](mailto:${ANBIETER.email}) sau la ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
