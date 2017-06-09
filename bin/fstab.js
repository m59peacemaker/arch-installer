const { execFile } = require('child_process')
const { appendFile } = require('fs')
const pify = require('pify')
const execFileAsync = pify(execFile, { multiArgs: true })
const appendFileAsync = pify(appendFile)

const fstab = (drive, file) => execFileAsync('genfstab', [ '-U', drive ])
  .then(([ err, stdout, stderr ]) => appendFileAsync(file))

module.exports = fstab
