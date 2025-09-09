# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Frontier Tower visitor management system - a production-ready Next.js application for QR code guest check-ins with comprehensive business rule validation, admin dashboard, guest registration flows, and email notifications. Optimized for iPad/kiosk deployment with multi-location support.

## Development Commands

### Core Development
```bash
npm run dev           # Start development server with Turbopack
npm run build         # Production build with Turbopack  
npm run start         # Start production server
npm run lint          # Run ESLint
```

### Database Operations (Prisma)
```bash
npm run db:generate   # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and run migrations
npm run db:reset     # Reset database and run all migrations
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Populate database with test data
```

### Testing
```bash
# Jest Testing
npm run test          # Run all tests (unit + integration + e2e)
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch    # Watch mode for tests
npm run test:quick    # Quick unit test run
npm run test:ci       # CI test suite

# Coverage
npm run test:coverage # Generate test coverage
npm run coverage:report  # Detailed coverage analysis
npm run coverage:full    # Coverage + analysis

# Playwright E2E
npm run test:e2e         # Run E2E tests
npm run test:e2e:headed  # E2E with browser UI
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:debug   # Debug mode

# Legacy test runners (custom scripts)
npm run test:legacy:multi     # Multi-guest scenarios
npm run test:legacy:scenarios # Business logic scenarios  
npm run test:legacy:generate  # Generate test data
npm run test:legacy:all       # All legacy tests
```

## Tech Stack
- **Frontend**: Next.js 15.5.2 (App Router), React 19.1.0, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components, Radix UI primitives
- **Database**: Prisma ORM with PostgreSQL
- **Email**: Resend API with React Email templates
- **QR Scanning**: qr-scanner library optimized for iPad Safari
- **Authentication**: JWT-based auth with DEMO_MODE bypass (see DEMO-MODE.md)
- **PWA**: next-pwa for Progressive Web App capabilities
- **Digital Signatures**: react-signature-canvas for guest agreements
- **Testing**: Jest (unit/integration), Playwright (E2E), @faker-js/faker

## Application Architecture

### Multi-Tenant Design
- **Locations**: Multi-location support with location-specific settings and timezone handling
- **Role-Based Access**: host/admin/security roles with different permissions
- **Location-Scoped Data**: Users, visits, and invitations are location-aware

### Database Schema (Key Models)
- **User**: Staff with roles (host/admin/security) and primary location assignment
- **Guest**: Visitors with profile completion tracking, blacklist status, and contact preferences
- **Location**: Multi-location support with timezone and settings
- **Visit**: Core check-in records with expiration, override tracking, and host relationships
- **Invitation**: QR-enabled invitations with status lifecycle (PENDING/ACTIVATED/CHECKED_IN/EXPIRED)
- **Acceptance**: Terms and visitor agreement acceptance with expiration (invitation or visit-scoped)
- **Policy**: Global business rules (guest monthly limits, host concurrent limits)
- **Discount**: Third-visit discount tracking with email confirmation

### Key Design Principles
- **UUID Primary Keys**: Database-generated UUIDs with proper indexing
- **Location-Aware Indexing**: Compound indexes for location + date lookups
- **Simple State Tracking**: Timestamps indicate state rather than complex state machines
- **Visit Expiration**: 12-hour automatic expiry without manual checkout
- **Override System**: Security staff can bypass limits with password and audit trail
- **Profile Completion Flow**: Guests complete their profiles during registration

## Application Flow & Pages

### Frontend Pages
- `/` - Landing page
- `/login` - Staff authentication with JWT
- `/admin` - **Admin Dashboard** - Analytics, guest management, policy controls, reporting
- `/checkin` - **QR Scanner Kiosk** - Multi-camera QR scanning with override capabilities
- `/invites` - **Host Dashboard** - Invitation management and guest history
- `/guest/register/[invitationId]` - Guest profile completion flow
- `/guest/accept/[invitationId]` - Terms acceptance with digital signature
- `/guest/success/[invitationId]` - Confirmation page
- `/accept/[token]` - Legacy terms acceptance via JWT token

### Core User Flows
1. **Host Creates Invitation** → Guest receives email → Profile completion → Terms acceptance → QR activation
2. **Guest Check-in** → QR scan → Business rule validation → Visit creation → Email confirmations
3. **Security Override** → Capacity limit reached → Password + reason → Override approval → Audit log
4. **Admin Management** → Analytics dashboard → Guest profiles → Policy management → Reporting

## API Architecture

### Authentication Endpoints
- `POST /api/auth/login` - JWT-based authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/me` - Current user profile

### Core Check-in Flow
- `POST /api/checkin` - **Unified check-in endpoint** (handles all QR formats, overrides, business rules)
- `POST /api/invitations` - Create guest invitations
- `POST /api/invitations/[id]/activate` - Generate QR tokens
- `POST /api/invitations/[id]/admit` - Process check-in
- `POST /api/invitations/[id]/accept` - Invitation acceptance

### Guest Registration Flow
- `GET /api/guest/invitation/[invitationId]` - Retrieve invitation details
- `POST /api/guest/complete-profile` - Guest profile completion
- `POST /api/guest/accept-terms` - Terms and signature acceptance
- `POST /api/accept` - Legacy JWT-based acceptance

### Admin Dashboard APIs
- `GET /api/admin/stats` - Dashboard analytics and metrics
- `GET /api/admin/guests` - Guest management with pagination/filtering
- `GET /api/admin/guests/[id]/journey` - Guest visit history
- `POST /api/admin/guests/[id]/blacklist` - Guest blacklist management
- `GET /api/admin/activity` - Recent activity feed
- `GET /api/admin/search` - Search functionality
- `GET /api/admin/reports` - Analytics and reporting
- `GET /api/admin/policies` - Policy configuration

### Utility Endpoints
- `GET /api/guests/history` - Guest visit history
- `GET /api/test/generate-acceptance-token` - Development token generation

## Business Rules & Validation

### Core Business Logic (src/lib/validations.ts)
- **Guest Monthly Limit**: Max 3 visits per rolling 30 days
- **Host Concurrent Limit**: Max 3 active guests per host (overrideable)
- **Terms Acceptance Required**: Before any visit creation
- **Blacklist Enforcement**: At check-in time
- **Visit Expiration**: 12 hours automatic expiry
- **Discount Trigger**: Third lifetime visit → email notification

### Override System
- **Security Role Required**: Only security/admin can override
- **Password Protection**: `OVERRIDE_PASSWORD` environment variable
- **Audit Trail**: All overrides logged with user, reason, timestamp
- **Capacity Overrides**: Host concurrent limit bypass capability

### QR Code Format Support
The `/api/checkin` endpoint handles multiple QR code formats:
1. **Raw JSON Guest Batch**: `{"guests":[{"e":"email@domain.com","n":"Name"}]}`
2. **Base64 JWT Tokens**: Legacy invitation tokens
3. **Direct Guest Objects**: Single guest data
4. **Guest Arrays**: Multiple guests in array format

## Core Libraries

### Critical Business Logic
- `src/lib/validations.ts` - **CRITICAL** - All business rule validation and policy enforcement
- `src/lib/qr-token.ts` - QR code parsing, guest data extraction, format handling
- `src/lib/auth.ts` - JWT authentication with DEMO_MODE bypass capability
- `src/lib/override.ts` - Security override validation and audit logging

### Data & Integration
- `src/lib/prisma.ts` - Database client configuration
- `src/lib/email.ts` - Resend API integration with React Email templates
- `src/lib/timezone.ts` - LA timezone utilities and visit expiration calculations
- `src/lib/acceptance-token.ts` - JWT tokens for guest acceptance links
- `src/lib/acceptance-helpers.ts` - Terms acceptance validation logic

### UI & Configuration
- `src/lib/utils.ts` - Tailwind utilities and common functions
- `src/lib/design-tokens.ts` - Design system tokens and theming
- `src/lib/demo-config.ts` - Demo mode configuration for hackathons/development

## Environment Configuration

### Required Environment Variables
```bash
DATABASE_URL=          # PostgreSQL connection string
JWT_SECRET=           # Long random string for JWT signing
NEXT_PUBLIC_APP_URL=  # Base URL for email links (e.g., http://localhost:3000)
RESEND_API_KEY=       # Resend API key for email sending
EMAIL_FROM=           # From email address for notifications
```

### Optional Environment Variables
```bash
DIRECT_URL=           # Direct database connection for migrations
TEST_DATABASE_URL=    # Separate database for tests
OVERRIDE_PASSWORD=    # Security override password for kiosk
DEMO_MODE=           # Development authentication bypass (NEVER in production)
DEBUG=               # Extra logging in development
```

### Demo Mode (Development Only)
- Set `DEMO_MODE=true` for hackathon/development bypass of authentication
- Uses real database users, not mocked data
- Production builds fail if DEMO_MODE is enabled
- See DEMO-MODE.md for detailed documentation

## Testing Architecture

### Test Structure
- `test/unit/` - Unit tests for libraries and utilities (Jest)
- `test/integration/` - API integration tests (Jest)
- `test/e2e/` - End-to-end browser tests (Playwright)
- `test/test-utils/` - Test helpers, factories, and mock builders
- `test/fixtures/` - Test data and QR code samples

### Key Test Files
- `test/unit/validations.test.ts` - Business rule testing
- `test/unit/auth.test.ts` - Authentication flow testing
- `test/integration/api-checkin.test.ts` - Check-in endpoint testing
- `test/e2e/qr-scanning.test.ts` - QR scanner E2E tests
- `test/e2e/admin-dashboard.test.ts` - Admin interface testing

### Test Data Management
- `prisma/seed.ts` - Database seeding with realistic test data
- `test/test-utils/factories.ts` - Dynamic test data generation
- Faker.js integration for realistic guest data
- Property-based testing for edge cases

## Key Implementation Details

### QR Scanner Optimization
- Optimized for iPad Safari and touch interfaces
- Multi-camera support with automatic device selection
- Handles various QR code formats with graceful fallbacks
- Real-time validation feedback

### Email System
- React Email templates in `src/lib/email-templates/`
- Invitation emails, discount notifications, confirmation emails
- Non-blocking email delivery (doesn't block check-ins)
- Resend API integration with error handling

### Multi-Location Support
- Location-specific policies and settings
- Timezone-aware visit expiration calculations
- Location-scoped user assignments and data filtering
- Future-ready for multi-tenant deployments

### Performance Optimizations
- Database indexes on frequently queried fields
- Compound indexes for location + date lookups
- Efficient visit expiration queries
- Paginated admin interfaces

## Development Guidelines

### Database Operations
- Use `npm run db:push` for schema changes (no migrations in development)
- UUID primary keys are database-generated
- Always include proper indexing for new queries
- Use transactions for multi-table operations

### Authentication Patterns
- All protected API routes use `getCurrentUserId(request)`
- JWT tokens stored in localStorage on client
- Demo mode bypasses for development/hackathon use
- Role-based access control throughout application

### Error Handling
- Business rule validation provides specific error messages
- QR parsing includes detailed fallback handling
- Email failures don't block critical operations
- Override system includes comprehensive audit logging

### Code Organization
- Business logic centralized in `src/lib/validations.ts`
- API routes follow RESTful patterns with Next.js App Router
- Components use shadcn/ui and Radix primitives
- Type safety enforced throughout with TypeScript