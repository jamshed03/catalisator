const UtilsLibrary = require('../migrator/lib/services/UtilsLibrary')

describe('UtilsLibrary', () => {
	let catalog

	beforeAll(() => {
		catalog = UtilsLibrary.build()
	})

	test('registers a mixin-free class with no media condition', () => {
		expect(catalog.get('u-flex')).toEqual([{ media: null, decls: 'display: flex;' }])
	})

	test('registers a responsive class under its breakpoint media condition', () => {
		const variants = catalog.get('u-col-md-6')
		expect(variants).toHaveLength(1)
		expect(variants[0].media).toBe('(min-width: 48em)')
		expect(variants[0].decls).toContain('grid-column: span 6 / span 6')
	})

	test('registers every progressive breakpoint variant of a repeated selector like .u-container', () => {
		const variants = catalog.get('u-container')
		expect(variants).toHaveLength(6)
		expect(variants[0].media).toBeNull()
		expect(variants.slice(1).map((v) => v.media)).toEqual(['(min-width: 40em)', '(min-width: 48em)', '(min-width: 64em)', '(min-width: 80em)', '(min-width: 96em)'])
	})

	test('does not register non-class selectors', () => {
		expect(catalog.has('body')).toBe(false)
	})
})
