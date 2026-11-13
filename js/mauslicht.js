/* Tyler Tweaks — blaues Licht, das dem Mauszeiger folgt (2026-11).

   Ein weicher blauer Lichtfleck liegt über der ganzen Seite und wandert mit
   der Maus. Er fängt keine Klicks ab und bewegt sich nur, wenn die Maus sich
   bewegt — von selbst passiert nichts.

   Nur mit echter Maus: auf Handy und Tablet gibt es kein "darüber", dort
   bleibt alles wie es ist. Bei "Bewegung reduzieren" ebenfalls aus.
   Verschoben wird per transform, damit der Browser nichts neu berechnen
   muss; das Aussehen steht in premium.css (.tt-mauslicht). */
(function () {
  'use strict';
  if (!window.matchMedia) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var licht = document.createElement('div');
  licht.className = 'tt-mauslicht';
  licht.setAttribute('aria-hidden', 'true');
  document.body.appendChild(licht);

  var x = 0, y = 0, geplant = false;

  function malen() {
    geplant = false;
    licht.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  }

  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    licht.classList.add('an');
    if (!geplant) {
      geplant = true;
      window.requestAnimationFrame(malen);
    }
  }, { passive: true });

  /* Maus verlässt das Fenster: Licht ausblenden. */
  document.addEventListener('pointerleave', function () { licht.classList.remove('an'); });
  document.documentElement.addEventListener('mouseleave', function () { licht.classList.remove('an'); });
})();
