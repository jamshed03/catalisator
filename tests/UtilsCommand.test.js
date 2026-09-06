const path = require('path')
const fs = require('fs')

jest.mock('fs')
jest.mock('../migrator/lib/services/UtilsLibrary')

const UtilsLibrary = require('../migrator/lib/services/UtilsLibrary')
const UtilsCommand = require('../migrator/lib/commands/UtilsCommand')

const FAKE_CATALOG = new Map([
	['u-flex', [{ media: null, decls: 'display: flex;' }]],
	['u-container', [
		{ media: null, decls: 'width: 100%;' },
		{ media: '(min-width: 40em)', decls: 'max-width: 40em;' },
	]],
	['u-col-md-6', [{ media: '(min-width: 48em)', decls: 'flex: 0 0 50%;' }]],
	// synthetic case for the merge regression: two separate declaration blocks
	// registered under the same class name and media: null
	['u-col-12', [
		{ media: null, decls: 'width: 100%;\npadding-left: calc(var(--u-space-md, 1rem)/2);' },
		{ media: null, decls: 'flex: 0 0 100%;\nmax-width: 100%;' },
	]],
])

describe('UtilsCommand', () => {
	const originalArgv = process.argv

	beforeEach(() => {
		jest.clearAllMocks()
		UtilsLibrary.build.mockReturnValue(FAKE_CATALOG)

		fs.existsSync.mockImplementation((p) => !p.endsWith('catalisator.config.json'))
		fs.statSync.mockReturnValue({ isDirectory: () => false })
		fs.readdirSync.mockReturnValue(['Page.jsx'])
		fs.readFileSync.mockReturnValue('<div className="u-flex u-container not-a-util-class"></div>')
	})

	afterEach(() => {
		process.argv = originalArgv
	})

	test('scanUsedClasses only keeps tokens present in the catalog', () => {
		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()
		const used = cmd.scanUsedClasses(FAKE_CATALOG)

		expect(used).toEqual(new Set(['u-flex', 'u-container']))
	})

	test('buildOutput groups classes by shared media condition, including a repeated selector at multiple breakpoints', () => {
		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()
		const output = cmd.buildOutput(FAKE_CATALOG, new Set(['u-flex', 'u-container', 'u-col-md-6']))

		expect(output).toContain('.u-flex {\n\tdisplay: flex;\n}')
		expect(output).toContain('.u-container {\n\twidth: 100%;\n}')
		expect(output).toMatch(/@media \(min-width: 40em\) \{\n\t\.u-container \{\n\t\tmax-width: 40em;\n\t\}\n\}/)
		expect(output).toMatch(/@media \(min-width: 48em\) \{\n\t\.u-col-md-6 \{\n\t\tflex: 0 0 50%;\n\t\}\n\}/)
	})

	test('buildOutput merges multiple non-media declaration blocks for the same class into one rule (regression: row.css duplicate .u-col-12)', () => {
		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()
		const output = cmd.buildOutput(FAKE_CATALOG, new Set(['u-col-12']))

		expect(output.match(/\.u-col-12 \{/g)).toHaveLength(1)
		expect(output).toBe(
			'.u-col-12 {\n\twidth: 100%;\n\tpadding-left: calc(var(--u-space-md, 1rem)/2);\n\tflex: 0 0 100%;\n\tmax-width: 100%;\n}\n'
		)
	})

	test('dry run does not call writeFileSync', () => {
		process.argv = ['node', 'cli.js', 'utils', '--dry']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).not.toHaveBeenCalled()
	})

	test('writes the generated file at the configured output path', () => {
		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
		const [outputPath] = fs.writeFileSync.mock.calls[0]
		expect(path.basename(outputPath)).toBe('utils.generated.scss')
	})

	test('writes nothing when no known classes are used', () => {
		fs.readFileSync.mockReturnValue('<div className="not-a-util-class"></div>')
		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).not.toHaveBeenCalled()
	})

	test('uses utilsScanDir/utilsOutputBase from catalisator.config.json when no CLI dir is given', () => {
		fs.existsSync.mockImplementation((p) => true)
		fs.readFileSync.mockImplementation((p) => {
			if (String(p).endsWith('catalisator.config.json')) {
				return JSON.stringify({ utilsScanDir: './app', utilsOutputBase: './app/styles' })
			}
			return '<div className="u-flex"></div>'
		})

		process.argv = ['node', 'cli.js', 'utils']
		const cmd = new UtilsCommand()

		expect(cmd.targetDir).toBe('./app')
		cmd.execute()

		const [outputPath] = fs.writeFileSync.mock.calls[0]
		expect(outputPath).toContain(`${path.sep}app${path.sep}styles${path.sep}`)
	})

	test('--watch sets up fs.watch on the target dir and re-runs (debounced) on a matching file change', () => {
		jest.useFakeTimers()
		let watchCallback
		fs.watch.mockImplementation((dir, options, callback) => {
			watchCallback = callback
		})

		process.argv = ['node', 'cli.js', 'utils', '--watch']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.watch).toHaveBeenCalledWith('./src', { recursive: true }, expect.any(Function))
		expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

		watchCallback('change', 'Page.jsx')
		jest.advanceTimersByTime(200)

		expect(fs.writeFileSync).toHaveBeenCalledTimes(2)

		jest.useRealTimers()
	})

	test('--watch ignores changes to files with an unrelated extension', () => {
		jest.useFakeTimers()
		let watchCallback
		fs.watch.mockImplementation((dir, options, callback) => {
			watchCallback = callback
		})

		process.argv = ['node', 'cli.js', 'utils', '--watch']
		const cmd = new UtilsCommand()
		cmd.execute()

		expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

		watchCallback('change', 'styles.css')
		jest.advanceTimersByTime(200)

		expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

		jest.useRealTimers()
	})

	test('a CLI directory argument overrides utilsScanDir from config', () => {
		fs.existsSync.mockImplementation((p) => !String(p).endsWith('catalisator.config.json') || true)
		fs.readFileSync.mockImplementation((p) => {
			if (String(p).endsWith('catalisator.config.json')) {
				return JSON.stringify({ utilsScanDir: './app' })
			}
			return '<div className="u-flex"></div>'
		})

		process.argv = ['node', 'cli.js', 'utils', './custom-dir']
		const cmd = new UtilsCommand()

		expect(cmd.targetDir).toBe('./custom-dir')
	})
})
