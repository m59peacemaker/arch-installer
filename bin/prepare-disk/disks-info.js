const { execFile } = require('child_process')
const pify = require('pify')
const execFileAsync = pify(execFile, { multiArgs: true })

const parseDisk = string => {
  const matches = string.match(/^Disk ([^:]+): \d+ \w+, (\d+) bytes, /)
  return {
    name: matches[1],
    bytes: Number(matches[2])
  }
}

const disksInfo = () => execFileAsync('fdisk', [ '--list' ])
  .then(([ stdout ]) => stdout
    .split(/\n{2,}/)
    .filter(v => /^Disk /.test(v))
    .map(parseDisk)
  )

module.exports = disksInfo
