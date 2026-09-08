const fs = require('fs')
const path = require('path')

const ConfigService = require('../services/ConfigService')
const FileService = require('../services/FileService')
const UtilsLibrary = require('../services/UtilsLibrary')

const SCAN_EXTENSIONS = ['.tsx', '.jsx', '.js', '.vue', '.html']
const CLASS_ATTR_REGEX = /\bclass(?:Name)?\s*=\s*(["'`])((?:(?!\1).)*)\1/g
const WATCH_DEBOUNCE_MS = 150

class UtilsCommand {
	constructor() {
		const args = process.argv.slice(2).filter((arg) => arg !== 'utils')
		this.isDryRun = args.includes('--dry')
		this.isWatch = args.includes('--watch')
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
		const topLevel = new Map()
		const mediaGroups = new Map()
		const rank = new Map()

		for (const name of usedClasses) {
			for (const { media, decls, order } of catalog.get(name)) {
				const group = media === null ? topLevel : mediaGroups.get(media) || mediaGroups.set(media, new Map()).get(media)
				if (!group.has(name)) group.set(name, [])
				group.get(name).push(decls)

				const key = media === null ? `\u0000${name}` : `${media}\u0000${name}`
				if (!rank.has(key) || order < rank.get(key)) rank.set(key, order)
				if (media !== null && (!rank.has(media) || order < rank.get(media))) rank.set(media, order)
			}
		}

		const byRank =
			(prefix) =>
			([a], [b]) =>
				rank.get(`${prefix}\u0000${a}`) - rank.get(`${prefix}\u0000${b}`)

		const indent = (text, level) => {
			const tabs = '\t'.repeat(level)
			return text
				.split('\n')
				.map((line) => `${tabs}${line}`)
				.join('\n')
		}

		const renderRule = (name, declBlocks) => `.${name} {\n${indent(declBlocks.join('\n'), 1)}\n}`

		let output = [...topLevel]
			.sort(byRank(''))
			.map(([name, declBlocks]) => renderRule(name, declBlocks))
			.join('\n\n')

		for (const [media, group] of [...mediaGroups].sort(([a], [b]) => rank.get(a) - rank.get(b))) {
			const body = [...group]
				.sort(byRank(media))
				.map(([name, declBlocks]) => indent(renderRule(name, declBlocks), 1))
				.join('\n')
			output += `\n\n@media ${media} {\n${body}\n}`
		}

		return output.trim() + '\n'
	}

	runOnce() {
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
	}

	startWatching() {
		console.log(`\n👀 Watch-Modus aktiv — beobachte '${this.targetDir}' auf Änderungen... (Strg+C zum Beenden)`)

		let timeout = null
		fs.watch(this.targetDir, { recursive: true }, (_eventType, filename) => {
			if (filename && !SCAN_EXTENSIONS.some((ext) => filename.endsWith(ext))) return

			clearTimeout(timeout)
			timeout = setTimeout(() => {
				console.log(`\n🔄 Änderung erkannt${filename ? ` (${filename})` : ''}, aktualisiere...\n`)
				this.runOnce()
			}, WATCH_DEBOUNCE_MS)
		})
	}

	execute() {
		console.log(`\n=========================================\n ⚡ CATALISATOR Utils \n=========================================\n`)

		this.runOnce()

		if (this.isWatch) {
			this.startWatching()
		} else {
			console.log(`\n🎉 Importiere die Datei manuell in dein globales Stylesheet.\n`)
		}
	}
}

module.exports = UtilsCommand
