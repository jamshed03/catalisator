const fs = require('fs')
const path = require('path')

class CatalisatorCore {
	constructor(config, parser, translator, formatter) {
		this.prefix = config.prefix || 'ka'
		this.dryRun = config.dryRun || false
		this.whitelist = config.whitelist || ['container', 'material-symbols-outlined']

		this.parser = parser
		this.translator = translator
		this.formatter = formatter

		this.paths = {
			outputBase: path.resolve(config.outputBase || './src/styles'),
			cssEntry: path.resolve(config.cssEntry || './src/app/[locale]/globals.css'),
			outputEntry: path.resolve(config.outputEntry || './src/app/[locale]/globals.scss'),
		}

		this._initFileSystem()
		this._setupBaseFiles()
	}

	_initFileSystem() {
		if (!fs.existsSync(this.paths.outputBase)) {
			fs.mkdirSync(this.paths.outputBase, { recursive: true })
		}
	}

	_setupBaseFiles() {
		const varPath = path.join(this.paths.outputBase, this.formatter.variablesFile)

		if (!fs.existsSync(varPath)) {
			let vars = []
			if (typeof this.translator.getGlobalVariables === 'function') {
				vars = this.translator.getGlobalVariables(this.paths.cssEntry)
			}

			const content = `:root {\n  --spacing: 0.25rem;\n  ${vars.join('\n  ')}\n}\n\n@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`
			if (!this.dryRun) fs.writeFileSync(varPath, content)
		}

		const outputEntryDir = path.dirname(this.paths.outputEntry)
		if (!this.dryRun && !fs.existsSync(outputEntryDir)) fs.mkdirSync(outputEntryDir, { recursive: true })

		if (!fs.existsSync(this.paths.outputEntry)) {
			const relVarsPath = path.relative(outputEntryDir, varPath).replace(/\\/g, '/')
			const importStatement = this.formatter.formatGlobalImport(relVarsPath)
			if (!this.dryRun) fs.writeFileSync(this.paths.outputEntry, `${importStatement}\n.container { max-width: 1280px; margin: 0 auto; }\n`)
		}
	}

	async migrate(targetFile, categoryDir = null, customName = null) {
		const absTarget = path.resolve(targetFile)
		if (!fs.existsSync(absTarget)) return

		let fileName = customName || path.basename(absTarget, path.extname(absTarget))
		if (!customName && (fileName === 'page' || fileName === 'layout')) {
			const parentDir = path.basename(path.dirname(absTarget)).replace(/[\(\)\[\]]/g, '')
			fileName = parentDir || (fileName === 'page' ? 'home' : 'root')
		}

		const stylePath = this._getStylePath(absTarget, fileName, categoryDir)
		console.log(`\n🚀 Migriere: ${targetFile}`)

		let content = fs.readFileSync(absTarget, 'utf8')

		const relVarsPath = path.relative(path.dirname(stylePath), path.join(this.paths.outputBase, this.formatter.variablesFile)).replace(/\\/g, '/')
		let styleHeader = fs.existsSync(stylePath) ? fs.readFileSync(stylePath, 'utf8').split('\n\n.')[0] : this.formatter.formatHeader(fileName, relVarsPath)

		const matches = this.parser.extract(content, this.prefix)
		matches.sort((a, b) => a.index - b.index)

		let collectedRules = []
		let hasChanges = false

		for (const match of matches.reverse()) {
			const translatedRules = await this.translator.translate(match.twClasses, {
				whitelist: this.whitelist,
				cssEntry: this.paths.cssEntry,
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

		const cssBlock = collectedRules.map((r) => this.formatter.formatBlock(r.name, r.rules)).join('\n\n')
		const finalStyle = `${styleHeader}\n\n${cssBlock}\n`

		this._saveFiles(absTarget, content, stylePath, finalStyle)
	}

	_getStylePath(absTarget, fileName, categoryDir) {
		const generatedName = categoryDir ? `_${fileName}` : `${fileName}.generated`
		return categoryDir ? path.join(this.paths.outputBase, categoryDir, `${generatedName}${this.formatter.extension}`) : path.join(path.dirname(absTarget), `${generatedName}${this.formatter.extension}`)
	}

	_saveFiles(absTarget, jsx, stylePath, styleContent) {
		if (this.dryRun) {
			console.log(`  [DRY RUN] 🛑 Schreibschutz aktiv. Würde speichern:`)
			console.log(`    -> Datei: ${path.basename(absTarget)}`)
			console.log(`    -> Styles: ${path.basename(stylePath)}\n`)
			return
		}

		const dir = path.dirname(stylePath)
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

		fs.writeFileSync(absTarget, jsx)
		fs.writeFileSync(stylePath, styleContent)
		this._registerInGlobals(stylePath)
		console.log(`✅ ${path.basename(absTarget)} erfolgreich aktualisiert.`)
	}

	_registerInGlobals(stylePath) {
		const globalsPath = this.paths.outputEntry
		const globalsDir = path.dirname(globalsPath)
		const relImport = path.relative(globalsDir, stylePath).replace(/\\/g, '/')

		let globals = fs.readFileSync(globalsPath, 'utf8')
		const importStatement = this.formatter.formatGlobalImport(relImport)

		const searchPath = relImport.replace('.scss', '').replace('.css', '').replace('/_', '/')

		if (!globals.includes(searchPath)) {
			fs.appendFileSync(globalsPath, importStatement)
		}
	}
}

module.exports = CatalisatorCore
