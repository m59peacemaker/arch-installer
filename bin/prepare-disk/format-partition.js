const { spawn } = require('child_process')
const pifyProc = require('../../lib/pify-proc')
// TODO: make/use a general mkfs JS API

const formatPartition = (partition, { type = 'ext4', force = false }) => {
  const args = [
    '-t', type,
    force ? '-F' : undefined,
    partition
  ].filter(v => v)
  return pifyProc(spawn('mkfs', args, { stdio: 'inherit' }))
}

module.exports = formatPartition
