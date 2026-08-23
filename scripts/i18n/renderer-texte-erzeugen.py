# -*- coding: utf-8 -*-
"""Erzeugt builder/lib/texte.ts — die festen Gast-Texte des Renderers in den
24 EU-Amtssprachen."""

KEYS = [
    "cookieText", "cookieKnopf", "cookieLink",
    "datenschutzZustimmung",
    "sucheVon", "sucheBis", "sucheGaeste", "sucheSuchen",
    "spracheWaehlen", "jetztBuchen", "sucheReiseziel",
    "gaesteErwachsene", "gaesteKinder", "gaesteKleinkinder", "gaesteTiere",
    "preisNacht", "preisAufAnfrage", "keineUnterkuenfte", "gaesteFavorit",
    "checkIn", "checkOut", "vorname", "nachname", "email",
    "datenschutzPflicht", "datenschutzMehr",
]

T = {
 "bg": ["Този сайт използва бисквитки, за да работи правилно.", "Разбрах", "Политика за бисквитки",
        "Прочетох и приемам политиката за защита на данните.",
        "От", "До", "Гости", "Търсене", "Език", "Резервирай сега", "Търсене на дестинация", "Възрастни", "Деца", "Бебета", "Домашни любимци", "нощувка", "Цена при запитване", "В момента няма свободни жилища.", "Любимец на гостите", "Настаняване", "Освобождаване", "Име", "Фамилия", "Имейл", "Моля, приемете политиката за защита на данните.", "Прочети"],
 "cs": ["Tento web používá cookies, aby fungoval správně.", "Rozumím", "Zásady cookies",
        "Přečetl(a) jsem si zásady ochrany osobních údajů a přijímám je.",
        "Od", "Do", "Hosté", "Hledat", "Jazyk", "Rezervovat", "Hledat destinaci", "Dospělí", "Děti", "Kojenci", "Domácí zvířata", "noc", "Cena na dotaz", "Momentálně nejsou k dispozici žádné objekty.", "Oblíbené u hostů", "Příjezd", "Odjezd", "Jméno", "Příjmení", "E-mail", "Přijměte prosím zásady ochrany osobních údajů.", "Přečíst"],
 "da": ["Dette website bruger cookies for at fungere korrekt.", "Forstået", "Cookiepolitik",
        "Jeg har læst og accepterer privatlivspolitikken.",
        "Fra", "Til", "Gæster", "Søg", "Sprog", "Book nu", "Søg destination", "Voksne", "Børn", "Babyer", "Kæledyr", "nat", "Pris på forespørgsel", "Der er i øjeblikket ingen ledige boliger.", "Gæstefavorit", "Ankomst", "Afrejse", "Fornavn", "Efternavn", "E-mail", "Accepter venligst privatlivspolitikken.", "Læs"],
 "de": ["Diese Website verwendet Cookies, damit sie richtig funktioniert.", "Verstanden", "Cookie-Richtlinie",
        "Ich habe die Datenschutzerklärung gelesen und stimme ihr zu.",
        "Von", "Bis", "Gäste", "Suchen", "Sprache", "Jetzt buchen", "Reiseziel suchen", "Erwachsene", "Kinder", "Kleinkinder", "Haustiere", "Nacht", "Preis auf Anfrage", "Aktuell sind keine Unterkünfte verfügbar.", "Gäste-Favorit", "Anreise", "Abreise", "Vorname", "Nachname", "E-Mail", "Bitte stimmen Sie der Datenschutzerklärung zu.", "Nachlesen"],
 "el": ["Αυτός ο ιστότοπος χρησιμοποιεί cookies για να λειτουργεί σωστά.", "Κατάλαβα", "Πολιτική cookies",
        "Διάβασα και αποδέχομαι την πολιτική απορρήτου.",
        "Από", "Έως", "Επισκέπτες", "Αναζήτηση", "Γλώσσα", "Κάντε κράτηση", "Αναζήτηση προορισμού", "Ενήλικες", "Παιδιά", "Βρέφη", "Κατοικίδια", "διανυκτέρευση", "Τιμή κατόπιν αιτήματος", "Δεν υπάρχουν διαθέσιμα καταλύματα.", "Αγαπημένο των επισκεπτών", "Άφιξη", "Αναχώρηση", "Όνομα", "Επώνυμο", "E-mail", "Αποδεχθείτε την πολιτική απορρήτου.", "Διαβάστε"],
 "en": ["This website uses cookies so that it works properly.", "Got it", "Cookie policy",
        "I have read and accept the privacy policy.",
        "From", "To", "Guests", "Search", "Language", "Book now", "Search destination", "Adults", "Children", "Infants", "Pets", "night", "Price on request", "No accommodation is available right now.", "Guest favourite", "Check-in", "Check-out", "First name", "Last name", "Email", "Please accept the privacy policy.", "Read it"],
 "es": ["Este sitio web utiliza cookies para funcionar correctamente.", "Entendido", "Política de cookies",
        "He leído y acepto la política de privacidad.",
        "Desde", "Hasta", "Huéspedes", "Buscar", "Idioma", "Reservar ahora", "Buscar destino", "Adultos", "Niños", "Bebés", "Mascotas", "noche", "Precio a consultar", "Actualmente no hay alojamientos disponibles.", "Favorito de los huéspedes", "Llegada", "Salida", "Nombre", "Apellido", "Correo electrónico", "Acepte la política de privacidad.", "Leer"],
 "et": ["See veebisait kasutab küpsiseid, et korralikult töötada.", "Selge", "Küpsiste poliitika",
        "Olen privaatsuspoliitika läbi lugenud ja nõustun sellega.",
        "Alates", "Kuni", "Külalised", "Otsi", "Keel", "Broneeri", "Otsi sihtkohta", "Täiskasvanud", "Lapsed", "Imikud", "Lemmikloomad", "öö", "Hind päringu alusel", "Praegu pole ühtegi majutust saadaval.", "Külaliste lemmik", "Saabumine", "Lahkumine", "Eesnimi", "Perekonnanimi", "E-post", "Palun nõustuge privaatsuspoliitikaga.", "Loe"],
 "fi": ["Tämä sivusto käyttää evästeitä toimiakseen oikein.", "Selvä", "Evästekäytäntö",
        "Olen lukenut tietosuojakäytännön ja hyväksyn sen.",
        "Alkaen", "Päättyen", "Vieraat", "Hae", "Kieli", "Varaa nyt", "Etsi kohdetta", "Aikuiset", "Lapset", "Vauvat", "Lemmikit", "yö", "Hinta pyynnöstä", "Tällä hetkellä ei ole vapaita kohteita.", "Vieraiden suosikki", "Saapuminen", "Lähtö", "Etunimi", "Sukunimi", "Sähköposti", "Hyväksy tietosuojakäytäntö.", "Lue"],
 "fr": ["Ce site utilise des cookies pour fonctionner correctement.", "Compris", "Politique de cookies",
        "J'ai lu et j'accepte la politique de confidentialité.",
        "Du", "Au", "Voyageurs", "Rechercher", "Langue", "Réserver", "Rechercher une destination", "Adultes", "Enfants", "Bébés", "Animaux", "nuit", "Prix sur demande", "Aucun logement n'est disponible actuellement.", "Coup de cœur", "Arrivée", "Départ", "Prénom", "Nom", "E-mail", "Veuillez accepter la politique de confidentialité.", "Consulter"],
 "ga": ["Úsáideann an suíomh seo fianáin chun oibriú i gceart.", "Tuigim", "Polasaí fianán",
        "Léigh mé an polasaí príobháideachais agus glacaim leis.",
        "Ó", "Go", "Aíonna", "Cuardaigh", "Teanga", "Cuir in áirithe", "Cuardaigh ceann scríbe", "Daoine fásta", "Leanaí", "Naíonáin", "Peataí", "oíche", "Praghas ar iarratas", "Níl aon lóistín ar fáil faoi láthair.", "Rogha na n-aíonna", "Teacht", "Imeacht", "Ainm", "Sloinne", "R-phost", "Glac le polasaí príobháideachais, le do thoil.", "Léigh"],
 "hr": ["Ova web-stranica koristi kolačiće kako bi ispravno radila.", "Razumijem", "Pravila o kolačićima",
        "Pročitao/la sam pravila o zaštiti podataka i prihvaćam ih.",
        "Od", "Do", "Gosti", "Traži", "Jezik", "Rezerviraj", "Traži destinaciju", "Odrasli", "Djeca", "Bebe", "Kućni ljubimci", "noć", "Cijena na upit", "Trenutačno nema dostupnih objekata.", "Favorit gostiju", "Prijava", "Odjava", "Ime", "Prezime", "E-pošta", "Molimo prihvatite pravila o zaštiti podataka.", "Pročitaj"],
 "hu": ["Ez a weboldal sütiket használ a helyes működéshez.", "Értem", "Sütiszabályzat",
        "Elolvastam és elfogadom az adatvédelmi szabályzatot.",
        "Ettől", "Eddig", "Vendégek", "Keresés", "Nyelv", "Foglalás", "Úti cél keresése", "Felnőttek", "Gyermekek", "Csecsemők", "Házi kedvencek", "éjszaka", "Ár kérésre", "Jelenleg nincs elérhető szállás.", "Vendégek kedvence", "Érkezés", "Távozás", "Utónév", "Családnév", "E-mail", "Kérjük, fogadja el az adatvédelmi szabályzatot.", "Elolvasom"],
 "it": ["Questo sito utilizza i cookie per funzionare correttamente.", "Ho capito", "Informativa sui cookie",
        "Ho letto e accetto l'informativa sulla privacy.",
        "Dal", "Al", "Ospiti", "Cerca", "Lingua", "Prenota ora", "Cerca destinazione", "Adulti", "Bambini", "Neonati", "Animali", "notte", "Prezzo su richiesta", "Al momento non ci sono alloggi disponibili.", "Preferito dagli ospiti", "Arrivo", "Partenza", "Nome", "Cognome", "E-mail", "Accetta l'informativa sulla privacy.", "Leggi"],
 "lt": ["Ši svetainė naudoja slapukus, kad tinkamai veiktų.", "Supratau", "Slapukų politika",
        "Perskaičiau privatumo politiką ir su ja sutinku.",
        "Nuo", "Iki", "Svečiai", "Ieškoti", "Kalba", "Rezervuoti", "Ieškoti krypties", "Suaugusieji", "Vaikai", "Kūdikiai", "Gyvūnai", "naktis", "Kaina pagal užklausą", "Šiuo metu nėra laisvų apgyvendinimo vietų.", "Svečių pasirinkimas", "Atvykimas", "Išvykimas", "Vardas", "Pavardė", "El. paštas", "Prašome priimti privatumo politiką.", "Skaityti"],
 "lv": ["Šī vietne izmanto sīkfailus, lai darbotos pareizi.", "Sapratu", "Sīkfailu politika",
        "Esmu izlasījis privātuma politiku un to pieņemu.",
        "No", "Līdz", "Viesi", "Meklēt", "Valoda", "Rezervēt", "Meklēt galamērķi", "Pieaugušie", "Bērni", "Zīdaiņi", "Mājdzīvnieki", "nakts", "Cena pēc pieprasījuma", "Šobrīd nav pieejamu naktsmītņu.", "Viesu favorīts", "Ierašanās", "Izbraukšana", "Vārds", "Uzvārds", "E-pasts", "Lūdzu, pieņemiet privātuma politiku.", "Lasīt"],
 "mt": ["Dan is-sit juża cookies biex jaħdem sew.", "Fhimt", "Politika tal-cookies",
        "Qrajt u naċċetta l-politika tal-privatezza.",
        "Minn", "Sa", "Mistednin", "Fittex", "Lingwa", "Ibbukkja", "Fittex destinazzjoni", "Adulti", "Tfal", "Trabi", "Annimali", "lejl", "Prezz fuq talba", "Bħalissa ma hemmx akkomodazzjoni disponibbli.", "Favorit tal-mistednin", "Wasla", "Tluq", "Isem", "Kunjom", "Email", "Jekk jogħġbok aċċetta l-politika tal-privatezza.", "Aqra"],
 "nl": ["Deze website gebruikt cookies om goed te werken.", "Begrepen", "Cookiebeleid",
        "Ik heb het privacybeleid gelezen en accepteer het.",
        "Van", "Tot", "Gasten", "Zoeken", "Taal", "Nu boeken", "Bestemming zoeken", "Volwassenen", "Kinderen", "Baby's", "Huisdieren", "nacht", "Prijs op aanvraag", "Er zijn momenteel geen accommodaties beschikbaar.", "Favoriet van gasten", "Aankomst", "Vertrek", "Voornaam", "Achternaam", "E-mail", "Accepteer het privacybeleid.", "Lezen"],
 "pl": ["Ta strona używa plików cookie, aby działać poprawnie.", "Rozumiem", "Polityka cookies",
        "Przeczytałem/am politykę prywatności i ją akceptuję.",
        "Od", "Do", "Goście", "Szukaj", "Język", "Zarezerwuj", "Szukaj miejsca", "Dorośli", "Dzieci", "Niemowlęta", "Zwierzęta", "noc", "Cena na zapytanie", "Obecnie brak dostępnych obiektów.", "Ulubione przez gości", "Przyjazd", "Wyjazd", "Imię", "Nazwisko", "E-mail", "Prosimy zaakceptować politykę prywatności.", "Przeczytaj"],
 "pt": ["Este site utiliza cookies para funcionar corretamente.", "Entendi", "Política de cookies",
        "Li e aceito a política de privacidade.",
        "De", "Até", "Hóspedes", "Pesquisar", "Idioma", "Reservar agora", "Pesquisar destino", "Adultos", "Crianças", "Bebés", "Animais", "noite", "Preço sob consulta", "Atualmente não há alojamentos disponíveis.", "Favorito dos hóspedes", "Chegada", "Partida", "Nome", "Sobrenome", "E-mail", "Aceite a política de privacidade.", "Ler"],
 "ro": ["Acest site folosește cookie-uri pentru a funcționa corect.", "Am înțeles", "Politica de cookie-uri",
        "Am citit și accept politica de confidențialitate.",
        "De la", "Până la", "Oaspeți", "Caută", "Limbă", "Rezervă acum", "Caută destinația", "Adulți", "Copii", "Bebeluși", "Animale", "noapte", "Preț la cerere", "În acest moment nu există cazări disponibile.", "Preferatul oaspeților", "Sosire", "Plecare", "Prenume", "Nume", "E-mail", "Vă rugăm să acceptați politica de confidențialitate.", "Citește"],
 "sk": ["Táto webová stránka používa cookies, aby fungovala správne.", "Rozumiem", "Zásady cookies",
        "Prečítal(a) som si zásady ochrany osobných údajov a prijímam ich.",
        "Od", "Do", "Hostia", "Hľadať", "Jazyk", "Rezervovať", "Hľadať destináciu", "Dospelí", "Deti", "Dojčatá", "Domáce zvieratá", "noc", "Cena na vyžiadanie", "Momentálne nie sú dostupné žiadne ubytovania.", "Obľúbené u hostí", "Príchod", "Odchod", "Meno", "Priezvisko", "E-mail", "Prijmite prosím zásady ochrany osobných údajov.", "Prečítať"],
 "sl": ["Ta spletna stran uporablja piškotke, da deluje pravilno.", "Razumem", "Politika piškotkov",
        "Prebral(a) sem politiko zasebnosti in jo sprejemam.",
        "Od", "Do", "Gostje", "Iskanje", "Jezik", "Rezerviraj", "Iskanje destinacije", "Odrasli", "Otroci", "Dojenčki", "Hišni ljubljenčki", "noč", "Cena na povpraševanje", "Trenutno ni razpoložljivih nastanitev.", "Priljubljeno med gosti", "Prihod", "Odhod", "Ime", "Priimek", "E-pošta", "Prosimo, sprejmite politiko zasebnosti.", "Preberi"],
 "sv": ["Den här webbplatsen använder cookies för att fungera korrekt.", "Jag förstår", "Cookiepolicy",
        "Jag har läst och godkänner integritetspolicyn.",
        "Från", "Till", "Gäster", "Sök", "Språk", "Boka nu", "Sök destination", "Vuxna", "Barn", "Spädbarn", "Husdjur", "natt", "Pris på förfrågan", "Det finns inga boenden tillgängliga just nu.", "Gästernas favorit", "Ankomst", "Avresa", "Förnamn", "Efternamn", "E-post", "Godkänn integritetspolicyn.", "Läs"],
}

# Anzeigenamen der Sprachen in ihrer eigenen Sprache (für den Wähler).
NAMEN = {
 "bg": "Български", "cs": "Čeština", "da": "Dansk", "de": "Deutsch",
 "el": "Ελληνικά", "en": "English", "es": "Español", "et": "Eesti",
 "fi": "Suomi", "fr": "Français", "ga": "Gaeilge", "hr": "Hrvatski",
 "hu": "Magyar", "it": "Italiano", "lt": "Lietuvių", "lv": "Latviešu",
 "mt": "Malti", "nl": "Nederlands", "pl": "Polski", "pt": "Português",
 "ro": "Română", "sk": "Slovenčina", "sl": "Slovenščina", "sv": "Svenska",
}

for code, werte in T.items():
    assert len(werte) == len(KEYS), f"{code}: {len(werte)} statt {len(KEYS)}"
    for w in werte:
        assert w.strip(), f"{code}: leerer Text"
        assert '"' not in w, f"{code}: gerades Anfuehrungszeichen in {w!r}"

kopf = '''// Feste Gast-Texte der Kunden-Websites, in den 24 EU-Amtssprachen.
//
// Warum ein eigener Katalog und nicht `next-intl` wie in den anderen Apps:
// dieser Renderer hat pro Request GENAU EINE Sprache — die der Website, nicht
// die des Bedieners. Er braucht keinen Provider, keinen Locale-Cookie und keine
// Middleware-Verhandlung, sondern eine Funktion, die zu einem Sprachcode ein
// Objekt mit Texten liefert. `next-intl` einzuziehen hätte eine ganze
// Konfigurationsschicht bedeutet, deren einzige Aufgabe das Nachschlagen in
// einem Objekt gewesen wäre.
//
// Der Anlass: die Suchleiste des Renderers hatte deutsche Beschriftungen im
// Markup („Von", „Bis", „Gäste", „Suchen") — auf JEDER Kundenseite, auch der
// dänischen. Dazu kommen jetzt Cookie-Hinweis, Datenschutz-Zustimmung und der
// Sprachwähler (0426).
//
// Hier stehen NUR Texte, die der Renderer selbst beisteuert. Alles, was der
// Kunde eingibt, ist eine Locale-Map in seinen Daten und läuft über `pickText`
// — dieser Katalog fasst Kundeninhalte nicht an.
//
// Erzeugt und geprüft mit scripts/i18n; Reihenfolge und Schlüsselmenge sind in
// allen Sprachen gleich (der Typ `RendererTexte` erzwingt es).

/** Die Texte, die der Renderer selbst stellt. */
export type RendererTexte = {
'''
zeilen = [kopf]
kommentare = {
 "cookieText": "Cookie-Hinweis am Seitenfuß.",
 "cookieKnopf": "Bestätigung des Hinweises.",
 "cookieLink": "Link zur Cookie-Richtlinie des Betriebs.",
 "datenschutzZustimmung": "Pflicht-Häkchen unter einem Formular.",
 "sucheVon": "Anreise im Suchfeld.",
 "sucheBis": "Abreise im Suchfeld.",
 "sucheGaeste": "Gästezahl im Suchfeld.",
 "sucheSuchen": "Knopf des Suchfelds.",
 "spracheWaehlen": "Beschriftung des Sprachwählers.",
 "jetztBuchen": "Knopf in der Kopfzeile.",
 "sucheReiseziel": "Platzhalter des Suchfelds, wenn der Kunde keinen eigenen setzt.",
 "gaesteErwachsene": "Aufgeschlüsselte Gästezahl: Erwachsene.",
 "gaesteKinder": "Aufgeschlüsselte Gästezahl: Kinder.",
 "gaesteKleinkinder": "Aufgeschlüsselte Gästezahl: Kleinkinder.",
 "gaesteTiere": "Aufgeschlüsselte Gästezahl: Haustiere.",
 "preisNacht": "Einheit hinter dem Preis auf der Objektkarte.",
 "preisAufAnfrage": "Objektkarte ohne berechenbaren Preis.",
 "keineUnterkuenfte": "Leerzustand des Objekt-Grids.",
 "gaesteFavorit": "Auszeichnung auf der Objektkarte.",
 "checkIn": "Anreise im Buchungs-Widget.",
 "checkOut": "Abreise im Buchungs-Widget.",
 "vorname": "Vorname des Gastes.",
 "nachname": "Nachname des Gastes.",
 "email": "E-Mail des Gastes.",
 "datenschutzPflicht": "Meldung, wenn das Datenschutz-Haken fehlt.",
 "datenschutzMehr": "Link zur Datenschutzerklaerung neben dem Haken.",
}
for k in KEYS:
    zeilen.append(f"  /** {kommentare[k]} */\n  {k}: string;\n")
zeilen.append("};\n\n")

zeilen.append("/** Anzeigename einer Sprache in ihrer EIGENEN Sprache. Ein Wähler, der\n")
zeilen.append(" *  „Dänisch“ auf Deutsch anbietet, hilft dem dänischen Gast nicht. */\n")
zeilen.append("export const SPRACH_NAMEN: Record<string, string> = {\n")
for code in sorted(NAMEN):
    zeilen.append(f'  {code}: "{NAMEN[code]}",\n')
zeilen.append("};\n\n")

zeilen.append("const KATALOG: Record<string, RendererTexte> = {\n")
for code in sorted(T):
    zeilen.append(f"  {code}: {{\n")
    for k, w in zip(KEYS, T[code]):
        zeilen.append(f'    {k}: "{w}",\n')
    zeilen.append("  },\n")
zeilen.append("};\n\n")

zeilen.append('''/** Texte für eine Sprache.
 *
 *  Eine unbekannte Sprache fällt auf Englisch zurück und nicht auf Deutsch: der
 *  Fall tritt nur ein, wenn eine Sprache hinzukommt, für die dieser Katalog noch
 *  keinen Eintrag hat — und Englisch versteht in dieser Lage mehr als Deutsch.
 *  Die Sprachwahl selbst prüft ohnehin gegen die Liste (lib/sprache.ts), hier
 *  ist es nur der letzte Halt. */
export function texte(sprache: string): RendererTexte {
  return KATALOG[sprache] ?? KATALOG.en!;
}
''')

import pathlib
pathlib.Path("builder/lib/texte.ts").write_text("".join(zeilen), encoding="utf-8")
print(f"builder/lib/texte.ts: {len(T)} Sprachen x {len(KEYS)} Schlüssel")
