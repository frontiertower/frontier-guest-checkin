"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Logo } from "@/components/ui/logo"
import { PageCard } from "@/components/ui/page-card"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isFormValid, setIsFormValid] = useState(false)
  const { toast } = useToast()

  // Basic email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Validate form fields
  useEffect(() => {
    const emailValid = email.length > 0 && validateEmail(email)
    const passwordValid = password.length > 0

    setEmailError(email.length > 0 && !validateEmail(email) ? "Please enter a valid email address" : "")
    setPasswordError(password.length > 0 && password.length < 1 ? "Password is required" : "")

    setIsFormValid(emailValid && passwordValid)
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address")
      return
    }

    if (password.length === 0) {
      setPasswordError("Password is required")
      return
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Sign-in failed",
          description: data.error || "Please check your credentials.",
          variant: "destructive"
        });
        return;
      }

      // Clear any existing auth data and store new token
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('auth-token', data.token);
      localStorage.setItem('current-user', JSON.stringify(data.user));

      toast({
        title: "Sign-in successful",
        description: `Welcome, ${data.user.name}!`,
      });

      // Redirect to invites page
      window.location.href = '/invites';
    } catch (error) {
      console.error('Sign-in error:', error);
      toast({
        title: "Sign-in failed",
        description: "Network error. Please try again.",
        variant: "destructive"
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface-0 to-surface-1 p-4 relative overflow-hidden">
      {/* Animated gradient orbs for depth */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 space-y-4">
          <div className="mx-auto mb-4 flex justify-center">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <Logo size="md" priority className="relative rounded-xl shadow-2xl shadow-primary/20" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
            Frontier Tower
          </h1>
          <p className="text-muted-foreground text-lg">Sign in to invite guests</p>
        </div>
        
        <PageCard
          title="Sign In"
          description="Enter your credentials to access the host dashboard"
          className="w-full shadow-2xl bg-gradient-to-br from-card to-surface-1/50 border-border/50 hover:border-primary/20 backdrop-blur-sm"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-lg">✉️</span>
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="host@frontiertower.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-describedby={emailError ? "email-error" : undefined}
                className={`
                  bg-surface-0/50 border-border/50 
                  hover:bg-surface-1/50 hover:border-primary/30 
                  focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 
                  transition-all placeholder:text-muted-foreground/50
                  ${emailError ? "border-destructive/50 ring-2 ring-destructive/30 bg-destructive/5" : ""}
                `}
              />
              {emailError && (
                <div className="bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 rounded-lg p-3 shadow-sm shadow-destructive/10">
                  <p id="email-error" className="text-sm text-destructive font-medium flex items-center gap-2" aria-live="polite">
                    <span>⚠️</span>
                    {emailError}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-lg">🔐</span>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-describedby={passwordError ? "password-error" : undefined}
                className={`
                  bg-surface-0/50 border-border/50 
                  hover:bg-surface-1/50 hover:border-primary/30 
                  focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 
                  transition-all placeholder:text-muted-foreground/50
                  ${passwordError ? "border-destructive/50 ring-2 ring-destructive/30 bg-destructive/5" : ""}
                `}
              />
              {passwordError && (
                <div className="bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 rounded-lg p-3 shadow-sm shadow-destructive/10">
                  <p id="password-error" className="text-sm text-destructive font-medium flex items-center gap-2" aria-live="polite">
                    <span>⚠️</span>
                    {passwordError}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!isFormValid}
                className="w-full bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary text-primary-foreground font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-primary/30 cursor-pointer disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none group"
              >
                <div className="flex items-center justify-center gap-3">
                  <div className={`p-1.5 rounded-lg backdrop-blur-sm transition-all ${
                    isFormValid 
                      ? "bg-white/10 group-hover:bg-white/20" 
                      : "bg-black/10"
                  }`}>
                    <span className="text-lg">{isFormValid ? '🔓' : '🔒'}</span>
                  </div>
                  <span className="text-lg font-bold">
                    {isFormValid ? 'Sign In to Dashboard' : 'Enter Credentials'}
                  </span>
                </div>
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-border/30">
            <p className="text-xs text-muted-foreground text-center">
              By continuing you agree to the{" "}
              <a href="#" className="font-medium text-primary hover:text-primary-hover underline underline-offset-2 transition-colors cursor-pointer">
                Terms of Service
              </a>{" "}
              &{" "}
              <a href="#" className="font-medium text-primary hover:text-primary-hover underline underline-offset-2 transition-colors cursor-pointer">
                Privacy Policy
              </a>
            </p>
          </div>
        </PageCard>
      </div>
    </div>
  )
}