const fs = require('fs')
const path = require('path')

class TaskScanner {
	constructor(config, fileService, parser) {
		this.config = config
		this.fileService = fileService
		this.parser = parser
	}

	buildTasks(targetDir) {
		let tasks = this._hasManualConfig() ? this._scanFromConfig() : this._scanAutomatically(targetDir)

		return this._removeDuplicates(tasks)
	}

	_hasManualConfig() {
		return this.config.include && Object.keys(this.config.include).length > 0
	}

	_scanAutomatically(targetDir) {
		console.log(`\n🔍 Auto-Scan: Scanne '${targetDir}' nach '${this.config.prefix}'-Klassen...\n`)
		return this._processDirectory(targetDir)
	}

	_scanFromConfig() {
		console.log(`\n📋 Manuelle Config-Liste erkannt. Lese Pfade und Regeln...`)

		const isArray = Array.isArray(this.config.include)
		const entries = isArray ? this.config.include.map((item) => ({ key: item, val: null })) : Object.entries(this.config.include).map(([k, v]) => ({ key: k, val: v }))

		return entries.flatMap(({ key, val }) => this._processConfigEntry(key, val))
	}

	_processConfigEntry(key, val) {
		const absPath = path.resolve(process.cwd(), key)

		if (!fs.existsSync(absPath)) {
			console.log(`  ⚠️ Pfad nicht gefunden, überspringe: ${key}`)
			return []
		}

		const customCategory = val?.category || (typeof val === 'string' ? val : null)
		const customName = val?.name || null
		const stat = fs.statSync(absPath)

		if (stat.isFile()) {
			return this._processFile(absPath, customCategory, customName)
		}

		if (stat.isDirectory()) {
			return this._processDirectory(absPath, customCategory)
		}

		return []
	}

	_processFile(filePath, customCategory, customName) {
		const hasValidExtension = this.parser.extensions.some((ext) => filePath.endsWith(ext))

		if (!hasValidExtension) return []

		return [
			{
				file: filePath,
				category: customCategory || this.getCategory(filePath),
				name: customName,
			},
		]
	}

	_processDirectory(dirPath, customCategory = null) {
		const tasks = []
		const dirFiles = this.fileService.scanDirectory(dirPath, this.parser.extensions)

		for (const filePath of dirFiles) {
			const content = this.fileService.readFile(filePath)

			if (this.parser.needsMigration(content, this.config.prefix, this.config.whitelist)) {
				tasks.push({
					file: filePath,
					category: customCategory || this.getCategory(filePath),
					name: null,
				})
			}
		}

		return tasks
	}

	getCategory(filePath) {
		const normalized = filePath.replace(/\\/g, '/')
		const fileName = path.basename(filePath, path.extname(filePath))
		if (fileName === 'layout') return 'layouts'
		if (normalized.includes('/app/') || normalized.includes('/pages/')) return 'pages'
		return 'partials'
	}

	_removeDuplicates(tasks) {
		const unique = []
		const seen = new Set()
		for (const task of tasks) {
			if (!seen.has(task.file)) {
				seen.add(task.file)
				unique.push(task)
			}
		}
		return unique
	}
}

module.exports = TaskScanner
