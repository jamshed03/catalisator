const fs = require('fs')
const path = require('path')
const postcss = require('postcss')

class UtilsLibrary {
	static build() {
		const utilsDir = path.join(__dirname, '../../../css/utils')
		const catalog = new Map() // className -> Array<{ media: string|null, decls: string }>

		for (const file of fs.readdirSync(utilsDir).filter((f) => f.endsWith('.css'))) {
			const root = postcss.parse(fs.readFileSync(path.join(utilsDir, file), 'utf8'))
			root.walkRules((rule) => {
				const media = rule.parent.type === 'atrule' && rule.parent.name === 'media' ? rule.parent.params : null
				const decls = rule.nodes.map((n) => `${n.prop}: ${n.value};`).join('\n')

				for (const selector of rule.selectors) {
					const match = selector.match(/^\.([\w-]+)$/)
					if (!match) continue

					const name = match[1]
					if (!catalog.has(name)) catalog.set(name, [])
					catalog.get(name).push({ media, decls })
				}
			})
		}

		return catalog
	}
}

module.exports = UtilsLibrary
