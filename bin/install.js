const prepareDisk = require('./prepare-disk')
const setupLocale = require('./setup-locale')

prepareDisk()
  .catch(console.error)
