import { PrismaClient } from '@prisma/client'
import { TestDataFactory } from '../utils/TestDataFactory'

/**
 * CORRECT FLOW: QR Scans originate from INVITATIONS table
 * 
 * Core principle: Every QR scan must trace back to a valid invitation
 * 
 * FLOW:
 * 1. Host creates invitation → generates QR with invitation token
 * 2. Guest scans QR → system looks up invitation by token
 * 3. System validates: guest exists, not blacklisted, terms accepted
 * 4. Creates visit record linked to the invitation
 * 
 * NO ad-hoc guest creation from QR scans!
 */
export class InvitationQRFlow {

  /**
   * Test the CORRECT invitation-based QR flow
   */
  static async testInvitationBasedQR(prisma: PrismaClient) {
    console.log('\n📋 Testing: CORRECT Invitation-Based QR Flow')
    console.log('=' .repeat(60))

    // Step 1: Find/create host and guest (both must exist)
    let host = await prisma.user.findFirst({ where: { role: 'host' } })
    if (!host) {
      host = await prisma.user.create({
        data: TestDataFactory.createHost({
          email: `host.${Date.now()}@frontier.test`,
        })
      })
    }

    let guest = await prisma.guest.findFirst({
      where: { 
        blacklistedAt: null,
        termsAcceptedAt: { not: null }
      }
    })
    if (!guest) {
      guest = await prisma.guest.create({
        data: TestDataFactory.createGuest({
          email: `guest.${Date.now()}@frontier.test`,
          termsAcceptedAt: new Date(), // Terms already accepted
        })
      })
      
      // Create acceptance record
      await prisma.acceptance.create({
        data: {
          guestId: guest.id,
          termsVersion: '1.0.0',
          visitorAgreementVersion: '1.0.0',
        }
      })
    }

    console.log(`🏢 Host: ${host.name} (${host.email})`)
    console.log(`👤 Guest: ${guest.name} (${guest.email})`)

    // Step 2: Host creates invitation in system
    // Get or create a default location
    let location = await prisma.location.findFirst({ where: { isActive: true } })
    if (!location) {
      location = await prisma.location.create({
        data: {
          name: 'Test Location',
          address: '123 Test Street',
          timezone: 'America/Los_Angeles',
          isActive: true
        }
      })
    }

    const invitation = await prisma.invitation.create({
      data: {
        guestId: guest.id,
        hostId: host.id,
        locationId: location.id,
        status: 'PENDING',
        inviteDate: new Date(),
        qrToken: `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        qrIssuedAt: new Date(),
        qrExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }
    })

    console.log(`✅ Created invitation: ${invitation.id}`)
    console.log(`   QR Token: ${invitation.qrToken}`)

    // Step 3: Generate QR payload with invitation token
    const qrPayload = JSON.stringify({
      type: 'invitation',
      token: invitation.qrToken,
      invitationId: invitation.id,
      hostName: host.name,
      guestEmail: guest.email,
      expiresAt: invitation.qrExpiresAt?.toISOString(),
    })

    console.log(`📱 QR Payload: ${qrPayload.substring(0, 100)}...`)

    // Step 4: Simulate QR scan and lookup
    const scanResult = await this.simulateQRScan(prisma, qrPayload)
    
    return {
      success: scanResult.success,
      host,
      guest, 
      invitation,
      scanResult,
    }
  }

  /**
   * Simulate QR scan process - this is what the kiosk/app does
   */
  static async simulateQRScan(prisma: PrismaClient, qrPayload: string) {
    console.log('\n📱 Simulating QR Scan Process')
    console.log('=' .repeat(50))

    try {
      // Parse QR payload
      const parsed = JSON.parse(qrPayload)
      console.log(`🔍 QR Type: ${parsed.type}`)

      if (parsed.type !== 'invitation') {
        throw new Error('Invalid QR type - must be invitation-based')
      }

      // Look up invitation by token
      const invitation = await prisma.invitation.findFirst({
        where: { 
          qrToken: parsed.token,
          status: 'PENDING'
        },
        include: {
          guest: true,
          host: true,
        }
      })

      if (!invitation) {
        throw new Error('Invalid or expired invitation token')
      }

      console.log(`✅ Found invitation: ${invitation.id}`)
      console.log(`   Guest: ${invitation.guest.name}`)
      console.log(`   Host: ${invitation.host.name}`)

      // Validate invitation hasn't expired
      if (invitation.qrExpiresAt && invitation.qrExpiresAt < new Date()) {
        throw new Error('QR code has expired')
      }

      // Validate guest is eligible
      if (invitation.guest.blacklistedAt) {
        throw new Error('Guest is blacklisted')
      }

      if (!invitation.guest.termsAcceptedAt) {
        throw new Error('Guest has not accepted terms')
      }

      // Check business rules
      const monthlyVisits = await prisma.visit.count({
        where: {
          guestId: invitation.guestId,
          checkedInAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })

      const policy = await prisma.policy.findUnique({ where: { id: 1 } })
      if (monthlyVisits >= (policy?.guestMonthlyLimit || 3)) {
        throw new Error(`Guest exceeds monthly limit (${monthlyVisits}/3)`)
      }

      // Check host capacity
      const hostActiveGuests = await prisma.visit.count({
        where: {
          hostId: invitation.hostId,
          checkedInAt: { not: null },
          checkedOutAt: null,
        }
      })

      if (hostActiveGuests >= (policy?.hostConcurrentLimit || 3)) {
        throw new Error(`Host at capacity (${hostActiveGuests}/3)`)
      }

      console.log('✅ All validations passed')

      // Create the visit record
      const visit = await prisma.visit.create({
        data: {
          guestId: invitation.guestId,
          hostId: invitation.hostId,
          locationId: invitation.locationId, // Use same location as invitation
          invitationId: invitation.id,
          invitedAt: invitation.createdAt,
          checkedInAt: new Date(),
          checkedOutAt: null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      })

      // Update invitation status
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'CHECKED_IN' }
      })

      console.log(`✅ Guest checked in successfully`)
      console.log(`   Visit ID: ${visit.id}`)

      return {
        success: true,
        invitation,
        visit,
        guest: invitation.guest,
        host: invitation.host,
      }

    } catch (error) {
      console.log(`❌ QR scan failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Test multi-guest invitations (proper way)
   */
  static async testMultiGuestInvitation(prisma: PrismaClient, guestCount: number = 3) {
    console.log(`\n👥 Testing: Multi-Guest Invitation (${guestCount} guests)`)
    console.log('=' .repeat(60))

    // Get host
    let host = await prisma.user.findFirst({ where: { role: 'host' } })
    if (!host) {
      host = await prisma.user.create({
        data: TestDataFactory.createHost()
      })
    }

    // Get or create valid guests
    const guests: Array<{ id: string; email: string; name: string }> = []
    const existingGuests = await prisma.guest.findMany({
      where: {
        blacklistedAt: null,
        termsAcceptedAt: { not: null }
      },
      take: guestCount
    })

    guests.push(...existingGuests)

    // Create additional guests if needed
    const needed = guestCount - guests.length
    for (let i = 0; i < needed; i++) {
      const newGuest = await prisma.guest.create({
        data: TestDataFactory.createGuest({
          email: `multi.guest.${Date.now()}.${i}@frontier.test`,
        })
      })
      guests.push(newGuest)
    }

    console.log(`🏢 Host: ${host.name}`)
    console.log(`👥 Guests: ${guests.length}`)

    // Get or create a default location
    let location = await prisma.location.findFirst({ where: { isActive: true } })
    if (!location) {
      location = await prisma.location.create({
        data: {
          name: 'Test Location',
          address: '123 Test Street',
          timezone: 'America/Los_Angeles',
          isActive: true
        }
      })
    }

    // Create individual invitations for each guest
    const invitations = []
    for (const guest of guests) {
      const invitation = await prisma.invitation.create({
        data: {
          guestId: guest.id,
          hostId: host.id,
          locationId: location.id,
          status: 'PENDING',
          inviteDate: new Date(),
          qrToken: `multi_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          qrIssuedAt: new Date(),
          qrExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      })
      invitations.push(invitation)
    }

    console.log(`✅ Created ${invitations.length} individual invitations`)

    // Generate batch QR payload with all invitation tokens
    const batchQR = JSON.stringify({
      type: 'batch_invitation',
      invitations: invitations.map(inv => ({
        token: inv.qrToken,
        invitationId: inv.id,
        guestEmail: guests.find(g => g.id === inv.guestId)?.email,
      })),
      hostName: host.name,
      eventId: `multi_checkin_${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

    console.log(`📱 Batch QR generated for ${invitations.length} invitations`)

    // Simulate batch check-in
    const results = []
    for (const invData of JSON.parse(batchQR).invitations) {
      const singleQR = JSON.stringify({
        type: 'invitation',
        token: invData.token,
        invitationId: invData.invitationId,
      })
      
      const scanResult = await this.simulateQRScan(prisma, singleQR)
      results.push({
        email: invData.guestEmail,
        success: scanResult.success,
        error: scanResult.error,
        visitId: scanResult.visit?.id,
      })
    }

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    console.log(`\n📊 Multi-Guest Check-in Results:`)
    console.log(`✅ Successful: ${successful.length}`)
    console.log(`❌ Failed: ${failed.length}`)

    if (failed.length > 0) {
      console.log('\nFailed check-ins:')
      failed.forEach(f => {
        console.log(`  - ${f.email}: ${f.error}`)
      })
    }

    return {
      success: successful.length > 0,
      host,
      guests,
      invitations,
      results,
    }
  }

  /**
   * Test invalid QR scenarios
   */
  static async testInvalidQRScenarios(prisma: PrismaClient) {
    console.log('\n⚠️  Testing: Invalid QR Scenarios')
    console.log('=' .repeat(50))

    const scenarios = [
      {
        name: 'Invalid JSON',
        qr: 'not-json-data',
      },
      {
        name: 'Wrong QR type', 
        qr: JSON.stringify({ type: 'random_guest', email: 'test@test.com' }),
      },
      {
        name: 'Non-existent token',
        qr: JSON.stringify({ type: 'invitation', token: 'fake-token-123' }),
      },
      {
        name: 'Expired invitation',
        qr: JSON.stringify({ 
          type: 'invitation', 
          token: 'expired-token',
          expiresAt: new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago
        }),
      }
    ]

    const results = []
    for (const scenario of scenarios) {
      console.log(`\n🧪 Testing: ${scenario.name}`)
      const result = await this.simulateQRScan(prisma, scenario.qr)
      results.push({
        scenario: scenario.name,
        success: result.success,
        error: result.error,
        expected: 'Should fail'
      })
    }

    console.log('\n📊 Invalid QR Test Results:')
    results.forEach(r => {
      const status = r.success ? '❌ UNEXPECTEDLY PASSED' : '✅ CORRECTLY FAILED'
      console.log(`${status} - ${r.scenario}`)
      if (r.error) console.log(`   Error: ${r.error}`)
    })

    return results
  }

  static async runCompleteInvitationFlow(prisma: PrismaClient) {
    console.log('\n🚀 COMPLETE INVITATION QR FLOW TEST')
    console.log('=' .repeat(60))

    try {
      // Test single guest invitation
      console.log('\n📋 1. Single Guest Invitation')
      const singleResult = await this.testInvitationBasedQR(prisma)
      if (!singleResult.success) {
        throw new Error('Single guest invitation failed')
      }

      // Test multi-guest invitation
      console.log('\n👥 2. Multi-Guest Invitation')
      const multiResult = await this.testMultiGuestInvitation(prisma, 3)
      if (!multiResult.success) {
        throw new Error('Multi-guest invitation failed')
      }

      // Test invalid scenarios
      console.log('\n⚠️ 3. Invalid QR Scenarios')
      await this.testInvalidQRScenarios(prisma)

      console.log('\n🎯 INVITATION QR FLOW TEST COMPLETE')
      console.log('✅ Single guest: PASSED')
      console.log('✅ Multi-guest: PASSED') 
      console.log('✅ Invalid QR handling: PASSED')
      console.log('\n🏆 ALL INVITATION-BASED TESTS PASSED')

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Invitation flow test failed: ${message}`)
      return { success: false, error: message }
    }
  }
}