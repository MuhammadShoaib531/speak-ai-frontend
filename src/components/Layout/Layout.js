import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import Logo from '../Logo/Logo';
import {
  HomeIcon,
  CogIcon,
  UserIcon,
  PhoneIcon,
  ChartBarIcon,
  AcademicCapIcon,
  CreditCardIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const location = useLocation();

  const normalizedRole = user?.role?.toLowerCase().replace(/\s/g, '');

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Agents', href: '/agents', icon: UserIcon },
    ...(normalizedRole === 'superadmin' ? [{ name: 'Users', href: '/user', icon: UserIcon }] : []),
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Training', href: '/training', icon: AcademicCapIcon },
    { name: 'Batch Calling', href: '/batchcallinglist', icon: Bars3Icon },
    { name: 'Call Logs', href: '/call-logs', icon: PhoneIcon },
    { name: 'Billing', href: '/billing', icon: CreditCardIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  const isCurrentPage = (href) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const getPageTitle = () => {
    if (location.pathname.includes('/batchcalling')) return 'Batch Calling';
    if (location.pathname.includes('/agents')) return 'Agents';
    if (location.pathname.includes('/user')) return 'Users';
    if (location.pathname.includes('/analytics')) return 'Analytics';
    if (location.pathname.includes('/training')) return 'Training';
    if (location.pathname.includes('/call-logs')) return 'Call Logs';
    if (location.pathname.includes('/billing')) return 'Billing';
    if (location.pathname.includes('/settings')) return 'Settings';
    return navigation.find((item) => isCurrentPage(item.href))?.name || 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-[#fdfcff]">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 flex flex-col`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Logo />
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 mt-5 px-2 space-y-1 overflow-y-auto pb-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`${
                isCurrentPage(item.href)
                  ? 'sidebar-item sidebar-item-active'
                  : 'sidebar-item sidebar-item-inactive'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="flex-shrink-0 w-full p-4 border-t border-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              title="Logout"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                type="button"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Bars3Icon className="h-6 w-6 text-gray-400" />
              </button>
              <h1 className="ml-3 text-lg font-semibold text-gray-900 lg:ml-0">
                {getPageTitle()}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                to="/notifications"
                className="relative p-2 text-gray-400 hover:text-gray-600"
                title="Notifications"
              >
                <BellIcon className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </Link>

              <Link
                to="/profile"
                className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center mr-2">
                  <span className="text-white text-sm font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span>{user?.name}</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
