"""Der Textkatalog aller ausgehenden E-Mails — 24 EU-Amtssprachen.

WARUM EIN EIGENER KATALOG UND NICHT `web/messages/*.json`:
Die Frontend-Kataloge sind Oberflächentexte mit eigenem Lebenszyklus: sie
ändern sich, wenn ein Button umbenannt wird, und sie werden von `next-intl`
zur Bauzeit gebündelt. Mailtexte ändern sich, wenn sich ein RECHTLICHER oder
fachlicher Ablauf ändert (Gültigkeitsdauer eines Links, Absenderpflicht). Ein
gemeinsamer Katalog hieße, dass ein Frontend-Refactoring einen Mailtext
mitzieht, ohne dass es jemand merkt — und dass das Backend zur Laufzeit Dateien
aus einem Frontend-Verzeichnis lesen müsste, das in seinem Container gar nicht
liegt (`apps/api` wird getrennt gebaut und deployt).

WARUM PYTHON-DICTS UND NICHT JSON/gettext:
Der Bestand macht es bereits zweimal so (`buchhaltung/doc_i18n.py`,
`newsletter/service.py:_MAILTEXTE`) — ein drittes Format wäre die dritte
Wartungsregel. gettext/Babel bräuchte zusätzlich einen Kompilierschritt
(`.po` → `.mo`) und ein Binärartefakt im Repo; es gibt in diesem Projekt keine
Build-Stufe, die das ausführen würde, und `babel` ist bewusst keine Dependency.
Ein Dict ist von `pytest` prüfbar (siehe `test_mail_texte.py`), von `ruff`
formatierbar und für Übersetzer ohne Python-Kenntnis lesbar: eine Zeile pro
Sprache, Text in Anführungszeichen.

AUFBAU: `TEXTE[schluessel][sprache]` → Text. Jeder Schlüssel MUSS in allen 24
Sprachen stehen; `test_mail_texte.py` bricht sonst. Das ist die Mail-Variante
des `MISSING_MESSAGE`-Schutzes im Frontend: ein fehlender Schlüssel darf nicht
als leerer Betreff beim Kunden ankommen.

PLATZHALTER stehen in geschweiften Klammern (`{name}`, `{objekt}`) und werden
über `text()` per `str.format` gefüllt. Sie müssen in JEDER Übersetzung
vorkommen — auch das prüft der Test, denn ein in der Übersetzung vergessenes
`{link}` ergäbe eine Mail ohne Link.
"""
# pylint: disable=too-many-lines  # 24 Sprachen je Schlüssel — die Länge ist
# Übersetzungsmenge, nicht Logik. Ein Aufteilen nach Zeilenzahl würde die 24
# Fassungen EINES Satzes über mehrere Dateien verstreuen und genau das
# kaputtmachen, was `test_mail_texte` schützt: dass ein Schlüssel vollständig
# ist. Wächst der Katalog weiter, wird nach FACHGEBIET geteilt (auth/, portal/),
# nie nach Zeilen.
from __future__ import annotations

from src.core.mail_sprache import FALLBACK, SUPPORTED


class MailTextFehlt(Exception):
    """Ein Mailtext ist im Katalog nicht hinterlegt.

    Fail-closed (Wurzel 5): lieber ein Fehler im Log und eine nicht versendete
    Mail als eine Mail mit leerem Betreff oder dem rohen Schlüssel
    („auth.einladung.betreff") im Postfach des Kunden. Der Test hält den
    Katalog vollständig, sodass dieser Fehler im Betrieb nicht auftreten kann —
    er ist der Backstop für den Fall, dass jemand den Test umgeht.
    """


# ---------------------------------------------------------------------------
# Gemeinsame Bausteine des Layouts (Gruß, Absenderzeile, Fußzeilen-Wörter).
# Sie standen bisher hart deutsch in `mail_layout.py` — eine dänische Mail
# hatte dadurch einen deutschen Gruß und eine deutsche Fußzeile.
# ---------------------------------------------------------------------------

TEXTE: dict[str, dict[str, str]] = {
    # -- Layout-Rahmen ------------------------------------------------------
    "layout.gruss": {
        "bg": "С поздрав",
        "cs": "S pozdravem",
        "da": "Venlig hilsen",
        "de": "Viele Grüße",
        "el": "Με εκτίμηση",
        "en": "Kind regards",
        "es": "Un cordial saludo",
        "et": "Parimate soovidega",
        "fi": "Ystävällisin terveisin",
        "fr": "Cordialement",
        "ga": "Le dea-mhéin",
        "hr": "Srdačan pozdrav",
        "hu": "Üdvözlettel",
        "it": "Cordiali saluti",
        "lt": "Pagarbiai",
        "lv": "Ar cieņu",
        "mt": "Dejjem tiegħek",
        "nl": "Met vriendelijke groet",
        "pl": "Z pozdrowieniami",
        "pt": "Com os melhores cumprimentos",
        "ro": "Cu stimă",
        "sk": "S pozdravom",
        "sl": "Lep pozdrav",
        "sv": "Med vänliga hälsningar",
    },
    "layout.absender": {
        "bg": "Вашият екип на {marke}",
        "cs": "Váš tým {marke}",
        "da": "Dit {marke}-team",
        "de": "Dein {marke}-Team",
        "el": "Η ομάδα σας {marke}",
        "en": "Your {marke} team",
        "es": "Tu equipo de {marke}",
        "et": "Sinu {marke} meeskond",
        "fi": "{marke}-tiimisi",
        "fr": "Votre équipe {marke}",
        "ga": "D'fhoireann {marke}",
        "hr": "Vaš {marke} tim",
        "hu": "A {marke} csapatod",
        "it": "Il tuo team {marke}",
        "lt": "Jūsų {marke} komanda",
        "lv": "Jūsu {marke} komanda",
        "mt": "It-tim tiegħek ta' {marke}",
        "nl": "Je {marke}-team",
        "pl": "Twój zespół {marke}",
        "pt": "A tua equipa {marke}",
        "ro": "Echipa ta {marke}",
        "sk": "Váš tím {marke}",
        "sl": "Vaša ekipa {marke}",
        "sv": "Ditt {marke}-team",
    },
    "layout.button_hinweis": {
        "bg": "Ако бутонът не работи:",
        "cs": "Pokud tlačítko nefunguje:",
        "da": "Hvis knappen ikke virker:",
        "de": "Falls der Button nicht funktioniert:",
        "el": "Αν το κουμπί δεν λειτουργεί:",
        "en": "If the button does not work:",
        "es": "Si el botón no funciona:",
        "et": "Kui nupp ei tööta:",
        "fi": "Jos painike ei toimi:",
        "fr": "Si le bouton ne fonctionne pas :",
        "ga": "Mura n-oibríonn an cnaipe:",
        "hr": "Ako gumb ne radi:",
        "hu": "Ha a gomb nem működik:",
        "it": "Se il pulsante non funziona:",
        "lt": "Jei mygtukas neveikia:",
        "lv": "Ja poga nedarbojas:",
        "mt": "Jekk il-buttuna ma taħdimx:",
        "nl": "Als de knop niet werkt:",
        "pl": "Jeśli przycisk nie działa:",
        "pt": "Se o botão não funcionar:",
        "ro": "Dacă butonul nu funcționează:",
        "sk": "Ak tlačidlo nefunguje:",
        "sl": "Če gumb ne deluje:",
        "sv": "Om knappen inte fungerar:",
    },
    "layout.impressum": {
        "bg": "Правна информация",
        "cs": "Tiráž",
        "da": "Juridisk information",
        "de": "Impressum",
        "el": "Νομικές πληροφορίες",
        "en": "Legal notice",
        "es": "Aviso legal",
        "et": "Õigusteave",
        "fi": "Oikeudelliset tiedot",
        "fr": "Mentions légales",
        "ga": "Fógra dlíthiúil",
        "hr": "Pravne informacije",
        "hu": "Jogi nyilatkozat",
        "it": "Note legali",
        "lt": "Teisinė informacija",
        "lv": "Juridiskā informācija",
        "mt": "Avviż legali",
        "nl": "Colofon",
        "pl": "Nota prawna",
        "pt": "Informação legal",
        "ro": "Informații legale",
        "sk": "Tiráž",
        "sl": "Pravno obvestilo",
        "sv": "Juridisk information",
    },
    "layout.datenschutz": {
        "bg": "Поверителност",
        "cs": "Ochrana osobních údajů",
        "da": "Privatlivspolitik",
        "de": "Datenschutz",
        "el": "Απόρρητο",
        "en": "Privacy",
        "es": "Privacidad",
        "et": "Privaatsus",
        "fi": "Tietosuoja",
        "fr": "Confidentialité",
        "ga": "Príobháideachas",
        "hr": "Zaštita podataka",
        "hu": "Adatvédelem",
        "it": "Privacy",
        "lt": "Privatumas",
        "lv": "Privātums",
        "mt": "Privatezza",
        "nl": "Privacy",
        "pl": "Prywatność",
        "pt": "Privacidade",
        "ro": "Confidențialitate",
        "sk": "Ochrana osobných údajov",
        "sl": "Zasebnost",
        "sv": "Integritetspolicy",
    },
    "layout.abmelden": {
        "bg": "Отписване",
        "cs": "Odhlásit odběr",
        "da": "Afmeld",
        "de": "Abmelden",
        "el": "Διαγραφή",
        "en": "Unsubscribe",
        "es": "Darse de baja",
        "et": "Loobu tellimusest",
        "fi": "Peruuta tilaus",
        "fr": "Se désabonner",
        "ga": "Díliostáil",
        "hr": "Odjava",
        "hu": "Leiratkozás",
        "it": "Annulla iscrizione",
        "lt": "Atsisakyti prenumeratos",
        "lv": "Atteikties",
        "mt": "Ħassar l-abbonament",
        "nl": "Afmelden",
        "pl": "Wypisz się",
        "pt": "Cancelar subscrição",
        "ro": "Dezabonare",
        "sk": "Odhlásiť odber",
        "sl": "Odjava",
        "sv": "Avregistrera",
    },
    # Anrede OHNE Namen. Eigener Schlüssel statt eines Ersatzworts im
    # `{name}`-Platzhalter: „Hallo hallo," wäre das Ergebnis, und in einer
    # französischen Mail „Bonjour hallo,". Jede Sprache formuliert die
    # namenlose Anrede darum als GANZEN Satz.
    "auth.anrede_neutral": {
        "bg": "Здравейте,",
        "cs": "Dobrý den,",
        "da": "Hej,",
        "de": "Hallo,",
        "el": "Γεια σας,",
        "en": "Hello,",
        "es": "Hola:",
        "et": "Tere,",
        "fi": "Hei,",
        "fr": "Bonjour,",
        "ga": "Dia duit,",
        "hr": "Pozdrav,",
        "hu": "Üdvözlünk!",
        "it": "Ciao,",
        "lt": "Sveiki,",
        "lv": "Sveiki!",
        "mt": "Bongu,",
        "nl": "Hallo,",
        "pl": "Cześć,",
        "pt": "Olá,",
        "ro": "Bună,",
        "sk": "Dobrý deň,",
        "sl": "Pozdravljeni,",
        "sv": "Hej,",
    },
    # -- Einladung ins PMS (auth/einladung_service) -------------------------
    "auth.einladung.betreff": {
        "bg": "Вашият достъп до {marke}",
        "cs": "Váš přístup k {marke}",
        "da": "Din adgang til {marke}",
        "de": "Dein Zugang zu {marke}",
        "el": "Η πρόσβασή σας στο {marke}",
        "en": "Your access to {marke}",
        "es": "Tu acceso a {marke}",
        "et": "Sinu ligipääs {marke}-le",
        "fi": "Pääsysi {marke}-palveluun",
        "fr": "Votre accès à {marke}",
        "ga": "Do rochtain ar {marke}",
        "hr": "Vaš pristup {marke}",
        "hu": "Hozzáférésed a {marke}-hoz",
        "it": "Il tuo accesso a {marke}",
        "lt": "Jūsų prieiga prie {marke}",
        "lv": "Jūsu piekļuve {marke}",
        "mt": "L-aċċess tiegħek għal {marke}",
        "nl": "Je toegang tot {marke}",
        "pl": "Twój dostęp do {marke}",
        "pt": "O teu acesso a {marke}",
        "ro": "Accesul tău la {marke}",
        "sk": "Váš prístup k {marke}",
        "sl": "Vaš dostop do {marke}",
        "sv": "Din åtkomst till {marke}",
    },
    "auth.einladung.titel": {
        "bg": "Здравейте, {name},",
        "cs": "Dobrý den, {name},",
        "da": "Hej {name},",
        "de": "Hallo {name},",
        "el": "Γεια σας, {name},",
        "en": "Hello {name},",
        "es": "Hola {name}:",
        "et": "Tere, {name},",
        "fi": "Hei {name},",
        "fr": "Bonjour {name},",
        "ga": "Dia duit, {name},",
        "hr": "Pozdrav {name},",
        "hu": "Szia {name}!",
        "it": "Ciao {name},",
        "lt": "Sveiki, {name},",
        "lv": "Sveiki, {name}!",
        "mt": "Bongu {name},",
        "nl": "Hallo {name},",
        "pl": "Cześć {name},",
        "pt": "Olá {name},",
        "ro": "Bună, {name},",
        "sk": "Dobrý deň, {name},",
        "sl": "Pozdravljeni, {name},",
        "sv": "Hej {name},",
    },
    "auth.einladung.absatz_betrieb": {
        "bg": "{betrieb} Ви създаде достъп до {marke} — софтуерът, с който "
              "Вашата фирма управлява обекти, резервации и календари.",
        "cs": "{betrieb} vám zřídil přístup k {marke} — softwaru, se kterým váš "
              "podnik spravuje objekty, rezervace a kalendáře.",
        "da": "{betrieb} har oprettet en adgang til {marke} til dig — den "
              "software, som jeres virksomhed bruger til at administrere "
              "objekter, bookinger og kalendere.",
        "de": "{betrieb} hat dir einen Zugang zu {marke} eingerichtet — der "
              "Software, mit der euer Betrieb Objekte, Buchungen und Kalender "
              "verwaltet.",
        "el": "Η {betrieb} δημιούργησε για εσάς πρόσβαση στο {marke} — το "
              "λογισμικό με το οποίο η επιχείρησή σας διαχειρίζεται καταλύματα, "
              "κρατήσεις και ημερολόγια.",
        "en": "{betrieb} has set up access to {marke} for you — the software "
              "your business uses to manage properties, bookings and calendars.",
        "es": "{betrieb} te ha creado un acceso a {marke}, el software con el "
              "que tu empresa gestiona alojamientos, reservas y calendarios.",
        "et": "{betrieb} on loonud sulle ligipääsu {marke}-le — tarkvarale, "
              "millega teie ettevõte haldab objekte, broneeringuid ja kalendreid.",
        "fi": "{betrieb} on luonut sinulle pääsyn {marke}-palveluun — "
              "ohjelmistoon, jolla yrityksenne hallinnoi kohteita, varauksia ja "
              "kalentereita.",
        "fr": "{betrieb} vous a créé un accès à {marke}, le logiciel avec lequel "
              "votre établissement gère les hébergements, les réservations et "
              "les calendriers.",
        "ga": "Chuir {betrieb} rochtain ar {marke} ar bun duit — an bogearra a "
              "úsáideann do ghnó chun réadmhaoine, áirithintí agus féilirí a "
              "bhainistiú.",
        "hr": "{betrieb} vam je otvorio pristup {marke} — softveru kojim vaša "
              "tvrtka upravlja objektima, rezervacijama i kalendarima.",
        "hu": "A(z) {betrieb} hozzáférést hozott létre neked a {marke} "
              "rendszerhez — ezzel a szoftverrel kezeli a vállalkozásotok az "
              "ingatlanokat, foglalásokat és naptárakat.",
        "it": "{betrieb} ha creato per te un accesso a {marke}, il software con "
              "cui la tua struttura gestisce alloggi, prenotazioni e calendari.",
        "lt": "{betrieb} sukūrė jums prieigą prie {marke} — programinės įrangos, "
              "kuria jūsų įmonė valdo objektus, rezervacijas ir kalendorius.",
        "lv": "{betrieb} ir izveidojis jums piekļuvi {marke} — programmatūrai, "
              "ar kuru jūsu uzņēmums pārvalda objektus, rezervācijas un "
              "kalendārus.",
        "mt": "{betrieb} ħoloqlok aċċess għal {marke} — is-softwer li bih "
              "in-negozju tiegħek jamministra proprjetajiet, bookings u kalendarji.",
        "nl": "{betrieb} heeft een toegang tot {marke} voor je aangemaakt — de "
              "software waarmee jullie bedrijf accommodaties, boekingen en "
              "agenda's beheert.",
        "pl": "{betrieb} utworzył dla Ciebie dostęp do {marke} — oprogramowania, "
              "za pomocą którego Wasza firma zarządza obiektami, rezerwacjami i "
              "kalendarzami.",
        "pt": "{betrieb} criou-te um acesso ao {marke} — o software com que a "
              "tua empresa gere alojamentos, reservas e calendários.",
        "ro": "{betrieb} ți-a creat un acces la {marke} — software-ul cu care "
              "afacerea voastră gestionează proprietăți, rezervări și calendare.",
        "sk": "{betrieb} vám zriadil prístup k {marke} — softvéru, ktorým váš "
              "podnik spravuje objekty, rezervácie a kalendáre.",
        "sl": "{betrieb} vam je uredil dostop do {marke} — programske opreme, s "
              "katero vaše podjetje upravlja objekte, rezervacije in koledarje.",
        "sv": "{betrieb} har skapat en åtkomst till {marke} åt dig — "
              "programvaran som ert företag använder för att hantera objekt, "
              "bokningar och kalendrar.",
    },
    "auth.einladung.absatz_passwort": {
        "bg": "Задайте паролата си сега и можете да започнете.",
        "cs": "Nastavte si nyní heslo a můžete začít.",
        "da": "Vælg din adgangskode nu, så er du klar.",
        "de": "Setze jetzt dein Passwort, dann kann es losgehen.",
        "el": "Ορίστε τώρα τον κωδικό σας και είστε έτοιμοι.",
        "en": "Set your password now and you are ready to go.",
        "es": "Establece ahora tu contraseña y ya podrás empezar.",
        "et": "Määra nüüd oma parool ja võid alustada.",
        "fi": "Aseta salasanasi nyt, niin pääset alkuun.",
        "fr": "Définissez votre mot de passe et vous êtes prêt.",
        "ga": "Socraigh d'fhocal faire anois agus tá tú réidh.",
        "hr": "Postavite sada svoju lozinku i možete krenuti.",
        "hu": "Állítsd be most a jelszavadat, és kezdheted is.",
        "it": "Imposta ora la tua password e sei pronto per iniziare.",
        "lt": "Nustatykite dabar slaptažodį ir galite pradėti.",
        "lv": "Iestatiet tagad savu paroli, un varat sākt.",
        "mt": "Issettja l-password tiegħek issa u tkun lest.",
        "nl": "Stel nu je wachtwoord in, dan kun je aan de slag.",
        "pl": "Ustaw teraz swoje hasło i możesz zaczynać.",
        "pt": "Define agora a tua palavra-passe e podes começar.",
        "ro": "Setează-ți acum parola și poți începe.",
        "sk": "Nastavte si teraz heslo a môžete začať.",
        "sl": "Nastavite zdaj svoje geslo in lahko začnete.",
        "sv": "Ange ditt lösenord nu, så är du redo.",
    },
    "auth.einladung.absatz_betrieb_unbekannt": {
        "bg": "Вашата фирма Ви създаде достъп до {marke} — софтуерът, с който "
              "управлява обекти, резервации и календари.",
        "cs": "Váš podnik vám zřídil přístup k {marke} — softwaru, se kterým "
              "spravuje objekty, rezervace a kalendáře.",
        "da": "Din virksomhed har oprettet en adgang til {marke} til dig — den "
              "software, den bruger til at administrere objekter, bookinger og "
              "kalendere.",
        "de": "Dein Betrieb hat dir einen Zugang zu {marke} eingerichtet — der "
              "Software, mit der er Objekte, Buchungen und Kalender verwaltet.",
        "el": "Η επιχείρησή σας δημιούργησε για εσάς πρόσβαση στο {marke} — το "
              "λογισμικό με το οποίο διαχειρίζεται καταλύματα, κρατήσεις και "
              "ημερολόγια.",
        "en": "Your business has set up access to {marke} for you — the software "
              "it uses to manage properties, bookings and calendars.",
        "es": "Tu empresa te ha creado un acceso a {marke}, el software con el "
              "que gestiona alojamientos, reservas y calendarios.",
        "et": "Sinu ettevõte on loonud sulle ligipääsu {marke}-le — tarkvarale, "
              "millega hallatakse objekte, broneeringuid ja kalendreid.",
        "fi": "Yrityksesi on luonut sinulle pääsyn {marke}-palveluun — "
              "ohjelmistoon, jolla hallinnoidaan kohteita, varauksia ja "
              "kalentereita.",
        "fr": "Votre établissement vous a créé un accès à {marke}, le logiciel "
              "avec lequel il gère les hébergements, les réservations et les "
              "calendriers.",
        "ga": "Chuir do ghnó rochtain ar {marke} ar bun duit — an bogearra a "
              "úsáideann sé chun réadmhaoine, áirithintí agus féilirí a "
              "bhainistiú.",
        "hr": "Vaša tvrtka vam je otvorila pristup {marke} — softveru kojim "
              "upravlja objektima, rezervacijama i kalendarima.",
        "hu": "A vállalkozásod hozzáférést hozott létre neked a {marke} "
              "rendszerhez — ezzel kezeli az ingatlanokat, foglalásokat és "
              "naptárakat.",
        "it": "La tua struttura ha creato per te un accesso a {marke}, il "
              "software con cui gestisce alloggi, prenotazioni e calendari.",
        "lt": "Jūsų įmonė sukūrė jums prieigą prie {marke} — programinės "
              "įrangos, kuria valdomi objektai, rezervacijos ir kalendoriai.",
        "lv": "Jūsu uzņēmums ir izveidojis jums piekļuvi {marke} — "
              "programmatūrai, ar kuru pārvalda objektus, rezervācijas un "
              "kalendārus.",
        "mt": "In-negozju tiegħek ħoloqlok aċċess għal {marke} — is-softwer li "
              "bih jamministra proprjetajiet, bookings u kalendarji.",
        "nl": "Je bedrijf heeft een toegang tot {marke} voor je aangemaakt — de "
              "software waarmee accommodaties, boekingen en agenda's worden "
              "beheerd.",
        "pl": "Twoja firma utworzyła dla Ciebie dostęp do {marke} — "
              "oprogramowania, za pomocą którego zarządza obiektami, "
              "rezerwacjami i kalendarzami.",
        "pt": "A tua empresa criou-te um acesso ao {marke} — o software com que "
              "gere alojamentos, reservas e calendários.",
        "ro": "Afacerea ta ți-a creat un acces la {marke} — software-ul cu care "
              "gestionează proprietăți, rezervări și calendare.",
        "sk": "Váš podnik vám zriadil prístup k {marke} — softvéru, ktorým "
              "spravuje objekty, rezervácie a kalendáre.",
        "sl": "Vaše podjetje vam je uredilo dostop do {marke} — programske "
              "opreme, s katero upravlja objekte, rezervacije in koledarje.",
        "sv": "Ditt företag har skapat en åtkomst till {marke} åt dig — "
              "programvaran som används för att hantera objekt, bokningar och "
              "kalendrar.",
    },
    "auth.einladung.aktion": {
        "bg": "Задаване на парола",
        "cs": "Nastavit heslo",
        "da": "Vælg adgangskode",
        "de": "Passwort setzen",
        "el": "Ορισμός κωδικού",
        "en": "Set password",
        "es": "Establecer contraseña",
        "et": "Määra parool",
        "fi": "Aseta salasana",
        "fr": "Définir le mot de passe",
        "ga": "Socraigh focal faire",
        "hr": "Postavi lozinku",
        "hu": "Jelszó beállítása",
        "it": "Imposta la password",
        "lt": "Nustatyti slaptažodį",
        "lv": "Iestatīt paroli",
        "mt": "Issettja l-password",
        "nl": "Wachtwoord instellen",
        "pl": "Ustaw hasło",
        "pt": "Definir palavra-passe",
        "ro": "Setează parola",
        "sk": "Nastaviť heslo",
        "sl": "Nastavi geslo",
        "sv": "Ange lösenord",
    },
    "auth.einladung.hinweis_gueltig": {
        "bg": "Връзката е валидна 7 дни и може да се използва само веднъж.",
        "cs": "Odkaz je platný 7 dní a lze jej použít pouze jednou.",
        "da": "Linket er gyldigt i 7 dage og kan kun bruges én gang.",
        "de": "Der Link ist 7 Tage gültig und nur einmal verwendbar.",
        "el": "Ο σύνδεσμος ισχύει για 7 ημέρες και μπορεί να χρησιμοποιηθεί "
              "μόνο μία φορά.",
        "en": "The link is valid for 7 days and can only be used once.",
        "es": "El enlace es válido durante 7 días y solo se puede usar una vez.",
        "et": "Link kehtib 7 päeva ja seda saab kasutada ainult üks kord.",
        "fi": "Linkki on voimassa 7 päivää ja sen voi käyttää vain kerran.",
        "fr": "Le lien est valable 7 jours et ne peut être utilisé qu'une fois.",
        "ga": "Tá an nasc bailí ar feadh 7 lá agus ní féidir é a úsáid ach uair "
              "amháin.",
        "hr": "Poveznica vrijedi 7 dana i može se upotrijebiti samo jednom.",
        "hu": "A link 7 napig érvényes, és csak egyszer használható fel.",
        "it": "Il link è valido per 7 giorni e può essere usato una sola volta.",
        "lt": "Nuoroda galioja 7 dienas ir gali būti panaudota tik vieną kartą.",
        "lv": "Saite ir derīga 7 dienas, un to var izmantot tikai vienu reizi.",
        "mt": "Il-link huwa validu għal 7 ijiem u jista' jintuża darba biss.",
        "nl": "De link is 7 dagen geldig en kan maar één keer worden gebruikt.",
        "pl": "Link jest ważny przez 7 dni i można go użyć tylko raz.",
        "pt": "A ligação é válida durante 7 dias e só pode ser usada uma vez.",
        "ro": "Linkul este valabil 7 zile și poate fi folosit o singură dată.",
        "sk": "Odkaz je platný 7 dní a možno ho použiť iba raz.",
        "sl": "Povezava velja 7 dni in jo je mogoče uporabiti samo enkrat.",
        "sv": "Länken är giltig i 7 dagar och kan bara användas en gång.",
    },
    "auth.einladung.hinweis_ignorieren": {
        "bg": "Ако това не Ви касае, просто игнорирайте това писмо — без "
              "зададена парола не се случва нищо.",
        "cs": "Pokud pro vás tato zpráva nemá význam, ignorujte ji — bez "
              "nastaveného hesla se nic nestane.",
        "da": "Hvis du ikke ved, hvad det handler om, kan du bare ignorere "
              "denne mail — uden en valgt adgangskode sker der ingenting.",
        "de": "Wenn du damit nichts anfangen kannst, ignoriere diese Mail — "
              "ohne gesetztes Passwort passiert nichts.",
        "el": "Αν δεν γνωρίζετε περί τίνος πρόκειται, αγνοήστε αυτό το μήνυμα — "
              "χωρίς ορισμένο κωδικό δεν συμβαίνει τίποτα.",
        "en": "If this does not mean anything to you, simply ignore this email "
              "— nothing happens without a password being set.",
        "es": "Si no sabes de qué se trata, ignora este correo: sin una "
              "contraseña establecida no ocurre nada.",
        "et": "Kui see sulle midagi ei ütle, eira seda kirja — ilma parooli "
              "määramata ei juhtu midagi.",
        "fi": "Jos tämä ei kerro sinulle mitään, jätä viesti huomiotta — ilman "
              "asetettua salasanaa ei tapahdu mitään.",
        "fr": "Si ce message ne vous concerne pas, ignorez-le : sans mot de "
              "passe défini, rien ne se passe.",
        "ga": "Mura gciallaíonn sé seo aon rud duit, déan neamhaird den "
              "ríomhphost seo — ní tharlaíonn faic gan focal faire a shocrú.",
        "hr": "Ako vam ovo ništa ne znači, zanemarite ovu poruku — bez "
              "postavljene lozinke ne događa se ništa.",
        "hu": "Ha ez nem mond neked semmit, hagyd figyelmen kívül ezt a "
              "levelet — beállított jelszó nélkül nem történik semmi.",
        "it": "Se questo messaggio non ti riguarda, ignoralo: senza una "
              "password impostata non succede nulla.",
        "lt": "Jei tai jums nieko nesako, tiesiog nepaisykite šio laiško — "
              "nenustačius slaptažodžio nieko neįvyks.",
        "lv": "Ja tas jums neko nenozīmē, vienkārši ignorējiet šo e-pastu — bez "
              "iestatītas paroles nekas nenotiek.",
        "mt": "Jekk dan ma jfisser xejn għalik, sempliċement injora dan "
              "l-email — ma jiġri xejn mingħajr password issettjata.",
        "nl": "Als je hier niets mee kunt, negeer deze mail dan — zonder "
              "ingesteld wachtwoord gebeurt er niets.",
        "pl": "Jeśli nic Ci to nie mówi, zignoruj tę wiadomość — bez "
              "ustawionego hasła nic się nie stanie.",
        "pt": "Se isto não te diz nada, ignora este e-mail — sem uma "
              "palavra-passe definida não acontece nada.",
        "ro": "Dacă nu știi despre ce este vorba, ignoră acest e-mail — fără o "
              "parolă setată nu se întâmplă nimic.",
        "sk": "Ak pre vás táto správa nemá význam, ignorujte ju — bez "
              "nastaveného hesla sa nič nestane.",
        "sl": "Če vam to nič ne pomeni, to sporočilo prezrite — brez "
              "nastavljenega gesla se ne zgodi nič.",
        "sv": "Om det här inte säger dig något kan du ignorera mejlet — utan "
              "ett angivet lösenord händer ingenting.",
    },
    # -- Passwort-Reset (auth/einladung_service, platform_admin/team_service)
    "auth.reset.betreff": {
        "bg": "Нова парола за {marke}",
        "cs": "Nové heslo pro {marke}",
        "da": "Ny adgangskode til {marke}",
        "de": "Neues Passwort für {marke}",
        "el": "Νέος κωδικός για το {marke}",
        "en": "New password for {marke}",
        "es": "Nueva contraseña para {marke}",
        "et": "Uus parool {marke} jaoks",
        "fi": "Uusi salasana {marke}-palveluun",
        "fr": "Nouveau mot de passe pour {marke}",
        "ga": "Focal faire nua le haghaidh {marke}",
        "hr": "Nova lozinka za {marke}",
        "hu": "Új jelszó a {marke}-hoz",
        "it": "Nuova password per {marke}",
        "lt": "Naujas {marke} slaptažodis",
        "lv": "Jauna {marke} parole",
        "mt": "Password ġdida għal {marke}",
        "nl": "Nieuw wachtwoord voor {marke}",
        "pl": "Nowe hasło do {marke}",
        "pt": "Nova palavra-passe para {marke}",
        "ro": "Parolă nouă pentru {marke}",
        "sk": "Nové heslo pre {marke}",
        "sl": "Novo geslo za {marke}",
        "sv": "Nytt lösenord för {marke}",
    },
    "auth.reset.titel": {
        "bg": "Здравейте, {name},",
        "cs": "Dobrý den, {name},",
        "da": "Hej {name},",
        "de": "Hallo {name},",
        "el": "Γεια σας, {name},",
        "en": "Hello {name},",
        "es": "Hola {name}:",
        "et": "Tere, {name},",
        "fi": "Hei {name},",
        "fr": "Bonjour {name},",
        "ga": "Dia duit, {name},",
        "hr": "Pozdrav {name},",
        "hu": "Szia {name}!",
        "it": "Ciao {name},",
        "lt": "Sveiki, {name},",
        "lv": "Sveiki, {name}!",
        "mt": "Bongu {name},",
        "nl": "Hallo {name},",
        "pl": "Cześć {name},",
        "pt": "Olá {name},",
        "ro": "Bună, {name},",
        "sk": "Dobrý deň, {name},",
        "sl": "Pozdravljeni, {name},",
        "sv": "Hej {name},",
    },
    "auth.reset.absatz": {
        "bg": "За Вашия достъп до {marke} беше поискана нова парола.",
        "cs": "Pro váš přístup k {marke} bylo vyžádáno nové heslo.",
        "da": "Der er anmodet om en ny adgangskode til din {marke}-adgang.",
        "de": "für deinen {marke}-Zugang wurde ein neues Passwort angefordert.",
        "el": "Ζητήθηκε νέος κωδικός για την πρόσβασή σας στο {marke}.",
        "en": "A new password has been requested for your {marke} access.",
        "es": "Se ha solicitado una nueva contraseña para tu acceso a {marke}.",
        "et": "Sinu {marke} ligipääsu jaoks on taotletud uut parooli.",
        "fi": "{marke}-tunnuksellesi on pyydetty uutta salasanaa.",
        "fr": "Un nouveau mot de passe a été demandé pour votre accès {marke}.",
        "ga": "Iarradh focal faire nua le haghaidh do rochtana ar {marke}.",
        "hr": "Za vaš pristup {marke} zatražena je nova lozinka.",
        "hu": "Új jelszót igényeltek a {marke}-hozzáférésedhez.",
        "it": "È stata richiesta una nuova password per il tuo accesso a {marke}.",
        "lt": "Jūsų {marke} prieigai buvo paprašyta naujo slaptažodžio.",
        "lv": "Jūsu {marke} piekļuvei ir pieprasīta jauna parole.",
        "mt": "Intalbet password ġdida għall-aċċess tiegħek ta' {marke}.",
        "nl": "Voor je {marke}-toegang is een nieuw wachtwoord aangevraagd.",
        "pl": "Dla Twojego dostępu do {marke} zażądano nowego hasła.",
        "pt": "Foi solicitada uma nova palavra-passe para o teu acesso ao {marke}.",
        "ro": "A fost solicitată o parolă nouă pentru accesul tău la {marke}.",
        "sk": "Pre váš prístup k {marke} bolo vyžiadané nové heslo.",
        "sl": "Za vaš dostop do {marke} je bilo zahtevano novo geslo.",
        "sv": "Ett nytt lösenord har begärts för din {marke}-åtkomst.",
    },
    "auth.reset.aktion": {
        "bg": "Задаване на нова парола",
        "cs": "Nastavit nové heslo",
        "da": "Vælg ny adgangskode",
        "de": "Neues Passwort setzen",
        "el": "Ορισμός νέου κωδικού",
        "en": "Set new password",
        "es": "Establecer nueva contraseña",
        "et": "Määra uus parool",
        "fi": "Aseta uusi salasana",
        "fr": "Définir un nouveau mot de passe",
        "ga": "Socraigh focal faire nua",
        "hr": "Postavi novu lozinku",
        "hu": "Új jelszó beállítása",
        "it": "Imposta la nuova password",
        "lt": "Nustatyti naują slaptažodį",
        "lv": "Iestatīt jaunu paroli",
        "mt": "Issettja password ġdida",
        "nl": "Nieuw wachtwoord instellen",
        "pl": "Ustaw nowe hasło",
        "pt": "Definir nova palavra-passe",
        "ro": "Setează parola nouă",
        "sk": "Nastaviť nové heslo",
        "sl": "Nastavi novo geslo",
        "sv": "Ange nytt lösenord",
    },
    "auth.reset.hinweis_gueltig": {
        "bg": "Връзката е валидна един час и може да се използва само веднъж.",
        "cs": "Odkaz je platný jednu hodinu a lze jej použít pouze jednou.",
        "da": "Linket er gyldigt i en time og kan kun bruges én gang.",
        "de": "Der Link ist eine Stunde gültig und nur einmal verwendbar.",
        "el": "Ο σύνδεσμος ισχύει για μία ώρα και μπορεί να χρησιμοποιηθεί "
              "μόνο μία φορά.",
        "en": "The link is valid for one hour and can only be used once.",
        "es": "El enlace es válido durante una hora y solo se puede usar una vez.",
        "et": "Link kehtib ühe tunni ja seda saab kasutada ainult üks kord.",
        "fi": "Linkki on voimassa tunnin ja sen voi käyttää vain kerran.",
        "fr": "Le lien est valable une heure et ne peut être utilisé qu'une fois.",
        "ga": "Tá an nasc bailí ar feadh uair an chloig agus ní féidir é a úsáid "
              "ach uair amháin.",
        "hr": "Poveznica vrijedi jedan sat i može se upotrijebiti samo jednom.",
        "hu": "A link egy órán át érvényes, és csak egyszer használható fel.",
        "it": "Il link è valido per un'ora e può essere usato una sola volta.",
        "lt": "Nuoroda galioja vieną valandą ir gali būti panaudota tik kartą.",
        "lv": "Saite ir derīga vienu stundu, un to var izmantot tikai vienreiz.",
        "mt": "Il-link huwa validu għal siegħa u jista' jintuża darba biss.",
        "nl": "De link is een uur geldig en kan maar één keer worden gebruikt.",
        "pl": "Link jest ważny przez godzinę i można go użyć tylko raz.",
        "pt": "A ligação é válida durante uma hora e só pode ser usada uma vez.",
        "ro": "Linkul este valabil o oră și poate fi folosit o singură dată.",
        "sk": "Odkaz je platný jednu hodinu a možno ho použiť iba raz.",
        "sl": "Povezava velja eno uro in jo je mogoče uporabiti samo enkrat.",
        "sv": "Länken är giltig i en timme och kan bara användas en gång.",
    },
    "auth.reset.hinweis_ignorieren": {
        "bg": "Ако не сте Вие, игнорирайте това писмо — досегашната Ви парола "
              "остава валидна без промяна.",
        "cs": "Pokud jste to nebyli vy, ignorujte tuto zprávu — vaše dosavadní "
              "heslo zůstává beze změny platné.",
        "da": "Hvis det ikke var dig, kan du ignorere denne mail — din "
              "nuværende adgangskode forbliver uændret gyldig.",
        "de": "Warst das nicht du, ignoriere diese Mail — dein bisheriges "
              "Passwort bleibt dann unverändert gültig.",
        "el": "Αν δεν ήσασταν εσείς, αγνοήστε αυτό το μήνυμα — ο τρέχων κωδικός "
              "σας παραμένει αμετάβλητος και ισχύει.",
        "en": "If this was not you, ignore this email — your current password "
              "remains valid and unchanged.",
        "es": "Si no has sido tú, ignora este correo: tu contraseña actual "
              "seguirá siendo válida sin cambios.",
        "et": "Kui see polnud sina, eira seda kirja — sinu senine parool jääb "
              "muutumatuna kehtima.",
        "fi": "Jos et ollut sinä, jätä viesti huomiotta — nykyinen salasanasi "
              "pysyy voimassa muuttumattomana.",
        "fr": "Si ce n'était pas vous, ignorez ce message : votre mot de passe "
              "actuel reste valable et inchangé.",
        "ga": "Murab tusa a bhí ann, déan neamhaird den ríomhphost seo — "
              "fanann d'fhocal faire reatha bailí gan athrú.",
        "hr": "Ako to niste bili vi, zanemarite ovu poruku — vaša dosadašnja "
              "lozinka ostaje nepromijenjeno važeća.",
        "hu": "Ha nem te voltál, hagyd figyelmen kívül ezt a levelet — a "
              "jelenlegi jelszavad változatlanul érvényes marad.",
        "it": "Se non sei stato tu, ignora questo messaggio: la tua password "
              "attuale resta valida e invariata.",
        "lt": "Jei tai buvote ne jūs, nepaisykite šio laiško — jūsų dabartinis "
              "slaptažodis lieka galioti nepakitęs.",
        "lv": "Ja tas nebijāt jūs, ignorējiet šo e-pastu — jūsu pašreizējā "
              "parole paliek spēkā nemainīga.",
        "mt": "Jekk ma kontx int, injora dan l-email — il-password attwali "
              "tiegħek tibqa' valida u mhux mibdula.",
        "nl": "Was jij dit niet, negeer deze mail dan — je huidige wachtwoord "
              "blijft ongewijzigd geldig.",
        "pl": "Jeśli to nie Ty, zignoruj tę wiadomość — Twoje dotychczasowe "
              "hasło pozostaje bez zmian ważne.",
        "pt": "Se não foste tu, ignora este e-mail — a tua palavra-passe atual "
              "permanece válida e inalterada.",
        "ro": "Dacă nu ai fost tu, ignoră acest e-mail — parola ta actuală "
              "rămâne valabilă și neschimbată.",
        "sk": "Ak ste to neboli vy, ignorujte túto správu — vaše doterajšie "
              "heslo zostáva nezmenene platné.",
        "sl": "Če to niste bili vi, to sporočilo prezrite — vaše dosedanje "
              "geslo ostaja nespremenjeno veljavno.",
        "sv": "Om det inte var du kan du ignorera mejlet — ditt nuvarande "
              "lösenord förblir giltigt och oförändrat.",
    },
    # -- Backoffice-Einladung (platform_admin/team_service) ------------------
    "backoffice.einladung.betreff": {
        "bg": "Вашият достъп до {marke} Backoffice",
        "cs": "Váš přístup k {marke} Backoffice",
        "da": "Din adgang til {marke} Backoffice",
        "de": "Dein Zugang zum {marke}-Backoffice",
        "el": "Η πρόσβασή σας στο {marke} Backoffice",
        "en": "Your access to the {marke} back office",
        "es": "Tu acceso al back office de {marke}",
        "et": "Sinu ligipääs {marke} tagatoale",
        "fi": "Pääsysi {marke}-taustajärjestelmään",
        "fr": "Votre accès au back-office {marke}",
        "ga": "Do rochtain ar chúloifig {marke}",
        "hr": "Vaš pristup {marke} Backofficeu",
        "hu": "Hozzáférésed a {marke} backoffice-hoz",
        "it": "Il tuo accesso al back office di {marke}",
        "lt": "Jūsų prieiga prie {marke} vidinės sistemos",
        "lv": "Jūsu piekļuve {marke} aizmugursistēmai",
        "mt": "L-aċċess tiegħek għall-back office ta' {marke}",
        "nl": "Je toegang tot de {marke}-backoffice",
        "pl": "Twój dostęp do zaplecza {marke}",
        "pt": "O teu acesso ao back office do {marke}",
        "ro": "Accesul tău la back office-ul {marke}",
        "sk": "Váš prístup k {marke} Backoffice",
        "sl": "Vaš dostop do zaledja {marke}",
        "sv": "Din åtkomst till {marke} Backoffice",
    },
    "backoffice.einladung.titel": {
        "bg": "Вашият достъп до Backoffice",
        "cs": "Váš přístup k Backoffice",
        "da": "Din adgang til Backoffice",
        "de": "Dein Zugang zum Backoffice",
        "el": "Η πρόσβασή σας στο Backoffice",
        "en": "Your back office access",
        "es": "Tu acceso al back office",
        "et": "Sinu ligipääs tagatoale",
        "fi": "Pääsysi taustajärjestelmään",
        "fr": "Votre accès au back-office",
        "ga": "Do rochtain ar an gcúloifig",
        "hr": "Vaš pristup Backofficeu",
        "hu": "A backoffice-hozzáférésed",
        "it": "Il tuo accesso al back office",
        "lt": "Jūsų prieiga prie vidinės sistemos",
        "lv": "Jūsu piekļuve aizmugursistēmai",
        "mt": "L-aċċess tiegħek għall-back office",
        "nl": "Je toegang tot de backoffice",
        "pl": "Twój dostęp do zaplecza",
        "pt": "O teu acesso ao back office",
        "ro": "Accesul tău la back office",
        "sk": "Váš prístup k Backoffice",
        "sl": "Vaš dostop do zaledja",
        "sv": "Din åtkomst till Backoffice",
    },
    "backoffice.einladung.absatz": {
        "bg": "{von} Ви създаде достъп до {marke} Backoffice.",
        "cs": "{von} vám zřídil přístup k {marke} Backoffice.",
        "da": "{von} har oprettet adgang til {marke} Backoffice til dig.",
        "de": "{von} hat dir Zugang zum {marke}-Backoffice eingerichtet.",
        "el": "Ο/Η {von} σας δημιούργησε πρόσβαση στο {marke} Backoffice.",
        "en": "{von} has set up access to the {marke} back office for you.",
        "es": "{von} te ha creado un acceso al back office de {marke}.",
        "et": "{von} on loonud sulle ligipääsu {marke} tagatoale.",
        "fi": "{von} on luonut sinulle pääsyn {marke}-taustajärjestelmään.",
        "fr": "{von} vous a créé un accès au back-office {marke}.",
        "ga": "Chuir {von} rochtain ar chúloifig {marke} ar bun duit.",
        "hr": "{von} vam je otvorio pristup {marke} Backofficeu.",
        "hu": "{von} hozzáférést hozott létre neked a {marke} backoffice-hoz.",
        "it": "{von} ha creato per te un accesso al back office di {marke}.",
        "lt": "{von} sukūrė jums prieigą prie {marke} vidinės sistemos.",
        "lv": "{von} ir izveidojis jums piekļuvi {marke} aizmugursistēmai.",
        "mt": "{von} ħoloqlok aċċess għall-back office ta' {marke}.",
        "nl": "{von} heeft toegang tot de {marke}-backoffice voor je aangemaakt.",
        "pl": "{von} utworzył dla Ciebie dostęp do zaplecza {marke}.",
        "pt": "{von} criou-te um acesso ao back office do {marke}.",
        "ro": "{von} ți-a creat un acces la back office-ul {marke}.",
        "sk": "{von} vám zriadil prístup k {marke} Backoffice.",
        "sl": "{von} vam je uredil dostop do zaledja {marke}.",
        "sv": "{von} har skapat åtkomst till {marke} Backoffice åt dig.",
    },
    "backoffice.einladung.absatz_passwort": {
        "bg": "Задайте паролата си сега, за да можете да влезете.",
        "cs": "Nastavte si nyní heslo, abyste se mohli přihlásit.",
        "da": "Vælg din adgangskode nu, så du kan logge ind.",
        "de": "Setze jetzt dein Passwort, dann kannst du dich anmelden.",
        "el": "Ορίστε τώρα τον κωδικό σας για να μπορείτε να συνδεθείτε.",
        "en": "Set your password now so you can sign in.",
        "es": "Establece ahora tu contraseña para poder iniciar sesión.",
        "et": "Määra nüüd oma parool, et saaksid sisse logida.",
        "fi": "Aseta salasanasi nyt, jotta voit kirjautua sisään.",
        "fr": "Définissez votre mot de passe pour pouvoir vous connecter.",
        "ga": "Socraigh d'fhocal faire anois ionas gur féidir leat sínigh "
              "isteach.",
        "hr": "Postavite sada svoju lozinku kako biste se mogli prijaviti.",
        "hu": "Állítsd be most a jelszavadat, hogy be tudj jelentkezni.",
        "it": "Imposta ora la tua password per poter accedere.",
        "lt": "Nustatykite dabar slaptažodį, kad galėtumėte prisijungti.",
        "lv": "Iestatiet tagad savu paroli, lai varētu pieteikties.",
        "mt": "Issettja l-password tiegħek issa biex tkun tista' tidħol.",
        "nl": "Stel nu je wachtwoord in, dan kun je inloggen.",
        "pl": "Ustaw teraz swoje hasło, aby móc się zalogować.",
        "pt": "Define agora a tua palavra-passe para poderes iniciar sessão.",
        "ro": "Setează-ți acum parola ca să te poți autentifica.",
        "sk": "Nastavte si teraz heslo, aby ste sa mohli prihlásiť.",
        "sl": "Nastavite zdaj svoje geslo, da se boste lahko prijavili.",
        "sv": "Ange ditt lösenord nu så att du kan logga in.",
    },
    "backoffice.einladung.hinweis_gueltig": {
        "bg": "Връзката е валидна 72 часа и може да се използва само веднъж.",
        "cs": "Odkaz je platný 72 hodin a lze jej použít pouze jednou.",
        "da": "Linket er gyldigt i 72 timer og kan kun bruges én gang.",
        "de": "Der Link ist 72 Stunden gültig und nur einmal verwendbar.",
        "el": "Ο σύνδεσμος ισχύει για 72 ώρες και μπορεί να χρησιμοποιηθεί "
              "μόνο μία φορά.",
        "en": "The link is valid for 72 hours and can only be used once.",
        "es": "El enlace es válido durante 72 horas y solo se puede usar una vez.",
        "et": "Link kehtib 72 tundi ja seda saab kasutada ainult üks kord.",
        "fi": "Linkki on voimassa 72 tuntia ja sen voi käyttää vain kerran.",
        "fr": "Le lien est valable 72 heures et ne peut être utilisé qu'une fois.",
        "ga": "Tá an nasc bailí ar feadh 72 uair an chloig agus ní féidir é a "
              "úsáid ach uair amháin.",
        "hr": "Poveznica vrijedi 72 sata i može se upotrijebiti samo jednom.",
        "hu": "A link 72 órán át érvényes, és csak egyszer használható fel.",
        "it": "Il link è valido per 72 ore e può essere usato una sola volta.",
        "lt": "Nuoroda galioja 72 valandas ir gali būti panaudota tik kartą.",
        "lv": "Saite ir derīga 72 stundas, un to var izmantot tikai vienreiz.",
        "mt": "Il-link huwa validu għal 72 siegħa u jista' jintuża darba biss.",
        "nl": "De link is 72 uur geldig en kan maar één keer worden gebruikt.",
        "pl": "Link jest ważny przez 72 godziny i można go użyć tylko raz.",
        "pt": "A ligação é válida durante 72 horas e só pode ser usada uma vez.",
        "ro": "Linkul este valabil 72 de ore și poate fi folosit o singură dată.",
        "sk": "Odkaz je platný 72 hodín a možno ho použiť iba raz.",
        "sl": "Povezava velja 72 ur in jo je mogoče uporabiti samo enkrat.",
        "sv": "Länken är giltig i 72 timmar och kan bara användas en gång.",
    },
    "backoffice.reset.betreff": {
        "bg": "Нова парола за {marke} Backoffice",
        "cs": "Nové heslo pro {marke} Backoffice",
        "da": "Ny adgangskode til {marke} Backoffice",
        "de": "Neues Passwort für das {marke}-Backoffice",
        "el": "Νέος κωδικός για το {marke} Backoffice",
        "en": "New password for the {marke} back office",
        "es": "Nueva contraseña para el back office de {marke}",
        "et": "Uus parool {marke} tagatoa jaoks",
        "fi": "Uusi salasana {marke}-taustajärjestelmään",
        "fr": "Nouveau mot de passe pour le back-office {marke}",
        "ga": "Focal faire nua le haghaidh chúloifig {marke}",
        "hr": "Nova lozinka za {marke} Backoffice",
        "hu": "Új jelszó a {marke} backoffice-hoz",
        "it": "Nuova password per il back office di {marke}",
        "lt": "Naujas {marke} vidinės sistemos slaptažodis",
        "lv": "Jauna {marke} aizmugursistēmas parole",
        "mt": "Password ġdida għall-back office ta' {marke}",
        "nl": "Nieuw wachtwoord voor de {marke}-backoffice",
        "pl": "Nowe hasło do zaplecza {marke}",
        "pt": "Nova palavra-passe para o back office do {marke}",
        "ro": "Parolă nouă pentru back office-ul {marke}",
        "sk": "Nové heslo pre {marke} Backoffice",
        "sl": "Novo geslo za zaledje {marke}",
        "sv": "Nytt lösenord för {marke} Backoffice",
    },
    "backoffice.reset.titel": {
        "bg": "Заявка за нова парола",
        "cs": "Žádost o nové heslo",
        "da": "Anmod om ny adgangskode",
        "de": "Neues Passwort anfordern",
        "el": "Αίτημα νέου κωδικού",
        "en": "Request a new password",
        "es": "Solicitar nueva contraseña",
        "et": "Uue parooli taotlemine",
        "fi": "Uuden salasanan pyyntö",
        "fr": "Demande de nouveau mot de passe",
        "ga": "Iarr focal faire nua",
        "hr": "Zahtjev za novu lozinku",
        "hu": "Új jelszó igénylése",
        "it": "Richiesta di una nuova password",
        "lt": "Naujo slaptažodžio užklausa",
        "lv": "Pieprasīt jaunu paroli",
        "mt": "Itlob password ġdida",
        "nl": "Nieuw wachtwoord aanvragen",
        "pl": "Prośba o nowe hasło",
        "pt": "Pedir nova palavra-passe",
        "ro": "Solicitare parolă nouă",
        "sk": "Žiadosť o nové heslo",
        "sl": "Zahteva za novo geslo",
        "sv": "Begär nytt lösenord",
    },
    "backoffice.reset.absatz": {
        "bg": "За Вашия достъп до {marke} Backoffice беше поискана нова парола.",
        "cs": "Pro váš přístup k {marke} Backoffice bylo vyžádáno nové heslo.",
        "da": "Der er anmodet om en ny adgangskode til din adgang til {marke} "
              "Backoffice.",
        "de": "für deinen Zugang zum {marke}-Backoffice wurde ein neues "
              "Passwort angefordert.",
        "el": "Ζητήθηκε νέος κωδικός για την πρόσβασή σας στο {marke} Backoffice.",
        "en": "A new password has been requested for your {marke} back office "
              "access.",
        "es": "Se ha solicitado una nueva contraseña para tu acceso al back "
              "office de {marke}.",
        "et": "Sinu {marke} tagatoa ligipääsu jaoks on taotletud uut parooli.",
        "fi": "{marke}-taustajärjestelmän tunnuksellesi on pyydetty uutta "
              "salasanaa.",
        "fr": "Un nouveau mot de passe a été demandé pour votre accès au "
              "back-office {marke}.",
        "ga": "Iarradh focal faire nua le haghaidh do rochtana ar chúloifig "
              "{marke}.",
        "hr": "Za vaš pristup {marke} Backofficeu zatražena je nova lozinka.",
        "hu": "Új jelszót igényeltek a {marke} backoffice-hozzáférésedhez.",
        "it": "È stata richiesta una nuova password per il tuo accesso al back "
              "office di {marke}.",
        "lt": "Jūsų {marke} vidinės sistemos prieigai buvo paprašyta naujo "
              "slaptažodžio.",
        "lv": "Jūsu {marke} aizmugursistēmas piekļuvei ir pieprasīta jauna parole.",
        "mt": "Intalbet password ġdida għall-aċċess tiegħek għall-back office "
              "ta' {marke}.",
        "nl": "Voor je toegang tot de {marke}-backoffice is een nieuw "
              "wachtwoord aangevraagd.",
        "pl": "Dla Twojego dostępu do zaplecza {marke} zażądano nowego hasła.",
        "pt": "Foi solicitada uma nova palavra-passe para o teu acesso ao back "
              "office do {marke}.",
        "ro": "A fost solicitată o parolă nouă pentru accesul tău la back "
              "office-ul {marke}.",
        "sk": "Pre váš prístup k {marke} Backoffice bolo vyžiadané nové heslo.",
        "sl": "Za vaš dostop do zaledja {marke} je bilo zahtevano novo geslo.",
        "sv": "Ett nytt lösenord har begärts för din åtkomst till {marke} "
              "Backoffice.",
    },
    # -- Bewertungserinnerung an den Gast (reviews/automation) — myBestDays --
    "reviews.erinnerung.betreff": {
        "bg": "Как беше престоят Ви в {objekt}?",
        "cs": "Jaké to bylo v {objekt}?",
        "da": "Hvordan var dit ophold på {objekt}?",
        "de": "Wie war es bei {objekt}?",
        "el": "Πώς ήταν η διαμονή σας στο {objekt};",
        "en": "How was your stay at {objekt}?",
        "es": "¿Qué tal tu estancia en {objekt}?",
        "et": "Kuidas sul {objekt} meeldis?",
        "fi": "Millainen oli oleskelusi kohteessa {objekt}?",
        "fr": "Comment s'est passé votre séjour à {objekt} ?",
        "ga": "Conas a bhí do chuairt ar {objekt}?",
        "hr": "Kako je bilo u {objekt}?",
        "hu": "Milyen volt a tartózkodásod itt: {objekt}?",
        "it": "Com'è andato il tuo soggiorno a {objekt}?",
        "lt": "Kaip praėjo jūsų viešnagė {objekt}?",
        "lv": "Kā pagāja jūsu uzturēšanās {objekt}?",
        "mt": "Kif kien is-soġġorn tiegħek f'{objekt}?",
        "nl": "Hoe was je verblijf bij {objekt}?",
        "pl": "Jak minął Twój pobyt w {objekt}?",
        "pt": "Como foi a tua estadia em {objekt}?",
        "ro": "Cum a fost sejurul tău la {objekt}?",
        "sk": "Aké to bolo v {objekt}?",
        "sl": "Kako je bilo v {objekt}?",
        "sv": "Hur var din vistelse på {objekt}?",
    },
    "reviews.erinnerung.absatz_hoffnung": {
        "bg": "надяваме се, че престоят Ви в {objekt} Ви е харесал.",
        "cs": "doufáme, že se vám v {objekt} líbilo.",
        "da": "vi håber, du havde en god oplevelse på {objekt}.",
        "de": "wir hoffen, es hat dir bei {objekt} gefallen.",
        "el": "ελπίζουμε να περάσατε καλά στο {objekt}.",
        "en": "we hope you enjoyed your stay at {objekt}.",
        "es": "esperamos que hayas disfrutado tu estancia en {objekt}.",
        "et": "loodame, et sulle meeldis {objekt}.",
        "fi": "toivomme, että viihdyit kohteessa {objekt}.",
        "fr": "nous espérons que votre séjour à {objekt} vous a plu.",
        "ga": "tá súil againn gur bhain tú taitneamh as do chuairt ar {objekt}.",
        "hr": "nadamo se da vam se svidjelo u {objekt}.",
        "hu": "reméljük, jól érezted magad itt: {objekt}.",
        "it": "speriamo che il tuo soggiorno a {objekt} ti sia piaciuto.",
        "lt": "tikimės, kad jums patiko {objekt}.",
        "lv": "ceram, ka jums patika {objekt}.",
        "mt": "nittamaw li ħadt gost fis-soġġorn tiegħek f'{objekt}.",
        "nl": "we hopen dat je het naar je zin hebt gehad bij {objekt}.",
        "pl": "mamy nadzieję, że pobyt w {objekt} Ci się podobał.",
        "pt": "esperamos que tenhas gostado da tua estadia em {objekt}.",
        "ro": "sperăm că ți-a plăcut sejurul la {objekt}.",
        "sk": "dúfame, že sa vám v {objekt} páčilo.",
        "sl": "upamo, da vam je bilo v {objekt} všeč.",
        "sv": "vi hoppas att du trivdes på {objekt}.",
    },
    "reviews.erinnerung.absatz_nutzen": {
        "bg": "Вашата оценка помага на други гости при избора и на домакина да "
              "става по-добър.",
        "cs": "Vaše hodnocení pomáhá dalším hostům při výběru a hostiteli se "
              "zlepšovat.",
        "da": "Din anmeldelse hjælper andre gæster med at vælge og værten med "
              "at blive bedre.",
        "de": "Deine Bewertung hilft anderen Gästen bei der Auswahl und dem "
              "Gastgeber beim Besserwerden.",
        "el": "Η αξιολόγησή σας βοηθά άλλους επισκέπτες στην επιλογή τους και "
              "τον οικοδεσπότη να βελτιωθεί.",
        "en": "Your review helps other guests choose and helps the host improve.",
        "es": "Tu valoración ayuda a otros huéspedes a elegir y al anfitrión a "
              "mejorar.",
        "et": "Sinu hinnang aitab teistel külalistel valida ja võõrustajal "
              "paremaks saada.",
        "fi": "Arviosi auttaa muita vieraita valinnassa ja isäntää kehittymään.",
        "fr": "Votre avis aide les autres voyageurs à choisir et l'hôte à "
              "s'améliorer.",
        "ga": "Cabhraíonn do léirmheas le haíonna eile rogha a dhéanamh agus "
              "leis an óstach feabhas a chur air féin.",
        "hr": "Vaša recenzija pomaže drugim gostima pri odabiru, a domaćinu da "
              "postane bolji.",
        "hu": "Az értékelésed segít más vendégeknek a választásban, a "
              "házigazdának pedig a fejlődésben.",
        "it": "La tua recensione aiuta gli altri ospiti a scegliere e l'host a "
              "migliorare.",
        "lt": "Jūsų atsiliepimas padeda kitiems svečiams rinktis, o šeimininkui "
              "tobulėti.",
        "lv": "Jūsu atsauksme palīdz citiem viesiem izvēlēties un saimniekam "
              "kļūt labākam.",
        "mt": "Ir-reċensjoni tiegħek tgħin lil mistednin oħra jagħżlu u lill-"
              "ospitanti jitjieb.",
        "nl": "Je beoordeling helpt andere gasten bij hun keuze en de gastheer "
              "om beter te worden.",
        "pl": "Twoja opinia pomaga innym gościom w wyborze, a gospodarzowi w "
              "doskonaleniu się.",
        "pt": "A tua avaliação ajuda outros hóspedes a escolher e o anfitrião a "
              "melhorar.",
        "ro": "Recenzia ta îi ajută pe alți oaspeți să aleagă, iar pe gazdă să "
              "devină mai bună.",
        "sk": "Vaše hodnotenie pomáha ďalším hosťom pri výbere a hostiteľovi "
              "zlepšovať sa.",
        "sl": "Vaša ocena pomaga drugim gostom pri izbiri, gostitelju pa pri "
              "izboljšavah.",
        "sv": "Ditt omdöme hjälper andra gäster att välja och värden att bli "
              "bättre.",
    },
    "reviews.erinnerung.aktion": {
        "bg": "Оценете сега",
        "cs": "Ohodnotit nyní",
        "da": "Anmeld nu",
        "de": "Jetzt bewerten",
        "el": "Αξιολογήστε τώρα",
        "en": "Write a review",
        "es": "Valorar ahora",
        "et": "Anna hinnang",
        "fi": "Arvioi nyt",
        "fr": "Donner mon avis",
        "ga": "Scríobh léirmheas",
        "hr": "Ocijenite sada",
        "hu": "Értékelés most",
        "it": "Lascia una recensione",
        "lt": "Įvertinti dabar",
        "lv": "Novērtēt tagad",
        "mt": "Ikteb reċensjoni",
        "nl": "Nu beoordelen",
        "pl": "Oceń teraz",
        "pt": "Avaliar agora",
        "ro": "Evaluează acum",
        "sk": "Ohodnotiť teraz",
        "sl": "Ocenite zdaj",
        "sv": "Lämna omdöme",
    },
    "reviews.erinnerung.gruss": {
        "bg": "Благодарим Ви!",
        "cs": "Mnohokrát děkujeme!",
        "da": "Mange tak!",
        "de": "Vielen Dank!",
        "el": "Σας ευχαριστούμε πολύ!",
        "en": "Thank you very much!",
        "es": "¡Muchas gracias!",
        "et": "Suur tänu!",
        "fi": "Kiitos paljon!",
        "fr": "Merci beaucoup !",
        "ga": "Go raibh míle maith agat!",
        "hr": "Hvala vam puno!",
        "hu": "Köszönjük szépen!",
        "it": "Grazie mille!",
        "lt": "Labai ačiū!",
        "lv": "Liels paldies!",
        "mt": "Grazzi ħafna!",
        "nl": "Hartelijk dank!",
        "pl": "Serdecznie dziękujemy!",
        "pt": "Muito obrigado!",
        "ro": "Îți mulțumim mult!",
        "sk": "Ďakujeme pekne!",
        "sl": "Najlepša hvala!",
        "sv": "Tack så mycket!",
    },
    "reviews.erinnerung.objekt_fallback": {
        "bg": "престоя Ви",
        "cs": "vašeho pobytu",
        "da": "dit ophold",
        "de": "deinem Aufenthalt",
        "el": "της διαμονής σας",
        "en": "your stay",
        "es": "tu estancia",
        "et": "sinu peatumine",
        "fi": "oleskelusi",
        "fr": "votre séjour",
        "ga": "do chuairt",
        "hr": "vašem boravku",
        "hu": "a tartózkodásod",
        "it": "il tuo soggiorno",
        "lt": "jūsų viešnagė",
        "lv": "jūsu uzturēšanās",
        "mt": "is-soġġorn tiegħek",
        "nl": "je verblijf",
        "pl": "Twój pobyt",
        "pt": "a tua estadia",
        "ro": "sejurul tău",
        "sk": "vášho pobytu",
        "sl": "vašem bivanju",
        "sv": "din vistelse",
    },
    # -- Benachrichtigungen (notification_settings) -------------------------
    "benachrichtigung.aktion": {
        "bg": "Преглед в {marke}",
        "cs": "Zobrazit v {marke}",
        "da": "Se i {marke}",
        "de": "In {marke} ansehen",
        "el": "Προβολή στο {marke}",
        "en": "View in {marke}",
        "es": "Ver en {marke}",
        "et": "Vaata {marke}-s",
        "fi": "Näytä {marke}-palvelussa",
        "fr": "Voir dans {marke}",
        "ga": "Féach in {marke}",
        "hr": "Pogledaj u {marke}",
        "hu": "Megtekintés a {marke}-ban",
        "it": "Visualizza in {marke}",
        "lt": "Peržiūrėti {marke}",
        "lv": "Skatīt {marke}",
        "mt": "Ara f'{marke}",
        "nl": "Bekijken in {marke}",
        "pl": "Zobacz w {marke}",
        "pt": "Ver no {marke}",
        "ro": "Vezi în {marke}",
        "sk": "Zobraziť v {marke}",
        "sl": "Poglej v {marke}",
        "sv": "Visa i {marke}",
    },
    "benachrichtigung.aufgabe_neu": {
        "bg": "Нова задача: {titel}",
        "cs": "Nový úkol: {titel}",
        "da": "Ny opgave: {titel}",
        "de": "Neue Aufgabe: {titel}",
        "el": "Νέα εργασία: {titel}",
        "en": "New task: {titel}",
        "es": "Nueva tarea: {titel}",
        "et": "Uus ülesanne: {titel}",
        "fi": "Uusi tehtävä: {titel}",
        "fr": "Nouvelle tâche : {titel}",
        "ga": "Tasc nua: {titel}",
        "hr": "Novi zadatak: {titel}",
        "hu": "Új feladat: {titel}",
        "it": "Nuova attività: {titel}",
        "lt": "Nauja užduotis: {titel}",
        "lv": "Jauns uzdevums: {titel}",
        "mt": "Kompitu ġdid: {titel}",
        "nl": "Nieuwe taak: {titel}",
        "pl": "Nowe zadanie: {titel}",
        "pt": "Nova tarefa: {titel}",
        "ro": "Sarcină nouă: {titel}",
        "sk": "Nová úloha: {titel}",
        "sl": "Nova naloga: {titel}",
        "sv": "Ny uppgift: {titel}",
    },
    # --- Vertretung (0415) ------------------------------------------------
    # Drei Saetze: die Anfrage an moegliche Vertreter, die Uebernahme und die
    # Ablehnung zurueck an den Anfragenden. Der Titel IST die Meldung, deshalb
    # kein Fliesstext.
    "benachrichtigung.vertretung_gesucht": {
        "bg": "Търси се заместник: {titel}",
        "cs": "Hledá se zástup: {titel}",
        "da": "Afløser søges: {titel}",
        "de": "Vertretung gesucht: {titel}",
        "el": "Ζητείται αντικαταστάτης: {titel}",
        "en": "Cover needed: {titel}",
        "es": "Se busca sustituto: {titel}",
        "et": "Otsitakse asendajat: {titel}",
        "fi": "Etsitään sijaista: {titel}",
        "fr": "Remplacement recherché : {titel}",
        "ga": "Ionadaí ag teastáil: {titel}",
        "hr": "Traži se zamjena: {titel}",
        "hu": "Helyettes kell: {titel}",
        "it": "Cercasi sostituto: {titel}",
        "lt": "Ieškoma pavaduojančio: {titel}",
        "lv": "Meklē aizvietotāju: {titel}",
        "mt": "Bżonn ta' sostitut: {titel}",
        "nl": "Vervanging gezocht: {titel}",
        "pl": "Poszukiwane zastępstwo: {titel}",
        "pt": "Procura-se substituto: {titel}",
        "ro": "Se caută înlocuitor: {titel}",
        "sk": "Hľadá sa zástup: {titel}",
        "sl": "Iščemo nadomestilo: {titel}",
        "sv": "Ersättare sökes: {titel}",
    },
    "benachrichtigung.vertretung_uebernommen": {
        "bg": "{name} поема: {titel}",
        "cs": "{name} přebírá: {titel}",
        "da": "{name} overtager: {titel}",
        "de": "{name} übernimmt: {titel}",
        "el": "Ο/Η {name} αναλαμβάνει: {titel}",
        "en": "{name} is taking over: {titel}",
        "es": "{name} se hace cargo: {titel}",
        "et": "{name} võtab üle: {titel}",
        "fi": "{name} ottaa hoitaakseen: {titel}",
        "fr": "{name} prend le relais : {titel}",
        "ga": "Tá {name} ag glacadh ar láimh: {titel}",
        "hr": "{name} preuzima: {titel}",
        "hu": "{name} átveszi: {titel}",
        "it": "{name} subentra: {titel}",
        "lt": "{name} perima: {titel}",
        "lv": "{name} pārņem: {titel}",
        "mt": "{name} qed jieħu f'idejh: {titel}",
        "nl": "{name} neemt over: {titel}",
        "pl": "{name} przejmuje: {titel}",
        "pt": "{name} assume: {titel}",
        "ro": "{name} preia: {titel}",
        "sk": "{name} preberá: {titel}",
        "sl": "{name} prevzame: {titel}",
        "sv": "{name} tar över: {titel}",
    },
    "benachrichtigung.vertretung_abgelehnt": {
        "bg": "Заместването е отказано: {titel}",
        "cs": "Zástup odmítnut: {titel}",
        "da": "Afløsning afvist: {titel}",
        "de": "Vertretung abgelehnt: {titel}",
        "el": "Η αντικατάσταση απορρίφθηκε: {titel}",
        "en": "Cover declined: {titel}",
        "es": "Sustitución rechazada: {titel}",
        "et": "Asendamisest keelduti: {titel}",
        "fi": "Sijaisuus hylätty: {titel}",
        "fr": "Remplacement refusé : {titel}",
        "ga": "Diúltaíodh don ionadaíocht: {titel}",
        "hr": "Zamjena odbijena: {titel}",
        "hu": "Helyettesítés elutasítva: {titel}",
        "it": "Sostituzione rifiutata: {titel}",
        "lt": "Pavadavimo atsisakyta: {titel}",
        "lv": "Aizvietošana atteikta: {titel}",
        "mt": "Is-sostituzzjoni ġiet miċħuda: {titel}",
        "nl": "Vervanging afgewezen: {titel}",
        "pl": "Zastępstwo odrzucone: {titel}",
        "pt": "Substituição recusada: {titel}",
        "ro": "Înlocuire respinsă: {titel}",
        "sk": "Zástup zamietnutý: {titel}",
        "sl": "Nadomestilo zavrnjeno: {titel}",
        "sv": "Ersättning avvisad: {titel}",
    },
    "benachrichtigung.aufgabe_entzogen": {
        "bg": "Задачата вече не е при теб: {titel}",
        "cs": "Úkol už není tvůj: {titel}",
        "da": "Opgave ikke længere din: {titel}",
        "de": "Aufgabe nicht mehr bei dir: {titel}",
        "el": "Η εργασία δεν είναι πλέον δική σου: {titel}",
        "en": "Task reassigned: {titel}",
        "es": "La tarea ya no es tuya: {titel}",
        "et": "Ülesanne pole enam sinu oma: {titel}",
        "fi": "Tehtävä ei ole enää sinulla: {titel}",
        "fr": "Tâche réattribuée : {titel}",
        "ga": "Níl an tasc agat a thuilleadh: {titel}",
        "hr": "Zadatak više nije kod tebe: {titel}",
        "hu": "A feladat már nem a tiéd: {titel}",
        "it": "L'attività non è più tua: {titel}",
        "lt": "Užduotis nebe tavo: {titel}",
        "lv": "Uzdevums vairs nav tavs: {titel}",
        "mt": "Il-kompitu m'għadux tiegħek: {titel}",
        "nl": "Taak niet meer bij jou: {titel}",
        "pl": "Zadanie nie jest już twoje: {titel}",
        "pt": "A tarefa já não é tua: {titel}",
        "ro": "Sarcina nu mai este la tine: {titel}",
        "sk": "Úloha už nie je tvoja: {titel}",
        "sl": "Naloga ni več pri tebi: {titel}",
        "sv": "Uppgiften är inte längre din: {titel}",
    },
    "benachrichtigung.leistung_erledigt": {
        "bg": "Изпълнено: {titel}",
        "cs": "Hotovo: {titel}",
        "da": "Udført: {titel}",
        "de": "Erledigt: {titel}",
        "el": "Ολοκληρώθηκε: {titel}",
        "en": "Completed: {titel}",
        "es": "Completado: {titel}",
        "et": "Tehtud: {titel}",
        "fi": "Valmis: {titel}",
        "fr": "Terminé : {titel}",
        "ga": "Críochnaithe: {titel}",
        "hr": "Završeno: {titel}",
        "hu": "Kész: {titel}",
        "it": "Completato: {titel}",
        "lt": "Atlikta: {titel}",
        "lv": "Pabeigts: {titel}",
        "mt": "Lest: {titel}",
        "nl": "Voltooid: {titel}",
        "pl": "Wykonano: {titel}",
        "pt": "Concluído: {titel}",
        "ro": "Finalizat: {titel}",
        "sk": "Hotovo: {titel}",
        "sl": "Opravljeno: {titel}",
        "sv": "Klart: {titel}",
    },
    # Der Rumpf der Buchungsmeldung. Er trug bisher gar keinen Schlüssel, weil
    # er als „reine Datenzeile" galt (Vorname · Kanal) — der Kanal ist aber ein
    # übersetzbares Wort, kein Datum. Zwei Fassungen, weil der Vorname fehlen
    # kann (OTA-Import ohne Gästezeile): dann bliebe sonst ein führendes „ · ".
    "benachrichtigung.buchung_rumpf": {
        "bg": "{gast} · {kanal}", "cs": "{gast} · {kanal}",
        "da": "{gast} · {kanal}", "de": "{gast} · {kanal}",
        "el": "{gast} · {kanal}", "en": "{gast} · {kanal}",
        "es": "{gast} · {kanal}", "et": "{gast} · {kanal}",
        "fi": "{gast} · {kanal}", "fr": "{gast} · {kanal}",
        "ga": "{gast} · {kanal}", "hr": "{gast} · {kanal}",
        "hu": "{gast} · {kanal}", "it": "{gast} · {kanal}",
        "lt": "{gast} · {kanal}", "lv": "{gast} · {kanal}",
        "mt": "{gast} · {kanal}", "nl": "{gast} · {kanal}",
        "pl": "{gast} · {kanal}", "pt": "{gast} · {kanal}",
        "ro": "{gast} · {kanal}", "sk": "{gast} · {kanal}",
        "sl": "{gast} · {kanal}", "sv": "{gast} · {kanal}",
    },
    "benachrichtigung.buchung_rumpf_ohne_gast": {
        "bg": "{kanal}", "cs": "{kanal}", "da": "{kanal}", "de": "{kanal}",
        "el": "{kanal}", "en": "{kanal}", "es": "{kanal}", "et": "{kanal}",
        "fi": "{kanal}", "fr": "{kanal}", "ga": "{kanal}", "hr": "{kanal}",
        "hu": "{kanal}", "it": "{kanal}", "lt": "{kanal}", "lv": "{kanal}",
        "mt": "{kanal}", "nl": "{kanal}", "pl": "{kanal}", "pt": "{kanal}",
        "ro": "{kanal}", "sk": "{kanal}", "sl": "{kanal}", "sv": "{kanal}",
    },
    # -- Buchungskanäle ------------------------------------------------------
    # Die Kanalzeile der Buchungsmeldung („Vorname · Kanal") trug den ROHEN
    # Enum-Wert der Datenbank: der Eigentümer las „direct" statt „Direkt".
    # Bei OTA-Buchungen fiel das nicht auf, weil dort `ota_name` („Airbnb")
    # greift — nur der Direktfall zeigte den Enum. Die vier Markennamen
    # (Booking.com, Airbnb, Vrbo, myBestDays) bleiben in jeder Sprache gleich,
    # weil eine Marke kein übersetzbares Wort ist; übersetzt werden nur
    # „Direkt" und „Anderes Portal". Werte = `ReservationChannel`
    # (reservations/schemas.py); ein neuer Enum-Wert MUSS hier einen Eintrag
    # bekommen, sonst wirft `text()` (fail-closed, Wurzel 5).
    "kanal.direct": {
        "bg": "Директно", "cs": "Přímo", "da": "Direkte", "de": "Direkt",
        "el": "Απευθείας", "en": "Direct", "es": "Directa", "et": "Otse",
        "fi": "Suora", "fr": "Direct", "ga": "Díreach", "hr": "Izravno",
        "hu": "Közvetlen", "it": "Diretta", "lt": "Tiesiogiai",
        "lv": "Tieši", "mt": "Dirett", "nl": "Direct", "pl": "Bezpośrednio",
        "pt": "Direta", "ro": "Direct", "sk": "Priamo", "sl": "Neposredno",
        "sv": "Direkt",
    },
    "kanal.ota_other": {
        "bg": "Друг портал", "cs": "Jiný portál", "da": "Anden portal",
        "de": "Anderes Portal", "el": "Άλλη πύλη", "en": "Other portal",
        "es": "Otro portal", "et": "Muu portaal", "fi": "Muu portaali",
        "fr": "Autre portail", "ga": "Tairseach eile", "hr": "Drugi portal",
        "hu": "Másik portál", "it": "Altro portale", "lt": "Kitas portalas",
        "lv": "Cits portāls", "mt": "Portal ieħor", "nl": "Ander portaal",
        "pl": "Inny portal", "pt": "Outro portal", "ro": "Alt portal",
        "sk": "Iný portál", "sl": "Drug portal", "sv": "Annan portal",
    },
    "kanal.booking": {
        "bg": "Booking.com", "cs": "Booking.com", "da": "Booking.com",
        "de": "Booking.com", "el": "Booking.com", "en": "Booking.com",
        "es": "Booking.com", "et": "Booking.com", "fi": "Booking.com",
        "fr": "Booking.com", "ga": "Booking.com", "hr": "Booking.com",
        "hu": "Booking.com", "it": "Booking.com", "lt": "Booking.com",
        "lv": "Booking.com", "mt": "Booking.com", "nl": "Booking.com",
        "pl": "Booking.com", "pt": "Booking.com", "ro": "Booking.com",
        "sk": "Booking.com", "sl": "Booking.com", "sv": "Booking.com",
    },
    "kanal.airbnb": {
        "bg": "Airbnb", "cs": "Airbnb", "da": "Airbnb", "de": "Airbnb",
        "el": "Airbnb", "en": "Airbnb", "es": "Airbnb", "et": "Airbnb",
        "fi": "Airbnb", "fr": "Airbnb", "ga": "Airbnb", "hr": "Airbnb",
        "hu": "Airbnb", "it": "Airbnb", "lt": "Airbnb", "lv": "Airbnb",
        "mt": "Airbnb", "nl": "Airbnb", "pl": "Airbnb", "pt": "Airbnb",
        "ro": "Airbnb", "sk": "Airbnb", "sl": "Airbnb", "sv": "Airbnb",
    },
    "kanal.vrbo": {
        "bg": "Vrbo", "cs": "Vrbo", "da": "Vrbo", "de": "Vrbo",
        "el": "Vrbo", "en": "Vrbo", "es": "Vrbo", "et": "Vrbo",
        "fi": "Vrbo", "fr": "Vrbo", "ga": "Vrbo", "hr": "Vrbo",
        "hu": "Vrbo", "it": "Vrbo", "lt": "Vrbo", "lv": "Vrbo",
        "mt": "Vrbo", "nl": "Vrbo", "pl": "Vrbo", "pt": "Vrbo",
        "ro": "Vrbo", "sk": "Vrbo", "sl": "Vrbo", "sv": "Vrbo",
    },
    "kanal.portal": {
        "bg": "myBestDays", "cs": "myBestDays", "da": "myBestDays",
        "de": "myBestDays", "el": "myBestDays", "en": "myBestDays",
        "es": "myBestDays", "et": "myBestDays", "fi": "myBestDays",
        "fr": "myBestDays", "ga": "myBestDays", "hr": "myBestDays",
        "hu": "myBestDays", "it": "myBestDays", "lt": "myBestDays",
        "lv": "myBestDays", "mt": "myBestDays", "nl": "myBestDays",
        "pl": "myBestDays", "pt": "myBestDays", "ro": "myBestDays",
        "sk": "myBestDays", "sl": "myBestDays", "sv": "myBestDays",
    },
    "benachrichtigung.buchung_neu": {
        "bg": "Нова резервация: {objekt}",
        "cs": "Nová rezervace: {objekt}",
        "da": "Ny booking: {objekt}",
        "de": "Neue Buchung: {objekt}",
        "el": "Νέα κράτηση: {objekt}",
        "en": "New booking: {objekt}",
        "es": "Nueva reserva: {objekt}",
        "et": "Uus broneering: {objekt}",
        "fi": "Uusi varaus: {objekt}",
        "fr": "Nouvelle réservation : {objekt}",
        "ga": "Áirithint nua: {objekt}",
        "hr": "Nova rezervacija: {objekt}",
        "hu": "Új foglalás: {objekt}",
        "it": "Nuova prenotazione: {objekt}",
        "lt": "Nauja rezervacija: {objekt}",
        "lv": "Jauna rezervācija: {objekt}",
        "mt": "Booking ġdid: {objekt}",
        "nl": "Nieuwe boeking: {objekt}",
        "pl": "Nowa rezerwacja: {objekt}",
        "pt": "Nova reserva: {objekt}",
        "ro": "Rezervare nouă: {objekt}",
        "sk": "Nová rezervácia: {objekt}",
        "sl": "Nova rezervacija: {objekt}",
        "sv": "Ny bokning: {objekt}",
    },
    "benachrichtigung.buchung_geaendert": {
        "bg": "Променена резервация: {objekt}",
        "cs": "Změněná rezervace: {objekt}",
        "da": "Booking ændret: {objekt}",
        "de": "Buchung geändert: {objekt}",
        "el": "Η κράτηση άλλαξε: {objekt}",
        "en": "Booking changed: {objekt}",
        "es": "Reserva modificada: {objekt}",
        "et": "Broneering muudetud: {objekt}",
        "fi": "Varausta muutettu: {objekt}",
        "fr": "Réservation modifiée : {objekt}",
        "ga": "Áirithint athraithe: {objekt}",
        "hr": "Rezervacija promijenjena: {objekt}",
        "hu": "Foglalás módosítva: {objekt}",
        "it": "Prenotazione modificata: {objekt}",
        "lt": "Rezervacija pakeista: {objekt}",
        "lv": "Rezervācija mainīta: {objekt}",
        "mt": "Booking mibdul: {objekt}",
        "nl": "Boeking gewijzigd: {objekt}",
        "pl": "Rezerwacja zmieniona: {objekt}",
        "pt": "Reserva alterada: {objekt}",
        "ro": "Rezervare modificată: {objekt}",
        "sk": "Rezervácia zmenená: {objekt}",
        "sl": "Rezervacija spremenjena: {objekt}",
        "sv": "Bokning ändrad: {objekt}",
    },
    "benachrichtigung.buchung_storniert": {
        "bg": "Отменена резервация: {objekt}",
        "cs": "Zrušená rezervace: {objekt}",
        "da": "Booking annulleret: {objekt}",
        "de": "Buchung storniert: {objekt}",
        "el": "Η κράτηση ακυρώθηκε: {objekt}",
        "en": "Booking cancelled: {objekt}",
        "es": "Reserva cancelada: {objekt}",
        "et": "Broneering tühistatud: {objekt}",
        "fi": "Varaus peruttu: {objekt}",
        "fr": "Réservation annulée : {objekt}",
        "ga": "Áirithint curtha ar ceal: {objekt}",
        "hr": "Rezervacija otkazana: {objekt}",
        "hu": "Foglalás lemondva: {objekt}",
        "it": "Prenotazione annullata: {objekt}",
        "lt": "Rezervacija atšaukta: {objekt}",
        "lv": "Rezervācija atcelta: {objekt}",
        "mt": "Booking ikkanċellat: {objekt}",
        "nl": "Boeking geannuleerd: {objekt}",
        "pl": "Rezerwacja anulowana: {objekt}",
        "pt": "Reserva cancelada: {objekt}",
        "ro": "Rezervare anulată: {objekt}",
        "sk": "Rezervácia zrušená: {objekt}",
        "sl": "Rezervacija odpovedana: {objekt}",
        "sv": "Bokning avbokad: {objekt}",
    },
    # -- Sperranträge (calendar/sperrantraege) ------------------------------
    "sperrantrag.entschieden_genehmigt": {
        "bg": "Заявка за блокиране одобрена: {titel}",
        "cs": "Žádost o blokaci schválena: {titel}",
        "da": "Spærreanmodning godkendt: {titel}",
        "de": "Sperrantrag genehmigt: {titel}",
        "el": "Το αίτημα δέσμευσης εγκρίθηκε: {titel}",
        "en": "Block request approved: {titel}",
        "es": "Solicitud de bloqueo aprobada: {titel}",
        "et": "Sulgemistaotlus kinnitatud: {titel}",
        "fi": "Sulkupyyntö hyväksytty: {titel}",
        "fr": "Demande de blocage approuvée : {titel}",
        "ga": "Iarratas bactha ceadaithe: {titel}",
        "hr": "Zahtjev za blokadu odobren: {titel}",
        "hu": "Zárolási kérelem jóváhagyva: {titel}",
        "it": "Richiesta di blocco approvata: {titel}",
        "lt": "Blokavimo prašymas patvirtintas: {titel}",
        "lv": "Bloķēšanas pieprasījums apstiprināts: {titel}",
        "mt": "Talba għal imblukkar approvata: {titel}",
        "nl": "Blokkeerverzoek goedgekeurd: {titel}",
        "pl": "Wniosek o blokadę zatwierdzony: {titel}",
        "pt": "Pedido de bloqueio aprovado: {titel}",
        "ro": "Cerere de blocare aprobată: {titel}",
        "sk": "Žiadosť o blokáciu schválená: {titel}",
        "sl": "Zahteva za blokado odobrena: {titel}",
        "sv": "Spärrbegäran godkänd: {titel}",
    },
    "sperrantrag.entschieden_abgelehnt": {
        "bg": "Заявка за блокиране отхвърлена: {titel}",
        "cs": "Žádost o blokaci zamítnuta: {titel}",
        "da": "Spærreanmodning afvist: {titel}",
        "de": "Sperrantrag abgelehnt: {titel}",
        "el": "Το αίτημα δέσμευσης απορρίφθηκε: {titel}",
        "en": "Block request rejected: {titel}",
        "es": "Solicitud de bloqueo rechazada: {titel}",
        "et": "Sulgemistaotlus tagasi lükatud: {titel}",
        "fi": "Sulkupyyntö hylätty: {titel}",
        "fr": "Demande de blocage refusée : {titel}",
        "ga": "Iarratas bactha diúltaithe: {titel}",
        "hr": "Zahtjev za blokadu odbijen: {titel}",
        "hu": "Zárolási kérelem elutasítva: {titel}",
        "it": "Richiesta di blocco rifiutata: {titel}",
        "lt": "Blokavimo prašymas atmestas: {titel}",
        "lv": "Bloķēšanas pieprasījums noraidīts: {titel}",
        "mt": "Talba għal imblukkar miċħuda: {titel}",
        "nl": "Blokkeerverzoek afgewezen: {titel}",
        "pl": "Wniosek o blokadę odrzucony: {titel}",
        "pt": "Pedido de bloqueio recusado: {titel}",
        "ro": "Cerere de blocare respinsă: {titel}",
        "sk": "Žiadosť o blokáciu zamietnutá: {titel}",
        "sl": "Zahteva za blokado zavrnjena: {titel}",
        "sv": "Spärrbegäran avvisad: {titel}",
    },
    # Der Widerruf einer BEREITS genehmigten Sperre. Eigener Schlüssel statt
    # „abgelehnt": fachlich ist es etwas anderes — der Antrag war genehmigt und
    # die Nächte waren gesperrt; sie sind jetzt wieder frei. Für den Eigentümer
    # ist das die wichtigere Aussage.
    "sperrantrag.entschieden_zurueckgenommen": {
        "bg": "Заявка за блокиране оттеглена: {titel}",
        "cs": "Žádost o blokaci odvolána: {titel}",
        "da": "Spærreanmodning tilbagekaldt: {titel}",
        "de": "Sperrantrag zurückgenommen: {titel}",
        "el": "Το αίτημα δέσμευσης ανακλήθηκε: {titel}",
        "en": "Block request withdrawn: {titel}",
        "es": "Solicitud de bloqueo retirada: {titel}",
        "et": "Sulgemistaotlus tühistatud: {titel}",
        "fi": "Sulkupyyntö peruutettu: {titel}",
        "fr": "Demande de blocage retirée : {titel}",
        "ga": "Iarratas bactha tarraingthe siar: {titel}",
        "hr": "Zahtjev za blokadu povučen: {titel}",
        "hu": "Zárolási kérelem visszavonva: {titel}",
        "it": "Richiesta di blocco revocata: {titel}",
        "lt": "Blokavimo prašymas atšauktas: {titel}",
        "lv": "Bloķēšanas pieprasījums atsaukts: {titel}",
        "mt": "Talba għal imblukkar irtirata: {titel}",
        "nl": "Blokkeerverzoek ingetrokken: {titel}",
        "pl": "Wniosek o blokadę wycofany: {titel}",
        "pt": "Pedido de bloqueio retirado: {titel}",
        "ro": "Cerere de blocare retrasă: {titel}",
        "sk": "Žiadosť o blokáciu odvolaná: {titel}",
        "sl": "Zahteva za blokado umaknjena: {titel}",
        "sv": "Spärrbegäran återkallad: {titel}",
    },
    "sperrantrag.rumpf_zurueckgenommen": {
        "bg": "Вашата заявка за блокиране на {titel} ({zeitraum}) е оттеглена. "
              "Нощувките отново са свободни.",
        "cs": "Vaše žádost o blokaci {titel} ({zeitraum}) byla odvolána. Noci "
              "jsou opět volné.",
        "da": "Din spærreanmodning for {titel} ({zeitraum}) er tilbagekaldt. "
              "Nætterne er ledige igen.",
        "de": "Dein Sperrantrag für {titel} ({zeitraum}) wurde zurückgenommen. "
              "Die Nächte sind wieder frei.",
        "el": "Το αίτημα δέσμευσης για {titel} ({zeitraum}) ανακλήθηκε. Οι "
              "διανυκτερεύσεις είναι ξανά διαθέσιμες.",
        "en": "Your block request for {titel} ({zeitraum}) has been withdrawn. "
              "The nights are available again.",
        "es": "Tu solicitud de bloqueo para {titel} ({zeitraum}) ha sido "
              "retirada. Las noches vuelven a estar disponibles.",
        "et": "Sinu sulgemistaotlus objektile {titel} ({zeitraum}) on "
              "tühistatud. Ööd on taas vabad.",
        "fi": "Sulkupyyntösi kohteelle {titel} ({zeitraum}) on peruutettu. "
              "Yöt ovat taas vapaana.",
        "fr": "Ta demande de blocage pour {titel} ({zeitraum}) a été retirée. "
              "Les nuits sont de nouveau disponibles.",
        "ga": "Tarraingíodh siar d'iarratas bactha do {titel} ({zeitraum}). Tá "
              "na hoícheanta ar fáil arís.",
        "hr": "Vaš zahtjev za blokadu za {titel} ({zeitraum}) je povučen. Noći "
              "su ponovno slobodne.",
        "hu": "A(z) {titel} zárolási kérelmedet ({zeitraum}) visszavonták. Az "
              "éjszakák ismét szabadok.",
        "it": "La tua richiesta di blocco per {titel} ({zeitraum}) è stata "
              "revocata. Le notti sono di nuovo disponibili.",
        "lt": "Jūsų blokavimo prašymas objektui {titel} ({zeitraum}) atšauktas. "
              "Naktys vėl laisvos.",
        "lv": "Jūsu bloķēšanas pieprasījums objektam {titel} ({zeitraum}) ir "
              "atsaukts. Naktis atkal ir brīvas.",
        "mt": "It-talba tiegħek għal imblukkar ta' {titel} ({zeitraum}) ġiet "
              "irtirata. L-iljieli huma disponibbli mill-ġdid.",
        "nl": "Je blokkeerverzoek voor {titel} ({zeitraum}) is ingetrokken. De "
              "nachten zijn weer beschikbaar.",
        "pl": "Twój wniosek o blokadę {titel} ({zeitraum}) został wycofany. "
              "Noce są znów dostępne.",
        "pt": "O teu pedido de bloqueio para {titel} ({zeitraum}) foi retirado. "
              "As noites estão novamente disponíveis.",
        "ro": "Cererea ta de blocare pentru {titel} ({zeitraum}) a fost "
              "retrasă. Nopțile sunt din nou disponibile.",
        "sk": "Vaša žiadosť o blokáciu {titel} ({zeitraum}) bola odvolaná. Noci "
              "sú opäť voľné.",
        "sl": "Vaša zahteva za blokado {titel} ({zeitraum}) je bila umaknjena. "
              "Noči so spet proste.",
        "sv": "Din spärrbegäran för {titel} ({zeitraum}) har återkallats. "
              "Nätterna är lediga igen.",
    },
    "sperrantrag.neu": {
        "bg": "Нова заявка за блокиране: {titel}",
        "cs": "Nová žádost o blokaci: {titel}",
        "da": "Ny spærreanmodning: {titel}",
        "de": "Neuer Sperrantrag: {titel}",
        "el": "Νέο αίτημα δέσμευσης: {titel}",
        "en": "New block request: {titel}",
        "es": "Nueva solicitud de bloqueo: {titel}",
        "et": "Uus sulgemistaotlus: {titel}",
        "fi": "Uusi sulkupyyntö: {titel}",
        "fr": "Nouvelle demande de blocage : {titel}",
        "ga": "Iarratas bactha nua: {titel}",
        "hr": "Novi zahtjev za blokadu: {titel}",
        "hu": "Új zárolási kérelem: {titel}",
        "it": "Nuova richiesta di blocco: {titel}",
        "lt": "Naujas blokavimo prašymas: {titel}",
        "lv": "Jauns bloķēšanas pieprasījums: {titel}",
        "mt": "Talba ġdida għal imblukkar: {titel}",
        "nl": "Nieuw blokkeerverzoek: {titel}",
        "pl": "Nowy wniosek o blokadę: {titel}",
        "pt": "Novo pedido de bloqueio: {titel}",
        "ro": "Cerere nouă de blocare: {titel}",
        "sk": "Nová žiadosť o blokáciu: {titel}",
        "sl": "Nova zahteva za blokado: {titel}",
        "sv": "Ny spärrbegäran: {titel}",
    },
    # -- Airbnb-Zimmerhinweise (channel_manager/airbnb_zimmer_push) ---------
    "airbnb.zimmer_ohne_foto": {
        "bg": "{objekt}: {anzahl} стаи без снимка в Airbnb",
        "cs": "{objekt}: {anzahl} pokojů bez fotografie na Airbnb",
        "da": "{objekt}: {anzahl} værelser uden foto på Airbnb",
        "de": "{objekt}: {anzahl} Zimmer ohne Foto bei Airbnb",
        "el": "{objekt}: {anzahl} δωμάτια χωρίς φωτογραφία στο Airbnb",
        "en": "{objekt}: {anzahl} rooms without a photo on Airbnb",
        "es": "{objekt}: {anzahl} habitaciones sin foto en Airbnb",
        "et": "{objekt}: {anzahl} tuba ilma fotota Airbnb-s",
        "fi": "{objekt}: {anzahl} huonetta ilman kuvaa Airbnb:ssä",
        "fr": "{objekt} : {anzahl} chambres sans photo sur Airbnb",
        "ga": "{objekt}: {anzahl} seomra gan grianghraf ar Airbnb",
        "hr": "{objekt}: {anzahl} soba bez fotografije na Airbnbu",
        "hu": "{objekt}: {anzahl} szoba fénykép nélkül az Airbnb-n",
        "it": "{objekt}: {anzahl} camere senza foto su Airbnb",
        "lt": "{objekt}: {anzahl} kambariai be nuotraukos Airbnb",
        "lv": "{objekt}: {anzahl} istabas bez fotoattēla Airbnb",
        "mt": "{objekt}: {anzahl} kmamar mingħajr ritratt fuq Airbnb",
        "nl": "{objekt}: {anzahl} kamers zonder foto op Airbnb",
        "pl": "{objekt}: {anzahl} pokoi bez zdjęcia w Airbnb",
        "pt": "{objekt}: {anzahl} quartos sem fotografia no Airbnb",
        "ro": "{objekt}: {anzahl} camere fără fotografie pe Airbnb",
        "sk": "{objekt}: {anzahl} izieb bez fotografie na Airbnb",
        "sl": "{objekt}: {anzahl} sob brez fotografije na Airbnbju",
        "sv": "{objekt}: {anzahl} rum utan foto på Airbnb",
    },
    "airbnb.zimmer_noch_vorhanden": {
        "bg": "{objekt}: {anzahl} стаи все още налични в Airbnb",
        "cs": "{objekt}: {anzahl} pokojů na Airbnb stále existuje",
        "da": "{objekt}: {anzahl} værelser findes stadig på Airbnb",
        "de": "{objekt}: {anzahl} Zimmer bei Airbnb noch vorhanden",
        "el": "{objekt}: {anzahl} δωμάτια υπάρχουν ακόμη στο Airbnb",
        "en": "{objekt}: {anzahl} rooms still present on Airbnb",
        "es": "{objekt}: {anzahl} habitaciones aún presentes en Airbnb",
        "et": "{objekt}: {anzahl} tuba on Airbnb-s veel olemas",
        "fi": "{objekt}: {anzahl} huonetta on yhä Airbnb:ssä",
        "fr": "{objekt} : {anzahl} chambres encore présentes sur Airbnb",
        "ga": "{objekt}: {anzahl} seomra fós ar Airbnb",
        "hr": "{objekt}: {anzahl} soba još postoji na Airbnbu",
        "hu": "{objekt}: {anzahl} szoba még megtalálható az Airbnb-n",
        "it": "{objekt}: {anzahl} camere ancora presenti su Airbnb",
        "lt": "{objekt}: {anzahl} kambariai vis dar yra Airbnb",
        "lv": "{objekt}: {anzahl} istabas joprojām ir Airbnb",
        "mt": "{objekt}: {anzahl} kmamar għadhom fuq Airbnb",
        "nl": "{objekt}: {anzahl} kamers nog aanwezig op Airbnb",
        "pl": "{objekt}: {anzahl} pokoi nadal obecnych w Airbnb",
        "pt": "{objekt}: {anzahl} quartos ainda presentes no Airbnb",
        "ro": "{objekt}: {anzahl} camere încă prezente pe Airbnb",
        "sk": "{objekt}: {anzahl} izieb na Airbnb stále existuje",
        "sl": "{objekt}: {anzahl} sob je še vedno na Airbnbju",
        "sv": "{objekt}: {anzahl} rum finns kvar på Airbnb",
    },
    # -- Aufgabenkatalog 0330 (Systemvorgaben, Mail-Betreff) ----------------
    "aufgabe.endreinigung": {
        "bg": "Финално почистване", "cs": "Závěrečný úklid",
        "da": "Slutrengøring", "de": "Endreinigung", "el": "Τελικός καθαρισμός",
        "en": "Final cleaning", "es": "Limpieza final", "et": "Lõppkoristus",
        "fi": "Loppusiivous", "fr": "Ménage de fin de séjour",
        "ga": "Glanadh deiridh", "hr": "Završno čišćenje", "hu": "Végtakarítás",
        "it": "Pulizia finale", "lt": "Galutinis valymas",
        "lv": "Gala uzkopšana", "mt": "Tindif finali", "nl": "Eindschoonmaak",
        "pl": "Sprzątanie końcowe", "pt": "Limpeza final",
        "ro": "Curățenie finală", "sk": "Záverečné upratovanie",
        "sl": "Končno čiščenje", "sv": "Slutstädning",
    },
    "aufgabe.hauptreinigung": {
        "bg": "Основно почистване", "cs": "Hlavní úklid",
        "da": "Hovedrengøring", "de": "Hauptreinigung",
        "el": "Γενικός καθαρισμός", "en": "Deep cleaning",
        "es": "Limpieza a fondo", "et": "Suurpuhastus", "fi": "Perussiivous",
        "fr": "Grand ménage", "ga": "Glanadh domhain",
        "hr": "Glavno čišćenje", "hu": "Nagytakarítás",
        "it": "Pulizia approfondita", "lt": "Pagrindinis valymas",
        "lv": "Ģenerāltīrīšana", "mt": "Tindif fil-fond",
        "nl": "Grote schoonmaak", "pl": "Sprzątanie generalne",
        "pt": "Limpeza profunda", "ro": "Curățenie generală",
        "sk": "Hlavné upratovanie", "sl": "Glavno čiščenje",
        "sv": "Storstädning",
    },
    "aufgabe.fensterreinigung": {
        "bg": "Почистване на прозорци", "cs": "Mytí oken",
        "da": "Vinduespudsning", "de": "Fensterreinigung",
        "el": "Καθαρισμός τζαμιών", "en": "Window cleaning",
        "es": "Limpieza de ventanas", "et": "Akende pesu",
        "fi": "Ikkunanpesu", "fr": "Nettoyage des vitres",
        "ga": "Glanadh fuinneog", "hr": "Čišćenje prozora",
        "hu": "Ablaktisztítás", "it": "Pulizia dei vetri",
        "lt": "Langų valymas", "lv": "Logu mazgāšana", "mt": "Tindif tat-twieqi",
        "nl": "Ramen lappen", "pl": "Mycie okien", "pt": "Limpeza de janelas",
        "ro": "Curățarea geamurilor", "sk": "Umývanie okien",
        "sl": "Čiščenje oken", "sv": "Fönsterputsning",
    },
    "aufgabe.rasenmaehen": {
        "bg": "Косене на трева", "cs": "Sekání trávy",
        "da": "Græsslåning", "de": "Rasenmähen", "el": "Κούρεμα γκαζόν",
        "en": "Lawn mowing", "es": "Corte de césped", "et": "Muru niitmine",
        "fi": "Nurmikon leikkuu", "fr": "Tonte de la pelouse",
        "ga": "Faiche a lomadh", "hr": "Košnja trave", "hu": "Fűnyírás",
        "it": "Taglio del prato", "lt": "Vejos pjovimas",
        "lv": "Zāliena pļaušana", "mt": "Qtugħ tal-ħaxix",
        "nl": "Gras maaien", "pl": "Koszenie trawnika", "pt": "Corte da relva",
        "ro": "Tunderea gazonului", "sk": "Kosenie trávy",
        "sl": "Košnja trave", "sv": "Gräsklippning",
    },
    "aufgabe.terrassenreinigung": {
        "bg": "Почистване на тераса", "cs": "Úklid terasy",
        "da": "Terrasserengøring", "de": "Terrassenreinigung",
        "el": "Καθαρισμός βεράντας", "en": "Terrace cleaning",
        "es": "Limpieza de la terraza", "et": "Terrassi puhastus",
        "fi": "Terassin puhdistus", "fr": "Nettoyage de la terrasse",
        "ga": "Glanadh an ardáin", "hr": "Čišćenje terase",
        "hu": "Terasztisztítás", "it": "Pulizia della terrazza",
        "lt": "Terasos valymas", "lv": "Terases tīrīšana",
        "mt": "Tindif tat-terrazzin", "nl": "Terras reinigen",
        "pl": "Czyszczenie tarasu", "pt": "Limpeza do terraço",
        "ro": "Curățarea terasei", "sk": "Upratovanie terasy",
        "sl": "Čiščenje terase", "sv": "Terrassrengöring",
    },
    # -- Newsletter-Bestätigung (Double-Opt-in) ----------------------------
    # Diese Texte lagen bis hierher als ZWEITER 24-Sprachen-Katalog direkt
    # im Newsletter-Service (`_MAILTEXTE`). Zwei Kataloge für dieselbe Sache
    # heißen zwei Pflegeorte und zwei Wahrheiten — die Übersetzungen sind
    # unverändert von dort übernommen, nur ihr Ort ist jetzt derselbe wie
    # für jede andere Mail.
    "newsletter.bestaetigung.betreff": {
        "bg": "Моля, потвърдете записването си",
        "cs": "Potvrďte prosím své přihlášení",
        "da": "Bekræft venligst din tilmelding",
        "de": "Bitte bestätige deine Anmeldung",
        "el": "Επιβεβαιώστε την εγγραφή σας",
        "en": "Please confirm your subscription",
        "es": "Confirma tu suscripción",
        "et": "Palun kinnita oma registreerumine",
        "fi": "Vahvista tilauksesi",
        "fr": "Merci de confirmer votre inscription",
        "ga": "Deimhnigh do chlárú, le do thoil",
        "hr": "Potvrdite svoju prijavu",
        "hu": "Kérjük, erősítse meg a feliratkozását",
        "it": "Conferma la tua iscrizione",
        "lt": "Patvirtinkite savo registraciją",
        "lv": "Lūdzu, apstipriniet savu pieteikšanos",
        "mt": "Jekk jogħġbok ikkonferma r-reġistrazzjoni tiegħek",
        "nl": "Bevestig je aanmelding",
        "pl": "Potwierdź swój zapis",
        "pt": "Confirme a sua inscrição",
        "ro": "Vă rugăm să confirmați înscrierea",
        "sk": "Potvrďte prosím svoje prihlásenie",
        "sl": "Potrdite svojo prijavo",
        "sv": "Bekräfta din anmälan",
    },
    "newsletter.bestaetigung.absatz_1": {
        "bg": "Здравейте,",
        "cs": "Dobrý den,",
        "da": "Hej,",
        "de": "Hallo,",
        "el": "Γεια σας,",
        "en": "Hi,",
        "es": "Hola:",
        "et": "Tere,",
        "fi": "Hei,",
        "fr": "Bonjour,",
        "ga": "Dia duit,",
        "hr": "Pozdrav,",
        "hu": "Üdvözöljük,",
        "it": "Ciao,",
        "lt": "Sveiki,",
        "lv": "Sveiki!",
        "mt": "Bonġu,",
        "nl": "Hallo,",
        "pl": "Dzień dobry,",
        "pt": "Olá,",
        "ro": "Bună ziua,",
        "sk": "Dobrý deň,",
        "sl": "Pozdravljeni,",
        "sv": "Hej,",
    },
    "newsletter.bestaetigung.absatz_2": {
        "bg": "записахте се за новини от myNextDays. Моля, потвърдете "
              "адреса си с едно кликване:",
        "cs": "přihlásili jste se k odběru novinek od myNextDays. "
              "Potvrďte prosím svou adresu jedním kliknutím:",
        "da": "du har tilmeldt dig nyheder fra myNextDays. Bekræft "
              "venligst din adresse med ét klik:",
        "de": "du hast dich für Neuigkeiten von myNextDays angemeldet. "
              "Bitte bestätige deine Adresse mit einem Klick:",
        "el": "εγγραφήκατε για να λαμβάνετε νέα από το myNextDays. "
              "Επιβεβαιώστε τη διεύθυνσή σας με ένα κλικ:",
        "en": "you signed up for news from myNextDays. Please confirm "
              "your address with one click:",
        "es": "te has apuntado para recibir novedades de myNextDays. "
              "Confirma tu dirección con un clic:",
        "et": "registreerusid myNextDaysi uudiste saamiseks. Palun "
              "kinnita oma aadress ühe klikiga:",
        "fi": "olet tilannut uutisia myNextDaysilta. Vahvista osoitteesi "
              "yhdellä klikkauksella:",
        "fr": "vous vous êtes inscrit aux nouvelles de myNextDays. Merci "
              "de confirmer votre adresse en un clic :",
        "ga": "chláraigh tú le haghaidh nuachta ó myNextDays. Deimhnigh "
              "do sheoladh le cliceáil amháin, le do thoil:",
        "hr": "prijavili ste se na novosti od myNextDaysa. Potvrdite "
              "svoju adresu jednim klikom:",
        "hu": "feliratkozott a myNextDays híreire. Kérjük, erősítse meg a "
              "címét egyetlen kattintással:",
        "it": "ti sei iscritto alle novità di myNextDays. Conferma il tuo "
              "indirizzo con un clic:",
        "lt": "užsiregistravote gauti myNextDays naujienas. Patvirtinkite "
              "savo adresą vienu spustelėjimu:",
        "lv": "Jūs pieteicāties myNextDays jaunumiem. Lūdzu, apstipriniet "
              "savu adresi ar vienu klikšķi:",
        "mt": "irreġistrajt għall-aħbarijiet ta' myNextDays. Jekk "
              "jogħġbok ikkonferma l-indirizz tiegħek bi klikk waħda:",
        "nl": "je hebt je aangemeld voor nieuws van myNextDays. Bevestig "
              "je adres met één klik:",
        "pl": "zapisałeś się na nowości od myNextDays. Potwierdź swój "
              "adres jednym kliknięciem:",
        "pt": "inscreveu-se para receber novidades do myNextDays. "
              "Confirme o seu endereço com um clique:",
        "ro": "v-ați înscris pentru noutăți de la myNextDays. Vă rugăm să "
              "confirmați adresa cu un clic:",
        "sk": "prihlásili ste sa na odber noviniek od myNextDays. "
              "Potvrďte prosím svoju adresu jedným kliknutím:",
        "sl": "prijavili ste se na novice myNextDays. Potrdite svoj "
              "naslov z enim klikom:",
        "sv": "du har anmält dig till nyheter från myNextDays. Bekräfta "
              "din adress med ett klick:",
    },
    "newsletter.bestaetigung.absatz_3": {
        "bg": "Връзката е валидна 7 дни и може да се използва само "
              "веднъж. Ако не сте се записвали, просто игнорирайте това "
              "писмо — без потвърждение не се случва нищо.",
        "cs": "Odkaz platí 7 dní a lze jej použít pouze jednou. Pokud "
              "jste se nepřihlašovali, tento e-mail ignorujte — bez "
              "potvrzení se nic nestane.",
        "da": "Linket gælder i 7 dage og kan kun bruges én gang. Har du "
              "ikke tilmeldt dig, så se bort fra denne mail — uden "
              "bekræftelse sker der ingenting.",
        "de": "Der Link ist 7 Tage gültig und nur einmal verwendbar. Wenn "
              "du dich nicht angemeldet hast, ignoriere diese Mail "
              "einfach — ohne Bestätigung passiert nichts.",
        "el": "Ο σύνδεσμος ισχύει για 7 ημέρες και μπορεί να "
              "χρησιμοποιηθεί μία φορά. Αν δεν κάνατε εσείς την εγγραφή, "
              "αγνοήστε αυτό το μήνυμα — χωρίς επιβεβαίωση δεν συμβαίνει "
              "τίποτα.",
        "en": "The link is valid for 7 days and can be used once. If you "
              "did not sign up, just ignore this email — nothing happens "
              "without confirmation.",
        "es": "El enlace es válido durante 7 días y solo se puede usar "
              "una vez. Si no te has apuntado, ignora este correo: sin "
              "confirmación no ocurre nada.",
        "et": "Link kehtib 7 päeva ja seda saab kasutada üks kord. Kui sa "
              "ei registreerunud, jäta see kiri lihtsalt tähelepanuta — "
              "ilma kinnituseta ei juhtu midagi.",
        "fi": "Linkki on voimassa 7 päivää ja sen voi käyttää kerran. Jos "
              "et ole tilannut, jätä tämä viesti huomiotta — ilman "
              "vahvistusta ei tapahdu mitään.",
        "fr": "Le lien est valable 7 jours et utilisable une seule fois. "
              "Si vous n'êtes pas à l'origine de cette inscription, "
              "ignorez simplement ce message — sans confirmation, rien ne "
              "se passe.",
        "ga": "Tá an nasc bailí ar feadh 7 lá agus is féidir é a úsáid "
              "uair amháin. Mura ndearna tú clárú, déan neamhaird den "
              "ríomhphost seo — ní tharlaíonn aon rud gan deimhniú.",
        "hr": "Poveznica vrijedi 7 dana i može se upotrijebiti jednom. "
              "Ako se niste prijavili, jednostavno zanemarite ovu poruku "
              "— bez potvrde se ništa ne događa.",
        "hu": "A link 7 napig érvényes, és egyszer használható. Ha nem Ön "
              "iratkozott fel, egyszerűen hagyja figyelmen kívül ezt a "
              "levelet — megerősítés nélkül nem történik semmi.",
        "it": "Il link è valido 7 giorni e può essere usato una sola "
              "volta. Se non ti sei iscritto, ignora questa e-mail: senza "
              "conferma non succede nulla.",
        "lt": "Nuoroda galioja 7 dienas ir gali būti panaudota vieną "
              "kartą. Jei neužsiregistravote, tiesiog nepaisykite šio "
              "laiško — be patvirtinimo niekas neįvyks.",
        "lv": "Saite ir derīga 7 dienas un izmantojama vienu reizi. Ja "
              "nepieteicāties, vienkārši ignorējiet šo vēstuli — bez "
              "apstiprinājuma nekas nenotiek.",
        "mt": "Il-link tgħodd għal 7 ijiem u tista' tintuża darba. Jekk "
              "ma rreġistrajtx int, sempliċiment injora din l-email — "
              "mingħajr konferma ma jiġri xejn.",
        "nl": "De link is 7 dagen geldig en kan één keer worden gebruikt. "
              "Heb je je niet aangemeld, negeer dan deze e-mail — zonder "
              "bevestiging gebeurt er niets.",
        "pl": "Link jest ważny 7 dni i można go użyć raz. Jeśli to nie Ty "
              "się zapisywałeś, po prostu zignoruj tę wiadomość — bez "
              "potwierdzenia nic się nie dzieje.",
        "pt": "A ligação é válida durante 7 dias e pode ser usada uma "
              "vez. Se não se inscreveu, ignore este e-mail — sem "
              "confirmação não acontece nada.",
        "ro": "Linkul este valabil 7 zile și poate fi folosit o singură "
              "dată. Dacă nu v-ați înscris, ignorați acest e-mail — fără "
              "confirmare nu se întâmplă nimic.",
        "sk": "Odkaz platí 7 dní a možno ho použiť raz. Ak ste sa "
              "neprihlasovali, tento e-mail jednoducho ignorujte — bez "
              "potvrdenia sa nič nestane.",
        "sl": "Povezava velja 7 dni in jo je mogoče uporabiti enkrat. Če "
              "se niste prijavili, to sporočilo preprosto prezrite — brez "
              "potrditve se ne zgodi nič.",
        "sv": "Länken gäller i 7 dagar och kan användas en gång. Har du "
              "inte anmält dig kan du bortse från det här mejlet — utan "
              "bekräftelse händer ingenting.",
    },
    # -- Rümpfe der Sperrantrags-Mails --------------------------------------
    # Betreff und Rumpf sind verschiedene Sätze und brauchen darum eigene
    # Schlüssel: der Betreff nennt Entscheidung und Objekt, der Rumpf den
    # Zeitraum dazu. Der Rumpf ging bis hierher hart deutsch raus, während der
    # Betreff schon übersetzt war — eine Mail, die in der Mitte die Sprache
    # wechselt.
    # `{zeitraum}` ist ein bereits formatierter Datumsbereich; die Formatierung
    # selbst passiert in `mail_datum` in der Sprache des Empfängers, damit hier
    # keine 24. Datumsregel steht.
    "sperrantrag.freigabe": {
        "bg": "Желание за блокиране от Вашето семейство: {titel}",
        "cs": "Přání blokace z Vaší rodiny: {titel}",
        "da": "Spærreønske fra din familie: {titel}",
        "de": "Sperrwunsch aus deiner Familie: {titel}",
        "el": "Επιθυμία δέσμευσης από την οικογένειά σας: {titel}",
        "en": "Block request from your family: {titel}",
        "es": "Solicitud de bloqueo de tu familia: {titel}",
        "et": "Sulgemissoov sinu perelt: {titel}",
        "fi": "Sulkutoive perheeltäsi: {titel}",
        "fr": "Souhait de blocage de ta famille : {titel}",
        "ga": "Iarratas bactha ó do theaghlach: {titel}",
        "hr": "Želja za blokadom iz Vaše obitelji: {titel}",
        "hu": "Zárolási kérés a családodtól: {titel}",
        "it": "Richiesta di blocco dalla tua famiglia: {titel}",
        "lt": "Blokavimo pageidavimas iš Jūsų šeimos: {titel}",
        "lv": "Bloķēšanas vēlme no Jūsu ģimenes: {titel}",
        "mt": "Xewqa ta' mblukkar mill-familja tiegħek: {titel}",
        "nl": "Blokkeerwens uit je familie: {titel}",
        "pl": "Prośba o blokadę od Twojej rodziny: {titel}",
        "pt": "Pedido de bloqueio da tua família: {titel}",
        "ro": "Dorință de blocare din familia ta: {titel}",
        "sk": "Želanie blokácie z Vašej rodiny: {titel}",
        "sl": "Želja po blokadi iz Vaše družine: {titel}",
        "sv": "Spärrönskemål från din familj: {titel}",
    },
    # Der Name des Antragstellers steht VORNE, statt ihn zu umschreiben („ein
    # Zugang deiner Familie"): Das überträgt sich in jede der 24 Sprachen
    # natürlich, und der Eigentümer liest sofort, WER etwas möchte.
    #
    # In cs/sk/sl/mt fehlt bewusst die Entsprechung von „selbst": Diese
    # Sprachen bilden das mit einem Wort, das ein Geschlecht trägt (sám/huwa
    # stess) und im Dict nicht beugbar ist. Ein maskuliner Default läse falsch,
    # sobald die Tochter den Antrag stellt — der Satz ist ohne dieses Wort
    # vollständig, also entfällt es dort (Wurzel 4: lieber weglassen als raten).
    "sperrantrag.rumpf_freigabe": {
        "bg": "{antragsteller} желае да ползва {titel} през периода {zeitraum}. "
              "Желанието се изпраща към управлението едва след Вашето одобрение.",
        "cs": "{antragsteller} chce {titel} využít v období {zeitraum}. "
              "Přání se odešle správě až po Vašem schválení.",
        "da": "{antragsteller} vil selv benytte {titel} i perioden {zeitraum}. "
              "Ønsket sendes først til forvaltningen efter din godkendelse.",
        "de": "{antragsteller} möchte {titel} im Zeitraum {zeitraum} selbst "
              "nutzen. Der Wunsch geht erst nach deiner Freigabe an die "
              "Verwaltung.",
        "el": "Ο/Η {antragsteller} θέλει να χρησιμοποιήσει το {titel} για την "
              "περίοδο {zeitraum}. Το αίτημα προωθείται στη διαχείριση μόνο "
              "μετά την έγκρισή σας.",
        "en": "{antragsteller} would like to use {titel} personally during "
              "{zeitraum}. The request only goes to the management team after "
              "your approval.",
        "es": "{antragsteller} quiere usar {titel} personalmente durante el "
              "periodo {zeitraum}. La solicitud se envía a la administración "
              "solo después de tu aprobación.",
        "et": "{antragsteller} soovib objekti {titel} ise kasutada perioodil "
              "{zeitraum}. Soov läheb haldusele alles pärast sinu kinnitust.",
        "fi": "{antragsteller} haluaa käyttää kohdetta {titel} itse ajalla "
              "{zeitraum}. Toive menee hallinnolle vasta sinun hyväksyntäsi "
              "jälkeen.",
        "fr": "{antragsteller} souhaite utiliser {titel} personnellement sur "
              "la période {zeitraum}. La demande n'est transmise à la gestion "
              "qu'après ton accord.",
        "ga": "Ba mhaith le {antragsteller} {titel} a úsáid go pearsanta le "
              "linn {zeitraum}. Ní théann an t-iarratas chuig an mbainistíocht "
              "ach tar éis duit é a cheadú.",
        "hr": "{antragsteller} želi koristiti {titel} u razdoblju "
              "{zeitraum}. Želja se šalje upravi tek nakon Vašeg odobrenja.",
        "hu": "{antragsteller} maga szeretné használni a következőt: {titel} a "
              "{zeitraum} időszakban. A kérés csak a jóváhagyásod után jut el "
              "az üzemeltetéshez.",
        "it": "{antragsteller} desidera utilizzare personalmente {titel} nel "
              "periodo {zeitraum}. La richiesta viene inoltrata alla gestione "
              "solo dopo la tua approvazione.",
        "lt": "{antragsteller} nori pats naudotis objektu {titel} laikotarpiu "
              "{zeitraum}. Pageidavimas administracijai perduodamas tik po "
              "Jūsų patvirtinimo.",
        "lv": "{antragsteller} vēlas pats izmantot objektu {titel} laikposmā "
              "{zeitraum}. Vēlme tiek nosūtīta pārvaldei tikai pēc Jūsu "
              "apstiprinājuma.",
        "mt": "{antragsteller} jixtieq juża {titel} fil-perjodu "
              "{zeitraum}. It-talba tintbagħat lill-amministrazzjoni biss wara "
              "l-approvazzjoni tiegħek.",
        "nl": "{antragsteller} wil {titel} in de periode {zeitraum} zelf "
              "gebruiken. Het verzoek gaat pas na jouw goedkeuring naar het "
              "beheer.",
        "pl": "{antragsteller} chce samodzielnie korzystać z {titel} w okresie "
              "{zeitraum}. Prośba trafia do zarządu dopiero po Twoim "
              "zatwierdzeniu.",
        "pt": "{antragsteller} pretende utilizar {titel} pessoalmente no "
              "período {zeitraum}. O pedido só segue para a gestão após a tua "
              "aprovação.",
        "ro": "{antragsteller} dorește să folosească personal {titel} în "
              "perioada {zeitraum}. Cererea ajunge la administrație abia după "
              "aprobarea ta.",
        "sk": "{antragsteller} chce {titel} využiť v období {zeitraum}. "
              "Želanie sa odošle správe až po Vašom schválení.",
        "sl": "{antragsteller} želi {titel} uporabljati v obdobju {zeitraum}. "
              "Želja se pošlje upravi šele po Vaši odobritvi.",
        "sv": "{antragsteller} vill själv använda {titel} under perioden "
              "{zeitraum}. Önskemålet går till förvaltningen först efter ditt "
              "godkännande.",
    },
    "sperrantrag.rumpf_genehmigt": {
        "bg": "Вашата заявка за блокиране на {titel} ({zeitraum}) е одобрена.",
        "cs": "Vaše žádost o blokaci {titel} ({zeitraum}) byla schválena.",
        "da": "Din spærreanmodning for {titel} ({zeitraum}) er godkendt.",
        "de": "Dein Sperrantrag für {titel} ({zeitraum}) wurde genehmigt.",
        "el": "Το αίτημα δέσμευσης για {titel} ({zeitraum}) εγκρίθηκε.",
        "en": "Your block request for {titel} ({zeitraum}) has been approved.",
        "es": "Tu solicitud de bloqueo para {titel} ({zeitraum}) ha sido aprobada.",
        "et": "Sinu sulgemistaotlus objektile {titel} ({zeitraum}) on kinnitatud.",
        "fi": "Sulkupyyntösi kohteelle {titel} ({zeitraum}) on hyväksytty.",
        "fr": "Ta demande de blocage pour {titel} ({zeitraum}) a été approuvée.",
        "ga": "Ceadaíodh d'iarratas bactha do {titel} ({zeitraum}).",
        "hr": "Vaš zahtjev za blokadu za {titel} ({zeitraum}) je odobren.",
        "hu": "A(z) {titel} zárolási kérelmedet ({zeitraum}) jóváhagyták.",
        "it": "La tua richiesta di blocco per {titel} ({zeitraum}) è stata approvata.",
        "lt": "Jūsų blokavimo prašymas objektui {titel} ({zeitraum}) patvirtintas.",
        "lv": "Jūsu bloķēšanas pieprasījums objektam {titel} ({zeitraum}) ir apstiprināts.",
        "mt": "It-talba tiegħek għal imblukkar ta' {titel} ({zeitraum}) ġiet approvata.",
        "nl": "Je blokkeerverzoek voor {titel} ({zeitraum}) is goedgekeurd.",
        "pl": "Twój wniosek o blokadę {titel} ({zeitraum}) został zatwierdzony.",
        "pt": "O teu pedido de bloqueio para {titel} ({zeitraum}) foi aprovado.",
        "ro": "Cererea ta de blocare pentru {titel} ({zeitraum}) a fost aprobată.",
        "sk": "Vaša žiadosť o blokáciu {titel} ({zeitraum}) bola schválená.",
        "sl": "Vaša zahteva za blokado {titel} ({zeitraum}) je bila odobrena.",
        "sv": "Din spärrbegäran för {titel} ({zeitraum}) har godkänts.",
    },
    "sperrantrag.rumpf_abgelehnt": {
        "bg": "Вашата заявка за блокиране на {titel} ({zeitraum}) е отхвърлена.",
        "cs": "Vaše žádost o blokaci {titel} ({zeitraum}) byla zamítnuta.",
        "da": "Din spærreanmodning for {titel} ({zeitraum}) er afvist.",
        "de": "Dein Sperrantrag für {titel} ({zeitraum}) wurde abgelehnt.",
        "el": "Το αίτημα δέσμευσης για {titel} ({zeitraum}) απορρίφθηκε.",
        "en": "Your block request for {titel} ({zeitraum}) has been rejected.",
        "es": "Tu solicitud de bloqueo para {titel} ({zeitraum}) ha sido rechazada.",
        "et": "Sinu sulgemistaotlus objektile {titel} ({zeitraum}) lükati tagasi.",
        "fi": "Sulkupyyntösi kohteelle {titel} ({zeitraum}) on hylätty.",
        "fr": "Ta demande de blocage pour {titel} ({zeitraum}) a été refusée.",
        "ga": "Diúltaíodh d'iarratas bactha do {titel} ({zeitraum}).",
        "hr": "Vaš zahtjev za blokadu za {titel} ({zeitraum}) je odbijen.",
        "hu": "A(z) {titel} zárolási kérelmedet ({zeitraum}) elutasították.",
        "it": "La tua richiesta di blocco per {titel} ({zeitraum}) è stata rifiutata.",
        "lt": "Jūsų blokavimo prašymas objektui {titel} ({zeitraum}) atmestas.",
        "lv": "Jūsu bloķēšanas pieprasījums objektam {titel} ({zeitraum}) ir noraidīts.",
        "mt": "It-talba tiegħek għal imblukkar ta' {titel} ({zeitraum}) ġiet miċħuda.",
        "nl": "Je blokkeerverzoek voor {titel} ({zeitraum}) is afgewezen.",
        "pl": "Twój wniosek o blokadę {titel} ({zeitraum}) został odrzucony.",
        "pt": "O teu pedido de bloqueio para {titel} ({zeitraum}) foi recusado.",
        "ro": "Cererea ta de blocare pentru {titel} ({zeitraum}) a fost respinsă.",
        "sk": "Vaša žiadosť o blokáciu {titel} ({zeitraum}) bola zamietnutá.",
        "sl": "Vaša zahteva za blokado {titel} ({zeitraum}) je bila zavrnjena.",
        "sv": "Din spärrbegäran för {titel} ({zeitraum}) har avvisats.",
    },
    "sperrantrag.rumpf_neu": {
        "bg": "Собственик иска да блокира {titel} ({zeitraum}).",
        "cs": "Vlastník chce zablokovat {titel} ({zeitraum}).",
        "da": "En ejer ønsker at spærre {titel} ({zeitraum}).",
        "de": "Ein Eigentümer möchte {titel} sperren ({zeitraum}).",
        "el": "Ένας ιδιοκτήτης θέλει να δεσμεύσει το {titel} ({zeitraum}).",
        "en": "An owner wants to block {titel} ({zeitraum}).",
        "es": "Un propietario quiere bloquear {titel} ({zeitraum}).",
        "et": "Omanik soovib sulgeda objekti {titel} ({zeitraum}).",
        "fi": "Omistaja haluaa sulkea kohteen {titel} ({zeitraum}).",
        "fr": "Un propriétaire souhaite bloquer {titel} ({zeitraum}).",
        "ga": "Ba mhaith le húinéir {titel} a bhacadh ({zeitraum}).",
        "hr": "Vlasnik želi blokirati {titel} ({zeitraum}).",
        "hu": "Egy tulajdonos zárolni szeretné a következőt: {titel} ({zeitraum}).",
        "it": "Un proprietario desidera bloccare {titel} ({zeitraum}).",
        "lt": "Savininkas nori užblokuoti {titel} ({zeitraum}).",
        "lv": "Īpašnieks vēlas bloķēt {titel} ({zeitraum}).",
        "mt": "Sid irid jimblokka {titel} ({zeitraum}).",
        "nl": "Een eigenaar wil {titel} blokkeren ({zeitraum}).",
        "pl": "Właściciel chce zablokować {titel} ({zeitraum}).",
        "pt": "Um proprietário pretende bloquear {titel} ({zeitraum}).",
        "ro": "Un proprietar dorește să blocheze {titel} ({zeitraum}).",
        "sk": "Vlastník chce zablokovať {titel} ({zeitraum}).",
        "sl": "Lastnik želi blokirati {titel} ({zeitraum}).",
        "sv": "En ägare vill spärra {titel} ({zeitraum}).",
    },
    # Anmerkung/Begründung hängen als eigener Absatz an den Rumpf. Eigener
    # Schlüssel statt eines Satzendes im Rumpf, weil sie OPTIONAL sind: fehlt
    # die Notiz, darf kein leeres „Anmerkung:" dastehen.
    "sperrantrag.anmerkung": {
        "bg": "Забележка: {notiz}",
        "cs": "Poznámka: {notiz}",
        "da": "Bemærkning: {notiz}",
        "de": "Anmerkung: {notiz}",
        "el": "Σημείωση: {notiz}",
        "en": "Note: {notiz}",
        "es": "Nota: {notiz}",
        "et": "Märkus: {notiz}",
        "fi": "Huomautus: {notiz}",
        "fr": "Remarque : {notiz}",
        "ga": "Nóta: {notiz}",
        "hr": "Napomena: {notiz}",
        "hu": "Megjegyzés: {notiz}",
        "it": "Nota: {notiz}",
        "lt": "Pastaba: {notiz}",
        "lv": "Piezīme: {notiz}",
        "mt": "Nota: {notiz}",
        "nl": "Opmerking: {notiz}",
        "pl": "Uwaga: {notiz}",
        "pt": "Observação: {notiz}",
        "ro": "Observație: {notiz}",
        "sk": "Poznámka: {notiz}",
        "sl": "Opomba: {notiz}",
        "sv": "Anmärkning: {notiz}",
    },
    "sperrantrag.begruendung": {
        "bg": "Основание: {grund}",
        "cs": "Odůvodnění: {grund}",
        "da": "Begrundelse: {grund}",
        "de": "Begründung: {grund}",
        "el": "Αιτιολογία: {grund}",
        "en": "Reason: {grund}",
        "es": "Motivo: {grund}",
        "et": "Põhjendus: {grund}",
        "fi": "Perustelu: {grund}",
        "fr": "Motif : {grund}",
        "ga": "Cúis: {grund}",
        "hr": "Obrazloženje: {grund}",
        "hu": "Indoklás: {grund}",
        "it": "Motivo: {grund}",
        "lt": "Priežastis: {grund}",
        "lv": "Pamatojums: {grund}",
        "mt": "Raġuni: {grund}",
        "nl": "Reden: {grund}",
        "pl": "Uzasadnienie: {grund}",
        "pt": "Motivo: {grund}",
        "ro": "Motiv: {grund}",
        "sk": "Odôvodnenie: {grund}",
        "sl": "Utemeljitev: {grund}",
        "sv": "Motivering: {grund}",
    },
    # -- Rümpfe der Airbnb-Zimmermeldungen ----------------------------------
    "airbnb.rumpf_ohne_foto": {
        "bg": "Airbnb показва обиколката със снимки само ако всяка стая има "
              "снимка. Засегнати: {raeume}",
        "cs": "Airbnb zobrazuje fotoprohlídku pouze tehdy, má-li každý pokoj "
              "fotografii. Dotčeno: {raeume}",
        "da": "Airbnb viser kun fototuren, hvis hvert værelse har et foto. "
              "Berørt: {raeume}",
        "de": "Airbnb zeigt Gästen die Fototour nur, wenn jedes Zimmer ein "
              "Foto hat. Betroffen: {raeume}",
        "el": "Το Airbnb εμφανίζει τη φωτογραφική περιήγηση μόνο αν κάθε "
              "δωμάτιο έχει φωτογραφία. Επηρεάζονται: {raeume}",
        "en": "Airbnb only shows the photo tour if every room has a photo. "
              "Affected: {raeume}",
        "es": "Airbnb solo muestra el recorrido fotográfico si cada "
              "habitación tiene una foto. Afectadas: {raeume}",
        "et": "Airbnb näitab fotoringkäiku ainult siis, kui igal toal on "
              "foto. Puudutatud: {raeume}",
        "fi": "Airbnb näyttää valokuvakierroksen vain, jos jokaisessa "
              "huoneessa on kuva. Koskee: {raeume}",
        "fr": "Airbnb n'affiche la visite photo que si chaque chambre a une "
              "photo. Concernées : {raeume}",
        "ga": "Ní thaispeánann Airbnb an turas grianghraf ach amháin má tá "
              "grianghraf ag gach seomra. I gceist: {raeume}",
        "hr": "Airbnb prikazuje foto-obilazak samo ako svaka soba ima "
              "fotografiju. Zahvaćeno: {raeume}",
        "hu": "Az Airbnb csak akkor mutatja a fotótúrát, ha minden szobához "
              "tartozik fénykép. Érintett: {raeume}",
        "it": "Airbnb mostra il tour fotografico solo se ogni camera ha una "
              "foto. Interessate: {raeume}",
        "lt": "Airbnb rodo nuotraukų turą tik tada, kai kiekvienas kambarys "
              "turi nuotrauką. Susiję: {raeume}",
        "lv": "Airbnb rāda foto tūri tikai tad, ja katrai istabai ir "
              "fotoattēls. Skartās: {raeume}",
        "mt": "Airbnb juri t-tour bir-ritratti biss jekk kull kamra jkollha "
              "ritratt. Affettwati: {raeume}",
        "nl": "Airbnb toont de fototour alleen als elke kamer een foto heeft. "
              "Betreft: {raeume}",
        "pl": "Airbnb pokazuje wirtualny spacer tylko wtedy, gdy każdy pokój "
              "ma zdjęcie. Dotyczy: {raeume}",
        "pt": "O Airbnb só mostra o tour fotográfico se cada quarto tiver uma "
              "foto. Afetados: {raeume}",
        "ro": "Airbnb afișează turul foto doar dacă fiecare cameră are o "
              "fotografie. Afectate: {raeume}",
        "sk": "Airbnb zobrazuje fotoprehliadku len vtedy, ak má každá izba "
              "fotografiu. Dotknuté: {raeume}",
        "sl": "Airbnb prikaže fotoogled samo, če ima vsaka soba fotografijo. "
              "Zadeva: {raeume}",
        "sv": "Airbnb visar fotorundturen endast om varje rum har ett foto. "
              "Berörda: {raeume}",
    },
    "airbnb.rumpf_noch_vorhanden": {
        "bg": "Airbnb не предлага начин за изтриване на стая през интерфейса. "
              "Моля, премахнете я в акаунта си в Airbnb под „Обиколка със "
              "снимки“: {raeume}",
        "cs": "Airbnb nenabízí způsob, jak pokoj odstranit přes rozhraní. "
              "Odstraňte jej prosím v účtu Airbnb v sekci Fotoprohlídka: "
              "{raeume}",
        "da": "Airbnb tilbyder ingen måde at slette et værelse via "
              "grænsefladen. Fjern det venligst i din Airbnb-konto under "
              "Fototur: {raeume}",
        "de": "Airbnb bietet keinen Weg, ein Zimmer über die Schnittstelle zu "
              "löschen. Bitte im Airbnb-Konto unter Fototour entfernen: "
              "{raeume}",
        "el": "Το Airbnb δεν προσφέρει τρόπο διαγραφής δωματίου μέσω της "
              "διεπαφής. Αφαιρέστε το στον λογαριασμό σας Airbnb στην ενότητα "
              "Φωτογραφική περιήγηση: {raeume}",
        "en": "Airbnb offers no way to delete a room through the interface. "
              "Please remove it in your Airbnb account under Photo tour: "
              "{raeume}",
        "es": "Airbnb no ofrece ninguna forma de eliminar una habitación a "
              "través de la interfaz. Elimínala en tu cuenta de Airbnb en "
              "Recorrido fotográfico: {raeume}",
        "et": "Airbnb ei paku võimalust tuba liidese kaudu kustutada. Palun "
              "eemalda see oma Airbnb kontos jaotises Fotoringkäik: {raeume}",
        "fi": "Airbnb ei tarjoa tapaa poistaa huonetta rajapinnan kautta. "
              "Poista se Airbnb-tililläsi kohdassa Valokuvakierros: {raeume}",
        "fr": "Airbnb ne propose aucun moyen de supprimer une chambre via "
              "l'interface. Merci de la retirer dans ton compte Airbnb sous "
              "Visite photo : {raeume}",
        "ga": "Ní chuireann Airbnb bealach ar fáil chun seomra a scriosadh "
              "tríd an gcomhéadan. Bain é i do chuntas Airbnb faoi Thuras "
              "grianghraf: {raeume}",
        "hr": "Airbnb ne nudi način za brisanje sobe putem sučelja. Uklonite "
              "je u svom Airbnb računu pod Foto-obilazak: {raeume}",
        "hu": "Az Airbnb nem kínál módot szoba törlésére a felületen "
              "keresztül. Kérjük, távolítsd el az Airbnb-fiókodban a Fotótúra "
              "alatt: {raeume}",
        "it": "Airbnb non offre alcun modo per eliminare una camera tramite "
              "l'interfaccia. Rimuovila nel tuo account Airbnb sotto Tour "
              "fotografico: {raeume}",
        "lt": "Airbnb nesiūlo būdo ištrinti kambarį per sąsają. Pašalinkite jį "
              "savo Airbnb paskyroje skiltyje Nuotraukų turas: {raeume}",
        "lv": "Airbnb nepiedāvā veidu, kā dzēst istabu caur saskarni. Lūdzu, "
              "noņemiet to savā Airbnb kontā sadaļā Foto tūre: {raeume}",
        "mt": "Airbnb ma joffri l-ebda mod biex tħassar kamra permezz "
              "tal-interfaċċja. Jekk jogħġbok neħħiha fil-kont Airbnb tiegħek "
              "taħt Tour bir-ritratti: {raeume}",
        "nl": "Airbnb biedt geen manier om een kamer via de interface te "
              "verwijderen. Verwijder deze in je Airbnb-account onder "
              "Fototour: {raeume}",
        "pl": "Airbnb nie oferuje sposobu usunięcia pokoju przez interfejs. "
              "Usuń go w swoim koncie Airbnb w sekcji Wirtualny spacer: "
              "{raeume}",
        "pt": "O Airbnb não oferece forma de eliminar um quarto através da "
              "interface. Remove-o na tua conta Airbnb em Tour fotográfico: "
              "{raeume}",
        "ro": "Airbnb nu oferă nicio modalitate de a șterge o cameră prin "
              "interfață. Te rugăm să o elimini în contul tău Airbnb la Tur "
              "foto: {raeume}",
        "sk": "Airbnb neponúka spôsob, ako odstrániť izbu cez rozhranie. "
              "Odstráňte ju vo svojom účte Airbnb v sekcii Fotoprehliadka: "
              "{raeume}",
        "sl": "Airbnb ne ponuja načina za brisanje sobe prek vmesnika. "
              "Odstranite jo v svojem računu Airbnb pod Fotoogled: {raeume}",
        "sv": "Airbnb erbjuder inget sätt att radera ett rum via "
              "gränssnittet. Ta bort det i ditt Airbnb-konto under "
              "Fotorundtur: {raeume}",
    },
    "konto_loeschung.bestaetigung.betreff": {
        "bg": "Потвърдете заявката за изтриване на профила",
        "cs": "Potvrďte žádost o smazání účtu",
        "da": "Bekræft anmodningen om sletning af konto",
        "de": "Löschung deines Kontos bestätigen",
        "el": "Επιβεβαιώστε το αίτημα διαγραφής λογαριασμού",
        "en": "Confirm your account deletion request",
        "es": "Confirma la solicitud de eliminación de tu cuenta",
        "et": "Kinnita konto kustutamise taotlus",
        "fi": "Vahvista tilin poistopyyntö",
        "fr": "Confirmez la demande de suppression de compte",
        "ga": "Deimhnigh an t-iarratas ar scriosadh cuntais",
        "hr": "Potvrdite zahtjev za brisanje računa",
        "hu": "Igazolja a fiók törlési kérelmét",
        "it": "Conferma la richiesta di cancellazione dell'account",
        "lt": "Patvirtinkite paskyros ištrynimo prašymą",
        "lv": "Apstipriniet konta dzēšanas pieprasījumu",
        "mt": "Ikkonferma t-talba għat-tħassir tal-kont",
        "nl": "Bevestig je verzoek om accountverwijdering",
        "pl": "Potwierdź wniosek o usunięcie konta",
        "pt": "Confirme o pedido de eliminação da conta",
        "ro": "Confirmați cererea de ștergere a contului",
        "sk": "Potvrďte žiadosť o vymazanie účtu",
        "sl": "Potrdite zahtevo za izbris računa",
        "sv": "Bekräfta begäran om radering av konto",
    },
    "konto_loeschung.bestaetigung.absatz_1": {
        "bg": "Здравейте,",
        "cs": "Dobrý den,",
        "da": "Hej,",
        "de": "Hallo,",
        "el": "Γεια σας,",
        "en": "Hello,",
        "es": "Hola:",
        "et": "Tere,",
        "fi": "Hei,",
        "fr": "Bonjour,",
        "ga": "Dia duit,",
        "hr": "Zdravo,",
        "hu": "Jó napot,",
        "it": "Ciao,",
        "lt": "Sveiki,",
        "lv": "Sveiki,",
        "mt": "Bonġu,",
        "nl": "Hallo,",
        "pl": "Dzień dobry,",
        "pt": "Olá,",
        "ro": "Bună ziua,",
        "sk": "Dobrý deň,",
        "sl": "Zdravo,",
        "sv": "Hej,",
    },
    "konto_loeschung.bestaetigung.absatz_2": {
        "bg": "Получихме заявка за изтриване на профила, свързан с този имейл адрес. За да я "
              "обработим, ни трябва вашето потвърждение.",
        "cs": "Obdrželi jsme žádost o smazání účtu spojeného s touto e-mailovou adresou. Ke "
              "zpracování potřebujeme vaše potvrzení.",
        "da": "Vi har modtaget en anmodning om at slette kontoen, der er knyttet til denne "
              "e-mailadresse. For at behandle den har vi brug for din bekræftelse.",
        "de": "Wir haben einen Antrag erhalten, das Konto zu dieser E-Mail-Adresse zu löschen. Um "
              "ihn zu bearbeiten, brauchen wir deine Bestätigung.",
        "el": "Λάβαμε αίτημα διαγραφής του λογαριασμού που συνδέεται με αυτή τη διεύθυνση email. "
              "Για να το επεξεργαστούμε, χρειαζόμαστε την επιβεβαίωσή σας.",
        "en": "We received a request to delete the account linked to this email address. To "
              "process it, we need your confirmation.",
        "es": "Hemos recibido una solicitud para eliminar la cuenta vinculada a esta dirección de "
              "correo. Para tramitarla necesitamos tu confirmación.",
        "et": "Saime taotluse kustutada selle e-posti aadressiga seotud konto. Selle töötlemiseks "
              "vajame teie kinnitust.",
        "fi": "Saimme pyynnön poistaa tähän sähköpostiosoitteeseen liitetty tili. Käsittely "
              "edellyttää vahvistustasi.",
        "fr": "Nous avons reçu une demande de suppression du compte associé à cette adresse "
              "e-mail. Pour la traiter, nous avons besoin de votre confirmation.",
        "ga": "Fuaireamar iarratas ar an gcuntas atá nasctha leis an seoladh ríomhphoist seo a "
              "scriosadh. Chun é a phróiseáil, teastaíonn do dheimhniú uainn.",
        "hr": "Primili smo zahtjev za brisanje računa povezanog s ovom e-mail adresom. Za obradu "
              "nam je potrebna vaša potvrda.",
        "hu": "Kérelmet kaptunk az ehhez az e-mail-címhez tartozó fiók törlésére. A feldolgozáshoz "
              "szükségünk van a megerősítésére.",
        "it": "Abbiamo ricevuto una richiesta di cancellazione dell'account collegato a questo "
              "indirizzo email. Per elaborarla ci serve la tua conferma.",
        "lt": "Gavome prašymą ištrinti paskyrą, susietą su šiuo el. pašto adresu. Kad jį "
              "apdorotume, reikia jūsų patvirtinimo.",
        "lv": "Saņēmām pieprasījumu dzēst kontu, kas saistīts ar šo e-pasta adresi. Lai to "
              "apstrādātu, nepieciešams jūsu apstiprinājums.",
        "mt": "Irċevejna talba biex inħassru l-kont marbut ma' din l-indirizz tal-email. Biex "
              "nipproċessawha, għandna bżonn il-konferma tiegħek.",
        "nl": "We hebben een verzoek ontvangen om het account bij dit e-mailadres te verwijderen. "
              "Om het te verwerken hebben we je bevestiging nodig.",
        "pl": "Otrzymaliśmy wniosek o usunięcie konta powiązanego z tym adresem e-mail. Do jego "
              "rozpatrzenia potrzebujemy Twojego potwierdzenia.",
        "pt": "Recebemos um pedido para eliminar a conta associada a este endereço de e-mail. Para "
              "o processar, precisamos da sua confirmação.",
        "ro": "Am primit o cerere de ștergere a contului asociat acestei adrese de e-mail. Pentru "
              "a o procesa, avem nevoie de confirmarea dumneavoastră.",
        "sk": "Dostali sme žiadosť o vymazanie účtu spojeného s touto e-mailovou adresou. Na jej "
              "spracovanie potrebujeme vaše potvrdenie.",
        "sl": "Prejeli smo zahtevo za izbris računa, povezanega s tem e-poštnim naslovom. Za "
              "obravnavo potrebujemo vašo potrditev.",
        "sv": "Vi har fått en begäran om att radera kontot som är kopplat till denna e-postadress. "
              "För att behandla den behöver vi din bekräftelse.",
    },
    "konto_loeschung.bestaetigung.absatz_3": {
        "bg": "Ако сте подали заявката, потвърдете я с бутона по-долу. След това ще я проверим и "
              "ще ви отговорим по имейл.",
        "cs": "Pokud jste žádost podali vy, potvrďte ji tlačítkem níže. Poté ji zkontrolujeme a "
              "odpovíme vám e-mailem.",
        "da": "Hvis du har sendt anmodningen, skal du bekræfte den med knappen nedenfor. Derefter "
              "gennemgår vi den og svarer dig på e-mail.",
        "de": "Wenn du den Antrag gestellt hast, bestätige ihn mit dem Knopf unten. Wir prüfen ihn "
              "anschließend und melden uns per E-Mail.",
        "el": "Εάν υποβάλατε το αίτημα, επιβεβαιώστε το με το κουμπί παρακάτω. Στη συνέχεια θα το "
              "εξετάσουμε και θα σας απαντήσουμε με email.",
        "en": "If you made this request, confirm it with the button below. We will then review it "
              "and get back to you by email.",
        "es": "Si has hecho la solicitud, confírmala con el botón de abajo. Después la revisaremos "
              "y te responderemos por correo.",
        "et": "Kui esitasite taotluse, kinnitage see allpool oleva nupuga. Seejärel vaatame selle "
              "läbi ja vastame teile e-posti teel.",
        "fi": "Jos teit pyynnön, vahvista se alla olevalla painikkeella. Käsittelemme sen ja "
              "vastaamme sinulle sähköpostilla.",
        "fr": "Si vous êtes à l'origine de cette demande, confirmez-la avec le bouton ci-dessous. "
              "Nous l'examinerons ensuite et vous répondrons par e-mail.",
        "ga": "Má rinne tú an iarratas seo, deimhnigh é leis an gcnaipe thíos. Déanfaimid "
              "athbhreithniú air ansin agus rachaimid i dteagmháil leat trí ríomhphost.",
        "hr": "Ako ste vi poslali zahtjev, potvrdite ga tipkom u nastavku. Zatim ćemo ga "
              "pregledati i odgovoriti vam e-poštom.",
        "hu": "Ha Ön kérte, igazolja az alábbi gombbal. Ezután megvizsgáljuk, és e-mailben "
              "válaszolunk.",
        "it": "Se hai inviato tu la richiesta, confermala con il pulsante qui sotto. La "
              "esamineremo e ti risponderemo per email.",
        "lt": "Jei prašymą pateikėte jūs, patvirtinkite jį mygtuku žemiau. Tada jį peržiūrėsime ir "
              "atsakysime el. paštu.",
        "lv": "Ja pieprasījumu iesniedzāt jūs, apstipriniet to ar zemāk esošo pogu. Pēc tam mēs to "
              "izskatīsim un atbildēsim jums e-pastā.",
        "mt": "Jekk int għamilt it-talba, ikkonfermaha bil-buttuna hawn taħt. Imbagħad nirrevedu u "
              "nweġbuk bl-email.",
        "nl": "Als jij het verzoek hebt gedaan, bevestig het dan met de knop hieronder. We "
              "bekijken het daarna en reageren per e-mail.",
        "pl": "Jeśli to Ty złożyłeś wniosek, potwierdź go przyciskiem poniżej. Następnie go "
              "rozpatrzymy i odpowiemy e-mailem.",
        "pt": "Se foi você que fez o pedido, confirme-o com o botão abaixo. Depois analisamo-lo e "
              "responderemos por e-mail.",
        "ro": "Dacă dumneavoastră ați făcut cererea, confirmați-o cu butonul de mai jos. O vom "
              "analiza apoi și vă vom răspunde prin e-mail.",
        "sk": "Ak ste žiadosť podali vy, potvrďte ju tlačidlom nižšie. Potom ju posúdime a "
              "odpovieme vám e-mailom.",
        "sl": "Če ste zahtevo poslali vi, jo potrdite z gumbom spodaj. Nato jo bomo pregledali in "
              "vam odgovorili po e-pošti.",
        "sv": "Om du har gjort begäran bekräftar du den med knappen nedan. Därefter granskar vi "
              "den och svarar via e-post.",
    },
    "konto_loeschung.bestaetigung.knopf": {
        "bg": "Потвърждаване на изтриването",
        "cs": "Potvrdit smazání",
        "da": "Bekræft sletning",
        "de": "Löschung bestätigen",
        "el": "Επιβεβαίωση διαγραφής",
        "en": "Confirm deletion",
        "es": "Confirmar eliminación",
        "et": "Kinnita kustutamine",
        "fi": "Vahvista poisto",
        "fr": "Confirmer la suppression",
        "ga": "Deimhnigh an scriosadh",
        "hr": "Potvrdi brisanje",
        "hu": "Törlés megerősítése",
        "it": "Conferma la cancellazione",
        "lt": "Patvirtinti ištrynimą",
        "lv": "Apstiprināt dzēšanu",
        "mt": "Ikkonferma t-tħassir",
        "nl": "Verwijdering bevestigen",
        "pl": "Potwierdź usunięcie",
        "pt": "Confirmar eliminação",
        "ro": "Confirmați ștergerea",
        "sk": "Potvrdiť vymazanie",
        "sl": "Potrdi izbris",
        "sv": "Bekräfta radering",
    },
    "konto_loeschung.bestaetigung.hinweis_frist": {
        "bg": "Линкът е валиден 24 часа.",
        "cs": "Odkaz je platný 24 hodin.",
        "da": "Linket er gyldigt i 24 timer.",
        "de": "Der Link ist 24 Stunden gültig.",
        "el": "Ο σύνδεσμος ισχύει για 24 ώρες.",
        "en": "The link is valid for 24 hours.",
        "es": "El enlace es válido durante 24 horas.",
        "et": "Link kehtib 24 tundi.",
        "fi": "Linkki on voimassa 24 tuntia.",
        "fr": "Le lien est valable 24 heures.",
        "ga": "Tá an nasc bailí ar feadh 24 uair an chloig.",
        "hr": "Veza je važeća 24 sata.",
        "hu": "A link 24 óráig érvényes.",
        "it": "Il link è valido per 24 ore.",
        "lt": "Nuoroda galioja 24 valandas.",
        "lv": "Saite ir derīga 24 stundas.",
        "mt": "Il-link huwa validu għal 24 siegħa.",
        "nl": "De link is 24 uur geldig.",
        "pl": "Link jest ważny 24 godziny.",
        "pt": "O link é válido durante 24 horas.",
        "ro": "Linkul este valabil 24 de ore.",
        "sk": "Odkaz je platný 24 hodín.",
        "sl": "Povezava je veljavna 24 ur.",
        "sv": "Länken är giltig i 24 timmar.",
    },
    "konto_loeschung.bestaetigung.hinweis_nicht_ich": {
        "bg": "Ако не сте подавали тази заявка, просто игнорирайте този имейл — профилът ви остава "
              "без промяна. Никой не може да изтрие профил само с имейл адрес.",
        "cs": "Pokud jste tuto žádost nepodali, tento e-mail ignorujte – váš účet zůstane "
              "nezměněn. Nikdo nemůže smazat účet pouze pomocí e-mailové adresy.",
        "da": "Hvis du ikke har sendt denne anmodning, kan du blot ignorere denne e-mail – din "
              "konto forbliver uændret. Ingen kan slette en konto med en e-mailadresse alene.",
        "de": "Wenn du diesen Antrag nicht gestellt hast, ignoriere diese E-Mail einfach — dein "
              "Konto bleibt unverändert. Niemand kann ein Konto allein mit einer E-Mail-Adresse "
              "löschen.",
        "el": "Εάν δεν κάνατε αυτό το αίτημα, απλώς αγνοήστε αυτό το email — ο λογαριασμός σας "
              "παραμένει αμετάβλητος. Κανείς δεν μπορεί να διαγράψει λογαριασμό μόνο με μια "
              "διεύθυνση email.",
        "en": "If you did not make this request, simply ignore this email — your account stays "
              "unchanged. Nobody can delete an account with an email address alone.",
        "es": "Si no has hecho esta solicitud, ignora este correo: tu cuenta permanece sin "
              "cambios. Nadie puede eliminar una cuenta solo con una dirección de correo.",
        "et": "Kui te seda taotlust ei esitanud, ignoreerige seda e-kirja – teie konto jääb "
              "muutumatuks. Keegi ei saa kontot kustutada ainult e-posti aadressi abil.",
        "fi": "Jos et tehnyt tätä pyyntöä, voit jättää tämän viestin huomiotta – tilisi pysyy "
              "muuttumattomana. Kukaan ei voi poistaa tiliä pelkän sähköpostiosoitteen avulla.",
        "fr": "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : "
              "votre compte reste inchangé. Personne ne peut supprimer un compte avec une seule "
              "adresse e-mail.",
        "ga": "Mura ndearna tú an iarratas seo, déan neamhaird den ríomhphost seo — fanann do "
              "chuntas gan athrú. Ní féidir le duine ar bith cuntas a scriosadh le seoladh "
              "ríomhphoist amháin.",
        "hr": "Ako niste poslali ovaj zahtjev, jednostavno ignorirajte ovu e-poštu – vaš račun "
              "ostaje nepromijenjen. Nitko ne može izbrisati račun samo pomoću e-mail adrese.",
        "hu": "Ha nem Ön kérte ezt, egyszerűen hagyja figyelmen kívül ezt az e-mailt – a fiókja "
              "változatlan marad. Senki nem törölhet fiókot csupán egy e-mail-címmel.",
        "it": "Se non hai inviato questa richiesta, ignora questa email: il tuo account resta "
              "invariato. Nessuno può cancellare un account con il solo indirizzo email.",
        "lt": "Jei šio prašymo nepateikėte, tiesiog nepaisykite šio el. laiško – jūsų paskyra "
              "lieka nepakitusi. Niekas negali ištrinti paskyros vien tik pagal el. pašto adresą.",
        "lv": "Ja neesat iesniedzis šo pieprasījumu, vienkārši ignorējiet šo e-pastu – jūsu konts "
              "paliek nemainīgs. Neviens nevar dzēst kontu, izmantojot tikai e-pasta adresi.",
        "mt": "Jekk ma għamiltx din it-talba, sempliċiment injora dan l-email — il-kont tiegħek "
              "jibqa' l-istess. Ħadd ma jista' jħassar kont bl-indirizz tal-email biss.",
        "nl": "Als je dit verzoek niet hebt gedaan, negeer deze e-mail dan — je account blijft "
              "ongewijzigd. Niemand kan een account verwijderen met alleen een e-mailadres.",
        "pl": "Jeśli nie składałeś tego wniosku, po prostu zignoruj tę wiadomość — Twoje konto "
              "pozostaje bez zmian. Nikt nie może usunąć konta wyłącznie na podstawie adresu "
              "e-mail.",
        "pt": "Se não fez este pedido, ignore este e-mail — a sua conta permanece inalterada. "
              "Ninguém pode eliminar uma conta apenas com um endereço de e-mail.",
        "ro": "Dacă nu ați făcut această cerere, ignorați acest e-mail — contul dumneavoastră "
              "rămâne neschimbat. Nimeni nu poate șterge un cont doar cu o adresă de e-mail.",
        "sk": "Ak ste túto žiadosť nepodali, tento e-mail ignorujte – váš účet zostáva nezmenený. "
              "Nikto nemôže vymazať účet len pomocou e-mailovej adresy.",
        "sl": "Če te zahteve niste poslali, to e-pošto preprosto prezrite – vaš račun ostaja "
              "nespremenjen. Nihče ne more izbrisati računa zgolj z e-poštnim naslovom.",
        "sv": "Om du inte har gjort denna begäran kan du bortse från det här e-postmeddelandet – "
              "ditt konto förblir oförändrat. Ingen kan radera ett konto med enbart en "
              "e-postadress.",
    },
    # Anmeldecode des Gastes (Marktplatz-App, Airbnb-Muster: E-Mail → Code).
    # Der Code steht im Betreff, weil der Gast ihn dann in der Vorschau der
    # Mail-App liest, ohne sie zu öffnen — genau so machen es Airbnb und
    # Booking.com. Die Zeitangabe fehlt in HINWEIS_EINMAL bewusst: die
    # Gültigkeitsdauer steckt in der GoTrue-Konfiguration (MAILER_OTP_EXP),
    # nicht in unserem Code. Eine Minutenzahl hier wäre eine Zusage, die wir
    # nicht einhalten (Wurzel 4).
    "gast_code.betreff": {
        "bg": "Твоят код за вход: {code}",
        "cs": "Tvůj přihlašovací kód: {code}",
        "da": "Din login-kode: {code}",
        "de": "Dein Anmeldecode: {code}",
        "el": "Ο κωδικός σύνδεσής σου: {code}",
        "en": "Your sign-in code: {code}",
        "es": "Tu código de acceso: {code}",
        "et": "Sinu sisselogimiskood: {code}",
        "fi": "Kirjautumiskoodisi: {code}",
        "fr": "Ton code de connexion : {code}",
        "ga": "Do chód sínithe isteach: {code}",
        "hr": "Tvoj kod za prijavu: {code}",
        "hu": "A bejelentkezési kódod: {code}",
        "it": "Il tuo codice di accesso: {code}",
        "lt": "Tavo prisijungimo kodas: {code}",
        "lv": "Tavs pieteikšanās kods: {code}",
        "mt": "Il-kodiċi tad-dħul tiegħek: {code}",
        "nl": "Je inlogcode: {code}",
        "pl": "Twój kod logowania: {code}",
        "pt": "O teu código de acesso: {code}",
        "ro": "Codul tău de conectare: {code}",
        "sk": "Tvoj prihlasovací kód: {code}",
        "sl": "Tvoja koda za prijavo: {code}",
        "sv": "Din inloggningskod: {code}",
    },
    "gast_code.absatz_1": {
        "bg": "Въведи този код в приложението myBestDays, за да влезеш или да създадеш акаунт:",
        "cs": "Zadej tento kód v aplikaci myBestDays, abys se přihlásil nebo si vytvořil účet:",
        "da": "Indtast denne kode i myBestDays-appen for at logge ind eller oprette en konto:",
        "de": "Gib diesen Code in der myBestDays-App ein, um dich anzumelden oder ein Konto "
              "anzulegen:",
        "el": "Καταχώρισε αυτόν τον κωδικό στην εφαρμογή myBestDays για να συνδεθείς ή να "
              "δημιουργήσεις λογαριασμό:",
        "en": "Enter this code in the myBestDays app to sign in or create an account:",
        "es": "Introduce este código en la app de myBestDays para iniciar sesión o crear una "
              "cuenta:",
        "et": "Sisesta see kood myBestDays rakenduses, et sisse logida või konto luua:",
        "fi": "Syötä tämä koodi myBestDays-sovelluksessa kirjautuaksesi sisään tai luodaksesi "
              "tilin:",
        "fr": "Saisis ce code dans l'application myBestDays pour te connecter ou créer un compte :",
        "ga": "Cuir an cód seo isteach san aip myBestDays chun sínigh isteach nó cuntas a chruthú:",
        "hr": "Unesi ovaj kod u aplikaciji myBestDays kako bi se prijavio ili otvorio račun:",
        "hu": "Írd be ezt a kódot a myBestDays alkalmazásba a bejelentkezéshez vagy fiók "
              "létrehozásához:",
        "it": "Inserisci questo codice nell'app myBestDays per accedere o creare un account:",
        "lt": "Įvesk šį kodą myBestDays programėlėje, kad prisijungtum arba sukurtum paskyrą:",
        "lv": "Ievadi šo kodu myBestDays lietotnē, lai pieteiktos vai izveidotu kontu:",
        "mt": "Daħħal dan il-kodiċi fl-app myBestDays biex tidħol jew toħloq kont:",
        "nl": "Voer deze code in de myBestDays-app in om in te loggen of een account aan te maken:",
        "pl": "Wpisz ten kod w aplikacji myBestDays, aby się zalogować lub utworzyć konto:",
        "pt": "Introduz este código na app myBestDays para iniciar sessão ou criar uma conta:",
        "ro": "Introdu acest cod în aplicația myBestDays pentru a te conecta sau a crea un cont:",
        "sk": "Zadaj tento kód v aplikácii myBestDays, aby si sa prihlásil alebo si vytvoril "
              "konto:",
        "sl": "Vnesi to kodo v aplikaciji myBestDays, da se prijaviš ali ustvariš račun:",
        "sv": "Ange den här koden i myBestDays-appen för att logga in eller skapa ett konto:",
    },
    "gast_code.hinweis_einmal": {
        "bg": "Кодът е валиден само еднократно и изтича след кратко време.",
        "cs": "Kód platí jen jednou a po krátké době vyprší.",
        "da": "Koden kan kun bruges én gang og udløber efter kort tid.",
        "de": "Der Code gilt nur einmal und läuft nach kurzer Zeit ab.",
        "el": "Ο κωδικός ισχύει μόνο μία φορά και λήγει μετά από λίγο.",
        "en": "The code works only once and expires after a short time.",
        "es": "El código sirve una sola vez y caduca al poco tiempo.",
        "et": "Kood kehtib ainult üks kord ja aegub varsti.",
        "fi": "Koodi toimii vain kerran ja vanhenee pian.",
        "fr": "Le code ne fonctionne qu'une fois et expire au bout d'un court délai.",
        "ga": "Ní oibríonn an cód ach uair amháin agus rachaidh sé in éag go luath.",
        "hr": "Kod vrijedi samo jednom i istječe nakon kratkog vremena.",
        "hu": "A kód csak egyszer használható, és rövid idő után lejár.",
        "it": "Il codice è valido una sola volta e scade dopo poco tempo.",
        "lt": "Kodas veikia tik vieną kartą ir netrukus nustoja galioti.",
        "lv": "Kods darbojas tikai vienu reizi un pēc neilga laika beidzas.",
        "mt": "Il-kodiċi jaħdem darba biss u jiskadi wara ftit ħin.",
        "nl": "De code werkt maar één keer en verloopt na korte tijd.",
        "pl": "Kod działa tylko raz i po krótkim czasie traci ważność.",
        "pt": "O código só funciona uma vez e expira depois de pouco tempo.",
        "ro": "Codul funcționează o singură dată și expiră după scurt timp.",
        "sk": "Kód platí len raz a po krátkom čase vyprší.",
        "sl": "Koda velja samo enkrat in po kratkem času preneha veljati.",
        "sv": "Koden fungerar bara en gång och upphör att gälla efter kort tid.",
    },
    "gast_code.hinweis_nicht_ich": {
        "bg": "Ако не си поискал код, просто игнорирай това писмо — без кода никой не може да "
              "влезе.",
        "cs": "Pokud jsi o kód nežádal, tento e-mail ignoruj – bez kódu se nikdo nepřihlásí.",
        "da": "Hvis du ikke har bedt om en kode, kan du ignorere denne e-mail – uden koden kan "
              "ingen logge ind.",
        "de": "Wenn du keinen Code angefordert hast, ignoriere diese E-Mail — ohne den Code kann "
              "sich niemand anmelden.",
        "el": "Αν δεν ζήτησες κωδικό, αγνόησε αυτό το μήνυμα — χωρίς τον κωδικό δεν μπορεί να "
              "συνδεθεί κανείς.",
        "en": "If you did not request a code, ignore this email — nobody can sign in without it.",
        "es": "Si no has pedido un código, ignora este correo: sin él nadie puede iniciar sesión.",
        "et": "Kui sa koodi ei küsinud, eira seda kirja — ilma koodita ei saa keegi sisse logida.",
        "fi": "Jos et pyytänyt koodia, voit ohittaa tämän viestin — ilman koodia kukaan ei pääse "
              "kirjautumaan.",
        "fr": "Si tu n'as pas demandé de code, ignore cet e-mail : sans lui, personne ne peut se "
              "connecter.",
        "ga": "Mura n-iarr tú cód, déan neamhaird den ríomhphost seo — ní féidir le duine ar bith "
              "sínigh isteach gan é.",
        "hr": "Ako nisi zatražio kod, zanemari ovu poruku — bez koda se nitko ne može prijaviti.",
        "hu": "Ha nem kértél kódot, hagyd figyelmen kívül ezt az e-mailt — nélküle senki nem tud "
              "bejelentkezni.",
        "it": "Se non hai richiesto un codice, ignora questa e-mail: senza di esso nessuno può "
              "accedere.",
        "lt": "Jei kodo neprašei, tiesiog ignoruok šį laišką — be jo niekas negali prisijungti.",
        "lv": "Ja neesi pieprasījis kodu, ignorē šo e-pastu — bez tā neviens nevar pieteikties.",
        "mt": "Jekk ma tlabtx kodiċi, injora din l-email — mingħajru ħadd ma jista jidħol.",
        "nl": "Heb je geen code aangevraagd? Negeer deze e-mail — zonder code kan niemand "
              "inloggen.",
        "pl": "Jeśli nie prosiłeś o kod, zignoruj tę wiadomość — bez niego nikt się nie zaloguje.",
        "pt": "Se não pediste um código, ignora este e-mail: sem ele ninguém consegue iniciar "
              "sessão.",
        "ro": "Dacă nu ai cerut un cod, ignoră acest e-mail — fără el nimeni nu se poate conecta.",
        "sk": "Ak si o kód nežiadal, tento e-mail ignoruj – bez kódu sa nikto neprihlási.",
        "sl": "Če kode nisi zahteval, to sporočilo prezri — brez nje se nihče ne more prijaviti.",
        "sv": "Om du inte har begärt någon kod kan du ignorera det här mejlet – utan koden kan "
              "ingen logga in.",
    },
}


def text(schluessel: str, sprache: str, **werte: object) -> str:
    """Ein Mailtext in der gewünschten Sprache, Platzhalter gefüllt.

    `sprache` MUSS ein von `mail_sprache.aufloesen()` gelieferter Code sein —
    also bereits normalisiert und unterstützt. Ein unbekannter Code fällt auf
    `FALLBACK` zurück statt zu werfen: an dieser Stelle ist die Mail schon im
    Versand, und eine englische Mail ist besser als keine.

    Ein unbekannter SCHLÜSSEL wirft dagegen (`MailTextFehlt`): das ist ein
    Programmierfehler, kein Datenfehler, und er soll auffallen, bevor eine Mail
    mit leerem Betreff rausgeht (Wurzel 5, fail-closed).
    """
    eintrag = TEXTE.get(schluessel)
    if eintrag is None:
        msg = f"Mailtext {schluessel!r} ist im Katalog nicht hinterlegt."
        raise MailTextFehlt(msg)
    roh = eintrag.get(sprache) or eintrag[FALLBACK]
    return roh.format(**werte) if werte else roh


__all__ = ["SUPPORTED", "TEXTE", "MailTextFehlt", "text"]
