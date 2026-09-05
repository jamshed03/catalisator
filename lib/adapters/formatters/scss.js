module.exports = {
	extension: '.scss',
	variablesFile: '_variables.scss',

	formatHeader: (fileName, relVarsPath) => {
		const cleanPath = relVarsPath.replace('.scss', '').replace('/_', '/')
		return `// Generated for ${fileName}\n@use '${cleanPath}' as *;\n\n`
	},

	formatBlock: (name, rules) => `.${name} {\n${rules}\n}`,

	formatGlobalImport: (relImport) => {
		const cleanPath = relImport.replace('.scss', '').replace('/_', '/')
		return `@use '${cleanPath}';\n`
	},

	formatPartialFileName: (name) => `_${name}.scss`,
}
