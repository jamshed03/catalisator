class MigrationAdapter {
	constructor(config, parser, translator, formatter) {
		this.config = config
		this.parser = parser
		this.translator = translator
		this.formatter = formatter
	}

	input(fileContent) {
		return this.parser.extract(fileContent, this.config.prefix)
	}

	async migrate(matches) {
		let migratedData = []
		const sortedMatches = [...matches].sort((a, b) => b.index - a.index)

		for (const match of sortedMatches) {
			const translatedRules = await this.translator.translate(match.twClasses, {
				whitelist: this.config.whitelist,
				cssEntry: this.config.cssEntry,
			})

			if (translatedRules) {
				migratedData.push({
					match: match,
					name: match.customClass,
					rules: translatedRules,
				})
			}
		}
		return migratedData
	}

	output(originalContent, migratedData, styleHeader) {
		let newJsx = originalContent
		let cssBlocks = []

		for (const data of migratedData) {
			newJsx = this.parser.replace(newJsx, data.match, this.config.whitelist)
			cssBlocks.push(this.formatter.formatBlock(data.name, data.rules))
		}

		const finalStyles = `${styleHeader}\n\n${cssBlocks.reverse().join('\n\n')}\n`

		return {
			markup: newJsx,
			stylesheet: finalStyles,
		}
	}
}

module.exports = MigrationAdapter
