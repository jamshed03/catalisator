const postcss = require('postcss')
const tailwindv4 = require('@tailwindcss/postcss')
const fs = require('fs')

module.exports = {
	getGlobalVariables: (cssEntry) => {
		if (!cssEntry || !fs.existsSync(cssEntry)) return []
		const content = fs.readFileSync(cssEntry, 'utf8').replace(/@import\s+['"]tailwindcss['"];/g, '')
		return content.match(/--[\w-]+:\s*[^;]+;/g) || []
	},

	translate: async (classList, config) => {
		if (!classList?.trim()) return null

		const classes = classList
			.trim()
			.split(/\s+/)
			.filter((c) => !config.whitelist.includes(c))

		let allRules = []

		const tailwindPath = require.resolve('tailwindcss/index.css')
		let themeContent = ''
		if (config.cssEntry && fs.existsSync(config.cssEntry)) {
			themeContent = fs.readFileSync(config.cssEntry, 'utf8').replace(/@import\s+['"]tailwindcss['"];/g, '')
		}

		for (const cls of classes) {
			const inputCss = `@import "${tailwindPath}";\n${themeContent}\n.extract-target { @apply ${cls}; }`

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

		if (allRules.length === 0) return null

		const normalRules = []
		const nestedRules = []
		let inNested = false
		let braceLevel = 0

		allRules.forEach((line) => {
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
	},
}
