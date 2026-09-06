#!/usr/bin/env node

const args = process.argv.slice(2)

if (args[0] === 'utils') {
	const UtilsCommand = require('../lib/commands/UtilsCommand')
	new UtilsCommand().execute()
} else if (args[0] === 'mixins') {
	const MixinsCommand = require('../lib/commands/MixinsCommand')
	new MixinsCommand().execute()
} else {
	const MigrateCommand = require('../lib/commands/MigrateCommand')
	new MigrateCommand().execute()
}
