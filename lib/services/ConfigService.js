const fs = require('fs')
const path = require('path')

class ConfigService {
	static load(defaultConfig) {
		const configPath = path.resolve(process.cwd(), 'catalisator.config.json')
		let config = { ...defaultConfig }

		if (fs.existsSync(configPath)) {
			config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
		}

		return config
	}
}

module.exports = ConfigService
