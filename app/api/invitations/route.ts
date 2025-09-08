import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { validateCreateInvitation } from '@/lib/validations';
import { todayInLA } from '@/lib/timezone';
import { sendInvitationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Check authentication and get location
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // If no location from host, use default location
    if (!locationId) {
      const defaultLocation = await prisma.location.findFirst({
        select: { id: true }
      });
      if (!defaultLocation) {
        return NextResponse.json(
          { error: 'No location found. Please contact support.' },
          { status: 500 }
        );
      }
      locationId = defaultLocation.id;
    }

    const body = await request.json();
    
    const { 
      email, 
      inviteDate
    } = body;

    // Validate required fields - now only email is required
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate business rules
    const validation = await validateCreateInvitation(hostId, email);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const inviteDateParsed = new Date(inviteDate || todayInLA());

    // Create or update guest with minimal information
    // Guest will complete their profile via the email link
    const guest = await prisma.guest.upsert({
      where: { email },
      update: {
        // Don't update anything if guest already exists
        // They will update their own profile via the link
      },
      create: {
        email,
        name: '', // Empty string as placeholder - guest fills this later
        // Other nullable fields omitted - guest fills these later via profile completion
        profileCompleted: false,
      },
    });

    // Verify hostId exists before creating invitation to prevent foreign key constraint violations
    const hostExists = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true }
    });
    
    if (!hostExists) {
      console.error(`ERROR: Host with ID ${hostId} not found in database`);
      return NextResponse.json(
        { error: 'Invalid host - user not found in database' },
        { status: 400 }
      );
    }

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        guestId: guest.id,
        hostId,
        locationId,
        inviteDate: inviteDateParsed,
      },
      include: {
        guest: true,
      },
    });

    // Get host name for the email
    const hostUser = await prisma.user.findUnique({
      where: { id: hostId },
      select: { name: true }
    });
    const hostName = hostUser?.name || 'Your Host';
    
    // Send invitation email (non-blocking - don't fail creation if email fails)
    try {
      const emailResult = await sendInvitationEmail(
        guest.email,
        guest.name || 'Guest', // Use 'Guest' if name not yet provided
        hostName,
        invitation.id,
        hostId
      );
      
      if (!emailResult.success) {
        console.error('Failed to send invitation email:', emailResult.error);
        // TODO: Queue for retry in background job system
      } else {
        console.log(`Invitation email sent successfully: ${emailResult.messageId}`);
      }
    } catch {
      console.error('Email service error during invitation creation:');
      // TODO: Queue for retry in background job system
    }

    return NextResponse.json({
      invitation,
      message: 'Invitation created successfully',
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    let hostId: string;
    try {
      hostId = await getCurrentUserId(request);
    } catch {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || todayInLA();

    const invitations = await prisma.invitation.findMany({
      where: {
        hostId,
        inviteDate: new Date(date),
      },
      include: {
        guest: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}