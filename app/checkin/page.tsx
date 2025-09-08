'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { parseQRData, GuestData, type ParsedQRData } from '@/lib/qr-token';
import { GuestSelection } from '@/components/GuestSelection';
import { OverrideDialog } from '@/components/OverrideDialog';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/ui/logo';
import { QrCode, ArrowLeft } from 'lucide-react';

interface CameraDevice {
  deviceId: string;
  label: string;
}

// Detect iOS Safari for camera handling
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  return iOS && safari;
}

// Detect iPad specifically (handles iPadOS 13+ desktop mode)
function isIPad(): boolean {
  const ua = navigator.userAgent;
  
  // Traditional iPad detection
  if (/iPad/.test(ua) && !(window as any).MSStream) {
    return true;
  }
  
  // iPadOS 13+ desktop mode detection
  // iPadOS reports as "MacIntel" when in desktop mode but has touch support
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0) {
    return true;
  }
  
  // Additional fallback: check for navigator.standalone (iOS Safari only)
  if (navigator.platform === 'MacIntel' && typeof (navigator as any).standalone !== 'undefined') {
    return true;
  }
  
  // Final fallback: Macintosh user agent with touch events
  if (/Macintosh/.test(ua) && 'ontouchend' in document) {
    return true;
  }
  
  return false;
}

// Get facing mode from camera label
function getFacingMode(label: string): 'user' | 'environment' | undefined {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('front') || lowerLabel.includes('user')) {
    return 'user';
  }
  if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
    return 'environment';
  }
  return undefined;
}

// Get appropriate error icon based on the error type
function getErrorIcon(errorMessage: string | null): string {
  if (!errorMessage) return '❌';
  
  if (errorMessage.includes('capacity') || errorMessage.includes('full')) return '👥';
  if (errorMessage.includes('monthly') || errorMessage.includes('limit')) return '📅'; 
  if (errorMessage.includes('Building hours') || errorMessage.includes('closed')) return '🌙';
  if (errorMessage.includes('expired') || errorMessage.includes('QR code')) return '🎫';
  if (errorMessage.includes('terms') || errorMessage.includes('email')) return '✉️';
  if (errorMessage.includes('security') || errorMessage.includes("can't access")) return '🔐';
  if (errorMessage.includes('technical') || errorMessage.includes('Connection')) return '🔧';
  if (errorMessage.includes('find') || errorMessage.includes('system')) return '🔍';
  
  return '❌';
}

// Get appropriate error title based on the error type
function getErrorTitle(errorMessage: string | null): string {
  if (!errorMessage) return 'Check-In Issue';
  
  if (errorMessage.includes('capacity') || errorMessage.includes('full')) return 'At Capacity';
  if (errorMessage.includes('monthly') || errorMessage.includes('limit')) return 'Visit Limit Reached'; 
  if (errorMessage.includes('Building hours') || errorMessage.includes('closed')) return 'Building Closed';
  if (errorMessage.includes('expired') || errorMessage.includes('QR code')) return 'QR Code Expired';
  if (errorMessage.includes('terms') || errorMessage.includes('email')) return 'Terms Needed';
  if (errorMessage.includes('security') || errorMessage.includes("can't access")) return 'Access Restricted';
  if (errorMessage.includes('technical') || errorMessage.includes('Connection')) return 'Technical Issue';
  if (errorMessage.includes('find') || errorMessage.includes('system')) return 'Guest Not Found';
  
  return 'Check-In Issue';
}

// Get contextual error messages based on the specific failure reason
function getContextualErrorMessage(result: { message?: string; error?: string }): string {
  // Check for specific error patterns in the message or result
  const message = result.message || result.error || '';
  
  // Blacklisted guest
  if (message.includes("not authorized") || message.includes("blacklist")) {
    return "Guest is not authorized for building access. Contact security for assistance.";
  }
  
  // Capacity limits
  if (message.includes("capacity") || message.includes("concurrent limit")) {
    return "Host is at capacity. Security can override if space is available.";
  }
  
  // Visit limits (monthly)
  if (message.includes("visits this month") || message.includes("30 days")) {
    return "Guest has reached monthly visit limit. Next visit available next month.";
  }
  
  // Time cutoff
  if (message.includes("closed for the night") || message.includes("11:59 PM")) {
    return "Building is closed for the night. Check-ins resume tomorrow morning.";
  }
  
  // QR code issues  
  if (message.includes("expired") || message.includes("QR code")) {
    return "QR code has expired. Please generate a new invitation.";
  }
  
  // Terms acceptance
  if (message.includes("visitor terms") || message.includes("acceptance")) {
    return "Guest needs to accept visitor terms before check-in. Email will be sent.";
  }
  
  // Guest not found
  if (message.includes("not found")) {
    return "Guest not found in system. Please verify QR code and try again.";
  }
  
  // Network/system errors
  if (message.includes("technical") || message.includes("unavailable") || message.includes("network")) {
    return "Service temporarily unavailable. Please try again.";
  }
  
  // Already checked in
  if (message.includes("already")) {
    return message; // These are already friendly from the API
  }
  
  // Default fallback with the original message
  return message || "Check-in failed. Please try again or contact support.";
}

export default function CheckInPage() {
  useAuth();
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [parsedQRData, setParsedQRData] = useState<ParsedQRData | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<GuestData | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkInState, setCheckInState] = useState<'idle' | 'scanning' | 'guest-selection' | 'processing' | 'success' | 'error' | 'override-required'>('idle');
  const [overrideData, setOverrideData] = useState<{
    guestData?: GuestData | string;
    currentCount: number;
    maxCount: number;
    errorMessage: string;
  } | null>(null);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    guest?: { name: string; email: string };
    message?: string;
    reEntry?: boolean;
    visit?: Record<string, unknown>;
    host?: Record<string, unknown>;
    discountTriggered?: boolean;
    discountEmailSent?: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [isIpadDevice, setIsIpadDevice] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check and request camera permissions
  const checkCameraPermissions = useCallback(async () => {
    try {
      // First check if we can enumerate devices (indicates permission)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      if (videoDevices.length > 0 && videoDevices[0].label !== '') {
        // We have permission (labels are available)
        return true;
      }
      
      // Try to request permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    const initializeScanner = async () => {
      try {
        // Detect iPad after mount when navigator is available
        const isIpad = isIPad();
        setIsIpadDevice(isIpad);
        
        // Check if QR scanner is supported
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        // Check/request permissions
        const hasPermission = await checkCameraPermissions();
        if (!hasPermission) {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        setHasPermission(true);
        
        // For iPad, skip camera enumeration and use facingMode directly
        if (isIpad) {
          // iPad: Use front camera with facingMode, no enumeration needed
          setSelectedCamera('user'); // Use 'user' as a special marker for front camera
          setCameras([]); // No camera list needed for iPad
        } else {
          // Other devices: enumerate cameras normally
          // Get available cameras with retry for iOS
          let availableCameras = await QrScanner.listCameras(true);
          
          // On iOS, sometimes we need to retry after permission grant
          if (isIOSSafari() && availableCameras.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
            availableCameras = await QrScanner.listCameras(true);
          }
          
          const cameraDevices = availableCameras.map(camera => ({
            deviceId: camera.id,
            label: camera.label
          }));
          
          setCameras(cameraDevices);
          
          // Prefer back camera for non-iPad devices
          const backCamera = availableCameras.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear') ||
            camera.label.toLowerCase().includes('environment')
          );
          const preferredCamera = backCamera || availableCameras[0];
          
          setSelectedCamera(preferredCamera?.id || null);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Scanner initialization error:', error);
        setHasPermission(false);
        setIsLoading(false);
      }
    };

    initializeScanner();
  }, [checkCameraPermissions]);


  const handleScanSuccess = useCallback((result: QrScanner.ScanResult) => {
    try {
      const parsed = parseQRData(result.data);
      setScannedData(result.data);
      setParsedQRData(parsed);
      setIsScanning(false);
      qrScannerRef.current?.stop();
      
      if (parsed.type === 'batch') {
        setCheckInState('guest-selection');
      } else {
        setCheckInState('processing');
        processCheckIn(result.data);
      }
    } catch (error) {
      console.error('Failed to parse QR data:', error);
      // Instead of showing an error, try to process it as a raw token
      // This handles legacy formats or formats we don't recognize in frontend
      console.log('Attempting to process as raw token...');
      setScannedData(result.data);
      setParsedQRData(null);
      setIsScanning(false);
      qrScannerRef.current?.stop();
      setCheckInState('processing');
      processCheckIn(result.data);
    }
  }, []);

  const handleScanError = (error: string | Error) => {
    // Only log actual errors, not "No QR code found" messages
    const errorMessage = error.toString();
    if (!errorMessage.includes('No QR code found')) {
      console.error('QR Scanner Error:', error);
    }
  };

  const resetScanner = () => {
    setScannedData(null);
    setParsedQRData(null);
    setSelectedGuest(null);
    setCheckInResult(null);
    setErrorMessage(null);
    setOverrideData(null);
    setCheckInState('idle');
    setIsScanning(false);
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
    }
  };

  const startCheckIn = () => {
    setCheckInState('scanning');
    setIsScanning(true);
    startScanner();
  };

  const handleOverrideConfirm = (reason: string, password: string) => {
    if (overrideData?.guestData) {
      if (typeof overrideData.guestData === 'string') {
        // Regular QR token
        processCheckIn(overrideData.guestData, reason, password);
      } else {
        // Guest data
        processGuestCheckIn(overrideData.guestData, reason, password);
      }
    }
  };

  const handleOverrideCancel = () => {
    setOverrideData(null);
    resetScanner();
  };

  const handleGuestSelection = (guest: GuestData) => {
    setSelectedGuest(guest);
    setCheckInState('processing');
    // TODO: Process check-in for selected guest
    processGuestCheckIn(guest);
  };

  const processCheckIn = async (qrData: string, overrideReason?: string, overridePassword?: string) => {
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: qrData,
          overrideReason,
          overridePassword 
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Convert unified API response to expected format
        const guestResult = result.results?.[0];
        if (guestResult) {
          setCheckInResult({
            success: true,
            guest: {
              name: guestResult.guestName,
              email: guestResult.guestEmail
            },
            message: guestResult.message,
            reEntry: guestResult.reason === 're-entry',
            discountTriggered: guestResult.discountSent || false
          });
        } else {
          setCheckInResult({
            success: true,
            message: result.message
          });
        }
        setCheckInState('success');
        setOverrideData(null);
      } else if (response.status === 401 && result.passwordError) {
        // Wrong password - keep dialog open with error
        setOverrideData(prev => prev ? {...prev, errorMessage: 'Incorrect password. Please try again.'} : null);
      } else if (response.status === 409 && result.requiresOverride) {
        // Capacity exceeded - always show override option
        setOverrideData({
          guestData: qrData,
          currentCount: result.currentCount || 3,
          maxCount: result.maxCount || 3,
          errorMessage: result.message || result.error
        });
        setCheckInState('override-required');
      } else {
        // Handle specific error cases with contextual messages
        const errorMsg = getContextualErrorMessage(result);
        setErrorMessage(errorMsg);
        setCheckInState('error');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      setErrorMessage('Connection issue. Please try again.');
      setCheckInState('error');
    }
  };

  const processGuestCheckIn = async (guest: GuestData, overrideReason?: string, overridePassword?: string) => {
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guest,
          overrideReason,
          overridePassword 
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Convert unified API response to expected format
        const guestResult = result.results?.[0];
        if (guestResult) {
          setCheckInResult({
            success: true,
            guest: {
              name: guestResult.guestName,
              email: guestResult.guestEmail
            },
            message: guestResult.message,
            reEntry: guestResult.reason === 're-entry',
            discountTriggered: guestResult.discountSent || false
          });
        } else {
          setCheckInResult({
            success: true,
            message: result.message
          });
        }
        setCheckInState('success');
        setOverrideData(null);
      } else if (response.status === 401 && result.passwordError) {
        // Wrong password - keep dialog open with error
        setOverrideData(prev => prev ? {...prev, errorMessage: 'Incorrect password. Please try again.'} : null);
      } else if (response.status === 409 && result.requiresOverride) {
        // Capacity exceeded - always show override option
        setOverrideData({
          guestData: guest,
          currentCount: result.currentCount || 3,
          maxCount: result.maxCount || 3,
          errorMessage: result.message || result.error
        });
        setCheckInState('override-required');
      } else {
        // Handle specific error cases with contextual messages
        const errorMsg = getContextualErrorMessage(result);
        setErrorMessage(errorMsg);
        setCheckInState('error');
      }
    } catch (error) {
      console.error('Guest check-in error:', error);
      setErrorMessage('Connection issue. Please try again.');
      setCheckInState('error');
    }
  };

  const cleanupVideoStream = useCallback(() => {
    // Stop and cleanup any existing video streams
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!videoRef.current || !selectedCamera) return;

    try {
      setIsSwitchingCamera(true);
      
      // Clean up existing scanner and streams
      if (qrScannerRef.current) {
        await qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      
      cleanupVideoStream();
      
      // Small delay for iOS to release camera resources
      if (isIOSSafari()) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Determine camera configuration based on platform
      let cameraConfig: any = {
        onDecodeError: handleScanError,
        highlightScanRegion: true,
        highlightCodeOutline: true,
      };
      
      // Special handling for iPad - use facingMode directly
      if (isIpadDevice && selectedCamera === 'user') {
        // iPad: Use front camera with facingMode
        cameraConfig.preferredCamera = 'user';
        cameraConfig.maxScansPerSecond = 5; // Reduce scan frequency for stability
      } else if (isIOSSafari()) {
        // Other iOS devices: try to use facingMode if possible
        const camera = cameras.find(c => c.deviceId === selectedCamera);
        const facingMode = camera ? getFacingMode(camera.label) : undefined;
        
        if (facingMode) {
          cameraConfig.preferredCamera = facingMode;
        } else {
          cameraConfig.preferredCamera = selectedCamera;
          cameraConfig.maxScansPerSecond = 5;
        }
      } else {
        // Other browsers: use deviceId directly
        cameraConfig.preferredCamera = selectedCamera;
      }

      // Create new scanner
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        handleScanSuccess,
        cameraConfig
      );

      await qrScannerRef.current.start();
      setIsSwitchingCamera(false);
    } catch (error) {
      console.error('Failed to start scanner:', error);
      setIsSwitchingCamera(false);
      
      // Check if we still have camera permissions
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(d => d.kind === 'videoinput');
        if (!hasVideoInput) {
          setHasPermission(false);
        }
      } catch (e) {
        setHasPermission(false);
      }
    }
  }, [selectedCamera, handleScanSuccess, cameras, cleanupVideoStream]);

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
    }
  };

  // Start scanner when camera is selected and scanning is enabled
  useEffect(() => {
    if (isScanning && selectedCamera && hasPermission && checkInState === 'scanning') {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isScanning, selectedCamera, hasPermission, checkInState, startScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
      }
      cleanupVideoStream();
    };
  }, [cleanupVideoStream]);

  // Handle camera switching
  const handleCameraChange = async (cameraId: string) => {
    if (cameraId === selectedCamera || isSwitchingCamera || isIpadDevice) return;
    
    try {
      setIsSwitchingCamera(true);
      
      // For iOS Safari, we need to fully recreate the scanner
      if (isIOSSafari()) {
        // Stop current scanner with proper cleanup
        if (qrScannerRef.current) {
          await qrScannerRef.current.stop();
          qrScannerRef.current.destroy();
          qrScannerRef.current = null;
        }
        
        // Comprehensive stream cleanup for iOS
        cleanupVideoStream();
        
        // Force garbage collection delay for iOS Safari
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update selected camera and let useEffect restart scanner
        setSelectedCamera(cameraId);
        
        // Additional delay for iOS camera resource management
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        // For other browsers, try the normal setCamera method
        setSelectedCamera(cameraId);
        if (qrScannerRef.current) {
          try {
            await qrScannerRef.current.setCamera(cameraId);
          } catch (error) {
            console.error('Failed to switch camera, recreating scanner:', error);
            // If setCamera fails, recreate scanner
            await startScanner();
          }
        }
      }
    } catch (error) {
      console.error('Camera switch error:', error);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  if (hasPermission === null || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Checking camera permissions...</p>
        </div>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-center p-8 bg-card rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">📷</div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Camera Access Required</h1>
          <p className="text-muted-foreground mb-6">
            Please allow camera access to scan QR codes for guest check-in.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium"
          >
            Retry Camera Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted relative">
      {checkInState === 'idle' ? (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4" style={{ marginTop: '-80px' }}>
          {/* Header positioned above the button */}
          <div className="text-center mb-12">
            <div className="mb-4 flex justify-center">
              <Logo size="lg" priority className="h-12 sm:h-16 md:h-20 lg:h-24" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Guest Check-In Station</h1>
          </div>
          
          {/* Button - this is what's actually centered in viewport */}
          <div className="bg-card border border-border rounded-lg shadow-lg p-4 sm:p-6">
            <div className="text-center space-y-6">
              <div className="space-y-3">
                <button
                  onClick={startCheckIn}
                  className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-6 px-8 rounded-xl shadow-lg hover:shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                  <div className="flex items-center justify-center gap-3">
                    <QrCode className="h-6 w-6" />
                    <div className="text-center">
                      <div className="text-lg font-bold">Check In Guests</div>
                      <div className="text-sm opacity-90">Scan the QR code from your Invites page</div>
                    </div>
                  </div>
                </button>
                <p className="text-xs text-center text-muted-foreground">
                  For hosts only • Not for guest use
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
          <div className="text-center mb-8">
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <Logo size="lg" priority className="h-12 sm:h-16 md:h-20 lg:h-24" />
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Guest Check-In Station</h1>
          </div>

          <div className="w-full max-w-lg mx-auto">
            {checkInState === 'scanning' ? (
              <div className="bg-card border border-border rounded-lg shadow-lg p-4 sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Scan Your QR Code</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Position your check-in QR code in view
                </p>
                
                {cameras.length > 1 && !isIpadDevice && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Camera:
                    </label>
                    <select 
                      value={selectedCamera || ''}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      className="w-full p-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      disabled={isSwitchingCamera}
                    >
                      {cameras.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden mb-4 max-w-sm mx-auto">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                
                {(!selectedCamera || isSwitchingCamera) && (
                  <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p>Preparing camera...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </div>
          ) : checkInState === 'guest-selection' && parsedQRData?.guestBatch ? (
            <GuestSelection
              guests={parsedQRData.guestBatch.guests}
              onSelectGuest={handleGuestSelection}
              onCancel={resetScanner}
            />
          ) : checkInState === 'processing' ? (
            <div className="bg-card border border-border rounded-lg shadow-lg p-4 sm:p-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Processing Check-In</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedGuest ? `Checking in ${selectedGuest.n}...` : 'Processing your check-in...'}
                </p>
              </div>
            </div>
          ) : checkInState === 'success' ? (
            <div className="bg-card border border-border rounded-lg shadow-lg p-4 sm:p-6">
              <div className="text-center mb-6">
                <div className="text-green-500 text-6xl mb-4">
                  ✨
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                  {checkInResult?.reEntry ? "Welcome Back!" : "You're All Set!"}
                </h2>
                {checkInResult?.guest && (
                  <p className="text-sm text-muted-foreground">
                    {checkInResult.reEntry ? `Good to see you again, ${checkInResult.guest.name}!` : `Enjoy your visit, ${checkInResult.guest.name}!`}
                  </p>
                )}
                {checkInResult?.discountTriggered && (
                  <p className="text-sm text-purple-600 font-medium mt-2">
                    Special surprise coming to your email!
                  </p>
                )}
              </div>

              {checkInResult?.message && (
                <div className="mb-6">
                  <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 p-4 rounded-lg text-center">
                    <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">{checkInResult.message}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
                >
                  Check In Another Guest
                </button>
              </div>
            </div>
          ) : checkInState === 'error' ? (
            <div className="bg-card border border-border rounded-lg shadow-lg p-4 sm:p-6">
              <div className="text-center mb-6">
                <div className="text-red-500 text-6xl mb-4">{getErrorIcon(errorMessage)}</div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">{getErrorTitle(errorMessage)}</h2>
              </div>

              {errorMessage && (
                <div className="mb-6">
                  <div className="bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 dark:border-red-500/30 p-4 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg shadow-lg p-4 sm:p-6">
              <div className="text-center mb-6">
                <div className="text-green-500 text-6xl mb-4">✅</div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">QR Code Scanned!</h2>
              </div>

              {scannedData && (
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">Scanned Data:</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <code className="text-sm text-muted-foreground break-all">
                      {scannedData}
                    </code>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
                >
                  Scan Another
                </button>
              </div>
            </div>
          )}
          </div>

          <div className="text-center mt-6 sm:mt-8">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
              Compatible with QR codes, barcodes, and all major code formats
            </p>
            <p className="text-xs text-muted-foreground">
              Optimized for iPad Safari compatibility
            </p>
          </div>
        </div>
      )}

      {checkInState === 'override-required' && overrideData && (
        <OverrideDialog
          open={true}
          onConfirm={handleOverrideConfirm}
          onCancel={handleOverrideCancel}
          currentCount={overrideData.currentCount}
          maxCount={overrideData.maxCount}
          guestName={typeof overrideData.guestData === 'object' ? overrideData.guestData.n : undefined}
          errorMessage={overrideData.errorMessage}
        />
      )}
    </div>
  );
}