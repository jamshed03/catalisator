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

Zusätzlich zur Migration bringt Catalisator eine kleine, mitgelieferte Bibliothek fertiger CSS-Utility-Module (`container`, `flex`, `grid`) mit — komplett unabhängig vom Migrations-Workflow. Alle Klassen verwenden den festen Prefix `u-` (z. B. `.u-flex`, `.u-container`).

Du importierst sie direkt aus `node_modules`, genau wie bei Bootstrap oder anderen CSS-Bibliotheken — kein Generierungsschritt nötig:

```css
/* globals.css */
@import 'catalisator/css/utils/container.css';
@import 'catalisator/css/utils/flex.css';
```

```scss
// globals.scss
@use 'catalisator/css/utils/container';
@use 'catalisator/css/utils/flex';
```

```jsx
<div className="u-container u-flex u-items-center">...</div>
```

Solange du `catalisator` als Dependency installiert hast, funktionieren diese Imports. Entfernst du das Package, musst du die entsprechenden `@import`/`@use`-Zeilen ebenfalls entfernen.
