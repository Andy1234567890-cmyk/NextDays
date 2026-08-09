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
