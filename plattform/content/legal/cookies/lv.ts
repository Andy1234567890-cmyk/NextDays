import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Sīkdatņu politika",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šī politika skaidro, kādas sīkdatnes un līdzīgas tehnoloģijas izmanto myBestDays, kādam nolūkam, cik ilgi tās tiek glabātas un kā Jūs tās pārvaldāt.",
    "Tā papildina [Privātuma politiku](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Kas ir sīkdatnes",
      paragraphs: [
        "Sīkdatnes ir mazi teksta faili, ko tīmekļa vietne saglabā Jūsu pārlūkprogrammā. Līdzīgas tehnoloģijas ir pārlūkprogrammas lokālā krātuve un izsekošanas pikseļi e-pasta vēstulēs.",
        "Sīkdatnes, kas ir absolūti nepieciešamas Platformas darbībai, drīkstam iestatīt bez Jūsu piekrišanas. Par visām pārējām lūdzam Jūsu piekrišanu (Direktīvas 2002/58/EK 5. panta 3. punkts).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nepieciešamās sīkdatnes",
      paragraphs: [
        "Šīs sīkdatnes ir nepieciešamas darbībai, un tās nevar atteikt. Pašlaik izmantojam:",
      ],
      list: [
        "„nd_access“ – uztur Jūsu pieteikšanos. Nolasāma tikai serverim (HttpOnly), darbības ilgums atbilst sesijas derīgumam.",
        "„nd_refresh“ – atjauno Jūsu pieteikšanos, lai nebūtu nemitīgi jāpiesakās no jauna. Nolasāma tikai serverim, darbības ilgums 30 dienas.",
        "„nd_gast_locale“ – atceras Jūsu izvēlēto valodu. Darbības ilgums viens gads.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkcionālās, statistikas un mārketinga sīkdatnes",
      paragraphs: [
        "myBestDays pašlaik neizmanto sīkdatnes statistikai, sasniedzamības mērīšanai vai reklāmai un neiegulst reklāmas tīklus vai analīzes pakalpojumus.",
        "Ja tas mainītos, iepriekš lūgsim Jūsu piekrišanu izvēles dialogā, kurā atteikšanās ir tikpat vienkārša kā piekrišana, un papildināsim šo politiku ar konkrētajām sīkdatnēm.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Iegultais trešo pušu saturs",
      paragraphs: [
        "Detaļu lapās var būt iegultas kartes. Šādu saturu ielādējam tikai tad, kad Jūs to skaidri aktivizējat; tikai tad dati var tikt nodoti attiecīgajam sniedzējam.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Kā pārvaldāt sīkdatnes",
      paragraphs: [
        "Savu piekrišanu varat jebkurā brīdī mainīt vai atsaukt, izmantojot sīkdatņu iestatījumus kājenē.",
        "Turklāt sīkdatnes varat dzēst vai bloķēt savā pārlūkprogrammā. Dzēšot nepieciešamās sīkdatnes, tiksiet atteikts, un Platforma darbosies ierobežoti.",
      ],
    },
  ],
};
