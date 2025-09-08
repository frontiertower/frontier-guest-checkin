/**
 * Reusable email service using Resend API
 * Follows project patterns for error handling and logging
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder_key');

export interface EmailOptions {
  to: string;
  subject: string;
  react?: React.ReactElement;
  html?: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using Resend API
 * Non-blocking implementation with comprehensive error handling
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    if (!process.env.EMAIL_FROM) {
      console.error('EMAIL_FROM is not configured');
      return {
        success: false,
        error: 'Email sender not configured'
      };
    }

    const { to, subject, react, html, text } = options;

    let emailData;

    if (react) {
      emailData = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        react,
      };
    } else if (html) {
      emailData = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
      };
    } else if (text) {
      emailData = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
      };
    } else {
      return {
        success: false,
        error: 'No email content provided (react, html, or text)'
      };
    }

    const result = await resend.emails.send(emailData);

    if (result.error) {
      console.error('Resend API error:', result.error);
      return {
        success: false,
        error: result.error.message || 'Unknown Resend API error'
      };
    }

    console.log(`Email sent successfully: ${result.data?.id} to ${to}`);
    
    return {
      success: true,
      messageId: result.data?.id
    };

  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send invitation email to guest with acceptance link
 */
export async function sendInvitationEmail(
  guestEmail: string,
  guestName: string,
  hostName: string,
  invitationId: string,
  hostId: string
): Promise<EmailResult> {
  // Direct link to guest registration page (no token needed, just invitation ID)
  const acceptanceUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://frontiertower.com'}/guest/register/${invitationId}`;

  // Dynamically import the React Email template
  const { default: InvitationEmail } = await import('./email-templates/InvitationEmail');
  const React = await import('react');

  return sendEmail({
    to: guestEmail,
    subject: `Frontier Tower Invitation from ${hostName}`,
    react: React.createElement(InvitationEmail, {
      guestName,
      hostName,
      acceptanceUrl
    })
  });
}

/**
 * Send discount email to guest (3rd lifetime visit)
 * Idempotent - should only be sent once per guest
 */
export async function sendDiscountEmail(
  guestEmail: string,
  guestName: string
): Promise<EmailResult> {
  // Dynamically import the React Email template
  const { default: DiscountEmail } = await import('./email-templates/DiscountEmail');
  const React = await import('react');

  return sendEmail({
    to: guestEmail,
    subject: '🎉 Your 3rd Visit Reward - Exclusive Discount Inside!',
    react: React.createElement(DiscountEmail, {
      guestName
    })
  });
}