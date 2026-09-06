const path = require('path')

const ConfigService = require('../services/ConfigService')
const FileService = require('../services/FileService')
const UtilsLibrary = require('../services/UtilsLibrary')

const SCAN_EXTENSIONS = ['.tsx', '.jsx', '.js', '.vue', '.html']
const CLASS_ATTR_REGEX = /\bclass(?:Name)?\s*=\s*(["'`])((?:(?!\1).)*)\1/g

class UtilsCommand {
	constructor() {
		const args = process.argv.slice(2).filter((arg) => arg !== 'utils')
		this.isDryRun = args.includes('--dry')
		const cliTargetDir = args.find((arg) => !arg.startsWith('--'))

		this.initConfig()
		this.targetDir = cliTargetDir || this.config.utilsScanDir

		this.fileService = new FileService(this.config, {}, {})
	}

	initConfig() {
		const defaultConfig = {
			stylesheet: 'scss',
			utilsScanDir: './src',
			utilsOutputBase: './src/styles',
			utilsOutputName: 'utils.generated',
		}

		this.config = ConfigService.load(defaultConfig)
		this.config.dryRun = this.isDryRun
	}

	scanUsedClasses(catalog) {
		const used = new Set()
		const files = this.fileService.scanDirectory(this.targetDir, SCAN_EXTENSIONS)

		for (const file of files) {
			const content = this.fileService.readFile(file)
			if (!content) continue

			let match
			CLASS_ATTR_REGEX.lastIndex = 0
			while ((match = CLASS_ATTR_REGEX.exec(content)) !== null) {
				for (const token of match[2].trim().split(/\s+/)) {
					if (catalog.has(token)) used.add(token)
				}
			}
		}

		return used
	}

	buildOutput(catalog, usedClasses) {
		const topLevel = []
		const mediaGroups = new Map() // media params -> [{ name, decls }]

		for (const name of usedClasses) {
			for (const { media, decls } of catalog.get(name)) {
				if (media === null) {
					topLevel.push({ name, decls })
				} else {
					if (!mediaGroups.has(media)) mediaGroups.set(media, [])
					mediaGroups.get(media).push({ name, decls })
				}
			}
		}

		const indent = (text, level) => {
			const tabs = '\t'.repeat(level)
			return text
				.split('\n')
				.map((line) => `${tabs}${line}`)
				.join('\n')
		}

		let output = topLevel.map(({ name, decls }) => `.${name} {\n${indent(decls, 1)}\n}`).join('\n\n')

		for (const [media, rules] of mediaGroups) {
			const body = rules.map(({ name, decls }) => `${indent(`.${name} {\n${indent(decls, 1)}\n}`, 1)}`).join('\n')
			output += `\n\n@media ${media} {\n${body}\n}`
		}

		return output.trim() + '\n'
	}

	execute() {
		console.log(`\n=========================================\n ⚡ CATALISATOR Utils \n=========================================\n`)

		const catalog = UtilsLibrary.build()
		console.log(`🔍 Scanne '${this.targetDir}' nach genutzten Utility-Klassen...`)
		const used = this.scanUsedClasses(catalog)

		if (used.size === 0) {
			console.log('\n✨ Keine genutzten Utility-Klassen gefunden.')
			return
		}

		console.log(`\n🎯 ${used.size} genutzte Klasse(n) gefunden: ${[...used].join(', ')}`)

		const output = this.buildOutput(catalog, used)
		const ext = this.config.stylesheet === 'scss' ? 'scss' : 'css'
		const outputPath = path.resolve(this.config.utilsOutputBase, `${this.config.utilsOutputName}.${ext}`)

		this.fileService.writeFile(outputPath, output)

		console.log(`\n✅ Geschrieben: ${outputPath}`)
		console.log(`\n🎉 Importiere die Datei manuell in dein globales Stylesheet.\n`)
	}
}

module.exports = UtilsCommand
