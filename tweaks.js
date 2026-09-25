/* ==========================================================================
   Tyler Tweaks — der Katalog

   Eine Quelle für zwei Oberflächen. tweaks.json wird aus demselben C#-Katalog
   erzeugt, den die App ausliefert (KatalogExport), und von hier aus an drei
   Stellen benutzt:

     1. tweaks.html — die vollständige, durchsuchbare Liste
     2. index.html  — die anklickbare Vorführung im Abschnitt "Die Tweak App"
     3. index.html  — alle Zahlen, die früher von Hand im HTML standen

   Punkt 3 ist der Grund, warum es diese Datei überhaupt gibt. An zwei Stellen
   stand monatelang "über 80 Tweaks", während der Katalog längst 129 hatte:
   Das Release-Skript hat nur nach der Wortfolge "… einzeln schaltbare …"
   gesucht und diese beiden Sätze nie erwischt. Zahlen, die an einer zweiten
   Stelle von Hand gepflegt werden, veralten. Ab jetzt steht im HTML kein
   Zahlwort mehr, sondern ein leeres Element mit data-Attribut.

   Kein Inline-Code: Die Sicherheitsrichtlinie der Seite erlaubt script-src
   ohne 'unsafe-inline'. Alles, was hier passiert, hängt über
   addEventListener am Element, nie über onclick="".

   Texte aus der JSON gehen ausschließlich über textContent in die Seite, nie
   über innerHTML. Die Datei ist zwar unsere eigene, aber sie wird erzeugt —
   und erzeugte Daten durch einen HTML-Parser zu schicken ist eine Angewohnheit,
   die irgendwann teuer wird.
   ========================================================================== */

window.TTKatalog = (function () {
  'use strict';

  var DATEI = 'tweaks.json';

  /* ------------------------------------------------------------------
     Namen der Bereiche auf der Website.

     Die App nennt sie kurz — "CPU", "GPU", "Explorer", "Aufgaben" —, weil dort
     jemand sitzt, der die App gekauft hat. Hier liest jemand, der noch
     überlegt, ob er sie braucht. "Prozessor" und "Geplante Aufgaben" sind für
     ihn die besseren Wörter.

     Was hier nicht steht, behält den Namen aus der JSON. Ein neuer Bereich
     fehlt damit nie, er heißt nur erst einmal wie in der App.
     ------------------------------------------------------------------ */
  var SEITENNAMEN = {
    'cat.explorer': 'Explorer & Oberfläche',
    'cat.cpu': 'Prozessor',
    'cat.gpu': 'Grafik',
    'cat.tasks': 'Geplante Aufgaben'
  };

  /* ------------------------------------------------------------------
     Ein Satz je Bereich für die Kacheln auf der Startseite.

     Zusammengefasst aus den Einträgen, die heute in dem Bereich stehen —
     deshalb die Beispiele. Kommt ein Bereich neu dazu, fehlt ihm nur der
     Satz; die Kachel steht trotzdem da, mit Name und Anzahl.
     ------------------------------------------------------------------ */
  var BESCHREIBUNG = {
    'cat.services': 'Dienste, die du nicht brauchst — etwa Fax, Xbox, Hyper-V und Sensoren — abschalten oder auf manuell stellen.',
    'cat.system': 'Energieplan, Eingabeverzögerung, Animationen und wie lange Windows auf hängende Programme wartet.',
    'cat.explorer': 'Taskleiste, Startmenü, Rechtsklickmenü und Explorer so, wie du sie willst — ohne Werbung und Websuche.',
    'cat.privacy': 'Telemetrie, Werbe-ID, Recall, Copilot und Standort: was Windows über dich sammelt und weitergibt.',
    'cat.advanced': 'Undokumentierte Werte für NVIDIA- und AMD-Treiber, Scheduler und Zeitgeber. Mit Risiko, jeder einzeln zurücknehmbar.',
    'cat.network': 'Stromsparen der Netzwerkkarte, Nagle, Netzwerkdrosselung, DNS und die Puffer des TCP-Stapels.',
    'cat.drivers': 'USB- und Eingabegeräte wach halten, MSI-Modus für Grafik- und Netzwerkkarte, ungenutzte virtuelle Geräte aus.',
    'cat.gpu': 'Game DVR und Game Bar, Vollbildoptimierungen, GPU-Planung, Shader-Cache und Energiesparen des Treibers.',
    'cat.cpu': 'Kernparken, Prozessdrosselung, Spiele-Priorität im MMCSS und die Zeitgeber des Prozessors.',
    'cat.debloat': 'Keine nachinstallierten App-Vorschläge, Edge und Teams nicht im Hintergrund, OneDrive aus der Seitenleiste.',
    'cat.storage': 'Ruhezustand, Prefetch, reservierter Speicher und die Einstellungen des NTFS-Dateisystems.',
    'cat.update': 'Neustart nur nach Rückfrage, keine Treiber über Windows Update, Funktionsupdates aufschieben.',
    'cat.tasks': 'Geplante Aufgaben für Telemetrie, Kompatibilitätsprüfung und Fehlerberichte.'
  };

  /* Symbole je Bereich, als Pfade für ein 24er-Raster. Gebaut wird daraus per
     createElementNS — auch hier geht nichts durch innerHTML. */
  var SYMBOL = {
    'cat.services': ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
    'cat.system': ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
    'cat.explorer': ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
    'cat.privacy': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9.5 12h5v4h-5z', 'M10.5 12v-1.5a1.5 1.5 0 0 1 3 0V12'],
    'cat.advanced': ['M9 3h6', 'M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3', 'M7 15h10'],
    'cat.network': ['M5 12.55a11 11 0 0 1 14.08 0', 'M1.42 9a16 16 0 0 1 21.16 0', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01'],
    'cat.drivers': ['M12 22v-5', 'M9 8V2', 'M15 8V2', 'M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z'],
    'cat.gpu': ['M4 6h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M9 8.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M15 9.5h3', 'M15 13h3', 'M6 17v3', 'M10 17v3'],
    'cat.cpu': ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M9 9h6v6H9z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M1 9h3', 'M1 15h3', 'M20 9h3', 'M20 15h3'],
    'cat.debloat': ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v5', 'M14 11v5'],
    'cat.storage': ['M22 12H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z', 'M6 16h.01', 'M10 16h.01'],
    'cat.update': ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'],
    'cat.tasks': ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 2v4', 'M16 2v4', 'M3 10h18', 'M12 14v3l2 1']
  };

  var RISIKO = {
    Safe: { klasse: 'risiko-sicher', name: 'Sicher' },
    Caution: { klasse: 'risiko-vorsicht', name: 'Vorsicht' },
    Advanced: { klasse: 'risiko-fortgeschritten', name: 'Fortgeschritten' }
  };

  var ZAHLWORT = {
    1: 'einem', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs',
    7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwölf',
    13: 'dreizehn', 14: 'vierzehn', 15: 'fünfzehn'
  };

  /* ====================================================================
     Laden
     ==================================================================== */

  var versprechen = null;

  /** Holt die Datei einmal und gibt danach immer dasselbe Versprechen zurück. */
  function laden() {
    if (versprechen) return versprechen;

    // Die Kennung hängt an der App-Fassung und nicht an einem Zeitstempel:
    // GitHub Pages liefert mit max-age=600 aus, und ohne sie sähe man nach
    // einer Veröffentlichung bis zu zehn Minuten den alten Katalog.
    var kennung = (window.TT_KONFIG && window.TT_KONFIG.app && window.TT_KONFIG.app.version) || '';

    versprechen = fetch(DATEI + (kennung ? '?v=' + encodeURIComponent(kennung) : ''))
      .then(function (antwort) {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.json();
      })
      .then(function (katalog) {
        if (!katalog || !Array.isArray(katalog.tweaks) || !katalog.tweaks.length) {
          throw new Error('Der Katalog ist leer.');
        }
        return katalog;
      });

    return versprechen;
  }

  /* ====================================================================
     Kleinkram
     ==================================================================== */

  function bereichsName(katalog, key) {
    if (SEITENNAMEN[key]) return SEITENNAMEN[key];

    for (var i = 0; i < katalog.bereiche.length; i++) {
      if (katalog.bereiche[i].key === key) return katalog.bereiche[i].de;
    }
    return key;
  }

  function risiko(wert) {
    return RISIKO[wert] || { klasse: 'risiko-sicher', name: wert };
  }

  /**
   * Trifft die Suche auf diesen Eintrag zu?
   *
   * Dieselben Felder wie Tweak.Matches in der App: beide Sprachen, die Id,
   * der Bereich und die Schlagworte. Wer in der App nach "recall" sucht und
   * etwas findet, soll auf der Website nicht leer ausgehen.
   */
  function passt(tweak, katalog, suche) {
    if (!suche) return true;

    var heuhaufen = [
      tweak.de.name, tweak.de.beschreibung,
      tweak.en.name, tweak.en.beschreibung,
      tweak.id,
      bereichsName(katalog, tweak.bereich)
    ].concat(tweak.schlagworte || []).join(' ').toLowerCase();

    // Mehrere Wörter müssen alle vorkommen, aber nicht nebeneinander:
    // "recall datenschutz" soll etwas finden.
    return suche.toLowerCase().split(/\s+/).every(function (wort) {
      return !wort || heuhaufen.indexOf(wort) !== -1;
    });
  }

  function filtern(katalog, zustand) {
    return katalog.tweaks.filter(function (t) {
      if (zustand.bereich && t.bereich !== zustand.bereich) return false;
      if (zustand.risiko && t.risiko !== zustand.risiko) return false;
      return passt(t, katalog, zustand.suche);
    });
  }

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  /* ====================================================================
     Eine Zeile
     ==================================================================== */

  /**
   * Baut einen Eintrag.
   *
   * @param optionen.schalter  Einen (wirkungslosen) Schalter anhängen — für
   *                           die Vorführung auf der Startseite.
   * @param optionen.knapp     Beschreibung kürzen und Fakten weglassen.
   */
  function zeile(tweak, katalog, optionen) {
    optionen = optionen || {};

    var r = risiko(tweak.risiko);

    var artikel = el('article', 'tw');
    artikel.id = tweak.id;

    var kopf = el('div', 'tw-kopf');

    var text = el('div', 'tw-text');
    text.appendChild(el('h3', 'tw-name', tweak.de.name));
    text.appendChild(el('p', 'tw-beschreibung', tweak.de.beschreibung));

    var tags = el('div', 'tw-tags');
    tags.appendChild(el('span', 'tw-tag tw-risiko ' + r.klasse, r.name));
    tags.appendChild(el('span', 'tw-tag', bereichsName(katalog, tweak.bereich)));
    if (tweak.neustart) tags.appendChild(el('span', 'tw-tag', 'Neustart nötig'));
    text.appendChild(tags);

    kopf.appendChild(text);

    if (optionen.schalter) {
      // Sieht aus wie der Schalter in der App und tut mit Absicht nichts.
      // Darüber steht, dass hier nichts am System geändert wird; hier steht
      // es noch einmal für alle, die mit der Tastatur oder einem Vorleser
      // unterwegs sind.
      var schalter = el('span', 'tw-schalter');
      schalter.setAttribute('role', 'img');
      schalter.setAttribute('aria-label', 'Schalter — in dieser Vorschau ohne Wirkung');
      kopf.appendChild(schalter);
    }

    artikel.appendChild(kopf);

    if (!optionen.knapp) {
      artikel.appendChild(details(tweak, r));
    }

    return artikel;
  }

  function details(tweak, r) {
    var block = el('details', 'tw-details');
    block.appendChild(el('summary', null, 'Was genau geändert wird'));

    var fakten = el('ul', 'tw-fakten');
    [
      ['Einstufung', r.name],
      ['Neustart nötig', tweak.neustart ? 'ja' : 'nein'],
      ['Adminrechte', tweak.admin ? 'ja' : 'nein'],
      ['Sicherung vorher', 'ja']
    ].forEach(function (paar) {
      var li = el('li');
      li.appendChild(el('span', 'tw-faktname', paar[0]));
      li.appendChild(el('span', 'tw-faktwert', paar[1]));
      fakten.appendChild(li);
    });
    block.appendChild(fakten);

    // Die Zeilen, die die App wirklich schreibt — wörtlich aus dem Katalog.
    // Das ist der Punkt der ganzen Seite: nachlesen können, was passiert,
    // bevor man etwas kauft.
    var code = el('pre', 'tw-reg');
    code.textContent = (tweak.details.de || []).join('\n');
    block.appendChild(code);

    return block;
  }

  /* ====================================================================
     Zahlen ins HTML
     ==================================================================== */

  function setzen(auswahl, wert) {
    document.querySelectorAll(auswahl).forEach(function (e) {
      e.textContent = wert;
    });
  }

  /**
   * Füllt jede Stelle, an der eine Zahl aus dem Katalog steht.
   *
   * Im HTML steht dafür ein leeres Element mit data-Attribut. Solange die
   * Datei nicht geladen ist, bleibt es leer — besser als eine Zahl, die
   * eingefroren im Quelltext steht und irgendwann nicht mehr stimmt.
   */
  function zahlenEinsetzen(katalog) {
    var bereiche = katalog.bereiche.length;
    var neustart = katalog.tweaks.filter(function (t) { return t.neustart; }).length;

    setzen('[data-tweak-anzahl]', katalog.anzahl);
    setzen('[data-bereich-anzahl]', bereiche);
    if (Array.isArray(katalog.presets)) setzen('[data-preset-anzahl]', katalog.presets.length);
    setzen('[data-bereich-wort]', ZAHLWORT[bereiche] || bereiche);
    setzen('[data-neustart-anzahl]', neustart);

    Object.keys(RISIKO).forEach(function (stufe) {
      var anzahl = katalog.tweaks.filter(function (t) { return t.risiko === stufe; }).length;
      setzen('[data-risiko-anzahl="' + stufe + '"]', anzahl);
    });

    // Die Aufzählung der Bereiche in der FAQ. Stand dort als fester Satz und
    // nannte nach 2.6.0 noch neun von elf.
    setzen('[data-bereich-liste]', katalog.bereiche.map(function (b) {
      return bereichsName(katalog, b.key);
    }).join(', '));

    rasterFuellen(katalog);
  }

  function symbol(key) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    (SYMBOL[key] || SYMBOL['cat.system']).forEach(function (d) {
      var pfad = document.createElementNS(ns, 'path');
      pfad.setAttribute('d', d);
      svg.appendChild(pfad);
    });
    return svg;
  }

  /** Das Raster im Abschnitt "Umfang": eine Kachel je Bereich, größte zuerst. */
  function rasterFuellen(katalog) {
    var raster = document.querySelector('[data-bereich-raster]');
    if (!raster) return;

    raster.textContent = '';

    katalog.bereiche.slice().sort(function (a, b) {
      return b.anzahl - a.anzahl;
    }).forEach(function (bereich) {
      var kachel = el('a', 'opt-cat');
      kachel.href = 'tweaks.html#bereich=' + encodeURIComponent(bereich.key);

      var kopf = el('span', 'opt-kopf');
      var ico = el('span', 'opt-ico');
      ico.appendChild(symbol(bereich.key));
      kopf.appendChild(ico);
      kopf.appendChild(el('span', 'c', bereichsName(katalog, bereich.key)));
      kopf.appendChild(el('span', 'n', bereich.anzahl + (bereich.anzahl === 1 ? ' Tweak' : ' Tweaks')));
      kachel.appendChild(kopf);

      if (BESCHREIBUNG[bereich.key]) {
        kachel.appendChild(el('span', 'd', BESCHREIBUNG[bereich.key]));
      }
      raster.appendChild(kachel);
    });
  }

  /* ====================================================================
     Nach außen
     ==================================================================== */

  return {
    laden: laden,
    filtern: filtern,
    zeile: zeile,
    bereichsName: bereichsName,
    risiko: risiko,
    zahlenEinsetzen: zahlenEinsetzen,
    el: el
  };
})();


/* ==========================================================================
   Start: Zahlen auf jeder Seite, die welche hat.
   ========================================================================== */
(function () {
  'use strict';

  if (!document.querySelector('[data-tweak-anzahl], [data-bereich-raster], [data-bereich-liste]')) return;

  TTKatalog.laden().then(TTKatalog.zahlenEinsetzen).catch(function (fehler) {
    // Keine Ersatzzahl erfinden. Bleibt die Stelle leer, fällt das auf;
    // eine falsche Zahl fällt niemandem auf.
    if (window.console) console.warn('Katalog nicht geladen:', fehler.message);
  });
})();


/* ==========================================================================
   Die Vorführung auf der Startseite (#app, dritter Reiter)

   Ein app-förmiger Rahmen um dieselbe Liste. Die Schalter sind Attrappen und
   über dem Kasten steht das auch — wer wissen will, wie sich das anfühlt,
   soll es sehen dürfen, ohne dafür erst zu kaufen.

   Geladen wird erst beim ersten Öffnen des Reiters: Die Datei ist 133 KB, und
   die meisten Besucher scrollen an diesem Abschnitt vorbei, ohne ihn
   anzufassen. Auf der Startseite direkt zu laden wäre Bandbreite für nichts.
   ========================================================================== */
(function () {
  'use strict';

  var rahmen = document.getElementById('app-demo');
  if (!rahmen) return;

  var liste = document.getElementById('ad-liste');
  var chips = document.getElementById('ad-chips');
  var suche = document.getElementById('ad-suche');
  var leer = document.getElementById('ad-leer');
  var reiter = document.getElementById('tab-demo');

  var katalog = null;
  var zustand = { suche: '', bereich: '', risiko: '' };
  var angefordert = false;

  function holen() {
    if (angefordert) return;
    angefordert = true;

    liste.textContent = '';
    liste.appendChild(TTKatalog.el('p', 'ad-laedt', 'Einen Moment, die Liste kommt...'));

    TTKatalog.laden().then(function (geladen) {
      katalog = geladen;
      chipsBauen();
      zeichnen();
    }).catch(function (fehler) {
      liste.textContent = '';
      liste.appendChild(TTKatalog.el('p', 'ad-laedt',
        'Die Liste lässt sich gerade nicht laden. Die vollständige Aufstellung ' +
        'findest du auf der Seite "Alle Tweaks".'));

      if (window.console) console.warn('Katalog nicht geladen:', fehler.message);
    });
  }

  function chipsBauen() {
    chip('', 'Alle');
    katalog.bereiche.forEach(function (b) {
      chip(b.key, TTKatalog.bereichsName(katalog, b.key));
    });
  }

  function chip(wert, beschriftung) {
    var knopf = TTKatalog.el('button', 'ad-chip', beschriftung);
    knopf.type = 'button';
    knopf.setAttribute('data-wert', wert);
    knopf.setAttribute('aria-pressed', wert === '' ? 'true' : 'false');

    knopf.addEventListener('click', function () {
      zustand.bereich = wert;
      zeichnen();
    });

    chips.appendChild(knopf);
  }

  function zeichnen() {
    var treffer = TTKatalog.filtern(katalog, zustand);

    liste.textContent = '';
    treffer.forEach(function (tweak) {
      liste.appendChild(TTKatalog.zeile(tweak, katalog, { schalter: true }));
    });

    if (leer) leer.hidden = treffer.length > 0;

    chips.querySelectorAll('.ad-chip').forEach(function (knopf) {
      var an = knopf.getAttribute('data-wert') === zustand.bereich;
      knopf.classList.toggle('aktiv', an);
      knopf.setAttribute('aria-pressed', an ? 'true' : 'false');
    });

    // Nach einem Filterwechsel wieder nach oben: Sonst steht man in einer
    // kurzen Liste im Leeren, weil der alte Scrollstand erhalten bleibt.
    liste.scrollTop = 0;
  }

  if (suche) {
    suche.addEventListener('input', function () {
      zustand.suche = suche.value.trim();
      if (katalog) zeichnen();
    });
  }

  /* Beim ersten Öffnen des Reiters laden.
   *
   * Beobachtet wird das Panel und nicht der Knopf: Die Reiterleiste in
   * script.js lässt sich auch mit den Pfeiltasten bedienen, und dabei fällt
   * kein Klick an. Ein Zuhörer am Knopf hätte für alle, die mit der Tastatur
   * unterwegs sind, eine dauerhaft leere Vorschau bedeutet.
   *
   * Das Attribut hidden setzt script.js — hier wird nur bemerkt, dass es
   * verschwunden ist. */
  var panel = document.getElementById('panel-demo');

  if (panel && 'MutationObserver' in window) {
    var beobachter = new MutationObserver(function () {
      if (panel.hidden) return;
      holen();
      beobachter.disconnect();
    });

    beobachter.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  } else if (reiter) {
    // Ohne MutationObserver bleibt der Klick — deutlich älter als alles,
    // was diese Seite sonst voraussetzt, aber kostenlos.
    reiter.addEventListener('click', holen);
  }

  // Wer mit #app-demo in der Adresse ankommt, soll nicht erst klicken müssen.
  if (location.hash === '#app-demo') holen();
})();
