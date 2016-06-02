#! /usr/bin/env node

import Blueprint from './Blueprint'
import IgnoreManager from './IgnoreManager'
import fs from 'fs'
import glob from 'glob'
import mkdirp from 'mkdirp'
import parseArgs from 'minimist'
import path from 'path'
import { findGitRoot } from './utils'

function printHelp (blueprints) {
  console.log('usage: blue NAME [...OPTS]')
  console.log(`available blueprints: ${Object.keys(blueprints)}`)
}

function printBlueprintHelp (blueprint, ignoreManager) {
  console.log(`usage: blue ${blueprint.name} [...OPTS] (at ${blueprint.directory})`)
  const filenames = blueprint.listFilenames(ignoreManager)
  for (let f of filenames) {
    console.log(`- ${f}`)
  }
}

function loadBlueprints ({
  parentDir = process.cwd(),
  ignoreManager = new IgnoreManager(),
  blueprints = {},
  recursive = true
} = {}) {
  const blueprintsGlob = `${parentDir}/@(blueprints|.blueprints)/*/` // only directories
  const blueprintDirs = glob.sync(blueprintsGlob)
  for (let dir of blueprintDirs) {
    const blueprintName = path.basename(dir)
    if (!(blueprintName in blueprints)) {
      blueprints[blueprintName] = new Blueprint(blueprintName, dir)
    }
  }

  ignoreManager.addFile(path.join(parentDir, '.gitignore'))
  ignoreManager.addFile(path.join(parentDir, 'blueprints', '.gitignore'))
  ignoreManager.addFile(path.join(parentDir, '.blueprints', '.gitignore'))

  if (recursive && parentDir !== '/') {
    loadBlueprints({
      parentDir: path.resolve(parentDir, '..'),
      ignoreManager, blueprints,
      recursive: true
    })
  }

  return { ignoreManager, blueprints }
}

const { ignoreManager, blueprints } = loadBlueprints()
const argv = parseArgs(process.argv)
if (argv._.length === 2) {
  printHelp(blueprints)
  process.exit(0)
}

const activeBlueprintName = argv._[2]
const activeBlueprint = blueprints[activeBlueprintName]
if (activeBlueprint == null) {
  console.error(`unknown blueprint '${activeBlueprintName}'`)
  printHelp(blueprints)
  process.exit(1)
} else if (argv._.length === 3 && Object.keys(argv).length === 1) {
  printBlueprintHelp(activeBlueprint, ignoreManager)
  process.exit(0)
}

try {
  const compiled = activeBlueprint.compile(ignoreManager)
  const positionals = argv._.slice(3)
  const templated = compiled(positionals, argv)

  const root = findGitRoot()

  console.log(`applying ${activeBlueprint.name}: ${activeBlueprint.directory}`)
  for (let filename in templated) {
    const abs = path.join(root, filename)
    const contents = templated[filename]

    const dir = path.dirname(abs)
    mkdirp.sync(dir)
    fs.writeFileSync(abs, contents)

    const rel = path.relative(process.cwd(), abs)
    console.log(`+ ${rel}`)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
