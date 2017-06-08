const { spawn } = require('child_process')
const pifyProc = require('./pify-proc')

const fdisk = (out, lines, driveName) => {
  const p = spawn('fdisk', [ driveName ])
  p.stdout.on('data', out)
  const echo = spawn('echo', [ '-e', lines.join('\n') ])
  echo.stdout.pipe(p.stdin)
  echo.stdout.on('data', out)
  return pifyProc(p)
}

module.exports = fdisk
