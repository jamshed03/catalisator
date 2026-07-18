#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry')
const targetDir = args.find((arg) => !arg.startsWith('--')) || './src'

const CatalisatorCore = require('../lib/core')

console.log(`
=========================================
 ⚡ CATALISATOR Engine 
=========================================
`)

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
	try {
		const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
		finalConfig = { ...defaultConfig, ...userConfig }
		console.log(`✅ Config-Datei geladen: catalisator.config.json`)
	} catch (error) {
		console.error(`❌ Fehler beim Lesen der Config. Verwende Standardwerte.`, error.message)
	}
}

finalConfig.dryRun = isDryRun

if (isDryRun) {
	console.log(`\n🏜️  DRY RUN MODUS AKTIV: Es werden keine Dateien gespeichert oder verändert!\n`)
}

// 🔌 ADAPTER DYNAMISCH LADEN
const parserName = finalConfig.frontend === 'next.js' ? 'react' : finalConfig.frontend
const translatorName = finalConfig.stylesheet === 'scss' ? 'tailwind' : finalConfig.stylesheet

const parser = require(`../adapters/parsers/${parserName}`)
const translator = require(`../adapters/translators/${translatorName}`)

// ENGINE INITIALISIEREN
const engine = new CatalisatorCore(finalConfig, parser, translator)

// DEINE ALTE SCAN-LOGIK UNVERÄNDERT
function scanDirectory(dir, fileList = []) {
	const files = fs.readdirSync(dir)
	for (const file of files) {
		const fullPath = path.join(dir, file)
		const stat = fs.statSync(fullPath)
		if (stat.isDirectory()) {
			if (file !== 'node_modules' && !file.startsWith('.')) scanDirectory(fullPath, fileList)
		} else if (parser.extensions.some((ext) => file.endsWith(ext))) {
			fileList.push(fullPath)
		}
	}
	return fileList
}

function getCategory(filePath) {
	const normalized = filePath.replace(/\\/g, '/')
	const fileName = path.basename(filePath, path.extname(filePath))
	if (fileName === 'layout') return 'layouts'
	if (normalized.includes('/app/') || normalized.includes('/pages/')) return 'pages'
	return 'partials'
}

async function runMigration() {
	let migrationTasks = []

	if (finalConfig.include && Object.keys(finalConfig.include).length > 0) {
		console.log(`\n📋 Manuelle Config-Liste erkannt. Lese Pfade und Regeln...`)

		const isArray = Array.isArray(finalConfig.include)
		const entries = isArray ? finalConfig.include.map((item) => ({ key: item, val: null })) : Object.entries(finalConfig.include).map(([k, v]) => ({ key: k, val: v }))

		for (const { key, val } of entries) {
			const absPath = path.resolve(process.cwd(), key)
			if (!fs.existsSync(absPath)) continue

			let customCategory = val?.category || (typeof val === 'string' ? val : null)
			let customName = val?.name || null

			const stat = fs.statSync(absPath)
			if (stat.isFile()) {
				migrationTasks.push({ file: absPath, category: customCategory || getCategory(absPath), name: customName })
			} else if (stat.isDirectory()) {
				const dirFiles = scanDirectory(absPath)
				for (const f of dirFiles) {
					if (parser.needsMigration(fs.readFileSync(f, 'utf8'), finalConfig.prefix, finalConfig.whitelist)) {
						migrationTasks.push({ file: f, category: customCategory || getCategory(f), name: null })
					}
				}
			}
		}
	} else {
		if (!fs.existsSync(targetDir)) return console.error(`\n❌ Ordner '${targetDir}' wurde nicht gefunden.`)
		console.log(`\n🔍 Auto-Scan: Scanne '${targetDir}' nach '${finalConfig.prefix}'-Klassen...\n`)
		const allTsxFiles = scanDirectory(targetDir)
		for (const f of allTsxFiles) {
			if (parser.needsMigration(fs.readFileSync(f, 'utf8'), finalConfig.prefix, finalConfig.whitelist)) {
				migrationTasks.push({ file: f, category: getCategory(f), name: null })
			}
		}
	}

	const uniqueTasks = []
	const seen = new Set()
	for (const task of migrationTasks) {
		if (!seen.has(task.file)) {
			seen.add(task.file)
			uniqueTasks.push(task)
		}
	}

	if (uniqueTasks.length === 0) {
		console.log('\n✨ Alles sauber! Keine Dateien zum Migrieren gefunden.')
		return
	}

	console.log(`\n🎯 ${uniqueTasks.length} Dateien gefunden. Starte Verarbeitung...\n`)

	for (const task of uniqueTasks) {
		await engine.migrate(task.file, task.category, task.name)
	}

	console.log(`\n🎉 Abgeschlossen!\n`)
}

runMigration()
