/* ==========================================================================
   Tyler Tweaks — Interaktionen der Startseite

   Aufbau: Navigation · Sanftes Scrollen · Reveal · FAQ · App-Ansichten ·
           Laufzeit-Auswahl · Preise aus der Datenbank

   Was hier NICHT mehr passiert: Zahlungen. Der frühere PayPal-Block hat die
   Zahlung im Browser bestätigt und dem Kunden gesagt, er solle sich auf
   Discord melden. Das war nicht fälschungssicher. Gekauft wird jetzt auf
   kaufen.html, wo Preis und Zahlungsprüfung auf dem Server liegen.

   Seit dem Warenkorb führt auch kein Knopf mehr direkt dorthin: Ein Klick auf
   der Preiskarte legt das Paket in den Warenkorb (warenkorb.js), bezahlt wird
   auf warenkorb.html. Dort wird auch der Rabattcode eingegeben.
   ========================================================================== */

(function () {
  'use strict';

  var KONFIG = window.TT_KONFIG || {};

  /* ====================================================================
     1. Grundgerüst: Version, Jahr, Navigation, Anmeldestatus
     ==================================================================== */
  if (window.TT) {
    TT.grundgeruest();
    TT.navAufbauen();
  }

  /* ====================================================================
     2. Sanftes Scrollen zu einer bestimmten Preiskarte
     ==================================================================== */
  (function scrollZuKarte() {
    document.querySelectorAll('[data-scroll-to]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var ziel = document.getElementById(link.getAttribute('data-scroll-to'));
        if (!ziel) return; // Der normale #preise-Sprung greift dann weiterhin

        e.preventDefault();
        ziel.scrollIntoView({ behavior: 'smooth', block: 'center' });

        ziel.classList.remove('flash');
        void ziel.offsetWidth; // Neustart der Animation erzwingen
        ziel.classList.add('flash');
        window.setTimeout(function () { ziel.classList.remove('flash'); }, 1600);
      });
    });
  })();

  /* ====================================================================
     3. Sektionen beim Hereinscrollen einblenden
     ==================================================================== */
  (function reveal() {
    var elemente = document.querySelectorAll('.reveal');
    if (!elemente.length) return;

    if (!('IntersectionObserver' in window)) {
      elemente.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (eintrag) {
        if (!eintrag.isIntersecting) return;
        eintrag.target.classList.add('visible');
        beobachter.unobserve(eintrag.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    elemente.forEach(function (el) { beobachter.observe(el); });
  })();

  /* ====================================================================
     4. FAQ: immer nur eine Antwort offen
     ==================================================================== */
  (function faq() {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.faq details'));
    panels.forEach(function (panel) {
      panel.addEventListener('toggle', function () {
        if (!panel.open) return;
        panels.forEach(function (anderes) {
          if (anderes !== panel) anderes.open = false;
        });
      });
    });
  })();

  /* ====================================================================
     5. App-Ansichten umschalten (Übersicht / Tweaks)
     ==================================================================== */
  (function ansichten() {
    var leiste = document.querySelector('.shot-tabs');
    if (!leiste) return;

    var tabs = Array.prototype.slice.call(leiste.querySelectorAll('.shot-tab'));
    if (!tabs.length) return;

    var zeigen = function (index, fokus) {
      tabs.forEach(function (tab, i) {
        var aktiv = i === index;
        tab.setAttribute('aria-selected', aktiv ? 'true' : 'false');
        tab.tabIndex = aktiv ? 0 : -1;

        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !aktiv;
      });
      if (fokus) tabs[index].focus();
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { zeigen(i, false); });

      tab.addEventListener('keydown', function (e) {
        var ziel = null;
        if (e.key === 'ArrowRight') ziel = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') ziel = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') ziel = 0;
        else if (e.key === 'End') ziel = tabs.length - 1;

        if (ziel === null) return;
        e.preventDefault();
        zeigen(ziel, true);
      });
    });
  })();

  /* ====================================================================
     6. Laufzeit-Auswahl in der Preiskarte
     ==================================================================== */
  var laufzeiten = (KONFIG.laufzeiten || []).slice();
  var pakete = (KONFIG.pakete || []).slice();
  var gewaehlt = 'app-lifetime';

  /* Preis eines festen Pakets (bundle, optimierung) aus der Konfiguration.
     Früher stand der Betrag als Zahl hier im Code und zusätzlich im HTML —
     jetzt gibt es nur noch konfig.js als Quelle. */
  function paketPreis(slug) {
    var eintrag = pakete.filter(function (p) { return p.slug === slug; })[0];
    return eintrag ? eintrag.preis : null;
  }

  function preisFormat(wert) {
    var zahl = Number(wert);
    if (!isFinite(zahl)) return '—';
    // Ganze Beträge ohne Nachkommastellen: "15" statt "15,00"
    return zahl % 1 === 0 ? String(zahl) : zahl.toFixed(2).replace('.', ',');
  }

  /* ---- Kaufknöpfe: alles geht über den Warenkorb ----------------------
     Bis 2.7.0 führte der Knopf direkt in die Kasse, im Übergangsbetrieb sogar
     direkt zu paypal.me. Jetzt legt er das Paket in den Warenkorb; bezahlt
     wird dort, und dort wird auch der Rabattcode eingegeben. Beide Kaufwege
     treffen sich damit an einer Stelle statt an dreien — den Betrag für
     paypal.me baut deshalb warenkorb-seite.js zusammen, nicht mehr diese
     Datei.

     Das href zeigt fest auf warenkorb.html: Ohne Javascript landet man damit
     wenigstens an der richtigen Stelle.
     ------------------------------------------------------------------- */
  var korbDaten = {}; // slug -> der Artikel, so wie er in den Warenkorb wandert

  function korbKnopf(knopf, artikel) {
    if (!knopf) return;

    korbDaten[artikel.slug] = artikel;

    knopf.href = 'warenkorb.html';
    knopf.removeAttribute('target');
    knopf.removeAttribute('rel');
    knopf.dataset.korbSlug = artikel.slug;

    korbKnopfBeschriften(knopf);
  }

  function korbKnopfBeschriften(knopf) {
    var artikel = korbDaten[knopf.dataset.korbSlug];
    if (!artikel) return;

    var drin = !!(window.TT && TT.korb && TT.korb.hat(artikel.slug));

    knopf.textContent = drin
      ? 'Zum Warenkorb und bezahlen'
      : 'Für ' + preisFormat(artikel.preis) + ' € in den Warenkorb';

    knopf.classList.toggle('im-korb', drin);
    korbHinweis(knopf, drin ? '✓ Liegt in deinem Warenkorb' : '');
  }

  function korbKnoepfeBeschriften() {
    document.querySelectorAll('[data-korb-slug]').forEach(function (knopf) {
      korbKnopfBeschriften(knopf);
    });
  }

  /* Die kleine Zeile unter dem Knopf. Entsteht hier und nicht im HTML, damit
     in den Karten nichts steht, was ohne Javascript keinen Sinn ergibt. */
  function korbHinweis(knopf, text) {
    var kasten = knopf.closest('.plan-buy') || knopf.parentNode;
    if (!kasten) return;

    var el = kasten.querySelector('.korb-hinweis');
    if (!el) {
      el = document.createElement('p');
      el.className = 'korb-hinweis';
      kasten.appendChild(el);
    }

    el.textContent = text || '';
    el.hidden = !text;
  }

  /* Ein Zuhörer am Dokument statt an jedem einzelnen Knopf: Die Knöpfe werden
     bei jedem Laufzeitwechsel neu beschriftet, der Zuhörer bleibt. */
  document.addEventListener('click', function (e) {
    var knopf = e.target.closest('[data-korb-slug]');
    if (!knopf) return;

    var artikel = korbDaten[knopf.dataset.korbSlug];
    if (!artikel || !window.TT || !TT.korb) return; // dann führt das href zum Warenkorb

    // Liegt das Paket schon drin, ist der Knopf einfach der Weg dorthin.
    if (TT.korb.hat(artikel.slug)) return;

    e.preventDefault();

    /* Ohne Anmeldung geht nichts hinein: Der Warenkorb gehört zum Konto, und
       die Lizenz entsteht später genau dort. Wer nicht angemeldet ist, wird
       zum Anmeldeformular geschickt — das Paket ist danach schon im
       Warenkorb, darum kümmert sich warenkorb.js. */
    TT.korb.anmeldungVerlangen(artikel).then(function (darf) {
      if (!darf) return;

      var erg = TT.korb.hinzufuegen(artikel);
      korbKnoepfeBeschriften();

      /* Eine andere Laufzeit derselben App ersetzt die vorige. Das darf nicht
         stillschweigend passieren — sonst wundert sich jemand über den Betrag
         im Warenkorb. */
      if (erg.ersetzt) {
        korbHinweis(knopf, '✓ Im Warenkorb — die andere Laufzeit wurde ersetzt');
      }
    });
  });

  /* Wird der Warenkorb woanders geändert (zweiter Tab, Zurück-Knopf), stimmen
     die Beschriftungen hier sonst nicht mehr.

     Dazu einmal nach dem Start von warenkorb.js: Kommt jemand gerade von der
     Anmeldung, wandert dort noch sein gemerktes Paket in den Warenkorb — und
     zwar möglicherweise, bevor der Zuhörer oben steht. */
  if (window.TT && TT.korb) {
    TT.korb.beiAenderung(korbKnoepfeBeschriften);
    TT.korb.bereit.then(korbKnoepfeBeschriften);
  }

  function laufzeitZeigen(slug) {
    var eintrag = laufzeiten.filter(function (l) { return l.slug === slug; })[0];
    if (!eintrag) return;

    gewaehlt = slug;

    var preisEl = document.getElementById('app-preis');
    if (preisEl) preisEl.textContent = preisFormat(eintrag.preis);

    korbKnopf(document.getElementById('app-kaufen'), {
      slug: slug,
      name: 'Tweak App',
      untertitel: eintrag.lang,
      preis: eintrag.preis
    });

    var zeile = document.getElementById('app-lizenz-zeile');
    if (zeile) {
      zeile.textContent = slug === 'app-lifetime'
        ? 'Lebenslange Lizenz für 1 PC'
        : 'Lizenz für 1 PC · ' + eintrag.lang;
    }

    document.querySelectorAll('#laufzeit-knoepfe button').forEach(function (b) {
      var aktiv = b.dataset.slug === slug;
      b.classList.toggle('an', aktiv);
      b.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
    });
  }

  var zuhoererGesetzt = false;

  function laufzeitenZeichnen() {
    var behaelter = document.getElementById('laufzeit-knoepfe');
    if (!behaelter || !laufzeiten.length) return;

    behaelter.innerHTML = laufzeiten.map(function (l) {
      return '<button type="button" data-slug="' + l.slug + '" aria-pressed="false">' +
        '<span class="lz-name">' + l.kurz + '</span>' +
        '<span class="lz-preis">' + preisFormat(l.preis) + ' €</span>' +
        '</button>';
    }).join('');

    // Der Zuhörer hängt am Behälter, nicht an den Knöpfen — er überlebt das
    // Neuzeichnen und darf deshalb nur einmal gesetzt werden.
    if (!zuhoererGesetzt) {
      behaelter.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-slug]');
        if (b) laufzeitZeigen(b.dataset.slug);
      });
      zuhoererGesetzt = true;
    }

    laufzeitZeigen(gewaehlt);
  }

  /* Die beiden festen Karten aus der Konfiguration beschriften, damit im HTML
     kein Preis mehr stehen muss. Wird gleich noch aus der Datenbank
     bestätigt. */
  function paketeZeichnen() {
    document.querySelectorAll('[data-preis]').forEach(function (el) {
      var preis = paketPreis(el.dataset.preis);
      if (preis == null) return;

      var karte = el.closest('.plan');
      var betrag = karte && karte.querySelector('.price .amount');
      if (betrag) betrag.textContent = preisFormat(preis);

      /* Der Name kommt aus der Überschrift der Karte, damit er nicht ein
         zweites Mal im Javascript steht. Im Warenkorb wird er ohnehin durch
         den Namen aus der Datenbank ersetzt, sobald sie antwortet. */
      var titel = karte && karte.querySelector('h3');

      korbKnopf(el, {
        slug: el.dataset.preis,
        name: titel ? titel.textContent.trim() : el.dataset.preis,
        untertitel: '',
        preis: preis
      });
    });
  }

  /* Alles, was sich aus den Preisen ERRECHNET, statt irgendwo zu stehen.

     Vorher standen die durchgestrichene Summe (79,98 €) und die Ersparnis
     (9,99 €) als feste Zahlen im HTML. Ändert sich ein Einzelpreis — und
     verbindlich ist der aus der Datenbank —, blieben sie stehen: Die Karte
     hätte dann "69,99 statt 79,98, du sparst 9,99" behauptet, während die
     Einzelpreise daneben etwas anderes ergaben.

     Deshalb wird hier gerechnet statt beschriftet. Ergibt die Rechnung keine
     Ersparnis, verschwinden die beiden Angaben, statt eine negative zu
     zeigen. */
  function abgeleitetePreiseZeichnen() {
    function betragText(wert) { return preisFormat(wert) + ' €'; }

    /* Die Bundle-Beträge außerhalb der Preiskarte (Kassen-Vorschau,
       Abschluss-CTA). Innerhalb der Karte macht das paketeZeichnen. */
    document.querySelectorAll('[data-preis-betrag]').forEach(function (el) {
      var preis = paketPreis(el.dataset.preisBetrag);
      if (preis != null) el.textContent = betragText(preis);
    });

    /* Günstigste Laufzeit für den Hero-Text — nicht fest "4,99 €", sondern
       das tatsächliche Minimum aus der Liste. */
    var abEl = document.querySelector('[data-preis-ab]');
    if (abEl && laufzeiten.length) {
      var kleinster = laufzeiten.reduce(function (min, l) {
        var z = Number(l.preis);
        return isFinite(z) && z < min ? z : min;
      }, Infinity);
      if (isFinite(kleinster)) abEl.textContent = betragText(kleinster);
    }

    document.querySelectorAll('[data-preis-laufzeit]').forEach(function (el) {
      var eintrag = laufzeiten.filter(function (l) {
        return l.slug === el.dataset.preisLaufzeit;
      })[0];
      if (eintrag) el.textContent = betragText(eintrag.preis);
    });

    /* Summe und Ersparnis des Bundles. Bezugsgröße ist die Lifetime-Lizenz,
       denn genau die steckt im Bundle drin. */
    var lifetime = laufzeiten.filter(function (l) { return l.slug === 'app-lifetime'; })[0];
    var optimierung = paketPreis('optimierung');
    var bundle = paketPreis('bundle');

    var summe = Number(lifetime && lifetime.preis) + Number(optimierung);
    var ersparnis = summe - Number(bundle);

    var summeEl = document.querySelector('[data-preis-summe]');
    var sparEl = document.querySelector('[data-preis-ersparnis]');
    var sparBetragEls = document.querySelectorAll('[data-preis-ersparnis-betrag]');

    var gueltig = isFinite(summe) && isFinite(ersparnis) && ersparnis > 0;

    if (summeEl) {
      summeEl.textContent = gueltig ? betragText(summe) : '';
      summeEl.hidden = !gueltig;
    }
    if (sparEl) {
      sparEl.textContent = gueltig ? 'Du sparst ' + betragText(ersparnis) : '';
      sparEl.hidden = !gueltig;
    }
    sparBetragEls.forEach(function (el) {
      if (gueltig) el.textContent = betragText(ersparnis);
    });
  }

  laufzeitenZeichnen();
  paketeZeichnen();
  abgeleitetePreiseZeichnen();

  /* ====================================================================
     7. Preise aus der Datenbank bestätigen

     Die Preise im HTML sind nur die schnelle Anzeige. Verbindlich ist, was
     in der Datenbank steht — und genau das berechnet auch die Edge Function
     beim Kauf. Weicht etwas ab, korrigiert sich die Seite hier selbst,
     damit nirgends ein falscher Preis stehen bleibt.
     ==================================================================== */
  /**
   * Schreibt die Preisseite auf den Übergangsweg um: Bezahlt wird direkt über
   * paypal.me, den Schlüssel gibt es per Discord. Wird aufgerufen, wenn der
   * automatische Shop (noch) nicht bereitsteht.
   *
   * Welcher der beiden Wege gilt, entscheidet der Warenkorb — dort steht der
   * Kaufknopf. Hier werden nur die Texte ringsum nachgezogen.
   */
  function aufUebergangUmstellen() {
    /* Die Kaufknöpfe bleiben, wie sie sind: Gelegt wird in beiden Fällen in
       den Warenkorb. Anders ist nur, was danach passiert — und das steht auf
       der Warenkorbseite. Hier wird deshalb bloß die Zeile unter dem Knopf
       ehrlich gehalten, die sonst eine Lizenz "sofort im Kundenbereich"
       verspricht. */
    var zeilen = {
      optimierung: 'Zahlung über PayPal · Termin per Discord',
      bundle:      'Zahlung über PayPal · Schlüssel und Termin per Discord'
    };

    document.querySelectorAll('[data-korb-slug]').forEach(function (knopf) {
      var karte = knopf.closest('.plan');
      var alt = karte && karte.querySelector('.plan-alt');
      if (alt) {
        alt.textContent = zeilen[knopf.dataset.korbSlug] ||
          'Zahlung über PayPal · Schlüssel per Discord';
      }
    });

    var hinweis = document.getElementById('uebergangs-hinweis');
    if (hinweis) {
      hinweis.hidden = false;
      if (window.TT) TT.grundgeruest(); // Discord-Name einsetzen
    }

    /* Der Satz zum Konto bleibt auch hier stehen: Der Warenkorb verlangt eine
       Anmeldung, egal welcher der beiden Zahlwege gerade gilt. Nur der Teil
       mit dem automatischen Lizenzschlüssel stimmt im Übergang nicht. */
    var note = document.getElementById('preise-note');
    if (note) {
      note.innerHTML = 'Alle Preise in Euro, inklusive der jeweils geltenden Steuern. ' +
        'Zum Einkaufen brauchst du ein kostenloses <a href="registrieren.html">Konto</a>. ' +
        'Es gelten die <a href="agb.html">AGB</a> und die ' +
        '<a href="widerruf.html">Rücktrittsbelehrung</a>.';
    }

    /* Der Kaufablauf weiter unten beschreibt den automatischen Weg. Solange
       der nicht läuft, würde die Seite sich selbst widersprechen: oben steht
       "Schlüssel per Discord", unten "erscheint automatisch". Also auch hier
       sagen, was wirklich passiert. */
    var schritte = {
      '1-titel': 'Paket auswählen',
      '1-text':  'Du legst eine Laufzeit, die Optimierung oder beides im Bundle in den ' +
                 'Warenkorb. Einen Rabattcode gibst du dort ein.',
      '3-titel': 'Schlüssel anfordern',
      '3-text':  'Nach der Zahlung schreibst du mir kurz auf Discord und nennst den Namen, ' +
                 'unter dem du bezahlt hast. Ich gleiche die Zahlung ab und schicke dir den Schlüssel.',
      '4-titel': 'Herunterladen & freischalten',
      '4-text':  'Du bekommst den Download-Link zusammen mit deinem Schlüssel. ' +
                 'Beim ersten Start der App gibst du ihn ein — fertig.'
    };

    Object.keys(schritte).forEach(function (k) {
      var el = document.querySelector('[data-schritt="' + k + '"]');
      if (el) el.textContent = schritte[k];
    });
  }

  (async function preiseAbgleichen() {
    /* Ob der automatische Shop bereitsteht, beantwortet TT.korb.shopPruefen()
       — dieselbe Prüfung, die auch der Warenkorb für seinen Kaufknopf
       benutzt. Zwei Kopien davon würden irgendwann auseinanderlaufen. */
    if (!window.TT || !TT.korb) return aufUebergangUmstellen();

    var stand = await TT.korb.shopPruefen();
    if (!stand.laeuft) return aufUebergangUmstellen();

    var ausDb = {};
    stand.produkte.forEach(function (p) { ausDb[p.slug] = p.price; });

    var geaendert = false;
    laufzeiten.forEach(function (l) {
      if (ausDb[l.slug] != null && Number(ausDb[l.slug]) !== Number(l.preis)) {
        l.preis = ausDb[l.slug];
        geaendert = true;
      }
    });

    // Laufzeiten, die es in der Datenbank nicht (mehr) gibt, verschwinden.
    var vorher = laufzeiten.length;
    laufzeiten = laufzeiten.filter(function (l) { return ausDb[l.slug] != null; });
    if (laufzeiten.length !== vorher) geaendert = true;

    if (geaendert) {
      if (!laufzeiten.some(function (l) { return l.slug === gewaehlt; })) {
        gewaehlt = laufzeiten.length ? laufzeiten[laufzeiten.length - 1].slug : 'app-lifetime';
      }
      laufzeitenZeichnen();
    }

    // Die beiden festen Karten
    document.querySelectorAll('[data-preis]').forEach(function (el) {
      var preis = ausDb[el.dataset.preis];
      if (preis == null) return;

      var karte = el.closest('.plan');
      var betrag = karte && karte.querySelector('.price .amount');
      if (betrag) betrag.textContent = preisFormat(preis);

      /* Auch der Warenkorb-Knopf muss den bestätigten Preis tragen: Sonst
         legte er den Betrag aus konfig.js in den Warenkorb, während auf der
         Karte darüber der aus der Datenbank steht. */
      var artikel = korbDaten[el.dataset.preis];
      if (artikel) {
        artikel.preis = preis;
        korbKnopfBeschriften(el);
      }
    });

    /* Auch die Liste selbst nachziehen, nicht nur die Beschriftungen im
       Dokument: paketPreis() liest aus dieser Liste, und die Rechnung
       darunter muss mit denselben Zahlen arbeiten wie die Karten darüber.
       Ohne diesen Schritt stünde in der Summe weiter der Wert aus
       konfig.js, während auf der Karte der aus der Datenbank steht. */
    pakete.forEach(function (p) {
      if (ausDb[p.slug] != null) p.preis = ausDb[p.slug];
    });

    abgeleitetePreiseZeichnen();
  })();

})();
