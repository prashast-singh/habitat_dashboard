# HABITAT Dashboard

Deutsch- und englischsprachige Expertenoberfläche für medizinisch gepflegte Umweltregeln. Sämtliche Authentifizierung, Persistenz, Veröffentlichung, Wetterabfragen und Regelauswertungen liegen im [Spring-Boot-Backend](https://github.com/prashast-singh/HabitatBackend#readme). Der Browser speichert keine Regeln dauerhaft und enthält keinen aktiven medizinischen Evaluator.

## Sprache / Language

Über **Sprache / Language → Deutsch / English** auf der Anmeldeseite und in der Seitenleiste lässt sich die Oberfläche jederzeit umschalten. Deutsch ist der Standard. Nur die Sprachpräferenz (`habitat-language`) wird in `localStorage` gespeichert; Regeln und Zugriffstoken werden dort nicht abgelegt. Bei deaktiviertem Browserspeicher funktioniert das Umschalten weiterhin für die aktuelle Seite.

Use **Language → English** on the login screen or sidebar. The selection persists across reloads. Switching languages preserves the session, unsaved rule inputs and simulation inputs. Interface labels, catalog labels, confirmations and client validation are translated. Authored rule names, descriptions, recommendations, sources, server-provided messages and raw API/JSON data remain in their original language; clinical content is never automatically translated. Backend identifiers, units, rule logic and stored payloads are unchanged.

## Funktionen und Zielgruppen

- Anmeldung mit einem verifizierten, aktivierten Konto und administrativ vergebener Editorberechtigung (`medical_editor=true`). Normale Patientenkonten erhalten keinen Dashboardzugriff.
- Regeln suchen, als Entwurf erstellen und bearbeiten, direkt veröffentlichen, archivieren und Historie einsehen.
- Empfehlungen und Quellen innerhalb einer Regel pflegen und aus vorhandenen Regeln übernehmen.
- Fünf Zielgruppen: Allgemein (`general`, alle Patienten), Pneumo (`lung`, ausschließlich Asthma), Kardio (`heart`, Herzinsuffizienz), GYN (`pregnancy`, Schwangerschaft), COPD (`copd`, eigenständig).
- Katalogparameter und Einheiten kommen vom Backend. Alter und Geschlecht sind zusätzliche Filter.
- Simulation veröffentlichter Regeln oder ausdrücklich ausgewählter Entwürfe über dieselbe Java-Engine wie Patientenwarnungen.

## Oberfläche / Layout

Das [IDM-Logo](public/assets/IDM_Logo_recreated.png) und das [Logo der Philipps-Universität Marburg](public/assets/Uni_Marburg_Logo.svg) erscheinen gemeinsam und dezent ohne zusätzliche Beschriftung unter dem Anmeldeformular und unten in der Dashboard-Seitenleiste oberhalb der Kontoeinstellungen; auf schmalen Bildschirmen stehen sie im unteren Navigationsbereich. Beide behalten ihren transparenten Hintergrund und ihre Proportionen; die HABITAT-Produktmarke bleibt erhalten.

Die responsive Oberfläche verwendet helle Karten, dunkelblaue Typografie und türkisfarbene Akzente. Auf kleinen Bildschirmen wird die Seitenleiste zur oberen Navigation und die Regelbibliothek zu gestapelten Karten. Der Editor trennt die Bearbeitung von der Übersicht und zeigt auf breiten Bildschirmen eine begleitende Vorschau. Technische JSON-Details bleiben über aufklappbare Bereiche zugänglich.

Simulation parameters are grouped by the backend catalog's provider-connection flag. Provider-connected values are not guaranteed to be available or current; manual-only values affect the test scenario, not patient data. The visual redesign does not change authentication, rule payloads, publication, or Java evaluation.

## Regeln und Veröffentlichung

Entwürfe werden in PostgreSQL gespeichert. Beim Bearbeiten bleibt eine frühere veröffentlichte Version aktiv, bis erneut veröffentlicht oder archiviert wird. Jeder medizinische Editor darf direkt veröffentlichen; Empfehlungen und Quellen müssen vor Veröffentlichung vollständig sein. Revisionskonflikte erfordern ein erneutes Laden des Serverstands.

Bedingungen innerhalb einer gespeicherten Regel sind UND-verknüpft. ODER-Ausdrücke werden beim Speichern in separate Entwürfe aufgeteilt; UND bindet stärker als ODER: `A ODER B UND C` wird zu `A` und `B UND C`. Bei Bearbeitung aktualisiert der erste Zweig die vorhandene Regel, weitere Zweige werden neu angelegt. Jeder Zweig muss separat veröffentlicht werden. Die Speicherung mehrerer Zweige ist nicht atomar; bei Teilfehlern vor Veröffentlichung Vollständigkeit und mögliche Duplikate prüfen.

Es gibt keine automatisch importierten oder veröffentlichten medizinischen Regeln, keine CSV-Startdaten, keine Session-Storage-Persistenz und keinen Mock-Fallback. Die historische CSV-Datei ist ausschließlich Referenzmaterial und wird nicht vom Dashboard geladen. Der frühere Frontend-Evaluator, die Wetter-/Mock-Helfer und der veraltete Azure-SQL-Entwurf wurden entfernt; die produktive Datenbank bleibt PostgreSQL.

## Simulation und Patientenwarnungen

Leere Messwerte bleiben unbekannt. Ergebnisse unterscheiden `MATCH`, `NO_MATCH`, `UNKNOWN` sowie `NO_RULES`, `NO_APPLICABLE_RULES`, `INCOMPLETE`, `COMPLETE`. Fehlende Daten oder fehlende Regeln bedeuten niemals Entwarnung. Die Oberfläche zeigt Abdeckung und Einzelbegründungen des Backends.

Der optionale Umweltimport lädt Rohwerte vom Java-Backend als editierbares Testszenario und zeigt die Quellzeitpunkte. Dabei findet **keine Aktualitätsprüfung im Dashboard** statt; Werte müssen vor Simulation geprüft werden. Patientenergebnisse werden ausschließlich über `GET /api/v1/warnings?lat=…&lon=…` erstellt. Dieser separate Pfad verwendet das authentifizierte Patientenprofil und serverseitige Aktualitätsprüfungen für aktuelle Werte und Vorhersagen.

AQI bezeichnet den OpenWeather-Index von 1 bis 5, nicht US-AQI. Pollenwerte sind Konzentrationen in grains/m³. Der aktuelle historische Druckabfall bleibt ohne beobachtete Vorgängermessung unbekannt. Push-Benachrichtigungen und periodische Auswertungen sind nicht implementiert.

## Voraussetzungen

- Node.js 22 LTS (mindestens 22.13; für aktuelle Linter mindestens 22.19 empfohlen) oder 24 LTS
- npm
- Laufendes Spring Boot mit PostgreSQL und Editor-Konto; Einrichtung siehe [Backend-README](https://github.com/prashast-singh/HabitatBackend#readme).

## Lokal starten

```bash
npm ci
npm run dev
```

Danach `http://localhost:5173/` öffnen. Standard-API: `http://localhost:8080`. Eine abweichende URL über `NEXT_PUBLIC_API_BASE_URL` vor Start/Build setzen (ohne `/api/v1`). Das Backend muss den exakten Dashboard-Origin in `APP_CORS_ALLOWED_ORIGINS` erlauben. In Produktion HTTPS verwenden; keine Backend- oder Provider-Schlüssel im Frontend hinterlegen.

Zugriffstoken bleiben ausschließlich im Arbeitsspeicher. Neuladen oder Ablauf der Sitzung erfordert eine erneute Anmeldung; es gibt keine automatische Token-Erneuerung.

Weitere Prüfungen:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Projektstruktur

| Pfad | Zweck |
| --- | --- |
| `app/page.tsx` | Einstieg in das Dashboard |
| `components/ExpertDashboard.tsx` | Anmeldung, Regelverwaltung, Historie und Simulation |
| `components/RuleEditor.tsx` | Backend-kataloggesteuertes Regelformular |
| `components/ui/` | Nur die vom Regeleditor verwendeten UI-Bausteine |
| `build/`, `scripts/`, `vite.config.ts` | Aktive Vinext-/Cloudflare-Build- und Startwerkzeuge |
| `lib/api.ts` | Spring-API-Client, DTOs und ODER-Transportnormalisierung |
| `lib/i18n.tsx`, `lib/language.ts` | Sprachumschaltung, gespeicherte Sprachpräferenz und reine Katalog-Anzeigetexte |
| `tests/api.test.mjs`, `tests/language.test.mjs` | Transport-, API-Client- und Sprachtests ohne medizinische Zweit-Engine |
| `public/assets/` | IDM- und Universitätslogo sowie Hintergrundbild |

## Zusammenarbeit

```bash
git clone https://github.com/prashast-singh/habitat_dashboard.git
cd habitat_dashboard
npm ci
git switch -c feature/meine-aenderung
npm run dev
```

Änderungen sollten in einem eigenen Branch erfolgen. Vor einem Pull Request bitte `npm run lint` und `npm run build` ausführen. Medizinische Inhalte und Schwellenwerte müssen fachlich geprüft und mit Quellen dokumentiert werden.

## Lizenz und interne Nutzung

Das Repository ist für die interne Zusammenarbeit des IDM-UKGM vorgesehen. Eine öffentliche Lizenz oder externe Veröffentlichung ist noch nicht festgelegt.
