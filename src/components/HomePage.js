import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Analytics from './Analytics';
import BatchUpload from './BatchUpload';
import Review from './Review';
import History from './History';
import { supabase } from '../lib/supabase';

const HomePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [todayInvoices, setTodayInvoices] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayInvoices = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data, error } = await supabase
          .from('invoices')
          .select('id')
          .gte('created_at', today.toISOString());

        if (error) throw error;
        setTodayInvoices(data.length);
      } catch (error) {
        console.error('Error fetching today\'s invoices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayInvoices();
  }, []);

  const formatDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'processing', label: 'Processing', icon: '⚙️' },
    { id: 'archives', label: 'Archives', icon: '📚' },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Welcome</h2>
              <div className="mt-2 flex items-center space-x-4">
                <p className="text-gray-600">{formatDate()}</p>
                <span className="text-gray-300">|</span>
                <p className="text-gray-600">
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span className="font-medium text-blue-600">{todayInvoices}</span>
                  )}{' '}
                  new invoices today
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Upload</h3>
                <p className="text-blue-700 mb-4">Upload new documents for processing</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Start Upload
                </button>
              </div>
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Review Documents</h3>
                <p className="text-green-700 mb-4">Check and verify processed documents</p>
                <button
                  onClick={() => setActiveTab('processing')}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                >
                  Start Review
                </button>
              </div>
              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">View Analytics</h3>
                <p className="text-purple-700 mb-4">Explore insights and trends</p>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
                >
                  View Analytics
                </button>
              </div>
            </div>
          </div>
        );
      case 'upload':
        return <BatchUpload />;
      case 'processing':
        return <Review />;
      case 'archives':
        return <History />;
      case 'analytics':
        return <Analytics />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  );
};

export default HomePage; 