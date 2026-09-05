const path = require('path')
const fs = require('fs')

jest.mock('fs')

const UtilsCommand = require('../lib/commands/UtilsCommand')

describe('UtilsCommand', () => {
	const originalArgv = process.argv

	beforeEach(() => {
		jest.clearAllMocks()
		fs.existsSync.mockReturnValue(false)
		fs.mkdirSync.mockReturnValue(undefined)
		fs.writeFileSync.mockReturnValue(undefined)
		fs.readFileSync.mockImplementation((filePath) => {
			if (filePath.includes('flex.css')) return '.{{prefix}}flex { display: flex; }\n'
			if (filePath.includes('container.css')) return '.{{prefix}}container { width: 100%; }\n'
			if (filePath.includes('grid.css')) return '.{{prefix}}grid { display: grid; }\n'
			return ''
		})
	})

	afterEach(() => {
		process.argv = originalArgv
	})

	test('substitutes {{prefix}} with configured utilsPrefix', () => {
		process.argv = ['node', 'cli.js', 'utils', 'flex']
		const cmd = new UtilsCommand()
		cmd.execute()

		const [, content] = fs.writeFileSync.mock.calls[0]
		expect(content).toBe('.u-flex { display: flex; }\n')
	})

	test('writes .scss with leading underscore when stylesheet is scss', () => {
		fs.existsSync.mockImplementation((p) => p.endsWith('catalisator.config.json'))
		fs.readFileSync.mockImplementation((filePath) => {
			if (filePath.endsWith('catalisator.config.json')) return JSON.stringify({ stylesheet: 'scss' })
			return '.{{prefix}}flex { display: flex; }\n'
		})

		process.argv = ['node', 'cli.js', 'utils', 'flex']
		const cmd = new UtilsCommand()
		cmd.execute()

		const [outputPath] = fs.writeFileSync.mock.calls[0]
		expect(path.basename(outputPath)).toBe('_flex.scss')
	})

	test('writes .css without underscore when stylesheet is css', () => {
		fs.existsSync.mockImplementation((p) => p.endsWith('catalisator.config.json'))
		fs.readFileSync.mockImplementation((filePath) => {
			if (filePath.endsWith('catalisator.config.json')) return JSON.stringify({ stylesheet: 'css' })
			return '.{{prefix}}flex { display: flex; }\n'
		})

		process.argv = ['node', 'cli.js', 'utils', 'flex']
		const cmd = new UtilsCommand()
		cmd.execute()

		const [outputPath] = fs.writeFileSync.mock.calls[0]
		expect(path.basename(outputPath)).toBe('flex.css')
	})

	test('dry run does not call writeFileSync', () => {
		process.argv = ['node', 'cli.js', 'utils', '--dry']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).not.toHaveBeenCalled()
	})

	test('filters modules by CLI args, generating only requested ones', () => {
		process.argv = ['node', 'cli.js', 'utils', 'grid']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
		const [outputPath] = fs.writeFileSync.mock.calls[0]
		expect(path.basename(outputPath)).toBe('_grid.scss')
	})

	test('with no module args and default config, generates all modules from utilsModules default', () => {
		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).toHaveBeenCalledTimes(3)
	})
})
