/* ==========================================================================
   Tyler Tweaks — gemeinsame Grundlage für alle Seiten mit Konto

   Enthält:
     · den Supabase-Zugang
     · Anmeldestatus und Navigation
     · Aufruf der Edge Functions
     · Fehlertexte in Klartext
     · Formatierung von Geld, Datum und Lizenzstatus

   Grundsatz: Was hier im Browser passiert, ist reine Darstellung. Jede
   Entscheidung, die Geld oder Berechtigungen betrifft, fällt auf dem Server.
   Wer diese Datei manipuliert, sieht höchstens falsche Beschriftungen — an
   fremde Daten kommt er dadurch nicht.
   ========================================================================== */

window.TT = (function () {
  'use strict';

  var KONFIG = window.TT_KONFIG || {};

  /* ====================================================================
     Supabase-Verbindung
     ==================================================================== */
  var db = null;
  var startFehler = null;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    startFehler = 'Die Verbindung zum Server konnte nicht geladen werden. ' +
                  'Prüfe deine Internetverbindung oder einen aktiven Werbeblocker.';
  } else if (!KONFIG.supabaseUrl || !KONFIG.supabaseAnonKey) {
    startFehler = 'Die Seite ist noch nicht fertig eingerichtet (Supabase fehlt in konfig.js).';
  } else {
    db = window.supabase.createClient(KONFIG.supabaseUrl, KONFIG.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  /* ====================================================================
     Fehlertexte — nie technische Meldungen an Kunden
     ==================================================================== */
  var FEHLER = {
    /* Anmeldung und Registrierung — die Codes, die Supabase Auth wirklich
       zurückgibt (geprüft gegen das Projekt, nicht aus dem Gedächtnis). */
    'invalid_credentials':       'E-Mail oder Passwort ist falsch.',
    'invalid_login_credentials': 'E-Mail oder Passwort ist falsch.',
    'email_not_confirmed':       'Deine E-Mail-Adresse wurde noch nicht bestätigt. Sieh im Postfach nach — auch im Spam-Ordner.',
    'user_already_exists':       'Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich einfach an.',
    'email_exists':              'Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich einfach an.',
    'email_address_invalid':     'Diese E-Mail-Adresse sieht nicht gültig aus.',
    'validation_failed':         'Bitte prüfe deine Eingaben.',
    'weak_password':             'Das Passwort ist zu kurz. Nimm mindestens 8 Zeichen.',
    'signup_disabled':           'Neue Konten sind gerade nicht möglich. Melde dich bitte auf Discord.',
    'over_email_send_rate_limit':'Es wurden gerade zu viele Mails verschickt. Versuche es in ein paar Minuten noch einmal.',
    'over_request_rate_limit':   'Zu viele Versuche in kurzer Zeit. Warte einen Moment und probiere es erneut.',
    'same_password':             'Das ist dein bisheriges Passwort. Wähle bitte ein anderes.',
    'session_not_found':         'Der Link ist abgelaufen. Fordere einen neuen an.',
    'otp_expired':               'Der Link ist abgelaufen. Fordere einen neuen an.',
    'user_not_found':            'Zu dieser E-Mail-Adresse gibt es kein Konto.',

    /* Kauf */
    'not_authenticated':   'Bitte melde dich an, um fortzufahren.',
    'unknown_product':     'Dieses Paket gibt es nicht mehr.',
    'missing_product':     'Es wurde kein Paket ausgewählt.',
    /* Kommt vom Server, wenn der Rabattcode dort nicht eingetragen ist. Für
       den Kunden ist das einfach ein Code, der nicht gilt — abgebucht wurde
       nichts. */
    'unknown_coupon':      'Dieser Rabattcode gilt nicht. Nimm ihn im Warenkorb heraus oder prüfe die Schreibweise.',
    'unknown_order':       'Zu dieser Zahlung finde ich keine Bestellung.',
    'payment_failed':      'Die Zahlung konnte nicht verarbeitet werden. Es wurde nichts abgebucht.',
    'payment_not_completed':'Die Zahlung wurde noch nicht bestätigt. Sobald PayPal sie freigibt, erscheint die Lizenz automatisch in deinem Konto.',
    'fulfillment_failed':  'Die Zahlung ist angekommen, die Freischaltung hat aber gehakt. Sie läuft automatisch nach — sollte in wenigen Minuten nichts im Konto stehen, melde dich auf Discord.',
    'paypal_error':        'PayPal antwortet gerade nicht. Versuche es in ein paar Minuten noch einmal.',
    'paypal_not_configured':'Die Bezahlung ist noch nicht freigeschaltet. Melde dich bitte auf Discord.',
    'paypal_auth_failed':  'Die Bezahlung ist gerade nicht möglich. Melde dich bitte auf Discord.',

    /* Download */
    'no_access':  'Der Download ist für dieses Konto nicht freigeschaltet. Du brauchst dafür eine gültige Lizenz der Tweak App.',
    'no_release': 'Die Setup-Datei wird gerade vorbereitet. Schau in Kürze noch einmal vorbei.',

    /* Allgemein */
    'server_error':  'Da ist etwas schiefgelaufen. Versuche es bitte noch einmal.',
    'network_error': 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.'
  };

  function fehlerText(fehler) {
    if (!fehler) return FEHLER.server_error;

    var code = '';
    if (typeof fehler === 'string') {
      code = fehler;
    } else {
      code = fehler.code || fehler.error_code || '';
      if (!code && fehler.message) {
        // Supabase liefert je nach Fall nur einen Satz statt eines Codes.
        code = String(fehler.message).toLowerCase().replace(/[^a-z]+/g, '_');
      }
    }

    if (FEHLER[code]) return FEHLER[code];

    // Auf bekannte Formulierungen zurückfallen, falls kein Code kam.
    var text = String((fehler && fehler.message) || fehler || '').toLowerCase();
    if (text.indexOf('invalid login') >= 0)      return FEHLER.invalid_login_credentials;
    if (text.indexOf('email not confirmed') >= 0) return FEHLER.email_not_confirmed;
    if (text.indexOf('already registered') >= 0)  return FEHLER.user_already_exists;
    if (text.indexOf('already been registered') >= 0) return FEHLER.user_already_exists;
    if (text.indexOf('failed to fetch') >= 0)     return FEHLER.network_error;
    if (text.indexOf('rate limit') >= 0)          return FEHLER.over_request_rate_limit;

    return FEHLER.server_error;
  }

  /* ====================================================================
     Edge Functions aufrufen
     Gibt immer { ok, daten, fehler } zurück, nie eine rohe Ausnahme.
     ==================================================================== */
  async function funktion(name, koerper) {
    if (!db) return { ok: false, fehler: startFehler || FEHLER.server_error };

    try {
      var antwort = await db.functions.invoke(name, { body: koerper || {} });

      if (antwort.error) {
        // Der Fehlertext steckt im Antwortkörper, nicht in der Ausnahme.
        var code = 'server_error';
        try {
          var koerperFehler = await antwort.error.context.json();
          code = koerperFehler.error || code;
        } catch (e) { /* Antwort war kein JSON — Standardtext genügt */ }
        return { ok: false, fehler: fehlerText(code), code: code };
      }

      if (antwort.data && antwort.data.error) {
        return { ok: false, fehler: fehlerText(antwort.data.error), code: antwort.data.error };
      }

      return { ok: true, daten: antwort.data };
    } catch (e) {
      return { ok: false, fehler: fehlerText(e), code: 'network_error' };
    }
  }

  /* ====================================================================
     Anmeldestatus
     ==================================================================== */
  async function sitzung() {
    if (!db) return null;
    try {
      var erg = await db.auth.getSession();
      return (erg && erg.data && erg.data.session) || null;
    } catch (e) {
      return null;
    }
  }

  async function nutzer() {
    var s = await sitzung();
    return s ? s.user : null;
  }

  var profilZwischenspeicher = null;

  async function profil(neuLaden) {
    if (profilZwischenspeicher && !neuLaden) return profilZwischenspeicher;
    if (!db) return null;

    var u = await nutzer();
    if (!u) return null;

    var erg = await db.from('profiles')
      .select('id, email, name, is_admin, created_at')
      .eq('id', u.id)
      .maybeSingle();

    if (erg.error || !erg.data) {
      // Profil fehlt (z. B. Konto von vor der Umstellung) — mit dem Nötigsten
      // weiterarbeiten, statt die Seite abbrechen zu lassen.
      profilZwischenspeicher = { id: u.id, email: u.email, name: '', is_admin: false };
      return profilZwischenspeicher;
    }

    profilZwischenspeicher = erg.data;
    return profilZwischenspeicher;
  }

  /**
   * Leitet auf die Anmeldung um, wenn niemand angemeldet ist.
   *
   * Kommt der Besucher gerade über einen Link aus einer E-Mail, steckt das
   * Anmelde-Token noch in der Adresse und supabase-js liest es erst aus.
   * Würden wir sofort umleiten, sähe der Kunde direkt nach dem Bestätigen
   * seiner Adresse wieder das Login-Formular. Deshalb in diesem Fall kurz
   * warten und ein zweites Mal nachsehen.
   */
  async function schuetzen() {
    var s = await sitzung();
    if (s) return s;

    var adresse = window.location.hash + window.location.search;
    var ausMail = /access_token|refresh_token|[?&#]code=|type=(signup|recovery|magiclink|invite|email_change)/.test(adresse);

    if (ausMail) {
      for (var versuch = 0; versuch < 6 && !s; versuch++) {
        await new Promise(function (r) { setTimeout(r, 250); });
        s = await sitzung();
      }
      if (s) return s;
    }

    var ziel = window.location.pathname.split('/').pop() + window.location.search;
    window.location.replace('anmelden.html?weiter=' + encodeURIComponent(ziel));
    return null;
  }

  async function abmelden() {
    profilZwischenspeicher = null;

    /* Der Warenkorb gehört zum Konto — hineingelegt werden darf nur
       angemeldet. Bliebe er beim Abmelden stehen, sähe der Nächste an diesem
       Rechner die Auswahl des Vorigen. */
    if (window.TT && window.TT.korb) {
      window.TT.korb.leeren();
      window.TT.korb.wunschVergessen();
    }

    if (db) { try { await db.auth.signOut(); } catch (e) { /* egal */ } }
    window.location.href = 'index.html';
  }

  /* ====================================================================
     Navigation: Login/Registrieren bzw. Mein Konto einsetzen
     ==================================================================== */
  var abmeldenVerdrahtet = false;

  function navHtml(angemeldet, name) {
    if (!angemeldet) {
      return '<a href="anmelden.html" class="btn btn-ghost btn-sm">Anmelden</a>' +
             '<a href="registrieren.html" class="btn btn-primary btn-sm">Registrieren</a>';
    }

    /* Angemeldet: Dashboard als Hauptziel, daneben der eigene Name als Weg zum
       Profil und ein Knopf zum Abmelden. Der Vorname reicht — mehr passt in der
       Leiste ohnehin nicht. */
    var anzeige = name ? escape(name.split(' ')[0]) : 'Profil';
    return '<a href="konto.html" class="btn btn-ghost btn-sm">Dashboard</a>' +
           '<a href="konto.html#kontodaten" class="btn btn-konto btn-sm">' +
           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
           '<span>' + anzeige + '</span></a>' +
           '<button type="button" class="btn btn-ghost btn-sm" data-tt-abmelden>Abmelden</button>';
  }

  async function navAufbauen() {
    var desktop = document.getElementById('nav-auth');
    var mobil   = document.getElementById('nav-auth-mobil');
    if (!desktop && !mobil) return;

    var s = await sitzung();
    var name = '';

    if (s) {
      var p = await profil();
      name = (p && p.name) || '';
      if (p && p.is_admin) {
        var adminLink = document.getElementById('nav-admin');
        if (adminLink) adminLink.hidden = false;
      }
    }

    var html = navHtml(!!s, name);
    if (desktop) desktop.innerHTML = html;
    if (mobil) {
      mobil.innerHTML = s
        ? '<a href="konto.html">Dashboard</a>' +
          '<a href="konto.html#kontodaten">Profil</a>' +
          '<a href="#" data-tt-abmelden>Abmelden</a>'
        : '<a href="anmelden.html">Anmelden</a><a href="registrieren.html">Registrieren</a>';
    }

    /* Ein Zuhörer am Dokument statt an jedem einzelnen Knopf: die Navigation
       wird neu gezeichnet, der Zuhörer bleibt. Deshalb nur einmal setzen. */
    if (s && !abmeldenVerdrahtet) {
      document.addEventListener('click', function (e) {
        var knopf = e.target.closest('[data-tt-abmelden]');
        if (!knopf) return;
        e.preventDefault();
        abmelden();
      });
      abmeldenVerdrahtet = true;
    }
  }

  /* ====================================================================
     Darstellung
     ==================================================================== */
  function escape(wert) {
    return String(wert == null ? '' : wert).replace(/[&<>"']/g, function (z) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z];
    });
  }

  function geld(betrag, waehrung) {
    var zahl = Number(betrag);
    if (!isFinite(zahl)) return '—';
    try {
      return zahl.toLocaleString('de-DE', {
        style: 'currency',
        currency: waehrung || KONFIG.waehrung || 'EUR'
      });
    } catch (e) {
      return zahl.toFixed(2).replace('.', ',') + ' €';
    }
  }

  function datum(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function datumZeit(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function groesse(bytes) {
    var z = Number(bytes);
    if (!isFinite(z) || z <= 0) return '';
    var mb = z / (1024 * 1024);
    return mb.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
  }

  /* ---- Laufzeit eines Lizenztyps in Klartext ---------------------------- */
  var LAUFZEIT = {
    day:      '24 Stunden',
    two_days: '2 Tage',
    week:     '1 Woche',
    month:    '1 Monat',
    year:     '1 Jahr',
    lifetime: 'Lifetime'
  };

  function laufzeit(typ) {
    return LAUFZEIT[typ] || typ || '—';
  }

  /* ---- Status einer Lizenz --------------------------------------------
     Berechnet aus denselben Werten, die auch die App und der Server sehen:
     gesperrt, abgelaufen oder aktiv. Nichts davon ist im Browser gesetzt.
     --------------------------------------------------------------------- */
  function lizenzStatus(lizenz) {
    if (!lizenz) return { text: 'Unbekannt', klasse: 'aus' };
    if (lizenz.revoked) return { text: 'Gesperrt', klasse: 'aus' };

    if (lizenz.expires_at) {
      var ende = new Date(lizenz.expires_at).getTime();
      if (isFinite(ende) && ende <= Date.now()) {
        return { text: 'Abgelaufen', klasse: 'aus' };
      }
    }
    return { text: 'Aktiv', klasse: 'an' };
  }

  /** Verbleibende Zeit als "noch 3 Tage" / "noch 5 Stunden". */
  function restzeit(bis) {
    if (!bis) return 'unbegrenzt';
    var ms = new Date(bis).getTime() - Date.now();
    if (!isFinite(ms) || ms <= 0) return 'abgelaufen';

    var minuten = Math.floor(ms / 60000);
    var stunden = Math.floor(minuten / 60);
    var tage    = Math.floor(stunden / 24);

    if (tage >= 2)     return 'noch ' + tage + ' Tage';
    if (stunden >= 2)  return 'noch ' + stunden + ' Stunden';
    if (minuten >= 2)  return 'noch ' + minuten + ' Minuten';
    return 'läuft gleich ab';
  }

  var ZAHLUNG = {
    created:   { text: 'Nicht abgeschlossen', klasse: 'aus' },
    pending:   { text: 'In Prüfung',          klasse: 'warten' },
    paid:      { text: 'Bezahlt',             klasse: 'an' },
    failed:    { text: 'Fehlgeschlagen',      klasse: 'aus' },
    cancelled: { text: 'Abgebrochen',         klasse: 'aus' },
    refunded:  { text: 'Erstattet',           klasse: 'aus' }
  };

  function zahlungStatus(status) {
    return ZAHLUNG[status] || { text: status || '—', klasse: 'aus' };
  }

  /* ====================================================================
     Fehler, die Supabase an einen Mail-Link anhängt
     Beispiel: ...#error=access_denied&error_code=otp_expired
     ==================================================================== */
  function linkFehler() {
    var quellen = [
      new URLSearchParams(window.location.search),
      new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''))
    ];

    for (var i = 0; i < quellen.length; i++) {
      var code = quellen[i].get('error_code') || quellen[i].get('error');
      if (!code) continue;

      if (code === 'otp_expired' || code === 'access_denied') {
        return 'Der Link ist abgelaufen oder wurde schon benutzt. Fordere unten einen neuen an.';
      }
      return fehlerText(code);
    }
    return null;
  }

  /** Entfernt Token und Fehler aus der Adresszeile, ohne die Seite neu zu laden. */
  function adresseAufraeumen() {
    if (window.location.hash || window.location.search) {
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) { /* alte Browser — nicht schlimm */ }
    }
  }

  /* ====================================================================
     Meldungsfeld auf Formularseiten
     ==================================================================== */
  function melden(id, text, art) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-msg' + (text ? ' show ' + (art || 'error') : '');
    if (text) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ====================================================================
     In die Zwischenablage kopieren — mit Rückfallebene für ältere Browser
     und für Seiten ohne HTTPS.
     ==================================================================== */
  async function kopieren(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* unten weiterversuchen */ }

    try {
      var feld = document.createElement('textarea');
      feld.value = text;
      feld.setAttribute('readonly', '');
      feld.style.position = 'fixed';
      feld.style.opacity = '0';
      document.body.appendChild(feld);
      feld.select();
      var erfolg = document.execCommand('copy');
      document.body.removeChild(feld);
      return erfolg;
    } catch (e) {
      return false;
    }
  }

  /* ====================================================================
     Kleinigkeiten, die auf jeder Seite laufen
     ==================================================================== */
  /** Navigation: Hintergrund beim Scrollen und mobiles Menü.
   *
   *  Achtung: grundgeruest() wird von manchen Seiten mehrfach aufgerufen — die
   *  Startseite etwa ruft es ein zweites Mal, um den Discord-Namen im
   *  Übergangshinweis einzusetzen. Ohne die Sperre unten hing danach ein
   *  zweiter Klick-Zuhörer am Burger-Knopf: Jeder Klick hat das Menü geöffnet
   *  und sofort wieder geschlossen, es ging also gar nicht mehr auf. */
  var navVerdrahtet = false;

  function navVerhalten() {
    var nav = document.getElementById('nav');
    if (!nav || navVerdrahtet) return;
    navVerdrahtet = true;

    var aktualisieren = function () {
      nav.classList.toggle('scrolled', window.scrollY > 20 || nav.dataset.immer === 'ja');
    };
    aktualisieren();
    window.addEventListener('scroll', aktualisieren, { passive: true });

    var knopf = document.getElementById('nav-toggle');
    if (!knopf) return;

    var schliessen = function () {
      nav.classList.remove('open');
      knopf.setAttribute('aria-expanded', 'false');
      knopf.setAttribute('aria-label', 'Menü öffnen');
    };

    knopf.addEventListener('click', function () {
      var offen = nav.classList.toggle('open');
      knopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
      knopf.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('.nav-links a')) schliessen();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        schliessen();
        knopf.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (!nav.contains(e.target)) schliessen();
    });
  }

  function grundgeruest() {
    navVerhalten();

    var jahr = document.getElementById('year');
    if (jahr) jahr.textContent = new Date().getFullYear();

    var app = KONFIG.app || {};
    document.querySelectorAll('[data-app-version]').forEach(function (el) {
      if (!app.version) return;
      el.textContent = (el.textContent.trim().charAt(0) === 'v' ? 'v' : '') + app.version;
    });
    document.querySelectorAll('[data-app-date]').forEach(function (el) {
      if (app.datum) el.textContent = app.datum;
    });
    document.querySelectorAll('.discord-name').forEach(function (el) {
      if (KONFIG.discord) el.textContent = KONFIG.discord;
    });
  }

  return {
    db: db,
    startFehler: startFehler,
    konfig: KONFIG,

    sitzung: sitzung,
    nutzer: nutzer,
    profil: profil,
    schuetzen: schuetzen,
    abmelden: abmelden,
    navAufbauen: navAufbauen,

    funktion: funktion,
    fehlerText: fehlerText,
    linkFehler: linkFehler,
    adresseAufraeumen: adresseAufraeumen,
    melden: melden,
    kopieren: kopieren,

    escape: escape,
    geld: geld,
    datum: datum,
    datumZeit: datumZeit,
    groesse: groesse,
    laufzeit: laufzeit,
    lizenzStatus: lizenzStatus,
    zahlungStatus: zahlungStatus,
    restzeit: restzeit,

    grundgeruest: grundgeruest
  };
})();
