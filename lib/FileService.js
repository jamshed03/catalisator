const fs = require('fs')
const path = require('path')

class FileService {
	constructor(config, formatter, translator) {
		this.dryRun = config.dryRun || false
		this.formatter = formatter
		this.translator = translator

		this.paths = {
			outputBase: path.resolve(config.outputBase || './src/styles'),
			cssEntry: path.resolve(config.cssEntry || './src/app/[locale]/globals.css'),
			outputEntry: path.resolve(config.outputEntry || './src/app/[locale]/globals.scss'),
		}
	}

	scanDirectory(dir, extensions, fileList = []) {
		const files = fs.readdirSync(dir)
		for (const file of files) {
			const fullPath = path.join(dir, file)
			const stat = fs.statSync(fullPath)
			if (stat.isDirectory()) {
				if (file !== 'node_modules' && !file.startsWith('.')) this.scanDirectory(fullPath, extensions, fileList)
			} else if (extensions.some((ext) => file.endsWith(ext))) {
				fileList.push(fullPath)
			}
		}
		return fileList
	}

	readFile(filePath) {
		if (!fs.existsSync(filePath)) return null
		return fs.readFileSync(filePath, 'utf8')
	}

	writeFile(filePath, content) {
		if (this.dryRun) {
			console.log(`  [DRY RUN] 🛑 Würde speichern: ${path.basename(filePath)}`)
			return
		}
		const dir = path.dirname(filePath)
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	ensureBaseFiles() {
		if (!fs.existsSync(this.paths.outputBase)) {
			fs.mkdirSync(this.paths.outputBase, { recursive: true })
		}

		const varPath = path.join(this.paths.outputBase, this.formatter.variablesFile)
		if (!fs.existsSync(varPath)) {
			let vars = []
			if (typeof this.translator.getGlobalVariables === 'function') {
				vars = this.translator.getGlobalVariables(this.paths.cssEntry)
			}
			const content = `:root {\n  --spacing: 0.25rem;\n  ${vars.join('\n  ')}\n}\n\n@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`
			this.writeFile(varPath, content)
		}

		const outputEntryDir = path.dirname(this.paths.outputEntry)
		if (!this.dryRun && !fs.existsSync(outputEntryDir)) fs.mkdirSync(outputEntryDir, { recursive: true })

		if (!fs.existsSync(this.paths.outputEntry)) {
			const relVarsPath = path.relative(outputEntryDir, varPath).replace(/\\/g, '/')
			const importStatement = this.formatter.formatGlobalImport(relVarsPath)
			this.writeFile(this.paths.outputEntry, `${importStatement}\n.container { max-width: 1280px; margin: 0 auto; }\n`)
		}
	}

	updateGlobals(stylePath) {
		if (this.dryRun) return

		const globalsPath = this.paths.outputEntry
		const relImport = path.relative(path.dirname(globalsPath), stylePath).replace(/\\/g, '/')
		let globals = this.readFile(globalsPath) || ''

		const importStatement = this.formatter.formatGlobalImport(relImport)
		const searchPath = relImport.replace('.scss', '').replace('.css', '').replace('/_', '/')

		if (!globals.includes(searchPath)) {
			fs.appendFileSync(globalsPath, importStatement)
		}
	}
}

module.exports = FileService
