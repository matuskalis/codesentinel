import {
  countFixtureFiles,
  discoverFixtureNames,
  loadExpected,
  scanFixture,
  sortFindings,
  type ExpectedFinding,
} from '../tests/fixture-runner'

const log = (message: string) => process.stderr.write(message + '\n')
const keyOf = (finding: ExpectedFinding) => JSON.stringify(finding)
const describeFinding = (finding: ExpectedFinding) => `${finding.rule_id} in ${finding.file}:${finding.start_line}`
const percent = (part: number, whole: number) => (whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(0)}%`)

async function main() {
  const requested = process.argv[2]
  const fixtureNames = requested ? [requested] : discoverFixtureNames()

  let matched = 0
  let missing = 0
  let extra = 0
  let totalFiles = 0

  for (const fixtureName of fixtureNames) {
    const actual = sortFindings(await scanFixture(fixtureName))
    const expected = sortFindings(loadExpected(fixtureName))
    const actualKeys = new Set(actual.map(keyOf))
    const expectedKeys = new Set(expected.map(keyOf))

    const missingFindings = expected.filter(finding => !actualKeys.has(keyOf(finding)))
    const extraFindings = actual.filter(finding => !expectedKeys.has(keyOf(finding)))

    matched += expected.length - missingFindings.length
    missing += missingFindings.length
    extra += extraFindings.length
    totalFiles += countFixtureFiles(fixtureName)

    log(`${missingFindings.length + extraFindings.length === 0 ? 'PASS' : 'FAIL'}  ${fixtureName} (${actual.length} findings)`)
    for (const finding of missingFindings) log(`  MISSING ${describeFinding(finding)}`)
    for (const finding of extraFindings) log(`  EXTRA   ${describeFinding(finding)}`)
  }

  log('')
  log(`${fixtureNames.length} fixtures, ${totalFiles} files`)
  log(`expected findings found: ${matched} of ${matched + missing}, unexpected findings: ${extra}`)
  log(`recall ${percent(matched, matched + missing)}, precision ${percent(matched, matched + extra)}`)

  process.exit(missing + extra === 0 ? 0 : 1)
}

main().catch(error => {
  log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
})
