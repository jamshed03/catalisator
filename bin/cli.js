#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry')
const targetDir = args.find((arg) => !arg.startsWith('--')) || './src'

const FileService = require('../lib/FileService')
const MigrationAdapter = require('../lib/MigrationAdapter')
const TaskScanner = require('../lib/TaskScanner')

console.log(`\n=========================================\n ⚡ CATALISATOR Engine \n=========================================\n`)

const defaultConfig = {
	frontend: 'next.js',
	prefix: 'ka',
	stylesheet: 'scss',
	outputBase: './src/styles',
	outputEntry: './src/app/[locale]/globals.scss',
	cssEntry: './src/app/[locale]/globals.css',
	whitelist: ['container', 'material-symbols-outlined'],
	include: [],
}

const configPath = path.resolve(process.cwd(), 'catalisator.config.json')
let finalConfig = { ...defaultConfig }
if (fs.existsSync(configPath)) {
	finalConfig = { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
}
if (!Array.isArray(finalConfig.whitelist)) {
	finalConfig.whitelist = defaultConfig.whitelist
}
finalConfig.dryRun = isDryRun

const parserName = finalConfig.frontend === 'next.js' ? 'react' : finalConfig.frontend
const translatorName = finalConfig.source || 'tailwind'
const formatterName = finalConfig.stylesheet === 'scss' ? 'scss' : 'css'

const parser = require(`../adapters/parsers/${parserName}`)
const translator = require(`../adapters/translators/${translatorName}`)
const formatter = require(`../adapters/formatters/${formatterName}`)

const fileService = new FileService(finalConfig, formatter, translator)
const adapter = new MigrationAdapter(finalConfig, parser, translator, formatter)
const scanner = new TaskScanner(finalConfig, fileService, parser)

fileService.ensureBaseFiles()

async function runMigration() {
	const tasks = scanner.buildTasks(targetDir)

	if (tasks.length === 0) {
		console.log('\n✨ Alles sauber! Keine Dateien zum Migrieren gefunden.')
		return
	}

	console.log(`\n🎯 ${tasks.length} Dateien gefunden. Starte parallele Verarbeitung...`)

	const migrationPromises = tasks.map(async (task) => {
		try {
			const fileContent = fileService.readFile(task.file)
			const matches = adapter.input(fileContent)
			if (matches.length === 0) return null

			console.log(`🚀 Migriere: ${path.basename(task.file)}`)
			const migratedData = await adapter.migrate(matches)

			if (migratedData.length === 0) return null

			const stylePath = fileService.resolveStylePath(task, formatter)
			const fileName = task.name || path.basename(task.file, path.extname(task.file))
			const styleHeader = fileService.resolveStyleHeader(stylePath, fileName, formatter)

			const { markup, stylesheet } = adapter.output(fileContent, migratedData, styleHeader)

			fileService.writeFile(task.file, markup)
			fileService.writeFile(stylePath, stylesheet)

			console.log(`✅ Erfolgreich aktualisiert: ${path.basename(task.file)}`)

			return stylePath
		} catch (err) {
			console.error(`\n❌ FEHLER bei Datei ${task.file}:`, err.message)
			return null
		}
	})

	const results = await Promise.all(migrationPromises)

	const generatedStyles = results.filter(Boolean)
	const uniqueStyles = [...new Set(generatedStyles)]

	if (uniqueStyles.length > 0) {
		console.log(`\n🔗 Trage ${uniqueStyles.length} neue Styles in Globals ein...`)
		for (const stylePath of uniqueStyles) {
			fileService.updateGlobals(stylePath)
		}
	}

	console.log(`\n🎉 Abgeschlossen!\n`)
}

runMigration()
