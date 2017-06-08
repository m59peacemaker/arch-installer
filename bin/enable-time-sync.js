const { spawn } = require('child_process')
const pifyProc = require('../lib/pify-proc')
const out = (...args) =>process.stdout.write(...args)

const toggleTimeSynchronization = on => pifyProc(
  spawn('timedatectl', [ 'set-ntp', on ], { stdio: 'inherit' })
)

const enableTimeSync = () => {
  out('Enabling time synchronization... ')
  return toggleTimeSynchronization(true)
    .then(() => out('done'))
}

module.exports = enableTimeSync
