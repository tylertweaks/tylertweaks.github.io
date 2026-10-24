/* ==========================================================================
   Tyler Tweaks — zentrale Einstellungen

   Diese Datei liegt öffentlich im Repository. Es darf hier deshalb NICHTS
   stehen, was geheim bleiben muss:

     KEIN PayPal Secret        -> Supabase, Edge Functions, Secrets
     KEIN service_role Key     -> Supabase, Edge Functions, Secrets
     KEINE Datenbankpasswörter -> gar nicht nötig

   Was hier steht, ist alles öffentlich unbedenklich. Der Supabase-anon-Key
   und die PayPal-Client-ID sind dafür gemacht, im Browser zu stehen: allein
   damit kommt man an keine fremden Daten. Die Zugriffsrechte liegen in der
   Datenbank (Row Level Security), nicht im Schlüssel.
   ========================================================================== */

window.TT_KONFIG = {

  /* ---- Kontakt ---------------------------------------------------------- */
  discord: 'tyler061312',

  /* Kontakt per E-Mail. Erscheint überall, wo class="kontakt-email" steht
     (siehe tt-backend.js). Dieselbe Adresse verschickt auch die Rechnungen. */
  email: 'tylertweaks@gmail.com',

  /* Einladung auf den Discord-Server "Tyler Tweaks", z. B.
     'https://discord.gg/abcd1234'. Leer lassen, solange es keine dauerhafte
     Einladung gibt: Dann bleiben die Knöpfe "Discord-Server beitreten" auf
     der Seite unsichtbar (data-discord-einladung, siehe tt-backend.js).
     Eine Einladung, die nach sieben Tagen abläuft, hier nicht eintragen —
     in Discord beim Erstellen "Läuft nie ab" wählen. */
  discordEinladung: 'https://discord.gg/guxGg2wHAW',

  /* ---- Supabase ---------------------------------------------------------
     Zu finden im Supabase-Dashboard unter
     Project Settings -> API -> Project URL / Publishable (anon) key.
     ----------------------------------------------------------------------- */
  supabaseUrl: 'https://dfypxfkqastndvblfvvl.supabase.co',
  supabaseAnonKey: 'sb_publishable_xXO2n-NPKwMaCulDWN6R7A_BOLcNvUV',

  /* ---- PayPal -----------------------------------------------------------
     Nur die Client-ID! Das dazugehörige Secret gehört ausschließlich in die
     Supabase-Secrets (siehe EINRICHTUNG.md, Schritt 4).
     ----------------------------------------------------------------------- */
  // Sandbox-App "Tyler Tweaks Shop" (27.09.2026). Beim Wechsel auf Live
  // durch die Client-ID der Live-App ersetzen und paypalUmgebung umstellen.
  paypalClientId: 'BAAaM2haIFjl75wzv0j4YN2uV6D_CY-7uUFfmMf1LO36a8lQgC586sfgLFT0atPOWWQXMchJZVbAcLxmko',

  /* ---- Rückfallebene: paypal.me ----------------------------------------
     Der einfache Weg, der immer funktioniert — ohne Datenbank, ohne Konto,
     ohne Einrichtung.

     Er wird AUTOMATISCH benutzt, solange der richtige Shop noch nicht läuft:
     also wenn die Produkttabelle in Supabase fehlt oder oben keine
     PayPal-Client-ID steht. Sobald beides da ist, verschwindet er von selbst
     und der Kauf läuft über den Kundenbereich mit automatischem Schlüssel.

     Auf leer setzen, wenn du diesen Weg gar nicht willst — dann steht bei
     einem noch nicht eingerichteten Shop ehrlich "gerade nicht möglich".
     ----------------------------------------------------------------------- */
  paypalMe: 'https://paypal.me/Tyler971377',

  /* ---- Verkauf pausieren -------------------------------------------------
     true: Es wird nichts verkauft, egal welcher Kaufweg eingerichtet ist.
     Preise bleiben sichtbar, die Kaufknöpfe stehen auf "Bald erhältlich",
     Warenkorb und Kasse nehmen keine Zahlung an.

     Seit 26.09.2026 an, weil noch kein Gewerbe angemeldet ist. Erst auf
     false setzen, wenn Gewerbe und Impressum fertig sind.
     ----------------------------------------------------------------------- */
  verkaufPausiert: false,

  /* ---- Die App ist noch nicht erschienen ---------------------------------
     Solange hier etwas steht, lässt sich die Tweak App nicht kaufen — keine
     Laufzeit und auch nicht das Bundle, weil die App darin steckt. Die
     PC-Optimierung bleibt kaufbar. Oben auf jeder Seite steht solange ein
     Streifen "Die Tweak App erscheint <Text>", die Kaufknöpfe von App und
     Bundle zeigen "Erscheint <Text>".

     Der Text muss in diese Sätze passen: 'nächste Woche', 'am 8. Oktober' …
     Von 01.10. bis 15.10.2026 stand hier 'nächste Woche'. Seit Tyler 4.1.0
     ist die App da und der Text leer.
     ----------------------------------------------------------------------- */
  appErscheint: '',

  /* ---- Angemeldetes Gewerbe ----------------------------------------------
     true zeigt auf der Startseite in der Vertrauensleiste "Angemeldetes
     Gewerbe" mit Link zum Impressum. Erst einschalten, wenn das Gewerbe
     angemeldet ist und die GISA-Zahl im Impressum steht.
     ----------------------------------------------------------------------- */
  gewerbeAngemeldet: false,

  /* ---- Kundenstimmen -----------------------------------------------------
     Solange die Liste leer ist, bleibt der Bereich "Das sagen Kunden" auf
     der Startseite unsichtbar. Nur echte Stimmen, mit Erlaubnis der Kunden,
     z. B. aus dem Discord. Keine erfundenen — das wäre unehrlich und in der
     EU als irreführende Werbung verboten.

     Ein Eintrag:
       { text: 'Hat alles erklärt, lief sauber.', name: 'Max', paket: 'PC-Optimierung' }
     name ist der Vorname oder Discord-Name, wie der Kunde es erlaubt hat.
     ----------------------------------------------------------------------- */
  kundenstimmen: [],

  /* ---- Reichweite: Karten unter dem Namen --------------------------------
     Eine Karte je Eintrag, in dieser Reihenfolge. Ohne Eintrag bleibt die
     Leiste unsichtbar (script.js, Abschnitt 8b).

       plattform  discord | tiktok | youtube | twitch | x
       name       Anzeigename oder Handle, z. B. '@tyler.tweaks'
       url        Adresse des Profils, muss mit https:// beginnen. Bei discord
                  entfällt sie: Dann gilt discordEinladung von oben.
       zahl       Echte Zahl, z. B. 1250 oder '1.250'. Leer lassen, solange sie
                  noch nichts hergibt: Dann zeigt die Karte statt der Zahl den
                  Namen und "Folgen" bzw. "Beitreten".

     Nur zählen, was die Plattform selbst anzeigt, und bei jeder Änderung
     reichweiteStand nachziehen — eine eingefrorene Zahl, die niemand mehr
     pflegt, ist nach ein paar Wochen falsch.
     ----------------------------------------------------------------------- */
  reichweite: [
    { plattform: 'discord', name: 'Tyler Tweaks', zahl: 36 },
    { plattform: 'tiktok',  name: '@tyler.tweaks', zahl: 92, url: 'https://www.tiktok.com/@tyler.tweaks' }
  ],

  /* Datum der Zahlen oben, z. B. 'Oktober 2026'. Erscheint als kleine Zeile
     unter den Karten, aber nur, wenn mindestens eine Zahl eingetragen ist.
     Die Zahlen oben sind vom 22.10.2026: Discord laut öffentlicher Einladung,
     TikTok laut Profilseite. */
  reichweiteStand: '22.10.2026',

  // 'sandbox' zum Testen mit PayPal-Testkonten, 'live' für echtes Geld.
  // Muss zu PAYPAL_ENV in den Supabase-Secrets passen.
  paypalUmgebung: 'sandbox',

  /* ---- Stripe ----------------------------------------------------------
     Zweiter Zahlweg: Karte, Apple Pay, Google Pay, EPS, Klarna — was im
     Stripe-Dashboard unter Zahlungsmethoden eingeschaltet ist. Hier steht
     kein Schlüssel; der geheime liegt nur in den Supabase-Secrets
     (EINRICHTUNG.md im App-Repository, Schritt 16).

       ''      aus
       'test'  nur mit ?shoptest=1 in der Adresse, Stripe-Sandbox
       'live'  für alle, echtes Geld — erst mit sk_live_ in den Secrets!
     ----------------------------------------------------------------------- */
  stripeUmgebung: '',

  waehrung: 'EUR',

  /* ---- Rabattcodes -------------------------------------------------------
     Stehen nicht mehr hier, sondern in der Datenbank (Tabelle coupons, siehe
     backend/08-pc-freigabe-und-rabatte.sql im App-Repository). Warenkorb und
     Kasse fragen dieselbe Funktion rabatt_pruefen — ein Code wirkt damit
     sofort überall, ohne dass diese Datei oder eine Edge Function geändert
     werden muss, und abgelaufene Codes verschwinden von selbst.
     ----------------------------------------------------------------------- */

  /* ---- Aktion: Banner oben auf jeder Seite --------------------------------
     Solange "bis" in der Zukunft liegt, zeigt jede Seite über der Navigation
     einen Streifen mit Code, Rabatt und Countdown; danach verschwindet er von
     selbst (warenkorb.js). Der Code muss in der Tabelle coupons mit derselben
     Frist stehen — verbindlich ist nur die Datenbank, der Banner ist Anzeige.

     Keine Aktion: aktion: null
     ----------------------------------------------------------------------- */
  aktion: {
    code: 'Update50',
    prozent: 50,
    bis: '2026-10-01T16:52:05Z'
  },

  /* ---- Adresse der Seite ------------------------------------------------
     Wird für die Links in den Bestätigungs-Mails gebraucht. Beim Wechsel auf
     eine eigene Domain hier und in den Supabase-Einstellungen ändern.
     ----------------------------------------------------------------------- */
  seitenUrl: 'https://tylertweaks.github.io',

  /* ---- Anzeige der Pakete -----------------------------------------------
     Verbindlich ist immer der Preis in der Datenbank — die Kaufseite holt ihn
     dort, und die Edge Function berechnet ausschließlich damit. Die Werte hier
     sorgen nur dafür, dass die Preisliste sofort etwas anzeigt, statt kurz
     leer zu bleiben. Weichen sie ab, korrigiert die Seite sich beim Laden
     selbst aus der Datenbank.

     Seit 24.10.2026 änderst du Preis und Hinweis im Admin-Bereich unter
     "Produkte" (backend/19-preise-verwalten.sql). Die Zahlen hier dann am
     besten nachziehen, damit beim Laden nicht kurz der alte Preis aufblitzt.
     ----------------------------------------------------------------------- */
  /* Seit 22.10.2026 nur noch zwei Laufzeiten auf der Seite, als Karten
     nebeneinander (Vorbild realdarkzy.de). Die übrigen (24 Std., 2 Tage,
     1 Woche, 1 Jahr) stehen weiter in der Datenbank, werden hier aber nicht
     mehr angeboten. Wer eine wieder zeigen will, trägt sie hier ein.

     einheit   kleine Zeile unter dem Preis
     hinweis   Etikett unter dem Preis, z. B. "Einführungspreis bis 30.11."
               (Sofortanzeige; verbindlich ist products.preis_hinweis)
     punkte    die Zeilen auf der Karte
     empfohlen bekommt das Etikett "Empfohlen" */
  laufzeiten: [
    { slug: 'app-1m',       kurz: '1 Monat',  lang: '1 Monat',  preis: '9.99',
      einheit: '30 Tage · einmalig',
      punkte: ['Alle Tweaks und Werkzeuge', 'Läuft nach 30 Tagen aus', 'Kein Abo, verlängert sich nicht'] },
    { slug: 'app-lifetime', kurz: 'Lifetime', lang: 'Lifetime', preis: '39.99',
      einheit: 'einmalig', empfohlen: true, hinweis: 'Einführungspreis bis 30.11.',
      punkte: ['Alle Tweaks und Werkzeuge', 'Alle künftigen Updates', 'Einmal zahlen, für immer'] }
  ],

  /* ---- Gratis-Version der App ----------------------------------------------
     Seit Tyler 4.2 startet die App ohne Lizenzschlüssel als Gratis-Version
     (alle Tweaks unter System, Game Booster mit 2 geschützten Apps). Wer alle will, gibt in der
     App einen Schlüssel ein.

     Die Karte "Kostenlos" links neben den Laufzeiten wird von selbst zum
     Download-Knopf (app.datei unten), sobald app.version mindestens abVersion
     ist. Seit 23.10.2026 heißt die App wieder Version 2.0.0 (auf Tylers Wunsch,
     kleiner als die vorige 4.2.0), deshalb steht abVersion auf 2.0.0. Soll die Karte verschwinden: gratis: null */
  gratis: {
    abVersion: '2.0.0',
    punkte: ['Alle System-Tweaks: Allgemein, Explorer, Dienste, Debloat, Privatsphäre', 'Game Booster mit 2 geschützten Apps', 'Ohne Konto, ohne Schlüssel', 'Später in der App auf alle Tweaks erweitern']
  },

  /* ---- Die beiden festen Pakete ------------------------------------------
     Standen früher fest im HTML und zusätzlich als Zahl in script.js. Damit
     gab es drei Stellen für denselben Preis. Jetzt stehen sie nur noch hier.

     Genau wie oben gilt: verbindlich ist der Preis in der Datenbank. Diese
     Werte sorgen nur dafür, dass sofort etwas dasteht.

     Der Schlüssel muss zum slug in der Produkttabelle passen und zu dem, was
     im HTML unter data-preis steht.

     name und untertitel braucht der Warenkorb, wenn er ein Paket allein aus
     dem slug aufbauen muss — etwa nach der Anmeldung, wenn nur noch
     ?paket=bundle in der Adresse steht.
     ----------------------------------------------------------------------- */
  pakete: [
    { slug: 'optimierung', name: 'PC-Optimierung', untertitel: 'Einmalig',            preis: '29.99' },
    { slug: 'bundle',      name: 'Bundle',         untertitel: 'Lifetime + Service',  preis: '59.99' }
  ],

  /* ---- Aktuelle App-Version ---------------------------------------------
     Version und Datum erscheinen überall, wo data-app-version bzw.
     data-app-date im HTML steht.

     Zum Download gibt es zwei Stufen. Zuerst fragt der Kundenbereich die Edge
     Function "download": die prüft die Lizenz und gibt einen signierten Link
     mit zwei Minuten Gültigkeit zurück. Das setzt voraus, dass in der Tabelle
     app_release ein storage_path eingetragen ist.

     Ist das noch nicht eingerichtet, antwortet sie mit "no_release" und der
     Kundenbereich fällt auf die Datei unter downloads/ zurück — siehe unten.
     ----------------------------------------------------------------------- */
  app: {
    version: '2.2.0',
    datum: '24.10.2026',

    /* ---- Setup-Datei ----------------------------------------------------
       Liegt im Repository unter downloads/ und wird von GitHub Pages
       ausgeliefert. Der Kundenbereich zeigt den Knopf nur Kunden mit gültiger
       Lizenz — die Adresse selbst ist aber öffentlich erreichbar.

       Das ist eine bewusste Entscheidung: Der eigentliche Schutz ist der
       Lizenzschlüssel. Ohne ihn lässt sich die App nicht starten, egal wie
       jemand an die Datei gekommen ist.

       Willst du später auch die Datei schützen, richte Cloudflare R2 ein
       (EINRICHTUNG.md, Schritt 9 Variante A). Dann trägst du den Ablageort
       in app_release.storage_path ein, die Edge Function "download" erzeugt
       einen Link mit zwei Minuten Gültigkeit — und dieses Feld hier wird
       automatisch nicht mehr benutzt.
       --------------------------------------------------------------------- */
    datei: 'downloads/TylerTweaksSetup-2.2.0.exe',
    groesse: '51,3 MB',
    sha256: '13b4d2878cf78f5f6015366358c42425427934e13d568e05dfeb756ba87e269e'
  },

  /* ---- Änderungen der letzten Versionen ----------------------------------
     Hier steht nur, was auch herunterladbar ist. Einen Changelog zu einer
     Version zu zeigen, die niemand laden kann, wäre eine Ankündigung, die
     sich als Tatsache ausgibt.

     Den obersten Eintrag schreibt release-fertigstellen.ps1 aus dem, was auf
     der Kommandozeile als -Changelog übergeben wurde. Umlaute gehen dabei
     leicht verloren — wer dort ae und ue liest, darf sie hier nachziehen. */
  changelog: [
    { version: '2.2.0', datum: '24.10.2026', text: 'Die Gratis-Version hat jetzt alle Tweaks unter System: Allgemein, Explorer, Dienste, Autostart, Debloat und Privatsphäre. CPU, GPU, Netzwerk und der Rest bleiben mit Schloss. Der Game Booster geht auch gratis, mit bis zu zwei geschützten Apps.' },
    { version: '2.1.0', datum: '24.10.2026', text: 'Neuer Aufbau wie bei anderen Tweak-Tools: System mit Allgemein, Explorer, Dienste, Autostart, Debloat und Privatsphäre, dazu Overlays. 294 Tweaks statt 231. Unter Werkzeuge neu: Reparatur, die Einstellungen anderer Tweak-Programme auf den Windows-Standard zurücksetzt.' },
    { version: '2.0.0', datum: '23.10.2026', text: 'Neu als Version 2.0: Gratis-Version mit 40 Tweaks und Game Booster, gesperrte Bereiche mit Schloss, das Preset Tyler Owner, alle installierten Programme unter Aufräumen deinstallieren, eckige Knöpfe und eine Übersicht je Kategorie, wie viele Tweaks aktiv, zurückgesetzt und offen sind.' },
    { version: '4.2.0', datum: '22.10.2026', text: 'Tyler gibt es jetzt gratis: Ohne Schlüssel sind Datenschutz, Debloat und Aufgaben frei. Mit einem Schlüssel, den du unten links eingibst, schaltest du alle Tweaks frei, und läuft er ab, bleibt Tyler als Gratis-Version offen.' },
    { version: '4.1.0', datum: '15.10.2026', text: 'Neues Design in Nachtblau mit schärferem Logo, Suche über alle Tweaks mit Strg+F, Autostart zeigt jetzt auch geplante Aufgaben und Store-Apps, der PC-Check sitzt unter Treiber & Tools, und das Deinstallieren nimmt deine Änderungen wieder zuverlässig zurück.' },
    { version: '4.0.0', datum: '05.10.2026', text: 'Neue Übersicht mit Score und Live-Werten ohne Scrollen; GPU-Auslastung und GPU-Temperatur messen jetzt zuverlässig, dazu RAM, VRAM, Strom und Lüfter; neu: Netzwerkkarten-Tuner.' },
    { version: '3.0.0', datum: '03.10.2026', text: 'PC-Check für Bildschirm-Hz und Grafiktreiber, nur noch wirksame Tweaks mit Wirkungs-Balken und Score, Anti-Cheat-Schutz, Updates von selbst und alle Erklärungen in einfacher Sprache.' },
    { version: '2.9.0', datum: '30.09.2026', text: 'Der Game Booster schließt jetzt wirklich alles, was nicht auf deiner Whitelist steht – auch Apps im Infobereich und alle Hilfsprozesse. Windows, Anti-Cheat und Grafiktreiber bleiben geschützt, und was eine Whitelist-App gestartet hat, bleibt offen. Tyler prüft beim Start selbst, ob es eine neue Version gibt, und bringt dich mit „Jetzt herunterladen“ direkt zum Download. Die Seite „Alle Tweaks“ ist entfallen, der Bereich Tweaks öffnet jetzt mit den Presets.' },
    { version: '2.8.1', datum: '27.09.2026', text: 'Neuer PC oder neue Festplatte? Die Bindung deiner Lizenz löst du jetzt selbst im Kundenkonto, und Tyler sagt dir beim Start, wo das geht. Dazu eine zuverlässigere Lizenzprüfung.' },
    { version: '2.8.0', datum: '25.09.2026', text: 'Neues Design in Blau-Schwarz mit einer Seitenleiste nach Kategorien. 146 neue Optimierungen (129 auf 275), darunter die neuen Bereiche Treiber und Experimentell, Warnhinweise bei heiklen Tweaks und Energie-Tweaks, die jetzt über die Energie-API von Windows zuverlässig greifen. Dazu zwei neue Seiten: Werkzeuge & Treiber mit Links passend zur verbauten Grafikkarte und BIOS-Tipps mit den Menüpfaden für dein Mainboard.' },
    { version: '2.7.0', datum: '22.09.2026', text: 'Eigene Profile: Du nimmst auf, welche Tweaks bei dir gerade gesetzt sind, gibst dem Ganzen einen Namen und stellst denselben Zustand später mit einem Klick wieder her – auf einem neuen PC oder nach einer Neuinstallation. Außerdem liefert die App ihren Tweak-Katalog jetzt als Datei aus, aus der die Website die vollständige Liste aufbaut: Unter „Alle Tweaks" steht jede der 129 Optimierungen mit dem Registry-Wert, den sie schreibt.' },
    { version: '2.6.0', datum: '21.09.2026', text: '40 neue Optimierungen (89 auf 129), darunter Debloat als eigener Bereich, DNS auf Cloudflare, Windows Recall abschalten und das Sperren von Kamera und Mikrofon. Jeder Tweak ist jetzt ein Schalter statt zweier Knöpfe, und die Liste baut sich deutlich schneller auf. Wer Tyler länger ohne Internet nutzt, wird einmal zur Bestätigung der Lizenz aufgefordert.' },
    { version: '2.5.0', datum: '20.09.2026', text: 'Jeder Tweak zeigt jetzt Einstufung, Neustart-Pflicht und Sicherung an. Risikobewertung aller 89 Optimierungen überarbeitet. Presets fragen vorher nach, was sie ändern. Update-Prüfung unter Einstellungen.' },
    { version: '2.4.0', datum: '18.09.2026', text: 'Autostart-Manager erkennt jetzt auch geplante Aufgaben. Silent-Profil überarbeitet.' },
    { version: '2.3.1', datum: '02.08.2026', text: 'Fehler beim Anlegen von Wiederherstellungspunkten auf Windows 11 behoben.' },
    { version: '2.3.0', datum: '19.07.2026', text: 'Neue Netzwerk-Tweaks, Erklärtexte zu jedem Schalter ergänzt.' }
  ]
};
