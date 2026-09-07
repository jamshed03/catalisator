# Catalisator — Migration & Mixins (für Agents)

> Diese Datei ist für KI-Agents gedacht, die in einem **Konsumenten-Projekt** arbeiten, das
> `catalisator` als Dev-Dependency installiert hat. Pfad im Zielprojekt:
> `node_modules/catalisator/docs/agents/migrate.md`.
>
> **Diese Datei brauchst du nur für das einmalige Migrations-Setup** (Tailwind-Klassen aus dem
> Markup in zentrale Stylesheets ziehen) und für den Mixin-Export.
>
> Willst du nur **Markup mit `u-*`-Utility-Klassen schreiben** oder die generierte Utils-Datei
> aktualisieren, ist `node_modules/catalisator/docs/agents/utils.md` die richtige und
> vollständige Referenz — diese Datei hier wird dafür nicht gebraucht.

## Grundprinzip

Catalisator ist ein **Einweg-Werkzeug**. Alles, was es erzeugt, ist plain CSS/SCSS bzw.
geändertes Markup im Projekt selbst. Nach der Nutzung kann `catalisator` deinstalliert werden,
ohne dass etwas kaputtgeht.

**Einzige Ausnahme:** direkte Imports aus `node_modules/catalisator/css/` bzw. `/scss/`
(siehe `utils.md`, Abschnitt "Variante A"). Solange solche Imports existieren, muss das Package
installiert bleiben.

Regeln für Agents:

- Niemals `catalisator` als Runtime-Dependency einbauen, nie aus Projektcode importieren.
- Alle Kommandos zuerst mit `--dry` vorschlagen/ausführen, wenn unklar ist, was überschrieben wird.
- Keine der Kommandos brauchen Netzwerk oder einen laufenden Build.

## Kommandos

| Kommando | Zweck |
|---|---|
| `npx catalisator [dir] [--dry]` | **migrate** — zieht Tailwind-Klassen aus JSX/TSX in zentrale Stylesheets |
| `npx catalisator utils [dir] [--dry] [--watch]` | erzeugt eine statische Datei mit **nur den genutzten** `u-*`-Utility-Klassen — dokumentiert in `utils.md`, nicht hier |
| `npx catalisator mixins [--dry]` | kopiert die rohen Mixins (`media-breakpoint-up`, `font-size`, …) ins Projekt |

`--dry` = Trockenlauf: loggt alle geplanten Schreibvorgänge, fasst die Festplatte nicht an.
Gilt für alle drei Kommandos.

Die beiden unten dokumentierten Kommandos sind unabhängig voneinander — `migrate` (Tailwind →
eigene Klassen) und `mixins` (Sass-/PostCSS-Mixins exportieren) haben nichts miteinander zu tun.

---

### 1. `npx catalisator [dir] [--dry]` — migrate

Der Default (kein Subcommand). Sucht in `[dir]` (Default `./src`) nach `className`-Attributen,
die eine **Prefix-Klasse** (Default `ka-…`, konfigurierbar) *und* weitere, nicht gewhitelistete
Utility-Klassen enthalten. Diese Utility-Klassen werden über PostCSS/Tailwind zu echten
CSS-Deklarationen aufgelöst, in ein Stylesheet unter `outputBase/<kategorie>/` geschrieben und
aus dem Markup entfernt — übrig bleibt die Prefix-Klasse (plus Whitelist-Einträge).

Vorher:
```jsx
<section className="ka-hero flex items-center gap-4 px-6">…</section>
```
Nachher (Markup):
```jsx
<section className="ka-hero">…</section>
```
Nachher (generiertes SCSS):
```scss
.ka-hero {
	display: flex;
	align-items: center;
	gap: 1rem;
	padding-inline: 1.5rem;
}
```

Der `@use`/`@import` der generierten Datei wird idempotent an das globale Stylesheet
(`outputEntry`) angehängt.

Kategorien: Dateien werden anhand von Name/Pfad nach `layouts` / `pages` / `partials`
einsortiert; das steuert den Zielordner unterhalb von `outputBase`.

**Voraussetzung:** Das Zielprojekt braucht `tailwindcss` + `@tailwindcss/postcss`
(Peer-Dependencies), da jede Klasse einzeln durch PostCSS kompiliert wird.

Konfiguration (`catalisator.config.json` im Projekt-Root, alle Felder optional):

```json
{
	"frontend": "next.js",
	"source": "tailwind",
	"stylesheet": "scss",
	"prefix": "ka",
	"outputBase": "./src/styles",
	"outputEntry": "./src/app/globals.scss",
	"cssEntry": "./src/app/globals.css",
	"whitelist": ["container", "material-symbols-outlined"],
	"include": [],
	"autoFormat": false
}
```

| Key | Default | Bedeutung |
|---|---|---|
| `frontend` | `"next.js"` | Parser-Auswahl (`next.js` → React-Parser) |
| `source` | `"tailwind"` | Quell-CSS-Framework des Markups |
| `stylesheet` | `"scss"` | Ausgabeformat: `"scss"` oder `"css"` |
| `prefix` | `"ka"` | Klassen-Prefix, der die Migration auslöst und im Markup bleibt |
| `outputBase` | `"./src/styles"` | Wurzel für generierte Stylesheets |
| `outputEntry` | — | Globales Stylesheet, in das `@use`/`@import` eingetragen wird |
| `cssEntry` | — | Analog für `stylesheet: "css"` |
| `whitelist` | `["container", "material-symbols-outlined"]` | Klassen, die im Markup bleiben statt migriert zu werden |
| `include` | `[]` | Explizite Dateiliste statt Auto-Scan; Array von Pfaden **oder** Objekt `pfad → kategorie` bzw. `pfad → { category, name }` |
| `autoFormat` | `false` | Prettier über Markup + generiertes Stylesheet laufen lassen (Prettier-Config wird relativ zur jeweiligen Datei aufgelöst) |

`include` als Objekt-Form:

```json
{
	"include": {
		"./src/components/Header.tsx": "partials",
		"./src/app/login/page.tsx": { "category": "auth", "name": "login_custom" }
	}
}
```

---

### 2. `npx catalisator mixins [--dry]`

Kopiert die **rohen Mixins** (nicht die fertigen Klassen) ins Projekt, damit sie mit eigenen
Werten verwendet werden können. Es gibt hier nichts zu tree-shaken — Mixins werden mit
beliebigen Argumenten aufgerufen —, daher wird schlicht ein fester Dateisatz kopiert:

- `scss`-Format: `_variables.scss`, `mixins/_breakpoints.scss`, `mixins/_rfs.scss`, `mixins/_shortcuts.scss`
- `postcss`-Format: `variables.css`, `mixins/breakpoints.css`, `mixins/rfs.css`, `mixins/shortcuts.css`

Die relative Ordnerstruktur bleibt erhalten (die Mixins referenzieren `../variables` intern) —
Dateien nach dem Kopieren also nicht umsortieren.

```json
{
	"mixinsFormat": "scss",
	"mixinsOutputBase": "./src/styles/catalisator-mixins"
}
```

- `mixinsFormat: "scss"` (Default) — echtes Sass, sofort nutzbar, keine weiteren Abhängigkeiten.
  Ungültige Werte lösen eine Warnung aus und fallen auf `"scss"` zurück.
- `mixinsFormat: "postcss"` — PostCSS-Dialekt; setzt voraus, dass der eigene Build
  `postcss-import`, `postcss-advanced-variables`, `postcss-calc`, `postcss-nested` und
  `postcss-functions` (mit einer `stripUnit`-Funktion) registriert hat. Eine
  `postcss.config.js` wird **nicht** mitkopiert.

Nutzung nach dem Export:

```scss
@use './styles/catalisator-mixins/mixins/breakpoints' as *;

.my-hero {
	@include media-breakpoint-up(lg) {
		display: flex;
	}
}
```

**Hinweis:** Die RFS-Mixins (`rfs`, `shortcuts`) werden derzeit auf einen expliziten
`fluid`-Ansatz umgebaut — die API kann sich also noch ändern. Die Skalierung selbst ist korrekt:
`@include font-size(32)` ergibt `clamp(1.325rem, calc(0.84375vw + 1.325rem), 2rem)`, d. h. der
Maximalwert wird bei 1280px Viewport erreicht (steuerbar über `$rfs-max-breakpoint`).
