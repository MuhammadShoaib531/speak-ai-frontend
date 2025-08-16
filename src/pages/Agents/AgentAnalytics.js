import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const AgentAnalytics = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link to="/agents" className="mr-4 text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">
            View detailed performance metrics
          </p>
        </div>
      </div>
      
      <div className="card">
        <p className="text-gray-600">Agent analytics dashboard will be implemented here...</p>
      </div>
    </div>
  );
};

export default AgentAnalytics; 