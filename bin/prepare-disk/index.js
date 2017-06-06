const { execFile, spawn } = require('child_process')
const pify = require('pify')
const execFileAsync = pify(execFile, { multiArgs: true })
const { prompt } = require('inquirer')
const bytesToGB = bytes => bytes / 1000 / 1000 / 1000
const GBToBytes = GB => GB * 1000 * 1000 * 1000
const out = (...args) => process.stdout.write(...args)

const MIN_DRIVE_GB = 5
const MIN_DRIVE_BYTES = GBToBytes(MIN_DRIVE_GB)

const parseDisk = string => {
  const matches = string.match(/^Disk ([^:]+): \d+ \w+, (\d+) bytes, /)
  return {
    name: matches[1],
    bytes: Number(matches[2])
  }
}

const listDisks = () => execFileAsync('fdisk', [ '--list' ])
  .then(([ stdout ]) => stdout
    .split(/\n{2,}/)
    .filter(v => /^Disk /.test(v))
    .map(parseDisk)
  )

const formatPartition = partition => new Promise((resolve, reject) => {
  const p = spawn('mkfs.ext4', [ partition ], { stdio: 'inherit' })
  p.on('error', reject)
  p.on('close', code => code === 0 ? resolve() : reject({ code }))
})

const mount = (partition, path) => new Promise((resolve, reject) => {
  const p = spawn('mount', [ partition, path ], { stdio: 'inherit' })
  p.on('error', reject)
  p.on('close', code => code === 0 ? resolve() : reject({ code }))
})

const createPartitionTable = driveName => new Promise((resolve, reject) => {
  const p = spawn('fdisk', [ driveName ])
  p.on('error', reject)
  p.on('close', code => code === 0 ? resolve() : reject({ code }))
  p.stdout.on('data', out)
  p.stdin.write('o\n')
  p.stdin.write('w\n')
})

const createPartition = ({ driveName, bytes, type, number }) => new Promise((resolve, reject) => {
  const p = spawn('fdisk', [ driveName ])
  p.on('error', reject)
  p.on('close', code => code === 0 ? resolve() : reject({ code }))
  p.stdout.on('data', out)
  p.stdin.write('n\n')
  type && p.stdin.write(type.slice(0, 1) + '\n')
  p.stdin.write((number || '') + '\n')
  p.stdin.write('\n')
  p.stdin.write(`+${(bytes) * 1000}K\n`)
  p.stdin.write('w\n')
})

const partitionDrive = (drive, swapBytes) => createPartition({
  driveName: drive.name,
  type:'primary',
  number: 1,
  bytes: drive.bytes - swapBytes
})
  .then(() => createParition({
    driveName: drive.name,
    type: 'extended',
    number: 2,
    bytes: swapBytes
  }))
  .then(() => createParition({
    driveName: drive.name,
    type: 'extended',
    bytes: swapBytes
  }))

const promptDrive = drives => prompt([{
  name: 'drive',
  type: 'list',
  message: 'Choose a drive:',
  choices: drives.map((drive, idx) => {
    const { name, bytes } = drive
    return {
      name: `${name} ${bytesToGB(bytes).toFixed(2)}GB`,
      value: drive
    }
  })
}]).then(answers => answers.drive)

const validateDrive = drive => {
  if (drive.bytes < MIN_DRIVE_BYTES) {
    const err = new Error(`${drive.name} must be at least ${MIN_DRIVE_GB}GB`)
    err.code = 'DRIVE_TOO_SMALL'
    throw err
  }
  return drive
}

const confirmDrive = drive => prompt([{
  name: 'confirmed',
  type: 'confirm',
  message: `${drive.name} will be erased. Are you sure you want to use this drive?`,
  default: false
}]).then(({ confirmed }) => ({ drive, confirmed }))

const promptSwapSize = () => prompt([{
  name: 'swapBytes',
  type: '',
  message: 'Swap partition size (MB)',
  default: 4000
}]).then(({ swapBytes }) => {
  if (typeof parseInt(swapBytes) !== 'number') {
    out(`${swapBytes} is not a number. You must enter a number`)
    return promptSwapSize()
  } else {
    return swapBytes
  }
})

const prepareDrive = () => listDisks()
  .then(promptDrive)
  .then(validateDrive)
  .then(confirmDrive)
  .then(({ drive, confirmed }) => !confirmed
    ? prepareDrive()
    : promptSwapSize(drive).then(swapBytes => ({ drive, swapBytes }))
  )
  .then(({ drive, swapBytes }) => createPartitionTable(drive.name)
    .then(() => partitionDrive(drive, swapBytes))
    .then(() => formatPartition(drive.name + '1'))
    .then(() => mount(drive.name + '1', '/mnt'))
  )

module.exports = prepareDrive
