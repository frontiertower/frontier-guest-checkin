import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-0 to-background relative overflow-hidden">
      {/* Subtle animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-48 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse delay-300" />
        <div className="absolute -bottom-48 right-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      
      <div className="container mx-auto px-4 py-16 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Logo and Header */}
          <div className="mb-12">
            <div className="mx-auto mb-8 flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-primary/15 to-transparent rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                <Logo size="xl" priority className="relative shadow-xl rounded-2xl transform transition-transform duration-300 hover:scale-105" />
              </div>
            </div>
            <h1 className="text-6xl font-bold text-foreground mb-4">
              Frontier Tower
            </h1>
            <p className="text-2xl text-muted-foreground mb-8 font-light">
              Advanced Visitor Management System
            </p>
            <div className="relative max-w-2xl mx-auto">
              <div className="bg-surface-1/50 border border-border/30 rounded-xl p-6 shadow-sm backdrop-blur-sm">
                <p className="text-lg text-muted-foreground flex items-center justify-center gap-3">
                  <span className="text-xl opacity-70">🛡️</span>
                  Secure, streamlined guest check-in with QR codes, capacity management, and comprehensive audit trails
                </p>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="group">
              <div className="bg-card border border-border/30 rounded-xl shadow-sm p-8 hover:shadow-lg hover:border-border/50 transition-all duration-300 hover:scale-[1.01]">
                <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/15 transition-colors">
                  <span className="text-xl">📱</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  QR Code Check-in
                </h3>
                <p className="text-muted-foreground text-sm">
                  Multi-camera scanning optimized for iPad Safari with support for multi-guest QR codes.
                </p>
              </div>
            </div>

            <div className="group">
              <div className="bg-card border border-border/30 rounded-xl shadow-sm p-8 hover:shadow-lg hover:border-border/50 transition-all duration-300 hover:scale-[1.01]">
                <div className="w-14 h-14 bg-success/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-success/15 transition-colors">
                  <span className="text-xl">🛡️</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Security Override
                </h3>
                <p className="text-muted-foreground text-sm">
                  Password-protected capacity limit bypasses with complete audit trail for security staff.
                </p>
              </div>
            </div>

            <div className="group">
              <div className="bg-card border border-border/30 rounded-xl shadow-sm p-8 hover:shadow-lg hover:border-border/50 transition-all duration-300 hover:scale-[1.01]">
                <div className="w-14 h-14 bg-info/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-info/15 transition-colors">
                  <span className="text-xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Business Rules
                </h3>
                <p className="text-muted-foreground text-sm">
                  Rolling visit limits, blacklist enforcement, and automated discount tracking.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link 
              href="/checkin"
              className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-xl font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
            >
              <span className="text-lg opacity-90">🔍</span>
              <span>Guest Check-in Scanner</span>
            </Link>
            <Link 
              href="/login"
              className="bg-card hover:bg-surface-1 border border-border/50 hover:border-primary/30 text-foreground px-8 py-4 rounded-xl font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
            >
              <span className="text-lg opacity-90">👥</span>
              <span>Host Dashboard</span>
            </Link>
          </div>

          {/* Status Info */}
          <div className="bg-card border border-border/30 rounded-xl shadow-sm p-6">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-primary mb-2">
                  12 Hour
                </div>
                <div className="text-muted-foreground text-sm flex items-center justify-center gap-1">
                  <span className="opacity-70">⏱️</span>
                  Visit Expiry
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success mb-2">
                  3 per Month
                </div>
                <div className="text-muted-foreground text-sm flex items-center justify-center gap-1">
                  <span className="opacity-70">📅</span>
                  Guest Limit
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-info mb-2">
                  Real-time
                </div>
                <div className="text-muted-foreground text-sm flex items-center justify-center gap-1">
                  <span className="opacity-70">📧</span>
                  Email Notifications
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}