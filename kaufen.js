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

   Mit Stripe genauso, nur über die Bezahlseite von Stripe:

     Knopf        -> "stripe-checkout" legt Bestellung und Stripe-Sitzung an,
                     der Browser geht zur Bezahlseite von Stripe.
     Rückkehr     -> kaufen.html?produkt=…&stripe_session=…, "stripe-status"
                     fragt bei Stripe nach und erzeugt den Lizenzschlüssel.

   Selbst wenn jemand diese Datei komplett austauscht, kann er dadurch weder
   den Preis ändern noch eine Lizenz ohne Zahlung bekommen.

   Dasselbe gilt für den Rabattcode: Er wird hier nur angezeigt und als Text
   mitgeschickt. Ob er gilt und was er abzieht, entscheidet die Edge Function.
   Der Betrag, den sie zurückmeldet, wird unten gegen die Anzeige geprüft —
   weicht er ab, kommt es gar nicht zur Zahlung.

   Gekauft wird ausschließlich über den Warenkorb. Diese Seite nimmt deshalb
   nur Pakete an, die dort auch liegen.
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
  var elNichtImKorb = document.getElementById('nicht-im-korb');

  var produkt  = null;
  var rabatt   = null; // { code, anzeige, prozent } oder null
  var endpreis = 0;    // Preis nach Rabatt — das, was abgebucht werden soll

  function zeige(welches) {
    [elLaden, elKauf, elFertig, elUnbekannt, elNichtDa, elNichtImKorb].forEach(function (el) {
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

    var slug = new URLSearchParams(window.location.search).get('produkt') || '';
    if (!slug) return zeige(elUnbekannt);

    if (!TT.korb) return zeige(elNichtImKorb);

    // Erst den Start des Warenkorbs abwarten — er legt ein nach der Anmeldung
    // gemerktes Paket unter Umständen gerade noch hinein.
    await TT.korb.bereit;

    /* Der Warenkorb liegt im Browser und ist sofort da. Deshalb wird er
       geprüft, BEVOR zur Anmeldung umgeleitet wird — sonst schickt die Seite
       jemanden erst zum Anmelden und sagt ihm danach, dass er hier gar nichts
       zu bezahlen hat. */
    /* Zurück von der Bezahlseite von Stripe. Nicht am Warenkorb messen:
       Nach der Bestätigung ist das Paket dort schon herausgenommen, und ein
       Neuladen der Seite soll die Bestellung trotzdem noch einmal zeigen. */
    var stripeSitzung = new URLSearchParams(window.location.search).get('stripe_session') || '';

    if (!stripeSitzung && !TT.korb.hat(slug)) return zeige(elNichtImKorb);

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
    kaufAufbauen(sitzung, !!stripeSitzung);

    if (stripeSitzung) {
      stripeRueckkehr(stripeSitzung);
    } else if (new URLSearchParams(window.location.search).has('stripe_abbruch')) {
      TT.melden('meldung',
        'Du hast die Zahlung abgebrochen. Es wurde nichts abgebucht.', 'warn');
    }
  })();

  /* ====================================================================
     Zusammenfassung anzeigen
     ==================================================================== */
  function kaufAufbauen(sitzung, rueckkehr) {
    /* Der Rabattcode kommt aus dem Warenkorb — dort wird er eingegeben. Hier
       wird nur gerechnet, was er bedeutet; verbindlich rechnet der Server. */
    rabatt = TT.korb.codeInfo();
    endpreis = rabatt
      ? TT.korb.rabattPreis(produkt.price, rabatt.prozent)
      : Number(produkt.price);

    document.getElementById('p-name').textContent = produkt.name;
    document.getElementById('p-beschreibung').textContent = produkt.description || '';
    document.getElementById('p-preis').textContent = TT.geld(endpreis, produkt.currency);
    document.getElementById('p-konto').textContent = sitzung.user.email;

    if (rabatt) {
      var alt = document.getElementById('p-preis-alt');
      alt.textContent = TT.geld(produkt.price, produkt.currency);
      alt.hidden = false;

      document.getElementById('p-rabatt').textContent =
        rabatt.anzeige + ' · ' + rabatt.prozent + ' % weniger';
      document.getElementById('p-rabatt-zeile').hidden = false;
    }

    document.getElementById('p-laufzeit').textContent = produkt.license_type
      ? TT.laufzeit(produkt.license_type)
      : 'Einmalige Leistung';

    document.getElementById('p-key').textContent = produkt.license_type
      ? 'wird automatisch erzeugt'
      : 'nicht nötig';

    /* Zwei Zusätze zum Rücktrittsrecht, je nachdem was gekauft wird: Der zum
       Lizenzschlüssel gilt nur für digitale Inhalte, der zur Optimierung nur
       für die Dienstleistung. Das Bundle enthält beides und zeigt beide. Ohne
       das ausdrückliche Verlangen könnte ein Kunde nach der Sitzung
       zurücktreten und schuldete nichts (§ 16 FAGG). */
    var digital = document.getElementById('zustimmung-digital');
    if (digital && !produkt.license_type) digital.hidden = true;

    var dienst = document.getElementById('zustimmung-dienst');
    if (dienst) dienst.hidden = !produkt.is_service;

    /* Läuft ein Zahlweg noch im Testbetrieb, muss das hier stehen. Sonst
       wartet jemand auf eine Lizenz für eine Zahlung, die nie stattgefunden
       hat. */
    var wege = TT.korb.zahlwege();
    var hinweis = document.getElementById('testmodus');
    if (hinweis && wege.test) hinweis.hidden = false;

    zeige(elKauf);

    // Zurück von Stripe: Hier wird nicht noch einmal bezahlt, nur geprüft.
    if (rueckkehr) {
      document.getElementById('paypal-laden').hidden = true;
      return;
    }
    zahlwegeLaden(wege);
  }

  /* ====================================================================
     Zahlwege
     ==================================================================== */
  async function zahlwegeLaden(wege) {
    // Pausiert — außer für Admins (Testmodus, siehe TT.verkaufOffen).
    if (KONFIG.verkaufPausiert && !(TT.verkaufOffen && await TT.verkaufOffen())) {
      return paypalNichtVerfuegbar('Der Verkauf ist gerade pausiert und startet in Kürze.');
    }

    // Die App ist noch nicht erschienen (appErscheint in konfig.js).
    if (TT.appFehlt(produkt.slug)) {
      return paypalNichtVerfuegbar('Die Tweak App erscheint ' + TT.appErscheint() +
        ' — bis dahin kann sie noch nicht gekauft werden, auch nicht im Bundle.');
    }

    if (!wege.paypal && !wege.stripe) {
      return paypalNichtVerfuegbar(
        'Die Bezahlung ist auf dieser Seite noch nicht freigeschaltet.');
    }

    if (wege.stripe) stripeAufbauen();

    if (wege.paypal) paypalLaden();
    else document.getElementById('paypal-laden').hidden = true;
  }

  /**
   * Gleiche Gegenprobe für beide Zahlwege: Weicht der Betrag vom Server von
   * der Anzeige ab, wird nicht bezahlt. Gibt true zurück, wenn alles passt.
   */
  function betragStimmt(daten) {
    var serverPreis = Number(daten && daten.product && daten.product.price);
    if (isFinite(serverPreis) && Math.abs(serverPreis - endpreis) > 0.005) {
      console.error('Betrag weicht ab — angezeigt:', endpreis, 'vom Server:', serverPreis);
      TT.melden('meldung',
        'Der Betrag stimmt nicht mit der Anzeige überein — es wurde nichts ' +
        'abgebucht. Lade die Seite bitte neu. Bleibt es dabei, schreib mir ' +
        'kurz auf Discord.', 'error');
      return false;
    }
    return true;
  }

  /* ---- Stripe: Knopf zur Bezahlseite --------------------------------- */
  function stripeAufbauen() {
    var bereich = document.getElementById('stripe-bereich');
    var knopf = document.getElementById('stripe-knopf');
    var haken = document.getElementById('zustimmung');
    if (!bereich || !knopf) return;

    bereich.hidden = false;
    var beschriftung = knopf.textContent;

    knopf.addEventListener('click', async function () {
      if (haken && !haken.checked) {
        return TT.melden('meldung',
          'Bitte bestätige zuerst AGB und Rücktrittsbelehrung.', 'warn');
      }

      TT.melden('meldung', '');
      knopf.disabled = true;
      knopf.textContent = 'Weiter zu Stripe …';

      var antwort = await TT.funktion('stripe-checkout', {
        product_slug: produkt.slug,
        coupon_code: rabatt ? rabatt.code : ''
      });

      if (!antwort.ok || !antwort.daten || !antwort.daten.checkout_url ||
          !betragStimmt(antwort.daten)) {
        if (!antwort.ok || !antwort.daten || !antwort.daten.checkout_url) {
          TT.melden('meldung', antwort.fehler || TT.fehlerText('server_error'), 'error');
        }
        knopf.disabled = false;
        knopf.textContent = beschriftung;
        return;
      }

      window.location.assign(antwort.daten.checkout_url);
    });
  }

  /* ---- Stripe: Rückkehr von der Bezahlseite -------------------------- */
  async function stripeRueckkehr(sitzungId) {
    TT.melden('meldung', 'Zahlung wird geprüft …', 'ok');

    /* Stripe leitet meist erst zurück, wenn die Zahlung durch ist. Für den
       seltenen Fall, dass die Bestätigung einen Moment hinterherhinkt, wird
       ein paar Mal nachgefragt. */
    var antwort = null;
    for (var versuch = 0; versuch < 5; versuch++) {
      antwort = await TT.funktion('stripe-status', { session_id: sitzungId });
      if (antwort.ok) return fertigZeigen(antwort.daten);
      if (antwort.code !== 'payment_not_completed' && antwort.code !== 'network_error') break;
      await new Promise(function (r) { setTimeout(r, 2000); });
    }

    if (antwort.code === 'payment_pending') {
      return TT.melden('meldung',
        'Deine Zahlung ist unterwegs. Sobald Stripe sie bestätigt, erscheint ' +
        'die Lizenz automatisch in deinem Kundenbereich und du bekommst eine ' +
        'E-Mail. Bei einer Lastschrift kann das ein paar Tage dauern.', 'warn');
    }

    TT.melden('meldung', antwort.fehler,
      antwort.code === 'fulfillment_failed' ? 'warn' : 'error');
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

    /* Neben PayPal selbst: Kredit- und Debitkarte ohne PayPal-Konto, SEPA-
       Lastschrift und die üblichen Bankzahlungen in Europa. PayPal blendet
       davon nur ein, was im Land des Käufers und für dieses Händlerkonto
       geht, also etwa EPS nur in Österreich. Ratenkauf bleibt aus. */
    var skript = document.createElement('script');
    skript.src = 'https://www.paypal.com/sdk/js' +
      '?client-id=' + encodeURIComponent(clientId) +
      '&currency=' + encodeURIComponent(produkt.currency || KONFIG.waehrung || 'EUR') +
      '&intent=capture&locale=de_DE&components=buttons' +
      '&enable-funding=card,sepa,eps,ideal,bancontact,blik,p24,mybank' +
      '&disable-funding=paylater';
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
            product_slug: produkt.slug,
            coupon_code: rabatt ? rabatt.code : ''
          });

          if (!antwort.ok || !antwort.daten || !antwort.daten.paypal_order_id) {
            TT.melden('meldung', antwort.fehler || TT.fehlerText('server_error'), 'error');
            throw new Error(antwort.code || 'create_failed');
          }

          /* Gegenprobe. Die Edge Function schickt den Betrag zurück, den
             PayPal gleich einziehen wird. Stimmt er nicht mit dem überein, was
             hier auf der Seite steht, wird nicht bezahlt.

             Gebaut für den Fall, dass Anzeige und Server auseinanderlaufen —
             früher etwa, wenn ein Rabattcode nur in konfig.js stand. Seit die
             Codes aus der Datenbank kommen, fragen beide dieselbe Funktion;
             die Prüfung bleibt trotzdem, sie kostet nichts. Ohne sie stünde
             auf der Seite der Rabattpreis, abgebucht würde der volle. */
          var serverPreis = Number(antwort.daten.product && antwort.daten.product.price);

          if (isFinite(serverPreis) && Math.abs(serverPreis - endpreis) > 0.005) {
            console.error('Betrag weicht ab — angezeigt:', endpreis, 'vom Server:', serverPreis,
              '· Ist paypal-create-order auf dem Stand von 08-pc-freigabe-und-rabatte.sql?');

            TT.melden('meldung',
              'Der Betrag stimmt nicht mit der Anzeige überein — es wurde nichts ' +
              'abgebucht. Lade die Seite bitte neu. Bleibt es dabei, schreib mir ' +
              'kurz auf Discord.', 'error');

            throw new Error('betrag_abweichung');
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

    /* Bezahlt heißt: raus aus dem Warenkorb. Sonst läge das Paket beim
       nächsten Besuch noch darin und würde ein zweites Mal zum Kauf
       angeboten. Liegt noch etwas anderes darin, führt ein Knopf zurück. */
    if (TT.korb && produkt) {
      TT.korb.entfernen(produkt.slug);

      var rest = TT.korb.anzahl();
      var weiter = document.getElementById('f-korb-rest');
      if (weiter && rest > 0) {
        weiter.textContent = 'Zum Warenkorb (noch ' + rest + ')';
        weiter.hidden = false;
      }
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
