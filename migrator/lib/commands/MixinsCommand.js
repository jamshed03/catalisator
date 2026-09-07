const path = require('path')

const ConfigService = require('../services/ConfigService')
const FileService = require('../services/FileService')

const MIXIN_FILES = {
	scss: ['_variables.scss', 'mixins/_breakpoints.scss', 'mixins/_fluid.scss', 'mixins/_rfs.scss', 'mixins/_shortcuts.scss'],
	postcss: ['variables.css', 'mixins/breakpoints.css', 'mixins/fluid.css', 'mixins/rfs.css', 'mixins/shortcuts.css'],
}

class MixinsCommand {
	constructor() {
		const args = process.argv.slice(2).filter((arg) => arg !== 'mixins')
		this.isDryRun = args.includes('--dry')

		this.initConfig()
		this.fileService = new FileService(this.config, {}, {})
	}

	initConfig() {
		const defaultConfig = {
			mixinsFormat: 'scss',
			mixinsOutputBase: './src/styles/catalisator-mixins',
		}

		this.config = ConfigService.load(defaultConfig)

		if (!MIXIN_FILES[this.config.mixinsFormat]) {
			console.log(`  ⚠️ Unbekanntes mixinsFormat "${this.config.mixinsFormat}", verwende "scss".`)
			this.config.mixinsFormat = 'scss'
		}

		this.config.dryRun = this.isDryRun
	}

	execute() {
		console.log(`\n=========================================\n ⚡ CATALISATOR Mixins \n=========================================\n`)

		const format = this.config.mixinsFormat
		const sourceDir = path.join(__dirname, '../../../', format)
		const outputBase = path.resolve(this.config.mixinsOutputBase)

		console.log(`📦 Exportiere Mixins im Format "${format}" nach '${this.config.mixinsOutputBase}'...\n`)

		for (const relPath of MIXIN_FILES[format]) {
			const content = this.fileService.readFile(path.join(sourceDir, relPath))
			const outputPath = path.join(outputBase, relPath)

			this.fileService.writeFile(outputPath, content)
			console.log(`✅ ${relPath}`)
		}

		if (format === 'postcss') {
			console.log(
				`\nℹ️  Dieses Format setzt voraus, dass dein eigener PostCSS-Build bereits\n` +
					`   postcss-import, postcss-advanced-variables, postcss-calc, postcss-nested\n` +
					`   und postcss-functions (mit einer "stripUnit"-Funktion) registriert hat —\n` +
					`   siehe README.md, Abschnitt "Utils-Bibliothek".`
			)
		}

		console.log(`\n🎉 Importiere die Mixins manuell in deinem Projekt (z. B. @use '.../mixins/breakpoints' as *;).\n`)
	}
}

module.exports = MixinsCommand
