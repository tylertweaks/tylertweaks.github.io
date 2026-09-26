/* ==========================================================================
   Tyler Tweaks — Kundenbereich

   Lädt Bestellungen und Lizenzen des angemeldeten Kunden. Welche Zeilen er
   dabei zu sehen bekommt, entscheidet nicht diese Datei, sondern die
   Datenbank: Row Level Security in Supabase gibt pro Abfrage ausschließlich
   die Zeilen heraus, deren user_id zum angemeldeten Konto passt. Ein
   manipulierter Browser bekommt schlicht nichts zurück.

   Auch der Status ("Aktiv", "Abgelaufen", "Bezahlt") wird aus den echten
   Serverdaten berechnet, nicht gesetzt.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.TT) return;
  var db = TT.db;
  var KONFIG = TT.konfig;

  TT.grundgeruest();
  TT.navAufbauen();

  var daten = {
    profil: null,
    nutzer: null,
    bestellungen: [],
    lizenzen: [],
    produkte: {},
    release: null,
    ladefehler: null
  };

  /* Kommt der Kunde frisch über den Bestätigungslink, steht das Anmelde-Token
     in der Adresse. Der Merker wird gelesen, bevor wir die Adresse säubern. */
  var frischBestaetigt = new URLSearchParams(window.location.search).has('willkommen');

  function adresseSaeubern() {
    var hash = String(window.location.hash || '');
    var istToken = /access_token|refresh_token|^#?code=|type=/.test(hash);
    if (!istToken && !frischBestaetigt) return;

    try {
      history.replaceState(null, '', window.location.pathname + (istToken ? '' : hash));
    } catch (e) { /* alte Browser — nicht schlimm */ }
  }

  /* ====================================================================
     Start
     ==================================================================== */
  (async function start() {
    if (TT.startFehler) {
      document.getElementById('laden').textContent = TT.startFehler;
      return;
    }

    var sitzung = await TT.schuetzen();
    if (!sitzung) return;

    adresseSaeubern();

    daten.nutzer = sitzung.user;
    daten.profil = await TT.profil(true);

    await ladeAlles();

    document.getElementById('laden').hidden = true;
    document.getElementById('konto').hidden = false;

    aufbauen();
    bereichAusAdresse();
  })();

  async function ladeAlles() {
    var ergebnisse = await Promise.all([
      db.from('orders')
        .select('id, order_no, product_slug, product_name, price, currency, payment_provider, payment_status, paypal_order_id, paid_at, created_at')
        .order('created_at', { ascending: false }),

      db.from('licenses')
        .select('id, key, type, expires_at, created_at, activated_at, revoked, hwid, product_slug, order_id')
        .order('created_at', { ascending: false }),

      db.from('products').select('slug, name, subtitle, is_download, is_service'),

      db.rpc('get_release_info')
    ]);

    if (!ergebnisse[0].error) daten.bestellungen = ergebnisse[0].data || [];
    if (!ergebnisse[1].error) daten.lizenzen = ergebnisse[1].data || [];

    if (!ergebnisse[2].error) {
      (ergebnisse[2].data || []).forEach(function (p) { daten.produkte[p.slug] = p; });
    }

    if (!ergebnisse[3].error) {
      var r = ergebnisse[3].data;
      daten.release = Array.isArray(r) ? r[0] : r;
    }

    var fehler = ergebnisse.filter(function (e) { return e.error; });
    if (fehler.length) {
      console.error('Konto laden:', fehler.map(function (f) { return f.error; }));

      /* Wichtig: Wenn Bestellungen oder Lizenzen nicht geladen werden konnten,
         darf hier NICHT "Noch keine Bestellung" stehen. Das wäre glatt gelogen
         — der Kunde hätte vielleicht bezahlt und sähe nichts. Stattdessen wird
         ehrlich gesagt, dass die Daten gerade nicht abrufbar sind. */
      daten.ladefehler = ergebnisse[0].error || ergebnisse[1].error || null;
    }
  }

  /** Meldet ehrlich, wenn Bestellungen/Lizenzen nicht geladen werden konnten. */
  function ladefehlerMelden() {
    if (!daten.ladefehler) return;

    var f = daten.ladefehler;
    var tabelleFehlt = f.code === 'PGRST205' ||
      /schema cache|does not exist/i.test(String(f.message || ''));

    TT.melden('meldung',
      'Deine Bestellungen und Lizenzen lassen sich gerade nicht abrufen. ' +
      'Das liegt an uns, nicht an dir — deine Käufe sind nicht verloren. ' +
      'Versuch es in ein paar Minuten noch einmal.', 'error');

    if (tabelleFehlt) {
      console.warn(
        'Betreiber-Hinweis: Die Shop-Tabellen fehlen. Führe ' +
        '01-lizenztypen-erweitern.sql und 02-shop-schema.sql im ' +
        'Supabase-SQL-Editor aus (Schritt 1 der Einrichtung).');
    }
  }

  /* ====================================================================
     Navigation zwischen den Bereichen
     ==================================================================== */
  var BEREICHE = ['uebersicht', 'bestellungen', 'produkte', 'lizenzen', 'downloads', 'kontodaten'];

  function bereichZeigen(name, adresseSetzen) {
    if (BEREICHE.indexOf(name) < 0) name = 'uebersicht';

    BEREICHE.forEach(function (b) {
      var el = document.getElementById('bereich-' + b);
      if (el) el.hidden = b !== name;
    });

    document.querySelectorAll('#konto-nav button').forEach(function (k) {
      k.classList.toggle('an', k.dataset.ziel === name);
    });

    if (adresseSetzen) {
      try { history.replaceState(null, '', '#' + name); } catch (e) { /* egal */ }
    }
  }

  function bereichAusAdresse() {
    var hash = String(window.location.hash || '').replace(/^#/, '');
    bereichZeigen(hash || 'uebersicht', false);
  }

  document.getElementById('konto-nav').addEventListener('click', function (e) {
    var knopf = e.target.closest('button[data-ziel]');
    if (!knopf) return;
    bereichZeigen(knopf.dataset.ziel, true);
    document.querySelector('.konto-inhalt').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('hashchange', bereichAusAdresse);

  document.getElementById('abmelden').addEventListener('click', function () {
    TT.abmelden();
  });

  /* ====================================================================
     Alles füllen
     ==================================================================== */
  function aufbauen() {
    ladefehlerMelden();
    kopfFuellen();
    uebersichtFuellen();
    bestellungenFuellen();
    produkteFuellen();
    lizenzenFuellen();
    downloadsFuellen();
    kontodatenFuellen();
  }

  function kopfFuellen() {
    var name = (daten.profil && daten.profil.name) || '';
    document.getElementById('k-name').textContent = name ? name.split(' ')[0] : 'Gamer';
    document.getElementById('k-email').textContent = daten.nutzer.email;

    if (frischBestaetigt) {
      document.getElementById('willkommen-neu').hidden = false;
    }
    if (!daten.nutzer.email_confirmed_at) {
      document.getElementById('mail-offen').hidden = false;
    }
  }

  /* ---- Hilfsfunktionen ------------------------------------------------- */

  /** Die noch gültige Lizenz zu einem Produkt-Slug, sonst die neueste. */
  function lizenzZuProdukt(slug) {
    var passend = daten.lizenzen.filter(function (l) { return l.product_slug === slug; });
    if (!passend.length) return null;

    var gueltig = passend.filter(function (l) {
      return TT.lizenzStatus(l).klasse === 'an';
    });
    return gueltig[0] || passend[0];
  }

  /** Produkte, die der Kunde tatsächlich bezahlt hat. */
  function besitz() {
    var gesehen = {};
    var liste = [];

    daten.bestellungen
      .filter(function (b) { return b.payment_status === 'paid'; })
      .forEach(function (b) {
        if (gesehen[b.product_slug]) return;
        gesehen[b.product_slug] = true;

        liste.push({
          slug: b.product_slug,
          name: b.product_name,
          produkt: daten.produkte[b.product_slug] || null,
          bestellung: b,
          lizenz: lizenzZuProdukt(b.product_slug)
        });
      });

    return liste;
  }

  function leerKasten(titel, text, knopfText, knopfZiel) {
    /* Konnten die Daten nicht geladen werden, ist "Noch nichts vorhanden"
       die falsche Auskunft. Jeder leere Bereich sagt dann stattdessen die
       Wahrheit. */
    if (daten.ladefehler) {
      return '<div class="leer-kasten">' +
        '<h3>Daten gerade nicht abrufbar</h3>' +
        '<p>Das ist ein Problem auf unserer Seite, nicht bei dir. ' +
        'Deine Käufe und Lizenzen sind nicht verloren — versuch es in ein ' +
        'paar Minuten noch einmal.</p>' +
        '</div>';
    }

    return '<div class="leer-kasten">' +
      '<h3>' + TT.escape(titel) + '</h3>' +
      '<p>' + TT.escape(text) + '</p>' +
      (knopfText ? '<a href="' + knopfZiel + '" class="btn btn-primary">' +
        TT.escape(knopfText) + '</a>' : '') +
      '</div>';
  }

  function statusPunkt(status) {
    return '<span class="status status-' + status.klasse + '">' +
      '<span class="punkt" aria-hidden="true"></span>' + TT.escape(status.text) + '</span>';
  }

  /* ---- Übersicht -------------------------------------------------------
     Das Erste, was der Kunde nach dem Anmelden sieht. Deshalb steht hier
     alles, was er im Alltag wirklich braucht — Schlüssel zum Kopieren und
     Download — statt ihn erst durch drei Bereiche klicken zu lassen.
     --------------------------------------------------------------------- */
  function uebersichtFuellen() {
    var meine = besitz();
    var ziel = document.getElementById('u-produkte');
    var schnell = document.getElementById('u-schnellzugriff');

    /* Die wichtigste Lizenz oben: die gültige mit der längsten Restlaufzeit. */
    var beste = daten.lizenzen
      .filter(function (l) { return TT.lizenzStatus(l).klasse === 'an'; })
      .sort(function (a, b) {
        if (!a.expires_at) return -1;          // Lifetime zuerst
        if (!b.expires_at) return 1;
        return new Date(b.expires_at) - new Date(a.expires_at);
      })[0];

    if (schnell) {
      schnell.innerHTML = beste ? schnellzugriff(beste) : '';
      schnell.hidden = !beste;
    }

    if (!meine.length) {
      ziel.innerHTML = leerKasten(
        'Noch kein Produkt',
        'Sobald du ein Paket kaufst, erscheint es hier — mit Lizenzschlüssel und Download.',
        'Pakete ansehen', 'index.html#preise');
    } else {
      ziel.innerHTML = meine.map(produktKarte).join('');
    }

    var letzte = daten.bestellungen[0];
    var zielB = document.getElementById('u-bestellung');
    zielB.innerHTML = letzte
      ? bestellKarte(letzte)
      : leerKasten('Noch keine Bestellung', 'Hier erscheint deine erste Bestellung.', null);
  }

  /** Der Kasten ganz oben: Schlüssel kopieren und herunterladen, ohne Umweg. */
  function schnellzugriff(l) {
    var produkt = daten.produkte[l.product_slug];
    var name = produkt ? produkt.name : 'Tyler Tweaks App';
    var darfLaden = produkt && produkt.is_download;

    var restzeile = l.expires_at
      ? '<li><span class="k">Läuft ab</span><span class="v">' +
        TT.escape(TT.datum(l.expires_at)) + ' · ' + TT.escape(TT.restzeit(l.expires_at)) +
        '</span></li>'
      : '<li><span class="k">Laufzeit</span><span class="v">unbegrenzt gültig</span></li>';

    return '<section class="panel panel-accent schnellzugriff">' +
      '<div class="bestell-kopf">' +
        '<div>' +
          '<span class="bestell-nummer">Einsatzbereit</span>' +
          '<h2>' + TT.escape(name) + '</h2>' +
        '</div>' +
        statusPunkt(TT.lizenzStatus(l)) +
      '</div>' +

      '<label class="lizenz-label">Dein Lizenz-Key</label>' +
      '<div class="keyline">' +
        '<span class="key-text">' + TT.escape(l.key) + '</span>' +
        '<button type="button" class="key-kopieren" data-key="' + TT.escape(l.key) + '">Key kopieren</button>' +
      '</div>' +

      '<ul class="speclist">' + restzeile +
        '<li><span class="k">PC</span><span class="v">' +
          (l.hwid ? 'gebunden' : 'noch frei — wird beim ersten Start gebunden') + '</span></li>' +
      '</ul>' +

      (darfLaden
        ? '<button type="button" class="btn btn-primary btn-block download-knopf" style="margin-top:6px">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 20h16"/></svg>App herunterladen</button>'
        : '') +

      '<p class="schnell-hinweis">' +
        'App starten, Schlüssel einfügen, fertig. Den Schlüssel findest du ' +
        'jederzeit hier wieder.' +
      '</p>' +
    '</section>';
  }

  /* ---- Produktkarte ---------------------------------------------------- */
  function produktKarte(eintrag) {
    var lizenz = eintrag.lizenz;
    var produktInfo = eintrag.produkt;
    var istService = produktInfo ? produktInfo.is_service : false;
    var istDownload = produktInfo ? produktInfo.is_download : false;

    var status = lizenz
      ? TT.lizenzStatus(lizenz)
      : { text: istService ? 'Gekauft' : 'Ohne Lizenz', klasse: istService ? 'an' : 'aus' };

    var zeilen = '';

    if (lizenz) {
      zeilen += '<li><span class="k">Laufzeit</span><span class="v">' +
        TT.escape(TT.laufzeit(lizenz.type)) + '</span></li>';

      if (lizenz.expires_at) {
        zeilen += '<li><span class="k">Läuft ab</span><span class="v">' +
          TT.escape(TT.datum(lizenz.expires_at)) + '</span></li>';
      }
      zeilen += '<li><span class="k">PC gebunden</span><span class="v">' +
        (lizenz.hwid ? 'ja' : 'noch nicht') + '</span></li>';
    }

    if (istService) {
      zeilen += '<li><span class="k">Optimierung</span><span class="v">Termin per Discord</span></li>';
    }

    var knopf = '';
    if (istDownload) {
      var darf = lizenz && TT.lizenzStatus(lizenz).klasse === 'an';
      knopf = darf
        ? '<button type="button" class="btn btn-primary btn-block download-knopf">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 20h16"/></svg>App herunterladen</button>'
        : '<a href="index.html#preise" class="btn btn-outline btn-block">Lizenz verlängern</a>';
    }

    return '<article class="produkt-karte">' +
      '<div class="produkt-kopf">' +
        '<h3>' + TT.escape(eintrag.name) + '</h3>' +
        statusPunkt(status) +
      '</div>' +
      (zeilen ? '<ul class="speclist">' + zeilen + '</ul>' : '') +
      (knopf ? '<div class="produkt-fuss">' + knopf + '</div>' : '') +
    '</article>';
  }

  /* ---- Bestellkarte ---------------------------------------------------- */
  function bestellKarte(b) {
    var status = TT.zahlungStatus(b.payment_status);

    return '<article class="bestell-karte">' +
      '<div class="bestell-kopf">' +
        '<div>' +
          '<span class="bestell-nummer">Bestellung #' + TT.escape(b.order_no) + '</span>' +
          '<h3>' + TT.escape(b.product_name) + '</h3>' +
        '</div>' +
        statusPunkt(status) +
      '</div>' +
      '<ul class="speclist">' +
        '<li><span class="k">Preis</span><span class="v">' + TT.escape(TT.geld(b.price, b.currency)) + '</span></li>' +
        '<li><span class="k">Zahlungsart</span><span class="v">' +
          (b.payment_provider === 'paypal' ? 'PayPal' : TT.escape(b.payment_provider)) + '</span></li>' +
        '<li><span class="k">Bestellt am</span><span class="v">' + TT.escape(TT.datumZeit(b.created_at)) + '</span></li>' +
        (b.paid_at
          ? '<li><span class="k">Bezahlt am</span><span class="v">' + TT.escape(TT.datumZeit(b.paid_at)) + '</span></li>'
          : '') +
        (b.paypal_order_id
          ? '<li><span class="k">PayPal-Vorgang</span><span class="v mono">' + TT.escape(b.paypal_order_id) + '</span></li>'
          : '') +
      '</ul>' +
      (b.payment_status === 'created'
        ? '<p class="bestell-hinweis">Diese Bestellung wurde nicht abgeschlossen. Es wurde nichts abgebucht.</p>'
        : '') +
      (b.payment_status === 'pending'
        ? '<p class="bestell-hinweis">PayPal prüft die Zahlung noch. Sobald sie bestätigt ist, erscheint deine Lizenz automatisch.</p>'
        : '') +
    '</article>';
  }

  /* ---- Bestellungen ---------------------------------------------------- */
  function bestellungenFuellen() {
    var ziel = document.getElementById('b-liste');
    ziel.innerHTML = daten.bestellungen.length
      ? daten.bestellungen.map(bestellKarte).join('')
      : leerKasten('Noch keine Bestellung',
          'Hier erscheint jede Bestellung automatisch, sobald PayPal die Zahlung bestätigt hat.',
          'Pakete ansehen', 'index.html#preise');
  }

  /* ---- Produkte -------------------------------------------------------- */
  function produkteFuellen() {
    var meine = besitz();
    var ziel = document.getElementById('p-liste');
    ziel.innerHTML = meine.length
      ? meine.map(produktKarte).join('')
      : leerKasten('Noch kein Produkt',
          'Sobald du ein Paket kaufst, erscheint es hier.',
          'Pakete ansehen', 'index.html#preise');
  }

  /* ---- Lizenzen -------------------------------------------------------- */
  function lizenzenFuellen() {
    var ziel = document.getElementById('l-liste');

    if (!daten.lizenzen.length) {
      ziel.innerHTML = leerKasten('Noch keine Lizenz',
        'Nach einem Kauf erscheint dein Lizenzschlüssel hier, sobald die Zahlung bestätigt ist.',
        'Pakete ansehen', 'index.html#preise');
      return;
    }

    ziel.innerHTML = daten.lizenzen.map(function (l) {
      var status = TT.lizenzStatus(l);
      var produkt = daten.produkte[l.product_slug];
      var name = produkt ? produkt.name : 'Tyler Tweaks App';

      var zeilen =
        '<li><span class="k">Laufzeit</span><span class="v">' + TT.escape(TT.laufzeit(l.type)) + '</span></li>' +
        '<li><span class="k">Ausgestellt am</span><span class="v">' + TT.escape(TT.datum(l.created_at)) + '</span></li>';

      if (l.expires_at) {
        zeilen += '<li><span class="k">Ablaufdatum</span><span class="v">' +
          TT.escape(TT.datum(l.expires_at)) + '</span></li>' +
          '<li><span class="k">Verbleibend</span><span class="v">' +
          TT.escape(TT.restzeit(l.expires_at)) + '</span></li>';
      } else {
        zeilen += '<li><span class="k">Ablaufdatum</span><span class="v">kein — unbegrenzt gültig</span></li>';
      }

      zeilen += '<li><span class="k">Aktiviert am</span><span class="v">' +
        (l.activated_at ? TT.escape(TT.datumZeit(l.activated_at)) : 'noch nicht') + '</span></li>' +
        '<li><span class="k">Gültig für</span><span class="v">1 PC' +
        (l.hwid ? ' (gebunden)' : ' (noch frei)') + '</span></li>';

      var hinweis = '';
      if (l.revoked) {
        hinweis = '<p class="bestell-hinweis warn">Diese Lizenz ist gesperrt. ' +
          'Melde dich auf Discord, dann klären wir das.</p>';
      } else if (status.klasse === 'aus') {
        hinweis = '<p class="bestell-hinweis warn">Diese Lizenz ist abgelaufen. ' +
          'Die App lässt sich damit nicht mehr freischalten.</p>';
      }

      return '<article class="lizenz-karte' + (status.klasse === 'an' ? ' aktiv' : '') + '">' +
        '<div class="bestell-kopf">' +
          '<div><h3>' + TT.escape(name) + '</h3></div>' +
          statusPunkt(status) +
        '</div>' +
        '<label class="lizenz-label">Lizenz-Key</label>' +
        '<div class="keyline">' +
          '<span class="key-text">' + TT.escape(l.key) + '</span>' +
          '<button type="button" class="key-kopieren" data-key="' + TT.escape(l.key) + '">Key kopieren</button>' +
        '</div>' +
        '<ul class="speclist">' + zeilen + '</ul>' +
        hinweis +
      '</article>';
    }).join('');
  }

  /* Kopieren — ein Zuhörer für alle Schaltflächen */
  document.addEventListener('click', async function (e) {
    var knopf = e.target.closest('.key-kopieren');
    if (!knopf) return;

    var erfolg = await TT.kopieren(knopf.dataset.key || '');
    var alt = knopf.textContent;
    knopf.textContent = erfolg ? 'Kopiert ✓' : 'Bitte markieren';
    knopf.classList.toggle('ok', erfolg);

    setTimeout(function () {
      knopf.textContent = alt;
      knopf.classList.remove('ok');
    }, 2200);
  });

  /* ---- Downloads ------------------------------------------------------- */
  function downloadsFuellen() {
    var ziel = document.getElementById('d-inhalt');

    var darf = daten.lizenzen.some(function (l) {
      var p = daten.produkte[l.product_slug];
      return p && p.is_download && TT.lizenzStatus(l).klasse === 'an';
    });

    if (!darf) {
      ziel.innerHTML = leerKasten(
        'Kein Download freigeschaltet',
        'Für den Download brauchst du eine gültige Lizenz der Tweak App. ' +
        'Läuft deine Lizenz ab, wird auch der Download gesperrt.',
        'Lizenz kaufen', 'index.html#preise');
      changelogFuellen();
      return;
    }

    var r = daten.release || {};
    var app = KONFIG.app || {};

    /* Zwei mögliche Quellen für die Datei:
       1. app_release in Supabase  -> geschützter Link über die Edge Function
       2. app.datei in konfig.js   -> Datei liegt im Repository
       Ist (1) eingerichtet, hat sie Vorrang. Sonst greift (2). */
    var groesse = r.size_bytes ? TT.groesse(r.size_bytes) : (app.groesse || '');
    var pruefsumme = r.sha256 || app.sha256 || '';
    var version = r.version || app.version || '—';

    ziel.innerHTML =
      '<section class="panel panel-accent">' +
        '<h2>Tyler Tweaks App</h2>' +
        '<p class="muted" style="font-size:.93rem">' +
          'Lade die Datei, starte sie und gib beim ersten Start deinen Lizenzschlüssel ein. ' +
          'Die App fordert Administratorrechte an — das braucht sie, um Windows-Einstellungen zu ändern.' +
        '</p>' +
        '<button type="button" class="btn btn-primary btn-block" id="download-knopf" style="margin-top:18px">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 20h16"/></svg>' +
          'Setup herunterladen</button>' +
        '<p class="download-status" id="download-status" hidden></p>' +
        '<div class="dl-meta">' +
          '<span>Version <strong>' + TT.escape(version) + '</strong></span>' +
          '<span>Stand <strong>' +
            TT.escape(r.published_at ? TT.datum(r.published_at) : (app.datum || '—')) +
          '</strong></span>' +
          (groesse ? '<span>' + TT.escape(groesse) + '</span>' : '') +
          '<span>Windows 10 / 11 · 64-Bit</span>' +
        '</div>' +
        (pruefsumme
          ? '<p class="pruefsumme">SHA-256: <code>' + TT.escape(pruefsumme) + '</code></p>'
          : '') +
      '</section>';

    changelogFuellen();
  }

  function changelogFuellen() {
    var liste = document.getElementById('changelog');
    if (!liste) return;

    var eintraege = (KONFIG.changelog || []);
    liste.innerHTML = eintraege.length
      ? eintraege.map(function (e) {
          return '<li><div class="ver">' +
            '<span class="v">' + TT.escape(e.version) + '</span>' +
            '<span class="d">' + TT.escape(e.datum) + '</span></div>' +
            '<p>' + TT.escape(e.text) + '</p></li>';
        }).join('')
      : '<li><p class="muted">Noch keine Einträge.</p></li>';
  }

  /* Download anstoßen — zwei mögliche Schaltflächen (Produktkarte + Bereich) */
  document.addEventListener('click', async function (e) {
    var knopf = e.target.closest('#download-knopf, .download-knopf');
    if (!knopf) return;

    var status = document.getElementById('download-status');
    knopf.disabled = true;
    var alt = knopf.innerHTML;
    knopf.textContent = 'Link wird erzeugt …';
    if (status) { status.hidden = true; status.textContent = ''; }

    var antwort = await TT.funktion('download', {});

    knopf.disabled = false;
    knopf.innerHTML = alt;

    var adresse = null;
    var dateiname = '';

    if (antwort.ok && antwort.daten && antwort.daten.url) {
      // Geschützter Link aus dem Speicher, zwei Minuten gültig.
      adresse = antwort.daten.url;
      dateiname = antwort.daten.filename || '';

    } else if (antwort.code === 'no_release' && (KONFIG.app || {}).datei) {
      /* Kein Speicher eingerichtet, aber die Datei liegt im Repository.
         Den Knopf sieht ohnehin nur, wer eine gültige Lizenz hat — und der
         eigentliche Schutz ist der Schlüssel, nicht die Adresse der Datei. */
      adresse = KONFIG.app.datei;

      /* Den Speichernamen aus dem Pfad nehmen, nicht neu zusammensetzen.
         Vorher stand hier 'TylerTweaks-Setup-' + version + '.exe' — eine
         zweite Schreibweise des Dateinamens, die niemand mitpflegt. Beim
         Wechsel auf TylerTweaksSetup-2.5.0.exe hätte der Kunde die richtige
         Datei unter einem Namen gespeichert, den es auf dem Server nicht
         gibt. Ein Schrägstrich-Split kann nicht auseinanderlaufen. */
      dateiname = String(KONFIG.app.datei).split('/').pop();

    } else {
      if (status) {
        status.textContent = antwort.fehler;
        status.className = 'download-status fehler';
        status.hidden = false;
      } else {
        TT.melden('meldung', antwort.fehler, 'error');
      }
      return;
    }

    var a = document.createElement('a');
    a.href = adresse;
    a.download = dateiname;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (status) {
      status.textContent = 'Der Download startet. Passiert nichts, erlaube Downloads für diese Seite.';
      status.className = 'download-status ok';
      status.hidden = false;
    }
  });

  /* ---- Kontodaten ------------------------------------------------------ */
  function kontodatenFuellen() {
    document.getElementById('kd-name').value = (daten.profil && daten.profil.name) || '';
    document.getElementById('kd-email').value = daten.nutzer.email || '';
    document.getElementById('kd-seit').textContent =
      TT.datum((daten.profil && daten.profil.created_at) || daten.nutzer.created_at);
    document.getElementById('kd-bestellungen').textContent = daten.bestellungen.length;
    document.getElementById('kd-lizenzen').textContent = daten.lizenzen.length;
  }

  document.getElementById('form-konto').addEventListener('submit', async function (e) {
    e.preventDefault();
    TT.melden('konto-meldung', '');

    var name = document.getElementById('kd-name').value.trim();
    if (name.length < 2) {
      return TT.melden('konto-meldung', 'Bitte gib deinen Namen an.');
    }

    var knopf = e.target.querySelector('button[type="submit"]');
    knopf.disabled = true;

    var erg = await db.from('profiles')
      .update({ name: name })
      .eq('id', daten.nutzer.id);

    knopf.disabled = false;

    if (erg.error) {
      console.error('Profil speichern:', erg.error);
      return TT.melden('konto-meldung', 'Das Speichern hat nicht geklappt. Versuche es noch einmal.');
    }

    daten.profil.name = name;
    document.getElementById('k-name').textContent = name.split(' ')[0];
    TT.navAufbauen();
    TT.melden('konto-meldung', 'Gespeichert.', 'ok');
  });

  document.getElementById('passwort-aendern').addEventListener('click', async function () {
    var knopf = this;
    knopf.disabled = true;
    knopf.textContent = 'Wird gesendet …';

    var basis = String(KONFIG.seitenUrl || window.location.origin).replace(/\/+$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      basis = window.location.origin;
    }

    var erg = await db.auth.resetPasswordForEmail(daten.nutzer.email, {
      redirectTo: basis + '/passwort-neu.html'
    });

    knopf.disabled = false;
    knopf.textContent = 'Link zum Ändern anfordern';

    TT.melden('konto-meldung',
      erg.error
        ? TT.fehlerText(erg.error)
        : 'Wir haben dir einen Link an ' + daten.nutzer.email + ' geschickt.',
      erg.error ? 'error' : 'ok');
  });
})();
