#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('fs')
const { spawn } = require('child_process')
const inquirer = require('inquirer')
const padRight = require('pad-right')
const groupBy = require('group-array-by')
const {
  join,
  map,
  pick,
  pipe,
  prop,
  sortBy,
  update,
  values
} = require('ramda')
const countriesList = require('countries-list').countries
const I6 = require('iso-639-1')
const localeRegex = require('./locale-regex')

const LOCALE_FILE_PATH = '/etc/locale.gen'

const localeGen = () => new Promise((resolve, reject) => {
  // TODO: promise/spawn api package needed once again
  const p = spawn('locale-gen', { stdio: 'inherit' })
  p.on('error', reject)
  p.on('close', code => code === 0 ? resolve() : reject())
})

const localeFile = readFileSync(LOCALE_FILE_PATH, 'utf8')
const localeFileLines = localeFile.split('\n')

const locales = localeFileLines
  .map((line, idx) => {
    const matches = line.match(localeRegex)
    return matches
      ? {
        originalValue: line,
        lineNumber: idx,
        language: matches[2],
        country: matches[3],
        countryExtra: matches[4],
        charset: matches[5]
      }
      : line
  })
  .filter(line => typeof line !== 'string')

const localesByLanguage = groupBy(v => v.language, locales)
const languageCodes = Object.keys(localesByLanguage)

const promptLanguage = languageCodes => {
  const languages = I6.getLanguages(languageCodes)
  const pad = languages.map(v => v.name).sort((a, b) => b.length - a.length)[0].length + 1

  const choices = pipe(
    sortBy(prop('name')),
    map(({code, name, nativeName}) => ({
      name: name === nativeName ? name : `${padRight(name, pad, ' ')} [ ${nativeName} ]`,
      value: code
    }))
  )(languages)
  return inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      default: 'en',
      message: 'Choose a language:',
      choices
    }
  ]).then(answers => answers.language)
}

const promptCountry = codes => {
  const countries = values(pick(codes, countriesList))
  const pad = countries.map(v => v.name).sort((a, b) => b.length - a.length)[0].length + 1
  const choices = pipe(
    map(code => {
      const country = countriesList[code]
      return {
        name: country.name === country.native
          ? country.name
          : `${padRight(country.name, pad, ' ')} [ ${country.native} ]`,
        value: code
      }
    }),
    sortBy(prop('name'))
  )(codes)
  return inquirer.prompt([
    {
      type: 'list',
      name: 'country',
      default: codes.includes('US') ? 'US' : codes[0],
      message: 'Choose a country:',
      choices
    }
  ]).then(answers => answers.country)
}

const promptCharset = charsets => {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'charset',
      default: charsets.includes('UTF-8') ? 'UTF-8' : charsets[0],
      message: 'Choose a charset:',
      choices: charsets
    }
  ]).then(answers => answers.charset)
}

const stringifyLocale = locale => {
  const { language, country, countryExtra, charset } = locale
  return `${language}_${country}${countryExtra} ${charset}`
}

promptLanguage(languageCodes)
  .then(languageCode => {
    const remainingLocalesByCountry = groupBy(v => v.country, localesByLanguage[languageCode])
    const countryCodes = Object.keys(remainingLocalesByCountry)
    return promptCountry(countryCodes)
      .then(countryCode => {
        const remainingLocalesByCharset = groupBy(
          v => v.charset,
          remainingLocalesByCountry[countryCode]
        )
        const charsets = Object.keys(remainingLocalesByCharset)
        return (charsets.length < 2 ? Promise.resolve(charsets[0]) : promptCharset(charsets))
          .then(charset => remainingLocalesByCharset[charset])
      })
  })
  .then(selectedLocales => {
    const activeLocale = selectedLocales.find(v => v.originalValue.match(/^[^#]*\w/))
    const pendingLocale = selectedLocales[0]
    const locale = stringifyLocale(pendingLocale)
    if (!activeLocale) {
      writeFileSync(
        LOCALE_FILE_PATH,
        pipe(update(pendingLocale.lineNumber, locale), join('\n'))(localeFileLines)
      )
      console.log(`enabled ${locale} locale in ${LOCALE_FILE_PATH}`)
    } else {
      console.log(`${locale} locale is already enabled in ${LOCALE_FILE_PATH}`)
    }
    return localeGen()
  })
  .catch(err => {
    console.error(err)
  })
