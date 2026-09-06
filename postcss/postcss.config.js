module.exports = {
	plugins: [
		require('postcss-import'),
		require('postcss-advanced-variables'),
		require('postcss-functions')({
			functions: {
				stripUnit: function (value) {
					return parseFloat(value)
				},
			},
		}),
		require('postcss-calc'),
		require('postcss-nested'),
	],
}
