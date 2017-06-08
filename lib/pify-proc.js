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

module.exports = pifyProc
