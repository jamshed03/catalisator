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

	if (tasks.length === 0) return console.log('\n✨ Alles sauber! Keine Dateien zum Migrieren gefunden.')
	console.log(`\n🎯 ${tasks.length} Dateien gefunden. Starte Verarbeitung...\n`)

	for (const task of tasks) {
		const fileContent = fileService.readFile(task.file)

		const matches = adapter.input(fileContent)
		if (matches.length === 0) continue

		console.log(`🚀 Migriere: ${task.file}`)

		const migratedData = await adapter.migrate(matches)
		if (migratedData.length === 0) {
			console.log(`⚡ Keine Klassen übersetzt. Überspringe Speichern.`)
			continue
		}

		let fileName = task.name || path.basename(task.file, path.extname(task.file))
		if (!task.name && (fileName === 'page' || fileName === 'layout')) {
			fileName = path.basename(path.dirname(task.file)).replace(/[\(\)\[\]]/g, '') || (fileName === 'page' ? 'home' : 'root')
		}
		const generatedName = task.category ? `_${fileName}` : `${fileName}.generated`
		const stylePath = task.category ? path.join(fileService.paths.outputBase, task.category, `${generatedName}${formatter.extension}`) : path.join(path.dirname(task.file), `${generatedName}${formatter.extension}`)

		const relVarsPath = path.relative(path.dirname(stylePath), path.join(fileService.paths.outputBase, formatter.variablesFile)).replace(/\\/g, '/')
		const existingStyle = fileService.readFile(stylePath)
		const styleHeader = existingStyle ? existingStyle.split('\n\n.')[0] : formatter.formatHeader(fileName, relVarsPath)

		const { markup, stylesheet } = adapter.output(fileContent, migratedData, styleHeader)

		fileService.writeFile(task.file, markup)
		fileService.writeFile(stylePath, stylesheet)
		fileService.updateGlobals(stylePath)

		console.log(`✅ Erfolgreich aktualisiert.`)
	}
	console.log(`\n🎉 Abgeschlossen!\n`)
}

runMigration()
