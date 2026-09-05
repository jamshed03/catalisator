const fs = require('fs')
const path = require('path')

const ConfigService = require('../services/ConfigService')
const FileService = require('../services/FileService')
const AVAILABLE_MODULES = require('../../css/utils')

class UtilsCommand {
	constructor() {
		const args = process.argv.slice(2).filter((arg) => arg !== 'utils')
		this.isDryRun = args.includes('--dry')
		this.moduleFilter = args.filter((arg) => !arg.startsWith('--'))

		this.initConfig()
		this.initFormatter()
	}

	initConfig() {
		const defaultConfig = {
			stylesheet: 'scss',
			utilsPrefix: 'u-',
			utilsOutputBase: './src/styles/utils',
			utilsModules: AVAILABLE_MODULES,
		}

		this.config = ConfigService.load(defaultConfig)

		if (!Array.isArray(this.config.utilsModules) || this.config.utilsModules.length === 0) {
			this.config.utilsModules = defaultConfig.utilsModules
		}

		this.config.dryRun = this.isDryRun
	}

	initFormatter() {
		const formatterName = this.config.stylesheet === 'scss' ? 'scss' : 'css'
		this.formatter = require(`../adapters/formatters/${formatterName}`)
		this.fileService = new FileService(this.config, this.formatter, {})
	}

	resolveModules() {
		const requested = this.moduleFilter.length > 0 ? this.moduleFilter : this.config.utilsModules
		const valid = requested.filter((name) => AVAILABLE_MODULES.includes(name))
		const invalid = requested.filter((name) => !AVAILABLE_MODULES.includes(name))

		invalid.forEach((name) => console.log(`  ⚠️ Unbekanntes Utils-Modul übersprungen: ${name}`))

		return valid
	}

	generateModule(moduleName) {
		const templatePath = path.join(__dirname, '../../css/utils', `${moduleName}.css`)
		const template = fs.readFileSync(templatePath, 'utf8')
		const content = template.replace(/\{\{prefix\}\}/g, this.config.utilsPrefix)

		const fileName = this.formatter.formatPartialFileName(moduleName)
		const outputPath = path.resolve(this.config.utilsOutputBase, fileName)

		this.fileService.writeFile(outputPath, content)
		console.log(`✅ Utils-Modul erstellt: ${fileName}`)
	}

	execute() {
		console.log(`\n=========================================\n ⚡ CATALISATOR Utils \n=========================================\n`)

		const modules = this.resolveModules()

		if (modules.length === 0) {
			console.log('\n✨ Keine gültigen Utils-Module ausgewählt.')
			return
		}

		console.log(`\n🎯 Generiere ${modules.length} Utils-Modul(e) mit Prefix "${this.config.utilsPrefix}"...`)
		modules.forEach((moduleName) => this.generateModule(moduleName))

		console.log(`\n🎉 Abgeschlossen! Importiere die Module manuell in dein globales Stylesheet.\n`)
	}
}

module.exports = UtilsCommand
