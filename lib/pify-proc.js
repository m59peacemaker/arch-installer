const pifyProc = (p, { collect = true } = {}) => new Promise((resolve, reject) => {
  if (collect) {
    var stdout = ''
    var stderr = ''
    p.stdout && p.stdout.on('data', data => (stdout += data))
    p.stderr && p.stderr.on('data', data => (stderr += data))
  }
  p.on('error', reject)
  p.on('exit', (code, signal) => {
    const result = { code, signal, stdout, stderr }
    code === 0
      ? resolve(result)
      : reject(Object.assign(new Error(stderr), result))
  })
})

module.exports = pifyProc
