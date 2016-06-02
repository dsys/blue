import fs from 'fs'
import glob from 'glob'
import path from 'path'
import Handlebars from 'handlebars'

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

    const fileMap = {}
    for (let relFilename of filenames) {
      const absFilename = path.join(this.directory, relFilename)
      const fileContents = fs.readFileSync(absFilename, 'utf-8')
      fileMap[relFilename] = fileContents
    }

    return (positionals, named) => {
      const view = Object.assign({}, named, positionals)
      const result = {}
      for (let relFilename in fileMap) {
        const fileContents = fileMap[relFilename]
        const templName = runHandlebars(relFilename, view)
        const templContents = runHandlebars(fileContents, view)
        result[templName] = templContents
      }

      return result
    }
  }
}
