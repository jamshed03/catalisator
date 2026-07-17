#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
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
}

const configPath = path.resolve(process.cwd(), 'catalisator.config.json')
let finalConfig = { ...defaultConfig }

if (fs.existsSync(configPath)) {
	try {
		const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
		finalConfig = { ...defaultConfig, ...userConfig }
		console.log(`✅ Config-Datei geladen: catalisator.config.json`)
	} catch (error) {
		console.error(`❌ Fehler beim Lesen der catalisator.config.json. Verwende Standardwerte.`, error.message)
	}
} else {
	console.log(`ℹ️ Keine catalisator.config.json gefunden. Verwende Standardwerte.`)
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
	const kaTagRegex = new RegExp(`className=['"](${migrator.prefix}[a-zA-Z0-9_-]+)\\s+([^'"]+)['"]`, 'g')
	let match
	while ((match = kaTagRegex.exec(content)) !== null) {
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

async function runAutoMigration() {
	const targetDir = process.argv[2] || './src'
	if (!fs.existsSync(targetDir)) return console.error(`❌ Ordner '${targetDir}' wurde nicht gefunden.`)

	console.log(`\n🔍 Scanne '${targetDir}' nach '${migrator.prefix}'-Klassen...\n`)
	const allTsxFiles = scanDirectory(targetDir)
	const filesToMigrate = allTsxFiles.filter(needsMigration)

	if (filesToMigrate.length === 0) {
		console.log('✨ Alles sauber! Keine Dateien zum Migrieren gefunden.')
		return
	}

	console.log(`🎯 ${filesToMigrate.length} Dateien gefunden. Starte automatische Migration...\n`)

	for (const file of filesToMigrate) {
		const category = getCategory(file)
		await migrator.migrate(file, category)
	}

	console.log(`\n🎉 Alle gefundenen Dateien wurden erfolgreich migriert!\n`)
}

runAutoMigration()
