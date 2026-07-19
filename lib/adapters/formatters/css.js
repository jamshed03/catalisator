module.exports = {
	extension: '.css',
	variablesFile: 'variables.css',

	formatHeader: (fileName, relVarsPath) => {
		return `/* Generated for ${fileName} */\n@import url('${relVarsPath}');\n\n`
	},

	formatBlock: (name, rules) => `.${name} {\n    ${rules}\n}`,

	formatGlobalImport: (relImport) => {
		return `@import url('${relImport}');\n`
	},
}
