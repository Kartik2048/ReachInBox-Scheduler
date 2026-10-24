import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, Zap, ShieldCheck, Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithDemo } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError('Google login failed: No credential received.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoClick = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithDemo();
    } catch (err: any) {
      setError(err.message || 'Demo authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Card */}
        <div className="bg-dark-surface/90 backdrop-blur-xl border border-dark-border rounded-2xl shadow-2xl p-8 transition-all hover:border-brand-500/30">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              ReachInbox Scheduler
            </h1>
            <p className="text-sm text-dark-muted max-w-xs">
              High-throughput distributed email engine powered by BullMQ & Redis Lua rate limiting.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Login Action */}
          <div className="space-y-4">
            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google OAuth popup closed or failed.')}
                theme="filled_black"
                shape="pill"
                size="large"
                text="signin_with"
                width="320"
              />
            </div>

            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-dark-border w-full" />
              <span className="bg-dark-surface px-3 text-xs text-dark-muted uppercase tracking-wider font-semibold">
                Evaluation Access
              </span>
              <div className="border-t border-dark-border w-full" />
            </div>

            {/* Frictionless Reviewer Demo Login */}
            <button
              onClick={handleDemoClick}
              disabled={isSubmitting}
              className="w-full group flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-dark-text bg-dark-card hover:bg-dark-card/80 border border-dark-border hover:border-brand-500/40 transition-all shadow-sm hover:shadow-glow-brand disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>{isSubmitting ? 'Authenticating...' : 'Quick Reviewer Login (Demo Account)'}</span>
              <ArrowRight className="w-4 h-4 text-dark-muted group-hover:translate-x-1 transition-transform ml-auto" />
            </button>
          </div>

          {/* Features Highlights */}
          <div className="mt-8 pt-6 border-t border-dark-border/60 grid grid-cols-2 gap-3 text-xs text-dark-muted">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>Zero-Cron Delayed Jobs</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Atomic Redis Quotas</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-dark-muted/60 mt-6">
          ReachInbox Full-Stack Assignment &bull; Built with Node, Redis, PostgreSQL & React
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
