# Catalisator Utils — Klassen-Referenz (für Agents)

> Diese Datei ist für KI-Agents gedacht, die in einem **Konsumenten-Projekt** Markup schreiben.
> Pfad im Zielprojekt: `node_modules/catalisator/docs/agents/utils.md`.
> **Diese Datei ist self-contained**: Klassenreferenz _und_ das Kommando zum Neugenerieren
> (`npx catalisator utils`). Für Markup-Arbeit brauchst du keine weitere Doku.
> Nur für das einmalige Migrations-Setup (`npx catalisator` / `mixins`):
> `node_modules/catalisator/docs/agents/migrate.md`.

Die Utils-Bibliothek ist **unabhängig vom Migrations-Workflow**. Alle Klassen tragen den festen
Prefix `u-` (nicht konfigurierbar, nicht mit dem `prefix`-Key aus `catalisator.config.json`
zu verwechseln — der gilt nur für `migrate`).

Es sind bewusst **wenige, vorhersehbare** Klassen: Layout (Container, Grid, Flex, Display).
Es gibt **keine** Utilities für Farben, Typografie, Border, Shadow, Spacing-Klassen (`p-4`,
`m-2`) o. Ä. — dafür schreibst du normales CSS/SCSS in eine eigene Klasse.

## Breakpoints

Mobile-first, alle `min-width`, Einheit `em`:

| Kürzel | Wert   | ≈ px |
| ------ | ------ | ---- |
| `sm`   | `40em` | 640  |
| `md`   | `48em` | 768  |
| `lg`   | `64em` | 1024 |
| `xl`   | `80em` | 1280 |
| `2xl`  | `96em` | 1536 |

Responsive Varianten haben die Form `u-<basis>-<bp>-<wert>`, z. B. `u-grid-cols-md-2`,
`u-col-lg-4`, `u-d-sm-flex`. Die Basis-Klasse ohne Breakpoint gilt ab 0px.

**Nicht jedes Modul hat responsive Varianten** — siehe Tabellen unten. Insbesondere `flex.css`
und die `gap`-Klassen haben **keine**.

## Einbinden

### Variante A — komplette Bibliothek direkt aus `node_modules`

Schnell, aber `catalisator` muss installiert bleiben.

```css
/* globals.css */
@import 'catalisator/css/variables.css'; /* optional, s.u. */
@import 'catalisator/css/utils/container.css';
@import 'catalisator/css/utils/grid.css';
```

```scss
// globals.scss
@use 'catalisator/scss/utils/container';
@use 'catalisator/scss/utils/grid';
```

Verfügbare Module: `container`, `grid`, `row`, `flex`, `display`.

### Variante B — nur genutzte Klassen, statisch generiert (empfohlen)

```bash
npx catalisator utils                # scannt ./src → ./src/styles/utils.generated.scss
npx catalisator utils ./app          # anderes Scan-Verzeichnis
npx catalisator utils --dry          # Trockenlauf, schreibt keine Datei
npx catalisator utils --watch        # bleibt aktiv, regeneriert bei jeder Markup-Änderung
```

Der Scan liest `.tsx`, `.jsx`, `.js`, `.vue`, `.html`, sammelt alle `class="…"` /
`className="…"`-Werte und schreibt genau die daraus bekannten `u-*`-Klassen in **eine** Datei —
inklusive aller ihrer responsiven `@media`-Varianten. Der Rest der Bibliothek entfällt.

Die Datei wird **nicht** automatisch eingebunden, das machst du einmalig selbst:

```scss
@use './styles/utils.generated';
```

Die Ausgabe ist komplett statisch — `catalisator` kann danach deinstalliert werden, die Datei
funktioniert unverändert weiter.

**Wichtig — der Scan ist regex-basiert, kein AST:** Klassennamen, die zur Laufzeit
zusammengebaut werden, findet er nicht.

```jsx
<div className={`u-col-span-${n}`}>   {/* ❌ wird NICHT gefunden */}
<div className={n === 2 ? 'u-col-span-2' : 'u-col-span-4'}>   {/* ✅ beide literal → gefunden */}
```

Konfigurierbar über `catalisator.config.json` im Projekt-Root (alle Felder optional):

```json
{
	"stylesheet": "scss",
	"utilsScanDir": "./src",
	"utilsOutputBase": "./src/styles",
	"utilsOutputName": "utils.generated"
}
```

| Key               | Default             | Bedeutung                                                     |
| ----------------- | ------------------- | ------------------------------------------------------------- |
| `stylesheet`      | `"scss"`            | `.scss` vs. `.css` — nur die Endung, der Inhalt ist identisch |
| `utilsScanDir`    | `"./src"`           | Scan-Verzeichnis; ein CLI-Argument `[dir]` hat Vorrang        |
| `utilsOutputBase` | `"./src/styles"`    | Zielordner der generierten Datei                              |
| `utilsOutputName` | `"utils.generated"` | Dateiname ohne Endung                                         |

Findet der Scan keine einzige Klasse, wird nichts geschrieben.

### Design-Tokens

`css/variables.css` definiert die Spacing-Skala, die `container`/`grid`/`row` intern nutzen:

```css
:root {
	--u-space-xs: 0.25rem;
	--u-space-sm: 0.5rem;
	--u-space-md: 1rem;
	--u-space-lg: 1.5rem;
	--u-space-xl: 2rem;
	--u-space-2xl: 3rem;

	--u-breakpoint-sm: 40em;
	--u-breakpoint-md: 48em;
	--u-breakpoint-lg: 64em;
	--u-breakpoint-xl: 80em;
	--u-breakpoint-2xl: 96em;
}
```

Der Import ist **optional** — jede Klasse hat einen Inline-Fallback
(`var(--u-space-md, 1rem)`). Wird er importiert, kann man die Werte projektweit überschreiben,
indem man `:root` danach erneut definiert.

`--u-breakpoint-*` funktioniert **nicht** in `@media`-Bedingungen (CSS erlaubt dort keine
Custom Properties) — die Media Queries sind mit literalen `em`-Werten codiert. Die Variablen
sind nur für JS (`matchMedia`-Sync) und `calc()`/`clamp()` innerhalb eines Regel-Bodies da.

---

## Modul: `grid` — CSS Grid

**Basis**

| Klasse                             | Wirkung                                            |
| ---------------------------------- | -------------------------------------------------- |
| `u-grid`                           | `display: grid`                                    |
| `u-grid-cols-1` … `u-grid-cols-12` | `grid-template-columns: repeat(N, minmax(0, 1fr))` |
| `u-col-span-1` … `u-col-span-12`   | `grid-column: span N`                              |
| `u-col-span-full`                  | `grid-column: 1 / -1`                              |
| `u-row-span-1` … `u-row-span-6`    | `grid-row: span N`                                 |
| `u-row-span-full`                  | `grid-row: 1 / -1`                                 |
| `u-place-items-center`             | `place-items: center`                              |

**Gaps** (kein Responsive)

| Klasse                                           | Wirkung                                 |
| ------------------------------------------------ | --------------------------------------- |
| `u-gap-0` / `u-gap-sm` / `u-gap-md` / `u-gap-lg` | `gap: 0` / `0.5rem` / `1rem` / `1.5rem` |
| `u-gap-x-0` / `-sm` / `-md` / `-lg`              | `column-gap`                            |
| `u-gap-y-0` / `-sm` / `-md` / `-lg`              | `row-gap`                               |

**Responsive Varianten** existieren für alle Breakpoints (`sm`/`md`/`lg`/`xl`/`2xl`) bei:

- `u-grid-cols-<bp>-1` … `-12`
- `u-col-span-<bp>-1` … `-12`, `u-col-span-<bp>-full`

**Nicht responsive:** `u-grid`, `u-row-span-*`, alle `u-gap-*`, `u-place-items-center`.
Brauchst du z. B. unterschiedliche Gaps pro Breakpoint, schreib das in eigenes CSS.

## Modul: `row` — 12-Spalten-Raster (Bootstrap-Stil)

`u-row` ist selbst schon ein Grid mit 12 Spalten und `gap: var(--u-space-md, 1rem)` — du
brauchst also **kein** zusätzliches `u-grid`/`u-grid-cols-12`.

| Klasse                                       | Wirkung                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `u-row`                                      | `display: grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: 1rem` |
| `u-col-1` … `u-col-12`                       | `grid-column: span N`                                                        |
| `u-col-<bp>-1` … `-12`                       | dasselbe ab Breakpoint (alle 5 Breakpoints vorhanden)                        |
| `u-col-start-1` … `-12`                      | `grid-column-start: N` — erzwingt die Startspalte                            |
| `u-col-start-<bp>-1` … `-12`                 | dasselbe ab Breakpoint                                                       |
| `u-col-start-auto` / `u-col-start-<bp>-auto` | hebt eine gesetzte Startspalte wieder auf                                    |

`u-row` + `u-col-*` und `u-grid` + `u-col-span-*` sind zwei Wege zum selben Ziel: `u-row` für
klassische 12er-Layouts, `u-grid-cols-N` wenn du die Spaltenzahl selbst bestimmen willst.
Nicht mischen innerhalb eines Containers.

### Lücken im Raster: `u-col-start-*`

`gap` ist in CSS Grid **uniform** — ein einzelner größerer Abstand lässt sich damit nicht
erzeugen. Der Weg dorthin ist eine leergelassene Rasterspalte, und dafür braucht das folgende
Element eine Startlinie. Die `u-col-*`-Klassen setzen nur eine Spannweite, Grid platziert also
lückenlos.

Beispiel: drei Elemente 5 + 3 + 3 (= 11 von 12), zusätzlicher Abstand zwischen dem zweiten und
dritten:

```jsx
<div className='u-row'>
	<div className='u-col-5'>1</div>
	<div className='u-col-3'>2</div>
	<div className='u-col-3 u-col-start-10'>3</div>
</div>
```

```
[ 1  2  3  4  5 ][ 6  7  8 ](  9 leer  )[ 10 11 12 ]
```

Der Abstand zwischen 2 und 3 beträgt damit eine Spaltenbreite plus zwei Gaps.

**Auch in `u-grid` verwendbar** — `grid-column-start` weiß nicht, in welchem Grid es steht.
Aber: Werte oberhalb der Spaltenzahl des Zielgrids (`u-col-start-10` in einem
`u-grid-cols-3`) erzeugen _implizite_ Spalten und zerlegen das Layout still. In `u-row` kann
das nicht passieren, dort sind es immer 12.

**Responsive:** Setz die Startspalte auf derselben Breakpoint-Ebene wie die Spannweite
(`u-col-md-3 u-col-start-md-10`) und benutz `u-col-start-md-auto`, um sie ab einem Breakpoint
wieder freizugeben. Eine Basis-Startspalte gilt ansonsten auf allen Breakpoints weiter.

## Modul: `container` — zentrierte Inhaltsbreite

| Klasse                                            | Wirkung                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `u-container`                                     | 100% Breite, zentriert, `padding-inline: var(--u-space-md, 1rem)`; `max-width` wächst stufenweise mit jedem Breakpoint (40 → 48 → 64 → 80 → 96em) |
| `u-container-sm` / `-md` / `-lg` / `-xl` / `-2xl` | fixe `max-width` (40/48/64/80/96em), unabhängig vom Viewport                                                                                      |
| `u-container-fluid`                               | `max-width: 100%`                                                                                                                                 |
| `u-container-no-padding`                          | `padding-inline: 0`                                                                                                                               |

Die Modifier setzen nur `max-width`/`padding` — sie werden **zusätzlich** zu `u-container`
gesetzt: `class="u-container u-container-lg"`.

## Modul: `flex` — Flexbox (kein Responsive)

| Klasse                                              | Wirkung                         |
| --------------------------------------------------- | ------------------------------- |
| `u-flex` / `u-inline-flex`                          | `display: flex` / `inline-flex` |
| `u-flex-row` / `u-flex-col`                         | `flex-direction`                |
| `u-flex-wrap` / `u-flex-nowrap`                     | `flex-wrap`                     |
| `u-items-start` / `u-items-center` / `u-items-end`  | `align-items`                   |
| `u-justify-start` / `-center` / `-end` / `-between` | `justify-content`               |
| `u-flex-1`                                          | `flex: 1 1 0%`                  |
| `u-flex-none`                                       | `flex: none`                    |

Keine `gap`-Klassen in diesem Modul — `u-gap-*` kommt aus `grid.css` und funktioniert auch in
Flex-Containern (Import von `grid` nötig).

## Modul: `display`

| Basis                                                                                                                   | Responsive                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `u-d-none`, `u-d-block`, `u-d-inline`, `u-d-inline-block`, `u-d-flex`, `u-d-inline-flex`, `u-d-grid`, `u-d-inline-grid` | jeweils `u-d-<bp>-<wert>` für alle 5 Breakpoints |

Typisches Muster (mobil ausblenden, ab `md` zeigen): `class="u-d-none u-d-md-block"`.

---

## Beispiel: responsives Teaser-Grid

Drei Teaser nebeneinander ab `md`, einer pro Zeile darunter:

```jsx
export default function TeaserSection() {
	return (
		<section className='u-container'>
			<div className='u-grid u-grid-cols-1 u-grid-cols-md-2 u-grid-cols-lg-3 u-gap-lg'>
				<article className='teaser'>
					<h3 className='teaser__title'>Erster Teaser</h3>
					<p className='teaser__text'>Kurzer Beschreibungstext.</p>
				</article>
				<article className='teaser'>
					<h3 className='teaser__title'>Zweiter Teaser</h3>
					<p className='teaser__text'>Kurzer Beschreibungstext.</p>
				</article>
				<article className='teaser'>
					<h3 className='teaser__title'>Dritter Teaser</h3>
					<p className='teaser__text'>Kurzer Beschreibungstext.</p>
				</article>
			</div>
		</section>
	)
}
```

Dasselbe mit dem 12er-Raster (`u-row`), z. B. ein großer Teaser + zwei kleine ab `lg`:

```jsx
<div className='u-row'>
	<article className='u-col-12 u-col-lg-6 teaser'>…</article>
	<article className='u-col-12 u-col-md-6 u-col-lg-3 teaser'>…</article>
	<article className='u-col-12 u-col-md-6 u-col-lg-3 teaser'>…</article>
</div>
```

Alles Nicht-Layout-Bezogene (Farben, Abstände innerhalb der Karte, Typo, Border) gehört in eine
eigene Klasse:

```scss
.teaser {
	padding: var(--u-space-lg, 1.5rem);
	border: 1px solid #e5e5e5;
	border-radius: 0.5rem;

	&__title {
		margin: 0 0 var(--u-space-sm, 0.5rem);
		font-size: 1.25rem;
	}

	&__text {
		margin: 0;
		color: #555;
	}
}
```

## Regeln für Agents

1. Nur Klassen aus den Tabellen oben verwenden — die Bibliothek ist klein, es gibt keine
   Tailwind-artigen Zusatzklassen. Im Zweifel prüfen:
   `node_modules/catalisator/css/utils/<modul>.css`.
2. Responsive Varianten nur dort verwenden, wo sie laut Tabelle existieren
   (`grid-cols`, `col-span`, `col`, `display`) — `u-gap-md-lg` o. Ä. gibt es **nicht**.
3. Klassennamen immer literal schreiben, nie zur Laufzeit zusammenbauen — sonst findet
   `npx catalisator utils` sie nicht.
4. Layout über `u-*`, alles andere über eigene, projekteigene Klassen.
5. Nach dem Hinzufügen neuer `u-*`-Klassen `npx catalisator utils` erneut ausführen (oder
   `--watch` laufen lassen), damit die generierte Datei aktuell ist.
