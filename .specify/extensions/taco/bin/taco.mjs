#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const FORMAT = 'taco/files'
const FORMAT_VERSION = 1
const DATA_BLOCK = /<script\b(?=[^>]*\bid=["']taco-document["'])[^>]*>[\s\S]*?<\/script>/i
const DATA_CONTENT = /(<script\b(?=[^>]*\bid=["']taco-document["'])[^>]*>)([\s\S]*?)(<\/script>)/i
const here = dirname(fileURLToPath(import.meta.url))
const defaultShell = resolve(here, '../assets/taco-shell.html')

const usage = `Taco CLI

Usage:
  taco pack <feature-directory> [--output <file>] [--project-root <dir>]
            [--title <title>] [--from <existing.taco.html>] [--shell <file>]
            [--ignore <relative-path-or-glob>]... [--json]
  taco sync <file.taco.html> [--project-root <dir>] [--dry-run] [--force] [--json]
  taco comments <file.taco.html> [--status open|resolved|all] [--json]
  taco validate <file.taco.html> [--json]

The sync command is conflict-safe. It refuses to overwrite a source file that changed
independently after the Taco was packed unless --force is explicitly supplied.`

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const isSafeRelativePath = (value) => {
  if (!value || isAbsolute(value) || value.includes('\\') || value.includes('\0')) return false
  return value.split('/').every((part) => part && part !== '.' && part !== '..')
}

const posix = (value) => value.split(sep).join('/')

const isWithin = (parent, child) => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

const pathExists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const assertNoSymlinkPath = async (root, target) => {
  const rel = relative(root, target)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error(`Unsafe sync target: ${target}`)
  let current = root
  for (const part of rel.split(sep)) {
    current = join(current, part)
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Refusing to sync through a symbolic link: ${current}`)
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
  }
}

const mediaType = (path) => {
  const lower = path.toLowerCase()
  if (lower.endsWith('.md')) return 'text/markdown'
  if (/\.html?$/.test(lower)) return 'text/html'
  if (/\.ya?ml$/.test(lower)) return 'application/yaml'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.xml')) return 'application/xml'
  if (lower.endsWith('.toml')) return 'application/toml'
  return 'text/plain'
}

const canonicalFileUrl = (value, expectedPath) => {
  if (typeof value !== 'string' || !value) return null
  let url
  try { url = new URL(value) }
  catch { return null }
  if (url.protocol !== 'file:' || url.host || url.username || url.password || url.search || url.hash) return null
  let pathname
  try { pathname = decodeURIComponent(url.pathname) }
  catch { return null }
  return pathname.endsWith(`/${expectedPath}`) ? url.href : null
}

const yamlTitleFrom = (content) => {
  const normalized = content.startsWith('\uFEFF') ? content.slice(1) : content
  const match = normalized.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!match) return null
  const line = match[1].split(/\r?\n/).find((candidate) => /^title[ \t]*:/.test(candidate))
  if (!line) return null
  const raw = line.slice(line.indexOf(':') + 1).trim()
  if (!raw) return null
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : null
    } catch { return null }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    const parsed = raw.slice(1, -1).replace(/''/g, "'").trim()
    return parsed || null
  }
  const plain = raw.replace(/[ \t]+#.*$/, '').trim()
  return plain && !/^[|>]/.test(plain) ? plain : null
}

const titleFrom = (content, fallback) => {
  const yamlTitle = yamlTitleFrom(content)
  if (yamlTitle) return yamlTitle
  const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
  return heading || fallback
}

const slug = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'taco-document'

const portableTitleBase = (value) =>
  value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '') || 'Untitled'

const tacoFileBase = (path) =>
  basename(path)
    .replace(/\.taco\.html$/i, '')
    .replace(/\.html$/i, '')

const parseOptions = (argv) => {
  const positional = []
  const options = new Map()
  const flags = new Set()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }
    if (['--json', '--dry-run', '--force', '--help'].includes(token)) {
      flags.add(token.slice(2))
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`)
    const name = token.slice(2)
    options.set(name, [...(options.get(name) ?? []), value])
    index += 1
  }
  return {
    positional,
    flag: (name) => flags.has(name),
    option: (name, fallback) => options.get(name)?.at(-1) ?? fallback,
    options: (name) => options.get(name) ?? [],
  }
}

const normalizeIgnorePattern = (value) => {
  const normalized = value
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/$/, '')
  if (
    !normalized ||
    isAbsolute(normalized) ||
    normalized.includes('\\') ||
    normalized.includes('\0') ||
    normalized.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe --ignore pattern: ${value}`)
  }
  return normalized
}

const escapeRegex = (character) =>
  /[\\^$+?.()|{}[\]]/.test(character) ? `\\${character}` : character

const globRegex = (pattern) => {
  let source = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        while (pattern[index + 1] === '*') index += 1
        if (pattern[index + 1] === '/') {
          index += 1
          source += '(?:.*/)?'
        } else if (source.endsWith('/')) {
          source = `${source.slice(0, -1)}(?:/.*)?`
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
    } else if (character === '?') {
      source += '[^/]'
    } else {
      source += escapeRegex(character)
    }
  }
  return new RegExp(`${source}$`)
}

const ignoreMatcher = (patterns) => {
  const compiled = patterns.map((pattern) => ({ pattern, regex: globRegex(pattern) }))
  return (path) =>
    compiled.find(
      ({ pattern, regex }) =>
        regex.test(path) ||
        (!pattern.includes('*') && !pattern.includes('?') && path.startsWith(`${pattern}/`)),
    )?.pattern ?? null
}

export const parseTacoHtml = (html, options = {}) => {
  const match = html.match(DATA_CONTENT)
  if (!match) throw new Error('Taco data block #taco-document was not found')
  let bundle
  try {
    bundle = JSON.parse(match[2].trim())
  } catch (error) {
    throw new Error(`Taco data block is not valid JSON: ${error.message}`)
  }
  validateBundle(bundle, options)
  return bundle
}

export const validateTacoHtml = (html) => {
  const bundle = parseTacoHtml(html)
  const securityMeta = html.match(/<meta\b(?=[^>]*\bname=["']taco-security-version["'])[^>]*>/i)?.[0]
  const securityVersion = securityMeta?.match(/\bcontent=["']([^"']+)["']/i)?.[1] ?? null
  const collab = bundle.collab && typeof bundle.collab === 'object' ? bundle.collab : null
  const issues = []
  if (collab && (collab.key || collab.ownerPriv || collab.invite?.priv)) issues.push('collab-secrets-present')
  if (securityVersion !== '1') issues.push('runtime-security-outdated')
  return { command: 'validate', format: bundle.format, version: bundle.version, securityVersion, issues, files: bundle.files.length }
}

export const validateBundle = (bundle, { allowLegacyHtmlSourceUrl = false } = {}) => {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle))
    throw new Error('Taco bundle must be an object')
  if (bundle.format !== FORMAT) throw new Error(`Expected Taco format ${FORMAT}`)
  if (!Number.isInteger(bundle.version) || bundle.version < 1)
    throw new Error('Taco version must be a positive integer')
  if (typeof bundle.root !== 'string' || !isSafeRelativePath(bundle.root))
    throw new Error('Taco root is not a safe relative path')
  if (!Array.isArray(bundle.files)) throw new Error('Taco files must be an array')
  const paths = new Set()
  for (const file of bundle.files) {
    if (
      !file ||
      typeof file !== 'object' ||
      typeof file.path !== 'string' ||
      typeof file.mediaType !== 'string' ||
      typeof file.content !== 'string'
    ) {
      throw new Error('Every Taco file requires path, mediaType and content strings')
    }
    if (!isSafeRelativePath(file.path) || !file.path.startsWith(`${bundle.root}/`)) {
      throw new Error(`File escapes Taco root: ${file.path}`)
    }
    if (paths.has(file.path)) throw new Error(`Duplicate Taco path: ${file.path}`)
    const html = file.mediaType === 'text/html' || /\.html?$/i.test(file.path)
    if (html && !allowLegacyHtmlSourceUrl && !canonicalFileUrl(file.sourceUrl, file.path)) {
      throw new Error(`HTML file requires its canonical file URL: ${file.path}`)
    }
    if (!html && file.sourceUrl !== undefined) {
      throw new Error(`sourceUrl is only valid for HTML files: ${file.path}`)
    }
    paths.add(file.path)
  }
  if (bundle.comments !== undefined && !Array.isArray(bundle.comments))
    throw new Error('Taco comments must be an array')
  if (bundle.packOptions !== undefined) {
    if (
      !bundle.packOptions ||
      typeof bundle.packOptions !== 'object' ||
      Array.isArray(bundle.packOptions) ||
      !Array.isArray(bundle.packOptions.ignore) ||
      bundle.packOptions.ignore.some((pattern) => typeof pattern !== 'string')
    ) {
      throw new Error('Taco packOptions.ignore must be an array of strings')
    }
    bundle.packOptions.ignore.forEach(normalizeIgnorePattern)
  }
}

const encodeBundle = (bundle) =>
  JSON.stringify(bundle, null, 2).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )

const embedBundle = (shell, bundle) => {
  if (!DATA_BLOCK.test(shell)) throw new Error('Taco shell does not contain #taco-document')
  const json = encodeBundle(bundle)
  const withBundle = shell.replace(
    DATA_BLOCK,
    `<script type="application/taco+json" id="taco-document">\n${json}\n</script>`,
  )
  const escapedTitle = `${bundle.title} — Taco`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(withBundle)) {
    return withBundle.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
  }
  return withBundle.replace('</head>', `<title>${escapedTitle}</title></head>`)
}

const collectFiles = async (featureDir, rootPath, existingByPath, ignorePatterns) => {
  const files = []
  const defaultIgnored = []
  const explicitIgnored = []
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const explicitMatch = ignoreMatcher(ignorePatterns)

  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const absolute = join(directory, entry.name)
      const relativePath = posix(relative(featureDir, absolute))
      if (entry.name.startsWith('.') || entry.name.toLowerCase().endsWith('.taco.html')) {
        defaultIgnored.push(relativePath)
        continue
      }
      const matchedPattern = explicitMatch(relativePath)
      if (matchedPattern) {
        explicitIgnored.push({ path: relativePath, pattern: matchedPattern })
        continue
      }
      if (entry.isSymbolicLink()) {
        throw new Error(
          `Unsupported symbolic link in feature directory: ${relativePath}; exclude it with --ignore`,
        )
      }
      if (entry.isDirectory()) {
        await visit(absolute)
        continue
      }
      if (!entry.isFile()) {
        throw new Error(
          `Unsupported filesystem entry in feature directory: ${relativePath}; exclude it with --ignore`,
        )
      }
      let content
      try {
        content = decoder.decode(await readFile(absolute))
      } catch {
        throw new Error(`File is not valid UTF-8: ${relativePath}; exclude it with --ignore`)
      }
      const path = `${rootPath}/${relativePath}`
      const previous = existingByPath.get(path)
      const type = mediaType(relativePath)
      files.push({
        ...(previous?.id ? { id: previous.id } : {}),
        title: type === 'text/markdown'
          ? titleFrom(content, entry.name)
          : previous?.title || titleFrom(content, entry.name),
        path,
        mediaType: type,
        content,
        ...(type === 'text/html' ? { sourceUrl: pathToFileURL(absolute).href } : {}),
        sourceHash: sha256(content),
      })
    }
  }

  await visit(featureDir)
  return { files, defaultIgnored, explicitIgnored }
}

export const pack = async ({
  featureDirectory,
  projectRoot = process.cwd(),
  output,
  title,
  from,
  shell = defaultShell,
  ignore = [],
}) => {
  const rootDirectory = await realpath(resolve(projectRoot))
  const featureDir = await realpath(resolve(featureDirectory))
  if (!isWithin(rootDirectory, featureDir) || featureDir === rootDirectory) {
    throw new Error('Feature directory must be a child of the project root')
  }
  if (!(await pathExists(join(featureDir, 'spec.md'))))
    throw new Error(`No spec.md found in ${featureDir}`)

  const rootPath = posix(relative(rootDirectory, featureDir))
  if (!isSafeRelativePath(rootPath))
    throw new Error(`Feature root is not a safe relative path: ${rootPath}`)
  const outputPath = resolve(
    output || join(featureDir, `${featureDir.split(sep).at(-1)}.taco.html`),
  )
  const outputDirectory = await realpath(dirname(outputPath))
  if (outputDirectory !== featureDir || !outputPath.toLowerCase().endsWith('.taco.html')) {
    throw new Error('Taco output must be a .taco.html file inside the feature directory')
  }
  const outputExists = await pathExists(outputPath)
  if (outputExists && (await lstat(outputPath)).isSymbolicLink()) {
    throw new Error(`Refusing to write Taco through a symbolic link: ${outputPath}`)
  }
  const fromPath = from ? resolve(from) : outputExists ? outputPath : null
  if (fromPath) {
    const fromDirectory = await realpath(dirname(fromPath))
    const fromStats = await lstat(fromPath)
    if (
      fromDirectory !== featureDir ||
      fromStats.isSymbolicLink() ||
      !fromStats.isFile() ||
      !fromPath.toLowerCase().endsWith('.taco.html')
    ) {
      throw new Error(
        'Existing Taco must be a regular .taco.html file inside the feature directory',
      )
    }
  }
  const priorBundle = fromPath
    ? parseTacoHtml(await readFile(fromPath, 'utf8'), { allowLegacyHtmlSourceUrl: true })
    : null
  if (priorBundle && priorBundle.root !== rootPath) {
    throw new Error(
      `Existing Taco root ${priorBundle.root} does not match feature root ${rootPath}`,
    )
  }
  const ignorePatterns = (ignore.length ? ignore : (priorBundle?.packOptions?.ignore ?? [])).map(
    normalizeIgnorePattern,
  )
  if (ignoreMatcher(ignorePatterns)('spec.md'))
    throw new Error('spec.md cannot be excluded with --ignore')
  const existingByPath = new Map((priorBundle?.files ?? []).map((file) => [file.path, file]))
  const { files, defaultIgnored, explicitIgnored } = await collectFiles(
    featureDir,
    rootPath,
    existingByPath,
    ignorePatterns,
  )
  if (!files.length) throw new Error(`No UTF-8 text files found in ${featureDir}`)

  const spec = files.find((file) => file.path === `${rootPath}/spec.md`)
  const outputBase = tacoFileBase(outputPath)
  const inheritedTitle =
    priorBundle?.title || titleFrom(spec?.content ?? '', featureDir.split(sep).at(-1))
  if (title && portableTitleBase(title) !== outputBase) {
    throw new Error(
      `Taco title requires filename ${portableTitleBase(title)}.taco.html, not ${basename(outputPath)}`,
    )
  }
  const bundleTitle =
    title || (portableTitleBase(inheritedTitle) === outputBase ? inheritedTitle : outputBase)
  const bundle = {
    ...(priorBundle ?? {}),
    format: FORMAT,
    version: FORMAT_VERSION,
    docId: priorBundle?.docId || slug(rootPath),
    title: bundleTitle,
    root: rootPath,
    files,
    packOptions: { ignore: ignorePatterns },
    ...(priorBundle?.comments?.length ? { comments: priorBundle.comments } : {}),
  }
  validateBundle(bundle)

  // `--from` supplies the previous canonical bundle, not the runtime shell.
  // Always render that bundle into the requested (latest by default) shell so
  // refreshing a Taco also upgrades bug fixes in its embedded application.
  const shellPath = resolve(shell)
  const shellHtml = await readFile(shellPath, 'utf8')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, embedBundle(shellHtml, bundle), 'utf8')
  return {
    command: 'pack',
    output: outputPath,
    root: rootPath,
    files: files.length,
    ignored: [...defaultIgnored, ...explicitIgnored.map(({ path }) => path)],
    defaultIgnored,
    explicitIgnored,
    ignorePatterns,
    commentsPreserved: bundle.comments?.length ?? 0,
  }
}

const positionFor = (content, offset) => {
  const safe = Math.max(0, Math.min(offset, content.length))
  const before = content.slice(0, safe)
  const lines = before.split('\n')
  return { line: lines.length, column: lines.at(-1).length + 1 }
}

const findAnchor = (content, anchor) => {
  const exact = anchor?.quote?.exact
  const start = anchor?.position?.start
  const end = anchor?.position?.end
  if (typeof exact !== 'string' || !exact || !Number.isInteger(start) || !Number.isInteger(end))
    return null
  if (content.slice(start, end) === exact) return { start, end }
  const matches = []
  let cursor = content.indexOf(exact)
  while (cursor !== -1) {
    matches.push(cursor)
    cursor = content.indexOf(exact, cursor + 1)
  }
  if (!matches.length) return null
  const prefix = typeof anchor.quote.prefix === 'string' ? anchor.quote.prefix : ''
  const suffix = typeof anchor.quote.suffix === 'string' ? anchor.quote.suffix : ''
  const score = (candidate) => {
    let value = -Math.abs(candidate - start) / Math.max(content.length, 1)
    const before = content.slice(Math.max(0, candidate - prefix.length), candidate)
    const after = content.slice(candidate + exact.length, candidate + exact.length + suffix.length)
    for (let index = 1; index <= Math.min(prefix.length, before.length); index += 1) {
      if (prefix.at(-index) !== before.at(-index)) break
      value += 2
    }
    for (let index = 0; index < Math.min(suffix.length, after.length); index += 1) {
      if (suffix[index] !== after[index]) break
      value += 2
    }
    return value
  }
  const best = matches.sort((a, b) => score(b) - score(a))[0]
  return { start: best, end: best + exact.length }
}

export const describeComments = (bundle, status = 'all') => {
  const files = new Map(bundle.files.map((file) => [file.path, file]))
  return (bundle.comments ?? [])
    .filter((thread) => status === 'all' || thread.status === status)
    .map((thread) => {
      const file = files.get(thread.anchor?.path)
      const located = file ? findAnchor(file.content, thread.anchor) : null
      return {
        id: thread.id,
        status: thread.status,
        path: thread.anchor?.path,
        quote: thread.anchor?.quote?.exact,
        location: located && file ? positionFor(file.content, located.start) : null,
        stale: !located,
        messages: Array.isArray(thread.messages)
          ? thread.messages.map((message) => ({
              id: message.id,
              author: message.author,
              body: message.body,
              createdAt: message.createdAt,
            }))
          : [],
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }
    })
}

export const sync = async ({
  tacoFile,
  projectRoot = process.cwd(),
  dryRun = false,
  force = false,
}) => {
  const tacoPath = resolve(tacoFile)
  const bundle = parseTacoHtml(await readFile(tacoPath, 'utf8'))
  if (bundle.version > FORMAT_VERSION)
    throw new Error(`Taco version ${bundle.version} is newer than this CLI supports`)
  const rootDirectory = await realpath(resolve(projectRoot))
  const featureRoot = resolve(rootDirectory, bundle.root)
  if (!isWithin(rootDirectory, featureRoot) || featureRoot === rootDirectory)
    throw new Error('Taco root escapes the project root')
  if (await pathExists(featureRoot)) {
    const actualFeatureRoot = await realpath(featureRoot)
    if (!isWithin(rootDirectory, actualFeatureRoot) || actualFeatureRoot !== featureRoot) {
      throw new Error(
        'Taco feature root resolves through a symbolic link or escapes the project root',
      )
    }
  }
  if ((await realpath(dirname(tacoPath))) !== featureRoot) {
    throw new Error('Reviewed Taco must be inside its canonical feature directory')
  }

  const changes = []
  for (const file of bundle.files) {
    const target = resolve(rootDirectory, file.path)
    if (!isWithin(featureRoot, target) || target === featureRoot)
      throw new Error(`Taco file escapes feature root: ${file.path}`)
    await assertNoSymlinkPath(rootDirectory, target)
    const exists = await pathExists(target)
    const current = exists ? await readFile(target, 'utf8') : null
    const currentHash = current === null ? null : sha256(current)
    const tacoHash = sha256(file.content)
    const baselineHash =
      typeof file.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(file.sourceHash)
        ? file.sourceHash
        : null
    let state
    if (!exists) state = 'created'
    else if (currentHash === tacoHash) state = 'unchanged'
    else if (force || (baselineHash && currentHash === baselineHash)) state = 'updated'
    else state = 'conflict'
    changes.push({
      path: file.path,
      target,
      state,
      baselineKnown: Boolean(baselineHash),
      content: file.content,
    })
  }

  const conflicts = changes.filter((change) => change.state === 'conflict')
  if (!dryRun && conflicts.length === 0) {
    for (const change of changes) {
      if (change.state !== 'created' && change.state !== 'updated') continue
      await mkdir(dirname(change.target), { recursive: true })
      const temporary = `${change.target}.taco-${process.pid}-${randomUUID()}.tmp`
      await writeFile(temporary, change.content, 'utf8')
      await rename(temporary, change.target)
    }
  }

  return {
    command: 'sync',
    taco: tacoPath,
    root: bundle.root,
    dryRun,
    forced: force,
    applied: !dryRun && conflicts.length === 0,
    summary: {
      created: changes.filter((change) => change.state === 'created').length,
      updated: changes.filter((change) => change.state === 'updated').length,
      unchanged: changes.filter((change) => change.state === 'unchanged').length,
      conflicts: conflicts.length,
    },
    files: changes.map(({ path, state, baselineKnown }) => ({ path, state, baselineKnown })),
    comments: describeComments(bundle),
  }
}

const humanComments = (comments) => {
  if (!comments.length) return 'No matching Taco comments.'
  return comments
    .map((thread) => {
      const location = thread.location ? `:${thread.location.line}:${thread.location.column}` : ''
      const messages = thread.messages
        .map((message) => `  ${message.author}: ${message.body}`)
        .join('\n')
      return `[${thread.status}] ${thread.path}${location}\n  > ${thread.quote}\n${messages}`
    })
    .join('\n\n')
}

const printResult = (result, json) => {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  if (result.command === 'pack') {
    process.stdout.write(`Created ${result.output} with ${result.files} files.\n`)
    if (result.defaultIgnored.length)
      process.stdout.write(
        `Excluded Taco outputs or hidden paths: ${result.defaultIgnored.join(', ')}\n`,
      )
    if (result.explicitIgnored.length)
      process.stdout.write(
        `Excluded by --ignore: ${result.explicitIgnored.map(({ path }) => path).join(', ')}\n`,
      )
    if (result.commentsPreserved)
      process.stdout.write(`Preserved ${result.commentsPreserved} comment threads.\n`)
    return
  }
  if (result.command === 'sync') {
    const label = result.dryRun ? 'Previewed' : result.applied ? 'Synced' : 'Refused'
    process.stdout.write(
      `${label} ${result.root}: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged, ${result.summary.conflicts} conflicts.\n`,
    )
    if (result.summary.conflicts)
      process.stdout.write(
        'No files were written. Review conflicts; use --force only with explicit authorization.\n',
      )
    process.stdout.write(`${humanComments(result.comments)}\n`)
    return
  }
  if (result.command === 'validate') {
    process.stdout.write(`Validated Taco runtime security ${result.securityVersion ?? 'unknown'}: ${result.issues.length ? result.issues.join(', ') : 'no issues'}.\n`)
  }
}

const main = async () => {
  const [command, ...argv] = process.argv.slice(2)
  if (command === '--help' || command === '-h') {
    process.stdout.write(`${usage}\n`)
    return
  }
  const parsed = parseOptions(argv)
  if (!command || parsed.flag('help') || command === 'help') {
    process.stdout.write(`${usage}\n`)
    return
  }

  if (command === 'pack') {
    if (!parsed.positional[0]) throw new Error('pack requires a feature directory')
    const result = await pack({
      featureDirectory: parsed.positional[0],
      projectRoot: parsed.option('project-root'),
      output: parsed.option('output'),
      title: parsed.option('title'),
      from: parsed.option('from'),
      shell: parsed.option('shell'),
      ignore: parsed.options('ignore'),
    })
    printResult(result, parsed.flag('json'))
    return
  }

  if (command === 'sync') {
    if (!parsed.positional[0]) throw new Error('sync requires a .taco.html file')
    const result = await sync({
      tacoFile: parsed.positional[0],
      projectRoot: parsed.option('project-root'),
      dryRun: parsed.flag('dry-run'),
      force: parsed.flag('force'),
    })
    printResult(result, parsed.flag('json'))
    if (result.summary.conflicts) process.exitCode = 2
    return
  }

  if (command === 'comments') {
    if (!parsed.positional[0]) throw new Error('comments requires a .taco.html file')
    const status = parsed.option('status', 'all')
    if (!['open', 'resolved', 'all'].includes(status))
      throw new Error('--status must be open, resolved or all')
    const bundle = parseTacoHtml(await readFile(resolve(parsed.positional[0]), 'utf8'))
    const comments = describeComments(bundle, status)
    if (parsed.flag('json'))
      process.stdout.write(`${JSON.stringify({ command: 'comments', comments }, null, 2)}\n`)
    else process.stdout.write(`${humanComments(comments)}\n`)
    return
  }

  if (command === 'validate') {
    if (!parsed.positional[0]) throw new Error('validate requires a .taco.html file')
    const result = validateTacoHtml(await readFile(resolve(parsed.positional[0]), 'utf8'))
    printResult(result, parsed.flag('json'))
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const json = process.argv.includes('--json')
    if (json) process.stderr.write(`${JSON.stringify({ error: error.message })}\n`)
    else process.stderr.write(`Taco: ${error.message}\n`)
    process.exitCode = 1
  })
}
