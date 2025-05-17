import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import Header from './Header';

const BatchUpload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [processingStatus, setProcessingStatus] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    // Add new files to the existing list
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: true
  });

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    setProcessingStatus(prevStatus => {
      const newStatus = { ...prevStatus };
      delete newStatus[index];
      return newStatus;
    });
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setError(null);
    let hasErrors = false;

    try {
      for (let i = 0; i < files.length; i++) {
        try {
          setProcessingStatus(prev => ({
            ...prev,
            [i]: { status: 'processing', progress: 0 }
          }));

          const formData = new FormData();
          formData.append('file', files[i]);

          const response = await fetch('http://localhost:3001/api/process-invoice', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to process ${files[i].name}`);
          }

          const result = await response.json();
          console.log('Server response:', result);
          
          // Organize entities by page
          const organizedByPage = {};
          
          console.log('Organizing entities:', result.entities);
          
          result.entities.forEach(entity => {
            // Convert from zero-based Document AI page number to one-based UI page number
            const docAIPage = entity.pageAnchor?.pageRefs?.[0]?.page;
            const pageNumber = docAIPage ? parseInt(docAIPage, 10) + 1 : 1;
            
            console.log(`Processing entity: ${entity.type}, Page: ${pageNumber}`);

            if (!organizedByPage[pageNumber]) {
              organizedByPage[pageNumber] = {
                supplier: [],
                invoice: [],
                receiver: [],
                lineItems: [],
                totals: [],
                other: []
              };
            }

            const type = entity.type.toLowerCase();
            
            // Handle line items with their properties
            if (type === 'line_item') {
              // Create a grouped line item from the parent entity and its properties
              const lineItem = {
                id: entity.id,
                type: 'line_item',
                mentionText: entity.mentionText,
                confidence: entity.confidence,
                pageAnchor: entity.pageAnchor,
                properties: {}
              };

              // Add each property to the line item
              entity.properties?.forEach(prop => {
                const propType = prop.type.split('/')[1]; // Get the part after 'line_item/'
                lineItem.properties[propType] = {
                  text: prop.mentionText,
                  confidence: prop.confidence
                };
              });

              organizedByPage[pageNumber].lineItems.push(lineItem);
            } else if (type.includes('supplier')) {
              organizedByPage[pageNumber].supplier.push(entity);
            } else if (type.includes('invoice')) {
              organizedByPage[pageNumber].invoice.push(entity);
            } else if (type.includes('receiver')) {
              organizedByPage[pageNumber].receiver.push(entity);
            } else if (type.includes('amount') || type.includes('total')) {
              console.log(`Adding to totals: ${entity.type} with text: ${entity.mentionText}`);
              organizedByPage[pageNumber].totals.push(entity);
            } else {
              organizedByPage[pageNumber].other.push(entity);
            }
          });

          console.log('Organized entities by page:', organizedByPage);

          // Calculate aggregate confidence score
          const calculateAggregateConfidence = (organizedByPage) => {
            if (!organizedByPage || Object.keys(organizedByPage).length === 0) {
              return 0;
            }

            // Collect all entities from all pages
            const allEntities = [];
            Object.keys(organizedByPage).forEach(pageNum => {
              const pageEntities = organizedByPage[pageNum];
              if (pageEntities) {
                // Add all entity types to the collection
                allEntities.push(...(pageEntities.supplier || []));
                allEntities.push(...(pageEntities.invoice || []));
                allEntities.push(...(pageEntities.receiver || []));
                allEntities.push(...(pageEntities.totals || []));
                
                // Add line items
                if (pageEntities.lineItems && pageEntities.lineItems.length > 0) {
                  pageEntities.lineItems.forEach(item => {
                    allEntities.push(item);
                    // Add line item properties
                    if (item.properties) {
                      Object.values(item.properties).forEach(prop => {
                        if (prop.text) {
                          allEntities.push({
                            confidence: prop.confidence || 0.5,
                            type: 'line_item_property'
                          });
                        }
                      });
                    }
                  });
                }
              }
            });

            // If no entities found, return 0
            if (allEntities.length === 0) {
              return 0;
            }

            // Calculate average confidence
            const totalConfidence = allEntities.reduce((sum, entity) => sum + (entity.confidence || 0), 0);
            const averageConfidence = totalConfidence / allEntities.length;
            
            return averageConfidence;
          };

          // Calculate aggregate confidence score
          const aggregateConfidence = calculateAggregateConfidence(organizedByPage);

          // Debug totals entities - search across all pages
          const allPages = Object.keys(organizedByPage).map(Number).sort((a, b) => a - b);
          console.log('All pages:', allPages);
          
          // Collect all totals entities from all pages
          const allTotals = [];
          allPages.forEach(pageNum => {
            const pageTotals = organizedByPage[pageNum]?.totals || [];
            console.log(`Totals on page ${pageNum}:`, pageTotals.map(e => e.type));
            allTotals.push(...pageTotals);
          });
          
          console.log('All totals types across all pages:', allTotals.map(e => e.type));
          
          // Find the total amount entity - prioritize exact matches
          let totalAmountEntity = allTotals.find(e => 
            e.type.toLowerCase() === 'total_amount'
          );
          
          // If not found, try more flexible matching
          if (!totalAmountEntity) {
            totalAmountEntity = allTotals.find(e => 
              e.type.toLowerCase().includes('total_amount') || 
              (e.type.toLowerCase().includes('total') && e.type.toLowerCase().includes('amount'))
            );
          }
          
          // Find the tax amount entity - prioritize exact matches
          let taxAmountEntity = allTotals.find(e => 
            e.type.toLowerCase() === 'total_tax_amount'
          );
          
          // If not found, try more flexible matching
          if (!taxAmountEntity) {
            taxAmountEntity = allTotals.find(e => 
              e.type.toLowerCase().includes('tax_amount') || 
              e.type.toLowerCase().includes('tax')
            );
          }
          
          // Find the net amount entity - prioritize exact matches
          let netAmountEntity = allTotals.find(e => 
            e.type.toLowerCase() === 'net_amount'
          );
          
          // If not found, try more flexible matching
          if (!netAmountEntity) {
            netAmountEntity = allTotals.find(e => 
              e.type.toLowerCase().includes('net_amount') || 
              e.type.toLowerCase().includes('subtotal') ||
              e.type.toLowerCase().includes('net')
            );
          }

          // Format amounts
          const parseAmount = (amountStr) => {
            if (!amountStr) return 0;
            const cleaned = amountStr.replace(/[^0-9.-]+/g, '');
            return parseFloat(cleaned) || 0;
          };

          // Format dates
          const formatDate = (dateStr) => {
            if (!dateStr) return null;
            const cleaned = dateStr.trim();
            const parts = cleaned.split(/[/-]/);
            if (parts.length !== 3) return null;
            
            let day, month, year;
            if (cleaned.includes('/')) {
              [month, day, year] = parts;
            } else {
              [day, month, year] = parts;
            }
            
            day = parseInt(day, 10);
            month = parseInt(month, 10);
            year = parseInt(year, 10);
            
            if (year < 100) year += 2000;
            
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          };

          // Find invoice details
          const invoiceInfo = organizedByPage[1]?.invoice.find(e => e.type === 'invoice_id') || {};
          const invoiceDate = organizedByPage[1]?.invoice.find(e => e.type === 'invoice_date') || {};
          const dueDate = organizedByPage[1]?.invoice.find(e => e.type === 'due_date') || {};
          
          // Find supplier details
          const supplierName = organizedByPage[1]?.supplier.find(e => e.type === 'supplier_name') || {};
          const supplierAddress = organizedByPage[1]?.supplier.find(e => e.type === 'supplier_address') || {};
          
          // Find receiver details
          const receiverName = organizedByPage[1]?.receiver.find(e => e.type === 'receiver_name') || {};
          const receiverAddress = organizedByPage[1]?.receiver.find(e => e.type === 'receiver_address') || {};

          // Prepare invoice data
          const invoiceData = {
            invoice_number: invoiceInfo.mentionText || files[i].name.split('.')[0],
            invoice_date: formatDate(invoiceDate.mentionText),
            due_date: formatDate(dueDate.mentionText),
            supplier_name: supplierName.mentionText || 'Unknown Supplier',
            supplier_address: supplierAddress.mentionText || '',
            receiver_name: receiverName.mentionText || '',
            receiver_address: receiverAddress.mentionText || '',
            total_amount: parseAmount(totalAmountEntity?.mentionText),
            tax_amount: parseAmount(taxAmountEntity?.mentionText),
            net_amount: parseAmount(netAmountEntity?.mentionText),
            confidence_score: aggregateConfidence,
            status: 'not_reviewed',
            document_url: result.storagePath,
            ai_response_url: result.aiResponsePath,
            sync_status: 'not_synced',
            processed_at: new Date().toISOString()
          };

          console.log('Attempting to insert invoice:', invoiceData);

          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert([invoiceData])
            .select()
            .single();

          if (invoiceError) {
            console.error('Error inserting invoice:', invoiceError);
            throw new Error(`Failed to insert invoice: ${invoiceError.message}`);
          }

          console.log('Successfully inserted invoice:', invoice);

          // Insert line items - collect from all pages
          const allLineItems = [];
          allPages.forEach(pageNum => {
            const pageLineItems = organizedByPage[pageNum]?.lineItems || [];
            console.log(`Line items on page ${pageNum}:`, pageLineItems.length);
            allLineItems.push(...pageLineItems);
          });
          
          console.log('Total line items across all pages:', allLineItems.length);
          
          const lineItemsData = allLineItems.map(item => ({
            invoice_id: invoice.id,
            description: item.properties?.description?.text || '',
            quantity: parseAmount(item.properties?.quantity?.text),
            unit_price: parseAmount(item.properties?.unit_price?.text),
            amount: parseAmount(item.properties?.amount?.text),
            status: 'not_reviewed'
          }));

          if (lineItemsData.length > 0) {
            console.log('Attempting to insert line items:', lineItemsData);
            const { error: lineItemsError } = await supabase
              .from('line_items')
              .insert(lineItemsData);

            if (lineItemsError) {
              console.error('Error inserting line items:', lineItemsError);
              throw new Error(`Failed to insert line items: ${lineItemsError.message}`);
            }
            console.log('Successfully inserted line items');
          }

          setProcessingStatus(prev => ({
            ...prev,
            [i]: { status: 'completed', progress: 100 }
          }));

          // Update overall progress
          setOverallProgress(((i + 1) / files.length) * 100);
        } catch (error) {
          console.error(`Error processing ${files[i].name}:`, error);
          hasErrors = true;
          setProcessingStatus(prev => ({
            ...prev,
            [i]: { 
              status: 'error', 
              error: error.message,
              fileName: files[i].name
            }
          }));
        }
      }

      // Ensure progress bar reaches 100%
      setOverallProgress(100);
      
      // Wait a moment for the progress bar to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Only navigate to review page if there were no errors
      if (!hasErrors) {
        navigate('/review');
      } else {
        setError('Some files failed to process. Please check the errors below and try again.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Batch Upload Documents</h2>

            {/* Upload area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}`}
            >
              <input {...getInputProps()} />
              <div className="flex justify-center">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="text-gray-600">
                <p className="text-lg font-medium">
                  {isDragActive
                    ? 'Drop the files here...'
                    : 'Drag and drop multiple files here, or click to select files'}
                </p>
                <p className="text-sm mt-1">
                  Supported formats: PDF, PNG, JPG, JPEG
                </p>
              </div>
            </div>

            {/* File list */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Selected Files</h3>
              <div className="space-y-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <svg className="h-6 w-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-2 text-sm text-gray-900">{file.name}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      {processingStatus[index]?.status === 'processing' && (
                        <div className="w-24">
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${processingStatus[index].progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {processingStatus[index]?.status === 'completed' && (
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">✓</span>
                          {processingStatus[index]?.message && (
                            <span className="text-sm text-green-600">{processingStatus[index].message}</span>
                          )}
                        </div>
                      )}
                      {processingStatus[index]?.status === 'error' && (
                        <div className="flex items-center space-x-2">
                          <span className="text-red-600">❌</span>
                          <span className="text-sm text-red-600" title={processingStatus[index].error}>
                            {processingStatus[index].error}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Process button and overall progress */}
              <div className="mt-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                {isProcessing && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Overall Progress</span>
                      <span>{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={processFiles}
                    disabled={isProcessing || files.length === 0}
                    className={`px-4 py-2 rounded-md text-white ${
                      isProcessing || files.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing ? 'Processing...' : 'Process All Files'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BatchUpload; 