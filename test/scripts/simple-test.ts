#!/usr/bin/env tsx

import './setup';
import { prisma } from '@/lib/prisma';

async function runSimpleTest() {
  console.log('🧪 Simple Integration Test');
  console.log('=' .repeat(50));
  
  try {
    // Test database connection
    console.log('\n📊 Database Stats:');
    const userCount = await prisma.user.count();
    console.log(`   ✅ Users: ${userCount}`);
    
    const guestCount = await prisma.guest.count();
    console.log(`   ✅ Guests: ${guestCount}`);
    
    const visitCount = await prisma.visit.count();
    console.log(`   ✅ Visits: ${visitCount}`);
    
    const acceptanceCount = await prisma.acceptance.count();
    console.log(`   ✅ Acceptances: ${acceptanceCount}`);
    
    const locationCount = await prisma.location.count();
    console.log(`   ✅ Locations: ${locationCount}`);
    
    // Test finding a host
    const host = await prisma.user.findFirst({ where: { role: 'host' } });
    if (host) {
      console.log(`\n👤 Sample Host: ${host.name} (${host.email})`);
    }
    
    // Test finding a location
    const location = await prisma.location.findFirst();
    if (location) {
      console.log(`📍 Sample Location: ${location.name}`);
    }
    
    console.log('\n✅ All integration tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSimpleTest();