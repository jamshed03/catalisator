const path = require('path')

const ConfigService = require('../services/ConfigService')
const FileService = require('../services/FileService')
const MigrationAdapter = require('../adapters/MigrationAdapter')
const TaskScanner = require('../services/TaskScanner')

class MigrateCommand {
	constructor() {
		const args = process.argv.slice(2)
		this.isDryRun = args.includes('--dry')
		this.targetDir = args.find((arg) => !arg.startsWith('--')) || './src'

		this.initConfig()
		this.initAdapters()
	}

	initConfig() {
		const defaultConfig = {
			frontend: 'next.js',
			prefix: 'ka',
			stylesheet: 'scss',
			outputBase: './src/styles',
			outputEntry: './src/app/[locale]/globals.scss',
			cssEntry: './src/app/[locale]/globals.css',
			whitelist: ['container', 'material-symbols-outlined'],
			include: [],
			autoFormat: false,
		}

		this.config = ConfigService.load(defaultConfig)

		if (!Array.isArray(this.config.whitelist)) {
			this.config.whitelist = defaultConfig.whitelist
		}

		this.config.dryRun = this.isDryRun
	}

	initAdapters() {
		const parserName = this.config.frontend === 'next.js' ? 'react' : this.config.frontend
		const translatorName = this.config.source || 'tailwind'
		const formatterName = this.config.stylesheet === 'scss' ? 'scss' : 'css'

		this.parser = require(`../adapters/parsers/${parserName}`)
		this.translator = require(`../adapters/translators/${translatorName}`)
		this.formatter = require(`../adapters/formatters/${formatterName}`)

		this.fileService = new FileService(this.config, this.formatter, this.translator)
		this.adapter = new MigrationAdapter(this.config, this.parser, this.translator, this.formatter)
		this.scanner = new TaskScanner(this.config, this.fileService, this.parser)
	}

	async applyPrettier(markup, stylesheet, taskFile, stylePath) {
		try {
			const prettier = require('prettier')

			const prettierConfig = (await prettier.resolveConfig(taskFile)) || {}
			const finalMarkup = await prettier.format(markup, { ...prettierConfig, filepath: taskFile })

			const styleConfig = (await prettier.resolveConfig(stylePath)) || {}
			const finalStylesheet = await prettier.format(stylesheet, { ...styleConfig, filepath: stylePath })

			return { finalMarkup, finalStylesheet }
		} catch (err) {
			console.log(`  ⚠️ Info: Konnte Code nicht automatisch formatieren. Speichere Rohversion.`)
			return { finalMarkup: markup, finalStylesheet: stylesheet }
		}
	}

	async processTask(task) {
		try {
			const fileContent = this.fileService.readFile(task.file)
			const matches = this.adapter.input(fileContent)
			if (matches.length === 0) return null

			console.log(`🚀 Migriere: ${path.basename(task.file)}`)
			const migratedData = await this.adapter.migrate(matches)
			if (migratedData.length === 0) return null

			const stylePath = this.fileService.resolveStylePath(task, this.formatter)
			const fileName = task.name || path.basename(task.file, path.extname(task.file))
			const styleHeader = this.fileService.resolveStyleHeader(stylePath, fileName, this.formatter)

			let { markup, stylesheet } = this.adapter.output(fileContent, migratedData, styleHeader)

			if (this.config.autoFormat) {
				const formatted = await this.applyPrettier(markup, stylesheet, task.file, stylePath)
				markup = formatted.finalMarkup
				stylesheet = formatted.finalStylesheet
			}

			this.fileService.writeFile(task.file, markup)
			this.fileService.writeFile(stylePath, stylesheet)

			console.log(`✅ Erfolgreich aktualisiert: ${path.basename(task.file)}`)
			return stylePath
		} catch (err) {
			console.error(`\n❌ FEHLER bei Datei ${task.file}:`, err.message)
			return null
		}
	}

	async execute() {
		console.log(`\n=========================================\n ⚡ CATALISATOR Engine \n=========================================\n`)

		this.fileService.ensureBaseFiles()
		const tasks = this.scanner.buildTasks(this.targetDir)

		if (tasks.length === 0) {
			console.log('\n✨ Alles sauber! Keine Dateien zum Migrieren gefunden.')
			return
		}

		console.log(`\n🎯 ${tasks.length} Dateien gefunden. Starte parallele Verarbeitung...`)

		const migrationPromises = tasks.map((task) => this.processTask(task))
		const results = await Promise.all(migrationPromises)

		const uniqueStyles = [...new Set(results.filter(Boolean))]

		if (uniqueStyles.length > 0) {
			console.log(`\n🔗 Trage ${uniqueStyles.length} neue Styles in Globals ein...`)
			for (const stylePath of uniqueStyles) {
				this.fileService.updateGlobals(stylePath)
			}
		}

		console.log(`\n🎉 Abgeschlossen!\n`)
	}
}

module.exports = MigrateCommand
