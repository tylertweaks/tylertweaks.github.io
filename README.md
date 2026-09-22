# Tyler Tweaks — Website

Verkaufsseite und Kundenbereich für die Tweak App und die PC-Optimierung.
Statische Seite ohne Build-Schritt, läuft auf GitHub Pages.

Live: https://tylertweaks.github.io/

**Einrichtung und alle Zugangsdaten:** siehe `EINRICHTUNG.md` im Ordner
`E:\Tweak app` (liegt bewusst nicht in diesem öffentlichen Repository).

## Angebot

| Paket | Preis |
|---|---|
| Tweak App — 24 Stunden | 4,99 € |
| Tweak App — 2 Tage | 6,99 € |
| Tweak App — 1 Woche | 9,99 € |
| Tweak App — 1 Monat | 14,99 € |
| Tweak App — 1 Jahr | 24,99 € |
| Tweak App — Lifetime | 49,99 € |
| PC-Optimierung | 29,99 € |
| Bundle (App Lifetime + Optimierung) | 69,99 € |

Verbindlich sind immer die Preise in der Supabase-Tabelle `products` — die
Edge Function rechnet ausschließlich damit. Die Zahlen in `konfig.js` sorgen nur
dafür, dass die Preisliste sofort etwas anzeigt; weichen sie ab, korrigiert die
Seite sich beim Laden selbst.

> **Noch offen:** Die Datenbank führt weiterhin die alten Preise (2 € bis 30 €).
> Führ `backend/05-preise-2026.sql` im Supabase-SQL-Editor aus, **bevor** du den
> automatischen Shop scharf schaltest. Sonst zeigt die Seite ab diesem Moment
> wieder die alten Beträge an — die Datenbank gewinnt immer.
>
> Bereits abgeschlossene Bestellungen ändern sich dadurch nicht: `orders.price`
> hält den Preis vom Kaufzeitpunkt fest.

Alle Preise stehen an genau zwei Stellen: in der Datenbank (verbindlich) und in
`konfig.js` unter `laufzeiten` und `pakete` (nur Anzeige). **Im HTML steht kein
Preis mehr fest** — die Kaufknöpfe und Beträge werden beim Laden gefüllt.

## Warenkorb und Rabattcode

Gekauft wird nur über den Warenkorb. Der Knopf auf der Preiskarte legt das
Paket hinein, bezahlt wird auf `warenkorb.html`. `kaufen.html` nimmt deshalb
nur noch Pakete an, die wirklich im Warenkorb liegen — wer die Adresse direkt
aufruft, bekommt dort einen Hinweis statt einer Kasse.

**Ohne Anmeldung kommt nichts hinein.** Klickt jemand ohne Konto auf einen
Kaufknopf, merkt sich die Seite das Paket, schickt ihn zu
`anmelden.html?grund=warenkorb&weiter=warenkorb.html` — und legt es nach der
Anmeldung selbst in den Warenkorb. Der gemerkte Wunsch verfällt nach einer
Stunde, damit er nicht Tage später überraschend auftaucht.

Das gilt auch im Übergangsbetrieb, in dem früher ohne Konto über paypal.me
bezahlt werden konnte: Die Lizenz gehört auf ein Konto, sonst gibt es hinterher
keinen Ort für sie.

Der Warenkorb liegt im `localStorage` des Browsers, nicht in der Datenbank: Er
ist noch keine Bestellung und gilt nur auf diesem Gerät. **Beim Abmelden wird
er geleert** — er gehört zum Konto, und am nächsten Nutzer desselben Rechners
geht die Auswahl des vorigen nichts an. Zwei Laufzeiten derselben App schließen
sich aus: Eine neue ersetzt die vorige, sonst lägen zwei Lizenzen für denselben
PC darin.

**Rabattcodes stehen an zwei Stellen, und beide müssen zusammenpassen:**

| Stelle | Rolle |
|---|---|
| `konfig.js` → `rabattCodes` | Anzeige im Warenkorb |
| `backend/supabase/functions/paypal-create-order/index.ts` → `RABATTE` | verbindliche Rechnung |

Eingerichtet ist **`Tyler10` mit 10 %** (Groß- und Kleinschreibung egal).

Einen neuen Code trägst du an beiden Stellen ein und stellst die Function neu
bereit:

```bash
supabase functions deploy paypal-create-order
```

Vergisst du das, passiert nichts Schlimmes: Die Kasse vergleicht den Betrag vom
Server mit dem angezeigten und bricht bei einer Abweichung ab — der Kunde
bezahlt nie mehr, als im Warenkorb stand.

Im Übergangsbetrieb (siehe unten) steht der Rabatt bereits im
paypal.me-Betrag. Dort bestimmt der Browser die Summe; die Gegenprobe ist der
Blick auf den Zahlungseingang, bevor du den Schlüssel von Hand herausgibst.

## Zwei Kaufwege — die Seite wählt selbst

Die Preisseite prüft beim Laden, ob der automatische Shop bereitsteht. Dafür
müssen **beide** Bedingungen erfüllt sein:

1. `paypalClientId` in `konfig.js` ist gesetzt
2. die Tabelle `products` in Supabase ist erreichbar

| Zustand | Was der Kunde sieht |
|---|---|
| beides erfüllt | Warenkorb → `kaufen.html`, Schlüssel entsteht automatisch |
| noch nicht | Warenkorb → `paypal.me` mit der Gesamtsumme, Schlüssel per Discord |

Der Knopf auf der Preiskarte ist in beiden Fällen derselbe („In den
Warenkorb“). Es unterscheidet sich nur, wohin der Kaufknopf **im Warenkorb**
führt.

**Aktuell greift der zweite Fall**, weil `paypalClientId` in `konfig.js` leer
ist. Der gesamte serverseitig abgesicherte Weg ist fertig gebaut, aber
abgeschaltet.

Im zweiten Fall blendet die Seite zusätzlich einen Hinweis über den Preisen ein
und schreibt den Kaufablauf (Schritt 1, 3 und 4) auf den manuellen Weg um —
sonst würde sie sich selbst widersprechen.

Du musst dafür nichts umstellen. Sobald du die Einrichtung abschließt,
verschwindet der Rückfall von allein. Willst du ihn gar nicht, setze `paypalMe`
in `konfig.js` auf einen leeren Text — dann steht dort ehrlich „gerade nicht
möglich“ statt eines Knopfs ins Leere.

## Wie der Kauf abläuft (nach der Einrichtung)

```
Kunde registriert sich          -> Supabase Auth, Bestätigungsmail
Kunde bestätigt die E-Mail      -> echter Link mit einmaligem Token
Kunde legt ein Paket hinein     -> warenkorb.html, dort auch der Rabattcode
Kunde geht zur Kasse            -> kaufen.html
Kunde zahlt mit PayPal          -> Edge Function legt die Bestellung mit dem
                                   Preis aus der Datenbank an
PayPal bestätigt die Zahlung    -> Edge Function bucht ab und prüft den Betrag
Backend erzeugt den Schlüssel   -> TWKX-XXXX-XXXX-XXXX, garantiert einmalig
Lizenz landet im Kundenkonto    -> sofort sichtbar unter "Meine Lizenzen"
Kunde lädt die App herunter     -> signierter Link, 2 Minuten gültig
Kunde gibt den Schlüssel ein    -> Tyler.exe prüft ihn gegen Supabase
```

Der Kunde muss nichts anfordern und niemanden anschreiben.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Startseite: Hero, App, Optimierung, Preise, Ablauf, Sicherheit, FAQ |
| `tweaks.html` | Alle Optimierungen im Einzelnen — durchsuchbar, filterbar, ohne Anmeldung |
| `registrieren.html` | Konto anlegen |
| `anmelden.html` | Login |
| `passwort-vergessen.html` | Link zum Zurücksetzen anfordern |
| `passwort-neu.html` | Neues Passwort setzen (Ziel des Links aus der Mail) |
| `warenkorb.html` | Warenkorb: Auswahl, Rabattcode, Weg zur Bezahlung |
| `kaufen.html` | Kaufabschluss mit PayPal |
| `konto.html` | Kundenbereich: Übersicht, Bestellungen, Produkte, Lizenzen, Downloads, Kontodaten |
| `admin.html` | Verwaltung — nur für Konten mit `is_admin` |
| `konfig.js` | **Zentrale Einstellungen.** Nur öffentlich unbedenkliche Werte. |
| `tt-backend.js` | Supabase-Verbindung, Anmeldestatus, Fehlertexte, Formatierung |
| `warenkorb.js` | Der Warenkorb selbst: Inhalt, Rabattrechnung, Knopf in der Navigation. Liegt auf **jeder** Seite. |
| `warenkorb-seite.js` | Nur `warenkorb.html`: Liste, Code-Eingabe, Kaufknopf |
| `auth.js` | Registrierung, Login, Passwort |
| `kaufen.js` | PayPal-Buttons, ruft die Edge Functions auf |
| `konto.js` | Kundenbereich |
| `admin.js` | Verwaltung |
| `script.js` | Startseite: Navigation, FAQ, App-Ansichten, Laufzeit-Auswahl |
| `tweaks.json` | **Erzeugt, nicht von Hand gepflegt.** Der Tweak-Katalog aus der App. |
| `tweaks.js` | Lädt den Katalog, baut eine Zeile, setzt alle Zahlen ins HTML, treibt die Vorführung auf der Startseite |
| `katalog.js` | Nur `tweaks.html`: Suche, Filter, Sprungmarken |
| `style.css` | Design-System der gesamten Seite |
| `tweak-zeile.css` | Aufbau einer Katalogzeile — geteilt von `tweaks.html` und der Vorführung |
| `katalog.css` | Nur `tweaks.html`: Kopf, Filterleiste, Liste |
| `mockup.css` | Gezeichnete Illustrationen im Kaufablauf, dazu der App-förmige Kasten auf der Startseite |
| `bilder/app-*.png` | Bildschirmfotos der App für die Produktvorstellung |
| `robots.txt` | Hält Kundenbereich, Kasse und Verwaltung aus den Suchergebnissen |
| `sitemap.xml` | Die öffentlichen Seiten für Suchmaschinen |

Im Normalbetrieb fasst du hier **gar nichts** an. Preise änderst du in Supabase
unter **Table Editor → products**, neue Versionen über die Tabelle
`app_release`.

### tweaks.json nicht von Hand ändern

Die Datei wird beim Veröffentlichen aus dem Tweak-Katalog der App erzeugt
(`installer/release-fertigstellen.ps1` ruft dafür `KatalogExport` auf). Eine
Änderung hier hält bis zur nächsten Veröffentlichung und ist danach weg.

Dasselbe gilt für jede Zahl, die aus ihr kommt. Im HTML steht dafür ein leeres
Element mit `data`-Attribut:

| Attribut | Was hineinkommt |
|---|---|
| `data-tweak-anzahl` | Anzahl der Optimierungen (129) |
| `data-bereich-anzahl` / `data-bereich-wort` | Anzahl der Bereiche als Ziffer bzw. Wort (11 / elf) |
| `data-neustart-anzahl` | Wie viele einen Neustart brauchen |
| `data-risiko-anzahl="Safe\|Caution\|Advanced"` | Anzahl je Einstufung |
| `data-bereich-liste` | Die Bereiche als Aufzählung im Fließtext |
| `data-bereich-raster` | Container für die Kacheln im Abschnitt „Umfang" |

Hintergrund: Diese Zahlen standen bis 2.7.0 als Ziffern im Quelltext. Nach
Version 2.6.0 sagte die Seite an zwei Stellen weiterhin „über 80 Tweaks",
während der Katalog 129 hatte — das Skript, das die Zahl beim Veröffentlichen
nachzog, suchte nach einer bestimmten Wortfolge und traf diese beiden Sätze
nicht. Jetzt kann es dort keine Ziffer mehr geben, die veraltet.

Zwei Stellen gehen weiterhin über das Skript: die `<meta name="description">`
und die strukturierten Daten (schema.org). Beide werden nicht angezeigt,
sondern gelesen — teils ohne Javascript.

## Sicherheit

**In diesem Repository darf nichts Geheimes stehen.** Es ist öffentlich.

Unbedenklich und deshalb in `konfig.js`:

- Supabase Project URL und der **anon**-Key — beide sind dafür gemacht, im
  Browser zu stehen. Die Zugriffsrechte liegen in der Datenbank (Row Level
  Security), nicht im Schlüssel.
- Die PayPal **Client ID**.

Gehört ausschließlich in die Supabase-Secrets:

- PayPal **Secret** und **Webhook ID**
- der **service_role**-Key
- die Cloudflare-R2-Zugangsdaten

Was daraus folgt:

- Passwörter liegen gehasht bei Supabase Auth und sind für niemanden lesbar.
- Ein Kunde sieht ausschließlich seine eigenen Bestellungen und Lizenzen — das
  setzt die Datenbank durch, nicht der Browser.
- Der Zahlungsstatus kommt von PayPal, serverseitig geprüft. Er lässt sich im
  Browser nicht setzen.
- Der Download braucht eine gültige Lizenz und läuft über einen Link, der nach
  zwei Minuten verfällt.
- Der Admin-Bereich ist nicht nur ausgeblendet: ohne `is_admin` gibt die
  Datenbank keine fremden Zeilen heraus.

### Sicherheitsrichtlinie im Browser (CSP)

Jede Seite trägt im `<head>` eine Content Security Policy. Sie legt fest, von wo
der Browser überhaupt etwas laden darf: eigene Dateien, PayPal für die Kasse,
Supabase für Konto und Daten — sonst nichts. Eingeschleuster Fremdcode läuft
damit nicht.

Zwei Dinge musst du dabei wissen:

1. **Schreib keine Skripte direkt ins HTML.** `script-src` kommt bewusst ohne
   `'unsafe-inline'` aus, weil im ganzen Projekt kein `<script>` mit Code im
   HTML steht. Ein inline geschriebenes Skript würde ab sofort stillschweigend
   nicht mehr ausgeführt.
2. **Die Supabase-Adresse steht doppelt**: in `konfig.js` und in der CSP jeder
   HTML-Seite. Wechselst du das Supabase-Projekt, musst du sie an beiden Stellen
   ändern — sonst blockiert der Browser die Verbindung.

### Was die CSP nicht leistet

Die Sitzungsdaten von supabase-js liegen wie üblich im `localStorage` des
Browsers. Die CSP macht es deutlich schwerer, dort heranzukommen, aber sie ist
kein Ersatz dafür, keine fremden Skripte einzubinden.

Als Meta-Tag lässt sich außerdem `frame-ancestors` nicht setzen — das ginge nur
über einen echten HTTP-Header, den GitHub Pages nicht anbietet.

## Lokal ansehen

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/server.ps1 -Port 5173
```

Danach http://localhost:5173 aufrufen. Ein Doppelklick auf `index.html` reicht
nicht mehr — die Seite lädt Skripte und spricht mit Supabase, beides braucht
eine echte Adresse.

Damit Anmeldung und Mail-Links lokal funktionieren, muss
`http://localhost:5173/**` in Supabase unter
**Authentication → URL Configuration → Redirect URLs** stehen.

## Keine fremden Server

Alles, was die Seite zum Anzeigen und Funktionieren braucht, liegt im Projekt:

| Ordner | Inhalt | Lizenz |
|---|---|---|
| `fonts/` | Inter und Space Grotesk als Variable Fonts | SIL OFL 1.1 |
| `js/` | supabase-js (Anmeldung, Datenbank, Edge Functions) | MIT |

Beim Aufruf der Seite geht dadurch **keine einzige Anfrage an einen Dritten** —
weder an Google Fonts noch an ein Auslieferungsnetz. Die einzige Verbindung
nach außen ist die zu deinem eigenen Supabase-Projekt, und die ist der Zweck
der Sache.

Herkunft, Lizenz und die Anleitung zum Aktualisieren stehen jeweils in
`LIESMICH.txt` im betreffenden Ordner. Die Versionsnummer der Bibliothek steht
absichtlich im Dateinamen, damit beim Wechsel kein Browser eine alte Fassung
aus dem Zwischenspeicher verwendet.

## Rechtliches

Die vier Seiten sind auf **österreichisches Recht** ausgelegt. Wenn du das
Angebot einmal von Deutschland aus betreibst, müssen sie neu geschrieben
werden — die Paragrafen stimmen dann alle nicht mehr.

| Seite | Inhalt | Rechtsgrundlage |
|---|---|---|
| `impressum.html` | Anbieterkennzeichnung | § 5 ECG, § 63 GewO, § 25 MedienG |
| `datenschutz.html` | Information nach Art 13 DSGVO | DSGVO, DSG, § 165 TKG 2021 |
| `agb.html` | Allgemeine Geschäftsbedingungen | ABGB, KSchG, VGG |
| `widerruf.html` | Rücktrittsbelehrung mit Muster-Formular | FAGG |

Auf der Kaufseite muss der Kunde AGB und Rücktrittsbelehrung **aktiv per
Haken bestätigen** — vorher bleiben die PayPal-Knöpfe abgeschaltet. Bei
Softwarelizenzen enthält der Text zusätzlich das ausdrückliche Verlangen nach
sofortigem Beginn und die Kenntnisnahme des Rechtsverlusts. Beides zusammen
verlangt § 18 Abs 1 Z 11 FAGG; fehlt eines davon, bleibt das Rücktrittsrecht
bestehen. Bei der PC-Optimierung wird dieser Zusatz automatisch ausgeblendet,
weil dort § 18 Abs 1 Z 1 FAGG greift.

**Noch einzutragen** (alle Seiten tragen dazu eine gelbe Warnbox):

- Name bzw. Firmenwortlaut und ladungsfähige Anschrift
- E-Mail-Adresse — nach § 5 ECG zwingend, Discord genügt nicht
- Gewerbeberechtigung, GISA-Zahl, Gewerbebehörde und WKO-Fachgruppe
- UID-Nummer (ATU…) **oder** der Kleinunternehmer-Satz nach § 6 Abs 1 Z 27 UStG
- Firmenbuchnummer, falls eingetragen — sonst den Abschnitt streichen

Danach die Warnboxen entfernen (`<div class="platzhalter-warnung">`).

## Setup-Datei

`downloads/TylerTweaksSetup-2.5.0.exe` (59,4 MB) liegt im Repository und wird
von GitHub Pages ausgeliefert. Supabase Storage schied aus: 50 MB Grenze im
kostenlosen Tarif.

Es liegt immer **genau eine** Setup-Datei in `downloads/`. Das Release-Skript
entfernt die vorherige beim Kopieren — sonst weiß bald niemand mehr, welche
die aktuelle ist, und das Repository wächst mit jeder Veröffentlichung um
weitere 60 MB.

**Die Adresse der Datei ist damit öffentlich.** Das ist eine bewusste
Abwägung — der eigentliche Schutz ist der Lizenzschlüssel, ohne den die App
nicht startet. Der Kundenbereich zeigt den Knopf weiterhin nur Kunden mit
gültiger Lizenz.

Der Kundenbereich holt den Download in zwei Stufen:

1. Edge Function `download` → geschützter Link, zwei Minuten gültig
2. fällt sie mit `no_release` aus → die Datei aus `konfig.js`

Richtest du später Cloudflare R2 ein und trägst `app_release.storage_path`
ein, greift automatisch wieder Stufe 1 — dann kann die Datei aus dem
Repository verschwinden.

**Neue Version veröffentlichen:** nicht mehr von Hand. Im App-Projekt:

```powershell
powershell -File "E:\Tweak app\installer\release-fertigstellen.ps1" -Version 2.5.1 -Changelog "Was sich geändert hat."
```

Das Skript prüft die gebaute Datei, kopiert sie hierher, berechnet Größe und
Prüfsumme, trägt beides samt Version und Datum in `konfig.js` ein, ergänzt den
Changelog und legt das passende SQL für `app_release` ab. Danach nur noch
committen, pushen und das SQL in Supabase ausführen — in dieser Reihenfolge.

Warum nicht von Hand: Genau dieser Handbetrieb hat dazu geführt, dass
monatelang die portable `Tyler.exe` (Version 1.3.0) unter dem Namen
`TylerTweaks-Setup-2.4.0.exe` ausgeliefert wurde. Die Datei ließ sich starten,
installierte aber nichts. Das Skript prüft deshalb vor dem Kopieren, ob die
Datei wirklich ein Inno-Setup-Installer mit der erwarteten Version ist.

Die Prüfsumme einer Datei bekommst du weiterhin mit:

```powershell
Get-FileHash "downloads\TylerTweaksSetup-2.5.0.exe" -Algorithm SHA256
```

**Bildschirmfotos der App erneuern:** In `bilder/` liegen echte Aufnahmen aus
der App, kein Nachbau. Sieht die App nach einem Release anders aus, gehören sie
ausgetauscht — sonst zeigt die Startseite eine Fassung, die es nicht mehr gibt.

Die App verlangt Administratorrechte, eine Aufnahme ist deshalb nicht einfach
per Skript zu machen. Dafür liegt im App-Projekt `TweakApp/app.preview.manifest`:
dieselbe App, aber als `asInvoker`, also ohne UAC-Abfrage.

```powershell
& "$env:USERPROFILE\.dotnet\dotnet.exe" build "E:\Tweak app\TweakApp\TweakApp.csproj" -c Debug -p:ApplicationManifest=app.preview.manifest -o "$env:TEMP\tyler-preview"
```

Danach `Tyler.exe` aus diesem Ordner starten, das Fenster aufnehmen und in
`bilder/` ablegen. Zwei Regeln dabei:

* **Nicht alles zeigen.** `app-uebersicht.png` nennt keinen einzigen Tweak,
  `app-tweaks.png` ist nach dem dritten Eintrag abgeschnitten und unten
  ausgeblendet. Der Umfang gehört auf die Seite, die Liste in die App.
* **Nichts Persönliches.** Die Seiten *Clean* und *Verlauf* zeigen echte
  Autostart-Pfade und fehlgeschlagene Änderungen. Beide bleiben draußen.

## Offen

Die Rechtstexte sind Vorlagen nach üblichem Aufbau, **keine anwaltliche
Prüfung**. Was noch einzutragen ist, steht oben unter „Rechtliches“.

Die Wirtschaftskammer prüft Impressum und AGB für Mitglieder kostenlos. Wer
gewerblich verkauft, ist automatisch Mitglied — dieser Termin lohnt sich vor
dem ersten echten Verkauf.

Ebenfalls offen:

- `backend/05-preise-2026.sql` in Supabase ausführen (die Datenbank führt noch
  die alten Preise)
- PayPal live schalten — siehe `EINRICHTUNG.md`
- kein Vorschaubild für geteilte Links (`og:image`), siehe Kommentar im
  `<head>` von `index.html`

## Kontakt

- Discord: `tyler061312`
