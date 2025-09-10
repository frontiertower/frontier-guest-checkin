#!/usr/bin/env tsx

import './setup'
import { IntegrationDatabaseTests } from './IntegrationDatabaseTests'
import { InvitationQRFlow } from './InvitationQRFlow'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  console.log('\n🧪 Frontier Integration Test Runner')
  console.log('=' .repeat(50))

  // Safety check
  const env = process.env.NODE_ENV
  if (env === 'production') {
    console.error('❌ REFUSING to run integration tests in production environment!')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured')
    console.error('\nSet environment variable:')
    console.error('export DATABASE_URL="postgresql://user:pass@host:5432/db"')
    console.error('\nOr create .env.local file with database URL')
    process.exit(1)
  }

  try {
    switch (command) {
      case 'verify':
        console.log('\n🔍 Verifying integration environment...')
        await IntegrationDatabaseTests.verifyEnvironment()
        break

      case 'multi-checkin':
        console.log('\n🎯 Testing multi-guest check-in...')
        await IntegrationDatabaseTests.verifyEnvironment()
        const result = await IntegrationDatabaseTests.testRealMultiGuestCheckin()
        process.exit(result && typeof result === 'object' && result.success ? 0 : 1)

      case 'invitation':
        console.log('\n📋 Testing guest invitation flow...')
        await IntegrationDatabaseTests.verifyEnvironment()
        const inviteResult = await IntegrationDatabaseTests.testGuestInvitationFlow()
        process.exit(inviteResult && typeof inviteResult === 'object' && inviteResult.success ? 0 : 1)

      case 'qr-flow':
        console.log('\n📱 Testing QR invitation flow...')
        await IntegrationDatabaseTests.verifyEnvironment()
        const prisma = IntegrationDatabaseTests.getIntegrationPrisma()
        const qrResult = await InvitationQRFlow.runCompleteInvitationFlow(prisma)
        process.exit(qrResult.success ? 0 : 1)

      case 'full':
      case 'all':
        console.log('\n🚀 Running full integration test suite...')
        const fullResult = await IntegrationDatabaseTests.runFullIntegrationTestSuite()
        process.exit(fullResult ? 0 : 1)

      default:
        console.log('\nAvailable commands:')
        console.log('  verify        - Check database connection')
        console.log('  multi-checkin - Test multi-guest check-in flow')
        console.log('  invitation    - Test guest invitation flow')
        console.log('  qr-flow       - Test QR invitation flow (CORRECT approach)')
        console.log('  full          - Run complete integration suite')
        console.log('')
        console.log('Examples:')
        console.log('  npm run test:staging verify')
        console.log('  npm run test:staging qr-flow')
        console.log('  npm run test:staging full')
        console.log('')
        console.log('⚠️  WARNING: These tests run against the configured DATABASE_URL!')
        console.log('⚠️  Ensure DATABASE_URL points to a non-production database.')
    }
  } catch (error: unknown) {
    console.error('❌ Integration test failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// Run as script if not in Jest environment
// Skip execution in Jest environment
if (typeof jest === 'undefined') {
  // Only run if executed directly
  main()
}