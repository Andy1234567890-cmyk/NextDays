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
    "leerBewertungen", "leerText", "leerBild", "leerGalerie", "leerButton",
    "leerObjekte", "leerFaq",
    "leerKarte", "leerStimmen", "leerMerkmale", "karteOeffnen", "karteRoute",
    "nichtGefunden", "nichtGefundenHinweis", "zurStartseite",
    "leerFormular", "formularSenden", "formularDanke", "formularFehler",
    "popupSchliessen",
    "reservierenBezahlen", "anfrageSenden", "anfrageHinweis", "anfrageGesendet",
    "blogTitel", "blogAlle", "blogLeer", "leerBeitraege", "blogAlleAnsehen",
]

T = {
 "bg": ["Този сайт използва бисквитки, за да работи правилно.", "Разбрах", "Политика за бисквитки",
        "Прочетох и приемам политиката за защита на данните.",
        "От", "До", "Гости", "Търсене", "Език", "Резервирай сега", "Търсене на дестинация", "Възрастни", "Деца", "Бебета", "Домашни любимци", "нощувка", "Цена при запитване", "В момента няма свободни жилища.", "Любимец на гостите", "Настаняване", "Освобождаване", "Име", "Фамилия", "Имейл", "Моля, приемете политиката за защита на данните.", "Прочети", "Още няма отзиви — този раздел се появява, щом получите първия.", "Още няма текст — въведете го в полето отляво.", "Още няма избрана снимка.", "Още няма снимки в галерията.", "Липсва надпис или цел на бутона.", "Още няма избрани обекти.", "Още няма въпроси — добавете първия отляво.", "Още няма адрес — въведете го отляво.", "Още няма отзиви на гости.", "Още няма добавени характеристики.", "Отвори в Google Maps", "Виж маршрута", "Страницата не е намерена", "Тази страница не съществува или е преместена.", "Към началната страница", "Още няма полета — добавете първото отляво.", "Изпрати", "Благодарим — съобщението пристигна.", "Изпращането не бе успешно. Опитайте отново.", "Затвори", "Резервирай и плати", "Изпрати запитване", "Собственикът ще потвърди резервацията и ще уточни плащането с вас.", "Запитването е изпратено — ще получите отговор скоро.", "Блог", "Всички", "Още няма публикации.", "Още няма публикации — създайте първата под „Страници“.", "Всички публикации"],
 "cs": ["Tento web používá cookies, aby fungoval správně.", "Rozumím", "Zásady cookies",
        "Přečetl(a) jsem si zásady ochrany osobních údajů a přijímám je.",
        "Od", "Do", "Hosté", "Hledat", "Jazyk", "Rezervovat", "Hledat destinaci", "Dospělí", "Děti", "Kojenci", "Domácí zvířata", "noc", "Cena na dotaz", "Momentálně nejsou k dispozici žádné objekty.", "Oblíbené u hostů", "Příjezd", "Odjezd", "Jméno", "Příjmení", "E-mail", "Přijměte prosím zásady ochrany osobních údajů.", "Přečíst", "Zatím žádné recenze — tento úsek se zobrazí po první z nich.", "Zatím žádný text — zadejte jej v poli vlevo.", "Zatím není vybrán žádný obrázek.", "V galerii zatím nejsou žádné obrázky.", "Chybí popis nebo cíl tlačítka.", "Zatím nejsou vybrány žádné objekty.", "Zatím žádné otázky — první přidejte vlevo.", "Zatím žádná adresa — zadejte ji vlevo.", "Zatím žádné ohlasy hostů.", "Zatím žádné položky.", "Otevřít v Google Maps", "Zobrazit trasu", "Stránka nenalezena", "Tato stránka neexistuje nebo byla přesunuta.", "Na úvodní stránku", "Zatím žádná pole — první přidejte vlevo.", "Odeslat", "Děkujeme — zpráva dorazila.", "Odeslání se nezdařilo. Zkuste to prosím znovu.", "Zavřít", "Rezervovat a zaplatit", "Odeslat poptávku", "Ubytovatel rezervaci potvrdí a domluví s vámi platbu.", "Poptávka odeslána — brzy obdržíte odpověď.", "Blog", "Vše", "Zatím žádné příspěvky.", "Zatím žádné příspěvky — první vytvořte v části „Stránky“.", "Všechny příspěvky"],
 "da": ["Dette website bruger cookies for at fungere korrekt.", "Forstået", "Cookiepolitik",
        "Jeg har læst og accepterer privatlivspolitikken.",
        "Fra", "Til", "Gæster", "Søg", "Sprog", "Book nu", "Søg destination", "Voksne", "Børn", "Babyer", "Kæledyr", "nat", "Pris på forespørgsel", "Der er i øjeblikket ingen ledige boliger.", "Gæstefavorit", "Ankomst", "Afrejse", "Fornavn", "Efternavn", "E-mail", "Accepter venligst privatlivspolitikken.", "Læs", "Endnu ingen anmeldelser — dette afsnit vises, når den første kommer.", "Endnu ingen tekst — skriv den i feltet til venstre.", "Endnu intet billede valgt.", "Endnu ingen billeder i galleriet.", "Der mangler tekst eller mål på knappen.", "Endnu ingen boliger valgt.", "Endnu ingen spørgsmål — tilføj det første til venstre.", "Endnu ingen adresse — skriv den til venstre.", "Endnu ingen gæsteudtalelser.", "Endnu ingen punkter.", "Åbn i Google Maps", "Vis rute", "Siden blev ikke fundet", "Denne side findes ikke eller er flyttet.", "Til forsiden", "Endnu ingen felter — tilføj det første til venstre.", "Send", "Tak — beskeden er modtaget.", "Afsendelsen mislykkedes. Prøv igen.", "Luk", "Reservér og betal", "Send forespørgsel", "Værten bekræfter reservationen og aftaler betalingen med dig.", "Forespørgslen er sendt — du hører fra os snart.", "Blog", "Alle", "Endnu ingen indlæg.", "Endnu ingen indlæg — opret det første under »Sider«.", "Alle indlæg"],
 "de": ["Diese Website verwendet Cookies, damit sie richtig funktioniert.", "Verstanden", "Cookie-Richtlinie",
        "Ich habe die Datenschutzerklärung gelesen und stimme ihr zu.",
        "Von", "Bis", "Gäste", "Suchen", "Sprache", "Jetzt buchen", "Reiseziel suchen", "Erwachsene", "Kinder", "Kleinkinder", "Haustiere", "Nacht", "Preis auf Anfrage", "Aktuell sind keine Unterkünfte verfügbar.", "Gäste-Favorit", "Anreise", "Abreise", "Vorname", "Nachname", "E-Mail", "Bitte stimmen Sie der Datenschutzerklärung zu.", "Nachlesen", "Noch keine Bewertungen — dieser Abschnitt erscheint mit der ersten.", "Noch kein Text — schreiben Sie ihn im Feld links.", "Noch kein Bild gewählt.", "Noch keine Bilder in der Galerie.", "Beschriftung oder Ziel des Buttons fehlt.", "Noch keine Objekte gewählt.", "Noch keine Fragen — legen Sie links die erste an.", "Noch keine Adresse — geben Sie sie links ein.", "Noch keine Gästestimmen.", "Noch keine Merkmale.", "In Google Maps öffnen", "Route anzeigen", "Seite nicht gefunden", "Diese Seite gibt es nicht oder sie ist umgezogen.", "Zur Startseite", "Noch keine Felder — legen Sie links das erste an.", "Senden", "Danke — Ihre Nachricht ist angekommen.", "Das Senden hat nicht funktioniert. Bitte versuchen Sie es erneut.", "Schließen", "Reservieren & bezahlen", "Anfrage senden", "Der Gastgeber bestätigt die Buchung und klärt die Zahlung mit Ihnen.", "Anfrage gesendet — Sie hören in Kürze von uns.", "Blog", "Alle", "Noch keine Beiträge.", "Noch keine Beiträge — legen Sie den ersten unter „Seiten“ an.", "Alle Beiträge"],
 "el": ["Αυτός ο ιστότοπος χρησιμοποιεί cookies για να λειτουργεί σωστά.", "Κατάλαβα", "Πολιτική cookies",
        "Διάβασα και αποδέχομαι την πολιτική απορρήτου.",
        "Από", "Έως", "Επισκέπτες", "Αναζήτηση", "Γλώσσα", "Κάντε κράτηση", "Αναζήτηση προορισμού", "Ενήλικες", "Παιδιά", "Βρέφη", "Κατοικίδια", "διανυκτέρευση", "Τιμή κατόπιν αιτήματος", "Δεν υπάρχουν διαθέσιμα καταλύματα.", "Αγαπημένο των επισκεπτών", "Άφιξη", "Αναχώρηση", "Όνομα", "Επώνυμο", "E-mail", "Αποδεχθείτε την πολιτική απορρήτου.", "Διαβάστε", "Δεν υπάρχουν ακόμη κριτικές — η ενότητα εμφανίζεται με την πρώτη.", "Δεν υπάρχει ακόμη κείμενο — γράψτε το στο πεδίο αριστερά.", "Δεν έχει επιλεγεί ακόμη εικόνα.", "Δεν υπάρχουν ακόμη εικόνες στη συλλογή.", "Λείπει η ετικέτα ή ο προορισμός του κουμπιού.", "Δεν έχουν επιλεγεί ακόμη καταλύματα.", "Δεν υπάρχουν ακόμη ερωτήσεις — προσθέστε την πρώτη αριστερά.", "Δεν υπάρχει ακόμη διεύθυνση — συμπληρώστε την αριστερά.", "Δεν υπάρχουν ακόμη σχόλια επισκεπτών.", "Δεν υπάρχουν ακόμη στοιχεία.", "Άνοιγμα στο Google Maps", "Εμφάνιση διαδρομής", "Η σελίδα δεν βρέθηκε", "Αυτή η σελίδα δεν υπάρχει ή έχει μετακινηθεί.", "Στην αρχική σελίδα", "Δεν υπάρχουν ακόμη πεδία — προσθέστε το πρώτο αριστερά.", "Αποστολή", "Ευχαριστούμε — το μήνυμα παραλήφθηκε.", "Η αποστολή απέτυχε. Δοκιμάστε ξανά.", "Κλείσιμο", "Κράτηση και πληρωμή", "Αποστολή αιτήματος", "Ο οικοδεσπότης θα επιβεβαιώσει την κράτηση και θα κανονίσει την πληρωμή μαζί σας.", "Το αίτημα στάλθηκε — θα λάβετε σύντομα απάντηση.", "Ιστολόγιο", "Όλα", "Δεν υπάρχουν ακόμη δημοσιεύσεις.", "Δεν υπάρχουν ακόμη δημοσιεύσεις — δημιουργήστε την πρώτη στις «Σελίδες».", "Όλες οι δημοσιεύσεις"],
 "en": ["This website uses cookies so that it works properly.", "Got it", "Cookie policy",
        "I have read and accept the privacy policy.",
        "From", "To", "Guests", "Search", "Language", "Book now", "Search destination", "Adults", "Children", "Infants", "Pets", "night", "Price on request", "No accommodation is available right now.", "Guest favourite", "Check-in", "Check-out", "First name", "Last name", "Email", "Please accept the privacy policy.", "Read it", "No reviews yet — this section appears with the first one.", "No text yet — write it in the field on the left.", "No image chosen yet.", "No images in the gallery yet.", "The button is missing its label or its target.", "No rentals chosen yet.", "No questions yet — add the first one on the left.", "No address yet — enter it on the left.", "No guest quotes yet.", "No items yet.", "Open in Google Maps", "Show route", "Page not found", "This page does not exist or has moved.", "Back to the home page", "No fields yet — add the first one on the left.", "Send", "Thank you — your message has arrived.", "Sending did not work. Please try again.", "Close", "Reserve and pay", "Send enquiry", "The host will confirm the booking and arrange payment with you.", "Enquiry sent — you will hear from us shortly.", "Blog", "All", "No posts yet.", "No posts yet — create the first one under “Pages”.", "All posts"],
 "es": ["Este sitio web utiliza cookies para funcionar correctamente.", "Entendido", "Política de cookies",
        "He leído y acepto la política de privacidad.",
        "Desde", "Hasta", "Huéspedes", "Buscar", "Idioma", "Reservar ahora", "Buscar destino", "Adultos", "Niños", "Bebés", "Mascotas", "noche", "Precio a consultar", "Actualmente no hay alojamientos disponibles.", "Favorito de los huéspedes", "Llegada", "Salida", "Nombre", "Apellido", "Correo electrónico", "Acepte la política de privacidad.", "Leer", "Aún no hay valoraciones — esta sección aparece con la primera.", "Aún no hay texto — escríbalo en el campo de la izquierda.", "Aún no se ha elegido una imagen.", "Aún no hay imágenes en la galería.", "Falta el texto o el destino del botón.", "Aún no se han elegido alojamientos.", "Aún no hay preguntas — añada la primera a la izquierda.", "Aún no hay dirección — introdúzcala a la izquierda.", "Aún no hay opiniones de huéspedes.", "Aún no hay elementos.", "Abrir en Google Maps", "Ver ruta", "Página no encontrada", "Esta página no existe o se ha movido.", "Ir a la página de inicio", "Aún no hay campos — añada el primero a la izquierda.", "Enviar", "Gracias — su mensaje ha llegado.", "El envío no ha funcionado. Inténtelo de nuevo.", "Cerrar", "Reservar y pagar", "Enviar consulta", "El anfitrión confirmará la reserva y acordará el pago con usted.", "Consulta enviada — le responderemos en breve.", "Blog", "Todos", "Aún no hay publicaciones.", "Aún no hay publicaciones — cree la primera en «Páginas».", "Todas las publicaciones"],
 "et": ["See veebisait kasutab küpsiseid, et korralikult töötada.", "Selge", "Küpsiste poliitika",
        "Olen privaatsuspoliitika läbi lugenud ja nõustun sellega.",
        "Alates", "Kuni", "Külalised", "Otsi", "Keel", "Broneeri", "Otsi sihtkohta", "Täiskasvanud", "Lapsed", "Imikud", "Lemmikloomad", "öö", "Hind päringu alusel", "Praegu pole ühtegi majutust saadaval.", "Külaliste lemmik", "Saabumine", "Lahkumine", "Eesnimi", "Perekonnanimi", "E-post", "Palun nõustuge privaatsuspoliitikaga.", "Loe", "Arvustusi pole veel — see osa ilmub esimesega.", "Teksti pole veel — kirjutage see vasakul olevasse välja.", "Pilti pole veel valitud.", "Galeriis pole veel pilte.", "Nupul puudub silt või sihtkoht.", "Objekte pole veel valitud.", "Küsimusi pole veel — lisage esimene vasakul.", "Aadressi pole veel — sisestage see vasakul.", "Külaliste tsitaate pole veel.", "Kirjeid pole veel.", "Ava Google Mapsis", "Näita marsruuti", "Lehte ei leitud", "Seda lehte ei ole või see on teisaldatud.", "Avalehele", "Välju pole veel — lisage esimene vasakul.", "Saada", "Aitäh — teie sõnum on kohale jõudnud.", "Saatmine ei õnnestunud. Palun proovige uuesti.", "Sulge", "Broneeri ja maksa", "Saada päring", "Võõrustaja kinnitab broneeringu ja lepib teiega makse kokku.", "Päring saadetud — võtame teiega peagi ühendust.", "Blogi", "Kõik", "Postitusi pole veel.", "Postitusi pole veel — looge esimene jaotises „Lehed“.", "Kõik postitused"],
 "fi": ["Tämä sivusto käyttää evästeitä toimiakseen oikein.", "Selvä", "Evästekäytäntö",
        "Olen lukenut tietosuojakäytännön ja hyväksyn sen.",
        "Alkaen", "Päättyen", "Vieraat", "Hae", "Kieli", "Varaa nyt", "Etsi kohdetta", "Aikuiset", "Lapset", "Vauvat", "Lemmikit", "yö", "Hinta pyynnöstä", "Tällä hetkellä ei ole vapaita kohteita.", "Vieraiden suosikki", "Saapuminen", "Lähtö", "Etunimi", "Sukunimi", "Sähköposti", "Hyväksy tietosuojakäytäntö.", "Lue", "Ei vielä arvosteluja — tämä osio ilmestyy ensimmäisen myötä.", "Ei vielä tekstiä — kirjoita se vasemmalla olevaan kenttään.", "Kuvaa ei ole vielä valittu.", "Galleriassa ei ole vielä kuvia.", "Painikkeelta puuttuu teksti tai kohde.", "Kohteita ei ole vielä valittu.", "Ei vielä kysymyksiä — lisää ensimmäinen vasemmalta.", "Ei vielä osoitetta — kirjoita se vasemmalle.", "Ei vielä vieraiden kommentteja.", "Ei vielä kohtia.", "Avaa Google Mapsissa", "Näytä reitti", "Sivua ei löytynyt", "Tätä sivua ei ole tai se on siirretty.", "Etusivulle", "Ei vielä kenttiä — lisää ensimmäinen vasemmalta.", "Lähetä", "Kiitos — viestisi on saapunut.", "Lähetys ei onnistunut. Yritä uudelleen.", "Sulje", "Varaa ja maksa", "Lähetä kysely", "Isäntä vahvistaa varauksen ja sopii maksusta kanssasi.", "Kysely lähetetty — otamme sinuun pian yhteyttä.", "Blogi", "Kaikki", "Ei vielä julkaisuja.", "Ei vielä julkaisuja — luo ensimmäinen kohdassa ”Sivut”.", "Kaikki julkaisut"],
 "fr": ["Ce site utilise des cookies pour fonctionner correctement.", "Compris", "Politique de cookies",
        "J'ai lu et j'accepte la politique de confidentialité.",
        "Du", "Au", "Voyageurs", "Rechercher", "Langue", "Réserver", "Rechercher une destination", "Adultes", "Enfants", "Bébés", "Animaux", "nuit", "Prix sur demande", "Aucun logement n'est disponible actuellement.", "Coup de cœur", "Arrivée", "Départ", "Prénom", "Nom", "E-mail", "Veuillez accepter la politique de confidentialité.", "Consulter", "Pas encore d'avis — cette section apparaît avec le premier.", "Pas encore de texte — saisissez-le dans le champ à gauche.", "Aucune image choisie pour l'instant.", "Aucune image dans la galerie pour l'instant.", "Le libellé ou la cible du bouton manque.", "Aucun logement choisi pour l'instant.", "Pas encore de questions — ajoutez la première à gauche.", "Pas encore d'adresse — saisissez-la à gauche.", "Pas encore de témoignages.", "Pas encore d'éléments.", "Ouvrir dans Google Maps", "Afficher l'itinéraire", "Page introuvable", "Cette page n'existe pas ou a été déplacée.", "Retour à l'accueil", "Pas encore de champs — ajoutez le premier à gauche.", "Envoyer", "Merci — votre message est bien arrivé.", "L'envoi n'a pas fonctionné. Veuillez réessayer.", "Fermer", "Réserver et payer", "Envoyer une demande", "L'hôte confirmera la réservation et conviendra du paiement avec vous.", "Demande envoyée — vous aurez bientôt de nos nouvelles.", "Blog", "Tous", "Pas encore d'articles.", "Pas encore d'articles — créez le premier dans « Pages ».", "Tous les articles"],
 "ga": ["Úsáideann an suíomh seo fianáin chun oibriú i gceart.", "Tuigim", "Polasaí fianán",
        "Léigh mé an polasaí príobháideachais agus glacaim leis.",
        "Ó", "Go", "Aíonna", "Cuardaigh", "Teanga", "Cuir in áirithe", "Cuardaigh ceann scríbe", "Daoine fásta", "Leanaí", "Naíonáin", "Peataí", "oíche", "Praghas ar iarratas", "Níl aon lóistín ar fáil faoi láthair.", "Rogha na n-aíonna", "Teacht", "Imeacht", "Ainm", "Sloinne", "R-phost", "Glac le polasaí príobháideachais, le do thoil.", "Léigh", "Gan léirmheasanna go fóill — feicfear an chuid seo leis an gcéad cheann.", "Gan téacs go fóill — scríobh é sa réimse ar chlé.", "Níl íomhá roghnaithe go fóill.", "Níl aon íomhá sa ghailearaí go fóill.", "Tá lipéad nó sprioc an chnaipe ar iarraidh.", "Níl aon réadmhaoin roghnaithe go fóill.", "Níl aon cheist ann go fóill — cuir an chéad cheann leis ar chlé.", "Níl seoladh ann go fóill — cuir isteach ar chlé é.", "Níl aon sleachta ó aíonna go fóill.", "Níl aon mhír ann go fóill.", "Oscail i Google Maps", "Taispeáin an bealach", "Leathanach gan aimsiú", "Níl an leathanach seo ann nó bogadh é.", "Ar ais go dtí an leathanach baile", "Níl aon réimse ann go fóill — cuir an chéad cheann leis ar chlé.", "Seol", "Go raibh maith agat — tháinig do theachtaireacht.", "Níor éirigh leis an seoladh. Bain triail eile as.", "Dún", "Cuir in áirithe agus íoc", "Seol fiosrúchán", "Deimhneoidh an t-óstach an áirithint agus socróidh sé an íocaíocht leat.", "Fiosrúchán seolta — cloisfidh tú uainn go luath.", "Blag", "Uile", "Níl aon phostáil ann go fóill.", "Níl aon phostáil ann go fóill — cruthaigh an chéad cheann faoi “Leathanaigh”.", "Gach postáil"],
 "hr": ["Ova web-stranica koristi kolačiće kako bi ispravno radila.", "Razumijem", "Pravila o kolačićima",
        "Pročitao/la sam pravila o zaštiti podataka i prihvaćam ih.",
        "Od", "Do", "Gosti", "Traži", "Jezik", "Rezerviraj", "Traži destinaciju", "Odrasli", "Djeca", "Bebe", "Kućni ljubimci", "noć", "Cijena na upit", "Trenutačno nema dostupnih objekata.", "Favorit gostiju", "Prijava", "Odjava", "Ime", "Prezime", "E-pošta", "Molimo prihvatite pravila o zaštiti podataka.", "Pročitaj", "Još nema ocjena — ovaj se odjeljak pojavljuje s prvom.", "Još nema teksta — upišite ga u polje lijevo.", "Slika još nije odabrana.", "U galeriji još nema slika.", "Nedostaje natpis ili cilj tipke.", "Objekti još nisu odabrani.", "Još nema pitanja — dodajte prvo s lijeve strane.", "Adrese još nema — unesite je s lijeve strane.", "Još nema izjava gostiju.", "Još nema unosa.", "Otvori u Google Mapsu", "Prikaži rutu", "Stranica nije pronađena", "Ova stranica ne postoji ili je premještena.", "Na početnu stranicu", "Još nema polja — dodajte prvo s lijeve strane.", "Pošalji", "Hvala — vaša poruka je pristigla.", "Slanje nije uspjelo. Pokušajte ponovno.", "Zatvori", "Rezerviraj i plati", "Pošalji upit", "Domaćin će potvrditi rezervaciju i dogovoriti plaćanje s vama.", "Upit je poslan — javit ćemo vam se uskoro.", "Blog", "Sve", "Još nema objava.", "Još nema objava — prvu izradite u odjeljku „Stranice“.", "Sve objave"],
 "hu": ["Ez a weboldal sütiket használ a helyes működéshez.", "Értem", "Sütiszabályzat",
        "Elolvastam és elfogadom az adatvédelmi szabályzatot.",
        "Ettől", "Eddig", "Vendégek", "Keresés", "Nyelv", "Foglalás", "Úti cél keresése", "Felnőttek", "Gyermekek", "Csecsemők", "Házi kedvencek", "éjszaka", "Ár kérésre", "Jelenleg nincs elérhető szállás.", "Vendégek kedvence", "Érkezés", "Távozás", "Utónév", "Családnév", "E-mail", "Kérjük, fogadja el az adatvédelmi szabályzatot.", "Elolvasom", "Még nincsenek értékelések — ez a szakasz az elsővel jelenik meg.", "Még nincs szöveg — írja be a bal oldali mezőbe.", "Még nincs kép kiválasztva.", "Még nincsenek képek a galériában.", "A gomb feliratja vagy célja hiányzik.", "Még nincsenek szálláshelyek kiválasztva.", "Még nincsenek kérdések — az elsőt bal oldalon adja meg.", "Még nincs cím — adja meg bal oldalon.", "Még nincsenek vendégvélemények.", "Még nincsenek elemek.", "Megnyitás a Google Mapsben", "Útvonal megjelenítése", "A lap nem található", "Ez a lap nem létezik, vagy áthelyezték.", "A kezdőlapra", "Még nincsenek mezők — az elsőt bal oldalon adja meg.", "Küldés", "Köszönjük — üzenete megérkezett.", "A küldés nem sikerült. Kérjük, próbálja újra.", "Bezárás", "Foglalás és fizetés", "Érdeklődés küldése", "A házigazda visszaigazolja a foglalást, és egyeztet Önnel a fizetésről.", "Az érdeklődést elküldtük — hamarosan jelentkezünk.", "Blog", "Összes", "Még nincsenek bejegyzések.", "Még nincsenek bejegyzések — az elsőt a „Lapok” alatt hozza létre.", "Összes bejegyzés"],
 "it": ["Questo sito utilizza i cookie per funzionare correttamente.", "Ho capito", "Informativa sui cookie",
        "Ho letto e accetto l'informativa sulla privacy.",
        "Dal", "Al", "Ospiti", "Cerca", "Lingua", "Prenota ora", "Cerca destinazione", "Adulti", "Bambini", "Neonati", "Animali", "notte", "Prezzo su richiesta", "Al momento non ci sono alloggi disponibili.", "Preferito dagli ospiti", "Arrivo", "Partenza", "Nome", "Cognome", "E-mail", "Accetta l'informativa sulla privacy.", "Leggi", "Ancora nessuna recensione — questa sezione appare con la prima.", "Ancora nessun testo — scrivilo nel campo a sinistra.", "Nessuna immagine scelta.", "Nessuna immagine nella galleria.", "Manca l'etichetta o la destinazione del pulsante.", "Nessun alloggio scelto.", "Nessuna domanda ancora — aggiunga la prima a sinistra.", "Nessun indirizzo ancora — lo inserisca a sinistra.", "Nessuna testimonianza ancora.", "Nessuna voce ancora.", "Apri in Google Maps", "Mostra il percorso", "Pagina non trovata", "Questa pagina non esiste o è stata spostata.", "Vai alla pagina iniziale", "Nessun campo ancora — aggiunga il primo a sinistra.", "Invia", "Grazie — il suo messaggio è arrivato.", "L'invio non è riuscito. Riprovi.", "Chiudi", "Prenota e paga", "Invia richiesta", "L'host confermerà la prenotazione e concorderà il pagamento con Lei.", "Richiesta inviata — le risponderemo a breve.", "Blog", "Tutti", "Nessun articolo ancora.", "Nessun articolo ancora — crei il primo in «Pagine».", "Tutti gli articoli"],
 "lt": ["Ši svetainė naudoja slapukus, kad tinkamai veiktų.", "Supratau", "Slapukų politika",
        "Perskaičiau privatumo politiką ir su ja sutinku.",
        "Nuo", "Iki", "Svečiai", "Ieškoti", "Kalba", "Rezervuoti", "Ieškoti krypties", "Suaugusieji", "Vaikai", "Kūdikiai", "Gyvūnai", "naktis", "Kaina pagal užklausą", "Šiuo metu nėra laisvų apgyvendinimo vietų.", "Svečių pasirinkimas", "Atvykimas", "Išvykimas", "Vardas", "Pavardė", "El. paštas", "Prašome priimti privatumo politiką.", "Skaityti", "Atsiliepimų dar nėra — šis skyrius pasirodys su pirmuoju.", "Teksto dar nėra — įrašykite jį lauke kairėje.", "Vaizdas dar nepasirinktas.", "Galerijoje dar nėra vaizdų.", "Mygtukui trūksta užrašo arba tikslo.", "Objektai dar nepasirinkti.", "Klausimų dar nėra — pirmąjį įrašykite kairėje.", "Adreso dar nėra — įrašykite jį kairėje.", "Svečių atsiliepimų dar nėra.", "Įrašų dar nėra.", "Atidaryti Google Maps", "Rodyti maršrutą", "Puslapis nerastas", "Šio puslapio nėra arba jis perkeltas.", "Į pradinį puslapį", "Laukų dar nėra — pirmąjį įrašykite kairėje.", "Siųsti", "Dėkojame — jūsų pranešimas gautas.", "Išsiųsti nepavyko. Pabandykite dar kartą.", "Uždaryti", "Rezervuoti ir mokėti", "Siųsti užklausą", "Šeimininkas patvirtins rezervaciją ir su jumis suderins mokėjimą.", "Užklausa išsiųsta — netrukus susisieksime.", "Tinklaraštis", "Visi", "Įrašų dar nėra.", "Įrašų dar nėra — pirmąjį sukurkite skiltyje „Puslapiai“.", "Visi įrašai"],
 "lv": ["Šī vietne izmanto sīkfailus, lai darbotos pareizi.", "Sapratu", "Sīkfailu politika",
        "Esmu izlasījis privātuma politiku un to pieņemu.",
        "No", "Līdz", "Viesi", "Meklēt", "Valoda", "Rezervēt", "Meklēt galamērķi", "Pieaugušie", "Bērni", "Zīdaiņi", "Mājdzīvnieki", "nakts", "Cena pēc pieprasījuma", "Šobrīd nav pieejamu naktsmītņu.", "Viesu favorīts", "Ierašanās", "Izbraukšana", "Vārds", "Uzvārds", "E-pasts", "Lūdzu, pieņemiet privātuma politiku.", "Lasīt", "Vēl nav atsauksmju — šī sadaļa parādās ar pirmo.", "Vēl nav teksta — ierakstiet to laukā pa kreisi.", "Attēls vēl nav izvēlēts.", "Galerijā vēl nav attēlu.", "Pogai trūkst uzraksta vai mērķa.", "Naktsmītnes vēl nav izvēlētas.", "Vēl nav jautājumu — pievienojiet pirmo kreisajā pusē.", "Adreses vēl nav — ievadiet to kreisajā pusē.", "Viesu atsauksmju vēl nav.", "Ierakstu vēl nav.", "Atvērt Google Maps", "Rādīt maršrutu", "Lapa nav atrasta", "Šīs lapas nav vai tā ir pārvietota.", "Uz sākumlapu", "Lauku vēl nav — pievienojiet pirmo kreisajā pusē.", "Sūtīt", "Paldies — jūsu ziņa ir saņemta.", "Nosūtīšana neizdevās. Lūdzu, mēģiniet vēlreiz.", "Aizvērt", "Rezervēt un maksāt", "Nosūtīt pieprasījumu", "Saimnieks apstiprinās rezervāciju un vienosies ar jums par maksājumu.", "Pieprasījums nosūtīts — drīz sazināsimies.", "Emuārs", "Visi", "Ierakstu vēl nav.", "Ierakstu vēl nav — izveidojiet pirmo sadaļā „Lapas”.", "Visi ieraksti"],
 "mt": ["Dan is-sit juża cookies biex jaħdem sew.", "Fhimt", "Politika tal-cookies",
        "Qrajt u naċċetta l-politika tal-privatezza.",
        "Minn", "Sa", "Mistednin", "Fittex", "Lingwa", "Ibbukkja", "Fittex destinazzjoni", "Adulti", "Tfal", "Trabi", "Annimali", "lejl", "Prezz fuq talba", "Bħalissa ma hemmx akkomodazzjoni disponibbli.", "Favorit tal-mistednin", "Wasla", "Tluq", "Isem", "Kunjom", "Email", "Jekk jogħġbok aċċetta l-politika tal-privatezza.", "Aqra", "Għadu ma hemmx reviżjonijiet — din is-sezzjoni tidher bl-ewwel waħda.", "Għadu ma hemmx test — iktbu fil-kaxxa fuq il-lemin.", "Għadha ma ntgħażlet ebda stampa.", "Għadu ma hemmx stampi fil-gallerija.", "Nieqes it-tikketta jew id-destinazzjoni tal-buttuna.", "Għadhom ma ntgħażlux proprjetajiet.", "L-ebda mistoqsija għadha — żid l-ewwel waħda fuq ix-xellug.", "L-ebda indirizz għadu — daħħlu fuq ix-xellug.", "L-ebda kummenti tal-mistednin għadhom.", "L-ebda entrata għadha.", "Iftaħ f'Google Maps", "Uri r-rotta", "Il-paġna ma nstabitx", "Din il-paġna ma teżistix jew inbidlet.", "Lura għall-paġna prinċipali", "L-ebda kamp għadu — żid l-ewwel wieħed fuq ix-xellug.", "Ibgħat", "Grazzi — il-messaġġ tiegħek wasal.", "Il-bgħit ma rnexxiex. Jekk jogħġbok erġa' pprova.", "Agħlaq", "Irriżerva u ħallas", "Ibgħat mistoqsija", "Il-host jikkonferma l-prenotazzjoni u jaqbel il-ħlas miegħek.", "Il-mistoqsija ntbagħtet — nikkuntattjawk dalwaqt.", "Blog", "Kollha", "L-ebda artiklu għadu.", "L-ebda artiklu għadu — oħloq l-ewwel wieħed taħt “Paġni”.", "L-artikli kollha"],
 "nl": ["Deze website gebruikt cookies om goed te werken.", "Begrepen", "Cookiebeleid",
        "Ik heb het privacybeleid gelezen en accepteer het.",
        "Van", "Tot", "Gasten", "Zoeken", "Taal", "Nu boeken", "Bestemming zoeken", "Volwassenen", "Kinderen", "Baby's", "Huisdieren", "nacht", "Prijs op aanvraag", "Er zijn momenteel geen accommodaties beschikbaar.", "Favoriet van gasten", "Aankomst", "Vertrek", "Voornaam", "Achternaam", "E-mail", "Accepteer het privacybeleid.", "Lezen", "Nog geen beoordelingen — deze sectie verschijnt met de eerste.", "Nog geen tekst — schrijf hem in het veld links.", "Nog geen afbeelding gekozen.", "Nog geen afbeeldingen in de galerie.", "De knop mist zijn tekst of zijn doel.", "Nog geen accommodaties gekozen.", "Nog geen vragen — voeg de eerste links toe.", "Nog geen adres — vul het links in.", "Nog geen gastenreacties.", "Nog geen items.", "Openen in Google Maps", "Route weergeven", "Pagina niet gevonden", "Deze pagina bestaat niet of is verplaatst.", "Naar de startpagina", "Nog geen velden — voeg het eerste links toe.", "Verzenden", "Bedankt — uw bericht is aangekomen.", "Het verzenden is niet gelukt. Probeer het opnieuw.", "Sluiten", "Reserveren en betalen", "Aanvraag versturen", "De gastheer bevestigt de boeking en stemt de betaling met u af.", "Aanvraag verstuurd — u hoort spoedig van ons.", "Blog", "Alle", "Nog geen berichten.", "Nog geen berichten — maak het eerste aan onder „Pagina's”.", "Alle berichten"],
 "pl": ["Ta strona używa plików cookie, aby działać poprawnie.", "Rozumiem", "Polityka cookies",
        "Przeczytałem/am politykę prywatności i ją akceptuję.",
        "Od", "Do", "Goście", "Szukaj", "Język", "Zarezerwuj", "Szukaj miejsca", "Dorośli", "Dzieci", "Niemowlęta", "Zwierzęta", "noc", "Cena na zapytanie", "Obecnie brak dostępnych obiektów.", "Ulubione przez gości", "Przyjazd", "Wyjazd", "Imię", "Nazwisko", "E-mail", "Prosimy zaakceptować politykę prywatności.", "Przeczytaj", "Jeszcze brak opinii — ta sekcja pojawi się z pierwszą.", "Jeszcze brak tekstu — wpisz go w polu po lewej.", "Jeszcze nie wybrano obrazu.", "W galerii nie ma jeszcze obrazów.", "Brakuje napisu lub celu przycisku.", "Jeszcze nie wybrano obiektów.", "Jeszcze brak pytań — pierwsze dodaj po lewej.", "Jeszcze brak adresu — wpisz go po lewej.", "Jeszcze brak opinii gości.", "Jeszcze brak pozycji.", "Otwórz w Google Maps", "Pokaż trasę", "Nie znaleziono strony", "Ta strona nie istnieje lub została przeniesiona.", "Na stronę główną", "Jeszcze brak pól — pierwsze dodaj po lewej.", "Wyślij", "Dziękujemy — wiadomość dotarła.", "Wysyłanie nie powiodło się. Spróbuj ponownie.", "Zamknij", "Rezerwuj i zapłać", "Wyślij zapytanie", "Gospodarz potwierdzi rezerwację i ustali z Tobą płatność.", "Zapytanie wysłane — wkrótce się odezwiemy.", "Blog", "Wszystkie", "Jeszcze brak wpisów.", "Jeszcze brak wpisów — pierwszy utwórz w sekcji „Strony”.", "Wszystkie wpisy"],
 "pt": ["Este site utiliza cookies para funcionar corretamente.", "Entendi", "Política de cookies",
        "Li e aceito a política de privacidade.",
        "De", "Até", "Hóspedes", "Pesquisar", "Idioma", "Reservar agora", "Pesquisar destino", "Adultos", "Crianças", "Bebés", "Animais", "noite", "Preço sob consulta", "Atualmente não há alojamentos disponíveis.", "Favorito dos hóspedes", "Chegada", "Partida", "Nome", "Sobrenome", "E-mail", "Aceite a política de privacidade.", "Ler", "Ainda sem avaliações — esta secção aparece com a primeira.", "Ainda sem texto — escreva-o no campo à esquerda.", "Ainda sem imagem escolhida.", "Ainda sem imagens na galeria.", "Falta o texto ou o destino do botão.", "Ainda sem alojamentos escolhidos.", "Ainda não há perguntas — adicione a primeira à esquerda.", "Ainda não há endereço — introduza-o à esquerda.", "Ainda não há testemunhos.", "Ainda não há elementos.", "Abrir no Google Maps", "Ver rota", "Página não encontrada", "Esta página não existe ou foi movida.", "Ir para a página inicial", "Ainda não há campos — adicione o primeiro à esquerda.", "Enviar", "Obrigado — a sua mensagem chegou.", "O envio não funcionou. Tente novamente.", "Fechar", "Reservar e pagar", "Enviar pedido", "O anfitrião confirmará a reserva e combinará o pagamento consigo.", "Pedido enviado — entraremos em contacto em breve.", "Blogue", "Todos", "Ainda não há publicações.", "Ainda não há publicações — crie a primeira em «Páginas».", "Todas as publicações"],
 "ro": ["Acest site folosește cookie-uri pentru a funcționa corect.", "Am înțeles", "Politica de cookie-uri",
        "Am citit și accept politica de confidențialitate.",
        "De la", "Până la", "Oaspeți", "Caută", "Limbă", "Rezervă acum", "Caută destinația", "Adulți", "Copii", "Bebeluși", "Animale", "noapte", "Preț la cerere", "În acest moment nu există cazări disponibile.", "Preferatul oaspeților", "Sosire", "Plecare", "Prenume", "Nume", "E-mail", "Vă rugăm să acceptați politica de confidențialitate.", "Citește", "Încă nu există recenzii — această secțiune apare cu prima.", "Încă nu există text — scrieți-l în câmpul din stânga.", "Încă nu a fost aleasă o imagine.", "Încă nu există imagini în galerie.", "Lipsește textul sau ținta butonului.", "Încă nu au fost alese proprietăți.", "Încă nu există întrebări — adăugați prima în stânga.", "Încă nu există adresă — introduceți-o în stânga.", "Încă nu există păreri ale oaspeților.", "Încă nu există elemente.", "Deschide în Google Maps", "Afișează ruta", "Pagina nu a fost găsită", "Această pagină nu există sau a fost mutată.", "Către pagina principală", "Încă nu există câmpuri — adăugați primul în stânga.", "Trimite", "Vă mulțumim — mesajul a ajuns.", "Trimiterea nu a reușit. Încercați din nou.", "Închide", "Rezervă și plătește", "Trimite o cerere", "Gazda va confirma rezervarea și va stabili plata cu dumneavoastră.", "Cererea a fost trimisă — veți primi un răspuns în curând.", "Blog", "Toate", "Încă nu există articole.", "Încă nu există articole — creați primul la „Pagini”.", "Toate articolele"],
 "sk": ["Táto webová stránka používa cookies, aby fungovala správne.", "Rozumiem", "Zásady cookies",
        "Prečítal(a) som si zásady ochrany osobných údajov a prijímam ich.",
        "Od", "Do", "Hostia", "Hľadať", "Jazyk", "Rezervovať", "Hľadať destináciu", "Dospelí", "Deti", "Dojčatá", "Domáce zvieratá", "noc", "Cena na vyžiadanie", "Momentálne nie sú dostupné žiadne ubytovania.", "Obľúbené u hostí", "Príchod", "Odchod", "Meno", "Priezvisko", "E-mail", "Prijmite prosím zásady ochrany osobných údajov.", "Prečítať", "Zatiaľ žiadne hodnotenia — tento úsek sa zobrazí s prvým.", "Zatiaľ žiadny text — napíšte ho do poľa vľavo.", "Obrázok zatiaľ nie je vybraný.", "V galérii zatiaľ nie sú žiadne obrázky.", "Chýba popis alebo cieľ tlačidla.", "Objekty zatiaľ nie sú vybrané.", "Zatiaľ žiadne otázky — prvú pridajte vľavo.", "Zatiaľ žiadna adresa — zadajte ju vľavo.", "Zatiaľ žiadne ohlasy hostí.", "Zatiaľ žiadne položky.", "Otvoriť v Google Maps", "Zobraziť trasu", "Stránka sa nenašla", "Táto stránka neexistuje alebo bola presunutá.", "Na úvodnú stránku", "Zatiaľ žiadne polia — prvé pridajte vľavo.", "Odoslať", "Ďakujeme — správa dorazila.", "Odoslanie sa nepodarilo. Skúste to znova.", "Zavrieť", "Rezervovať a zaplatiť", "Odoslať dopyt", "Ubytovateľ potvrdí rezerváciu a dohodne s vami platbu.", "Dopyt odoslaný — čoskoro sa vám ozveme.", "Blog", "Všetko", "Zatiaľ žiadne príspevky.", "Zatiaľ žiadne príspevky — prvý vytvorte v časti „Stránky“.", "Všetky príspevky"],
 "sl": ["Ta spletna stran uporablja piškotke, da deluje pravilno.", "Razumem", "Politika piškotkov",
        "Prebral(a) sem politiko zasebnosti in jo sprejemam.",
        "Od", "Do", "Gostje", "Iskanje", "Jezik", "Rezerviraj", "Iskanje destinacije", "Odrasli", "Otroci", "Dojenčki", "Hišni ljubljenčki", "noč", "Cena na povpraševanje", "Trenutno ni razpoložljivih nastanitev.", "Priljubljeno med gosti", "Prihod", "Odhod", "Ime", "Priimek", "E-pošta", "Prosimo, sprejmite politiko zasebnosti.", "Preberi", "Ocen še ni — ta odsek se pojavi s prvo.", "Besedila še ni — vpišite ga v polje na levi.", "Slika še ni izbrana.", "V galeriji še ni slik.", "Manjka napis ali cilj gumba.", "Objekti še niso izbrani.", "Vprašanj še ni — prvo dodajte na levi.", "Naslova še ni — vnesite ga na levi.", "Mnenj gostov še ni.", "Vnosov še ni.", "Odpri v Google Mapsu", "Prikaži pot", "Strani ni mogoče najti", "Ta stran ne obstaja ali je bila premaknjena.", "Na začetno stran", "Polj še ni — prvo dodajte na levi.", "Pošlji", "Hvala — vaše sporočilo je prispelo.", "Pošiljanje ni uspelo. Poskusite znova.", "Zapri", "Rezerviraj in plačaj", "Pošlji povpraševanje", "Gostitelj bo potrdil rezervacijo in se z vami dogovoril o plačilu.", "Povpraševanje poslano — kmalu se vam oglasimo.", "Blog", "Vse", "Objav še ni.", "Objav še ni — prvo ustvarite v razdelku „Strani“.", "Vse objave"],
 "sv": ["Den här webbplatsen använder cookies för att fungera korrekt.", "Jag förstår", "Cookiepolicy",
        "Jag har läst och godkänner integritetspolicyn.",
        "Från", "Till", "Gäster", "Sök", "Språk", "Boka nu", "Sök destination", "Vuxna", "Barn", "Spädbarn", "Husdjur", "natt", "Pris på förfrågan", "Det finns inga boenden tillgängliga just nu.", "Gästernas favorit", "Ankomst", "Avresa", "Förnamn", "Efternamn", "E-post", "Godkänn integritetspolicyn.", "Läs", "Inga omdömen ännu — det här avsnittet visas med det första.", "Ingen text ännu — skriv den i fältet till vänster.", "Ingen bild vald ännu.", "Inga bilder i galleriet ännu.", "Knappen saknar text eller mål.", "Inga boenden valda ännu.", "Inga frågor än — lägg till den första till vänster.", "Ingen adress än — skriv den till vänster.", "Inga gästomdömen än.", "Inga poster än.", "Öppna i Google Maps", "Visa vägen", "Sidan hittades inte", "Den här sidan finns inte eller har flyttats.", "Till startsidan", "Inga fält än — lägg till det första till vänster.", "Skicka", "Tack — ditt meddelande har kommit fram.", "Det gick inte att skicka. Försök igen.", "Stäng", "Boka och betala", "Skicka förfrågan", "Värden bekräftar bokningen och kommer överens om betalningen med dig.", "Förfrågan skickad — du hör från oss snart.", "Blogg", "Alla", "Inga inlägg än.", "Inga inlägg än — skapa det första under ”Sidor”.", "Alla inlägg"],
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
 "leerBewertungen": "Platzhalter im Entwurf: Bewertungs-Abschnitt ohne Bewertungen.",
 "leerText": "Platzhalter im Entwurf: Text-Abschnitt ohne Text.",
 "leerBild": "Platzhalter im Entwurf: Bild-Abschnitt ohne Bild.",
 "leerGalerie": "Platzhalter im Entwurf: Galerie ohne Bilder.",
 "leerButton": "Platzhalter im Entwurf: Button ohne Beschriftung oder Ziel.",
 "leerObjekte": "Platzhalter im Entwurf: Objekt-Auswahl ohne gewaehlte Objekte.",
 "leerFaq": "Platzhalter im Entwurf: Frage-Antwort-Abschnitt ohne Fragen.",
 "leerKarte": "Platzhalter im Entwurf: Karte ohne Adresse.",
 "leerStimmen": "Platzhalter im Entwurf: Gaestestimmen ohne Zitate.",
 "leerMerkmale": "Platzhalter im Entwurf: Merkmale ohne Eintraege.",
 "karteOeffnen": "Link auf Google Maps, wenn keine Karte angezeigt wird.",
 "karteRoute": "Link auf Google Maps fuer die Route, unter der Karte.",
 "nichtGefunden": "Ueberschrift der eingebauten 404-Seite.",
 "nichtGefundenHinweis": "Erklaerung auf der eingebauten 404-Seite.",
 "zurStartseite": "Knopf auf der 404-Seite.",
 "leerFormular": "Platzhalter im Entwurf: Formular ohne Felder.",
 "formularSenden": "Standard-Beschriftung des Absende-Knopfs.",
 "formularDanke": "Bestaetigung nach dem Absenden, wenn der Betrieb keine eigene gesetzt hat.",
 "formularFehler": "Meldung, wenn das Absenden fehlschlaegt.",
 "popupSchliessen": "Beschriftung des Schliessen-Knopfs am Pop-up.",
 "reservierenBezahlen": "Knopf im Buchungs-Widget, wenn online bezahlt werden kann.",
 "anfrageSenden": "Knopf im Buchungs-Widget, wenn der Betrieb (noch) keine Zahlung annimmt.",
 "anfrageHinweis": "Erklaerung unter dem Anfrage-Knopf.",
 "anfrageGesendet": "Bestaetigung, nachdem die Anfrage abgeschickt wurde.",
 "blogTitel": "Ueberschrift der Blog-Uebersicht.",
 "blogAlle": "Filter-Knopf: alle Schlagwoerter.",
 "blogLeer": "Hinweis, wenn es noch keine Beitraege gibt.",
 "leerBeitraege": "Platzhalter im Entwurf: Beitrags-Abschnitt ohne Beitraege.",
 "blogAlleAnsehen": "Link vom Beitrags-Abschnitt zur Blog-Uebersicht.",
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
