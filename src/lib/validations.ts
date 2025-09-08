/**
 * Business rule validations for guest invitation system
 * All validations enforce the domain constraints
 */

import { prisma } from "@/lib/prisma";
import { nowInLA, thirtyDaysAgoInLA, isAfterCutoff, calculateNextEligibleDate } from "@/lib/timezone";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  nextEligibleDate?: Date;
  currentCount?: number;
  maxCount?: number;
}

/**
 * Get current policies from database
 */
async function getPolicies() {
  const policies = await prisma.policy.findFirst({
    where: { id: 1 }
  });
  
  // Return defaults if no policies exist
  return policies || {
    guestMonthlyLimit: 3,
    hostConcurrentLimit: 3
  };
}

/**
 * Check if host has reached concurrent active guest limit per location
 */
export async function validateHostConcurrentLimit(hostId: string, locationId: string): Promise<ValidationResult> {
  const now = nowInLA();
  const policies = await getPolicies();
  const limit = policies.hostConcurrentLimit;
  
  // Count active visits for this host at this specific location
  const activeVisitsCount = await prisma.visit.count({
    where: {
      hostId,
      locationId, // Location-specific capacity limit
      checkedInAt: { not: null },
      expiresAt: { gt: now },
    },
  });

  if (activeVisitsCount >= limit) {
    // Get location name for better error messaging
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true }
    });
    
    return {
      isValid: false,
      error: `Host at capacity with ${activeVisitsCount} guests at ${location?.name || 'this location'} (max ${limit}). Security can override if needed.`,
      currentCount: activeVisitsCount,
      maxCount: limit,
    };
  }

  return { isValid: true };
}

/**
 * Check if guest has reached 30-day rolling limit (configurable)
 */
export async function validateGuestRollingLimit(guestEmail: string): Promise<ValidationResult> {
  const thirtyDaysAgo = thirtyDaysAgoInLA();
  const policies = await getPolicies();
  const limit = policies.guestMonthlyLimit;
  
  const recentVisits = await prisma.visit.findMany({
    where: {
      guest: { email: guestEmail },
      checkedInAt: { 
        not: null,
        gte: thirtyDaysAgo,
      },
    },
    orderBy: { checkedInAt: 'desc' },
    take: limit,
  });

  if (recentVisits.length >= limit) {
    const oldestRecentVisit = recentVisits[recentVisits.length - 1];
    const nextEligibleDate = calculateNextEligibleDate(oldestRecentVisit.checkedInAt!);
    
    return {
      isValid: false,
      error: `Guest has reached ${limit} visits this month. Next visit available ${nextEligibleDate.toLocaleDateString()}.`,
      nextEligibleDate,
    };
  }

  return { isValid: true };
}

/**
 * Check if location has reached daily visitor capacity
 */
export async function validateLocationCapacity(locationId: string): Promise<ValidationResult> {
  const now = nowInLA();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  // Get location settings
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { 
      name: true, 
      settings: true,
      isActive: true 
    }
  });
  
  if (!location) {
    return {
      isValid: false,
      error: 'Location not found',
    };
  }
  
  if (!location.isActive) {
    return {
      isValid: false,
      error: `${location.name} is currently closed for visits`,
    };
  }
  
  // Check location-specific settings
  const settings = location.settings as { maxDailyVisits?: number } | null;
  const maxDailyVisits = settings?.maxDailyVisits || 1000; // Default high limit
  
  // Count today's check-ins at this location
  const todayCheckIns = await prisma.visit.count({
    where: {
      locationId,
      checkedInAt: {
        not: null,
        gte: todayStart,
        lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });
  
  if (todayCheckIns >= maxDailyVisits) {
    return {
      isValid: false,
      error: `${location.name} has reached daily capacity (${todayCheckIns}/${maxDailyVisits} visitors). Try another location.`,
      currentCount: todayCheckIns,
      maxCount: maxDailyVisits,
    };
  }
  
  return { isValid: true };
}

/**
 * Check if current time is after location-specific cutoff
 */
export async function validateTimeCutoff(locationId?: string): Promise<ValidationResult> {
  const now = nowInLA();
  
  if (locationId) {
    // Use location-specific cutoff hours
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true, settings: true }
    });
    
    if (location) {
      const settings = location.settings as { checkInCutoffHour?: number } | null;
      const cutoffHour = settings?.checkInCutoffHour || 23; // Default 11 PM
      
      if (cutoffHour === 24) {
        // 24/7 location
        return { isValid: true };
      }
      
      const currentHour = now.getHours();
      if (currentHour >= cutoffHour) {
        return {
          isValid: false,
          error: `${location.name} is closed for the night. Check-ins resume tomorrow morning.`,
        };
      }
    }
  } else {
    // Fallback to global cutoff
    if (isAfterCutoff()) {
      return {
        isValid: false,
        error: "Building is closed for the night. Check-ins resume tomorrow morning.",
      };
    }
  }

  return { isValid: true };
}

/**
 * Check if guest is blacklisted
 */
export async function validateGuestBlacklist(guestEmail: string): Promise<ValidationResult> {
  const guest = await prisma.guest.findUnique({
    where: { email: guestEmail },
    select: { blacklistedAt: true }
  });

  if (guest?.blacklistedAt) {
    return {
      isValid: false,
      error: "Guest is not authorized for building access. Contact security for assistance.",
    };
  }

  return { isValid: true };
}

/**
 * Check if guest has valid acceptance for a specific visit context
 * Visit-scoped acceptances expire with the visit
 */
export async function validateVisitScopedAcceptance(
  guestId: string,
  invitationId?: string | null,
  locationId?: string
): Promise<ValidationResult> {
  const now = nowInLA();
  
  // First check for visit-scoped acceptance (new model)
  const visitAcceptance = await prisma.acceptance.findFirst({
    where: {
      guestId,
      invitationId: invitationId || undefined,
      OR: [
        { expiresAt: null }, // No expiration set
        { expiresAt: { gt: now } } // Not expired
      ]
    },
    orderBy: { acceptedAt: 'desc' },
  });

  if (visitAcceptance) {
    return { isValid: true };
  }

  // Fallback: Check for recent general acceptance (legacy support)
  const generalAcceptance = await prisma.acceptance.findFirst({
    where: {
      guestId,
      visitId: null, // No visit association (legacy acceptance)
      acceptedAt: {
        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Within last 24 hours for visit context
      }
    },
    orderBy: { acceptedAt: 'desc' },
  });

  if (generalAcceptance) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: "Guest needs to accept visitor terms for this visit. Email will be sent.",
  };
}

/**
 * Legacy: Check if guest has accepted terms and visitor agreement
 * For backward compatibility during transition
 */
export async function validateGuestAcceptance(guestId: string): Promise<ValidationResult> {
  const acceptance = await prisma.acceptance.findFirst({
    where: { guestId },
    orderBy: { acceptedAt: 'desc' },
  });

  if (!acceptance) {
    return {
      isValid: false,
      error: "Guest needs to accept visitor terms before check-in. Email will be sent.",
    };
  }

  const now = nowInLA();
  
  // For visit-scoped acceptances (has visitId), they're only valid for 24 hours
  // For legacy acceptances (no visitId), they're valid for 365 days
  if (acceptance.visitId) {
    // Visit-scoped: 24-hour validity
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (acceptance.acceptedAt < twentyFourHoursAgo) {
      return {
        isValid: false,
        error: "Guest's visitor agreement has expired. New terms acceptance required.",
      };
    }
  } else {
    // Legacy acceptance: 365-day validity
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    if (acceptance.acceptedAt <= oneYearAgo) {
      return {
        isValid: false,
        error: "Guest's visitor agreement has expired. New terms acceptance required.",
      };
    }
  }

  return { isValid: true };
}

/**
 * Check if QR token is valid and not expired
 * For multi-guest QRs, qrExpiresAt can be null (no expiration check needed)
 */
export function validateQRToken(qrExpiresAt: Date | null): ValidationResult {
  // Multi-guest QRs don't have expiration dates - allow null
  if (!qrExpiresAt) {
    return { isValid: true };
  }

  const now = nowInLA();
  if (now >= qrExpiresAt) {
    return {
      isValid: false,
      error: "This QR code has expired. Please generate a new invitation.",
    };
  }

  return { isValid: true };
}

/**
 * Check if guest already has an active visit (for re-entry detection)
 * Enhanced to handle cross-host scenarios
 */
export async function checkExistingActiveVisit(hostId: string, guestEmail: string): Promise<{
  hasActiveVisit: boolean;
  activeVisit?: {
    id: string;
    checkedInAt: Date | null;
    expiresAt: Date | null;
    guest: {
      id: string;
      name: string;
      email: string;
    };
    host: {
      id: string;
      name: string;
      email: string;
    };
  };
  crossHostVisit?: boolean;
}> {
  const now = nowInLA();
  
  // Check for active visit with the same host first
  const sameHostActiveVisit = await prisma.visit.findFirst({
    where: {
      hostId,
      guest: { email: guestEmail },
      checkedInAt: { not: null },
      expiresAt: { gt: now },
    },
    include: {
      guest: true,
      host: true,
    },
  });

  if (sameHostActiveVisit) {
    return {
      hasActiveVisit: true,
      activeVisit: sameHostActiveVisit,
      crossHostVisit: false,
    };
  }

  // Check for active visit with a different host
  const crossHostActiveVisit = await prisma.visit.findFirst({
    where: {
      hostId: { not: hostId },
      guest: { email: guestEmail },
      checkedInAt: { not: null },
      expiresAt: { gt: now },
    },
    include: {
      guest: true,
      host: true,
    },
  });

  if (crossHostActiveVisit) {
    return {
      hasActiveVisit: true,
      activeVisit: crossHostActiveVisit,
      crossHostVisit: true,
    };
  }

  return {
    hasActiveVisit: false,
    activeVisit: undefined,
    crossHostVisit: false,
  };
}

/**
 * Comprehensive validation for creating an invitation
 */
export async function validateCreateInvitation(
  hostId: string,
  guestEmail: string
): Promise<ValidationResult> {
  // Check guest rolling limit
  const rollingLimitResult = await validateGuestRollingLimit(guestEmail);
  if (!rollingLimitResult.isValid) {
    return rollingLimitResult;
  }

  return { isValid: true };
}

/**
 * Comprehensive validation for activating QR code
 */
export async function validateActivateQR(
  hostId: string,
  guestId: string,
  guestEmail: string
): Promise<ValidationResult> {
  // Check if guest has accepted terms (visit-scoped or general)
  const acceptanceResult = await validateVisitScopedAcceptance(guestId, null, locationId);
  if (!acceptanceResult.isValid) {
    // Try legacy validation as fallback
    const legacyResult = await validateGuestAcceptance(guestId);
    if (!legacyResult.isValid) {
      return acceptanceResult; // Return the visit-scoped error message
    }
  }

  // Check guest rolling limit
  const rollingLimitResult = await validateGuestRollingLimit(guestEmail);
  if (!rollingLimitResult.isValid) {
    return rollingLimitResult;
  }

  return { isValid: true };
}

/**
 * Check if user can override capacity limits
 */
export function canUserOverride(userRole?: string): boolean {
  return userRole === 'security' || userRole === 'admin';
}

/**
 * Enhanced validation for admitting returning guests
 * Handles cross-host scenarios and expired acceptance gracefully
 */
export async function validateAdmitGuestWithRenewal(
  hostId: string,
  guestId: string,
  guestEmail: string,
  qrExpiresAt: Date | null,
  locationId?: string
): Promise<ValidationResult & { requiresAcceptanceRenewal?: boolean }> {
  // Check if guest is blacklisted (early check)
  const blacklistResult = await validateGuestBlacklist(guestEmail);
  if (!blacklistResult.isValid) {
    return blacklistResult;
  }

  // Check time cutoff
  const timeCutoffResult = await validateTimeCutoff(locationId);
  if (!timeCutoffResult.isValid) {
    return timeCutoffResult;
  }

  // Check QR token validity
  const qrTokenResult = validateQRToken(qrExpiresAt);
  if (!qrTokenResult.isValid) {
    return qrTokenResult;
  }

  // Check host concurrent limit
  if (locationId) {
    const concurrentLimitResult = await validateHostConcurrentLimit(hostId, locationId);
    if (!concurrentLimitResult.isValid) {
      return concurrentLimitResult;
    }
  }

  // Check guest rolling limit
  const rollingLimitResult = await validateGuestRollingLimit(guestEmail);
  if (!rollingLimitResult.isValid) {
    return rollingLimitResult;
  }

  // Check if guest has recent accepted terms (visit-scoped)
  const acceptanceResult = await validateVisitScopedAcceptance(guestId, null, locationId);
  if (!acceptanceResult.isValid) {
    // For returning guests, check if they had previous acceptance (expired)
    const hasAnyAcceptance = await prisma.acceptance.findFirst({
      where: { guestId },
    });

    if (hasAnyAcceptance) {
      // Return indication that acceptance renewal is needed
      return {
        isValid: false,
        error: acceptanceResult.error,
        requiresAcceptanceRenewal: true
      };
    } else {
      // First-time guest, full acceptance required
      return acceptanceResult;
    }
  }

  return { isValid: true };
}

/**
 * Comprehensive validation for admitting a guest (check-in)
 * Legacy function - maintained for backward compatibility
 */
export async function validateAdmitGuest(
  hostId: string,
  guestId: string,
  guestEmail: string,
  qrExpiresAt: Date | null
): Promise<ValidationResult> {
  // Use the enhanced validation but ignore renewal flag for backward compatibility
  const result = await validateAdmitGuestWithRenewal(hostId, guestId, guestEmail, qrExpiresAt);
  return {
    isValid: result.isValid,
    error: result.error,
    nextEligibleDate: result.nextEligibleDate,
    currentCount: result.currentCount,
    maxCount: result.maxCount
  };
}

/**
 * Get guest statistics for history display
 */
export async function getGuestStats(guestEmail: string) {
  const thirtyDaysAgo = thirtyDaysAgoInLA();
  
  const [recentVisits, lifetimeVisits, lastVisit, discount] = await Promise.all([
    prisma.visit.count({
      where: {
        guest: { email: guestEmail },
        checkedInAt: { 
          not: null,
          gte: thirtyDaysAgo,
        },
      },
    }),
    prisma.visit.count({
      where: {
        guest: { email: guestEmail },
        checkedInAt: { not: null },
      },
    }),
    prisma.visit.findFirst({
      where: {
        guest: { email: guestEmail },
        checkedInAt: { not: null },
      },
      orderBy: { checkedInAt: 'desc' },
    }),
    prisma.discount.findFirst({
      where: {
        guest: { email: guestEmail },
      },
      orderBy: { triggeredAt: 'desc' },
    }),
  ]);

  return {
    recentVisits,
    lifetimeVisits,
    lastVisitDate: lastVisit?.checkedInAt,
    hasDiscount: !!discount,
  };
}

/**
 * Check if guest should receive discount (3rd lifetime visit)
 */
export async function shouldTriggerDiscount(guestId: string): Promise<boolean> {
  const [lifetimeVisits, existingDiscount] = await Promise.all([
    prisma.visit.count({
      where: {
        guestId,
        checkedInAt: { not: null },
      },
    }),
    prisma.discount.findFirst({
      where: { guestId },
    }),
  ]);

  return lifetimeVisits === 3 && !existingDiscount;
}

/**
 * Create visit-scoped acceptance for a guest
 * Links acceptance to specific visit and sets expiration
 */
export async function createVisitScopedAcceptance(
  guestId: string,
  visitId: string,
  invitationId?: string | null,
  expiresAt?: Date | null,
  termsVersion: string = "1.0",
  visitorAgreementVersion: string = "1.0"
): Promise<void> {
  await prisma.acceptance.create({
    data: {
      guestId,
      visitId,
      invitationId: invitationId || undefined,
      expiresAt: expiresAt || undefined,
      termsVersion,
      visitorAgreementVersion,
    },
  });
}

/**
 * Auto-renew terms acceptance for returning guests
 * Creates a new acceptance record with current timestamp and versions
 */
export async function renewGuestAcceptance(
  guestId: string,
  termsVersion: string = "1.0",
  visitorAgreementVersion: string = "1.0",
  invitationId?: string | null
): Promise<void> {
  // For visit-scoped model, set expiration to 24 hours
  const expiresAt = new Date(nowInLA().getTime() + 24 * 60 * 60 * 1000);
  
  await prisma.acceptance.create({
    data: {
      guestId,
      invitationId: invitationId || undefined,
      expiresAt,
      termsVersion,
      visitorAgreementVersion,
    },
  });
}

/**
 * Handle returning guest scenarios with automatic acceptance renewal
 * This function is designed for QR-based check-ins where guests shouldn't 
 * need to manually re-accept terms for each visit
 */
export async function processReturningGuestCheckIn(
  hostId: string,
  guestId: string,
  guestEmail: string,
  qrExpiresAt: Date | null,
  locationId?: string
): Promise<ValidationResult & { acceptanceRenewed?: boolean }> {
  const validation = await validateAdmitGuestWithRenewal(hostId, guestId, guestEmail, qrExpiresAt, locationId);
  
  // If guest needs acceptance renewal (returning guest with expired terms)
  if (!validation.isValid && validation.requiresAcceptanceRenewal) {
    try {
      // Auto-renew acceptance for returning guests using QR codes
      await renewGuestAcceptance(guestId);
      
      // Re-validate after renewal
      const revalidation = await validateAdmitGuestWithRenewal(hostId, guestId, guestEmail, qrExpiresAt, locationId);
      
      return {
        ...revalidation,
        acceptanceRenewed: true
      };
    } catch {
      return {
        isValid: false,
        error: "Unable to process guest terms update. Technical support needed."
      };
    }
  }
  
  return validation;
}