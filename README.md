# ⚡ Catalisator Engine

Catalisator ist ein leistungsstarkes CLI-Tool zur automatisierten Migration und Extraktion von CSS-Klassen (z. B. Tailwind) in zentrale Stylesheets. Entwickelt für saubere, skalierbare Architekturen in modernen Frameworks wie Next.js.

## 📦 Installation

Installiere das Tool als Entwicklungsabhängigkeit in deinem Projekt:

```bash
npm install -D catalisator
```

## 🚀 Nutzung

Führe das Tool in deinem Projektverzeichnis aus:

```bash
npx catalisator
```

Um einen Testlauf zu starten, ohne Dateien zu verändern (Dry Run):

```bash
npx catalisator --dry
```

## ⚙️ Konfiguration

Erstelle optional eine \`catalisator.config.json\` im Hauptverzeichnis deines Projekts, um das Verhalten anzupassen:

```json
{
	"frontend": "next.js",
	"prefix": "ka",
	"stylesheet": "scss",
	"autoFormat": true,
	"whitelist": ["container"]
}
```

## 🧰 Utils-Bibliothek

Zusätzlich zur Migration bringt Catalisator eine kleine, mitgelieferte Bibliothek fertiger CSS-Utility-Module (`container`, `flex`, `grid`, `row`, `display`) mit — komplett unabhängig vom Migrations-Workflow. Alle Klassen verwenden den festen Prefix `u-` (z. B. `.u-flex`, `.u-container`). Du bekommst sie in **drei Formaten**, je nachdem, was dein Projekt-Toolchain am besten passt — such dir eins aus, kein Generierungsschritt nötig:

| Format | Für Projekte mit... | Enthält |
|---|---|---|
| `postcss/` | eigenem PostCSS-Build | Die Quelle selbst (`$variablen`, `@mixin`/`@include`/`@if`) — direkt importierbar/kopierbar, wenn dein Build dieselben Plugins hat (siehe unten) |
| `css/` | plain CSS, kein Preprocessor | Fertige, kompilierte Utility-Klassen, keine Mixins (CSS kennt keine parametrisierten Mixins) |
| `scss/` | Sass/SCSS | Fertige Utility-Klassen **und** die rohen Mixins selbst (`@include media-breakpoint-up(...)`, `@include font-size(...)` etc.) zum eigenen Gebrauch mit eigenen Werten |

**Plain CSS:**
```css
/* globals.css */
@import 'catalisator/css/variables.css'; /* optional, aber empfohlen — siehe unten */
@import 'catalisator/css/utils/container.css';
@import 'catalisator/css/utils/flex.css';
```

**Sass — fertige Klassen:**
```scss
@use 'catalisator/scss/utils/container';
@use 'catalisator/scss/utils/flex';
```

**Sass — eigene Mixins verwenden:**
```scss
@use 'catalisator/scss/mixins/breakpoints' as *;
@use 'catalisator/scss/mixins/shortcuts' as *;

.my-hero {
	@include media-breakpoint-up(lg) {
		display: flex;
	}
	@include font-size(32);
}
```

```jsx
<div className="u-container u-flex u-items-center">...</div>
```

Solange du `catalisator` als Dependency installiert hast, funktionieren diese Imports. Entfernst du das Package, musst du die entsprechenden `@import`/`@use`-Zeilen ebenfalls entfernen.

### Nur genutzte Klassen generieren

Die drei Formate oben liefern die **komplette** Bibliothek (alle Klassen, auch ungenutzte). Willst du stattdessen — wie bei Tailwind — nur die CSS für tatsächlich verwendete Klassen, aber als **statische, eigenständige Datei** (kein laufender Build nötig, `catalisator` danach entfernbar):

```bash
npx catalisator utils [dir]     # scannt [dir] (Default: ./src) nach genutzten u-*-Klassen
npx catalisator utils --dry     # Testlauf, schreibt keine Datei
npx catalisator utils --watch   # bleibt aktiv, regeneriert bei jeder Markup-Änderung automatisch (Strg+C zum Beenden)
```

Der Scan durchsucht `.tsx`/`.jsx`/`.js`/`.vue`/`.html`-Dateien nach `class="..."`/`className="..."` und gleicht die gefundenen Klassennamen gegen die eigene `css/utils/`-Bibliothek ab. Nur die tatsächlich genutzten Klassen (inklusive aller ihrer responsiven `@media`-Varianten) landen in einer einzigen generierten Datei, die du wie gewohnt manuell importierst. Scan- und Ausgabeordner sind über `catalisator.config.json` konfigurierbar (ein `[dir]`-Argument auf der Kommandozeile überschreibt `utilsScanDir`):

```json
{
	"stylesheet": "scss",
	"utilsScanDir": "./src",
	"utilsOutputBase": "./src/styles",
	"utilsOutputName": "utils.generated"
}
```

`stylesheet` (bereits von `migrate` bekannt) entscheidet auch hier über `.css` vs. `.scss` — der Dateiinhalt ist identisch, nur die Endung unterscheidet sich. Das generierte File ist komplett statisch: entfernst du `catalisator` später, bleibt es unverändert funktionsfähig.

### Design-Tokens (`css/variables.css`)

Enthält eine gemeinsame Spacing-Skala als CSS Custom Properties, die `container`/`grid`/`flex` intern nutzen (z. B. `gap`, `padding`):

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

Der Import ist optional — jedes Utility-Modul hat einen Fallback-Wert (`var(--u-space-md, 1rem)`), funktioniert also auch ohne `variables.css`. Importierst du sie aber, kannst du die Werte projektweit überschreiben, indem du `:root` nach dem Import erneut definierst.

**Wichtig zu den Breakpoint-Variablen:** CSS Custom Properties funktionieren nicht innerhalb von `@media`-Bedingungen (`@media (min-width: var(--u-breakpoint-md))` ist ungültig — kein Browser unterstützt das). Die `@media`-Regeln in `container.css` sind deshalb weiterhin mit den literalen `em`-Werten codiert; `--u-breakpoint-*` dient nur als Referenz, z. B. um dieselben Werte in JavaScript zu lesen (`getComputedStyle(document.documentElement).getPropertyValue('--u-breakpoint-md')`) und mit `window.matchMedia` synchron zu halten, oder für `calc()`/`clamp()` innerhalb eines Regel-Bodies.

## 🛠️ Entwicklung: Utils-Module bauen

`postcss/` ist die **einzige Quelle der Wahrheit** für jedes Mixin und jede Utility-Klasse. Daraus werden zwei fertige, konsumierbare Formate abgeleitet:

- **`css/`** — automatisch aus `postcss/` gebaut, per `npm run build:css` (nur PostCSS-Konsumenten-Formate, keine Mixins möglich).
- **`scss/`** — von Hand parallel als echtes Sass gepflegt (nutzt native Sass-Arithmetik statt des `stripUnit()`/`calc()`-Tricks, den PostCSS mangels eigener Arithmetik braucht). Bei Änderungen an `postcss/` musst du `scss/` manuell nachziehen.

```bash
npm run build:css       # einmaliger Build
npm run dev:css         # Watch-Modus — baut bei jeder Änderung in postcss/utils/**/*.css automatisch neu
```

`scss/` wird davon **nicht** erfasst (siehe oben — separate, von Hand gepflegte Quelle) und muss weiterhin manuell nachgezogen werden.

Toolchain (`postcss/postcss.config.js`): `postcss-import` (löst `@import` von Partials auf), `postcss-advanced-variables` (`$variablen`, `@mixin`/`@include`/`@content`, `@if`/`@else`), `postcss-functions` (eigene `stripUnit()`-Funktion), `postcss-calc` (löst verschachtelte `calc()`-Ausdrücke mit literalen Zahlen zu einem Wert auf), `postcss-nested`.

Wiederverwendbare Bausteine liegen in `postcss/` (werden per `@import` in echte Utils-Module unter `postcss/utils/` eingebunden, sind selbst kein Build-Ziel):

- `variables.css` — `$space-xs/sm/md/lg/xl/2xl` (0.25/0.5/1/1.5/2/3rem, mirrors `css/variables.css`'s `--u-space-*`) und `$breakpoint-sm/md/lg/xl/2xl` (40/48/64/80/96em, mirrors `--u-breakpoint-*`)
- `mixins/breakpoints.css` — `@mixin media-breakpoint-up($breakpoint)` / `media-breakpoint-down($breakpoint)`
- `mixins/rfs.css`, `mixins/shortcuts.css` — fluid/scaled-size mixins, aktuell in Überarbeitung (RFS wird auf einen expliziten `fluid`-Ansatz umgebaut)

Beispiel (`postcss/utils/container.css`):

```css
@import '../variables.css';
@import '../mixins/breakpoints.css';

@include media-breakpoint-up(md) {
	.u-container { max-width: $breakpoint-md; }
}
```

**Jede** Datei in `postcss/utils/` — auch die ohne Mixins wie `flex.css`/`grid.css` — hat ein Pendant in `css/utils/`; es gibt keine Ausnahmen mehr, `postcss/utils/` ist unbedingt die Quelle für `css/utils/`.

Konsumenten von `catalisator` sehen davon nichts — sie importieren immer nur die fertig kompilierten Dateien aus `css/` oder `scss/`. Details und Konventionen: `.claude/skills/add-utils-module`.

**Wichtige Einschränkung:** `@include`-Aufrufe von `media-breakpoint-up`/`-down` in `postcss/` **müssen** in `@if`/`@else`-Form implementiert sein (wie in `mixins/breakpoints.css`), nicht mit verschachtelter Variablen-Interpolation à la `$(breakpoint-$(breakpoint))` — letztere hat sich als unzuverlässig erwiesen (funktioniert nur, wenn der `@include`-Aufruf in einen Selektor verschachtelt ist, nicht auf oberster Ebene einer Datei, wie es `container.css` braucht). In `scss/` ist das kein Problem — echtes Sass unterstützt `@else if`-Ketten zuverlässig nativ.
