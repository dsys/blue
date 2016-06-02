import child_process from 'child_process'

export default function findGitRoot (cwd = process.cwd()) {
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
