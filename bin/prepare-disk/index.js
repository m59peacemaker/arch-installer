const { execFile, spawn } = require('child_process')
const pify = require('pify')
const execFileAsync = pify(execFile, { multiArgs: true })
const { prompt } = require('inquirer')
const pifyProc = (p, { collect = true } = {}) => new Promise((resolve, reject) => {
  if (collect) {
    var stdout = ''
    var stderr = ''
    p.stdout && p.stdout.on('data', data => (stdout += data))
    p.stderr && p.stderr.on('data', data => (stderr += data))
  }
  p.on('error', err => reject({ err }))
  p.on('exit', (code, signal) => (code === 0 ? resolve : reject)({ code, signal, stdout, stderr }))
  // p.on('close', code => (code === 0 ? resolve : reject)({ code, stdout, stderr }))
})
const bytesToGB = bytes => bytes / 1000 / 1000 / 1000
const GBToBytes = GB => GB * 1000 * 1000 * 1000
const MBToBytes = MB => MB * 1000 * 1000
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

const formatPartition = partition => pifyProc(
  spawn('mkfs.ext4', [ partition ], { stdio: 'inherit' })
)

const mount = (partition, path) => pifyProc(
  spawn('mount', [ partition, path ], { stdio: 'inherit' })
)

const fdisk = (out, lines, driveName) => {
  const p = spawn('fdisk', [ driveName ])
  p.stdout.on('data', out)
  const echo = spawn('echo', [ '-e', [ ...lines, 'w' ].join('\n') ])
  echo.stdout.pipe(p.stdin)
  echo.stdout.on('data', out)
  return pifyProc(p)
}

const createPartitionTable = driveName => fdisk(out, [ 'o' ], driveName)

const setPartitionType = ({ driveName, number, typeNumber }) => fdisk(
  out,
  [ 't', number, typeNumber ],
  driveName
)

const createPartition = ({ driveName, bytes, type, number }) => {
  let input = [ 'n' ]
  type && input.push(type.slice(0, 1))
  input = [
    ...input,
    number || '',
    '',
  ]
  bytes && input.push(`+${(bytes) / 1000}K\n`)
  return fdisk(out, input, driveName)
}

const partitionDrive = (drive, swapBytes) => createPartition({
  driveName: drive.name,
  type:'primary',
  number: 1,
  bytes: drive.bytes - swapBytes
})
  .then(() => createPartition({
    driveName: drive.name,
    type: 'extended',
    number: 2,
    bytes: swapBytes
  }))
  .then(() => fdisk(out, [ 'n', '', '' ], drive.name)) // partition 5
  .then(() => setPartitionType({
    driveName: drive.name,
    number: 5,
    typeNumber: 82
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
  name: 'swapMB',
  type: 'input',
  message: 'Swap partition size (MB)',
  default: 4000
}]).then(({ swapMB }) => {
  if (typeof parseInt(swapMB) !== 'number') {
    out(`${swapMB} is not a number. You must enter a number`)
    return promptSwapSize()
  } else {
    return MBToBytes(swapMB)
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
    //.then(() => formatPartition(drive.name + '1'))
    // when manually testing, this must be unmounted before running again (device or resource busy)
    // $ umount /mnt
    //.then(() => mount(drive.name + '1', '/mnt'))
  )

module.exports = prepareDrive
