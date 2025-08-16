import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/authStore';

const RESEND_COOLDOWN_SEC = 45;
const OTP_TTL_SEC = 600;

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp, isLoading } = useAuthStore();

  const qsEmail = searchParams.get('email') || '';
  const initialEmail = useMemo(
    () => location.state?.email || sessionStorage.getItem('pendingEmail') || qsEmail,
    [location.state, qsEmail]
  );
  const [email, setEmail] = useState(initialEmail);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputsRef = useRef([]);

  const [cooldown, setCooldown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(OTP_TTL_SEC);
  const expired = timeLeft <= 0;

  const shownAutoSentRef = useRef(false);

  useEffect(() => {
    if (location.state?.autoSent && !shownAutoSentRef.current) {
      shownAutoSentRef.current = true;
      toast.info('We sent you a new OTP. Please check your email.', { toastId: 'otp-auto-sent' });
      setTimeout(() => navigate('.', { replace: true, state: {} }), 0);
    }
    const saved = location.state?.email || sessionStorage.getItem('pendingEmail') || qsEmail;
    if (saved && !email) setEmail(saved);
  }, [location.state, navigate]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (expired) return;
    const t = setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [expired]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  const focusIndex = (idx) => {
    const el = inputsRef.current[idx];
    if (el) el.focus();
  };

  const handleChange = (idx, value) => {
    const v = value.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < 5) focusIndex(idx + 1);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = '';
        setDigits(next);
      } else if (idx > 0) {
        focusIndex(idx - 1);
      }
    }
    if (e.key === 'ArrowLeft' && idx > 0) focusIndex(idx - 1);
    if (e.key === 'ArrowRight' && idx < 5) focusIndex(idx + 1);
  };

  const handlePaste = (e) => {
    if (expired) return;
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setDigits(next);
    const last = Math.min(pasted.length, 6) - 1;
    focusIndex(last >= 0 ? last : 0);
  };

  const code = digits.join('');
  const canSubmit = !!email && code.length === 6 && !isLoading && !expired;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const res = await verifyOtp({ email, otp_code: code });
    if (res.success) {
      toast.success('Your account has been verified!');
      sessionStorage.removeItem('pendingEmail');
      navigate('/dashboard');
    } else {
      toast.error(res.error || 'OTP verification failed');
    }
  };

  const onResend = async () => {
    if (!email) {
      toast.error('Missing email to resend OTP.');
      return;
    }
    const res = await resendOtp({ email });
    if (res.success) {
      toast.success('OTP resent. Please check your inbox.');
      setCooldown(RESEND_COOLDOWN_SEC);
      setTimeLeft(OTP_TTL_SEC);
      setDigits(['', '', '', '', '', '']);
      focusIndex(0);
    } else {
      toast.error(res.error || 'Failed to resend OTP');
    }
  };

  const handleGoBack = () => {
    sessionStorage.removeItem('pendingEmail');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-[88vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-t-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-6 shadow-sm">
          <h1 className="text-xl font-semibold text-white text-center">Verify your email</h1>
          <p className="mt-1 text-center text-white/90 text-sm">
            We sent a 6-digit code to <span className="font-medium">{email || 'your email'}</span>.
          </p>
        </div>

        <div className="bg-white rounded-b-2xl shadow-md px-6 py-6 border border-gray-100">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!email}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">OTP Code</label>
                <span
                  className={`text-xs ${
                    expired ? 'text-red-600' : timeLeft <= 60 ? 'text-amber-600' : 'text-gray-500'
                  }`}
                >
                  {expired ? 'Expired' : `Expires in ${mm}:${ss}`}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputsRef.current[i] = el)}
                    value={d}
                    inputMode="numeric"
                    maxLength={1}
                    disabled={expired}
                    onChange={(e) => !expired && handleChange(i, e.target.value)}
                    onKeyDown={(e) => !expired && handleKeyDown(i, e)}
                    className={`w-12 h-12 rounded-lg border border-gray-300 text-center text-lg tracking-widest focus:outline-none ${
                      expired
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                    }`}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">Tip: you can paste the whole code.</p>
              {expired && (
                <p className="mt-1 text-sm text-red-600">OTP has expired. Please resend a new code.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={` w-full text-white font-semibold py-3 rounded-xl shadow-lg
              transition-transform disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
              bg-primary-700
              focus:outline-none focus:ring-4 focus:ring-primary-200 ${!canSubmit ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="spinner absolute left-4" />
                  <span className="ml-8">Verifying...</span>
                </>
              ) : (
                'Verify'
              )}
            </button>
          </form>

          <div className="text-center mt-6 space-y-3">
            <button
              type="button"
              onClick={onResend}
              disabled={cooldown > 0}
              className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </button>
            <p className="text-sm text-gray-600">
              Wrong email?{' '}
              <button
                type="button"
                onClick={handleGoBack}
                className="text-primary-600 hover:text-primary-700 font-medium underline"
              >
                Go back
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          Didn't get the email? Check spam or use “Resend OTP”.
        </p>
      </div>
    </div>
  );
};

export default VerifyOtp;