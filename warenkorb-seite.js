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

  /* ====================================================================
     Darstellung
     ==================================================================== */

  /** paypal.me erwartet den Betrag ohne Komma: 15EUR, 8.99EUR */
  function paypalMeLink(betrag) {
    var basis = String(KONFIG.paypalMe || '').replace(/\/+$/, '');
    var zahl = Number(betrag);
    if (!basis || !isFinite(zahl) || zahl <= 0) return null;

    return basis + '/' + (zahl % 1 === 0 ? String(zahl) : zahl.toFixed(2)) + 'EUR';
  }

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

    /* ---- Übergangsweg: direkt an paypal.me --------------------------- */
    var link = paypalMeLink(rechnung.gesamt);

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

    knopf.href = link;
    knopf.target = '_blank';
    knopf.rel = 'noopener';
    knopf.textContent = 'Für ' + TT.geld(rechnung.gesamt, rechnung.waehrung) + ' über PayPal zahlen';

    hinweis.innerHTML =
      'Wähle bei PayPal <strong>„Waren und Dienstleistungen“</strong> — nur dann gilt ' +
      'der Käuferschutz. Nach der Zahlung schreib mir kurz auf Discord ' +
      '<strong class="discord-name"></strong> oder an <a class="kontakt-email"></a>, ' +
      'unter welchem Namen du bezahlt hast. Sobald die Zahlung da ist, schalte ich ' +
      'dich frei; Lizenzschlüssel und Rechnung kommen per E-Mail, meist innerhalb ' +
      'weniger Stunden.' +
      (rechnung.prozent
        ? ' Der Rabatt ist im Betrag oben schon abgezogen.'
        : '');
    TT.grundgeruest(); // Discord-Namen und E-Mail in den neuen Text einsetzen
  }

  function zeichnen() {
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

  document.getElementById('code-form').addEventListener('submit', function (e) {
    e.preventDefault();

    var feld = document.getElementById('code');
    var eingabe = String(feld.value || '').trim();

    if (!eingabe) {
      return TT.melden('meldung', 'Bitte gib einen Rabattcode ein.', 'warn');
    }

    var erg = korb.codeSetzen(eingabe);
    if (!erg.ok) {
      return TT.melden('meldung',
        'Diesen Rabattcode kenne ich nicht. Prüfe bitte die Schreibweise.', 'error');
    }

    feld.value = '';
    TT.melden('meldung',
      'Rabattcode ' + erg.anzeige + ' eingelöst — ' + erg.prozent + ' % weniger.', 'ok');
  });

  document.getElementById('code-weg').addEventListener('click', function () {
    korb.codeEntfernen();
    TT.melden('meldung', 'Rabattcode entfernt.', 'warn');
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

    zeichnen();
  })();
})();
