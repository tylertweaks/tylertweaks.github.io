/* ==========================================================================
   Tyler Tweaks — Warenkorb

   Gekauft wird ausschließlich über den Warenkorb: Auf der Preisseite legt man
   ein Paket hinein, bezahlt wird auf warenkorb.html. kaufen.html nimmt
   deshalb nur noch Pakete an, die wirklich im Warenkorb liegen.

   Hineinlegen darf nur, wer angemeldet ist (siehe anmeldungVerlangen). Der
   Warenkorb gehört damit zum Konto — und niemand füllt ihn, um am Ende an der
   Kasse zu erfahren, dass er ohne Konto ohnehin nicht kaufen kann.

   Der Warenkorb liegt trotzdem im Browser (localStorage) und nicht in der
   Datenbank: Er ist noch keine Bestellung, und eine Tabelle dafür wäre eine
   zweite Stelle, an der Preise stehen. Er übersteht damit einen Seitenwechsel
   und einen Neustart des Browsers, gilt aber nur auf diesem Gerät. Beim
   Abmelden wird er geleert (siehe tt-backend.js).

   Grundsatz wie überall auf dieser Seite: Was hier passiert, ist Anzeige.
   Verbindlich ist der Preis in der Datenbank, und den Rabatt rechnet die Edge
   Function paypal-create-order selbst noch einmal nach. Wer diese Datei
   austauscht, sieht falsche Zahlen im Warenkorb — abgebucht wird weiterhin
   der Betrag, den der Server ausrechnet.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.TT) return;

  var KONFIG = TT.konfig || {};

  /* Die Zahl im Schlüssel ist die Fassung des Datenformats. Ändert sich der
     Aufbau, wird sie erhöht: Dann ist ein Warenkorb aus einem früheren Besuch
     einfach weg, statt halb gelesen zu werden. */
  var SCHLUESSEL = 'tt-warenkorb-1';

  /* Wohin es zum Anmelden geht, wenn jemand ohne Konto etwas hineinlegen will.
     Das Ziel danach ist der Warenkorb selbst — dort liegt dann schon, was er
     wollte (siehe Wunsch weiter unten). "grund" sorgt nur dafür, dass das
     Anmeldeformular erklärt, warum es sich gerade meldet.

     Hinter "weiter=" hängt das Ziel, einmal kodiert: Es trägt selbst eine
     Abfrage (?paket=…), und die muss den Weg durch diese Adresse überstehen. */
  var ANMELDEN = 'anmelden.html?grund=warenkorb&weiter=';

  /* ====================================================================
     Rabattcodes

     Stehen in konfig.js, damit sie an einer Stelle gepflegt werden. Sie sind
     kein Geheimnis — ein Code, den Kunden eingeben sollen, ist das Gegenteil
     davon. Entscheidend ist nur, dass die Edge Function paypal-create-order
     dieselben Codes kennt: Dort fällt die Entscheidung über den Betrag, hier
     wird er bloß angezeigt.
     ==================================================================== */
  var CODES = (KONFIG.rabattCodes || [])
    .map(function (r) {
      var roh = String((r && r.code) || '').trim();
      return {
        code: roh.toUpperCase(),     // zum Vergleichen
        anzeige: roh,                // zum Anzeigen, in der Schreibweise aus konfig.js
        prozent: Number(r && r.prozent)
      };
    })
    .filter(function (r) { return r.code && r.prozent > 0 && r.prozent < 100; });

  /** Sucht die Beschreibung zu einem eingegebenen Code. Groß/klein ist egal. */
  function codeFinden(text) {
    var gesucht = String(text || '').trim().toUpperCase();
    if (!gesucht) return null;

    for (var i = 0; i < CODES.length; i++) {
      if (CODES[i].code === gesucht) return CODES[i];
    }
    return null;
  }

  /* ====================================================================
     Ablage

     localStorage kann fehlschlagen — im privaten Fenster oder wenn der
     Besucher Website-Daten gesperrt hat. Dann hält der Warenkorb eben nur,
     solange die Seite offen ist, statt dass ein Fehler die Seite abbricht.
     ==================================================================== */
  var ersatzAblage = null;

  function rohLesen() {
    if (ersatzAblage) return ersatzAblage;
    try {
      var text = window.localStorage.getItem(SCHLUESSEL);
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }

  function rohSchreiben(daten) {
    try {
      window.localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
      ersatzAblage = null;
    } catch (e) {
      ersatzAblage = daten;
    }
  }

  /**
   * Bringt alles, was aus der Ablage kommt, in eine verlässliche Form.
   *
   * Wichtig, weil der Inhalt aus einem früheren Besuch stammt und im
   * Entwicklerwerkzeug jeder daran schrauben kann. Alles ohne Paketnamen oder
   * mit unbrauchbarem Preis fällt hier heraus.
   */
  function normalisieren(daten) {
    var d = (daten && typeof daten === 'object') ? daten : {};
    var liste = Array.isArray(d.artikel) ? d.artikel : [];
    var gesehen = {};

    var artikel = liste
      .map(function (a) {
        return {
          slug:       String((a && a.slug) || '').trim(),
          name:       String((a && a.name) || '').trim(),
          untertitel: String((a && a.untertitel) || '').trim(),
          preis:      Number(a && a.preis),
          waehrung:   String((a && a.waehrung) || KONFIG.waehrung || 'EUR')
        };
      })
      .filter(function (a) {
        if (!a.slug || !isFinite(a.preis) || a.preis < 0) return false;
        // Ein Paket nur einmal: Mehr als eine Lizenz je Paket erzeugt der
        // Server ohnehin nicht.
        if (gesehen[a.slug]) return false;
        gesehen[a.slug] = true;
        return true;
      });

    var code = codeFinden(d.code);

    return { artikel: artikel, code: code ? code.code : '' };
  }

  function lesen()  { return normalisieren(rohLesen()); }

  function schreiben(daten) {
    rohSchreiben(normalisieren(daten));
    melden();
  }

  /* ====================================================================
     Rechnen

     Der Rabatt wird je Position abgezogen und nicht auf die Summe. Nur so
     stimmt die Zeile in der Liste mit dem Gesamtbetrag zusammen — und mit
     dem, was die Edge Function beim einzelnen Paket ausrechnet.
     ==================================================================== */
  function runden(betrag) {
    return Math.round(Number(betrag) * 100) / 100;
  }

  /**
   * Preis nach Rabatt, auf ganze Cent.
   *
   * Diese Formel steht ein zweites Mal in paypal-create-order. Beide müssen
   * auf denselben Cent kommen: Die Datenbankfunktion fulfill_paid_order
   * vergleicht den bei PayPal abgebuchten Betrag mit dem der Bestellung und
   * bricht bei einer Abweichung ab.
   */
  function rabattPreis(preis, prozent) {
    var p = Number(prozent) || 0;
    return Math.round(Number(preis) * (100 - p)) / 100;
  }

  /**
   * Rechnung über eine Liste von Positionen.
   * Ohne Argumente über den aktuellen Warenkorb mit dem aktuellen Code.
   */
  function rechnung(liste, code) {
    var daten = lesen();
    var posten = liste || daten.artikel;
    var info = codeFinden(code === undefined ? daten.code : code);
    var prozent = info ? info.prozent : 0;

    var zwischensumme = 0;
    var gesamt = 0;

    posten.forEach(function (a) {
      zwischensumme += Number(a.preis);
      gesamt += rabattPreis(a.preis, prozent);
    });

    zwischensumme = runden(zwischensumme);
    gesamt = runden(gesamt);

    return {
      anzahl:        posten.length,
      zwischensumme: zwischensumme,
      prozent:       prozent,
      code:          info ? info.code : '',
      anzeige:       info ? info.anzeige : '',
      rabatt:        runden(zwischensumme - gesamt),
      gesamt:        gesamt,
      waehrung:      (posten[0] && posten[0].waehrung) || KONFIG.waehrung || 'EUR'
    };
  }

  /* ====================================================================
     Ändern
     ==================================================================== */

  /**
   * Alle Laufzeiten der App sind dasselbe Produkt mit anderer Dauer. Zwei
   * davon gleichzeitig im Warenkorb wären zwei Lizenzen für denselben PC —
   * fast immer ein Versehen, weil die Preiskarte die Laufzeit mit einem Klick
   * umstellt. Eine neue Laufzeit ersetzt deshalb die alte.
   */
  function gruppe(slug) {
    var s = String(slug || '');
    return s.indexOf('app-') === 0 ? 'app' : s;
  }

  function artikel() { return lesen().artikel; }

  function hat(slug) {
    return artikel().some(function (a) { return a.slug === slug; });
  }

  function anzahl() { return artikel().length; }

  function hinzufuegen(neuerArtikel) {
    var neu = normalisieren({ artikel: [neuerArtikel] }).artikel[0];
    if (!neu) return { ok: false, ersetzt: '' };

    var daten = lesen();
    var ersetzt = '';

    daten.artikel = daten.artikel.filter(function (a) {
      if (gruppe(a.slug) !== gruppe(neu.slug)) return true;
      if (a.slug !== neu.slug) ersetzt = a.slug;
      return false;
    });

    daten.artikel.push(neu);
    schreiben(daten);

    return { ok: true, ersetzt: ersetzt };
  }

  function entfernen(slug) {
    var daten = lesen();
    daten.artikel = daten.artikel.filter(function (a) { return a.slug !== slug; });

    // Ein Rabattcode auf einem leeren Warenkorb verwirrt mehr, als er hilft.
    if (!daten.artikel.length) daten.code = '';

    schreiben(daten);
  }

  function leeren() {
    schreiben({ artikel: [], code: '' });
  }

  /** Der aktive Code samt Prozentsatz — oder null. */
  function codeInfo() {
    return codeFinden(lesen().code);
  }

  /**
   * Code einlösen. Gibt zurück, ob er erkannt wurde; der Aufrufer sagt es dem
   * Kunden. Ein unbekannter Code wird nicht gespeichert.
   */
  function codeSetzen(text) {
    var info = codeFinden(text);
    if (!info) return { ok: false };

    var daten = lesen();
    daten.code = info.code;
    schreiben(daten);

    return { ok: true, code: info.code, anzeige: info.anzeige, prozent: info.prozent };
  }

  function codeEntfernen() {
    var daten = lesen();
    daten.code = '';
    schreiben(daten);
  }

  /**
   * Zieht Namen und Preise aus der Datenbank nach und wirft Pakete hinaus, die
   * es nicht mehr gibt.
   *
   * Verbindlich ist immer die Datenbank. Ein Warenkorb von letzter Woche darf
   * keinen Preis versprechen, den die Kasse danach nicht einhält.
   *
   * Erwartet die Zeilen aus products (slug, name, subtitle, price, currency)
   * und darf nur mit einer erfolgreichen Abfrage aufgerufen werden — sonst
   * würde eine kurze Störung den ganzen Warenkorb leeren.
   */
  function abgleichen(produkte) {
    var nachSlug = {};
    (produkte || []).forEach(function (p) { if (p && p.slug) nachSlug[p.slug] = p; });

    var daten = lesen();
    var vorher = JSON.stringify(daten.artikel);

    daten.artikel = daten.artikel
      .filter(function (a) { return !!nachSlug[a.slug]; })
      .map(function (a) {
        var p = nachSlug[a.slug];
        return {
          slug:       a.slug,
          name:       p.name || a.name,
          untertitel: p.subtitle || a.untertitel,
          preis:      Number(p.price),
          waehrung:   p.currency || a.waehrung
        };
      });

    var geaendert = JSON.stringify(daten.artikel) !== vorher;
    if (geaendert) schreiben(daten);

    return geaendert;
  }

  /* ====================================================================
     Anmeldung

     Ohne Konto kommt nichts in den Warenkorb. Das ist keine Schikane: Die
     Lizenz entsteht auf einem Konto, der Lizenzschlüssel liegt dort, und die
     Edge Function lehnt einen Kauf ohne angemeldeten Kunden ohnehin ab. Wer
     das erst an der Kasse erfährt, hat vorher umsonst ausgewählt.

     Geprüft wird bei jedem Klick neu und nicht einmal beim Laden der Seite:
     Eine Sitzung kann ablaufen, während die Seite offen steht. getSession()
     liest dabei aus dem Browser und fragt nur dann beim Server nach, wenn das
     Token erneuert werden muss — es kostet also praktisch nichts.
     ==================================================================== */

  /* Was jemand kaufen wollte, bevor er angemeldet war. Ohne dieses Merkfeld
     stünde der Kunde nach dem Umweg über das Anmeldeformular vor einem leeren
     Warenkorb und müsste sein Paket ein zweites Mal suchen.

     Der Wunsch reist auf zwei Wegen, weil jeder für sich ausfallen kann:

       1. hier im localStorage — überlebt auch den Umweg über die
          Registrierung samt Bestätigungsmail, bei der die Adresse verloren
          geht
       2. als ?paket=<slug> in der Adresse, auf die das Anmeldeformular
          weiterleitet — das greift selbst dann, wenn 1. abgelaufen oder
          nicht verfügbar ist

     Der Zeitstempel gilt großzügig: Zwischen "in den Warenkorb" und der
     bestätigten E-Mail-Adresse liegen bei einer neuen Registrierung leicht
     ein paar Stunden. Eine Stunde war hier zu knapp — danach stand der Kunde
     wieder vor einem leeren Warenkorb. */
  var WUNSCH = 'tt-korb-wunsch-1';
  var WUNSCH_GILT_MS = 24 * 60 * 60 * 1000; // ein Tag

  function wunschMerken(artikel) {
    try {
      window.localStorage.setItem(WUNSCH,
        JSON.stringify({ artikel: artikel, zeit: Date.now() }));
    } catch (e) {
      /* Kein Speicher, kein Merken. Dann legt der Kunde sein Paket nach der
         Anmeldung eben noch einmal hinein — ärgerlich, aber nicht kaputt. */
    }
  }

  function wunschHolen() {
    try {
      var roh = window.localStorage.getItem(WUNSCH);
      if (!roh) return null;

      var d = JSON.parse(roh);
      if (!d || !d.artikel || !d.zeit) return null;
      if (Date.now() - Number(d.zeit) > WUNSCH_GILT_MS) return null;

      return d.artikel;
    } catch (e) {
      return null;
    }
  }

  function wunschVergessen() {
    try { window.localStorage.removeItem(WUNSCH); } catch (e) { /* egal */ }
  }

  async function angemeldet() {
    return !!(await TT.sitzung());
  }

  /**
   * Verlangt eine Anmeldung, bevor etwas in den Warenkorb darf.
   *
   * Gibt true zurück, wenn jemand angemeldet ist. Sonst merkt sie sich das
   * gewünschte Paket, leitet zur Anmeldung um und gibt false zurück — der
   * Aufrufer hört an dieser Stelle einfach auf.
   */
  async function anmeldungVerlangen(artikel) {
    if (await angemeldet()) return true;

    var ziel = 'warenkorb.html';

    if (artikel) {
      wunschMerken(artikel);
      // Zweiter Weg: Der Kurzname reist in der Adresse mit. Das
      // Anmeldeformular prüft das Ziel und leitet danach genau dorthin.
      ziel += '?paket=' + encodeURIComponent(artikel.slug);
    }

    window.location.href = ANMELDEN + encodeURIComponent(ziel);
    return false;
  }

  /**
   * Baut ein Paket allein aus seinem Kurznamen zusammen — aus den Werten in
   * konfig.js. Gebraucht für den Weg über die Adresse, auf dem nur der slug
   * ankommt. Name und Preis bestätigt ohnehin die Datenbank, sobald sie
   * antwortet (siehe abgleichen).
   */
  function artikelAusKonfig(slug) {
    var laufzeit = (KONFIG.laufzeiten || []).filter(function (l) {
      return l.slug === slug;
    })[0];

    if (laufzeit) {
      return {
        slug: laufzeit.slug,
        name: 'Tweak App',
        untertitel: laufzeit.lang,
        preis: laufzeit.preis
      };
    }

    var paket = (KONFIG.pakete || []).filter(function (p) { return p.slug === slug; })[0];
    if (paket) {
      return {
        slug: paket.slug,
        name: paket.name || paket.slug,
        untertitel: paket.untertitel || '',
        preis: paket.preis
      };
    }

    return null;
  }

  /** Der Wunsch aus der Adresse — ?paket=app-1y auf warenkorb.html. */
  function wunschAusAdresse() {
    var slug = new URLSearchParams(window.location.search).get('paket');
    return slug ? artikelAusKonfig(slug) : null;
  }

  /**
   * Holt nach der Anmeldung nach, was vorher nicht ging.
   *
   * Läuft beim Laden jeder Seite, tut aber nur etwas, wenn wirklich ein
   * Wunsch offen ist: Im Normalfall bleibt es bei einem Blick in den
   * localStorage und in die Adresszeile.
   */
  async function wunschEinloesen() {
    var wunsch = wunschHolen() || wunschAusAdresse();
    if (!wunsch) return;

    // Noch immer nicht angemeldet: Der Wunsch bleibt liegen, bis es klappt.
    if (!(await angemeldet())) return;

    wunschVergessen();
    if (!hat(wunsch.slug)) hinzufuegen(wunsch);

    /* Das ?paket= hat seine Arbeit getan. Bliebe es stehen, legte ein
       Neuladen der Seite dasselbe Paket noch einmal hinein, nachdem es der
       Kunde gerade herausgenommen hat. */
    if (window.location.search.indexOf('paket=') >= 0) {
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) { /* alte Browser — nicht schlimm */ }
    }
  }

  /* Der Start ist nicht sofort fertig: Ob jemand angemeldet ist, beantwortet
     supabase-js erst nach einem Umweg. Seiten, die den Warenkorb zeichnen,
     warten deshalb auf dieses Versprechen.

     Ohne das gab es einen Wettlauf: Wurde der Wunsch eingelöst, bevor
     warenkorb-seite.js seinen Zuhörer angemeldet hatte, stand in der
     Navigation die Zahl 1 — und auf der Seite daneben "Dein Warenkorb ist
     leer". Genau der Fall nach einer frischen Anmeldung. */
  var bereit = wunschEinloesen().catch(function (fehler) {
    console.error('Warenkorb-Start:', fehler);
  });

  /* ====================================================================
     Läuft der automatische Shop schon?

     Wenn ja, wird über kaufen.html bezahlt und der Lizenzschlüssel entsteht
     automatisch. Wenn nein, gilt der Übergangsweg über paypal.me und den
     Schlüssel gibt es per Discord.

     Drei Bedingungen, alle drei nötig:
       1. eine PayPal-Client-ID in konfig.js
       2. paypalUmgebung auf 'live' — oder ?shoptest=1 in der Adresse, damit
          der Betreiber die echte Kasse ausprobieren kann, während alle
          anderen weiter normal kaufen
       3. die Produkttabelle antwortet

     Diese Prüfung steht hier und nicht in script.js, weil Preisseite und
     Warenkorb dieselbe Antwort brauchen. Zwei Kopien würden irgendwann
     auseinanderlaufen — und dann bietet die eine Seite einen Kaufweg an, den
     die andere nicht einlöst.
     ==================================================================== */
  async function shopPruefen() {
    var ergebnis = { laeuft: false, produkte: null };

    if (!String(KONFIG.paypalClientId || '').trim()) return ergebnis;

    var istLive = String(KONFIG.paypalUmgebung || '').toLowerCase() === 'live';
    var testWill = new URLSearchParams(window.location.search).has('shoptest');
    if (!istLive && !testWill) return ergebnis;

    if (!TT.db) return ergebnis;

    var erg = await TT.db.from('products')
      .select('slug, name, subtitle, price, currency, active')
      .eq('active', true);

    // Datenbank nicht erreichbar (z. B. Tabellen noch nicht angelegt): lieber
    // der alte, funktionierende Weg als ein Knopf ins Leere.
    if (erg.error || !erg.data) {
      console.warn('Shop nicht bereit, Rückfall auf paypal.me:', erg.error);
      return ergebnis;
    }

    ergebnis.laeuft = true;
    ergebnis.produkte = erg.data;
    return ergebnis;
  }

  /* ====================================================================
     Bescheid geben
     ==================================================================== */
  var zuhoerer = [];

  function beiAenderung(fn) {
    if (typeof fn === 'function') zuhoerer.push(fn);
  }

  function melden() {
    knopfZeichnen();
    zuhoerer.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('Warenkorb-Zuhörer:', e); }
    });
  }

  /* Ein zweiter Tab desselben Browsers teilt sich den Warenkorb. Ohne das
     hier stünde dort weiter die alte Anzahl. */
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === SCHLUESSEL) melden();
  });

  /* ====================================================================
     Knopf in der Navigation

     Wird hier erzeugt und nicht in jede der vierzehn HTML-Seiten geschrieben:
     So gibt es eine Stelle für das Aussehen, und keine Seite kann ihn
     vergessen. Er ist bewusst kein .btn — die Knöpfe in .nav-actions
     verschwinden unter 1060 px, der Warenkorb soll aber gerade auf dem Handy
     erreichbar bleiben.
     ==================================================================== */
  var KORB_SYMBOL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>' +
    '<path d="M2 3h2.6l2.5 11.1a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 7H6.2"/></svg>';

  function knopfZeichnen() {
    var aktionen = document.querySelector('.nav-actions');
    if (!aktionen) return;

    var knopf = document.getElementById('nav-korb');

    if (!knopf) {
      knopf = document.createElement('a');
      knopf.id = 'nav-korb';
      knopf.className = 'nav-korb';
      knopf.href = 'warenkorb.html';
      knopf.innerHTML = KORB_SYMBOL + '<span class="nav-korb-zahl" id="nav-korb-zahl" hidden></span>';

      if (/warenkorb\.html$/i.test(window.location.pathname)) {
        knopf.classList.add('is-active');
      }
      aktionen.insertBefore(knopf, aktionen.firstChild);
    }

    var n = anzahl();
    var zahl = document.getElementById('nav-korb-zahl');
    if (zahl) {
      zahl.textContent = String(n);
      zahl.hidden = n === 0;
    }

    knopf.classList.toggle('voll', n > 0);
    knopf.setAttribute('aria-label',
      n === 0 ? 'Warenkorb, leer' : 'Warenkorb, ' + n + ' Artikel');
  }

  /* ====================================================================
     Nach außen
     ==================================================================== */
  TT.korb = {
    artikel:       artikel,
    anzahl:        anzahl,
    hat:           hat,
    hinzufuegen:   hinzufuegen,
    entfernen:     entfernen,
    leeren:        leeren,
    abgleichen:    abgleichen,

    angemeldet:         angemeldet,
    anmeldungVerlangen: anmeldungVerlangen,
    anmeldeZiel:        ANMELDEN + encodeURIComponent('warenkorb.html'),
    wunschVergessen:    wunschVergessen,

    /* Erfüllt, sobald ein gemerkter Wunsch eingelöst ist. Wer den Inhalt des
       Warenkorbs zeichnet, wartet darauf. */
    bereit:             bereit,

    codes:         CODES,
    codeInfo:      codeInfo,
    codeFinden:    codeFinden,
    codeSetzen:    codeSetzen,
    codeEntfernen: codeEntfernen,

    rechnung:      rechnung,
    rabattPreis:   rabattPreis,
    shopPruefen:   shopPruefen,

    beiAenderung:  beiAenderung,
    knopfZeichnen: knopfZeichnen
  };

  knopfZeichnen();
})();
