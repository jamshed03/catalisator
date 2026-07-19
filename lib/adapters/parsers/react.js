module.exports = {
	extensions: ['.tsx', '.jsx'],

	needsMigration: (content, prefix, whitelist) => {
		const prefixRegex = new RegExp(`className=(['"])(${prefix}[a-zA-Z0-9_-]+)\\s*([^'"]*)\\1`, 'g')
		let match
		while ((match = prefixRegex.exec(content)) !== null) {
			const extraClasses = match[3].trim()
			if (!extraClasses) continue
			const hasUnmigrated = extraClasses.split(/\s+/).some((c) => c && !whitelist.includes(c))
			if (hasUnmigrated) return true
		}
		return false
	},

	extract: (content, prefix) => {
		const prefixRegex = new RegExp(`className=(['"])(${prefix}[a-zA-Z0-9_-]+)\\s*([^'"]*)\\1`, 'g')
		const matches = [...content.matchAll(prefixRegex)]

		return matches.map((m) => ({
			fullMatch: m[0],
			quoteType: m[1],
			customClass: m[2],
			twClasses: m[3],
			index: m.index,
		}))
	},

	replace: (content, match, whitelist) => {
		const remaining = match.twClasses
			.split(' ')
			.filter((c) => whitelist.includes(c))
			.join(' ')

		const cleanClassName = `className=${match.quoteType}${match.customClass}${remaining ? ' ' + remaining : ''}${match.quoteType}`
		return content.replace(match.fullMatch, cleanClassName)
	},
}
