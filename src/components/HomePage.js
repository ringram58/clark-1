import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

const HomePage = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'Batch Upload',
      description: 'Upload and process multiple documents at once',
      icon: '📚',
      path: '/batch-upload'
    },
    {
      title: "Review Clark's Work",
      description: 'Review and verify processed documents',
      icon: '✓',
      path: '/review'
    },
    {
      title: 'Analytics',
      description: 'View insights and analytics from processed documents',
      icon: '📊',
      path: '/analytics'
    },
    {
      title: 'History',
      description: 'Access previously processed documents',
      icon: '📜',
      path: '/history'
    },
    {
      title: 'System Controls',
      description: 'Manage system settings and configurations',
      icon: '⚙️',
      path: '/settings'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-gray-900 mb-2">Welcome to Your Dashboard</h2>
            <p className="text-xl text-gray-600">What would you like to do today?</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer transform transition-transform duration-200 hover:scale-105 hover:shadow-lg"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h2>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 