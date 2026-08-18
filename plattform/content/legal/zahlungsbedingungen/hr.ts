import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Uvjeti plaćanja",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ovi uvjeti plaćanja uređuju kako se obrađuju plaćanja u vezi s rezervacijom putem myBestDays. Dopunjuju [Uvjete korištenja za goste](https://mybestdays.dk/rechtliches/nutzungsbedingungen); kod proturječja u pitanjima plaćanja prednost imaju ovi uvjeti plaćanja.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Naša uloga pri plaćanju",
      paragraphs: [
        "myBestDays obrađuje plaćanja u ime pružatelja. Nismo institucija za platni promet ni institucija za elektronički novac; samu platnu uslugu pruža naš pružatelj platnih usluga.",
        "Plaćanja putem Platforme obrađuje Stripe (Stripe Payments Europe, Limited). Podatke o karticama i ostale podatke o plaćanju prikuplja i obrađuje izravno Stripe. myBestDays ne pohranjuje potpune podatke o karticama.",
        "Ako platite putem Platforme, Vaša obveza plaćanja prema pružatelju u visini plaćenog iznosa smatra se ispunjenom čim je plaćanje kod našeg pružatelja platnih usluga uspješno autorizirano i naplaćeno.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Načini plaćanja",
      paragraphs: [
        "Koji su načini plaćanja dostupni ovisi o oglasu, o državi pružatelja i o Vašoj državi. Dostupni načini plaćanja prikazuju se prije završetka rezervacije.",
        "Za određene načine plaćanja potrebna je pouzdana autentifikacija klijenta prema Direktivi (EU) 2015/2366. Bez uspješne autentifikacije plaćanje se ne može izvršiti.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Dospijeće, predujam i doplata",
      paragraphs: [
        "Kada koji iznos dospijeva određuje pružatelj u oglasu. Uobičajena su tri modela: potpuno plaćanje pri rezervaciji, predujam pri rezervaciji s doplatom prije dolaska, ili plaćanje na licu mjesta kod pružatelja.",
        "Model koji vrijedi za Vašu rezervaciju i rokovi dospijeća prikazuju se prije završetka rezervacije i ponavljaju u potvrdi rezervacije.",
        "Prije dospijeća doplate podsjećamo Vas na navedenu adresu e-pošte. Ako doplata izostane, pružatelj može prema svojim uvjetima otkazivanja odustati od ugovora.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuta",
      paragraphs: [
        "Obračun se vrši u valuti oglasa. Ta je valuta navedena uz svaku cijenu i u postupku plaćanja.",
        "Ako Vam se iznos prikaže i u drugoj valuti, riječ je o neobvezujućem preračunu radi orijentacije, a ne o obvezujućoj cijeni.",
        "Ako Vaš pružatelj platnih usluga preračuna u drugu valutu ili naplati naknadu za inozemstvo, te troškove snosite Vi. Nisu dio ukupne cijene te ih ne određujemo niti naplaćujemo mi.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Polog",
      paragraphs: [
        "Ako oglas predviđa polog, njegov je iznos naveden prije završetka rezervacije.",
        "Ovisno o oglasu polog se na Vašem sredstvu plaćanja prethodno autorizira (iznos se rezervira, ali se ne tereti) ili se naplati. Prethodna autorizacija može privremeno smanjiti raspoloživi limit Vaše kartice.",
        "Nakon boravka prethodna se autorizacija oslobađa ili se naplaćeni polog vraća, ako pružatelj ne ističe štetu. Ako pružatelj ističe štetu, mora je dokazati; o osnovanosti odlučuje odnos između Vas i pružatelja.",
        "Ako pružatelj polog umjesto toga traži na licu mjesta, riječ je o stavci troškova na licu mjesta i ne obrađuje se putem Platforme.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Povrati",
      paragraphs: [
        "Povrati se izvršavaju na sredstvo plaćanja korišteno za plaćanje, osim ako je dogovoreno drukčije ili to tehnički nije moguće.",
        "Povrat pokrećemo bez odgode čim je njegov razlog utvrđen. Koliko traje dok odobrenje postane vidljivo na Vašem računu ili kartici određuje Vaš pružatelj platnih usluga; uobičajeno je pet do deset bankovnih radnih dana.",
        "Postoji li i u kojoj visini pravo na povrat ovisi o [Uvjetima otkazivanja](https://mybestdays.dk/rechtliches/stornierungsbedingungen) i [Politici prerezervacije i povrata](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Neuspjela plaćanja i storniranja",
      paragraphs: [
        "Ako plaćanje ne uspije, obavještavamo Vas i dajemo Vam priliku da unesete drugo sredstvo plaćanja. Ako plaćanje izostane, rezervacija se može otkazati.",
        "Ako stornirate već izvršeno plaćanje bez postojanja prava na povrat, pružatelj i dalje može potraživati iznos. Troškove koji nam nastanu neopravdanim storniranjem možemo Vam zaračunati.",
        "Ako plaćanje smatramo prijevarnim, možemo ga zadržati ili rezervaciju otkazati. O tome Vas obavještavamo i odluku obrazlažemo.",
      ],
    },
    {
      id: "belege",
      heading: "8. Dokazi i obračuni",
      paragraphs: [
        "Za iznose plaćene putem Platforme stavljamo Vam na raspolaganje potvrdu koju možete pronaći u svom računu pod „Rezervacije“.",
        "Račun za uslugu smještaja izdaje pružatelj; on je poduzetnik koji pruža uslugu. O porezima vidi [Poreznu politiku](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Izmjene ovih uvjeta plaćanja",
      paragraphs: [
        "Za izmjene ovih uvjeta plaćanja vrijedi odjeljak A22 [Uvjeta korištenja](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
