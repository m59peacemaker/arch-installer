const {
  combine,
  capture,
  anyNumber,
  atLeast,
  exactly,
  either
}= require('regex-fun')

const regex = combine(
  capture(anyNumber(either(' ', '#'))),
  anyNumber(' '),
  capture(atLeast(2, /[a-z]/)),
  '_',
  capture(exactly(2, /[A-Z]/)),
  capture(anyNumber(/[^ ]/)),
  ' ',
  capture(atLeast(4, /[A-Z0-9-]/))
)

module.exports = regex
