import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserIcon,
  CreditCardIcon,
  CogIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, ListSkeleton } from '../../lib/commonUtils';

const Settings = () => {
  const settingsSections = [
    {
      id: 'account',
      title: 'Account Settings',
      icon: UserIcon,
      description: 'Manage your profile and account preferences',
      items: [
        { label: 'Profile Information', action: 'Go to Profile', link: '/profile' },
        { label: 'Password & Security', action: 'Manage', link: '/profile?tab=security' },
      ],
    },
    {
      id: 'billing',
      title: 'Billing & Subscription',
      icon: CreditCardIcon,
      description: 'Manage your subscription and billing',
      items: [
        { label: 'Current Plan', action: 'View Details', link: '/billing?tab=current' },
        { label: 'Billing History', action: 'View', link: '/billing?tab=history' },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      icon: CogIcon,
      description: 'Advanced settings and configurations',
    },
  ];

  const AdvancedSection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>

      <div className="space-y-3">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Data Export</h4>
          <p className="text-sm text-gray-600 mb-3">
            Export all your data including agents, call logs, and analytics.
          </p>
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200">
            Request Export
          </button>
        </div>

        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
          <div className="flex items-center mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
            <h4 className="font-medium text-yellow-800">Danger Zone</h4>
          </div>
          <p className="text-sm text-yellow-700 mb-3">
            Permanently delete your account and all associated data.
          </p>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure your account settings" />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : !activeSection ? (
        <div className="grid gap-4">
          {settingsSections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-[#EDE9FE] rounded-lg flex items-center justify-center mr-3">
                  <section.icon className="h-5 w-5 text-[#6D28D9]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
                {section.id === 'advanced' && (
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ChevronRightIcon className="h-5 w-5 text-[#6D28D9] hover:text-[#8753ff]" />
                  </button>
                )}
              </div>

              {section.items && (
                <div className="space-y-2">
                  {section.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      {item.link ? (
                        <Link
                          to={item.link}
                          className="text-sm font-medium text-[#6D28D9] hover:text-[#8753ff]"
                        >
                          {item.action}
                        </Link>
                      ) : (
                        <button className="text-sm font-medium text-[#6D28D9] hover:text-[#8753ff]">
                          {item.action}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <button
              onClick={() => setActiveSection(null)}
              className="text-gray-400 hover:text-gray-600 mr-3"
            >
              ←
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {settingsSections.find((s) => s.id === activeSection)?.title}
            </h2>
          </div>

          {activeSection === 'advanced' && <AdvancedSection />}
        </div>
      )}
    </div>
  );
};

export default Settings;
