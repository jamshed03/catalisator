const path = require('path')
const fs = require('fs')

jest.mock('fs')

const MixinsCommand = require('../migrator/lib/commands/MixinsCommand')

describe('MixinsCommand', () => {
	const originalArgv = process.argv

	beforeEach(() => {
		jest.clearAllMocks()
		fs.existsSync.mockImplementation((p) => !String(p).endsWith('catalisator.config.json'))
		fs.readFileSync.mockImplementation((p) => `content of ${p}`)
	})

	afterEach(() => {
		process.argv = originalArgv
	})

	test('defaults to scss format, copying the 4 mixin/variable partials preserving their relative layout', () => {
		process.argv = ['node', 'cli.js', 'mixins']
		const cmd = new MixinsCommand()
		cmd.execute()

		expect(fs.writeFileSync).toHaveBeenCalledTimes(4)
		const written = fs.writeFileSync.mock.calls.map(([p]) => p)
		expect(written.some((p) => p.endsWith(`${path.sep}_variables.scss`))).toBe(true)
		expect(written.some((p) => p.endsWith(path.join('mixins', '_breakpoints.scss')))).toBe(true)
		expect(written.some((p) => p.endsWith(path.join('mixins', '_rfs.scss')))).toBe(true)
		expect(written.some((p) => p.endsWith(path.join('mixins', '_shortcuts.scss')))).toBe(true)
	})

	test('respects mixinsFormat: postcss from catalisator.config.json', () => {
		fs.existsSync.mockReturnValue(true)
		fs.readFileSync.mockImplementation((p) => {
			if (String(p).endsWith('catalisator.config.json')) {
				return JSON.stringify({ mixinsFormat: 'postcss', mixinsOutputBase: './styles/mixins-pc' })
			}
			return `content of ${p}`
		})

		process.argv = ['node', 'cli.js', 'mixins']
		const cmd = new MixinsCommand()
		cmd.execute()

		expect(fs.writeFileSync).toHaveBeenCalledTimes(4)
		const written = fs.writeFileSync.mock.calls.map(([p]) => p)
		expect(written.every((p) => p.includes(path.join('styles', 'mixins-pc')))).toBe(true)
		expect(written.some((p) => p.endsWith(`${path.sep}variables.css`))).toBe(true)
		expect(written.some((p) => p.endsWith(path.join('mixins', 'breakpoints.css')))).toBe(true)
	})

	test('falls back to scss for an unknown mixinsFormat', () => {
		fs.existsSync.mockReturnValue(true)
		fs.readFileSync.mockImplementation((p) => {
			if (String(p).endsWith('catalisator.config.json')) {
				return JSON.stringify({ mixinsFormat: 'less' })
			}
			return `content of ${p}`
		})

		process.argv = ['node', 'cli.js', 'mixins']
		const cmd = new MixinsCommand()

		expect(cmd.config.mixinsFormat).toBe('scss')
	})

	test('dry run does not call writeFileSync', () => {
		process.argv = ['node', 'cli.js', 'mixins', '--dry']
		const cmd = new MixinsCommand()
		cmd.execute()

		expect(fs.writeFileSync).not.toHaveBeenCalled()
	})
})
