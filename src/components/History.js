import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Header from './Header';

const History = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());
  const [activeTab, setActiveTab] = useState('unexported');

  const fetchVerifiedInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'verified')
        .order('processed_at', { ascending: false });

      if (error) throw error;
      setInvoices(data);
    } catch (err) {
      console.error('Error fetching verified invoices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedInvoices(new Set(filteredInvoices.map(invoice => invoice.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleSelectInvoice = (invoiceId) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const handleExport = async () => {
    if (selectedInvoices.size === 0) return;

    // Get selected invoice data
    const selectedInvoiceData = invoices.filter(invoice => selectedInvoices.has(invoice.id));

    // Fetch line items for selected invoices
    try {
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('line_items')
        .select('*')
        .in('invoice_id', Array.from(selectedInvoices));

      if (lineItemsError) throw lineItemsError;

      // Create CSV content for invoices
      const invoiceHeaders = [
        'Invoice #',
        'Supplier Name',
        'Supplier Address',
        'Invoice Date',
        'Due Date',
        'Processed Date',
        'Total Amount'
      ];

      // Function to escape CSV values
      const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // If the value contains commas, quotes, or newlines, wrap it in quotes and escape existing quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      const invoiceRows = selectedInvoiceData.map(invoice => [
        escapeCsvValue(invoice.invoice_number),
        escapeCsvValue(invoice.supplier_name),
        escapeCsvValue(invoice.supplier_address),
        escapeCsvValue(formatDate(invoice.invoice_date)),
        escapeCsvValue(formatDate(invoice.due_date)),
        escapeCsvValue(formatDate(invoice.processed_at)),
        escapeCsvValue(formatCurrency(invoice.total_amount))
      ]);

      // Create CSV content for line items
      const lineItemHeaders = [
        'Invoice #',
        'Line Item #',
        'Description',
        'Quantity',
        'Unit Price',
        'Amount'
      ];

      const lineItemRows = lineItems.map(item => {
        const invoice = selectedInvoiceData.find(inv => inv.id === item.invoice_id);
        return [
          escapeCsvValue(invoice?.invoice_number || ''),
          escapeCsvValue(item.line_number),
          escapeCsvValue(item.description),
          escapeCsvValue(item.quantity),
          escapeCsvValue(formatCurrency(item.unit_price)),
          escapeCsvValue(formatCurrency(item.amount))
        ];
      });

      // Combine both sheets with a separator
      const csvContent = [
        'Invoices',
        invoiceHeaders.map(escapeCsvValue).join(','),
        ...invoiceRows.map(row => row.join(',')),
        '\nLine Items',
        lineItemHeaders.map(escapeCsvValue).join(','),
        ...lineItemRows.map(row => row.join(','))
      ].join('\r\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `verified_invoices_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update the sync_status in the database
      const { error } = await supabase
        .from('invoices')
        .update({ sync_status: 'synced' })
        .in('id', Array.from(selectedInvoices));

      if (error) throw error;
      
      // Refresh the invoices list
      fetchVerifiedInvoices();
    } catch (err) {
      console.error('Error during export:', err);
      setError('Failed to export invoices. Please try again.');
    }
  };

  useEffect(() => {
    fetchVerifiedInvoices();
  }, []);

  // Filter invoices based on active tab
  const filteredInvoices = invoices.filter(invoice => 
    activeTab === 'unexported' ? invoice.sync_status !== 'synced' : invoice.sync_status === 'synced'
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Verified Invoices
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({filteredInvoices.length} total)
                  </span>
                </h2>
                <button
                  onClick={handleExport}
                  disabled={selectedInvoices.size === 0 || activeTab === 'exported'}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    selectedInvoices.size === 0 || activeTab === 'exported'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Export Selected ({selectedInvoices.size})
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('unexported')}
                    className={`${
                      activeTab === 'unexported'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Unexported
                  </button>
                  <button
                    onClick={() => setActiveTab('exported')}
                    className={`${
                      activeTab === 'exported'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Exported
                  </button>
                </nav>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600">Loading invoices...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600">{error}</p>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-600">No {activeTab} invoices found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={selectedInvoices.size === filteredInvoices.length}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processed Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredInvoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedInvoices.has(invoice.id)}
                                onChange={() => handleSelectInvoice(invoice.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                disabled={activeTab === 'exported'}
                              />
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                              {invoice.invoice_number}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                              {invoice.supplier_name}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                              {formatDate(invoice.invoice_date)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                              {formatDate(invoice.processed_at)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                              {formatCurrency(invoice.total_amount)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                invoice.confidence_score >= 0.8 ? 'bg-green-100 text-green-800' :
                                invoice.confidence_score >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {(invoice.confidence_score * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default History; 