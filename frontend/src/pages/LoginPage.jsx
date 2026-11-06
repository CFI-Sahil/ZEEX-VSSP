import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

// Import the two logos provided by the user
import logoTransparent from '../assets/logo-transparent.png';
import logoWithBg from '../assets/logo-with-bg.jpg';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // If already authenticated, redirect immediately
  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/';
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both email and password');
      return;
    }

    try {
      setIsLoading(true);
      await login(email.trim(), password);
      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header with Transparent Logo */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#10243D] p-2 flex items-center justify-center shadow-md border border-slate-800">
            <img
              src={logoTransparent}
              alt="VSSP Logo"
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#111827]">
            Visual Safety Surveillance
          </h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Sign in to access industrial safety monitoring & alert consoles
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-6 bg-white py-8 px-4 shadow-sm border border-[#E2E8F0] rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Error Message Box */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#111827]">
                Email Address
              </label>
              <div className="mt-1 relative rounded-md shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@vssp.local"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-50/50 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#111827] placeholder-slate-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#111827]">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-10 py-2 text-sm bg-slate-50/50 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#111827] placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center text-sm py-2.5 font-semibold"
                isLoading={isLoading}
              >
                Sign In to Console
              </Button>
            </div>
          </form>

          {/* Quick Demo Credentials Preset Bar */}
          <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-medium text-[#64748B] text-center mb-2.5 uppercase tracking-wider">
              Authorized Demo Credentials
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('admin@vssp.local', 'AdminSecurePass@2026!')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-center transition-colors cursor-pointer"
              >
                <span className="block font-semibold text-blue-700">Admin Account</span>
                <span className="block text-[10px] text-slate-500">Full System Control</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo('operator@vssp.local', 'OperatorSecurePass@2026!')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-center transition-colors cursor-pointer"
              >
                <span className="block font-semibold text-emerald-700">Safety Operator</span>
                <span className="block text-[10px] text-slate-500">Alerts & Inspection</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security & Scope Footer Banner featuring dark bg logo */}
        <div className="mt-6 flex items-center justify-center gap-3 text-center">
          <img
            src={logoWithBg}
            alt="VSSP Insignia"
            className="w-5 h-5 rounded-md object-cover shadow-2xs"
          />
          <p className="text-[11px] text-[#64748B]">
            Protected by HttpOnly JWT sessions & cryptographically signed CSRF validation
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

