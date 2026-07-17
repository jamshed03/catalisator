#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry')
const targetDir = args.find((arg) => !arg.startsWith('--')) || './src'

const TailwindToScssMigrator = require('../lib/migrator')

console.log(`
=========================================
 ⚡ CATALISATOR - Tailwind to SCSS 
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

const migrator = new TailwindToScssMigrator(finalConfig)

function scanDirectory(dir, fileList = []) {
	const files = fs.readdirSync(dir)
	for (const file of files) {
		const fullPath = path.join(dir, file)
		const stat = fs.statSync(fullPath)
		if (stat.isDirectory()) {
			if (file !== 'node_modules' && !file.startsWith('.')) scanDirectory(fullPath, fileList)
		} else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
			fileList.push(fullPath)
		}
	}
	return fileList
}

function needsMigration(filePath) {
	const content = fs.readFileSync(filePath, 'utf8')
	const prefixRegex = new RegExp(`className=(['"])(${this.prefix}[a-zA-Z0-9_-]+)\\s*([^'"]*)\\1`, 'g')
	let match

	while ((match = prefixRegex.exec(content)) !== null) {
		const extraClasses = match[2].trim()
		if (!extraClasses) continue
		const hasUnmigrated = extraClasses.split(/\s+/).some((c) => c && !migrator.whitelist.includes(c))
		if (hasUnmigrated) return true
	}
	return false
}

function getCategory(filePath) {
	const normalized = filePath.replace(/\\/g, '/')
	const fileName = path.basename(filePath, '.tsx')
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

			if (!fs.existsSync(absPath)) {
				console.log(`  ⚠️ Pfad nicht gefunden, überspringe: ${key}`)
				continue
			}

			let customCategory = null
			let customName = null

			if (val) {
				if (typeof val === 'string') {
					customCategory = val
				} else if (typeof val === 'object') {
					customCategory = val.category || null
					customName = val.name || null
				}
			}

			const stat = fs.statSync(absPath)
			if (stat.isFile() && (absPath.endsWith('.tsx') || absPath.endsWith('.jsx'))) {
				if (stat.isFile()) {
					migrationTasks.push({
						file: absPath,
						category: customCategory || getCategory(absPath),
						name: customName,
					})
				} else if (stat.isDirectory()) {
					const dirFiles = scanDirectory(absPath)
					for (const f of dirFiles) {
						if (needsMigration(f)) {
							migrationTasks.push({
								file: f,
								category: customCategory || getCategory(f),
								name: null,
							})
						}
					}
				}
			} else if (stat.isDirectory()) {
				const dirFiles = scanDirectory(absPath)
				for (const f of dirFiles) {
					if (needsMigration(f)) {
						migrationTasks.push({
							file: f,
							category: customCategory || getCategory(f),
							name: null,
						})
					}
				}
			}
		}
	} else {
		if (!fs.existsSync(targetDir)) return console.error(`\n❌ Ordner '${targetDir}' wurde nicht gefunden.`)
		console.log(`\n🔍 Auto-Scan: Scanne '${targetDir}' nach '${migrator.prefix}'-Klassen...\n`)
		const allTsxFiles = scanDirectory(targetDir)
		for (const f of allTsxFiles) {
			if (needsMigration(f)) {
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

	console.log(`\n🎯 ${uniqueTasks.length} Dateien gefunden. Starte Migration...\n`)

	for (const task of uniqueTasks) {
		await migrator.migrate(task.file, task.category, task.name)
	}

	if (isDryRun) {
		console.log(`\n🎉 Dry Run beendet! Führe den Befehl ohne '--dry' aus, um zu speichern.\n`)
	} else {
		console.log(`\n🎉 Migration abgeschlossen! JSX aufgeräumt und SCSS generiert.\n`)
	}
}

runMigration()
