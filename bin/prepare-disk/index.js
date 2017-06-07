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
const bytes2 = require('bytes2')
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

const formatPartition = (partition, { force = false }) => {
  const args = [ partition ]
  force && args.push('-F')
  pifyProc(spawn('mkfs.ext4', args, { stdio: 'inherit' }))
}

const mount = (partition, path) => pifyProc(
  spawn('mount', [ partition, path ], { stdio: 'inherit' })
)

const wipeDrive = driveName => pifyProc(spawn(
  'dd',
  [ 'if=/dev/zero', `of=${driveName}`, 'bs=512', 'count=1' ],
  { stdio: 'inherit' }
))

const fdisk = (out, lines, driveName) => {
  const p = spawn('fdisk', [ driveName ])
  p.stdout.on('data', out)
  const echo = spawn('echo', [ '-e', lines.join('\n') ])
  echo.stdout.pipe(p.stdin)
  echo.stdout.on('data', out)
  return Promise.all([pifyProc(p), pifyProc(echo)])
}

const partitionDrive = (drive, swapBytes) => {
  const offsetBytes = (2048 * 512) * 2 // first sector * sector size * (primary, swap)
  const primaryBytes = drive.bytes - swapBytes - offsetBytes
  const primaryKiB = bytes2('KiB', primaryBytes).toFixed(0)
  const swapKiB = bytes2('KiB', swapBytes).toFixed(0)
  const input = [
    'o', // create dos partition table
    'n', 'p', '1', '', `+${primaryKiB}K`, // new primary partition 1
    'n', 'e', '2', '', `+${swapKiB}K`, // new extended partition 2
    'n', '', '', // new partition 5
    't', '5', '82', // change partition 5 type to swap
    'w'
  ]
  return fdisk(out, input, drive.name)
    .then(() => {
      out(`created primary partition of ${bytes2('MB', primaryBytes).toFixed(0)}MB\n`)
      out(`created swap partition of ${bytes2('MB', swapBytes).toFixed(0)}MB\n\n`)
    })
}

const promptDrive = drives => prompt([{
  name: 'drive',
  type: 'list',
  message: 'Choose a drive:',
  choices: drives.map((drive, idx) => {
    const { name, bytes } = drive
    return {
      name: `${name} ${bytes2('GB', bytes).toFixed(2)}GB`,
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
  .then(({ drive, swapBytes }) => wipeDrive(drive.name)
    .then(() => partitionDrive(drive, swapBytes))
    .then(() => formatPartition(drive.name + '1', { force: true }))
    // when manually testing, this must be unmounted before running again (device or resource busy)
    // $ umount /mnt
    .then(() => mount(drive.name + '1', '/mnt'))
  )

module.exports = prepareDrive
