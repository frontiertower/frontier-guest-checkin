import { PrismaClient } from '@prisma/client'
import { TestDataFactory } from '../utils/TestDataFactory'

/**
 * Tests the complete guest creation flow via invitations
 * 
 * CORRECTED FLOW: QR scans MUST originate from invitations table
 * 
 * 1. Host creates invitation (requires guest to exist in system)
 * 2. QR contains invitation ID/token 
 * 3. Guest scans QR → looks up invitation → validates guest → check-in
 * 4. NO guest creation from QR scan - guests must be pre-registered
 */
export class GuestCreationFlow {
  
  /**
   * Test the flow where a host invites someone not in the system
   */
  static async testInviteNewGuest(prisma: PrismaClient) {
    console.log('\n📧 Testing: Invite New Guest Flow')
    console.log('=' .repeat(50))

    // Get a host
    let host = await prisma.user.findFirst({ where: { role: 'host' } })
    if (!host) {
      host = await prisma.user.create({
        data: TestDataFactory.createHost()
      })
    }

    // Scenario: Host wants to invite someone completely new
    const newGuestEmail = `new.guest.${Date.now()}@company.com`
    const newGuestName = 'John New Visitor'
    
    console.log(`🏢 Host: ${host.name}`)
    console.log(`👤 Inviting: ${newGuestName} (${newGuestEmail})`)

    // CURRENT PROBLEM: We can't create invitation without guestId!
    // This will fail because guestId is required
    
    try {
      // Option 1: Create guest first (current approach)
      const newGuest = await prisma.guest.create({
        data: {
          email: newGuestEmail,
          name: newGuestName,
          phone: '+1234567890',
          termsAcceptedAt: null, // They haven't accepted yet
        }
      })

      console.log(`✅ Created guest record: ${newGuest.id}`)

      // Now create invitation
      const invitation = await prisma.invitation.create({
        data: await TestDataFactory.createInvitation(newGuest.id, host.id, {
          status: 'PENDING',
          inviteDate: new Date(),
          qrToken: `invite_${Date.now()}`,
        })
      })

      console.log(`✅ Created invitation: ${invitation.id}`)

      return {
        success: true,
        guest: newGuest,
        host,
        invitation,
        flow: 'CREATE_GUEST_FIRST'
      }
    } catch (error: unknown) {
      console.log(`❌ Current approach failed: ${error instanceof Error ? error.message : String(error)}`)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Test the QR check-in flow for new guests
   */
  static async testQRCheckInNewGuest(prisma: PrismaClient) {
    console.log('\n📱 Testing: QR Check-in for New Guest')
    console.log('=' .repeat(50))

    // Create the invitation scenario first
    const inviteResult = await this.testInviteNewGuest(prisma)
    if (!inviteResult.success) {
      return inviteResult
    }

    const { guest, host, invitation } = inviteResult

    console.log(`📱 Simulating QR scan by guest: ${guest!.email}`)

    // Step 1: Guest scans QR and sees terms
    console.log('Step 1: Guest sees terms acceptance screen')
    
    // Step 2: Guest accepts terms
    await prisma.guest.update({
      where: { id: guest!.id },
      data: { termsAcceptedAt: new Date() }
    })

    await prisma.acceptance.create({
      data: {
        guestId: guest!.id,
        termsVersion: '1.0.0',
        visitorAgreementVersion: '1.0.0',
      }
    })

    console.log('✅ Step 2: Terms accepted')

    // Step 3: Create the actual visit
    const visit = await prisma.visit.create({
      data: {
        guestId: guest!.id,
        hostId: host!.id,
        locationId: invitation!.locationId, // Use same location as invitation
        invitationId: invitation!.id,
        checkedInAt: new Date(),
        checkedOutAt: null,
      }
    })

    // Update invitation status
    await prisma.invitation.update({
      where: { id: invitation!.id },
      data: { status: 'CHECKED_IN' }
    })

    console.log('✅ Step 3: Guest checked in successfully')
    console.log(`   Visit ID: ${visit.id}`)

    return {
      success: true,
      guest,
      host,
      invitation,
      visit,
      flow: 'COMPLETE_CHECKIN'
    }
  }

  /**
   * PROPOSED: Better schema for guest-first invitations
   */
  static async demonstrateImprovedFlow() {
    console.log('\n💡 PROPOSED: Improved Guest Invitation Schema')
    console.log('=' .repeat(60))

    console.log(`
CURRENT PROBLEM:
- Invitation.guestId is required
- Must create guest record before invitation
- Guest hasn't accepted terms yet when invited

PROPOSED SOLUTION:
Add optional fields to Invitation model:

model Invitation {
  id           String  @id @default(dbgenerated("gen_random_uuid()"))
  
  // Either link to existing guest OR store new guest info
  guestId      String? @map("guest_id") @db.Uuid  // Make optional
  guestEmail   String? @map("guest_email")        // For new guests
  guestName    String? @map("guest_name")         // For new guests
  guestPhone   String? @map("guest_phone")        // For new guests
  
  hostId       String  @map("host_id") @db.Uuid
  status       InvitationStatus @default(PENDING)
  // ... rest of fields
}

FLOW:
1. Host creates invitation with guestEmail/guestName (no guestId)
2. QR contains invitation ID
3. On scan: 
   - Check if guest exists (by email)
   - If not, create guest record
   - Link invitation to guest
   - Show terms acceptance
   - Create visit after terms accepted

BENEFITS:
- Host can invite anyone by email/name
- Guest records created just-in-time
- Terms acceptance handled properly
- No orphaned guest records
`)

    return {
      recommendation: 'ADD_OPTIONAL_GUEST_FIELDS_TO_INVITATION',
      benefits: [
        'Just-in-time guest creation',
        'Proper terms flow',
        'No orphaned records',
        'Better host experience'
      ]
    }
  }

  /**
   * Test edge cases in guest creation
   */
  static async testEdgeCases(prisma: PrismaClient) {
    console.log('\n⚠️  Testing: Edge Cases')
    console.log('=' .repeat(50))

    const results = []

    // Edge case 1: Duplicate email invitation
    try {
      const existingGuest = await prisma.guest.findFirst()
      if (existingGuest) {
        const host = await prisma.user.findFirst({ where: { role: 'host' } })
        
        // Try to invite existing guest again
        await prisma.invitation.create({
          data: await TestDataFactory.createInvitation(existingGuest.id, host!.id)
        })
        
        results.push({
          case: 'DUPLICATE_EMAIL_INVITE',
          status: 'ALLOWED',
          note: 'System allows multiple invitations to same guest'
        })
      }
    } catch (error: unknown) {
      results.push({
        case: 'DUPLICATE_EMAIL_INVITE', 
        status: 'BLOCKED',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // Edge case 2: Invitation without terms acceptance
    try {
      const guestWithoutTerms = await prisma.guest.create({
        data: TestDataFactory.createGuestWithoutTerms({
          email: `no.terms.${Date.now()}@test.com`
        })
      })
      
      const host = await prisma.user.findFirst({ where: { role: 'host' } })
      
      await prisma.visit.create({
        data: await TestDataFactory.createVisit(guestWithoutTerms.id, host!.id, {
          checkedInAt: new Date(),
        })
      })
      
      results.push({
        case: 'VISIT_WITHOUT_TERMS',
        status: 'ALLOWED',
        warning: 'System allows visits without terms - THIS IS A PROBLEM!'
      })
    } catch {
      results.push({
        case: 'VISIT_WITHOUT_TERMS',
        status: 'BLOCKED', 
        note: 'Good - system blocks visits without terms'
      })
    }

    // Edge case 3: Blacklisted guest invitation
    try {
      const blacklistedGuest = await prisma.guest.create({
        data: TestDataFactory.createBlacklistedGuest({
          email: `blacklisted.${Date.now()}@test.com`
        })
      })
      
      const host = await prisma.user.findFirst({ where: { role: 'host' } })
      
      await prisma.invitation.create({
        data: await TestDataFactory.createInvitation(blacklistedGuest.id, host!.id)
      })
      
      results.push({
        case: 'BLACKLISTED_INVITATION',
        status: 'ALLOWED',
        warning: 'System allows inviting blacklisted guests!'
      })
    } catch {
      results.push({
        case: 'BLACKLISTED_INVITATION',
        status: 'BLOCKED',
        note: 'Good - system blocks blacklisted invitations'
      })
    }

    console.log('\n📊 Edge Case Results:')
    results.forEach(result => {
      const icon = result.status === 'BLOCKED' ? '✅' : '⚠️'
      console.log(`${icon} ${result.case}: ${result.status}`)
      if (result.warning) console.log(`   ⚠️ ${result.warning}`)
      if (result.note) console.log(`   📝 ${result.note}`)
      if (result.error) console.log(`   ❌ ${result.error}`)
    })

    return results
  }

  static async runCompleteFlow(prisma: PrismaClient) {
    console.log('\n🚀 COMPLETE GUEST CREATION FLOW TEST')
    console.log('=' .repeat(60))

    try {
      // Test new guest invitation
      const inviteResult = await this.testInviteNewGuest(prisma)
      if (!inviteResult.success) {
        throw new Error(`Invite failed: ${inviteResult.error}`)
      }

      // Test QR check-in
      const checkinResult = await this.testQRCheckInNewGuest(prisma)
      if (!checkinResult.success) {
        throw new Error('Check-in failed')
      }

      // Test edge cases
      await this.testEdgeCases(prisma)

      // Show improvement recommendations
      await this.demonstrateImprovedFlow()

      console.log('\n🎯 FLOW TEST COMPLETE')
      console.log('✅ New guest invitation: WORKS')
      console.log('✅ QR check-in flow: WORKS')
      console.log('⚠️  Schema improvements needed for better UX')

      return { success: true }
    } catch (error: unknown) {
      console.error(`❌ Flow test failed: ${error instanceof Error ? error.message : String(error)}`)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}