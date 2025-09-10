/**
 * Critical Component Tests
 * Snapshot and behavior tests for key React components
 */

/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { OverrideDialog } from '@/components/OverrideDialog';
import { GuestJourneyModal } from '@/components/admin/GuestJourneyModal';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { CreateInvitationForm } from '@/components/invites/CreateInvitationForm';
import { QRCode } from '@/components/ui/qrcode';
import { SignaturePad } from '@/components/ui/signature-pad';

// Mock hooks and dependencies
jest.mock('@/hooks/use-admin-data', () => ({
  useAdminStats: () => ({
    stats: { totalVisits: 100, activeGuests: 10 },
    isLoading: false,
    loadStats: jest.fn(),
  }),
  useAdminPolicies: () => ({
    policies: { guestMonthlyLimit: 3, hostConcurrentLimit: 3 },
    isLoading: false,
    loadPolicies: jest.fn(),
    updatePolicies: jest.fn(),
  }),
  useAdminActivities: () => ({
    activities: [],
    isLoading: false,
    loadActivities: jest.fn(),
  }),
  useGuestJourney: () => ({
    selectedGuest: null,
    isLoading: false,
    loadGuestJourney: jest.fn(),
    clearSelectedGuest: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', role: 'admin' },
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

describe('Critical Components', () => {
  describe('OverrideDialog', () => {
    const defaultProps = {
      isOpen: true,
      onClose: jest.fn(),
      onConfirm: jest.fn(),
      title: 'Override Capacity',
      description: 'Host has reached capacity limit',
      requiresPassword: true,
      requiresReason: true,
    };

    it('should render override dialog with all fields', () => {
      render(<OverrideDialog {...defaultProps} />);

      expect(screen.getByText('Override Capacity')).toBeInTheDocument();
      expect(screen.getByText('Host has reached capacity limit')).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    });

    it('should validate required fields before confirming', async () => {
      const onConfirm = jest.fn();
      render(<OverrideDialog {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      // Should not call onConfirm without required fields
      expect(onConfirm).not.toHaveBeenCalled();

      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'override123' },
      });
      fireEvent.change(screen.getByLabelText(/reason/i), {
        target: { value: 'VIP guest' },
      });

      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          password: 'override123',
          reason: 'VIP guest',
        });
      });
    });

    it('should handle cancel action', () => {
      const onClose = jest.fn();
      render(<OverrideDialog {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should not show password field when not required', () => {
      render(<OverrideDialog {...defaultProps} requiresPassword={false} />);

      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    });
  });

  describe('GuestJourneyModal', () => {
    const mockGuest = {
      id: 'guest-1',
      name: 'John Doe',
      email: 'john@example.com',
      visits: [
        {
          id: 'visit-1',
          checkedInAt: new Date('2025-01-01T10:00:00'),
          hostName: 'Jane Smith',
          locationName: 'Frontier Tower',
        },
        {
          id: 'visit-2',
          checkedInAt: new Date('2025-01-05T14:00:00'),
          hostName: 'Bob Johnson',
          locationName: 'Frontier Tower',
        },
      ],
    };

    it('should render guest journey details', () => {
      render(
        <GuestJourneyModal
          isOpen={true}
          onClose={jest.fn()}
          guest={mockGuest}
        />
      );

      expect(screen.getByText('Guest Journey')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should display visit count', () => {
      render(
        <GuestJourneyModal
          isOpen={true}
          onClose={jest.fn()}
          guest={mockGuest}
        />
      );

      expect(screen.getByText(/2 visits/i)).toBeInTheDocument();
    });

    it('should handle close action', () => {
      const onClose = jest.fn();
      render(
        <GuestJourneyModal
          isOpen={true}
          onClose={onClose}
          guest={mockGuest}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should show loading state', () => {
      render(
        <GuestJourneyModal
          isOpen={true}
          onClose={jest.fn()}
          guest={null}
          isLoading={true}
        />
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('CreateInvitationForm', () => {
    const defaultProps = {
      hostId: 'host-1',
      locationId: 'location-1',
      onSuccess: jest.fn(),
      onCancel: jest.fn(),
    };

    it('should render invitation form fields', () => {
      render(<CreateInvitationForm {...defaultProps} />);

      expect(screen.getByLabelText(/guest name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/guest email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/visit date/i)).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      render(<CreateInvitationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/guest email/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      // Invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });

      // Valid email
      fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
      expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
    });

    it('should handle successful submission', async () => {
      const onSuccess = jest.fn();
      render(<CreateInvitationForm {...defaultProps} onSuccess={onSuccess} />);

      fireEvent.change(screen.getByLabelText(/guest name/i), {
        target: { value: 'Test Guest' },
      });
      fireEvent.change(screen.getByLabelText(/guest email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/visit date/i), {
        target: { value: '2025-02-01' },
      });

      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
          guestName: 'Test Guest',
          guestEmail: 'test@example.com',
          visitDate: '2025-02-01',
        }));
      });
    });

    it('should handle cancel action', () => {
      const onCancel = jest.fn();
      render(<CreateInvitationForm {...defaultProps} onCancel={onCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('QRCode Component', () => {
    it('should render QR code with value', () => {
      const { container } = render(<QRCode value="test-qr-value" size={200} />);

      const qrCanvas = container.querySelector('canvas');
      expect(qrCanvas).toBeInTheDocument();
      expect(qrCanvas).toHaveAttribute('width', '200');
      expect(qrCanvas).toHaveAttribute('height', '200');
    });

    it('should handle empty value gracefully', () => {
      const { container } = render(<QRCode value="" size={200} />);

      const qrCanvas = container.querySelector('canvas');
      expect(qrCanvas).toBeInTheDocument();
    });

    it('should support custom className', () => {
      const { container } = render(
        <QRCode value="test" size={200} className="custom-qr" />
      );

      expect(container.firstChild).toHaveClass('custom-qr');
    });

    it('should update when value changes', () => {
      const { rerender } = render(<QRCode value="initial" size={200} />);

      rerender(<QRCode value="updated" size={200} />);

      // QR code should re-render with new value
      // Canvas will be updated internally
    });
  });

  describe('SignaturePad Component', () => {
    it('should render signature canvas', () => {
      const onChange = jest.fn();
      const { container } = render(
        <SignaturePad onChange={onChange} width={400} height={200} />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width', '400');
      expect(canvas).toHaveAttribute('height', '200');
    });

    it('should call onChange when signature is drawn', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <SignaturePad onChange={onChange} width={400} height={200} />
      );

      const canvas = container.querySelector('canvas')!;

      // Simulate drawing
      fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(canvas);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('data:image'));
      });
    });

    it('should clear signature', () => {
      const onChange = jest.fn();
      const { container } = render(
        <SignaturePad 
          onChange={onChange} 
          width={400} 
          height={200}
          showClearButton={true}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should handle touch events for mobile', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <SignaturePad onChange={onChange} width={400} height={200} />
      );

      const canvas = container.querySelector('canvas')!;

      // Simulate touch drawing
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 50, clientY: 50 }],
      });
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(canvas);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });
  });

  describe('AdminDashboard Component', () => {
    it('should render dashboard tabs', () => {
      render(<AdminDashboard />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Guests')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Policies')).toBeInTheDocument();
    });

    it('should display stats in overview tab', () => {
      render(<AdminDashboard />);

      expect(screen.getByText('100')).toBeInTheDocument(); // Total visits
      expect(screen.getByText('10')).toBeInTheDocument(); // Active guests
    });

    it('should switch between tabs', () => {
      render(<AdminDashboard />);

      const guestsTab = screen.getByRole('tab', { name: /guests/i });
      fireEvent.click(guestsTab);

      // Guest tab content should be visible
      expect(screen.getByText(/guest management/i)).toBeInTheDocument();
    });

    it('should handle loading state', () => {
      jest.mocked(require('@/hooks/use-admin-data').useAdminStats).mockReturnValue({
        stats: null,
        isLoading: true,
        loadStats: jest.fn(),
      });

      render(<AdminDashboard />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });
});