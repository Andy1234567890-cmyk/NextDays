import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Echipă și permisiuni",
  description: "Angajați, roluri și drepturi de acces.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Acces",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Invitarea angajaților",
          excerpt: "Cum invitați angajați noi în contul dvs. myNextDays.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Puteți invita oricâți angajați doriți la compania dvs. — de exemplu pentru recepție, curățenie sau administrare. Fiecare invitație este legată de o adresă de e-mail și atribuie imediat un rol fix, care determină accesul pe web și în aplicația myNextDays.",
            },
            { type: "h2", text: "Trimiterea invitației" },
            {
              type: "steps",
              items: [
                "Deschideți „Cont” și treceți la secțiunea „Echipă”.",
                "Apăsați pe „Invitare angajat”.",
                "Introduceți adresa de e-mail a persoanei.",
                "Alegeți rolul potrivit, de ex. angajat sau curățenie.",
                "Confirmați invitația.",
              ],
            },
            { type: "h2", text: "Ce se întâmplă apoi" },
            {
              type: "p",
              text: "Persoana invitată primește un e-mail cu un link, pentru a-și stabili o parolă proprie și a se autentifica. Login-ul se aplică deopotrivă pentru dashboard-ul web și pentru aplicația myNextDays — nu există un cont separat per interfață.",
            },
            {
              type: "ul",
              items: [
                "O invitație rămâne valabilă până când este acceptată sau retrasă.",
                "Invitațiile deschise le vedeți în secțiunea „Echipă”, cu statusul „În așteptare”.",
                "Rolul poate fi ajustat oricând, ulterior.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ce rol poate vedea ce secțiuni, aflați la [Roluri și permisiuni](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Atribuiți de la început rolul cel mai restrâns potrivit — drepturile pot fi extinse oricând, ulterior.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Roluri și permisiuni",
          excerpt: "Cele cinci roluri din myNextDays și ce pot face fiecare.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "myNextDays face distincție între cinci roluri: Admin, Co-Admin, Angajat, Curățenie și Proprietar. Fiecare rol stabilește ce secțiuni sunt vizibile în dashboard-ul web și în aplicația myNextDays — drepturile fiind impuse la nivel de server, nu doar ascunse în interfață.",
            },
            { type: "h2", text: "Prezentarea rolurilor" },
            {
              type: "ul",
              items: [
                "Admin: acces complet la toate secțiunile, inclusiv finanțe, vânzări și administrarea echipei.",
                "Co-Admin: acces aproape complet, ca la Admin, pentru al doilea nivel de conducere al companiei.",
                "Angajat: acces operațional la rezervări, calendar și sarcini, fără vizibilitate financiară sau de vânzări.",
                "Curățenie: acces exclusiv la sarcinile de curățenie atribuite și detaliile obiectelor, fără vizibilitate financiară sau de vânzări.",
                "Proprietar: vizualizare protejată la scriere asupra propriilor obiecte, fără administrarea obiectelor altora.",
              ],
            },
            { type: "h2", text: "Atribuirea sau modificarea rolului" },
            {
              type: "steps",
              items: [
                "Deschideți „Cont” → „Echipă”.",
                "Alegeți angajatul respectiv din listă.",
                "Apăsați pe „Modificare rol”.",
                "Alegeți noul rol și confirmați.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Angajații și persoanele de curățenie nu văd, în principiu, prețuri, venituri sau canale de rezervare — această excludere se aplică la nivel de server și nu poate fi ocolită prin interfață.",
            },
            {
              type: "note",
              variant: "info",
              text: "O prezentare per rol găsiți la [Ce vede fiecare rol](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Ce vede fiecare rol",
          excerpt: "Secțiuni și vizualizări concrete per rol, pe web și în aplicație.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Pe lângă drepturile de bază din [Roluri și permisiuni](/hilfe/team-rollen/rollen-berechtigungen), o privire concretă asupra unor secțiuni individuale vă ajută să stabiliți așteptările corecte la integrarea angajaților noi.",
            },
            { type: "h2", text: "Calendar și rezervări" },
            {
              type: "p",
              text: "Admin, Co-Admin și Angajat văd planul complet de ocupare, cu datele oaspeților și sarcinile. Curățenie vede doar termenele care i-au fost atribuite, împreună cu adresa obiectului și lista de verificare, dar fără numele oaspeților sau prețuri. Proprietarii văd calendarul de ocupare exclusiv pentru propriile obiecte, în mod strict de citire.",
            },
            { type: "h2", text: "Finanțe și vânzări" },
            {
              type: "ul",
              items: [
                "Venituri, comisioane și facturi: doar Admin și Co-Admin.",
                "Portaluri (conectare OTA) și vizibilitate pe piață: doar Admin și Co-Admin.",
                "Angajat și Curățenie: fără acces la secțiunile financiare sau de vânzări, nici măcar la paginile de detaliu.",
              ],
            },
            { type: "h2", text: "Echipă și setări" },
            {
              type: "p",
              text: "Administrarea angajaților, a rolurilor și a setărilor de cont rămâne rezervată pentru Admin și Co-Admin. Proprietarii și rolurile operaționale nu văd deloc această secțiune, nici în aplicația myNextDays, nici în dashboard-ul web.",
            },
            {
              type: "note",
              variant: "info",
              text: "Această împărțire se aplică identic în dashboard-ul web și în aplicația myNextDays, întrucât ambele interfețe interoghează același rol din contul dvs.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Testați rolurile noi împreună cu angajatul, imediat după invitație, pentru a evita neînțelegeri privind secțiunile vizibile.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Revocarea accesului",
          excerpt: "Eliminați imediat și complet accesul unui angajat.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Dacă un angajat părăsește compania dvs. sau se schimbă colaborarea, eliminați accesul direct din Cont. Revocarea acționează la nivel de server și imediat — nu abia după expirarea unei sesiuni existente.",
            },
            { type: "h2", text: "Eliminarea accesului" },
            {
              type: "steps",
              items: [
                "Deschideți „Cont” → „Echipă”.",
                "Alegeți angajatul respectiv.",
                "Apăsați pe „Revocare acces”.",
                "Confirmați procesul.",
              ],
            },
            { type: "h2", text: "Efect asupra sesiunilor în curs" },
            {
              type: "p",
              text: "După revocare, persoana nu se mai poate autentifica nici în dashboard-ul web, nici în aplicația myNextDays. Sarcinile sau termenele de curățenie deja atribuite ar trebui reatribuite în prealabil unui alt angajat, pentru ca nimic să nu rămână neprocesat.",
            },
            {
              type: "ul",
              items: [
                "Reatribuiți sarcinile deschise înainte de revocare.",
                "Accesul poate fi restabilit ulterior, printr-o nouă invitație.",
                "Revocarea afectează doar această companie, nu și alte conturi ale persoanei.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Revocați accesul prompt, de îndată ce colaborarea încetează — conturile de angajați deschise rămân altfel un risc de securitate inutil.",
            },
          ],
        },
      ],
    },
  ],
};
