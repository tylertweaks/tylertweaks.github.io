/* ==========================================================================
   Tyler Tweaks — PC-Score-Test (score-test.html)

   Zwölf Fragen, eine nach der anderen. Am Ende stehen ein Wert von 0 bis 100
   (wie viel Potenzial noch drinsteckt), die drei Bereiche mit den meisten
   Punkten und das Paket, das zur Antwort auf die letzte Frage passt.

   Alles läuft hier im Browser. Es wird nichts gesendet und nichts
   gespeichert — die Seite verspricht das so, also bitte dabei bleiben.

   Der Wert ist eine Einschätzung aus den Antworten, keine Messung. So steht
   es auch auf der Seite.
   ========================================================================== */

(function () {
  'use strict';

  if (window.TT) TT.grundgeruest();

  var karte = document.getElementById('score-karte');
  if (!karte) return;

  /* ====================================================================
     Die Bereiche — dieselben sechs wie in der PC-Optimierung auf der
     Startseite, dazu das BIOS. Titel und Satz erscheinen im Ergebnis.
     ==================================================================== */
  var BEREICHE = {
    windows:     { titel: 'Windows entrümpeln',
                   text: 'Alte Reste, überflüssige Dienste und vorinstallierte Apps arbeiten im Hintergrund mit, auch wenn du sie nie benutzt.' },
    hintergrund: { titel: 'Autostart und Hintergrund',
                   text: 'Jedes Programm, das mitstartet oder nebenher läuft, nimmt sich Prozessorzeit, und genau die fehlt dann in Spitzen.' },
    treiber:     { titel: 'Grafiktreiber sauber aufsetzen',
                   text: 'Drüber installierte Treiber schleppen alte Profile und Reste mit. Eine saubere Neuinstallation beseitigt oft Ruckler, die sonst niemand erklären kann.' },
    energie:     { titel: 'Energieplan und Prozessor',
                   text: 'Im Energiesparmodus taktet die CPU mitten im Spiel herunter. Das merkst du nicht an den FPS, sondern an kurzen Hängern.' },
    netz:        { titel: 'Netzwerk und Latenz',
                   text: 'Adapter-Einstellungen und Energiesparen an der Netzwerkkarte sorgen für Ping-Spitzen, obwohl die Leitung schnell genug ist.' },
    eingabe:     { titel: 'Maus und Eingabe',
                   text: 'Mausbeschleunigung, USB-Energiesparen und der falsche Anschluss machen den Unterschied zwischen „fühlt sich direkt an“ und „schwammig“.' },
    bios:        { titel: 'Arbeitsspeicher im BIOS',
                   text: 'Ohne XMP oder EXPO läuft der Arbeitsspeicher deutlich unter dem Takt, für den du bezahlt hast.' }
  };

  /* ====================================================================
     Die Fragen. Jede Antwort bringt 0 bis 3 Punkte für ihren Bereich; 3
     heißt „hier liegt viel brach“. Die letzte Frage zählt nicht zum Wert,
     sie entscheidet nur, welches Paket empfohlen wird.
     ==================================================================== */
  var FRAGEN = [
    { bereich: 'windows',
      frage: 'Wann hast du Windows zuletzt frisch installiert?',
      antworten: [['In den letzten 6 Monaten', 0], ['Vor 6 bis 18 Monaten', 1],
                  ['Vor mehr als 18 Monaten', 2], ['Noch nie oder weiß ich nicht', 3]] },
    { bereich: 'hintergrund',
      frage: 'Wie viele Programme starten mit Windows mit?',
      hilfe: 'Nachsehen: Strg + Umschalt + Esc, dann der Reiter „Autostart“.',
      antworten: [['Kaum welche, ich räume regelmäßig auf', 0], ['Eine Handvoll', 1],
                  ['Eine ganze Liste', 3], ['Hab ich noch nie nachgesehen', 2]] },
    { bereich: 'hintergrund',
      frage: 'Was läuft nebenher, während du zockst?',
      antworten: [['Nichts, ich schließe vorher alles', 0], ['Nur Discord', 1],
                  ['Discord und ein Browser', 2], ['Dazu noch Aufnahme-, RGB- oder Hersteller-Tools', 3]] },
    { bereich: 'energie',
      frage: 'Wie verhalten sich deine FPS im Spiel?',
      antworten: [['Konstant, kaum Schwankungen', 0], ['Ab und zu ein Einbruch', 1],
                  ['Kurze Hänger, obwohl die FPS-Zahl hoch ist', 3], ['Sie springen ständig hin und her', 3]] },
    { bereich: 'eingabe',
      frage: 'Wie fühlt sich Zielen und Bewegen an?',
      antworten: [['Direkt, die Maus macht genau, was ich will', 0], ['Meistens gut, manchmal etwas träge', 2],
                  ['Spürbar verzögert oder schwammig', 3]] },
    { bereich: 'treiber',
      frage: 'Wie hast du deinen Grafiktreiber zuletzt aktualisiert?',
      antworten: [['Vor kurzem sauber neu installiert', 0], ['Einfach drüber installiert', 2],
                  ['Länger gar nicht', 2], ['Weiß ich nicht', 2]] },
    { bereich: 'energie',
      frage: 'Welcher Energieplan ist in Windows eingestellt?',
      hilfe: 'Nachsehen: Windows-Taste, „Energiesparplan bearbeiten“ eingeben.',
      antworten: [['Höchstleistung oder ein eigener Plan', 0], ['Ausbalanciert', 2],
                  ['Weiß ich nicht', 2]] },
    { bereich: 'netz',
      frage: 'Wie stabil ist dein Ping in Online-Spielen?',
      antworten: [['Stabil, keine Ausreißer', 0], ['Ab und zu eine Spitze', 2],
                  ['Oft Lags oder Rubberbanding', 3]] },
    { bereich: 'bios',
      frage: 'Ist im BIOS XMP oder EXPO für den Arbeitsspeicher an?',
      hilfe: 'Nachsehen ohne BIOS: Task-Manager, „Leistung“, „Arbeitsspeicher“, die Zeile „Geschwindigkeit“.',
      antworten: [['Ja, ist an', 0], ['Nein', 3], ['Weiß ich nicht', 2]] },
    { bereich: 'eingabe',
      frage: 'Wo stecken Maus und Tastatur?',
      antworten: [['Direkt hinten am Mainboard', 0], ['Vorne am Gehäuse oder am Monitor', 1],
                  ['An einem USB-Hub oder Verteiler', 2], ['Weiß ich nicht', 1]] },
    { bereich: 'windows',
      frage: 'Hast du Windows schon einmal fürs Gaming eingestellt?',
      antworten: [['Ja, gründlich und mit Plan', 0], ['Ein paar Tipps aus Videos', 1],
                  ['Noch nie', 3]] },
    { weg: true,
      frage: 'Wie willst du es angehen?',
      antworten: [['Mach es für mich, ich will selbst nichts einstellen', 'opt'],
                  ['Ich stelle lieber selbst ein und will jeden Schalter verstehen', 'app'],
                  ['Einmal richtig von dir, danach selbst dranbleiben', 'bundle']] }
  ];

  var PAKETE = {
    opt:    { name: 'PC-Optimierung', ton: 'ton-stahl', ziel: 'index.html#tarif-opt',
              text: 'Ich gehe dein System per Remote-Sitzung durch und stelle die Bereiche oben passend zu deiner Hardware ein. Du schaust zu und musst selbst nichts tun.' },
    app:    { name: 'Tweak App', ton: 'ton-cyan', ziel: 'index.html#tarif-app',
              text: 'Jeder Bereich oben hat in der App eigene Schalter, jeder im Klartext erklärt, vorher gesichert und jederzeit zurücknehmbar.' },
    bundle: { name: 'Bundle', ton: 'ton-gold', ziel: 'index.html#tarif-bundle',
              text: 'Ich stelle deinen PC einmal persönlich ein, und danach hast du die App mit Lifetime-Lizenz, um nach Updates selbst nachzuziehen.' }
  };

  var STUFEN = [
    { bis: 30,  name: 'Schon gut eingestellt', klasse: 'stufe-gut',
      text: 'Dein PC ist ordentlich eingestellt. Ganz ohne Luft ist er trotzdem nicht: Die Punkte unten bringen den Feinschliff.' },
    { bis: 60,  name: 'Spürbares Potenzial', klasse: 'stufe-mittel',
      text: 'Ein Teil deiner Leistung bleibt liegen. Meist merkst du das weniger an der FPS-Zahl als an Hängern, Ping-Spitzen und einer trägen Maus.' },
    { bis: 100, name: 'Viel ungenutztes Potenzial', klasse: 'stufe-hoch',
      text: 'Dein System arbeitet an einigen Stellen gegen dich. Gerade hier lohnt sich eine gründliche Optimierung am meisten.' }
  ];

  /* ====================================================================
     Zustand und Elemente
     ==================================================================== */
  var antworten = [];      // je Frage der Index der gewählten Antwort
  var schritt = 0;

  var start = document.getElementById('score-start');
  var frageTeil = document.getElementById('score-frage');
  var ergebnis = document.getElementById('score-ergebnis');

  var zaehler = document.getElementById('score-zaehler');
  var prozent = document.getElementById('score-prozent');
  var balken = document.getElementById('score-balken');
  var balkenFuell = document.getElementById('score-balken-fuell');
  var titel = document.getElementById('score-frage-titel');
  var hilfe = document.getElementById('score-frage-hilfe');
  var liste = document.getElementById('score-antworten');
  var zurueck = document.getElementById('score-zurueck');

  var wenigBewegung = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function zeige(teil) {
    [start, frageTeil, ergebnis].forEach(function (t) { t.hidden = t !== teil; });
  }

  /* ====================================================================
     Eine Frage anzeigen
     ==================================================================== */
  function frageZeigen() {
    var f = FRAGEN[schritt];
    var anteil = Math.round(schritt / FRAGEN.length * 100);

    zaehler.textContent = 'Frage ' + (schritt + 1) + ' von ' + FRAGEN.length;
    prozent.textContent = anteil + ' %';
    balken.setAttribute('aria-valuenow', String(anteil));
    balkenFuell.style.width = anteil + '%';

    titel.textContent = f.frage;
    hilfe.textContent = f.hilfe || '';
    hilfe.hidden = !f.hilfe;

    liste.textContent = '';
    f.antworten.forEach(function (a, i) {
      var knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = 'score-antwort';
      if (antworten[schritt] === i) knopf.classList.add('ist-gewaehlt');

      var taste = document.createElement('span');
      taste.className = 'score-taste';
      taste.setAttribute('aria-hidden', 'true');
      taste.textContent = String(i + 1);

      var text = document.createElement('span');
      text.textContent = a[0];

      knopf.appendChild(taste);
      knopf.appendChild(text);
      knopf.addEventListener('click', function () { waehlen(i); });
      liste.appendChild(knopf);
    });

    zurueck.hidden = schritt === 0;

    frageTeil.classList.remove('ist-neu');
    void frageTeil.offsetWidth; // Einblenden bei jeder Frage neu starten
    frageTeil.classList.add('ist-neu');
  }

  function waehlen(i) {
    antworten[schritt] = i;
    var knoepfe = liste.querySelectorAll('.score-antwort');
    knoepfe.forEach(function (k, j) { k.classList.toggle('ist-gewaehlt', j === i); });

    // Kurz stehen lassen, damit man sieht, was man gewählt hat.
    window.setTimeout(function () {
      if (schritt < FRAGEN.length - 1) {
        schritt++;
        frageZeigen();
        titel.focus();
      } else {
        auswerten();
      }
    }, wenigBewegung ? 0 : 220);
  }

  /* Tasten 1 bis 4 wählen die Antwort, Rücktaste geht zurück. */
  document.addEventListener('keydown', function (e) {
    if (frageTeil.hidden || e.ctrlKey || e.altKey || e.metaKey) return;
    var ziel = e.target;
    if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;

    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= FRAGEN[schritt].antworten.length) {
      e.preventDefault();
      waehlen(n - 1);
    } else if (e.key === 'Backspace' && schritt > 0) {
      e.preventDefault();
      zurueck.click();
    }
  });

  zurueck.addEventListener('click', function () {
    if (schritt === 0) return;
    schritt--;
    frageZeigen();
    titel.focus();
  });

  /* ====================================================================
     Auswertung
     ==================================================================== */
  function auswerten() {
    var punkte = 0, hoechst = 0, weg = 'bundle';
    var jeBereich = {};

    FRAGEN.forEach(function (f, i) {
      var a = f.antworten[antworten[i]];
      if (f.weg) { weg = a[1]; return; }

      var max = Math.max.apply(null, f.antworten.map(function (x) { return x[1]; }));
      punkte += a[1];
      hoechst += max;
      jeBereich[f.bereich] = (jeBereich[f.bereich] || 0) + a[1];
    });

    var wert = Math.round(punkte / hoechst * 100);
    var stufe = STUFEN.filter(function (s) { return wert <= s.bis; })[0];

    // Die drei Bereiche mit den meisten Punkten. Gleichstand: Reihenfolge
    // wie in BEREICHE, damit dasselbe Ergebnis immer gleich aussieht.
    var reihenfolge = Object.keys(BEREICHE);
    var baustellen = reihenfolge
      .filter(function (b) { return jeBereich[b] > 0; })
      .sort(function (a, b) {
        return (jeBereich[b] - jeBereich[a]) || (reihenfolge.indexOf(a) - reihenfolge.indexOf(b));
      })
      .slice(0, 3);

    ergebnisZeigen(wert, stufe, baustellen, PAKETE[weg]);
  }

  function ergebnisZeigen(wert, stufe, baustellen, paket) {
    zeige(ergebnis);
    // Zählt nur die Tatsache, nicht das Ergebnis (zaehlung.js, ohne Cookies).
    if (window.TTZaehlung) window.TTZaehlung.ereignis('test_fertig');

    var stufeEl = document.getElementById('score-stufe');
    stufeEl.textContent = stufe.name;
    ergebnis.className = 'score-ergebnis ' + stufe.klasse;
    document.getElementById('score-stufe-text').textContent = stufe.text;

    // Baustellen
    var ol = document.getElementById('score-baustellen');
    ol.textContent = '';
    var kopf = document.getElementById('score-baustellen-kopf');
    kopf.hidden = baustellen.length === 0;
    baustellen.forEach(function (b) {
      var li = document.createElement('li');
      var h = document.createElement('h3');
      h.textContent = BEREICHE[b].titel;
      var p = document.createElement('p');
      p.textContent = BEREICHE[b].text;
      li.appendChild(h);
      li.appendChild(p);
      ol.appendChild(li);
    });

    // Empfehlung
    var emp = document.getElementById('score-empfehlung');
    emp.className = 'score-empfehlung ' + paket.ton;
    document.getElementById('score-paket-name').textContent = paket.name;
    document.getElementById('score-paket-text').textContent = paket.text;
    var link = document.getElementById('score-paket-link');
    link.href = paket.ziel;
    link.querySelector('span').textContent = paket.name + ' ansehen';

    ringFuellen(wert);

    var ueberschrift = document.getElementById('score-ergebnis-titel');
    ueberschrift.focus();
  }

  /* Ring und Zahl laufen gemeinsam hoch. Ohne Bewegung stehen sie sofort. */
  function ringFuellen(wert) {
    var ring = document.getElementById('score-ring-wert');
    var zahl = document.getElementById('score-zahl');
    var umfang = 2 * Math.PI * 52;

    ring.style.strokeDasharray = umfang.toFixed(2);
    document.getElementById('score-ring').setAttribute('aria-label',
      'Potenzial: ' + wert + ' von 100');

    if (wenigBewegung) {
      ring.style.strokeDashoffset = (umfang * (1 - wert / 100)).toFixed(2);
      zahl.textContent = String(wert);
      return;
    }

    var dauer = 1300, beginn = null;
    function bild(t) {
      if (beginn === null) beginn = t;
      var x = Math.min(1, (t - beginn) / dauer);
      var weich = 1 - Math.pow(1 - x, 3);
      var jetzt = wert * weich;
      ring.style.strokeDashoffset = (umfang * (1 - jetzt / 100)).toFixed(2);
      zahl.textContent = String(Math.round(jetzt));
      if (x < 1) window.requestAnimationFrame(bild);
    }
    ring.style.strokeDashoffset = umfang.toFixed(2);
    zahl.textContent = '0';
    window.requestAnimationFrame(bild);
  }

  /* ====================================================================
     Start und Neustart
     ==================================================================== */
  function losgehen() {
    antworten = [];
    schritt = 0;
    zeige(frageTeil);
    frageZeigen();
    titel.focus();
  }

  document.getElementById('score-los').addEventListener('click', losgehen);
  document.getElementById('score-nochmal').addEventListener('click', losgehen);

  // Ohne Skript zeigt die Seite einen Hinweis statt des Startknopfs.
  karte.classList.add('ist-bereit');
})();
