'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';

interface QRCodeComponentProps {
  value: string;
  size?: number;
  className?: string;
  onError?: (error: Error) => void;
}

export function QRCodeComponent({ 
  value, 
  size = 256, 
  className = '', 
  onError 
}: QRCodeComponentProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setError('No QR code value provided');
      setIsLoading(false);
      return;
    }

    const generateQR = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const dataUrl = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });

        setQrDataUrl(dataUrl);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate QR code';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setIsLoading(false);
      }
    };

    generateQR();
  }, [value, size, onError]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30 rounded-lg ${className}`}>
        <div className="text-destructive text-4xl mb-2">❌</div>
        <p className="text-sm text-destructive text-center">{error}</p>
      </div>
    );
  }

  if (!qrDataUrl) {
    return (
      <div className={`flex items-center justify-center p-4 bg-muted dark:bg-surface-2 border border-border/50 dark:border-border/30 rounded-lg ${className}`}>
        <p className="text-sm text-muted-foreground">No QR code generated</p>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Image
        src={qrDataUrl}
        alt="QR Code"
        width={size}
        height={size}
        className="max-w-full h-auto rounded-lg"
        unoptimized={true}
      />
    </div>
  );
}