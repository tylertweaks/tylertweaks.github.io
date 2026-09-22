/* ==========================================================================
   Tyler Tweaks — Registrierung, Anmeldung, Passwort

   Bedient vier Seiten. Welche gerade offen ist, erkennt die Datei am
   vorhandenen Formular.

   Alles Sicherheitsrelevante macht Supabase Auth auf dem Server:
   Passwörter werden dort gehasht (bcrypt) und verlassen den Server nie im
   Klartext. Die E-Mail-Bestätigung ist ein echter Link mit einmaligem Token —
   keine Prüfung, die sich im Browser abschalten ließe.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.TT) return;
  var db = TT.db;
  var KONFIG = TT.konfig;

  TT.grundgeruest();
  TT.navAufbauen();

  var basis = String(KONFIG.seitenUrl || window.location.origin).replace(/\/+$/, '');

  /* Beim lokalen Testen soll der Link auch lokal zurückführen. */
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    basis = window.location.origin;
  }

  function zeigeStartfehler(feldId) {
    if (!TT.startFehler) return false;
    TT.melden(feldId, TT.startFehler, 'error');
    return true;
  }

  function sperren(knopf, aktiv, textAktiv, textNormal) {
    if (!knopf) return;
    knopf.disabled = aktiv;
    knopf.textContent = aktiv ? textAktiv : textNormal;
  }

  /* ====================================================================
     1. Registrieren
     ==================================================================== */
  var regForm = document.getElementById('form-registrieren');
  if (regForm) {
    var regKnopf = regForm.querySelector('button[type="submit"]');

    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (zeigeStartfehler('meldung')) return;
      TT.melden('meldung', '');

      var name      = document.getElementById('name').value.trim();
      var email     = document.getElementById('email').value.trim();
      var passwort  = document.getElementById('passwort').value;
      var passwort2 = document.getElementById('passwort2').value;

      if (name.length < 2) {
        return TT.melden('meldung', 'Bitte gib deinen Namen an.');
      }
      if (!email || email.indexOf('@') < 1) {
        return TT.melden('meldung', 'Bitte gib eine gültige E-Mail-Adresse an.');
      }
      if (passwort.length < 8) {
        return TT.melden('meldung', 'Das Passwort braucht mindestens 8 Zeichen.');
      }
      if (passwort !== passwort2) {
        return TT.melden('meldung', 'Die beiden Passwörter stimmen nicht überein.');
      }

      sperren(regKnopf, true, 'Konto wird erstellt …', 'Konto erstellen');

      var erg = await db.auth.signUp({
        email: email,
        password: passwort,
        options: {
          data: { name: name },
          emailRedirectTo: basis + '/konto.html?willkommen=1'
        }
      });

      sperren(regKnopf, false, '', 'Konto erstellen');

      if (erg.error) {
        return TT.melden('meldung', TT.fehlerText(erg.error));
      }

      // Supabase gibt bei bereits vergebener Adresse einen Nutzer ohne
      // Identitäten zurück, statt das direkt zu sagen.
      var u = erg.data && erg.data.user;
      if (u && Array.isArray(u.identities) && u.identities.length === 0) {
        return TT.melden('meldung',
          'Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich an — ' +
          'oder setze dein Passwort zurück, falls du es vergessen hast.');
      }

      // Geschafft: Formular ausblenden, Hinweis zeigen.
      regForm.hidden = true;
      var hinweis = document.getElementById('nach-registrierung');
      if (hinweis) {
        var ziel = document.getElementById('gesendet-an');
        if (ziel) ziel.textContent = email;
        hinweis.hidden = false;
        hinweis.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  /* ====================================================================
     2. Anmelden
     ==================================================================== */
  var loginForm = document.getElementById('form-anmelden');
  if (loginForm) {
    var loginKnopf = loginForm.querySelector('button[type="submit"]');
    var suche = new URLSearchParams(window.location.search);
    var weiter = suche.get('weiter');

    /* Nur seiteninterne Ziele zulassen. Ohne diese Prüfung könnte jemand einen
       Link wie anmelden.html?weiter=https://boese.example verschicken und
       Kunden nach dem Anmelden auf eine nachgebaute Seite schicken. */
    function zielPruefen(wert) {
      return wert && /^[a-z0-9._-]+\.html(\?[^#]*)?$/i.test(wert) ? wert : 'konto.html';
    }

    // Wer schon angemeldet ist, muss sich nicht noch einmal anmelden.
    (async function () {
      var s = await TT.sitzung();
      if (s) window.location.replace(zielPruefen(weiter));
    })();

    // Rückmeldungen aus vorherigen Schritten
    var vomLink = TT.linkFehler();
    if (vomLink) {
      TT.melden('meldung', vomLink, 'error');
      TT.adresseAufraeumen();
    } else if (suche.get('bestaetigt')) {
      TT.melden('meldung', 'Deine E-Mail-Adresse ist bestätigt. Du kannst dich jetzt anmelden.', 'ok');
    } else if (suche.get('abgemeldet')) {
      TT.melden('meldung', 'Du bist abgemeldet.', 'ok');
    } else if (suche.get('passwort')) {
      TT.melden('meldung', 'Dein Passwort wurde geändert. Melde dich jetzt damit an.', 'ok');
    } else if (suche.get('grund') === 'warenkorb') {
      /* Hierher schickt der Warenkorb, wenn jemand ohne Konto ein Paket
         hineinlegen wollte. Ohne diesen Satz stünde er vor einem
         Anmeldeformular, das er nicht angefordert hat. */
      TT.melden('meldung',
        'Zum Einkaufen brauchst du ein kostenloses Konto — dort landen später ' +
        'deine Lizenz und der Download. Melde dich an, dann liegt dein Paket ' +
        'im Warenkorb.', 'ok');
    }

    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (zeigeStartfehler('meldung')) return;
      TT.melden('meldung', '');

      var email    = document.getElementById('email').value.trim();
      var passwort = document.getElementById('passwort').value;

      if (!email || !passwort) {
        return TT.melden('meldung', 'Bitte E-Mail-Adresse und Passwort eingeben.');
      }

      sperren(loginKnopf, true, 'Anmelden …', 'Anmelden');

      var erg = await db.auth.signInWithPassword({ email: email, password: passwort });

      if (erg.error) {
        sperren(loginKnopf, false, '', 'Anmelden');

        var code = erg.error.code || '';
        var text = String(erg.error.message || '').toLowerCase();

        if (code === 'email_not_confirmed' || text.indexOf('not confirmed') >= 0) {
          TT.melden('meldung',
            'Deine E-Mail-Adresse wurde noch nicht bestätigt. Sieh in deinem ' +
            'Postfach nach — auch im Spam-Ordner.');
          var nochmal = document.getElementById('mail-nochmal');
          if (nochmal) {
            nochmal.hidden = false;
            nochmal.dataset.email = email;
          }
          return;
        }
        return TT.melden('meldung', TT.fehlerText(erg.error));
      }

      window.location.replace(zielPruefen(weiter));
    });

    // Bestätigungsmail erneut anfordern
    var nochmalKnopf = document.getElementById('mail-nochmal-knopf');
    if (nochmalKnopf) {
      nochmalKnopf.addEventListener('click', async function () {
        var kasten = document.getElementById('mail-nochmal');
        var email = (kasten && kasten.dataset.email) || '';
        if (!email) return;

        nochmalKnopf.disabled = true;
        nochmalKnopf.textContent = 'Wird gesendet …';

        var erg = await db.auth.resend({
          type: 'signup',
          email: email,
          options: { emailRedirectTo: basis + '/konto.html?willkommen=1' }
        });

        nochmalKnopf.disabled = false;
        nochmalKnopf.textContent = 'Bestätigungsmail erneut senden';

        TT.melden('meldung',
          erg.error ? TT.fehlerText(erg.error)
                    : 'Die Bestätigungsmail ist unterwegs an ' + email + '.',
          erg.error ? 'error' : 'ok');
      });
    }
  }

  /* ====================================================================
     3. Passwort vergessen
     ==================================================================== */
  var resetForm = document.getElementById('form-passwort-vergessen');
  if (resetForm) {
    var resetKnopf = resetForm.querySelector('button[type="submit"]');

    var linkProblem = TT.linkFehler();
    if (linkProblem) {
      TT.melden('meldung', linkProblem, 'error');
      TT.adresseAufraeumen();
    }

    resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (zeigeStartfehler('meldung')) return;
      TT.melden('meldung', '');

      var email = document.getElementById('email').value.trim();
      if (!email || email.indexOf('@') < 1) {
        return TT.melden('meldung', 'Bitte gib deine E-Mail-Adresse an.');
      }

      sperren(resetKnopf, true, 'Wird gesendet …', 'Link anfordern');

      var erg = await db.auth.resetPasswordForEmail(email, {
        redirectTo: basis + '/passwort-neu.html'
      });

      sperren(resetKnopf, false, '', 'Link anfordern');

      if (erg.error) {
        return TT.melden('meldung', TT.fehlerText(erg.error));
      }

      // Bewusst neutral formuliert: sonst verrät die Seite, welche Adressen
      // ein Konto haben.
      resetForm.hidden = true;
      var fertig = document.getElementById('nach-anforderung');
      if (fertig) {
        var an = document.getElementById('gesendet-an');
        if (an) an.textContent = email;
        fertig.hidden = false;
      }
    });
  }

  /* ====================================================================
     4. Neues Passwort setzen
     ==================================================================== */
  var neuForm = document.getElementById('form-passwort-neu');
  if (neuForm) {
    var neuKnopf = neuForm.querySelector('button[type="submit"]');
    var bereit = false;

    /* Der Link aus der Mail bringt eine Sitzung mit. supabase-js liest sie
       selbst aus der Adresse — wir warten nur darauf, dass sie da ist. */
    db.auth.onAuthStateChange(function (ereignis, sitzung) {
      if (ereignis === 'PASSWORD_RECOVERY' || sitzung) {
        bereit = true;
        neuForm.hidden = false;
        var laden = document.getElementById('pruefe-link');
        if (laden) laden.hidden = true;
      }
    });

    (async function () {
      var problem = TT.linkFehler();
      if (problem) {
        var laden0 = document.getElementById('pruefe-link');
        if (laden0) laden0.hidden = true;
        return TT.melden('meldung', problem, 'error');
      }

      // supabase-js braucht einen Moment, um den Token aus der Adresse zu lesen.
      await new Promise(function (r) { setTimeout(r, 900); });
      if (bereit) return;

      var s = await TT.sitzung();
      var laden = document.getElementById('pruefe-link');
      if (laden) laden.hidden = true;

      if (s) {
        bereit = true;
        neuForm.hidden = false;
      } else {
        TT.melden('meldung',
          'Dieser Link ist nicht mehr gültig. Fordere unten einen neuen an.', 'error');
        var neuAnfordern = document.getElementById('neu-anfordern');
        if (neuAnfordern) neuAnfordern.hidden = false;
      }
    })();

    neuForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      TT.melden('meldung', '');

      var p1 = document.getElementById('passwort').value;
      var p2 = document.getElementById('passwort2').value;

      if (p1.length < 8) {
        return TT.melden('meldung', 'Das Passwort braucht mindestens 8 Zeichen.');
      }
      if (p1 !== p2) {
        return TT.melden('meldung', 'Die beiden Passwörter stimmen nicht überein.');
      }

      sperren(neuKnopf, true, 'Wird gespeichert …', 'Passwort speichern');

      var erg = await db.auth.updateUser({ password: p1 });

      if (erg.error) {
        sperren(neuKnopf, false, '', 'Passwort speichern');
        return TT.melden('meldung', TT.fehlerText(erg.error));
      }

      // Abmelden, damit man sich bewusst mit dem neuen Passwort anmeldet.
      await db.auth.signOut();
      window.location.replace('anmelden.html?passwort=1');
    });
  }
})();
