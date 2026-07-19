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
