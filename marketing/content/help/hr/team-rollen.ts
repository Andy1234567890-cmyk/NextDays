import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Tim i ovlasti",
  description: "Zaposlenici, uloge i prava pristupa.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Pristup",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Pozivanje zaposlenika",
          excerpt: "Kako pozvati nove zaposlenike na svoj myNextDays račun.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Na svoje poslovanje možete pozvati proizvoljan broj zaposlenika — primjerice za recepciju, čišćenje ili upravu. Svaki je poziv vezan uz e-adresu i odmah dodjeljuje fiksnu ulogu koja određuje pristup na webu i u myNextDays aplikaciji.",
            },
            { type: "h2", text: "Slanje poziva" },
            {
              type: "steps",
              items: [
                "Otvorite „Račun” i prijeđite u područje „Tim”.",
                "Kliknite „Pozovi zaposlenika”.",
                "Unesite e-adresu osobe.",
                "Odaberite odgovarajuću ulogu, npr. zaposlenik ili čišćenje.",
                "Potvrdite poziv.",
              ],
            },
            { type: "h2", text: "Što se događa nakon toga" },
            {
              type: "p",
              text: "Pozvana osoba dobiva e-poruku s poveznicom za postavljanje vlastite lozinke i prijavu. Prijava vrijedi jednako za web nadzornu ploču i myNextDays aplikaciju — ne postoji zaseban račun po sučelju.",
            },
            {
              type: "ul",
              items: [
                "Poziv je valjan sve dok se ne prihvati ili povuče.",
                "Otvorene pozive vidite u području „Tim” sa statusom „Na čekanju”.",
                "Uloga se u svakom trenutku može naknadno prilagoditi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Koja uloga koje područje smije vidjeti, saznajte pod [Uloge i ovlasti](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Od samog početka dodijelite najužu odgovarajuću ulogu — prava se kasnije u svakom trenutku mogu proširiti.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Uloge i ovlasti",
          excerpt: "Pet uloga u myNextDays i što svaka od njih smije.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays razlikuje pet uloga: administrator, ko-administrator, zaposlenik, čišćenje i vlasnik. Svaka uloga određuje koja su područja vidljiva na web nadzornoj ploči i u myNextDays aplikaciji — prava se pritom provode na strani poslužitelja, ne samo skrivaju u sučelju.",
            },
            { type: "h2", text: "Pregled uloga" },
            {
              type: "ul",
              items: [
                "Administrator: potpun pristup svim područjima, uključujući financije, prodaju i upravljanje timom.",
                "Ko-administrator: gotovo potpun pristup kao administrator, za drugu razinu vodstva poslovanja.",
                "Zaposlenik: operativan pristup rezervacijama, kalendaru i zadacima, bez uvida u financije ili prodaju.",
                "Čišćenje: isključivo pristup dodijeljenim zadacima čišćenja i detaljima objekata, bez uvida u financije ili prodaju.",
                "Vlasnik: uvid samo za čitanje u vlastite objekte, bez upravljanja tuđim objektima.",
              ],
            },
            { type: "h2", text: "Dodjela ili promjena uloge" },
            {
              type: "steps",
              items: [
                "Otvorite „Račun” → „Tim”.",
                "Odaberite dotičnog zaposlenika s popisa.",
                "Kliknite „Promijeni ulogu”.",
                "Odaberite novu ulogu i potvrdite.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zaposlenik i čišćenje u pravilu ne vide cijene, prihode ni prodajne kanale — to ograničenje vrijedi na strani poslužitelja i ne može se zaobići preko sučelja.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pregled po ulogama pronaći ćete pod [Što koja uloga vidi](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Što koja uloga vidi",
          excerpt: "Konkretna područja i prikazi po ulozi na webu i u aplikaciji.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Uz osnovna prava iz [Uloge i ovlasti](/hilfe/team-rollen/rollen-berechtigungen), konkretan pregled pojedinih područja pomaže vam da kod uvođenja novih zaposlenika postavite ispravna očekivanja.",
            },
            { type: "h2", text: "Kalendar i rezervacije" },
            {
              type: "p",
              text: "Administrator, ko-administrator i zaposlenik vide potpun raspored zauzetosti s podacima o gostima i zadacima. Čišćenje vidi samo njima dodijeljene termine s adresom objekta i kontrolnim popisom, ali bez imena gostiju ili cijena. Vlasnici vide kalendar popunjenosti isključivo za svoje vlastite objekte, samo za čitanje.",
            },
            { type: "h2", text: "Financije i prodaja" },
            {
              type: "ul",
              items: [
                "Prihodi, provizije i fakture: samo administrator i ko-administrator.",
                "Portali (OTA povezivanje) i vidljivost platforme: samo administrator i ko-administrator.",
                "Zaposlenik i čišćenje: bez pristupa financijskim ili prodajnim područjima, ni detaljnim stranicama.",
              ],
            },
            { type: "h2", text: "Tim i postavke" },
            {
              type: "p",
              text: "Upravljanje zaposlenicima, ulogama i postavkama računa ostaje pridržano administratoru i ko-administratoru. Vlasnici i operativne uloge to područje uopće ne vide ni u myNextDays aplikaciji ni na web nadzornoj ploči.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ova podjela vrijedi jednako na web nadzornoj ploči i u myNextDays aplikaciji, jer oba sučelja dohvaćaju istu ulogu iz vašeg računa.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nakon poziva kratko zajedno sa zaposlenikom isprobajte nove uloge kako biste izbjegli nesporazume oko vidljivih područja.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Oduzimanje pristupa",
          excerpt: "Odmah i potpuno uklonite pristup zaposlenika.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Ako zaposlenik napusti vaše poslovanje ili se promijeni suradnja, pristup uklanjate izravno u Računu. Oduzimanje djeluje na strani poslužitelja i odmah — ne tek nakon isteka postojeće sesije.",
            },
            { type: "h2", text: "Uklanjanje pristupa" },
            {
              type: "steps",
              items: [
                "Otvorite „Račun” → „Tim”.",
                "Odaberite dotičnog zaposlenika.",
                "Kliknite „Oduzmi pristup”.",
                "Potvrdite postupak.",
              ],
            },
            { type: "h2", text: "Utjecaj na tekuće sesije" },
            {
              type: "p",
              text: "Nakon oduzimanja osoba se više ne može ponovno prijaviti ni na web nadzornoj ploči ni u myNextDays aplikaciji. Već dodijeljene zadatke ili termine čišćenja unaprijed dodijelite drugom zaposleniku, kako ništa ne bi ostalo neobrađeno.",
            },
            {
              type: "ul",
              items: [
                "Prije oduzimanja ponovno dodijelite otvorene zadatke.",
                "Pristup se kasnije može ponovno uspostaviti putem poziva.",
                "Oduzimanje se odnosi samo na ovo poslovanje, ne na druge račune te osobe.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Oduzmite pristup pravodobno čim suradnja završi — otvoreni računi zaposlenika inače ostaju nepotreban sigurnosni rizik.",
            },
          ],
        },
      ],
    },
  ],
};
