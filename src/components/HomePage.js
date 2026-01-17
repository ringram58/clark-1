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
  const [uploadView, setUploadView] = useState('manual');
  const [todayInvoices, setTodayInvoices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExportConfig, setShowExportConfig] = useState(false);

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
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'system-controls', label: 'System Controls', icon: '🔧' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Welcome, Robert</h2>
              <div className="mt-2 flex items-center space-x-4">
                <p className="text-gray-600">{formatDate()}</p>
                <span className="text-gray-300">|</span>
                <p className="text-gray-600">
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span className="font-medium text-blue-600">{todayInvoices}</span>
                  )}{' '}
                  Invoices uploaded today
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

            {/* Recent Activity Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
                  <p className="text-sm text-gray-500 mt-1">Track all system activities and user actions</p>
                </div>
                <button
                  onClick={() => setActiveTab('archives')}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus:underline transition-colors"
                >
                  View all activities
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto bg-gray-50/50">
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Alfred S.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Upload</span>
                      </div>
                      <p className="text-sm text-gray-600">Uploaded 4 new invoices</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      2 minutes ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Katie C.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">Verify</span>
                      </div>
                      <p className="text-sm text-gray-600">Verified 19 invoices</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      15 minutes ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Michael J.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">Export</span>
                      </div>
                      <p className="text-sm text-gray-600">Exported 12 invoices to QuickBooks</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      1 hour ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Sarah L.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Settings</span>
                      </div>
                      <p className="text-sm text-gray-600">Added 3 new priority vendors</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      2 hours ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Robert J.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">Review</span>
                      </div>
                      <p className="text-sm text-gray-600">Reviewed 8 high-priority invoices</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      3 hours ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Tina L.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">Export</span>
                      </div>
                      <p className="text-sm text-gray-600">Generated monthly report for Q1</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      4 hours ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">David M.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-pink-100 text-pink-800 rounded-full">Upload</span>
                      </div>
                      <p className="text-sm text-gray-600">Uploaded 15 vendor invoices</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      5 hours ago
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center space-x-3 hover:bg-white transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="text-sm font-semibold text-gray-900">Emma P.</p>
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-800 rounded-full">Settings</span>
                      </div>
                      <p className="text-sm text-gray-600">Updated export templates</p>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                      6 hours ago
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'upload':
        return (
          <div className="space-y-6">
            {/* Upload Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setUploadView('manual')}
                  className={`${
                    uploadView === 'manual'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Manual Upload
                </button>
                <button
                  onClick={() => setUploadView('config')}
                  className={`${
                    uploadView === 'config'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Configuration
                </button>
              </nav>
            </div>

            {/* Content based on selected tab */}
            {uploadView === 'manual' ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <BatchUpload />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Automated File Processing</h3>
                    <p className="mt-1 text-sm text-gray-500">Configure automatic processing from various sources</p>
                  </div>

                  {/* Email Inbox Configuration */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-medium text-gray-900">Email Inbox</h4>
                        <p className="mt-1 text-sm text-gray-500">Process invoices from a dedicated email inbox</p>
                      </div>
                      <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Configure
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Process attachments automatically
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Delete processed emails
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SharePoint Configuration */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-medium text-gray-900">SharePoint</h4>
                        <p className="mt-1 text-sm text-gray-500">Monitor and process files from SharePoint folders</p>
                      </div>
                      <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Configure
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Monitor specific folders
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Move processed files to archive
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Local Folder Configuration */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-medium text-gray-900">Local Folder</h4>
                        <p className="mt-1 text-sm text-gray-500">Watch and process files from a local directory</p>
                      </div>
                      <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Configure
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Watch folder for new files
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Move processed files to subfolder
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Processing Schedule */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-base font-medium text-gray-900">Processing Schedule</h4>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Check for new files</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>Every 5 minutes</option>
                          <option>Every 15 minutes</option>
                          <option>Every 30 minutes</option>
                          <option>Every hour</option>
                          <option>Custom schedule</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Process files immediately when detected
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Save Configuration */}
                  <div className="flex justify-end space-x-3">
                    <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Reset to Defaults
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'processing':
        return <Review />;
      case 'archives':
        return (
          <div className="bg-white rounded-lg shadow-lg">
            {/* Header Section */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Archives</h2>
                  <p className="mt-1 text-sm text-gray-600">View and export processed invoices</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowExportConfig(!showExportConfig)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    {showExportConfig ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                        Hide Export Settings
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                        Configure Export Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              {showExportConfig ? (
                <div className="space-y-6">
                  {/* Export Format */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Export Format
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">File Format</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>CSV</option>
                          <option>Excel (XLSX)</option>
                          <option>PDF</option>
                          <option>JSON</option>
                          <option>XML</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>MM/DD/YYYY</option>
                          <option>DD/MM/YYYY</option>
                          <option>YYYY-MM-DD</option>
                          <option>MM-DD-YYYY</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Export Destination */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Export Destination
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="export-destination"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          defaultChecked
                        />
                        <label className="ml-3 block text-sm font-medium text-gray-900">
                          Local Export
                          <span className="text-gray-500 text-xs block mt-1">Save files to your computer</span>
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="export-destination"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <label className="ml-3 block text-sm font-medium text-gray-900">
                          QuickBooks Online
                          <span className="text-gray-500 text-xs block mt-1">Direct integration with QuickBooks Online</span>
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="export-destination"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <label className="ml-3 block text-sm font-medium text-gray-900">
                          QuickBooks Desktop
                          <span className="text-gray-500 text-xs block mt-1">Export as IIF file for QuickBooks Desktop</span>
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="export-destination"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <label className="ml-3 block text-sm font-medium text-gray-900">
                          Xero
                          <span className="text-gray-500 text-xs block mt-1">Direct integration with Xero</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Export Options
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Include invoice images</span>
                          <p className="text-xs text-gray-500 mt-1">Attach original invoice PDFs to the export</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Include line items</span>
                          <p className="text-xs text-gray-500 mt-1">Export detailed line item information</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Include vendor details</span>
                          <p className="text-xs text-gray-500 mt-1">Export additional vendor information</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Include processing metadata</span>
                          <p className="text-xs text-gray-500 mt-1">Export system processing information</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Save Configuration */}
                  <div className="flex justify-end space-x-3">
                    <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Reset to Defaults
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Save Configuration
                    </button>
                  </div>
                </div>
              ) : (
                <History />
              )}
            </div>
          </div>
        );
      case 'analytics':
        return <Analytics />;
      case 'system-controls':
        return (
          <div className="bg-white rounded-lg shadow-lg">
            {/* Header Section */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">System Controls</h2>
                  <p className="mt-1 text-sm text-gray-600">Configure system-wide settings and automation rules</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Reset to Defaults
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* System Settings */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        System Settings
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Auto-verify high confidence invoices</span>
                          <p className="text-xs text-gray-500 mt-1">Automatically verify invoices with confidence score above 90%</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Enable debug mode</span>
                          <p className="text-xs text-gray-500 mt-1">Show detailed processing information and logs</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Processing Settings */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Processing Settings
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Default Sort Order</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>Confidence (High to Low)</option>
                          <option>Confidence (Low to High)</option>
                          <option>Date (New to Old)</option>
                          <option>Date (Old to New)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Items Per Page</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>10</option>
                          <option>15</option>
                          <option>25</option>
                          <option>50</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Timed Export Settings */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Timed Export Settings
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Accounting Software</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>QuickBooks Online</option>
                          <option>QuickBooks Desktop</option>
                          <option>Sage Intacct</option>
                          <option>NetSuite</option>
                          <option>Xero</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Select your primary accounting software for exports</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Export Schedule</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>Daily at 5:00 PM</option>
                          <option>Daily at 11:00 PM</option>
                          <option>Weekly on Monday</option>
                          <option>Weekly on Friday</option>
                          <option>Custom Schedule</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Choose when to automatically export verified invoices</p>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Auto-export verified invoices</span>
                          <p className="text-xs text-gray-500 mt-1">Automatically export invoices after verification</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* High Priority Vendors */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        High Priority Vendors
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Enable priority processing</span>
                          <p className="text-xs text-gray-500 mt-1">Process invoices from priority vendors first</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Priority Vendors</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Add vendor name..."
                          />
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          >
                            Add
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm font-medium text-gray-900">HAPPIEST VALLEY FARMS</span>
                            </div>
                            <button className="text-gray-400 hover:text-red-600 transition-colors">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm font-medium text-gray-900">ACME SUPPLIERS</span>
                            </div>
                            <button className="text-gray-400 hover:text-red-600 transition-colors">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Expiry Settings */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Invoice Expiry Settings
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">Enable expiry notifications</span>
                          <p className="text-xs text-gray-500 mt-1">Get notified when invoices are approaching expiry</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Expiry Warning (days)</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="number"
                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="60"
                            defaultValue="60"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Number of days before expiry to send notifications</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Notification Method</label>
                        <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                          <option>Email Only</option>
                          <option>System Alert Only</option>
                          <option>Both Email and System Alert</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Choose how you want to receive expiry notifications</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
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