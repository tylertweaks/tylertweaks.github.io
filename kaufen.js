/* ==========================================================================
   Tyler Tweaks — Kaufseite

   Wichtig für das Verständnis: Der Browser bestimmt hier weder Preis noch
   Zahlungsstatus.

     createOrder  -> ruft die Edge Function "paypal-create-order" auf.
                     Die holt den Preis aus der Datenbank und legt die
                     Bestellung bei PayPal an.
     onApprove    -> ruft die Edge Function "paypal-capture" auf.
                     Die bucht bei PayPal ab, prüft den Betrag gegen die
                     Bestellung und erzeugt erst dann den Lizenzschlüssel.

   Selbst wenn jemand diese Datei komplett austauscht, kann er dadurch weder
   den Preis ändern noch eine Lizenz ohne Zahlung bekommen.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.TT) return;
  var db = TT.db;
  var KONFIG = TT.konfig;

  TT.grundgeruest();
  TT.navAufbauen();

  var elLaden      = document.getElementById('laden');
  var elKauf       = document.getElementById('kauf');
  var elFertig     = document.getElementById('fertig');
  var elUnbekannt  = document.getElementById('unbekannt');
  var elNichtDa    = document.getElementById('nicht-erreichbar');

  var produkt = null;

  function zeige(welches) {
    [elLaden, elKauf, elFertig, elUnbekannt, elNichtDa].forEach(function (el) {
      if (el) el.hidden = el !== welches;
    });
  }

  /**
   * Der Shop antwortet nicht. Das ist etwas anderes als "Paket gibt es nicht"
   * und muss dem Kunden auch anders gesagt werden — sonst hält er ein
   * Serverproblem für ein eingestelltes Produkt.
   *
   * Der technische Grund geht nur den Betreiber etwas an. Er landet in der
   * Konsole und, falls die Seite lokal läuft, zusätzlich sichtbar auf der
   * Seite. Ein Kunde auf der echten Adresse sieht ihn nie.
   */
  function shopNichtErreichbar(fehler) {
    console.error('Shop nicht erreichbar:', fehler);
    zeige(elNichtDa);
    TT.grundgeruest(); // Discord-Namen im neu sichtbaren Bereich einsetzen

    var lokal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';
    var kasten = document.getElementById('betreiber-hinweis');
    if (!kasten) return;

    // PGRST205 heißt: Die Tabelle gibt es nicht. Das ist der mit Abstand
    // häufigste Fall direkt nach dem Aufsetzen.
    var tabelleFehlt = fehler && (fehler.code === 'PGRST205' ||
      /schema cache|does not exist/i.test(String(fehler.message || '')));

    if (tabelleFehlt) {
      kasten.textContent = 'Betreiber-Hinweis: Die Produkttabelle fehlt. ' +
        'Führe 01-lizenztypen-erweitern.sql und 02-shop-schema.sql im ' +
        'Supabase-SQL-Editor aus (Schritt 1 der Einrichtung).';
      kasten.hidden = false;
      return;
    }

    if (lokal && fehler) {
      kasten.textContent = 'Betreiber-Hinweis: ' + (fehler.message || fehler);
      kasten.hidden = false;
    }
  }

  /* ====================================================================
     Start
     ==================================================================== */
  (async function start() {
    if (TT.startFehler) {
      zeige(elKauf);
      return TT.melden('meldung', TT.startFehler, 'error');
    }

    var sitzung = await TT.schuetzen();
    if (!sitzung) return; // leitet selbst zur Anmeldung um

    // Ohne bestätigte E-Mail geht kein Kauf — der Server lehnt sonst ohnehin ab.
    if (!sitzung.user.email_confirmed_at) {
      zeige(elKauf);
      document.getElementById('paypal-laden').hidden = true;
      return TT.melden('meldung',
        'Deine E-Mail-Adresse wurde noch nicht bestätigt. Klick zuerst auf den ' +
        'Link in der Bestätigungsmail — danach kannst du kaufen.', 'error');
    }

    var slug = new URLSearchParams(window.location.search).get('produkt') || '';
    if (!slug) return zeige(elUnbekannt);

    var erg = await db.from('products')
      .select('slug, name, subtitle, description, price, currency, license_type, is_download, is_service')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();

    // Zwei Fälle, die auseinandergehalten werden müssen:
    // erg.error  -> der Server antwortet nicht (Tabelle fehlt, Netz weg, …)
    // kein Datensatz -> das Paket gibt es tatsächlich nicht mehr
    if (erg.error) return shopNichtErreichbar(erg.error);
    if (!erg.data) return zeige(elUnbekannt);

    produkt = erg.data;
    kaufAufbauen(sitzung);
  })();

  /* ====================================================================
     Zusammenfassung anzeigen
     ==================================================================== */
  function kaufAufbauen(sitzung) {
    document.getElementById('p-name').textContent = produkt.name;
    document.getElementById('p-beschreibung').textContent = produkt.description || '';
    document.getElementById('p-preis').textContent = TT.geld(produkt.price, produkt.currency);
    document.getElementById('p-konto').textContent = sitzung.user.email;

    document.getElementById('p-laufzeit').textContent = produkt.license_type
      ? TT.laufzeit(produkt.license_type)
      : 'Einmalige Leistung';

    document.getElementById('p-key').textContent = produkt.license_type
      ? 'wird automatisch erzeugt'
      : 'nicht nötig';

    /* Der Zusatz zum vorzeitigen Entfall des Rücktrittsrechts gilt nur für
       digitale Inhalte. Bei der reinen Dienstleistung bleibt das Rücktrittsrecht
       bestehen — dort wäre der Satz schlicht falsch. */
    var digital = document.getElementById('zustimmung-digital');
    if (digital && !produkt.license_type) digital.hidden = true;

    /* Läuft PayPal noch im Testbetrieb, muss das hier stehen. Sonst wartet
       jemand auf eine Lizenz für eine Zahlung, die nie stattgefunden hat. */
    var istLive = String(KONFIG.paypalUmgebung || '').toLowerCase() === 'live';
    var hinweis = document.getElementById('testmodus');
    if (hinweis && !istLive) hinweis.hidden = false;

    zeige(elKauf);
    paypalLaden();
  }

  /* ====================================================================
     PayPal-Buttons
     ==================================================================== */
  function paypalNichtVerfuegbar(text) {
    var laden = document.getElementById('paypal-laden');
    if (laden) laden.hidden = true;

    var kasten = document.getElementById('paypal-fehlt');
    var textEl = document.getElementById('paypal-fehlt-text');
    if (textEl) textEl.textContent = text;
    if (kasten) kasten.hidden = false;
  }

  function paypalLaden() {
    var clientId = String(KONFIG.paypalClientId || '').trim();

    if (!clientId) {
      return paypalNichtVerfuegbar(
        'Die Bezahlung über PayPal ist auf dieser Seite noch nicht freigeschaltet.');
    }

    var skript = document.createElement('script');
    skript.src = 'https://www.paypal.com/sdk/js' +
      '?client-id=' + encodeURIComponent(clientId) +
      '&currency=' + encodeURIComponent(produkt.currency || KONFIG.waehrung || 'EUR') +
      '&intent=capture&locale=de_DE&components=buttons&disable-funding=paylater';
    skript.async = true;

    skript.onerror = function () {
      paypalNichtVerfuegbar(
        'PayPal konnte nicht geladen werden. Das liegt meistens an einem ' +
        'Werbeblocker oder einer Firewall.');
    };

    skript.onload = function () {
      if (!window.paypal || !window.paypal.Buttons) {
        return paypalNichtVerfuegbar('PayPal konnte nicht geladen werden.');
      }

      var laden = document.getElementById('paypal-laden');
      if (laden) laden.hidden = true;

      var haken = document.getElementById('zustimmung');

      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'paypal', height: 48 },

        /* ---- Knöpfe erst nach der Zustimmung freigeben ------------------ */
        onInit: function (data, actions) {
          if (!haken) return;
          actions.disable();
          haken.addEventListener('change', function () {
            if (haken.checked) { actions.enable(); TT.melden('meldung', ''); }
            else actions.disable();
          });
        },

        onClick: function (data, actions) {
          if (haken && !haken.checked) {
            TT.melden('meldung',
              'Bitte bestätige zuerst AGB und Rücktrittsbelehrung.', 'warn');
            return actions.reject();
          }
          return actions.resolve();
        },

        /* ---- Bestellung anlegen (serverseitig) ------------------------- */
        createOrder: async function () {
          TT.melden('meldung', '');

          var antwort = await TT.funktion('paypal-create-order', {
            product_slug: produkt.slug
          });

          if (!antwort.ok || !antwort.daten || !antwort.daten.paypal_order_id) {
            TT.melden('meldung', antwort.fehler || TT.fehlerText('server_error'), 'error');
            throw new Error(antwort.code || 'create_failed');
          }

          return antwort.daten.paypal_order_id;
        },

        /* ---- Zahlung abbuchen und freischalten (serverseitig) ---------- */
        onApprove: async function (data) {
          TT.melden('meldung', 'Zahlung wird geprüft …', 'ok');

          var antwort = await TT.funktion('paypal-capture', {
            paypal_order_id: data.orderID
          });

          if (!antwort.ok) {
            // "fulfillment_failed" heißt: bezahlt, aber die Freischaltung
            // hakte. Der Webhook holt das nach — der Kunde soll nicht den
            // Eindruck bekommen, sein Geld sei weg.
            TT.melden('meldung', antwort.fehler,
              antwort.code === 'fulfillment_failed' ? 'warn' : 'error');
            return;
          }

          fertigZeigen(antwort.daten);
        },

        onCancel: function () {
          TT.melden('meldung',
            'Du hast die Zahlung abgebrochen. Es wurde nichts abgebucht.', 'warn');
        },

        onError: function (fehler) {
          console.error('PayPal:', fehler);
          TT.melden('meldung',
            'Die Zahlung konnte nicht gestartet werden. Versuche es bitte noch einmal.',
            'error');
        }
      }).render('#paypal-knoepfe').catch(function (fehler) {
        console.error('PayPal-Buttons:', fehler);
        paypalNichtVerfuegbar('PayPal konnte nicht angezeigt werden.');
      });
    };

    document.head.appendChild(skript);
  }

  /* ====================================================================
     Erfolgsansicht
     ==================================================================== */
  function fertigZeigen(daten) {
    document.getElementById('f-nummer').textContent = '#' + (daten.order_no || '—');

    document.getElementById('f-text').textContent = daten.already_done
      ? 'Diese Bestellung war bereits bestätigt — hier ist sie noch einmal.'
      : 'Deine Zahlung ist bestätigt und die Bestellung liegt in deinem Konto.';

    if (daten.license_key) {
      document.getElementById('f-key').textContent = daten.license_key;
      document.getElementById('f-lizenz-panel').hidden = false;
    }

    if (produkt && produkt.is_service) {
      document.getElementById('f-service-panel').hidden = false;
    }

    zeige(elFertig);
    TT.grundgeruest(); // Discord-Name in den neu sichtbaren Bereichen einsetzen
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---- Schlüssel kopieren --------------------------------------------- */
  var kopierKnopf = document.getElementById('f-kopieren');
  if (kopierKnopf) {
    kopierKnopf.addEventListener('click', async function () {
      var key = document.getElementById('f-key').textContent.trim();
      if (!key || key === '—') return;

      var erfolg = await TT.kopieren(key);
      kopierKnopf.textContent = erfolg ? 'Kopiert ✓' : 'Bitte von Hand markieren';
      setTimeout(function () { kopierKnopf.textContent = 'Kopieren'; }, 2200);
    });
  }
})();
