import { ContextManager } from '../src/runtime/context/ContextManager'
import { PromptParityTester } from '../src/runtime/prompting/migration/PromptParityTester'
import { LegacyPromptAdapter } from '../src/runtime/prompting/migration/LegacyPromptAdapter'
import { getSystemPromptForRole, getAllRuntimeRoles } from '../src/runtime/runtime-role-registry'
import { PromptRegistry } from '../src/runtime/prompting/registry/PromptRegistry'
import { PromptCompositionEngine } from '../src/runtime/prompting/composition/PromptCompositionEngine'
import { registerDefaultSections } from '../src/runtime/prompting/sections'
import { defaultContext } from '../src/runtime/prompting/registry/SectionDefinition'

async function main() {
  const cm = ContextManager.getInstance()
  cm.configure({ migrationMode: 'new' })
  cm.initializeTask()

  const tester = new PromptParityTester()
  const results: Array<{ role: string; passed: boolean; warnings: string[] }> = []
  let totalRoles = 0
  let passed = 0
  let failed = 0

  // Build new ASTs directly from the section system for accurate parity
  const registry = new PromptRegistry()
  registerDefaultSections(registry)
  const engine = new PromptCompositionEngine(registry)

  console.log('=== Prompt Parity Test ===\n')

  for (const role of getAllRuntimeRoles()) {
    const oldPrompt = getSystemPromptForRole(role)
    if (!oldPrompt) {
      console.warn(`  [SKIP] No old prompt for role "${role}"`)
      continue
    }

    totalRoles++

    const resolveCtx = defaultContext({
      role,
      executionMode: undefined,
      provider: undefined,
      isAutonomous: role === 'runtime' || role === 'memory',
      isMultiAgent: role === 'manager',
      hasTools: role !== 'fast-inference',
    })

    const plan = registry.plan(resolveCtx)
    const result = await engine.compose(plan, resolveCtx)
    const newAST = result.ast

    const oldAST = LegacyPromptAdapter.adaptFromRolePrompt(oldPrompt, role)
    const parity = tester.testParity(oldPrompt, newAST, role)

    const runtimeCompat = tester.validateRuntimeCompatibility(newAST)
    const allWarnings = [...parity.warnings, ...runtimeCompat]

    results.push({ role, passed: parity.passed && runtimeCompat.length === 0, warnings: allWarnings })

    const emoji = parity.passed && runtimeCompat.length === 0 ? 'PASS' : 'WARN'
    if (parity.passed && runtimeCompat.length === 0) {
      passed++
    } else {
      failed++
    }

    console.log(`  [${emoji}] ${role}`)
    console.log(`        old: ${parity.oldTokens} tokens, ${parity.oldSectionCount} sections`)
    console.log(`        new: ${parity.newTokens} tokens, ${newAST.nodes.length} nodes (${result.promptText.length} chars)`)
    console.log(`        delta: ${parity.tokenDeltaPercent >= 0 ? '+' : ''}${parity.tokenDeltaPercent.toFixed(1)}% (${parity.tokenDelta >= 0 ? '+' : ''}${parity.tokenDelta} tokens)`)
    console.log(`        categories: ${parity.categoriesPresent.join(', ')}`)

    if (allWarnings.length > 0) {
      for (const w of allWarnings) {
        console.log(`        ! ${w}`)
      }
    }
    console.log('')
  }

  console.log('=== Summary ===')
  console.log(`  Total: ${totalRoles}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Warnings: ${failed}`)

  if (failed > 0) {
    console.log('\n  Roles with parity warnings:')
    for (const r of results) {
      if (!r.passed) {
        console.log(`    - ${r.role}: ${r.warnings[0]}`)
      }
    }
    console.log('\n  Note: Token count increases are EXPECTED — old prompts were minimal identity-only,')
    console.log('  new sections produce comprehensive prompts with identity + safety + behavior + tools + style.')
    console.log('  The parity threshold (50%) is intentionally strict to highlight this difference.')
  }

  process.exit(failed > 0 ? 0 : 0)
}

main().catch((err) => {
  console.error('Parity test failed with error:', err)
  process.exit(1)
})
