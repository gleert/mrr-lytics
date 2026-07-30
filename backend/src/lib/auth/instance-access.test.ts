import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Static-analysis tests only: instance-access.ts imports via the `@/` alias,
// which Next's bundler resolves but bare `node --test` does not. Importing it
// here would mean either breaking the repo-wide `@/` convention or wiring a
// resolver hook, and the invariant worth protecting -- that no route reads
// instance_ids without an ownership check -- is a source-level property anyway.

const here = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.resolve(here, '../../app/api')

/**
 * Routes that read `instance_ids` but legitimately need no assertInstancesOwned
 * call, because they never trust the parameter: they start from the instances
 * the caller owns and INTERSECT the requested ids against that list, so a
 * foreign id simply drops out.
 *
 * Only add here after verifying the route derives its id list from the caller's
 * own tenant/user first. "It looked fine" is not a reason.
 */
const INTERSECTS_INSTEAD_OF_ASSERTING = new Set([
  'billable-items/route.ts',
  'products/route.ts',
])

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === 'route.ts') out.push(full)
  }
  return out
}

test('every route reading instance_ids checks tenant ownership', () => {
  const offenders: string[] = []
  let checked = 0

  for (const file of routeFiles(API_DIR)) {
    const src = fs.readFileSync(file, 'utf8')
    if (!src.includes("searchParams.get('instance_ids')")) continue

    const rel = path.relative(API_DIR, file).split(path.sep).join('/')
    if (INTERSECTS_INSTEAD_OF_ASSERTING.has(rel)) continue

    checked++
    if (!src.includes('assertInstancesOwned(')) offenders.push(rel)
  }

  // Guard against the walker silently finding nothing (a refactor moving the
  // api dir would otherwise make this test vacuously pass).
  assert.ok(checked >= 20, `expected to check 20+ routes, only saw ${checked}`)

  assert.deepEqual(
    offenders,
    [],
    'These routes take instance_ids from the query string without calling ' +
      'assertInstancesOwned(auth.tenant_id, instanceIds), which lets any ' +
      'authenticated tenant read another tenant\'s data:\n  ' +
      offenders.join('\n  '),
  )
})

test('the guard fails closed when the instance list cannot be read', () => {
  const src = fs.readFileSync(path.join(here, 'instance-access.ts'), 'utf8')
  // A lookup error must throw, never fall through to "allow". Pinning this in a
  // test because the failure mode is silent: returning [] on error would make
  // every request pass the check.
  assert.match(src, /if \(error\) \{[\s\S]*?throw new ForbiddenError/)
})

test('the intersect-instead-of-assert allowlist stays honest', () => {
  for (const rel of INTERSECTS_INSTEAD_OF_ASSERTING) {
    const file = path.join(API_DIR, rel)
    assert.ok(fs.existsSync(file), `allowlisted route no longer exists: ${rel}`)
    const src = fs.readFileSync(file, 'utf8')
    assert.ok(
      src.includes('.eq(\'user_id\', authId)') || src.includes('user_tenants'),
      `${rel} is allowlisted as deriving instances from the caller's own tenants, ` +
        'but no longer looks like it does. Re-verify it or add the guard.',
    )
  }
})
