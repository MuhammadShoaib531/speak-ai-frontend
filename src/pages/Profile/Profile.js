import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { toast } from 'react-toastify';
import {
  UserCircleIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

const MIN_PASS_LEN = 8;
const BRAND = { purple: '#6C3EF0', deep: '#5326D9' };


const Profile = () => {
  const { user, token, getProfile, updatePassword } = useAuthStore(); 
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'profile');
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone_number || user.phone || '',
        company: user.company_name || '',
      });
    }
  }, [user]);

  useEffect(() => {
    getProfile?.();
  }, [getProfile]);

  const handleChange = (field) => (e) => {
    setProfileData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handlePasswordFieldChange = (field) => (e) => {
    setPasswordData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const initials =
    (profileData.name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('') || 'U';

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const payload = {
        name: profileData.name,
        email: profileData.email,
        phone_number: profileData.phone,
        company_name: profileData.company,
      };
      await api.put('/auth/me', payload);
      await getProfile?.();
      toast.success('Profile updated');
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to update profile';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (savingPassword) return;

    const current = passwordData.currentPassword?.trim();
    const next = passwordData.newPassword?.trim();
    const confirm = passwordData.confirmPassword?.trim();

    if (!current || !next || !confirm) {
      toast.error('Please fill out all password fields');
      return;
    }
    if (next.length < MIN_PASS_LEN) {
      toast.error(`New password must be at least ${MIN_PASS_LEN} characters`);
      return;
    }
    if (next !== confirm) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (current === next) {
      toast.error('New password must be different from current password');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await updatePassword?.({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      });

      if (res?.success) {
        toast.success('Password updated successfully!');
        setShowPasswordChange(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(res?.error || 'Failed to update password');
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to update password';
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-2 text-sm text-gray-600">Manage your profile information and account settings</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserCircleIcon className="h-4 w-4 inline-block mr-2" />
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'security'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShieldCheckIcon className="h-4 w-4 inline-block mr-2" />
            Security
          </button>
        </nav>
      </div>

      <div className="card">
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">{profileData.name || 'Your name'}</h3>
                <p className="text-sm text-gray-500">{profileData.company || 'Your company name'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                  value={profileData.name}
                  onChange={handleChange('name')}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                  value={profileData.email}
                  onChange={handleChange('email')}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                  value={profileData.phone}
                  onChange={handleChange('phone')}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <input
                  type="text"
                  className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                  value={profileData.company}
                  onChange={handleChange('company')}
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Password</h3>
                  <p className="text-sm text-gray-500">Update your password to keep your account secure</p>
                </div>
                <button
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="btn btn-secondary"
                >
                  Change Password
                </button>
              </div>

              {showPasswordChange && (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                      placeholder="Current Password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordFieldChange('currentPassword')}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                      onClick={() => setShowCurrent(!showCurrent)}
                    >
                      {showCurrent ?  <EyeSlashIcon className="h-5 w-5" style={{ color: BRAND.deep }} /> : <EyeIcon className="h-5 w-5" style={{ color: BRAND.deep }} />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                      placeholder="New Password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordFieldChange('newPassword')}
                      required
                      minLength={MIN_PASS_LEN}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? <EyeSlashIcon className="h-5 w-5" style={{ color: BRAND.deep }} /> : <EyeIcon className="h-5 w-5" style={{ color: BRAND.deep }} />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                      placeholder="Confirm New Password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordFieldChange('confirmPassword')}
                      required
                      minLength={MIN_PASS_LEN}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeSlashIcon className="h-5 w-5" style={{ color: BRAND.deep }} /> : <EyeIcon className="h-5 w-5" style={{ color: BRAND.deep }} />}
                    </button>
                  </div>

                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                      {savingPassword ? 'Updating…' : 'Update Password'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowPasswordChange(false)}
                      disabled={savingPassword}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
