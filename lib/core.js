const fs = require('fs')
const path = require('path')

class CatalisatorCore {
	constructor(config, parser, translator) {
		this.prefix = config.prefix || 'ka'
		this.dryRun = config.dryRun || false
		this.whitelist = config.whitelist || ['container', 'material-symbols-outlined']

		this.parser = parser
		this.translator = translator

		this.paths = {
			outputBase: path.resolve(config.outputBase || './src/styles'),
			cssEntry: path.resolve(config.cssEntry || './src/app/[locale]/globals.css'),
			outputEntry: path.resolve(config.outputEntry || './src/app/[locale]/globals.scss'),
			tailwind: require.resolve('tailwindcss/index.css'),
		}

		this._initFileSystem()
		this.themeContent = this._loadTheme()
		this._setupBaseFiles()
	}

	_initFileSystem() {
		if (!fs.existsSync(this.paths.outputBase)) {
			fs.mkdirSync(this.paths.outputBase, { recursive: true })
		}
	}

	_loadTheme() {
		if (!fs.existsSync(this.paths.cssEntry)) return ''
		return fs.readFileSync(this.paths.cssEntry, 'utf8').replace(/@import\s+['"]tailwindcss['"];/g, '')
	}

	_setupBaseFiles() {
		const varPath = path.join(this.paths.outputBase, '_variables.scss')
		if (!fs.existsSync(varPath)) {
			const vars = this.themeContent.match(/--[\w-]+:\s*[^;]+;/g) || []
			const content = `:root {\n  --spacing: 0.25rem;\n  ${vars.join('\n  ')}\n}\n\n@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`
			if (!this.dryRun) fs.writeFileSync(varPath, content)
		}

		const outputEntryDir = path.dirname(this.paths.outputEntry)
		if (!this.dryRun && !fs.existsSync(outputEntryDir)) fs.mkdirSync(outputEntryDir, { recursive: true })

		if (!fs.existsSync(this.paths.outputEntry)) {
			const relVarsPath = path.relative(outputEntryDir, varPath).replace(/\\/g, '/').replace('.scss', '')
			if (!this.dryRun) fs.writeFileSync(this.paths.outputEntry, `@use '${relVarsPath}' as *;\n\n.container { max-width: 1280px; margin: 0 auto; }\n`)
		}
	}

	async migrate(targetFile, categoryDir = null, customName = null) {
		const absTarget = path.resolve(targetFile)
		if (!fs.existsSync(absTarget)) return

		let fileName = customName || path.basename(absTarget, '.tsx')
		if (!customName && (fileName === 'page' || fileName === 'layout')) {
			const parentDir = path.basename(path.dirname(absTarget)).replace(/[\(\)\[\]]/g, '')
			fileName = parentDir || (fileName === 'page' ? 'home' : 'root')
		}

		const scssPath = this._getScssPath(absTarget, fileName, categoryDir)
		console.log(`\n🚀 Migriere: ${targetFile}`)

		let content = fs.readFileSync(absTarget, 'utf8')
		let scssHeader = fs.existsSync(scssPath) ? fs.readFileSync(scssPath, 'utf8').split('\n\n.')[0] : this._getScssHeader(scssPath, fileName)

		const matches = this.parser.extract(content, this.prefix)
		matches.sort((a, b) => a.index - b.index)

		let collectedRules = []
		let hasChanges = false

		for (const match of matches.reverse()) {
			const translatedRules = await this.translator.translate(match.twClasses, {
				whitelist: this.whitelist,
				tailwindPath: this.paths.tailwind,
				themeContent: this.themeContent,
			})

			if (translatedRules) {
				hasChanges = true
				collectedRules.unshift({ name: match.customClass, rules: translatedRules })

				content = this.parser.replace(content, match, this.whitelist)
			}
		}

		if (!hasChanges) {
			console.log(`⚡ Keine neuen Klassen gefunden. Überspringe Speichern.`)
			return
		}

		const cssBlock = collectedRules.map((r) => `.${r.name} {\n    ${r.rules}\n}`).join('\n\n')
		const finalScss = `${scssHeader}\n\n${cssBlock}\n`

		this._saveFiles(absTarget, content, scssPath, finalScss)
	}

	_getScssPath(absTarget, fileName, categoryDir) {
		return categoryDir ? path.join(this.paths.outputBase, categoryDir, `_${fileName}.scss`) : path.join(path.dirname(absTarget), `${fileName}.generated.scss`)
	}

	_getScssHeader(scssPath, fileName) {
		const relVarsPath = path.relative(path.dirname(scssPath), path.join(this.paths.outputBase, 'variables')).replace(/\\/g, '/')
		return `// Generated for ${fileName}\n@use '${relVarsPath}' as *;\n\n`
	}

	_saveFiles(absTarget, jsx, scssPath, scss) {
		if (this.dryRun) {
			console.log(`  [DRY RUN] 🛑 Schreibschutz aktiv. Würde folgende Dateien speichern:`)
			console.log(`    -> Datei: ${path.basename(absTarget)}`)
			console.log(`    -> SCSS: ${path.basename(scssPath)}\n`)
			return
		}

		const dir = path.dirname(scssPath)
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

		fs.writeFileSync(absTarget, jsx)
		fs.writeFileSync(scssPath, scss)
		this._registerInGlobals(scssPath)
		console.log(`✅ ${path.basename(absTarget)} erfolgreich aktualisiert.`)
	}

	_registerInGlobals(scssPath) {
		const globalsPath = this.paths.outputEntry
		const globalsDir = path.dirname(globalsPath)
		const relImport = path.relative(globalsDir, scssPath).replace(/\\/g, '/').replace('.scss', '').replace('/_', '/')

		let globals = fs.readFileSync(globalsPath, 'utf8')
		if (!globals.includes(relImport)) {
			fs.appendFileSync(globalsPath, `@use '${relImport}';\n`)
		}
	}
}

module.exports = CatalisatorCore
