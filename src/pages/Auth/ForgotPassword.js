import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import useAuthStore from '../../store/authStore';

const ForgotPassword = () => {
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const { forgotPassword, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async ({ email }) => {
    setSubmittedEmail(email || '');
    const res = await forgotPassword({ email });

    if (res.success) {
      setEmailSent(true);
      toast.success('If an account exists and is verified, we sent an OTP to your email.');
    } else {
      toast.error(res.error || 'Failed to send reset email.');
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircleIcon className="h-8 w-8 text-success-600" />
          </div>
          <h2 className="text-2xl font-extrabold uppercase tracking-wide bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            If an account exists and is verified, we've sent a one-time code (OTP) to{' '}
            <span className="font-medium">{submittedEmail || 'your email'}</span>. Use it to reset your password.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Didn&apos;t receive the email?
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Check your spam/junk folder</li>
            <li>• Confirm the email address is correct</li>
            <li>• Wait a minute or two and try again</li>
          </ul>
        </div>

        <div className="flex flex-col space-y-3">
          <Link
            to={`/reset-password${submittedEmail ? `?email=${encodeURIComponent(submittedEmail)}` : ''}`}
            className="btn btn-primary text-center px-2 py-4 rounded-xl"
          >
            Enter OTP &amp; reset password
          </Link>

          <button
            onClick={() => {
              setEmailSent(false);
             
            }}
            className="btn btn-secondary px-2 py-4 rounded-xl"
          >
            Try another email
          </button>

          <Link
            to="/login"
            className="btn btn-ghost text-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2 inline-block" />
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
       <h2 className="text-2xl font-extrabold uppercase tracking-wide bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
          Forgot Password?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email and we'll send you a one-time code (OTP) to reset your password.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <div className="mt-1 relative">
            <input
              id="email"
              type="email"
              className={`input pl-10 ${errors.email ? 'border-red-500' : ''}`}
              placeholder="Enter your email address"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: 'Please enter a valid email address',
                },
              })}
            />
            <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="
              w-full text-white font-semibold py-3 rounded-xl shadow-lg
              transition-transform disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
              bg-primary-700
              focus:outline-none focus:ring-4 focus:ring-primary-200
            "
        >
          {isLoading ? (
            <>
              <div className="spinner absolute left-4" />
              <span className="ml-8">Sending OTP...</span>
            </>
          ) : (
            'Send OTP'
          )}
        </button>
      </form>

      <div className="text-center">
        <Link
          to="/login"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
