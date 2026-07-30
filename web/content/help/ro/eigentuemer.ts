import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Proprietari și decontări",
  description: "Conturi de proprietar, decontări și comisioane.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Proprietari",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Adăugarea unui proprietar",
          excerpt: "Cum adăugați un cont nou de proprietar în myNextDays.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Proprietarii sunt conturi proprii în myNextDays, prin care gestionați obiecte care aparțin unei anumite persoane sau societăți. Un cont de proprietar primește o vizualizare limitată, read-only, asupra propriilor obiecte, fără a putea face el însuși modificări asupra companiei.",
            },
            { type: "h2", text: "Adăugarea unui cont nou de proprietar" },
            {
              type: "steps",
              items: [
                "Deschideți secțiunea „Proprietari” din meniul principal.",
                "Apăsați pe „Adăugare proprietar nou”.",
                "Introduceți numele, adresa de e-mail și datele de contact.",
                "Completați, dacă este necesar, adresa de facturare pentru decontări.",
                "Salvați contul.",
              ],
            },
            { type: "h2", text: "Configurarea accesului" },
            {
              type: "p",
              text: "După adăugare, puteți trimite proprietarului o invitație pentru propriul acces. Proprietarul se autentifică apoi cu datele sale proprii de acces și vede exclusiv obiectele care i-au fost atribuite.",
            },
            {
              type: "ul",
              items: [
                "Un cont de proprietar poate cuprinde mai multe obiecte.",
                "Fiecare obiect aparține exact unui singur proprietar.",
                "Datele de contact și adresa de facturare pot fi ajustate oricând, ulterior.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cum atribuiți un obiect existent unui proprietar, citiți la [Asocierea unui obiect cu un proprietar](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Asocierea unui obiect cu un proprietar",
          excerpt: "Fiecare obiect aparține exact unui singur proprietar — așa configurați asocierea.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "În myNextDays, fiecare obiect aparține exact unui singur proprietar. Nu este prevăzută o atribuire multiplă — dacă un obiect trebuie să aparțină unui alt proprietar, eliminați mai întâi asocierea existentă, înainte de a stabili una nouă.",
            },
            { type: "h2", text: "Realizarea asocierii" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în secțiunea „Obiecte”.",
                "Treceți la fila „Proprietar”.",
                "Alegeți proprietarul responsabil din listă.",
                "Confirmați asocierea.",
                "Salvați modificarea la obiect.",
              ],
            },
            { type: "h2", text: "Schimbarea proprietarului" },
            {
              type: "p",
              text: "Dacă se schimbă proprietarul unui obiect, de exemplu în urma unei vânzări, înlocuiți asocierea existentă cu cea nouă. Decontările deja create pentru perioadele trecute rămân atribuite proprietarului inițial.",
            },
            {
              type: "ul",
              items: [
                "Un obiect poate fi asociat, în orice moment, doar cu un singur proprietar.",
                "Fără asociere, obiectul nu apare în niciun acces de proprietar.",
                "Decontările trecute rămân la proprietarul inițial.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O atribuire multiplă a unui obiect către mai mulți proprietari este exclusă — sistemul nu permite o a doua asociere simultană.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Decontarea proprietarului (Statement)",
          excerpt: "Cum creați un statement cu venituri, minus comisionul, pentru un proprietar.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Decontarea proprietarului, numită și statement, adună pentru o perioadă selectată toate veniturile obiectelor asociate și scade comisionul dvs. convenit. Rezultatul este suma pe care o plătiți proprietarului.",
            },
            { type: "h2", text: "Crearea unui statement" },
            {
              type: "steps",
              items: [
                "Deschideți secțiunea „Proprietari” și alegeți proprietarul dorit.",
                "Treceți la fila „Decontare”.",
                "Alegeți perioada de decontare.",
                "Verificați rezervările și veniturile listate per obiect.",
                "Lăsați statementul să fie creat cu comisionul dedus.",
              ],
            },
            { type: "h2", text: "Structura statementului" },
            {
              type: "p",
              text: "Un statement listează, per obiect, veniturile brute din rezervări, comisionul dedus din acestea și suma de plată rezultată. Costurile suplimentare, precum curățenia sau taxele, pot fi evidențiate separat, în funcție de acord.",
            },
            {
              type: "ul",
              items: [
                "Venituri brute: suma tuturor rezervărilor din perioadă, per obiect.",
                "Comision: partea dvs. convenită, se scade din venituri.",
                "Sumă de plată: venituri minus comision și, eventual, alte poziții.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sumele din statement sunt exprimate întotdeauna în moneda obiectului — nu există o monedă generală de rezervă.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Creați statement-uri regulat, la aceeași dată de referință, pentru ca proprietarii să aibă un ritm fiabil pentru plățile lor.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Accesul proprietarului",
          excerpt: "Ce pot vedea proprietarii în accesul lor read-only.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Accesul proprietarului este un login propriu, read-only, pentru myNextDays. Proprietarii văd în acesta exclusiv obiectele care le sunt atribuite, precum și ocupările și decontările aferente — fără posibilitatea de a modifica ei înșiși setările.",
            },
            { type: "h2", text: "Ce văd proprietarii" },
            {
              type: "ul",
              items: [
                "Calendarul de ocupare al propriilor obiecte.",
                "Statement-urile create, cu venituri și comisionul dedus.",
                "Datele de bază ale obiectelor lor, de exemplu dotările și descrierea.",
              ],
            },
            { type: "h2", text: "Activarea accesului" },
            {
              type: "steps",
              items: [
                "Deschideți proprietarul în secțiunea „Proprietari”.",
                "Apăsați pe „Invitare acces”.",
                "Proprietarul primește un e-mail pentru configurarea propriei parole.",
                "După autentificare, proprietarul vede automat doar obiectele care îi sunt atribuite.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Accesul proprietarului este strict read-only: prețurile, disponibilitățile sau datele obiectului pot fi modificate doar de dvs., ca și companie, nu de proprietarul însuși.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mai multe despre asocierea obiectelor găsiți la [Asocierea unui obiect cu un proprietar](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
