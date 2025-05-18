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
  const [historyInitialTab, setHistoryInitialTab] = useState('unexported');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [todayInvoices, setTodayInvoices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);

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

    const fetchRecentActivities = async () => {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setRecentActivities(data);
      } catch (error) {
        console.error('Error fetching recent activities:', error);
      }
    };

    fetchTodayInvoices();
    fetchRecentActivities();
  }, []);

  const formatDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const formatActivityDate = (dateString) => {
    const date = new Date(dateString);
    // Manitoba is UTC-5 during DST and UTC-6 during standard time
    const isDST = (date) => {
      const jan = new Date(date.getFullYear(), 0, 1);
      const jul = new Date(date.getFullYear(), 6, 1);
      return Math.min(jan.getTimezoneOffset(), jul.getTimezoneOffset()) === date.getTimezoneOffset();
    };
    
    const offset = isDST(date) ? -5 : -6;
    const manitobaTime = new Date(date.getTime() + (offset * 60 * 60 * 1000));
    
    const options = { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    };
    
    return manitobaTime.toLocaleString('en-US', options);
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
              <h2 className="text-2xl font-semibold text-gray-900">Welcome, Robert I.</h2>
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

            {/* Recent Activity List */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (activity.status === 'reviewed' || activity.status === 'verified') {
                          setActiveTab('archives');
                          setHistoryInitialTab(activity.sync_status === 'synced' ? 'exported' : 'unexported');
                          setSelectedInvoiceId(activity.id);
                        } else {
                          setActiveTab('processing');
                          setSelectedInvoiceId(activity.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                              <span className="text-lg text-blue-600">📄</span>
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Invoice {activity.invoice_number || activity.id}
                            </p>
                            <p className="text-sm text-gray-500">
                              {activity.vendor_name || 'Unknown Vendor'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <p className="text-sm text-gray-500">
                            {formatActivityDate(activity.created_at)}
                          </p>
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            activity.status === 'reviewed' 
                              ? 'bg-green-100 text-green-800'
                              : activity.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {activity.status || 'New'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'upload':
        return <BatchUpload />;
      case 'processing':
        return <Review selectedInvoiceId={selectedInvoiceId} />;
      case 'archives':
        return <History initialTab={historyInitialTab} selectedInvoiceId={selectedInvoiceId} />;
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