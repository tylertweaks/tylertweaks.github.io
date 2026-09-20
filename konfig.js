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
  paypalClientId: '',

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

  // 'sandbox' zum Testen mit PayPal-Testkonten, 'live' für echtes Geld.
  // Muss zu PAYPAL_ENV in den Supabase-Secrets passen.
  paypalUmgebung: 'sandbox',

  waehrung: 'EUR',

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
     ----------------------------------------------------------------------- */
  laufzeiten: [
    { slug: 'app-24h',      kurz: '24 Std.',  lang: '24 Stunden', preis: '2.99'  },
    { slug: 'app-2d',       kurz: '2 Tage',   lang: '2 Tage',     preis: '4.99'  },
    { slug: 'app-1w',       kurz: '1 Woche',  lang: '1 Woche',    preis: '7.99'  },
    { slug: 'app-1m',       kurz: '1 Monat',  lang: '1 Monat',    preis: '12.99' },
    { slug: 'app-1y',       kurz: '1 Jahr',   lang: '1 Jahr',     preis: '19.99' },
    { slug: 'app-lifetime', kurz: 'Lifetime', lang: 'Lifetime',   preis: '29.99' }
  ],

  /* ---- Die beiden festen Pakete ------------------------------------------
     Standen früher fest im HTML und zusätzlich als Zahl in script.js. Damit
     gab es drei Stellen für denselben Preis. Jetzt stehen sie nur noch hier.

     Genau wie oben gilt: verbindlich ist der Preis in der Datenbank. Diese
     Werte sorgen nur dafür, dass sofort etwas dasteht.

     Der Schlüssel muss zum slug in der Produkttabelle passen und zu dem, was
     im HTML unter data-preis steht.
     ----------------------------------------------------------------------- */
  pakete: [
    { slug: 'optimierung', preis: '49.99' },
    { slug: 'bundle',      preis: '69.99' }
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
    version: '2.5.0',
    datum: '20.09.2026',

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
    datei: 'downloads/TylerTweaksSetup-2.5.0.exe',
    groesse: '59,4 MB',
    sha256: 'a9dac269350405a3ab0a52fb3f5cc46313790d3a0a911c1b7a9e2b423892aa3f'
  },

  /* ---- Änderungen der letzten Versionen ---------------------------------- */
  changelog: [
    { version: '2.5.0', datum: '20.09.2026', text: 'Jeder Tweak zeigt jetzt Einstufung, Neustart-Pflicht und Sicherung an. Risikobewertung aller 89 Optimierungen überarbeitet. Presets fragen vorher nach, was sie ändern. Update-Prüfung unter Einstellungen.' },
    { version: '2.4.0', datum: '18.09.2026', text: 'Autostart-Manager erkennt jetzt auch geplante Aufgaben. Silent-Profil überarbeitet.' },
    { version: '2.3.1', datum: '02.08.2026', text: 'Fehler beim Anlegen von Wiederherstellungspunkten auf Windows 11 behoben.' },
    { version: '2.3.0', datum: '19.07.2026', text: 'Neue Netzwerk-Tweaks, Erklärtexte zu jedem Schalter ergänzt.' }
  ]
};
