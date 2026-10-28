/* ==========================================================================
   Tyler Tweaks — Besucherzählung ohne Cookies

   Meldet pro Seitenaufruf und pro Klick auf Download, Kaufen und Score-Test
   ein Ereignis an die Datenbank (backend/22-besucherzaehlung.sql im
   App-Repository). Dort wird nur eine Zahl je Tag, Ereignis, Seite und grobe
   Herkunft hochgezählt.

   Was dieses Skript NICHT tut:
     * nichts auf dem Gerät speichern (kein Cookie, kein localStorage), außer
       einem Schalter, den du als Betreiber selbst setzt (siehe unten)
     * keine Kennung vergeben, niemanden wiedererkennen
     * keine Adresse mit Suchanfrage, keinen Titel, kein Gerät übertragen
   Gesendet werden nur drei Wörter aus festen Listen: Ereignis, Seite, Herkunft.
   Die Datenbank verwirft alles, was nicht auf diesen Listen steht.

   Nicht gezählt wird bei "Do Not Track" und "Global Privacy Control", bei
   Robotern, beim lokalen Testen und auf Geräten, auf denen der Betreiber die
   Zählung ausgeschaltet hat (Adresse mit ?zaehlung=aus öffnen; ?zaehlung=an
   schaltet wieder ein). Das hält deine eigenen Besuche aus den Zahlen.

   Die Liste der Werte steht ein zweites Mal in der Datenbank. Neue Seite oder
   neues Ereignis: dort UND hier ergänzen.
   ========================================================================== */

(function () {
  'use strict';

  var K = window.TT_KONFIG || {};
  if (!K.supabaseUrl || !K.supabaseAnonKey) return;

  var SEITEN = ['start', 'tweaks', 'ablauf', 'sicherheit', 'score-test', 'kaufen', 'warenkorb', 'anmelden',
                  'ratgeber', 'windows-11-gaming-einstellen', 'input-lag-senken', 'windows-11-entruempeln'];
  var QUELLEN = ['direkt', 'tiktok', 'discord', 'youtube', 'instagram', 'reddit', 'google', 'suche', 'andere'];
  var SCHALTER = 'tt-zaehlung-aus';

  /* ---- Betreiber-Schalter -------------------------------------------------
     Das einzige, was dieses Skript je auf einem Gerät ablegt, und nur auf
     Wunsch dessen Besitzers: "bitte hier nicht zählen". */
  try {
    var wahl = new URLSearchParams(window.location.search).get('zaehlung');
    if (wahl === 'aus') window.localStorage.setItem(SCHALTER, '1');
    if (wahl === 'an') window.localStorage.removeItem(SCHALTER);
    if (window.localStorage.getItem(SCHALTER)) return;
  } catch (e) { /* kein Speicher: dann wird eben gezählt */ }

  var host = window.location.hostname;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) || /\.localhost$/.test(host)) return;

  var nav = window.navigator || {};
  if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.globalPrivacyControl) return;
  if (nav.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(nav.userAgent || '')) return;

  /* ---- Welche Seite ------------------------------------------------------- */
  var name = window.location.pathname.replace(/^\/+|\.html$/g, '').replace(/\/$/, '');
  var seite = (name === '' || name === 'index') ? 'start' : name;
  if (SEITEN.indexOf(seite) < 0) return;

  /* ---- Woher ---------------------------------------------------------------
     Aus der Adresse (?quelle=tiktok, für Links in deinen Profilen) oder aus
     dem Verweis, von dem der Besucher kam. Vom Verweis zählt nur der Rechnername,
     nie die ganze Adresse. */
  function herkunft() {
    try {
      var wunsch = (new URLSearchParams(window.location.search).get('quelle') || '').toLowerCase();
      if (QUELLEN.indexOf(wunsch) >= 0) return wunsch;
    } catch (e) { /* weiter */ }

    var verweis = document.referrer || '';
    if (!verweis) return 'direkt';

    var h;
    try { h = new URL(verweis).hostname.toLowerCase(); } catch (e) { return 'direkt'; }
    if (h === host) return 'intern';
    if (/(^|\.)tiktok\./.test(h))                    return 'tiktok';
    if (/(^|\.)discord(app)?\.(com|gg)$/.test(h))    return 'discord';
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h))   return 'youtube';
    if (/(^|\.)instagram\.com$/.test(h))             return 'instagram';
    if (/(^|\.)reddit\.com$/.test(h))                return 'reddit';
    if (/(^|\.)google\./.test(h))                    return 'google';
    if (/(^|\.)(bing\.com|duckduckgo\.com|ecosia\.org|startpage\.com|qwant\.com|yahoo\.com)$/.test(h)) return 'suche';
    return 'andere';
  }

  /* ---- Senden --------------------------------------------------------------
     Nur der öffentliche Schlüssel, ohne Anmeldung. Fehler bleiben still: Eine
     Zählung darf nie etwas auf der Seite stören. */
  function senden(ereignis, quelle) {
    try {
      window.fetch(String(K.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/rpc/zaehle_ereignis', {
        method: 'POST',
        headers: { 'apikey': K.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ereignis: ereignis, p_seite: seite, p_quelle: quelle }),
        keepalive: true,            // der Klick auf einen Download verlässt die Seite sofort
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      }).catch(function () { /* egal */ });
    } catch (e) { /* egal */ }
  }

  senden('aufruf', herkunft());

  /* ---- Klicks ---------------------------------------------------------------
     Eine Stelle für alle Links, auch die, die ein Skript erst später setzt
     (der Download-Knopf oben auf der Startseite). */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;

    var ziel = a.getAttribute('href') || '';
    var art = null;
    if (a.hasAttribute('download') || /\.exe([?#]|$)/i.test(ziel)) art = 'download';
    // Die Kauf-Knöpfe der Startseite legen ein Paket in den Warenkorb
    // (data-preis, oder die App-Karte mit id app-kaufen). Das Warenkorb-Symbol
    // im Kopf zählt nicht: Es ist kein Kaufwunsch.
    else if (a.hasAttribute('data-preis') || a.id === 'app-kaufen' || /^kaufen\.html/i.test(ziel)) art = 'kauf_klick';
    else if (/^score-test\.html/i.test(ziel))                      art = 'test_klick';

    if (art) senden(art, 'intern');
  }, true);

  /* Für andere Skripte, z. B. den fertigen Score-Test. */
  window.TTZaehlung = {
    ereignis: function (art) { senden(String(art), 'intern'); }
  };
})();
