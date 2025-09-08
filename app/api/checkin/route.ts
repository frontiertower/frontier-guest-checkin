import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { shouldTriggerDiscount, checkExistingActiveVisit, processReturningGuestCheckIn, canUserOverride, createVisitScopedAcceptance } from '@/lib/validations';
import { nowInLA, calculateVisitExpiration } from '@/lib/timezone';
import { sendDiscountEmail } from '@/lib/email';
import { validateQRToken } from '@/lib/qr-token';
import { validateOverrideRequest, type OverrideRequest } from '@/lib/override';
import type { GuestData } from '@/lib/qr-token';

interface CheckInRequest {
  // For single guest via QR token (legacy)
  token?: string;
  // For single/batch guest via direct guest data
  guest?: GuestData;
  guests?: GuestData[];
  // Override parameters
  override?: OverrideRequest;
}

/**
 * Unified Check-In API
 * 
 * Handles both single and multiple guest check-ins through one endpoint.
 * Supports:
 * - Single guest via QR token: { token: "..." }
 * - Single guest via data: { guest: { e: "email", n: "name" } }
 * - Multiple guests: { guests: [{ e: "email", n: "name" }, ...] }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== CHECK-IN API REQUEST START ===');
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    console.log('Content-Type:', request.headers.get('content-type'));
    
    const body: CheckInRequest = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    console.log('Body type:', typeof body);
    console.log('==================================');
    
    const { token, guest, guests, override } = body;

    // Parse and normalize input to array of guests
    let guestList: GuestData[] = [];

    if (token) {
      console.log('Processing token:', token.substring(0, 50) + '...');
      
      // First try to parse as JSON (guest batch format)
      try {
        const parsed = JSON.parse(token);
        console.log('Token parsed as JSON:', parsed);
        
        if (parsed.guests && Array.isArray(parsed.guests)) {
          console.log('Detected guest batch format in token field');
          guestList = parsed.guests;
        } else {
          throw new Error('Not a guest batch format');
        }
      } catch {
        console.log('Token is not JSON, trying base64 validation...');
        
        // Handle legacy QR token format (base64 encoded)
        const tokenValidation = validateQRToken(token);
        console.log('Token validation result:', tokenValidation);
        
        if (!tokenValidation.isValid || !tokenValidation.data) {
          console.log('Token validation failed:', tokenValidation.error);
          return NextResponse.json(
            { 
              success: false,
              message: 'Invalid QR code format',
              error: tokenValidation.error
            },
            { status: 400 }
          );
        }

        const { guestEmail } = tokenValidation.data;
        const guestRecord = await prisma.guest.findUnique({
          where: { email: guestEmail },
          select: { name: true, email: true }
        });

        if (!guestRecord) {
          return NextResponse.json(
            { 
              success: false,
              message: `Guest ${guestEmail} not found in database`,
              guestEmail
            },
            { status: 404 }
          );
        }

        guestList = [{ e: guestRecord.email, n: guestRecord.name }];
      }
    } else if (guest) {
      // Single guest direct format
      guestList = [guest];
    } else if (guests && guests.length > 0) {
      // Multiple guests format
      guestList = guests;
    } else {
      console.log('No guest data provided in request');
      return NextResponse.json(
        { 
          success: false,
          message: 'No guest data provided. Include either token, guest, or guests in request.'
        },
        { status: 400 }
      );
    }

    // Validate guest data
    console.log('Validating guest data for', guestList.length, 'guests');
    for (const g of guestList) {
      if (!g || !g.e || !g.n) {
        console.log('Invalid guest data:', g);
        return NextResponse.json(
          { 
            success: false,
            message: 'All guests must have email (e) and name (n) fields',
            invalidGuest: g
          },
          { status: 400 }
        );
      }
    }

    // Validate override if provided
    let isOverrideValid = false;
    let overrideUser: { id: string; role: string } | null = null;
    if (override) {
      const overrideValidation = validateOverrideRequest(override);
      if (!overrideValidation.isValid) {
        return NextResponse.json(
          { 
            success: false,
            message: overrideValidation.error || 'Invalid override request'
          },
          { status: 400 }
        );
      }

      // Check if user has permission to override (if authenticated)
      try {
        const userId = await getCurrentUserId(request);
        overrideUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, email: true }
        });
        
        if (!overrideUser || !canUserOverride(overrideUser.role)) {
          return NextResponse.json(
            { 
              success: false,
              message: 'Insufficient permissions for override. Contact security staff.'
            },
            { status: 403 }
          );
        }
        
        isOverrideValid = true;
        console.log(`Override authorized by ${overrideUser.role}: ${overrideUser.email}`);
      } catch {
        // Not authenticated - in demo mode, assume security role for override
        console.log('Demo mode: Override request without authentication');
        isOverrideValid = true;
      }
    }

    // Get host ID and location
    let hostId: string;
    let locationId: string;
    try {
      hostId = await getCurrentUserId(request);
      // Get host's primary location
      const hostUser = await prisma.user.findUnique({
        where: { id: hostId },
        select: { locationId: true }
      });
      locationId = hostUser?.locationId || '';
    } catch {
      // No authentication - find a demo host for QR scanner
      const hostUser = await prisma.user.findFirst({
        where: { role: 'host' },
        select: { id: true, email: true, name: true, locationId: true },
        orderBy: { email: 'asc' }
      });
      
      if (!hostUser) {
        return NextResponse.json(
          { 
            success: false,
            message: 'No host found in database. Please run database seeding.'
          },
          { status: 500 }
        );
      }
      
      console.log('Using demo host for check-in:', hostUser.email);
      hostId = hostUser.id;
      locationId = hostUser.locationId || '';
    }

    // If no location from host, use default location
    if (!locationId) {
      const defaultLocation = await prisma.location.findFirst({
        select: { id: true }
      });
      if (!defaultLocation) {
        return NextResponse.json(
          { 
            success: false,
            message: 'No location found in database. Please run database seeding.'
          },
          { status: 500 }
        );
      }
      locationId = defaultLocation.id;
    }
    
    // Validate hostId is a string
    if (!hostId || typeof hostId !== 'string') {
      console.error('Invalid host ID:', { hostId, type: typeof hostId });
      return NextResponse.json(
        { 
          success: false,
          message: 'Invalid host ID. Please contact support.'
        },
        { status: 500 }
      );
    }

    // Process each guest check-in
    const results = [];
    const now = nowInLA();

    for (const guestData of guestList) {
      try {
        const result = await processGuestCheckIn({
          guest: guestData,
          hostId,
          locationId,
          override: isOverrideValid ? override : undefined,
          overrideUserId: overrideUser?.id || null,
          now
        });
        results.push(result);
      } catch (error) {
        console.error(`Error processing guest ${guestData.e}:`, error);
        results.push({
          success: false,
          message: `Check-in failed for ${guestData.n}`,
          guestEmail: guestData.e,
          guestName: guestData.n,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Determine overall success
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const overallSuccess = successCount === totalCount;

    const responseMessage = totalCount === 1
      ? (overallSuccess ? `${results[0].guestName} checked in successfully` : results[0].message)
      : `${successCount}/${totalCount} guests checked in successfully`;

    return NextResponse.json({
      success: overallSuccess,
      message: responseMessage,
      results,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount
      }
    }, { 
      status: overallSuccess ? 200 : (successCount > 0 ? 207 : 400) // 207 = partial success
    });

  } catch (error) {
    console.error('=== CHECK-IN API ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Full error:', error);
    console.error('=========================');
    
    // Check if it's a JSON parsing error
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Invalid request format. Please check the request data.',
          error: 'JSON parsing failed'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Check-in temporarily unavailable. Please try again in a moment.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Process individual guest check-in
 */
async function processGuestCheckIn({
  guest,
  hostId,
  locationId,
  override,
  overrideUserId,
  now
}: {
  guest: GuestData;
  hostId: string;
  locationId: string;
  override?: OverrideRequest;
  overrideUserId?: string | null;
  now: Date;
}) {
  // Validate host exists before processing
  const hostExists = await prisma.user.findUnique({
    where: { id: hostId },
    select: { id: true }
  });
  
  if (!hostExists) {
    console.error('Host not found in processGuestCheckIn:', { hostId });
    return {
      success: false,
      message: `Invalid host ID. Cannot process check-in.`,
      guestEmail: guest.e,
      guestName: guest.n,
      reason: 'invalid-host'
    };
  }
  
  // Find or create guest record
  const guestRecord = await prisma.guest.upsert({
    where: { email: guest.e },
    update: {
      name: guest.n,
    },
    create: {
      email: guest.e,
      name: guest.n,
      country: 'US', // Default for guest batch QRs
    },
  });

  // Check for blacklist
  if (guestRecord.blacklistedAt) {
    return {
      success: false,
      message: `${guest.n} isn't eligible for building access today`,
      guestEmail: guest.e,
      guestName: guest.n,
      reason: 'blacklisted'
    };
  }

  // Check for existing active visit (re-entry and cross-host detection)
  const { hasActiveVisit, activeVisit, crossHostVisit } = await checkExistingActiveVisit(hostId, guest.e);
  if (hasActiveVisit && activeVisit) {
    if (crossHostVisit) {
      return {
        success: true,
        message: `${guest.n} is already enjoying their visit with ${activeVisit.host.name}! 🎉`,
        guestEmail: guest.e,
        guestName: guest.n,
        visitId: activeVisit.id,
        checkedInAt: activeVisit.checkedInAt,
        expiresAt: activeVisit.expiresAt,
        reason: 'cross-host-active',
        currentHost: activeVisit.host.name
      };
    } else {
      return {
        success: true,
        message: `Welcome back, ${guest.n}! You're already all set ✨`,
        guestEmail: guest.e,
        guestName: guest.n,
        visitId: activeVisit.id,
        checkedInAt: activeVisit.checkedInAt,
        expiresAt: activeVisit.expiresAt,
        reason: 're-entry'
      };
    }
  }

  // Use enhanced validation for returning guests with automatic acceptance renewal
  const validation = await processReturningGuestCheckIn(hostId, guestRecord.id, guest.e, null, locationId);
  if (!validation.isValid) {
    return {
      success: false,
      message: validation.error || `Can't check in ${guest.n} right now - we're at our limits!`,
      guestEmail: guest.e,
      guestName: guest.n,
      reason: 'policy-violation',
      details: validation.error
    };
  }

  // Override is already validated and user ID provided if valid

  // Create visit record and update invitation status atomically
  const expiresAt = calculateVisitExpiration(now);
  
  // Use transaction to ensure visit creation, acceptance, and invitation update are atomic
  const { visit, acceptanceCreated } = await prisma.$transaction(async (tx) => {
    // Create the visit
    const visit = await tx.visit.create({
      data: {
        guestId: guestRecord.id,
        hostId,
        locationId,
        invitationId: null, // Will be updated after we find the invitation
        checkedInAt: now,
        expiresAt,
        overrideReason: override?.reason || null,
        overrideBy: overrideUserId || null,
      },
    });

    // Find the best matching invitation to update
    const searchDateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const searchDateEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // First try: exact host match
    let invitation = await tx.invitation.findFirst({
      where: {
        hostId,
        guestId: guestRecord.id,
        inviteDate: {
          // Search ±1 day to handle timezone edge cases
          gte: searchDateStart,
          lte: searchDateEnd,
        },
        status: {
          in: ['PENDING', 'ACTIVATED'],
        },
      },
      orderBy: [
        { status: 'desc' }, // ACTIVATED before PENDING 
        { createdAt: 'desc' }, // Most recent first
      ],
    });

    // If no exact host match, try any host for this guest (cross-host scenario)
    if (!invitation) {
      invitation = await tx.invitation.findFirst({
        where: {
          guestId: guestRecord.id,
          inviteDate: {
            gte: searchDateStart,
            lte: searchDateEnd,
          },
          status: {
            in: ['PENDING', 'ACTIVATED'],
          },
        },
        orderBy: [
          { status: 'desc' }, // ACTIVATED before PENDING 
          { createdAt: 'desc' }, // Most recent first
        ],
      });
      
      if (invitation) {
        console.log(`🔗 Cross-host check-in: invitation ${invitation.id} (host: ${invitation.hostId}) processed by host: ${hostId}`);
      }
    }

    let updatedInvitation = null;
    if (invitation) {
      // Update the invitation status and link it to the visit
      updatedInvitation = await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'CHECKED_IN' },
      });

      // Update the visit to reference the invitation
      await tx.visit.update({
        where: { id: visit.id },
        data: { invitationId: invitation.id },
      });

      console.log(`✅ Updated invitation ${invitation.id} to CHECKED_IN for guest ${guest.e}`);
    } else {
      console.log(`⚠️  No matching invitation found for guest ${guest.e} - treating as walk-in`);
    }

    // Create visit-scoped acceptance (auto-renew for returning guests)
    let acceptanceCreated = false;
    try {
      // Check if we need to create a visit-scoped acceptance
      const hasValidAcceptance = await tx.acceptance.findFirst({
        where: {
          guestId: guestRecord.id,
          OR: [
            { visitId: visit.id }, // Already linked to this visit
            { 
              invitationId: invitation?.id || undefined,
              expiresAt: { gt: now }
            }, // Valid invitation-linked acceptance
            {
              visitId: null,
              invitationId: null,
              acceptedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // Recent general acceptance
            }
          ]
        }
      });

      if (!hasValidAcceptance) {
        // Create new visit-scoped acceptance
        await tx.acceptance.create({
          data: {
            guestId: guestRecord.id,
            visitId: visit.id,
            invitationId: invitation?.id || undefined,
            expiresAt, // Same expiration as visit
            termsVersion: "1.0",
            visitorAgreementVersion: "1.0"
          }
        });
        acceptanceCreated = true;
        console.log(`✅ Created visit-scoped acceptance for guest ${guest.e}, expires at ${expiresAt}`);
      }
    } catch (acceptanceError) {
      console.error('Error creating visit-scoped acceptance:', acceptanceError);
      // Don't fail the check-in if acceptance creation fails
    }

    return { visit, updatedInvitation, acceptanceCreated };
  });

  // Check for discount eligibility
  const shouldSendDiscount = await shouldTriggerDiscount(guestRecord.id);
  if (shouldSendDiscount) {
    try {
      await sendDiscountEmail(guest.e, guest.n);
    } catch (emailError) {
      console.error('Discount email failed:', emailError);
      // Don't fail check-in for email issues
    }
  }

  // Include acceptance renewal information in response
  let message = `Welcome to Frontier Tower, ${guest.n}! 🏢✨`;
  if (validation.acceptanceRenewed) {
    message = `Welcome back, ${guest.n}! We've updated your visitor terms 📝✨`;
  }

  return {
    success: true,
    message,
    guestEmail: guest.e,
    guestName: guest.n,
    visitId: visit.id,
    checkedInAt: visit.checkedInAt,
    expiresAt: visit.expiresAt,
    discountSent: shouldSendDiscount,
    acceptanceRenewed: validation.acceptanceRenewed || false
  };
}