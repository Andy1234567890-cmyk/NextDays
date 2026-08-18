import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika kod teških smetnji",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ponekad putovanje ili boravak onemogući događaj za koji nisu krivi ni gost ni pružatelj. Ova politika opisuje koji su to događaji i što tada vrijedi.",
    "Ima prednost pred uvjetom otkazivanja odabranim u oglasu.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Koji su događaji obuhvaćeni",
      paragraphs: [
        "Obuhvaćeni su događaji koji nastupe nakon rezervacije, bili su nepredvidivi za obje strane te putovanje ili boravak čine nemogućim ili pravno nedopuštenim:",
      ],
      list: [
        "službene zabrane putovanja ili boravka, policijski sat i zatvaranja granica koji se odnose na odredište ili mjesto polaska;",
        "prirodne katastrofe i prirodne pojave koje pogađaju odredište — potres, poplava, oluja, veliki požar, vulkanska erupcija;",
        "rat, oružani sukobi, teroristički napadi i nemiri na odredištu;",
        "službeno utvrđena epidemija ili pandemija s mjerama koje zabranjuju boravak;",
        "prekid opskrbe strujom, vodom ili toplinom na odredištu kroz dulje razdoblje;",
        "potpuna nemogućnost dolaska na odredište zbog nekog od navedenih događaja.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Koji događaji nisu obuhvaćeni",
      paragraphs: ["Nisu obuhvaćeni osobito:"],
      list: [
        "bolest ili ozljeda gosta ili njegovih bližnjih — za to je predviđeno putno osiguranje;",
        "poslovna spriječenost, ispitni rokovi ili izostanak godišnjeg odmora;",
        "otkazivanje priredbe zbog koje je putovanje rezervirano, ako smještaj ostaje upotrebljiv;",
        "vrijeme koje ne predstavlja prirodnu katastrofu — kiša, hladnoća, vrućina, nedostatak snijega;",
        "izostanak pojedinih prijevoznih sredstava, dok god ostaje moguć razuman dolazak;",
        "otkazivanje leta ili štrajk kod prijevoznika — za to postoje zahtjevi prema prijevozniku.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Što vrijedi kada nastupi obuhvaćeni događaj",
      paragraphs: [
        "Odnosi li se događaj na razdoblje Vaše rezervacije, možete besplatno otkazati. Iznos plaćen putem Platforme dobivate u cijelosti natrag.",
        "Ako je boravak već započeo, vraćamo udio za noći koje se više ne mogu iskoristiti.",
        "Pružatelju iz takvog otkazivanja ne nastaju nedostaci u ocjeni njegove pouzdanosti.",
        "Alternativno se s pružateljem možete dogovoriti o odgodi; pomažemo pri prerezervaciji.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Kako se na nju pozivate",
      paragraphs: [
        "Javite se putem kontaktnih putova u dijelu [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden) te navedite broj rezervacije i događaj.",
        "Provjeravamo na temelju javno dostupnih izvora — službenih naloga, službenih upozorenja, izvješća priznatih izvora vijesti — i odlučujemo brzo.",
        "Ako se stanje još ne može konačno ocijeniti, čekamo razvoj do neposredno prije dana dolaska i tada odlučujemo. Vaša rezervacija do tada ostaje nepromijenjena.",
      ],
    },
  ],
};
