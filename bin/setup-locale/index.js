#!/usr/bin/env node

const {
  readFileSync,
  writeFileSync,
  writeFile
} = require('fs')
const { spawn } = require('child_process')
const pify = require('pify')
const writeFileAsync = pify(writeFile)
const inquirer = require('inquirer')
const padRight = require('pad-right')
const groupBy = require('group-array-by')
const {
  map,
  pick,
  pipe,
  prop,
  sortBy,
  values
} = require('ramda')
const countriesList = require('countries-list').countries
const I6 = require('iso-639-1')
const localeRegex = require('./locale-regex')
const out = (...args) => process.stdout.write(...args)

const LOCALE_FILE_PATH = '/etc/locale.gen'
const LOCALE_CONF_PATH = '/etc/locale.conf'

const localeGen = () => new Promise((resolve, reject) => {
  // TODO: promise/spawn api package needed once again
  const p = spawn('locale-gen', { stdio: 'inherit' })
  p.on('error', reject)
  p.on('close', code => code === 0 ? resolve() : reject())
})

/* TODO: /etc/locale.conf shouldn't exist yet... nonetheless, it is a lot stronger to
  try to read it, parse it, and see if LANG is in there, and adjust it if so.
  Maybe find or write a thing for that. conf files can greatly vary though
*/
const setLanguage = lang => {
  const confValue = `LANG=${lang}`
  out(`Setting "${confValue}" in ${LOCALE_CONF_PATH}... `)
  return writeFileAsync(LOCALE_CONF_PATH, confValue + '\n')
    .then(() => out('done\n'))
}

const promptLanguage = () => {
  const languages = I6.getLanguages(I6.getAllCodes())
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

const promptCountry = () => {
  const codes = Object.keys(countriesList)
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

const setupLocale = () => promptLanguage()
  .then(languageCode => promptCountry()
    .then(countryCode => ({ languageCode, countryCode }))
  )
  .then(({ languageCode, countryCode }) => {
    const charset = 'UTF-8'
    const lang = `${languageCode}_${countryCode}.${charset}`
    const locale = `${lang} ${charset}`
    out(`Writing "${locale}" to ${LOCALE_FILE_PATH}... `)
    return writeFileAsync(LOCALE_FILE_PATH, locale)
      .then(() => out('done\n'))
      .then(localeGen)
      .then(() => setLanguage(lang))
  })

module.exports = setupLocale
