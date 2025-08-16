import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/authStore';
import { EyeIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const OTP_TTL_SEC = 600; 

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const emailQS = searchParams.get('email') || '';
  const navigate = useNavigate();
  const { resetPassword, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: emailQS,
      new_password: '',
      confirm_new_password: '',
    },
  });

  const newPwd = watch('new_password');
  const email = useMemo(() => emailQS, [emailQS]);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputsRef = useRef([]);

  const focusIndex = (idx) => {
    const el = inputsRef.current[idx];
    if (el) el.focus();
  };

  const handleOtpChange = (idx, value) => {
    const v = value.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < 5) focusIndex(idx + 1);
  };

  const handleOtpKeyDown = (idx, e) => {
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

  const handleOtpPaste = (e) => {
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setDigits(next);
    const last = Math.min(pasted.length, 6) - 1;
    focusIndex(last >= 0 ? last : 0);
  };

  const otp_code = digits.join('');
  const otpValid = otp_code.length === 6;

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [timeLeft, setTimeLeft] = useState(OTP_TTL_SEC);
  const expired = timeLeft <= 0;

  useEffect(() => {
    if (expired) return;
    const t = setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [expired]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  const onSubmit = async (data) => {
    if (expired) {
      toast.error('OTP has expired. Please request a new password reset.');
      return;
    }
    if (!otpValid) {
      toast.error('Please enter the 6-digit OTP code.');
      return;
    }

    const res = await resetPassword({
      email: data.email,
      otp_code,
      new_password: data.new_password,
      confirm_new_password: data.confirm_new_password,
    });

    if (res.success) {
      toast.success('Password reset successful. Please sign in.');
      navigate('/login');
    } else {
      toast.error(res.error || 'Password reset failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-t-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-6 shadow-sm">
          <h1 className="text-xl font-semibold text-white text-center">Reset your password</h1>
          <p className="mt-1 text-center text-white/90 text-sm">
            Enter the OTP sent to your email and your new password.
          </p>
        </div>

        <div className="bg-white rounded-b-2xl shadow-md px-6 py-6 border border-gray-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                className={`input mt-1 ${errors.email ? 'border-red-500' : ''}`}
                placeholder="user@example.com"
                {...register('email', { required: 'Email is required' })}
                readOnly={!!email}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
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
              <div
                className="mt-2 flex items-center justify-between gap-2"
                onPaste={expired ? undefined : handleOtpPaste}
              >
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputsRef.current[i] = el)}
                    value={d}
                    disabled={expired}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(e) => !expired && handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => !expired && handleOtpKeyDown(i, e)}
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
              {!otpValid && !expired && (
                <p className="mt-1 text-sm text-red-600">Enter all 6 digits.</p>
              )}
              {expired && (
                <p className="mt-1 text-sm text-red-600">
                  OTP has expired. Please go back and request a new code.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="new_password"
                  type={showNew ? 'text' : 'password'}
                  disabled={expired}
                  className={`input pl-10 pr-10 ${
                    errors.new_password ? 'border-red-500' : ''
                  } ${expired ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Create a new password"
                  autoComplete="new-password"
                  {...register('new_password', {
                    required: 'New password is required',
                    minLength: { value: 8, message: 'At least 8 characters' },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Include upper, lower, and a number',
                    },
                  })}
                />
                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <button
                  type="button"
                  disabled={expired}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    expired ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  onClick={() => setShowNew((s) => !s)}
                >
                  {showNew ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {errors.new_password && (
                <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm_new_password" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirm_new_password"
                  type={showConfirm ? 'text' : 'password'}
                  disabled={expired}
                  className={`input pl-10 pr-10 ${
                    errors.confirm_new_password ? 'border-red-500' : ''
                  } ${expired ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  {...register('confirm_new_password', {
                    required: 'Please confirm your password',
                    validate: (v) => v === newPwd || 'Passwords do not match',
                  })}
                />
                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <button
                  type="button"
                  disabled={expired}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    expired ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  onClick={() => setShowConfirm((s) => !s)}
                >
                  {showConfirm ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirm_new_password && (
                <p className="mt-1 text-sm text-red-600">{errors.confirm_new_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!otpValid || isLoading || expired}
              className={` w-full text-white font-semibold py-3 rounded-xl shadow-lg
              transition-transform disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
              bg-primary-700
              focus:outline-none focus:ring-4 focus:ring-primary-200 ${
                !otpValid || expired ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <div className="spinner absolute left-4" />
                  <span className="ml-8">Resetting...</span>
                </>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700">
              Back to login
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          Didn't get the OTP? Go back and request a new code.
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
