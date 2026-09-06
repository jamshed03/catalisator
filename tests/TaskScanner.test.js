const TaskScanner = require('../migrator/lib/services/TaskScanner')

describe('TaskScanner', () => {
	let scanner

	beforeEach(() => {
		const mockConfig = { prefix: 'ka', include: [] }
		const mockFileService = {}
		const mockParser = {}

		scanner = new TaskScanner(mockConfig, mockFileService, mockParser)
	})

	test('getCategory() sollte "layouts" für layout-Dateien zurückgeben', () => {
		const result = scanner.getCategory('/app/components/layout.tsx')
		expect(result).toBe('layouts')
	})

	test('getCategory() sollte "pages" für Dateien im /app/ Ordner zurückgeben', () => {
		const result = scanner.getCategory('/app/dashboard/index.tsx')
		expect(result).toBe('pages')
	})
})
