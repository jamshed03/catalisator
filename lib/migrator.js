const fs = require('fs')
const path = require('path')
const postcss = require('postcss')
const tailwindv4 = require('@tailwindcss/postcss')

class TailwindToScssMigrator {
	constructor(config = {}) {
		this.frontend = config.frontend || 'next.js'
		this.prefix = config.prefix || 'ka'
		this.stylesheet = config.stylesheet || 'scss'
		this.dryRun = config.dryRun || false

		this.paths = {
			outputBase: path.resolve(config.outputBase || './src/styles'),
			cssEntry: path.resolve(config.cssEntry || './src/app/[locale]/globals.css'),
			outputEntry: path.resolve(config.outputEntry || './src/app/[locale]/globals.scss'),
			tailwind: require.resolve('tailwindcss/index.css'),
		}

		this.whitelist = config.whitelist || ['container', 'material-symbols-outlined']
		this._initFileSystem()
		this.themeContent = this._loadTheme()
		this._setupBaseFiles()
	}

	_initFileSystem() {
		if (!fs.existsSync(this.paths.outputBase)) {
			fs.mkdirSync(this.paths.outputBase, { recursive: true })
		}
	}

	_loadTheme() {
		if (!fs.existsSync(this.paths.cssEntry)) return ''
		return fs.readFileSync(this.paths.cssEntry, 'utf8').replace(/@import\s+['"]tailwindcss['"];/g, '')
	}

	_setupBaseFiles() {
		const varPath = path.join(this.paths.outputBase, '_variables.scss')
		if (!fs.existsSync(varPath)) {
			const vars = this.themeContent.match(/--[\w-]+:\s*[^;]+;/g) || []
			const content = `:root {\n  --spacing: 0.25rem;\n  ${vars.join('\n  ')}\n}\n\n@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`
			if (!this.dryRun) fs.writeFileSync(varPath, content)
		}

		const outputEntryDir = path.dirname(this.paths.outputEntry)
		if (!this.dryRun && !fs.existsSync(outputEntryDir)) fs.mkdirSync(outputEntryDir, { recursive: true })

		if (!fs.existsSync(this.paths.outputEntry)) {
			const relVarsPath = path.relative(outputEntryDir, varPath).replace(/\\/g, '/').replace('.scss', '')
			if (!this.dryRun) fs.writeFileSync(this.paths.outputEntry, `@use '${relVarsPath}' as *;\n\n.container { max-width: 1280px; margin: 0 auto; }\n`)
		}
	}

	async _translateClasses(classList) {
		if (!classList?.trim()) return null

		const classes = classList
			.trim()
			.split(/\s+/)
			.filter((c) => !this.whitelist.includes(c))
		let allRules = []

		for (const cls of classes) {
			const inputCss = `@import "${this.paths.tailwind}";\n${this.themeContent}\n.extract-target { @apply ${cls}; }`

			try {
				const result = await postcss([tailwindv4()]).process(inputCss, { from: undefined })
				const targetSelector = '.extract-target {'
				const startIdx = result.css.indexOf(targetSelector)

				if (startIdx !== -1) {
					let braceCount = 0
					let endIdx = -1
					for (let i = startIdx + targetSelector.length; i < result.css.length; i++) {
						if (result.css[i] === '{') braceCount++
						if (result.css[i] === '}') {
							if (braceCount === 0) {
								endIdx = i
								break
							}
							braceCount--
						}
					}

					if (endIdx !== -1) {
						const innerCss = result.css.slice(startIdx + targetSelector.length, endIdx).trim()
						const cleanedLines = innerCss
							.split('\n')
							.map((line) => {
								let l = line.trim()
								if (l.startsWith('scale:')) {
									const m = cls.match(/scale-(\d+)/)
									return m ? `scale: ${m[1] / 100};` : l
								}
								let cleaned = l.replace(/var\(--tw-[^,]+,\s*([^)]+)\)/g, '$1')
								if (cleaned.includes('--tw-') || cleaned.startsWith('--tw-')) return null
								return cleaned
							})
							.filter(Boolean)

						allRules.push(...cleanedLines)
					}
				}
			} catch (e) {
				allRules.push(`/* Error translating [${cls}] */`)
			}
		}
		return this._formatAndSortRules(allRules)
	}

	_formatAndSortRules(rules) {
		if (rules.length === 0) return null

		const normalRules = []
		const nestedRules = []
		let inNested = false
		let braceLevel = 0

		rules.forEach((line) => {
			const trimmed = line.trim()
			if (trimmed.startsWith('&') || trimmed.startsWith('@') || inNested) {
				inNested = true
				nestedRules.push(line)
				if (trimmed.includes('{')) braceLevel++
				if (trimmed.includes('}')) braceLevel--
				if (braceLevel === 0) inNested = false
			} else {
				normalRules.push(line)
			}
		})
		return [...normalRules, ...nestedRules].join('\n    ')
	}

	async _processTailwindClass(cls) {
		const inputCss = `@import "${this.paths.tailwind}";\n${this.themeContent}\n.extract-target { @apply ${cls}; }`

		try {
			const result = await postcss([tailwindv4()]).process(inputCss, { from: undefined })
			const cssMatch = result.css.match(/\.extract-target\s*\{([\s\S]*?)\}/)
			if (!cssMatch) return null

			return cssMatch[1]
				.split('\n')
				.map((line) => this._cleanAndTransformCssLine(line.trim(), cls))
				.filter(Boolean)
		} catch (e) {
			return [`/* Error translating [${cls}]: Not in @theme? */`]
		}
	}

	_cleanAndTransformCssLine(line, originalClass) {
		if (!line || line.includes('--tw-')) return null

		if (line.startsWith('scale:')) {
			const m = originalClass.match(/scale-(\d+)/)
			return m ? `scale: ${m[1] / 100};` : line
		}
		if (line.startsWith('rotate:')) {
			const m = originalClass.match(/rotate-(\d+)/)
			return m ? `rotate: ${m[1]}deg;` : line
		}
		if (line.startsWith('translate:')) {
			const xM = originalClass.match(/translate-x-(\d+)/)
			const yM = originalClass.match(/translate-y-(\d+)/)
			const x = xM ? `calc(var(--spacing) * ${xM[1]})` : '0'
			const y = yM ? `calc(var(--spacing) * ${yM[1]})` : '0'
			return `translate: ${x} ${y};`
		}

		return line.replace(/var\(--tw-[^,]+,\s*([^)]+)\)/g, '$1')
	}

	_getCleanTag(fullTag, originalClasses) {
		const remaining = originalClasses
			.split(' ')
			.filter((c) => this.whitelist.includes(c))
			.join(' ')
		return fullTag
			.replace(`className='${originalClasses}'`, remaining ? `className='${remaining}'` : '')
			.replace(/\s{2,}/g, ' ')
			.replace(' >', '>')
			.trim()
	}

	async migrate(targetFile, categoryDir = null, customName = null) {
		const absTarget = path.resolve(targetFile)
		if (!fs.existsSync(absTarget)) return

		let fileName = customName || path.basename(absTarget, '.tsx')
		if (!customName && (fileName === 'page' || fileName === 'layout')) {
			const parentDir = path.basename(path.dirname(absTarget)).replace(/[\(\)\[\]]/g, '')
			fileName = parentDir || (fileName === 'page' ? 'home' : 'root')
		}

		const scssPath = this._getScssPath(absTarget, fileName, categoryDir)
		console.log(`\n🚀 Migriere: ${targetFile}`)

		let jsxContent = fs.readFileSync(absTarget, 'utf8')
		let scssHeader = fs.existsSync(scssPath) ? fs.readFileSync(scssPath, 'utf8').split('\n\n.')[0] : this._getScssHeader(scssPath, fileName)

		const prefixRegex = new RegExp(`className=(['"])(${this.prefix}[a-zA-Z0-9_-]+)\\s*([^'"]*)\\1`, 'g')
		const matches = [...jsxContent.matchAll(prefixRegex)]

		matches.sort((a, b) => a.index - b.index)

		let collectedRules = []
		let hasChanges = false

		for (const match of [...matches].reverse()) {
			const [fullMatch, quoteType, customClass, twClasses] = match
			const translatedRules = await this._translateClasses(twClasses)

			if (translatedRules) {
				hasChanges = true

				collectedRules.unshift({ name: customClass, rules: translatedRules })

				const remaining = twClasses
					.split(' ')
					.filter((c) => this.whitelist.includes(c))
					.join(' ')
				const cleanClassName = `className=${quoteType}${customClass}${remaining ? ' ' + remaining : ''}${quoteType}`
				jsxContent = jsxContent.replace(fullMatch, cleanClassName)
			}
		}

		if (!hasChanges) {
			console.log(`⚡ Keine neuen Tailwind-Klassen gefunden. Überspringe Speichern.`)
			return
		}

		const cssBlock = collectedRules.map((r) => `.${r.name} {\n    ${r.rules}\n}`).join('\n\n')
		const finalScss = `${scssHeader}\n\n${cssBlock}\n`

		this._saveFiles(absTarget, jsxContent, scssPath, finalScss)
	}

	_getScssPath(absTarget, fileName, categoryDir) {
		return categoryDir ? path.join(this.paths.outputBase, categoryDir, `_${fileName}.scss`) : path.join(path.dirname(absTarget), `${fileName}.generated.scss`)
	}

	_getScssHeader(scssPath, fileName) {
		const relVarsPath = path.relative(path.dirname(scssPath), path.join(this.paths.outputBase, 'variables')).replace(/\\/g, '/')
		return `// Generated for ${fileName}\n@use '${relVarsPath}' as *;\n\n`
	}

	_getInnerHtml(content, fullTag, tagName) {
		const startIdx = content.indexOf(fullTag)
		const rest = content.slice(startIdx)
		const endTag = `</${tagName}>`
		const endIdx = rest.indexOf(endTag)
		return { innerHTML: rest.slice(fullTag.length, endIdx) }
	}

	_saveFiles(absTarget, jsx, scssPath, scss) {
		if (this.dryRun) {
			console.log(`  [DRY RUN] 🛑 Schreibschutz aktiv. Würde folgende Dateien speichern:`)
			console.log(`    -> JSX: ${path.basename(absTarget)}`)
			console.log(`    -> SCSS: ${path.basename(scssPath)}\n`)
			return
		}

		const dir = path.dirname(scssPath)
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

		fs.writeFileSync(absTarget, jsx)
		fs.writeFileSync(scssPath, scss)
		this._registerInGlobals(scssPath)
		console.log(`✅ ${path.basename(absTarget)} erfolgreich aktualisiert.`)
	}

	_registerInGlobals(scssPath) {
		const globalsPath = this.paths.outputEntry
		const globalsDir = path.dirname(globalsPath)
		const relImport = path.relative(globalsDir, scssPath).replace(/\\/g, '/').replace('.scss', '').replace('/_', '/')

		let globals = fs.readFileSync(globalsPath, 'utf8')
		if (!globals.includes(relImport)) {
			fs.appendFileSync(globalsPath, `@use '${relImport}';\n`)
		}
	}
}

module.exports = TailwindToScssMigrator
