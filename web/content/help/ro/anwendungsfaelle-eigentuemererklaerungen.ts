import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Decontări către proprietari",
  description: "Creați decontări către proprietari.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Decontări către proprietari",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Generarea unui statement pentru proprietar",
          excerpt: "Cum creați pentru un proprietar o decontare clară pentru perioada acestuia.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Dacă administrați obiecte pentru proprietari, aceștia au nevoie regulat de o privire de ansamblu trasabilă asupra veniturilor, comisionului dedus și plății obiectelor lor, pentru o anumită perioadă — statement-ul pentru proprietar adună automat aceste date.",
            },
            {
              type: "steps",
              items: [
                "Deschideți în Cont secțiunea Proprietari și alegeți proprietarul afectat.",
                "Alegeți perioada de decontare pentru care trebuie creat statement-ul.",
                "Verificați dacă toate obiectele acestui proprietar sunt asociate corect, întrucât doar obiectele asociate intră în statement.",
                "Lăsați statement-ul să fie generat și verificați rezervările listate, pentru a vă asigura că sunt complete.",
                "Puneți statement-ul la dispoziția proprietarului prin accesul de proprietar sau exportați-l ca document.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statement-ul arată fiecare rezervare cu suma în moneda obiectului respectiv — nu există o indicație generală de monedă, întrucât mai multe obiecte pot avea și monede diferite. Mai multe despre asociere la [Asocierea unui obiect cu un proprietar](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Decontarea comisionului cu proprietarul",
          excerpt: "Cum vă asigurați că comisionul dvs. este calculat corect din veniturile proprietarului.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Comisionul dvs. pentru administrarea unui obiect este înregistrat în tariful proprietarului și este scăzut automat din veniturile brute la fiecare statement. Pentru ca decontarea să fie corectă, procentul comisionului trebuie stabilit corect înainte de prima rezervare din perioadă.",
            },
            {
              type: "steps",
              items: [
                "Deschideți în Cont tariful proprietarului afectat și verificați procentul de comision înregistrat.",
                "Ajustați procentul, dacă este necesar, înainte de a intra rezervări noi în perioada de decontare următoare.",
                "Generați statement-ul pentru proprietar pentru perioada respectivă și verificați dacă comisionul este afișat corect per rezervare.",
                "Verificați plauzibilitatea sumei din veniturile brute, comisionul dedus și plata netă.",
                "Clarificați abaterile direct cu proprietarul, înainte de aprobarea statement-ului, în loc să modificați statement-ul ulterior.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O modificare ulterioară a procentului de comision acționează doar asupra perioadelor viitoare, nu retroactiv asupra statement-urilor deja generate. Verificați, prin urmare, procentul la timp, înainte de începutul unei noi perioade de decontare — vezi și [Decontarea proprietarului (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
