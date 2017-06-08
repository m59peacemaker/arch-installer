const prepareDisk = require('./prepare-disk')
const setupLocale = require('./setup-locale')
const enableTimeSync = require('./enable-time-sync')

setupLocale()
  .then(enableTimeSync)
  .then(prepareDisk)
  .catch(err => {
    console.error(err.message || err.err || err.stderr)
    err.code && process.exit(err.code)
  })
