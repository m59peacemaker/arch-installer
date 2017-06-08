const { spawn } = require('child_process')
const pifyProc = require('../../lib/pify-proc')

const wipeDrive = driveName => pifyProc(spawn(
  'dd',
  [ 'if=/dev/zero', `of=${driveName}`, 'bs=512', 'count=1' ],
  { stdio: 'inherit' }
))

module.exports = wipeDrive
