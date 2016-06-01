#! /usr/bin/env node

import Handlebars from 'handlebars'
import child_process from 'child_process'
import fs from 'fs'
import glob from 'glob'
import mkdirp from 'mkdirp'
import parseArgs from 'minimist'
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

function printHelp () {
  console.log('usage: blue NAME [...OPTS]')
  console.log(`available blueprints: ${Object.keys(blueprints)}`)
}

function printBlueprintHelp (blueprint) {
  console.log(`${blueprint.name}: ${blueprint.directory}`)
  for (let filename in blueprint.files) {
    console.log(`- ${filename}`)
  }
}

function findGitRoot (cwd) {
  try {
    const stdout = child_process.execSync(
      'git rev-parse --show-toplevel',
      { cwd, stdio: ['pipe', 'pipe', 'ignore'] })
    return stdout.toString().trim()
  } catch (err) {
    // ignore err, return cwd
    return cwd
  }
}

class Blueprint {
  constructor (name, directory) {
    this.name = name
    this.directory = directory
    this.files = {}
  }

  load () {
    const filesGlob = path.join(this.directory, '**', '*')
    const files = glob.sync(filesGlob, { nodir: true, dot: true })
    for (let file of files) {
      const relFilename = path.relative(this.directory, file)
      const fileContents = fs.readFileSync(file, 'utf-8')
      this.files[relFilename] = fileContents
    }
  }

  template (positionals, named) {
    const view = Object.assign({}, named, positionals)
    const result = {}
    for (let relFilename in this.files) {
      const fileContents = this.files[relFilename]
      const templName = runHandlebars(relFilename, view)
      const templContents = runHandlebars(fileContents, view)
      result[templName] = templContents
    }
    return result
  }
}

const cwd = process.cwd()
const blueprints = {}
for (let dir = cwd; dir !== '/'; dir = path.resolve(dir, '..')) {
  const blueprintsGlob = path.join(dir, 'blueprints', '*') + '/' // only directories
  const blueprintDirs = glob.sync(blueprintsGlob)
  for (let dir of blueprintDirs) {
    const blueprintName = path.basename(dir)
    if (!(blueprintName in blueprints)) {
      blueprints[blueprintName] = new Blueprint(blueprintName, dir)
    }
  }
}

const argv = parseArgs(process.argv)

if (argv._.length === 2) {
  printHelp()
  process.exit(0)
}

const blueprintName = argv._[2]

if (!(blueprintName in blueprints)) {
  console.error(`unknown blueprint '${blueprintName}'`)
  printHelp()
  process.exit(1)
}

const blueprint = blueprints[blueprintName]
blueprint.load()

if (argv._.length === 3 && Object.keys(argv).length === 1) {
  printBlueprintHelp(blueprint)
  process.exit(0)
}

try {
  const positionals = argv._.slice(3)
  const templated = blueprint.template(positionals, argv)
  const filenames = Object.keys(templated).sort()

  const root = findGitRoot(cwd)

  console.log(`applying ${blueprint.name}: ${blueprint.directory}`)
  for (let filename in templated) {
    const abs = path.join(root, filename)
    const contents = templated[filename]

    const dir = path.dirname(abs)
    mkdirp.sync(dir)
    fs.writeFileSync(abs, contents)

    const rel = path.relative(cwd + '/..', abs)
    console.log(`+ ${rel}`)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
