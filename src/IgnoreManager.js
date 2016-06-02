import fs from 'fs'
import ignore from 'ignore'

export default class IgnoreManager {
  constructor () {
    this.manager = ignore()
  }

  addFile (filename, ignoreMissing = true) {
    try {
      this.manager.add(fs.readFileSync(filename).toString())
    } catch (err) {
      if (!ignoreMissing) {
        throw err
      }
    }
  }

  filter (paths) {
    return this.manager.filter(paths)
  }
}
