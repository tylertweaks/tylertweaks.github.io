/* ==========================================================================
   Rahmenschutz gegen Clickjacking

   Bei Clickjacking legt jemand unsere Seite unsichtbar oder getarnt in einen
   Rahmen (iframe) auf seiner eigenen Seite und bringt Besucher dazu, auf
   etwas zu klicken, das in Wahrheit unser Knopf ist: etwa "Zahlung erhalten"
   in der Verwaltung oder "Konto löschen".

   Das richtige Mittel wäre der Header "frame-ancestors" bzw. X-Frame-Options.
   GitHub Pages lässt aber keine eigenen Header zu, und in einem <meta>-Tag
   wird frame-ancestors vom Browser ignoriert. Darum diese Notlösung:

     1. Im <head> steht eine Regel, die die Seite zunächst unsichtbar macht
        (html { visibility: hidden }), plus ein <noscript>, das sie ohne
        JavaScript wieder zeigt.
     2. Dieses Skript läuft, bevor etwas gezeichnet wird. Steht die Seite
        ganz oben im Fenster, macht es sie sichtbar.
     3. Steckt sie in einem fremden Rahmen, versucht es, das oberste Fenster
        auf unsere Adresse zu setzen. Gelingt das nicht (z. B. weil der
        Rahmen mit sandbox="..." gesperrt ist), bleibt die Seite unsichtbar
        und damit auch nichts zum Anklicken da.

   Nur auf den Seiten mit Konto, Kasse und Verwaltung eingebunden. Die
   Schaufensterseiten brauchen das nicht, und dort soll die Seite auch ohne
   JavaScript sofort stehen.
   ========================================================================== */
(function () {
  'use strict';

  var oben = false;
  try { oben = window.top === window.self; } catch (e) { oben = false; }

  if (oben) {
    document.documentElement.style.visibility = 'visible';
    return;
  }

  try {
    window.top.location.replace(window.self.location.href);
  } catch (e) {
    /* Gesperrter Rahmen: Die Seite bleibt unsichtbar. */
  }
})();
