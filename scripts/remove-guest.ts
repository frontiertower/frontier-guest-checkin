import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeGuest() {
  const email = 'mock7ee@gmail.com';
  
  console.log(`\n🔍 Searching for guest with email: ${email}\n`);
  
  try {
    // Find the guest
    const guest = await prisma.guest.findUnique({
      where: { email },
      include: {
        visits: true,
        invitations: true,
        acceptances: true,
        discounts: true
      }
    });
    
    if (!guest) {
      console.log(`❌ No guest found with email: ${email}`);
      return;
    }
    
    console.log(`✅ Found guest: ${guest.name || 'No name'} (${guest.email})`);
    console.log(`   ID: ${guest.id}`);
    console.log(`   Created: ${guest.createdAt}`);
    console.log(`   Profile Completed: ${guest.profileCompleted}`);
    console.log(`   Terms Accepted: ${guest.termsAcceptedAt ? 'Yes' : 'No'}`);
    
    console.log(`\n📊 Related records to be deleted:`);
    console.log(`   - Visits: ${guest.visits.length}`);
    console.log(`   - Invitations: ${guest.invitations.length}`);
    console.log(`   - Acceptances: ${guest.acceptances.length}`);
    console.log(`   - Discounts: ${guest.discounts.length}`);
    
    if (guest.visits.length > 0) {
      console.log(`\n   Visit IDs: ${guest.visits.map(v => v.id).join(', ')}`);
    }
    if (guest.invitations.length > 0) {
      console.log(`   Invitation IDs: ${guest.invitations.map(i => i.id).join(', ')}`);
    }
    
    console.log(`\n🗑️  Starting deletion process...`);
    
    // Delete in correct order due to foreign key constraints
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete discounts
      const discountsDeleted = await tx.discount.deleteMany({
        where: { guestId: guest.id }
      });
      console.log(`   ✓ Deleted ${discountsDeleted.count} discount records`);
      
      // 2. Delete acceptances
      const acceptancesDeleted = await tx.acceptance.deleteMany({
        where: { guestId: guest.id }
      });
      console.log(`   ✓ Deleted ${acceptancesDeleted.count} acceptance records`);
      
      // 3. Delete visits
      const visitsDeleted = await tx.visit.deleteMany({
        where: { guestId: guest.id }
      });
      console.log(`   ✓ Deleted ${visitsDeleted.count} visit records`);
      
      // 4. Delete invitations
      const invitationsDeleted = await tx.invitation.deleteMany({
        where: { guestId: guest.id }
      });
      console.log(`   ✓ Deleted ${invitationsDeleted.count} invitation records`);
      
      // 5. Finally, delete the guest
      const guestDeleted = await tx.guest.delete({
        where: { id: guest.id }
      });
      console.log(`   ✓ Deleted guest record`);
      
      return {
        discountsDeleted: discountsDeleted.count,
        acceptancesDeleted: acceptancesDeleted.count,
        visitsDeleted: visitsDeleted.count,
        invitationsDeleted: invitationsDeleted.count,
        guestDeleted: guestDeleted
      };
    });
    
    console.log(`\n✅ Successfully removed guest Eric Mockler (${email}) and all related records!`);
    console.log(`\n📋 Summary:`);
    console.log(`   - Guest record deleted`);
    console.log(`   - ${result.visitsDeleted} visits removed`);
    console.log(`   - ${result.invitationsDeleted} invitations removed`);
    console.log(`   - ${result.acceptancesDeleted} acceptances removed`);
    console.log(`   - ${result.discountsDeleted} discounts removed`);
    
    // Verify deletion
    const verifyGuest = await prisma.guest.findUnique({
      where: { email }
    });
    
    if (!verifyGuest) {
      console.log(`\n✅ Verification: Guest has been completely removed from the database.`);
    } else {
      console.log(`\n⚠️  Warning: Guest still exists in database!`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error removing guest:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

removeGuest();