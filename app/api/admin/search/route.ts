import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all'; // all, guests, hosts, visits
    const limit = parseInt(searchParams.get('limit') || '10');
    const locationId = searchParams.get('location');

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: Array<{
      type: string;
      id: string;
      title: string;
      subtitle: string;
      description: string;
      data: unknown;
      relevanceScore: number;
    }> = [];

    // Search guests
    if (type === 'all' || type === 'guests') {
      const guestWhere: Record<string, unknown> = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { country: { contains: query, mode: 'insensitive' } },
        ],
      };
      
      // If location filter is specified, only show guests who have visited that location
      if (locationId) {
        guestWhere.visits = { some: { locationId } };
      }
      
      const guests = await prisma.guest.findMany({
        where: guestWhere,
        select: {
          id: true,
          name: true,
          email: true,
          country: true,
          blacklistedAt: true,
          createdAt: true,
          visits: {
            where: { checkedInAt: { not: null } },
            select: { 
              id: true,
              host: {
                select: { name: true, email: true }
              },
              invitation: {
                select: {
                  host: {
                    select: { name: true, email: true }
                  }
                }
              }
            }
          }
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      guests.forEach(guest => {
        // Calculate host relationship metrics
        const hostTransferCount = guest.visits.filter(visit => {
          const invitationHost = visit.invitation?.host;
          return invitationHost && invitationHost.email !== visit.host.email;
        }).length;
        
        const uniqueHosts = new Set(guest.visits.map(visit => visit.host.email)).size;
        
        let description = `${guest.visits.length} visits`;
        if (uniqueHosts > 1) {
          description += ` • ${uniqueHosts} hosts`;
        }
        if (hostTransferCount > 0) {
          description += ` • ${hostTransferCount} transfers`;
        }
        if (guest.country) {
          description += ` • ${guest.country}`;
        }
        if (guest.blacklistedAt) {
          description += ' • BLACKLISTED';
        }
        
        results.push({
          type: 'guest',
          id: guest.id,
          title: guest.name,
          subtitle: guest.email,
          description,
          data: {
            ...guest,
            hostTransferCount,
            uniqueHosts
          },
          relevanceScore: calculateRelevanceScore(query, [guest.name, guest.email, guest.country])
        });
      });
    }

    // Search hosts
    if (type === 'all' || type === 'hosts') {
      const hosts = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          hostedVisits: {
            where: { checkedInAt: { not: null } },
            select: { id: true }
          }
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      hosts.forEach(host => {
        results.push({
          type: 'host',
          id: host.id,
          title: host.name,
          subtitle: host.email,
          description: `${host.role.toUpperCase()} • ${host.hostedVisits.length} visits hosted`,
          data: host,
          relevanceScore: calculateRelevanceScore(query, [host.name, host.email])
        });
      });
    }

    // Search visits (by guest or host name/email)
    if (type === 'all' || type === 'visits') {
      const visits = await prisma.visit.findMany({
        where: {
          checkedInAt: { not: null },
          OR: [
            { guest: { name: { contains: query, mode: 'insensitive' } } },
            { guest: { email: { contains: query, mode: 'insensitive' } } },
            { host: { name: { contains: query, mode: 'insensitive' } } },
            { host: { email: { contains: query, mode: 'insensitive' } } },
            { overrideReason: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          guest: {
            select: { name: true, email: true, country: true }
          },
          host: {
            select: { name: true, email: true }
          },
          invitation: {
            select: {
              host: {
                select: { name: true, email: true }
              }
            }
          }
        },
        take: limit,
        orderBy: { checkedInAt: 'desc' }
      });

      visits.forEach(visit => {
        const visitDate = visit.checkedInAt ? new Date(visit.checkedInAt).toLocaleDateString() : 'Unknown';
        const invitationHost = visit.invitation?.host;
        const isHostTransfer = invitationHost && invitationHost.email !== visit.host.email;
        
        let subtitle = `Hosted by ${visit.host.name}`;
        let description = visitDate;
        
        if (isHostTransfer) {
          subtitle = `Hosted by ${visit.host.name} (invited by ${invitationHost.name})`;
          description += ` • Host Transfer`;
        }
        
        if (visit.overrideReason) {
          description += ` • Override: ${visit.overrideReason}`;
        }
        
        results.push({
          type: 'visit',
          id: visit.id,
          title: `Visit: ${visit.guest.name}`,
          subtitle,
          description,
          data: {
            ...visit,
            guestId: visit.guestId,
            guest: visit.guest,
            isHostTransfer,
            invitationHost
          },
          relevanceScore: calculateRelevanceScore(query, [
            visit.guest.name, 
            visit.guest.email, 
            visit.host.name, 
            visit.host.email,
            invitationHost?.name,
            invitationHost?.email,
            visit.overrideReason
          ])
        });
      });
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Group results by type for better organization
    const groupedResults = {
      guests: results.filter(r => r.type === 'guest'),
      hosts: results.filter(r => r.type === 'host'),
      visits: results.filter(r => r.type === 'visit')
    };

    return NextResponse.json({
      query,
      results: results.slice(0, limit * 3), // Return more results for global search
      grouped: groupedResults,
      totalResults: results.length
    });

  } catch (error) {
    console.error('Error performing global search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateRelevanceScore(query: string, fields: (string | null | undefined)[]): number {
  const queryLower = query.toLowerCase();
  let score = 0;

  fields.forEach(field => {
    if (!field) return;
    
    const fieldLower = field.toLowerCase();
    
    // Exact match gets highest score
    if (fieldLower === queryLower) {
      score += 100;
    }
    // Starts with query gets high score
    else if (fieldLower.startsWith(queryLower)) {
      score += 80;
    }
    // Contains query gets medium score
    else if (fieldLower.includes(queryLower)) {
      score += 50;
    }
    // Partial word matches get lower score
    else {
      const words = fieldLower.split(' ');
      words.forEach(word => {
        if (word.includes(queryLower)) {
          score += 20;
        }
      });
    }
  });

  return score;
}