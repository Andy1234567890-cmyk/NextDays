// Rahmen-Beschriftungen der Rechtsseiten in allen 24 EU-Amtssprachen.
// Bewusst hier und nicht in messages/: die Plattform-UI ist derzeit deutsch,
// die Rechtsseiten sind es NICHT — sie müssen EU-weit in der Sprache des
// Nutzers lesbar sein, samt Überschriften um den Text herum.
import type { LegalLocale } from "./locales";
import type { LegalChrome } from "./dokumente";

export const LEGAL_CHROME: Record<LegalLocale, LegalChrome> = {
  bg: {
    verzeichnisTitel: "Правни условия",
    verzeichnisIntro:
      "Тук ще намерите всички условия и правила, които се прилагат за използването на myBestDays.",
    sprachwahl: "Избор на език",
    inhaltsverzeichnis: "Съдържание",
    zurueckZumVerzeichnis: "Обратно към правните условия",
    gruppen: {
      bedingungen: "Условия за ползване",
      standards: "Стандарти и правила",
      gebuehren: "Такси, цени и данъци",
      buchung: "Резервация, анулиране и проблеми",
      datenschutz: "Поверителност и бисквитки",
      rechtliches: "Правна информация",
    },
  },
  cs: {
    verzeichnisTitel: "Právní podmínky",
    verzeichnisIntro:
      "Zde najdete všechny podmínky a zásady, které se vztahují na používání platformy myBestDays.",
    sprachwahl: "Volba jazyka",
    inhaltsverzeichnis: "Obsah",
    zurueckZumVerzeichnis: "Zpět na právní podmínky",
    gruppen: {
      bedingungen: "Podmínky používání",
      standards: "Standardy a zásady",
      gebuehren: "Poplatky, ceny a daně",
      buchung: "Rezervace, zrušení a problémy",
      datenschutz: "Ochrana údajů a cookies",
      rechtliches: "Právní informace",
    },
  },
  da: {
    verzeichnisTitel: "Juridiske vilkår",
    verzeichnisIntro:
      "Her finder du alle vilkår og politikker, der gælder for brugen af myBestDays.",
    sprachwahl: "Vælg sprog",
    inhaltsverzeichnis: "Indhold",
    zurueckZumVerzeichnis: "Tilbage til juridiske vilkår",
    gruppen: {
      bedingungen: "Brugsvilkår",
      standards: "Standarder og politikker",
      gebuehren: "Gebyrer, priser og skatter",
      buchung: "Booking, afbestilling og problemer",
      datenschutz: "Privatliv og cookies",
      rechtliches: "Juridiske oplysninger",
    },
  },
  de: {
    verzeichnisTitel: "Rechtliche Bestimmungen",
    verzeichnisIntro:
      "Hier finden Sie alle Bedingungen und Richtlinien, die für die Nutzung von myBestDays gelten.",
    sprachwahl: "Sprache wählen",
    inhaltsverzeichnis: "Inhaltsverzeichnis",
    zurueckZumVerzeichnis: "Zurück zu den rechtlichen Bestimmungen",
    gruppen: {
      bedingungen: "Nutzungsbedingungen",
      standards: "Standards und Richtlinien",
      gebuehren: "Gebühren, Preise und Steuern",
      buchung: "Buchung, Stornierung und Probleme",
      datenschutz: "Datenschutz und Cookies",
      rechtliches: "Rechtliche Informationen",
    },
  },
  el: {
    verzeichnisTitel: "Νομικοί όροι",
    verzeichnisIntro:
      "Εδώ θα βρείτε όλους τους όρους και τις πολιτικές που ισχύουν για τη χρήση του myBestDays.",
    sprachwahl: "Επιλογή γλώσσας",
    inhaltsverzeichnis: "Περιεχόμενα",
    zurueckZumVerzeichnis: "Επιστροφή στους νομικούς όρους",
    gruppen: {
      bedingungen: "Όροι χρήσης",
      standards: "Πρότυπα και πολιτικές",
      gebuehren: "Χρεώσεις, τιμές και φόροι",
      buchung: "Κράτηση, ακύρωση και προβλήματα",
      datenschutz: "Απόρρητο και cookies",
      rechtliches: "Νομικές πληροφορίες",
    },
  },
  en: {
    verzeichnisTitel: "Legal terms",
    verzeichnisIntro:
      "Here you will find all terms and policies that apply to your use of myBestDays.",
    sprachwahl: "Choose language",
    inhaltsverzeichnis: "Table of contents",
    zurueckZumVerzeichnis: "Back to legal terms",
    gruppen: {
      bedingungen: "Terms of service",
      standards: "Standards and policies",
      gebuehren: "Fees, prices and taxes",
      buchung: "Booking, cancellation and problems",
      datenschutz: "Privacy and cookies",
      rechtliches: "Legal information",
    },
  },
  es: {
    verzeichnisTitel: "Condiciones legales",
    verzeichnisIntro:
      "Aquí encontrarás todas las condiciones y políticas aplicables al uso de myBestDays.",
    sprachwahl: "Elegir idioma",
    inhaltsverzeichnis: "Índice",
    zurueckZumVerzeichnis: "Volver a las condiciones legales",
    gruppen: {
      bedingungen: "Condiciones de uso",
      standards: "Normas y políticas",
      gebuehren: "Comisiones, precios e impuestos",
      buchung: "Reserva, cancelación y problemas",
      datenschutz: "Privacidad y cookies",
      rechtliches: "Información legal",
    },
  },
  et: {
    verzeichnisTitel: "Õiguslikud tingimused",
    verzeichnisIntro:
      "Siit leiate kõik tingimused ja põhimõtted, mis kehtivad myBestDaysi kasutamisel.",
    sprachwahl: "Vali keel",
    inhaltsverzeichnis: "Sisukord",
    zurueckZumVerzeichnis: "Tagasi õiguslike tingimuste juurde",
    gruppen: {
      bedingungen: "Kasutustingimused",
      standards: "Standardid ja põhimõtted",
      gebuehren: "Tasud, hinnad ja maksud",
      buchung: "Broneerimine, tühistamine ja probleemid",
      datenschutz: "Andmekaitse ja küpsised",
      rechtliches: "Õiguslik teave",
    },
  },
  fi: {
    verzeichnisTitel: "Oikeudelliset ehdot",
    verzeichnisIntro:
      "Täältä löydät kaikki ehdot ja käytännöt, joita sovelletaan myBestDaysin käyttöön.",
    sprachwahl: "Valitse kieli",
    inhaltsverzeichnis: "Sisällysluettelo",
    zurueckZumVerzeichnis: "Takaisin oikeudellisiin ehtoihin",
    gruppen: {
      bedingungen: "Käyttöehdot",
      standards: "Standardit ja käytännöt",
      gebuehren: "Maksut, hinnat ja verot",
      buchung: "Varaus, peruutus ja ongelmat",
      datenschutz: "Tietosuoja ja evästeet",
      rechtliches: "Oikeudelliset tiedot",
    },
  },
  fr: {
    verzeichnisTitel: "Conditions juridiques",
    verzeichnisIntro:
      "Vous trouverez ici toutes les conditions et politiques applicables à l'utilisation de myBestDays.",
    sprachwahl: "Choisir la langue",
    inhaltsverzeichnis: "Sommaire",
    zurueckZumVerzeichnis: "Retour aux conditions juridiques",
    gruppen: {
      bedingungen: "Conditions d'utilisation",
      standards: "Normes et politiques",
      gebuehren: "Frais, prix et taxes",
      buchung: "Réservation, annulation et problèmes",
      datenschutz: "Confidentialité et cookies",
      rechtliches: "Informations légales",
    },
  },
  ga: {
    verzeichnisTitel: "Téarmaí dlíthiúla",
    verzeichnisIntro:
      "Anseo gheobhaidh tú na téarmaí agus na beartais go léir a bhaineann le húsáid myBestDays.",
    sprachwahl: "Roghnaigh teanga",
    inhaltsverzeichnis: "Clár ábhair",
    zurueckZumVerzeichnis: "Ar ais chuig na téarmaí dlíthiúla",
    gruppen: {
      bedingungen: "Téarmaí úsáide",
      standards: "Caighdeáin agus beartais",
      gebuehren: "Táillí, praghsanna agus cánacha",
      buchung: "Áirithint, cealú agus fadhbanna",
      datenschutz: "Príobháideachas agus fianáin",
      rechtliches: "Faisnéis dhlíthiúil",
    },
  },
  hr: {
    verzeichnisTitel: "Pravni uvjeti",
    verzeichnisIntro:
      "Ovdje ćete pronaći sve uvjete i pravila koja se primjenjuju na korištenje platforme myBestDays.",
    sprachwahl: "Odaberite jezik",
    inhaltsverzeichnis: "Sadržaj",
    zurueckZumVerzeichnis: "Natrag na pravne uvjete",
    gruppen: {
      bedingungen: "Uvjeti korištenja",
      standards: "Standardi i pravila",
      gebuehren: "Naknade, cijene i porezi",
      buchung: "Rezervacija, otkazivanje i problemi",
      datenschutz: "Privatnost i kolačići",
      rechtliches: "Pravne informacije",
    },
  },
  hu: {
    verzeichnisTitel: "Jogi feltételek",
    verzeichnisIntro:
      "Itt találja mindazokat a feltételeket és szabályzatokat, amelyek a myBestDays használatára vonatkoznak.",
    sprachwahl: "Nyelv választása",
    inhaltsverzeichnis: "Tartalomjegyzék",
    zurueckZumVerzeichnis: "Vissza a jogi feltételekhez",
    gruppen: {
      bedingungen: "Felhasználási feltételek",
      standards: "Normák és szabályzatok",
      gebuehren: "Díjak, árak és adók",
      buchung: "Foglalás, lemondás és problémák",
      datenschutz: "Adatvédelem és sütik",
      rechtliches: "Jogi információk",
    },
  },
  it: {
    verzeichnisTitel: "Condizioni legali",
    verzeichnisIntro:
      "Qui trovi tutte le condizioni e le politiche applicabili all'uso di myBestDays.",
    sprachwahl: "Scegli la lingua",
    inhaltsverzeichnis: "Indice",
    zurueckZumVerzeichnis: "Torna alle condizioni legali",
    gruppen: {
      bedingungen: "Condizioni d'uso",
      standards: "Standard e politiche",
      gebuehren: "Commissioni, prezzi e imposte",
      buchung: "Prenotazione, cancellazione e problemi",
      datenschutz: "Privacy e cookie",
      rechtliches: "Informazioni legali",
    },
  },
  lt: {
    verzeichnisTitel: "Teisinės sąlygos",
    verzeichnisIntro:
      "Čia rasite visas sąlygas ir taisykles, taikomas naudojantis „myBestDays“.",
    sprachwahl: "Pasirinkite kalbą",
    inhaltsverzeichnis: "Turinys",
    zurueckZumVerzeichnis: "Grįžti į teisines sąlygas",
    gruppen: {
      bedingungen: "Naudojimosi sąlygos",
      standards: "Standartai ir taisyklės",
      gebuehren: "Mokesčiai, kainos ir mokesčiai",
      buchung: "Rezervacija, atšaukimas ir problemos",
      datenschutz: "Privatumas ir slapukai",
      rechtliches: "Teisinė informacija",
    },
  },
  lv: {
    verzeichnisTitel: "Juridiskie noteikumi",
    verzeichnisIntro:
      "Šeit atradīsiet visus noteikumus un politikas, kas attiecas uz myBestDays lietošanu.",
    sprachwahl: "Izvēlieties valodu",
    inhaltsverzeichnis: "Saturs",
    zurueckZumVerzeichnis: "Atpakaļ uz juridiskajiem noteikumiem",
    gruppen: {
      bedingungen: "Lietošanas noteikumi",
      standards: "Standarti un politikas",
      gebuehren: "Maksas, cenas un nodokļi",
      buchung: "Rezervācija, atcelšana un problēmas",
      datenschutz: "Privātums un sīkdatnes",
      rechtliches: "Juridiskā informācija",
    },
  },
  mt: {
    verzeichnisTitel: "Termini legali",
    verzeichnisIntro:
      "Hawnhekk issib it-termini u l-politiki kollha li japplikaw għall-użu ta' myBestDays.",
    sprachwahl: "Agħżel il-lingwa",
    inhaltsverzeichnis: "Werrej",
    zurueckZumVerzeichnis: "Lura għat-termini legali",
    gruppen: {
      bedingungen: "Termini tal-użu",
      standards: "Standards u politiki",
      gebuehren: "Tariffi, prezzijiet u taxxi",
      buchung: "Prenotazzjoni, kanċellazzjoni u problemi",
      datenschutz: "Privatezza u cookies",
      rechtliches: "Informazzjoni legali",
    },
  },
  nl: {
    verzeichnisTitel: "Juridische voorwaarden",
    verzeichnisIntro:
      "Hier vindt u alle voorwaarden en beleidsregels die gelden voor het gebruik van myBestDays.",
    sprachwahl: "Taal kiezen",
    inhaltsverzeichnis: "Inhoudsopgave",
    zurueckZumVerzeichnis: "Terug naar de juridische voorwaarden",
    gruppen: {
      bedingungen: "Gebruiksvoorwaarden",
      standards: "Normen en beleid",
      gebuehren: "Kosten, prijzen en belastingen",
      buchung: "Boeking, annulering en problemen",
      datenschutz: "Privacy en cookies",
      rechtliches: "Juridische informatie",
    },
  },
  pl: {
    verzeichnisTitel: "Warunki prawne",
    verzeichnisIntro:
      "Tutaj znajdziesz wszystkie warunki i zasady obowiązujące przy korzystaniu z myBestDays.",
    sprachwahl: "Wybierz język",
    inhaltsverzeichnis: "Spis treści",
    zurueckZumVerzeichnis: "Powrót do warunków prawnych",
    gruppen: {
      bedingungen: "Warunki korzystania",
      standards: "Standardy i zasady",
      gebuehren: "Opłaty, ceny i podatki",
      buchung: "Rezerwacja, anulowanie i problemy",
      datenschutz: "Prywatność i pliki cookie",
      rechtliches: "Informacje prawne",
    },
  },
  pt: {
    verzeichnisTitel: "Termos legais",
    verzeichnisIntro:
      "Aqui encontra todos os termos e políticas aplicáveis à utilização do myBestDays.",
    sprachwahl: "Escolher idioma",
    inhaltsverzeichnis: "Índice",
    zurueckZumVerzeichnis: "Voltar aos termos legais",
    gruppen: {
      bedingungen: "Termos de utilização",
      standards: "Normas e políticas",
      gebuehren: "Taxas, preços e impostos",
      buchung: "Reserva, cancelamento e problemas",
      datenschutz: "Privacidade e cookies",
      rechtliches: "Informação legal",
    },
  },
  ro: {
    verzeichnisTitel: "Condiții juridice",
    verzeichnisIntro:
      "Aici găsiți toate condițiile și politicile aplicabile utilizării myBestDays.",
    sprachwahl: "Alegeți limba",
    inhaltsverzeichnis: "Cuprins",
    zurueckZumVerzeichnis: "Înapoi la condițiile juridice",
    gruppen: {
      bedingungen: "Condiții de utilizare",
      standards: "Standarde și politici",
      gebuehren: "Comisioane, prețuri și taxe",
      buchung: "Rezervare, anulare și probleme",
      datenschutz: "Confidențialitate și cookie-uri",
      rechtliches: "Informații juridice",
    },
  },
  sk: {
    verzeichnisTitel: "Právne podmienky",
    verzeichnisIntro:
      "Tu nájdete všetky podmienky a zásady, ktoré sa vzťahujú na používanie platformy myBestDays.",
    sprachwahl: "Vyberte jazyk",
    inhaltsverzeichnis: "Obsah",
    zurueckZumVerzeichnis: "Späť na právne podmienky",
    gruppen: {
      bedingungen: "Podmienky používania",
      standards: "Štandardy a zásady",
      gebuehren: "Poplatky, ceny a dane",
      buchung: "Rezervácia, zrušenie a problémy",
      datenschutz: "Ochrana údajov a cookies",
      rechtliches: "Právne informácie",
    },
  },
  sl: {
    verzeichnisTitel: "Pravni pogoji",
    verzeichnisIntro:
      "Tukaj najdete vse pogoje in pravilnike, ki veljajo za uporabo platforme myBestDays.",
    sprachwahl: "Izberite jezik",
    inhaltsverzeichnis: "Kazalo",
    zurueckZumVerzeichnis: "Nazaj na pravne pogoje",
    gruppen: {
      bedingungen: "Pogoji uporabe",
      standards: "Standardi in pravilniki",
      gebuehren: "Provizije, cene in davki",
      buchung: "Rezervacija, odpoved in težave",
      datenschutz: "Zasebnost in piškotki",
      rechtliches: "Pravne informacije",
    },
  },
  sv: {
    verzeichnisTitel: "Juridiska villkor",
    verzeichnisIntro:
      "Här hittar du alla villkor och riktlinjer som gäller för användningen av myBestDays.",
    sprachwahl: "Välj språk",
    inhaltsverzeichnis: "Innehåll",
    zurueckZumVerzeichnis: "Tillbaka till de juridiska villkoren",
    gruppen: {
      bedingungen: "Användarvillkor",
      standards: "Standarder och riktlinjer",
      gebuehren: "Avgifter, priser och skatter",
      buchung: "Bokning, avbokning och problem",
      datenschutz: "Integritet och cookies",
      rechtliches: "Juridisk information",
    },
  },
};
