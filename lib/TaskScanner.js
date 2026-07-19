const fs = require('fs')
const path = require('path')

class TaskScanner {
	constructor(config, fileService, parser) {
		this.config = config
		this.fileService = fileService
		this.parser = parser
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

	buildTasks(targetDir) {
		let tasks = []

		if (this.config.include && Object.keys(this.config.include).length > 0) {
			console.log(`\n📋 Manuelle Config-Liste erkannt. Lese Pfade und Regeln...`)

			const isArray = Array.isArray(this.config.include)
			const entries = isArray ? this.config.include.map((item) => ({ key: item, val: null })) : Object.entries(this.config.include).map(([k, v]) => ({ key: k, val: v }))

			for (const { key, val } of entries) {
				const absPath = path.resolve(process.cwd(), key)
				if (!fs.existsSync(absPath)) {
					console.log(`  ⚠️ Pfad nicht gefunden, überspringe: ${key}`)
					continue
				}

				let customCategory = val?.category || (typeof val === 'string' ? val : null)
				let customName = val?.name || null

				const stat = fs.statSync(absPath)
				if (stat.isFile()) {
					if (this.parser.extensions.some((ext) => absPath.endsWith(ext))) {
						tasks.push({ file: absPath, category: customCategory || this.getCategory(absPath), name: customName })
					}
				} else if (stat.isDirectory()) {
					const dirFiles = this.fileService.scanDirectory(absPath, this.parser.extensions)
					for (const f of dirFiles) {
						const content = this.fileService.readFile(f)
						if (this.parser.needsMigration(content, this.config.prefix, this.config.whitelist)) {
							tasks.push({ file: f, category: customCategory || this.getCategory(f), name: null })
						}
					}
				}
			}
		} else {
			console.log(`\n🔍 Auto-Scan: Scanne '${targetDir}' nach '${this.config.prefix}'-Klassen...\n`)
			const allFiles = this.fileService.scanDirectory(targetDir, this.parser.extensions)
			for (const f of allFiles) {
				const content = this.fileService.readFile(f)
				if (this.parser.needsMigration(content, this.config.prefix, this.config.whitelist)) {
					tasks.push({ file: f, category: this.getCategory(f), name: null })
				}
			}
		}

		return this._removeDuplicates(tasks)
	}
}

module.exports = TaskScanner
