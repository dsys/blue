import Handlebars from 'handlebars'
import fs from 'fs'
import glob from 'glob'
import isBinaryFile from 'isbinaryfile'
import path from 'path'

const HANDLEBARS_CONFIG = { strict: true, noEscape: true }
const MISSING_ARG_REGEX = /^"([\w]+)" not defined in/

function runHandlebars (template, args) {
  try {
    const compiled = Handlebars.compile(template, HANDLEBARS_CONFIG)
    return compiled(args)
  } catch (err) {
    const matches = err.message.match(MISSING_ARG_REGEX)
    if (matches) {
      const argName = matches[1]
      throw new Error(`arg '${argName}' not provided`)
    } else {
      throw err
    }
  }
}

export default class Blueprint {
  constructor (name, directory) {
    this.name = name
    this.directory = directory
  }

  listFilenames (ignoreManager = null) {
    const allFilenames = glob.sync('**/*', { cwd: this.directory, nodir: true, dot: true })
    if (ignoreManager) {
      return ignoreManager.filter(allFilenames)
    } else {
      return ignoreManager
    }
  }

  compile (ignoreManager) {
    const filenames = this.listFilenames(ignoreManager)

    const binFileMap = {}
    const txtFileMap = {}
    for (let relFilename of filenames) {
      const absFilename = path.join(this.directory, relFilename)
      if (isBinaryFile.sync(absFilename)) {
        const fileContents = fs.readFileSync(absFilename)
        binFileMap[relFilename] = fileContents
      } else {
        const fileContents = fs.readFileSync(absFilename, 'utf-8')
        txtFileMap[relFilename] = fileContents
      }
    }

    return (positionals, named) => {
      const view = Object.assign({}, named, positionals)
      const templated = {}
      for (let relFilename in txtFileMap) {
        const fileContents = txtFileMap[relFilename]
        const templName = runHandlebars(relFilename, view)
        const templContents = runHandlebars(fileContents, view)
        templated[templName] = templContents
      }

      return Object.assign(templated, binFileMap)
    }
  }
}
