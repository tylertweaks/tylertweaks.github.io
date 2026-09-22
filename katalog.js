/* ==========================================================================
   Tyler Tweaks — die Katalogseite (tweaks.html)

   Zeigt alle Optimierungen, die in der App stecken: suchbar, nach Bereich und
   Einstufung filterbar, jede mit den Registry-Zeilen, die sie wirklich
   schreibt.

   Die Daten kommen aus tweaks.json über tweaks.js. Hier steht nur, was diese
   Seite damit anstellt.
   ========================================================================== */

(function () {
  'use strict';

  if (window.TT) TT.grundgeruest();

  var liste = document.getElementById('katalog-liste');
  if (!liste) return;

  var suchfeld = document.getElementById('katalog-suche');
  var bereichLeiste = document.getElementById('katalog-bereiche');
  var risikoLeiste = document.getElementById('katalog-risiko');
  var zaehler = document.getElementById('katalog-zaehler');
  var leer = document.getElementById('katalog-leer');
  var zuruecksetzen = document.getElementById('katalog-zuruecksetzen');

  var katalog = null;
  var zustand = { suche: '', bereich: '', risiko: '' };

  /* ====================================================================
     Wie hoch ist die Navigation?

     Die Filterleiste klebt darunter und muss ihre Höhe kennen. Gemessen
     statt geraten, weil sie auf dem Handy umbricht und mit der Schriftgröße
     des Nutzers wächst.
     ==================================================================== */
  (function navHoehe() {
    var nav = document.getElementById('nav');
    if (!nav) return;

    var messen = function () {
      document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
    };

    messen();
    window.addEventListener('resize', messen);

    // Das Menü auf dem Handy klappt auf und macht die Leiste höher.
    if ('MutationObserver' in window) {
      new MutationObserver(messen).observe(nav, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
      });
    }
  })();

  /* ====================================================================
     Aufbau
     ==================================================================== */

  TTKatalog.laden().then(function (geladen) {
    katalog = geladen;

    TTKatalog.zahlenEinsetzen(katalog);
    chipsBauen();
    ausAdresseLesen();
    zeichnen();
    zumAnkerSpringen();
  }).catch(function (fehler) {
    liste.textContent = '';
    var hinweis = TTKatalog.el('p', 'katalog-fehler',
      'Die Liste der Optimierungen konnte gerade nicht geladen werden. ' +
      'Lade die Seite neu – und wenn es dann immer noch nicht geht, schreib mir kurz auf Discord.');
    liste.appendChild(hinweis);

    if (window.console) console.warn('Katalog nicht geladen:', fehler.message);
  });

  function chipsBauen() {
    chip(bereichLeiste, '', 'Alle Bereiche', katalog.anzahl, function () { setzen('bereich', ''); });

    katalog.bereiche.forEach(function (bereich) {
      chip(bereichLeiste, bereich.key, TTKatalog.bereichsName(katalog, bereich.key), bereich.anzahl,
        function () { setzen('bereich', bereich.key); });
    });

    chip(risikoLeiste, '', 'Alle Stufen', katalog.anzahl, function () { setzen('risiko', ''); });

    ['Safe', 'Caution', 'Advanced'].forEach(function (stufe) {
      var anzahl = katalog.tweaks.filter(function (t) { return t.risiko === stufe; }).length;
      var r = TTKatalog.risiko(stufe);
      chip(risikoLeiste, stufe, r.name, anzahl, function () { setzen('risiko', stufe); });
    });
  }

  function chip(leiste, wert, beschriftung, anzahl, beiKlick) {
    if (!leiste) return;

    var knopf = TTKatalog.el('button', 'katalog-chip');
    knopf.type = 'button';
    knopf.setAttribute('data-wert', wert);
    knopf.setAttribute('aria-pressed', wert === '' ? 'true' : 'false');

    knopf.appendChild(TTKatalog.el('span', null, beschriftung));
    knopf.appendChild(TTKatalog.el('span', 'katalog-chip-n', anzahl));

    knopf.addEventListener('click', beiKlick);
    leiste.appendChild(knopf);
  }

  /* ====================================================================
     Filter
     ==================================================================== */

  function setzen(feld, wert) {
    zustand[feld] = wert;
    zeichnen();
  }

  function chipsAuffrischen() {
    markieren(bereichLeiste, zustand.bereich);
    markieren(risikoLeiste, zustand.risiko);
  }

  function markieren(leiste, aktiv) {
    if (!leiste) return;

    leiste.querySelectorAll('.katalog-chip').forEach(function (knopf) {
      var an = knopf.getAttribute('data-wert') === aktiv;
      knopf.classList.toggle('aktiv', an);

      // aria-pressed und nicht nur eine Klasse: Ein Vorleser soll denselben
      // Zustand melden, den die Farbe zeigt.
      knopf.setAttribute('aria-pressed', an ? 'true' : 'false');
    });
  }

  function zeichnen() {
    var treffer = TTKatalog.filtern(katalog, zustand);

    liste.textContent = '';
    treffer.forEach(function (tweak) {
      liste.appendChild(TTKatalog.zeile(tweak, katalog));
    });

    if (zaehler) {
      zaehler.textContent = treffer.length === katalog.anzahl
        ? 'Alle ' + katalog.anzahl + ' Optimierungen'
        : treffer.length + ' von ' + katalog.anzahl + ' Optimierungen';
    }

    if (leer) leer.hidden = treffer.length > 0;

    var gefiltert = !!(zustand.suche || zustand.bereich || zustand.risiko);
    if (zuruecksetzen) zuruecksetzen.hidden = !gefiltert;

    chipsAuffrischen();
  }

  /* ====================================================================
     Suchfeld
     ==================================================================== */

  if (suchfeld) {
    // Ohne Verzögerung: Bei 129 Einträgen kostet ein Neuaufbau keine
    // messbare Zeit, und eine Liste, die beim Tippen hinterherhinkt, fühlt
    // sich kaputt an.
    suchfeld.addEventListener('input', function () {
      zustand.suche = suchfeld.value.trim();
      if (katalog) zeichnen();
    });

    // Escape leert das Feld — dafür muss niemand zur Maus greifen.
    suchfeld.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !suchfeld.value) return;
      suchfeld.value = '';
      zustand.suche = '';
      if (katalog) zeichnen();
    });
  }

  if (zuruecksetzen) {
    zuruecksetzen.addEventListener('click', function () {
      zustand = { suche: '', bereich: '', risiko: '' };
      if (suchfeld) suchfeld.value = '';
      zeichnen();
      if (suchfeld) suchfeld.focus();
    });
  }

  /* ====================================================================
     Adresse

     Zwei Formen, die von woanders hierher zeigen:
       tweaks.html#privacy-recall        ein einzelner Eintrag
       tweaks.html#bereich=cat.privacy   ein vorgewählter Filter

     Die zweite wird beim Laden gelesen und danach nicht mehr geschrieben.
     Sonst stritte sie sich mit der ersten um dieselbe Raute.
     ==================================================================== */

  function ausAdresseLesen() {
    var raute = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (raute.indexOf('bereich=') !== 0) return;

    var key = raute.slice('bereich='.length);
    if (katalog.bereiche.some(function (b) { return b.key === key; })) {
      zustand.bereich = key;
    }
  }

  function zumAnkerSpringen() {
    var raute = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (!raute || raute.indexOf('bereich=') === 0) return;

    var ziel = document.getElementById(raute);
    if (!ziel) return;

    // Der Browser hat beim Laden vergeblich nach diesem Anker gesucht — die
    // Liste stand da noch gar nicht. Also von Hand nachholen und gleich
    // aufklappen: Wer einen Link zu genau diesem Tweak bekommen hat, will
    // die Registry-Zeilen sehen und nicht erst suchen.
    var details = ziel.querySelector('details');
    if (details) details.open = true;

    ziel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ziel.classList.add('tw-hervor');
    window.setTimeout(function () { ziel.classList.remove('tw-hervor'); }, 2200);
  }
})();
