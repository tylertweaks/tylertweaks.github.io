/* ==========================================================================
   Tyler Tweaks — die Seite warenkorb.html

   Zeigt, was im Warenkorb liegt, nimmt den Rabattcode entgegen und führt zur
   Bezahlung. Welcher Weg das ist, entscheidet TT.korb.shopPruefen():

     automatischer Shop -> kaufen.html?produkt=…  (Schlüssel entsteht selbst)
     Übergangsweg       -> paypal.me mit dem Gesamtbetrag (Schlüssel per Discord)

   Der Warenkorb selbst liegt in warenkorb.js — hier steht nur die Darstellung.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.TT || !TT.korb) return;
  var KONFIG = TT.konfig;
  var korb = TT.korb;

  TT.grundgeruest();
  TT.navAufbauen();

  var elLeer  = document.getElementById('leer');
  var elKorb  = document.getElementById('korb');
  var elListe = document.getElementById('liste');

  /* Bis die Prüfungen unten antworten, gehen wir vom automatischen Shop und
     von einem angemeldeten Kunden aus — sonst blinkt beim Laden kurz der
     falsche Kaufknopf auf. Angemeldet ist hier der Normalfall: Ohne Konto
     kommt nichts in den Warenkorb. */
  var shopLaeuft = true;
  var istAngemeldet = true;

  /* verkaufPausiert in konfig.js. Für Admins hebt start() das auf
     (Testmodus, siehe TT.verkaufOffen). */
  var verkaufZu = !!KONFIG.verkaufPausiert;
  var testmodus = false;

  /* Kauf über das private PayPal-Konto (paypal.me): Der Knopf legt erst die
     Bestellung an (Edge Function paypal-privat-bestellung), danach zeigt die
     Seite die Zahlungsanleitung mit Bestellnummer. privatModus sagt, ob der
     Knopf gerade diesen Weg meint; privatFertig, ob die Anleitung steht. */
  var privatModus = false;
  var privatFertig = false;
  var bestellungLaeuft = false;

  /* ====================================================================
     Darstellung
     ==================================================================== */

  function zeilePreis(artikel, rechnung) {
    return korb.rabattPreis(artikel.preis, rechnung.prozent);
  }

  var WEG_SYMBOL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"/></svg>';

  function listeZeichnen(artikel, rechnung) {
    elListe.innerHTML = artikel.map(function (a) {
      var voll  = TT.geld(a.preis, a.waehrung);
      var jetzt = TT.geld(zeilePreis(a, rechnung), a.waehrung);

      return '<li class="korb-zeile">' +
        '<div class="korb-info">' +
          '<span class="korb-name">' + TT.escape(a.name) + '</span>' +
          (a.untertitel ? '<span class="korb-unter">' + TT.escape(a.untertitel) + '</span>' : '') +
        '</div>' +
        '<div class="korb-preis">' +
          (rechnung.prozent ? '<span class="korb-alt">' + voll + '</span>' : '') +
          '<span class="korb-jetzt">' + jetzt + '</span>' +
        '</div>' +
        '<button type="button" class="korb-weg" data-weg="' + TT.escape(a.slug) + '" ' +
                'aria-label="' + TT.escape(a.name) + ' entfernen">' + WEG_SYMBOL + '</button>' +
      '</li>';
    }).join('');
  }

  function codeZeichnen(rechnung) {
    var form   = document.getElementById('code-form');
    var aktiv  = document.getElementById('code-aktiv');
    var gilt   = rechnung.prozent > 0;

    form.hidden  = gilt;
    aktiv.hidden = !gilt;
    if (!gilt) return;

    document.getElementById('code-marke').textContent = rechnung.anzeige;
    document.getElementById('code-text').textContent =
      rechnung.prozent + ' % Rabatt · ' + TT.geld(rechnung.rabatt, rechnung.waehrung) + ' gespart';
  }

  function summeZeichnen(rechnung) {
    document.getElementById('s-zwischen').textContent =
      TT.geld(rechnung.zwischensumme, rechnung.waehrung);
    document.getElementById('s-gesamt').textContent =
      TT.geld(rechnung.gesamt, rechnung.waehrung);

    var zeile = document.getElementById('s-rabatt-zeile');
    zeile.hidden = rechnung.prozent <= 0;
    if (rechnung.prozent <= 0) return;

    document.getElementById('s-rabatt-name').textContent =
      'Rabatt ' + rechnung.anzeige + ' (' + rechnung.prozent + ' %)';
    document.getElementById('s-rabatt').textContent =
      '− ' + TT.geld(rechnung.rabatt, rechnung.waehrung);
  }

  /**
   * Der Kaufknopf.
   *
   * Zwei Wege, und es steht immer nur einer da. Im automatischen Shop wird je
   * Paket bezahlt: Die Edge Function legt genau eine Bestellung mit genau
   * einem Produkt an, weil an jeder Bestellung ein eigener Lizenzschlüssel
   * hängt. Liegen mehrere Pakete im Korb, geht es also nacheinander — nach der
   * Zahlung nimmt kaufen.js das bezahlte Paket aus dem Warenkorb und schickt
   * den Kunden für den Rest hierher zurück.
   */
  function kasseZeichnen(artikel, rechnung) {
    var knopf   = document.getElementById('zur-kasse');
    var hinweis = document.getElementById('kasse-hinweis');
    var erster  = artikel[0];
    if (!erster) return;

    knopf.classList.remove('ist-aus');
    knopf.removeAttribute('aria-disabled');

    // Die Zustimmung gehört nur zum paypal.me-Weg; jeder andere Zweig lässt
    // sie verschwinden.
    privatModus = false;
    document.getElementById('privat-zustimmung').hidden = true;

    // verkaufPausiert in konfig.js: kein Kaufweg, auch nicht über die Anmeldung.
    if (verkaufZu) {
      knopf.removeAttribute('href');
      knopf.classList.add('ist-aus');
      knopf.setAttribute('aria-disabled', 'true');
      knopf.textContent = 'Verkauf startet in Kürze';
      hinweis.textContent = 'Gerade kann noch nicht gekauft werden. Was hier liegt, ' +
        'bleibt im Warenkorb, bis es losgeht.';
      return;
    }

    /* Abgemeldet, aber der Warenkorb ist noch voll: Das passiert nach dem
       Abmelden in einem zweiten Tab oder wenn die Sitzung abgelaufen ist.
       Dann führt der Knopf zur Anmeldung statt zur Zahlung — auch auf dem
       paypal.me-Weg, denn ohne Konto gibt es hinterher keinen Ort für die
       Lizenz. */
    if (!istAngemeldet) {
      knopf.href = korb.anmeldeZiel;
      knopf.removeAttribute('target');
      knopf.removeAttribute('rel');
      knopf.textContent = 'Anmelden und bezahlen';
      hinweis.textContent = 'Der Warenkorb gehört zu deinem Konto. Melde dich an — ' +
        'was hier liegt, bleibt dabei erhalten.';
      return;
    }

    if (shopLaeuft) {
      knopf.href = 'kaufen.html?produkt=' + encodeURIComponent(erster.slug);
      knopf.removeAttribute('target');
      knopf.removeAttribute('rel');

      if (artikel.length > 1) {
        knopf.textContent = 'Weiter zur Kasse: ' + erster.name;
        hinweis.textContent = 'Zu jedem Paket gehört ein eigener Lizenzschlüssel, ' +
          'deshalb wird eines nach dem anderen bezahlt. Nach der Zahlung bist du ' +
          'wieder hier und der Rest wartet im Warenkorb. Der Rabatt gilt für jedes Paket.';
      } else {
        knopf.textContent = 'Für ' + TT.geld(rechnung.gesamt, rechnung.waehrung) + ' kaufen';
        hinweis.textContent = 'Bezahlt wird über PayPal. Für den Kauf brauchst du ein ' +
          'kostenloses Konto — den Lizenzschlüssel legt das System danach von selbst hinein.';
      }
      return;
    }

    /* ---- Übergangsweg: privates PayPal-Konto über paypal.me ---------- */
    var link = TT.paypalMeLink(rechnung.gesamt);

    if (!link) {
      // Kein paypal.me eingetragen und der automatische Shop läuft nicht:
      // Dann ehrlich sagen, dass es gerade nicht geht, statt ins Leere zu
      // verlinken.
      knopf.removeAttribute('href');
      knopf.classList.add('ist-aus');
      knopf.setAttribute('aria-disabled', 'true');
      knopf.textContent = 'Bezahlen gerade nicht möglich';
      hinweis.innerHTML = 'Schreib mir auf Discord <strong class="discord-name">' +
        '</strong> — wir klären den Kauf dann direkt.';
      TT.grundgeruest();
      return;
    }

    /* Der Knopf führt nicht mehr direkt zu PayPal, sondern legt zuerst die
       Bestellung an (siehe bestellenPrivat). Erst danach gibt es den
       paypal.me-Link — zusammen mit der Bestellnummer, die der Kunde als
       Mitteilung angibt. So findest du seine Zahlung, ohne dass er dir
       schreiben muss. */
    privatModus = true;

    var zustimmung = document.getElementById('privat-zustimmung');
    zustimmung.hidden = false;

    /* Der Verzicht auf das Rücktrittsrecht betrifft nur digitale Inhalte.
       Liegt allein die PC-Optimierung im Korb — eine Dienstleistung —, wäre
       der Satz falsch. Der Warenkorb kennt nur die Kurznamen; "optimierung"
       ist das einzige Paket ohne Lizenzschlüssel. */
    document.getElementById('privat-digital').hidden =
      artikel.every(function (a) { return a.slug === 'optimierung'; });

    var zugestimmt = document.getElementById('privat-haken').checked;

    knopf.href = '#';
    knopf.removeAttribute('target');
    knopf.removeAttribute('rel');
    knopf.textContent = 'Jetzt bestellen · ' + TT.geld(rechnung.gesamt, rechnung.waehrung);
    knopf.classList.toggle('ist-aus', !zugestimmt);
    knopf.setAttribute('aria-disabled', zugestimmt ? 'false' : 'true');

    hinweis.innerHTML =
      'Du bekommst eine Bestellnummer und zahlst danach über PayPal ' +
      '(als <strong>„Waren und Dienstleistungen“</strong> — nur dann gilt der ' +
      'Käuferschutz). Sobald das Geld da ist, kommen Lizenzschlüssel und Rechnung ' +
      'automatisch per E-Mail, meist innerhalb weniger Stunden.' +
      (rechnung.prozent
        ? ' Der Rabatt ist im Betrag schon abgezogen.'
        : '');
  }

  /**
   * Legt die Bestellung für den Kauf über paypal.me an und zeigt danach die
   * Zahlungsanleitung. Preis und Rabatt rechnet der Server; der Warenkorb
   * wird erst geleert, wenn die Bestellung wirklich steht.
   */
  async function bestellenPrivat() {
    if (bestellungLaeuft) return;

    var haken = document.getElementById('privat-haken');
    if (!haken.checked) {
      TT.melden('meldung', 'Bitte bestätige zuerst AGB und Rücktrittsbelehrung.', 'warn');
      haken.focus();
      return;
    }

    var artikel = korb.artikel();
    if (!artikel.length) return;

    var knopf = document.getElementById('zur-kasse');
    var alt = knopf.textContent;
    bestellungLaeuft = true;
    knopf.textContent = 'Bestellung wird angelegt …';
    knopf.classList.add('ist-aus');
    TT.melden('meldung', '');

    var code = korb.codeInfo();
    var antwort = await TT.funktion('paypal-privat-bestellung', {
      product_slugs: artikel.map(function (a) { return a.slug; }),
      coupon_code: code ? code.code : ''
    });

    bestellungLaeuft = false;

    if (!antwort.ok || !antwort.daten || !antwort.daten.bestellungen) {
      knopf.textContent = alt;
      knopf.classList.remove('ist-aus');
      return TT.melden('meldung', antwort.fehler || TT.fehlerText('server_error'), 'error');
    }

    var d = antwort.daten;

    /* Gegenprobe wie auf kaufen.html. Hier wird noch nicht bezahlt, deshalb
       kein Abbruch: Verbindlich ist der Betrag vom Server, und genau der steht
       gleich im PayPal-Link. Der Kunde soll aber sehen, dass er sich geändert
       hat, statt es erst bei PayPal zu bemerken. */
    var angezeigt = korb.rechnung(artikel).gesamt;
    var abweichung = Math.abs(Number(d.summe) - angezeigt) > 0.005;

    privatFertig = true;
    korb.leeren();
    fertigZeigen(d);

    if (abweichung) {
      TT.melden('meldung',
        'Der Betrag wurde neu berechnet: ' + TT.geld(d.summe, d.waehrung) + ' statt ' +
        TT.geld(angezeigt, d.waehrung) + '. Bitte zahl den Betrag, der jetzt hier steht.', 'warn');
    }
  }

  function fertigZeigen(d) {
    var nummern = d.bestellungen.map(function (b) { return '#' + b.order_no; }).join(', ');

    document.getElementById('pf-nummer').textContent = nummern;
    document.getElementById('pf-betrag').textContent = TT.geld(d.summe, d.waehrung);
    document.getElementById('pf-mitteilung').textContent = '„Bestellung ' + nummern + '“';

    var zahlen = document.getElementById('pf-zahlen');
    var link = TT.paypalMeLink(d.summe);
    if (link) {
      zahlen.href = link;
      zahlen.textContent = 'Jetzt ' + TT.geld(d.summe, d.waehrung) + ' mit PayPal bezahlen';
    } else {
      zahlen.hidden = true;
    }

    elLeer.hidden = true;
    elKorb.hidden = true;
    document.getElementById('privat-fertig').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function zeichnen() {
    // Steht die Zahlungsanleitung, bleibt sie stehen — auch wenn das Leeren
    // des Warenkorbs gleich danach hier noch einmal vorbeikommt.
    if (privatFertig) return;

    var artikel = korb.artikel();
    var rechnung = korb.rechnung(artikel);

    elLeer.hidden = artikel.length > 0;
    elKorb.hidden = artikel.length === 0;

    if (!artikel.length) return;

    listeZeichnen(artikel, rechnung);
    codeZeichnen(rechnung);
    summeZeichnen(rechnung);
    kasseZeichnen(artikel, rechnung);

    /* kasseZeichnen setzt den Hinweis jedes Mal neu, der Zusatz sammelt sich
       also nicht an. */
    if (testmodus) {
      document.getElementById('kasse-hinweis').insertAdjacentHTML('afterbegin',
        '<strong>Testmodus:</strong> Nur du als Admin siehst diesen Knopf. An dein ' +
        'eigenes PayPal-Konto kannst du nicht zahlen — zum Ausprobieren reicht es, ' +
        'bis zur PayPal-Seite zu gehen. ');
    }
  }

  /* Jede Änderung am Warenkorb zeichnet die Seite neu — egal ob sie von hier
     kommt oder aus einem zweiten Tab. */
  korb.beiAenderung(zeichnen);

  /* ====================================================================
     Bedienung
     ==================================================================== */

  /* Der Zuhörer hängt an der Liste, nicht an den einzelnen Knöpfen: die Liste
     wird bei jeder Änderung neu gezeichnet, ihr Behälter bleibt. */
  elListe.addEventListener('click', function (e) {
    var knopf = e.target.closest('[data-weg]');
    if (!knopf) return;

    korb.entfernen(knopf.dataset.weg);
    TT.melden('meldung', 'Paket aus dem Warenkorb entfernt.', 'ok');
  });

  document.getElementById('code-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    var feld = document.getElementById('code');
    var eingabe = String(feld.value || '').trim();

    if (!eingabe) {
      return TT.melden('meldung', 'Bitte gib einen Rabattcode ein.', 'warn');
    }

    // Die Datenbank prüft den Code — kurz den Knopf sperren, sonst schickt
    // ein Doppelklick zwei Anfragen.
    var knopf = e.target.querySelector('button[type="submit"]');
    if (knopf) knopf.disabled = true;
    var erg = await korb.codeSetzen(eingabe);
    if (knopf) knopf.disabled = false;

    if (!erg.ok) {
      return TT.melden('meldung',
        erg.grund === 'netz'
          ? 'Der Rabattcode lässt sich gerade nicht prüfen. Versuch es in einem Moment noch einmal.'
          : 'Diesen Rabattcode gibt es nicht oder er ist abgelaufen. Prüfe bitte die Schreibweise.',
        'error');
    }

    feld.value = '';
    TT.melden('meldung',
      'Rabattcode ' + erg.anzeige + ' eingelöst — ' + erg.prozent + ' % weniger.', 'ok');
  });

  document.getElementById('code-weg').addEventListener('click', function () {
    korb.codeEntfernen();
    TT.melden('meldung', 'Rabattcode entfernt.', 'warn');
  });

  document.getElementById('zur-kasse').addEventListener('click', function (e) {
    // Nur der paypal.me-Weg wird hier abgefangen; alle anderen Zweige sind
    // gewöhnliche Links.
    if (!privatModus) return;
    e.preventDefault();
    bestellenPrivat();
  });

  // Mit dem Haken wird der Knopf freigegeben.
  document.getElementById('privat-haken').addEventListener('change', function () {
    if (this.checked) TT.melden('meldung', '');
    zeichnen();
  });

  document.getElementById('leeren').addEventListener('click', function () {
    korb.leeren();
    TT.melden('meldung', '');
  });

  /* ====================================================================
     Start
     ==================================================================== */
  (async function start() {
    /* Zuerst warten, bis warenkorb.js seinen Start erledigt hat: Kommt der
       Kunde gerade von der Anmeldung, legt der erst noch das Paket hinein,
       das er vorher wollte. Ohne dieses Warten zeichnet die Seite den
       Warenkorb eine Wimper zu früh — und zeigt "leer", während in der
       Navigation schon die 1 steht. Im Normalfall kostet es nichts. */
    await korb.bereit;

    // Jetzt aus dem Browser zeichnen: Der Warenkorb liegt lokal, da muss
    // niemand auf den Server warten.
    zeichnen();

    if (TT.startFehler) {
      return TT.melden('meldung', TT.startFehler, 'error');
    }

    /* Zuerst die Anmeldung: Die Antwort kommt aus dem Browser und ist sofort
       da, während die Produktabfrage über das Netz geht. */
    istAngemeldet = await korb.angemeldet();

    if (verkaufZu && TT.verkaufOffen && await TT.verkaufOffen()) {
      verkaufZu = false;
      testmodus = true;
    }
    zeichnen();

    var stand = await korb.shopPruefen();
    shopLaeuft = stand.laeuft;

    /* Preise und Namen aus der Datenbank nachziehen. Nur bei einer
       erfolgreichen Abfrage — sonst würde eine kurze Störung den Warenkorb
       leeren. */
    if (stand.produkte) {
      var geaendert = korb.abgleichen(stand.produkte);
      if (geaendert) {
        TT.melden('meldung',
          'Im Warenkorb hat sich etwas geändert — bitte sieh die Beträge noch ' +
          'einmal durch. Es gilt immer der Preis, der hier steht.', 'warn');
      }
    }

    // Ein eingelöster Code kann seitdem abgelaufen oder ausgeschöpft sein.
    if (await korb.codeAbgleichen()) {
      TT.melden('meldung',
        korb.codeInfo()
          ? 'Dein Rabattcode hat sich geändert — bitte sieh die Beträge noch einmal durch.'
          : 'Dein Rabattcode gilt nicht mehr und wurde herausgenommen.', 'warn');
    }

    zeichnen();
  })();
})();
