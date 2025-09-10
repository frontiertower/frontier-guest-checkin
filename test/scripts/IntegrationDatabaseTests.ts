import { PrismaClient } from '@prisma/client'
import { QRPayloadGenerator } from '../utils/QRPayloadGenerator'
import { TestDataFactory } from '../utils/TestDataFactory'

/**
 * Integration tests that run against configured database
 * 
 * CRITICAL: These tests run against real database data
 * - DO NOT run against production
 * - Uses DATABASE_URL environment variable
 * - Tests real multi-guest check-in flows
 */
export class IntegrationDatabaseTests {
  private static integrationPrisma: PrismaClient

  static getIntegrationPrisma(): PrismaClient {
    if (!this.integrationPrisma) {
      const databaseUrl = process.env.DATABASE_URL
      
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured. Set environment variable.')
      }

      if (databaseUrl.includes('prod') || databaseUrl.includes('production')) {
        throw new Error('REFUSING to run tests against production database!')
      }

      this.integrationPrisma = new PrismaClient({
        datasourceUrl: databaseUrl,
        log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
      })
    }
    return this.integrationPrisma
  }

  static async verifyEnvironment() {
    console.log('\n🔍 Verifying Integration Environment')
    console.log('=' .repeat(50))

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('❌ DATABASE_URL not set')
    }

    if (databaseUrl.includes('prod')) {
      throw new Error('❌ REFUSING to test against production!')
    }

    console.log('✅ Database URL configured')
    console.log(`   URL: ${databaseUrl.replace(/:[^:@]*@/, ':***@')}`)

    const prisma = this.getIntegrationPrisma()
    
    try {
      await prisma.$connect()
      console.log('✅ Successfully connected to integration database')
      
      const stats = await prisma.$transaction([
        prisma.user.count(),
        prisma.guest.count(),
        prisma.visit.count(),
      ])
      
      console.log(`✅ Database data: ${stats[0]} users, ${stats[1]} guests, ${stats[2]} visits`)
    } catch (error) {
      throw new Error(`❌ Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  static async testRealMultiGuestCheckin() {
    console.log('\n🎯 Integration: Multi-Guest Check-in Test')
    console.log('=' .repeat(50))

    const prisma = this.getIntegrationPrisma()

    // Find real integration test guests with terms accepted
    const validGuests = await prisma.guest.findMany({
      where: {
        blacklistedAt: null,
        termsAcceptedAt: { not: null },
      },
      take: 3,
      orderBy: { createdAt: 'desc' }
    })

    if (validGuests.length < 3) {
      console.log('⚠️  Insufficient valid guests in database. Creating test guests...')
      
      // Create test guests in database
      for (let i = 0; i < 3; i++) {
        await prisma.guest.create({
          data: TestDataFactory.createGuest({
            email: `integration.test.guest.${Date.now()}.${i}@frontier.test`,
          })
        })
      }

      // Re-fetch
      const newGuests = await prisma.guest.findMany({
        where: {
          blacklistedAt: null,
          termsAcceptedAt: { not: null },
        },
        take: 3,
        orderBy: { createdAt: 'desc' }
      })
      
      validGuests.push(...newGuests)
    }

    // Find a real host
    let host = await prisma.user.findFirst({
      where: { role: 'host' },
      orderBy: { createdAt: 'desc' }
    })

    if (!host) {
      console.log('⚠️  No hosts in database. Creating test host...')
      host = await prisma.user.create({
        data: TestDataFactory.createHost({
          email: `integration.test.host.${Date.now()}@frontier.test`,
        })
      })
    }

    // Generate QR payload for these integration test guests
    const qrPayload = QRPayloadGenerator.createMultiGuestPayload(
      validGuests.slice(0, 3),
      {
        hostId: host.id,
        eventId: `integration-test-${Date.now()}`,
        expiresIn: 3600,
        sign: true,
      }
    )

    console.log(`\n📱 Testing QR payload with ${validGuests.length} integration guests`)
    console.log(`Host: ${host.name} (${host.email})`)

    // Validate QR payload
    const parsed = JSON.parse(qrPayload)
    const validation = QRPayloadGenerator.validatePayload(parsed)
    
    console.log(`✅ QR Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`)
    if (!validation.valid) {
      console.log('Errors:', validation.errors)
      return false
    }

    // Test the check-in process
    const results = []
    for (const guestData of parsed.guests) {
      const guest = validGuests.find(g => g.email === guestData.e)
      if (!guest) continue

      try {
        // Check business rules
        const monthlyLimit = await this.verifyGuestMonthlyLimit(guest.id)
        const hostLimit = await this.verifyHostConcurrentLimit(host.id)

        if (!monthlyLimit.withinLimit) {
          results.push({
            email: guest.email,
            status: 'LIMIT_EXCEEDED',
            error: `Monthly limit: ${monthlyLimit.count}/${monthlyLimit.limit}`
          })
          continue
        }

        if (!hostLimit.withinLimit) {
          results.push({
            email: guest.email,
            status: 'HOST_FULL', 
            error: `Host capacity: ${hostLimit.count}/${hostLimit.limit}`
          })
          continue
        }

        // Create invitation in database
        const invitation = await prisma.invitation.create({
          data: await TestDataFactory.createInvitation(guest.id, host.id, {
            status: 'ACTIVATED',
            qrToken: parsed.signature?.substring(0, 32),
          })
        })

        // Create visit in database
        const visit = await prisma.visit.create({
          data: {
            guestId: guest.id,
            hostId: host.id,
            locationId: invitation.locationId, // Use same location as invitation
            invitationId: invitation.id,
            checkedInAt: new Date(),
            checkedOutAt: null,
          }
        })

        results.push({
          email: guest.email,
          status: 'CHECKED_IN',
          visitId: visit.id,
          invitationId: invitation.id,
        })

        console.log(`✅ ${guest.name} checked in successfully`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          email: guest.email,
          status: 'ERROR',
          error: message,
        })
        console.log(`❌ ${guest.name} failed: ${message}`)
      }
    }

    // Summary
    const successful = results.filter(r => r.status === 'CHECKED_IN')
    const failed = results.filter(r => r.status !== 'CHECKED_IN')

    console.log(`\n📊 Integration Test Results:`)
    console.log(`✅ Successful check-ins: ${successful.length}`)
    console.log(`❌ Failed check-ins: ${failed.length}`)

    return {
      success: successful.length > 0,
      results,
      qrPayload,
    }
  }

  private static async verifyGuestMonthlyLimit(guestId: string) {
    const prisma = this.getIntegrationPrisma()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const [visitCount, policy] = await Promise.all([
      prisma.visit.count({
        where: {
          guestId,
          checkedInAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.policy.findUnique({ where: { id: 1 } }),
    ])

    const limit = policy?.guestMonthlyLimit || 3
    return { count: visitCount, limit, withinLimit: visitCount < limit }
  }

  private static async verifyHostConcurrentLimit(hostId: string) {
    const prisma = this.getIntegrationPrisma()
    
    const [activeCount, policy] = await Promise.all([
      prisma.visit.count({
        where: {
          hostId,
          checkedInAt: { not: null },
          checkedOutAt: null,
        },
      }),
      prisma.policy.findUnique({ where: { id: 1 } }),
    ])

    const limit = policy?.hostConcurrentLimit || 3
    return { count: activeCount, limit, withinLimit: activeCount < limit }
  }

  static async testGuestInvitationFlow() {
    console.log('\n📋 Integration: Guest Invitation Flow Test')
    console.log('=' .repeat(50))

    const prisma = this.getIntegrationPrisma()

    // Find or create a host
    let host = await prisma.user.findFirst({ where: { role: 'host' } })
    if (!host) {
      host = await prisma.user.create({
        data: TestDataFactory.createHost({
          email: `integration.invite.host.${Date.now()}@frontier.test`,
        })
      })
    }

    // Create a new guest for invitation testing
    const newGuest = await prisma.guest.create({
      data: TestDataFactory.createGuest({
        email: `integration.invite.guest.${Date.now()}@frontier.test`,
        termsAcceptedAt: null, // Will need to accept terms
      })
    })

    console.log(`👤 Created guest: ${newGuest.name} (${newGuest.email})`)
    console.log(`🏢 Host: ${host.name} (${host.email})`)

    // Test invitation creation
    const invitation = await prisma.invitation.create({
      data: await TestDataFactory.createInvitation(newGuest.id, host.id, {
        status: 'PENDING',
        inviteDate: new Date(),
      })
    })

    console.log(`✅ Invitation created: ${invitation.id}`)

    // Note: Terms acceptance is enforced by application logic, not DB constraints
    // In a real system, the API would validate this before creating the visit
    console.log(`ℹ️  Guest created without terms acceptance (DB allows this, app logic prevents it)`)

    // Accept terms
    await prisma.guest.update({
      where: { id: newGuest.id },
      data: { termsAcceptedAt: new Date() }
    })

    await prisma.acceptance.create({
      data: {
        guestId: newGuest.id,
        termsVersion: '1.0.0',
        visitorAgreementVersion: '1.0.0',
      }
    })

    console.log(`✅ Terms accepted for guest`)

    // Now create visit
    const visit = await prisma.visit.create({
      data: {
        guestId: newGuest.id,
        hostId: host.id,
        locationId: invitation.locationId, // Use same location as invitation
        invitationId: invitation.id,
        checkedInAt: new Date(),
        checkedOutAt: null,
      }
    })

    console.log(`✅ Visit created successfully: ${visit.id}`)

    return {
      success: true,
      guest: newGuest,
      host,
      invitation,
      visit,
    }
  }

  static async cleanup() {
    if (this.integrationPrisma) {
      await this.integrationPrisma.$disconnect()
    }
  }

  static async runFullIntegrationTestSuite() {
    console.log('\n🚀 RUNNING FULL INTEGRATION TESTS')
    console.log('=' .repeat(60))

    try {
      // Verify environment
      await this.verifyEnvironment()
      
      // Test multi-guest check-in
      const multiGuestResult = await this.testRealMultiGuestCheckin()
      
      // Test invitation flow
      const invitationResult = await this.testGuestInvitationFlow()
      
      console.log('\n🎯 INTEGRATION TEST SUITE COMPLETE')
      console.log('=' .repeat(60))
      console.log(`Multi-guest test: ${multiGuestResult && typeof multiGuestResult === 'object' && multiGuestResult.success ? '✅ PASSED' : '❌ FAILED'}`)
      console.log(`Invitation test: ${invitationResult && typeof invitationResult === 'object' && invitationResult.success ? '✅ PASSED' : '❌ FAILED'}`)
      
      const overallSuccess = (multiGuestResult && typeof multiGuestResult === 'object' && multiGuestResult.success) && (invitationResult && typeof invitationResult === 'object' && invitationResult.success)
      console.log(`\n🏆 OVERALL RESULT: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
      
      return overallSuccess
    } catch (error: unknown) {
      console.error('❌ INTEGRATION TESTS FAILED:', error instanceof Error ? error.message : String(error))
      return false
    } finally {
      await this.cleanup()
    }
  }
}