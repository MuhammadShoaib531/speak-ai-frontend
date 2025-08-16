import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/authStore';
import {
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      company_name: '',
      phone_number: '',
      password: '',
      confirm_password: '',
      terms: false,
    },
  });

  const password = watch('password');

  const onSubmit = async (data) => {
    const payload = {
      name: data.name.trim(),
      email: data.email.trim(),
      company_name: data.company_name.trim(),
      phone_number: data.phone_number ? `+${data.phone_number}`.replace(/^(\++)/, '+') : '',
      password: data.password,
      confirm_password: data.confirm_password,
    };

    const result = await registerUser(payload);

    if (result?.success) {
      if (result?.otpRequired) {
        toast.success('Signup successful! Please verify the OTP sent to your email.');
        navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
      } else {
        toast.success('Registration successful!');
        navigate('/dashboard');
      }
      return;
    }

    toast.error(result?.error || 'Registration failed');
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold uppercase tracking-wide bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
          Create Account
        </h2>
        <p className="text-gray-600">Get started with SpeakAI today</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <div className="relative">
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                ${errors.name ? 'border-error-300 ring-error-100' : 'border-primary-200 focus:border-primary-400 ring-primary-100'}`}
              {...register('name', {
                required: 'Full name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
              })}
            />
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800" />
          </div>
          {errors.name && <p className="mt-1 text-sm text-error-600">{errors.name.message}</p>}
        </div>

        <div>
          <div className="relative">
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                ${errors.email ? 'border-error-300 ring-error-100' : 'border-primary-200 focus:border-primary-400 ring-primary-100'}`}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Please enter a valid email address' },
              })}
            />
            <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800" />
          </div>
          {errors.email && <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>}
        </div>

        <div>
          <Controller
            name="phone_number"
            control={control}
            rules={{
              required: 'Phone number is required',
              minLength: { value: 5, message: 'Enter a valid phone number' },
            }}
            render={({ field: { onChange, value } }) => (
              <PhoneInput
                country="us"
                enableSearch
                value={value}
                onChange={(val) => onChange(val)}
                inputProps={{ name: 'phone_number', id: 'phone_number' }}
                containerClass="w-full"
                inputClass={`!w-full !h-12 !pl-14 !pr-4 !text-sm !bg-white !outline-none
                  !border-2 !rounded-xl
                  ${errors.phone_number ? '!border-error-300' : '!border-primary-200 focus:!border-primary-400'}
                `}
                buttonClass={`!border-2 !border-r-0 !rounded-l-xl !bg-white
                  ${errors.phone_number ? '!border-error-300' : '!border-primary-200'}
                `}
                dropdownClass="!shadow-lg"
              />
            )}
          />
          {errors.phone_number && (
            <p className="mt-1 text-sm text-error-600">{errors.phone_number.message}</p>
          )}
        </div>

        <div>
          <div className="relative">
            <input
              id="company_name"
              type="text"
              placeholder="Enter your company name"
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                ${errors.company_name ? 'border-error-300 ring-error-100' : 'border-primary-200 focus:border-primary-400 ring-primary-100'}`}
              {...register('company_name', { required: 'Company name is required' })}
            />
            <BuildingOfficeIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800" />
          </div>
          {errors.company_name && (
            <p className="mt-1 text-sm text-error-600">{errors.company_name.message}</p>
          )}
        </div>

        <div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                ${errors.password ? 'border-error-300 ring-error-100' : 'border-primary-200 focus:border-primary-400 ring-primary-100'}`}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must include upper, lower, and a number',
                },
              })}
            />
            <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800" />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-primary-50"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-primary-800" />
              ) : (
                <EyeIcon className="h-5 w-5 text-primary-800" />
              )}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>}
        </div>

        <div>
          <div className="relative">
            <input
              id="confirm_password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                ${errors.confirm_password ? 'border-error-300 ring-error-100' : 'border-primary-200 focus:border-primary-400 ring-primary-100'}`}
              {...register('confirm_password', {
                required: 'Please confirm your password',
                validate: (value) => value === password || 'Passwords do not match',
              })}
            />
            <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800" />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-primary-50"
              onClick={() => setShowConfirmPassword((s) => !s)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-primary-800" />
              ) : (
                <EyeIcon className="h-5 w-5 text-primary-800" />
              )}
            </button>
          </div>
          {errors.confirm_password && (
            <p className="mt-1 text-sm text-error-600">{errors.confirm_password.message}</p>
          )}
        </div>

        <div className="flex items-start">
          <input
            id="terms"
            type="checkbox"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-primary-300 rounded mt-1"
            {...register('terms', { required: 'You must agree to the terms and conditions' })}
          />
          <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
            I agree to the{' '}
            <Link to="/terms" className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
              Terms and Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.terms && <p className="mt-1 text-sm text-error-600">{errors.terms.message}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="
            w-full text-white font-semibold py-3 rounded-xl shadow-lg
            transition-transform disabled:opacity-60 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            bg-primary-700 hover:bg-primary-800
            focus:outline-none focus:ring-4 focus:ring-primary-200
          "
        >
          {isLoading && <div className="spinner" />}
          <span>{isLoading ? 'Signing up…' : 'Sign Up'}</span>
        </button>
      </form>

      <div className="text-center mt-8">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;