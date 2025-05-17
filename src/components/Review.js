import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import PDFViewerModal from './PDFViewerModal';
import * as pdfjsLib from 'pdfjs-dist';
import Header from './Header';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const Review = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGallery, setShowGallery] = useState(true);
  const navigate = useNavigate();
  
  // Filter state
  const [filters, setFilters] = useState({
    confidenceScore: { min: '', max: '' },
    amount: { min: '', max: '' },
    invoiceDate: { from: '', to: '' },
    uploadDate: { from: '', to: '' }
  });
  
  // Filter options
  const [showFilters, setShowFilters] = useState(false);
  
  // Sorting state
  const [sortOption, setSortOption] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [paginatedInvoices, setPaginatedInvoices] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState(null);
  
  // PDF Viewer state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const canvasRef = useRef(null);
  const [showRawText, setShowRawText] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [loadingExtractedData, setLoadingExtractedData] = useState(false);
  const [highlightedEntity, setHighlightedEntity] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const fetchUnreviewedInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'not_reviewed')
        .order('processed_at', { ascending: false });

      if (error) throw error;
      setInvoices(data);
      setFilteredInvoices(data);
    } catch (err) {
      console.error('Error fetching unreviewed invoices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Parse the UTC date string
      const utcDate = new Date(dateString);
      
      // Get the UTC time in milliseconds
      const utcTime = utcDate.getTime();
      
      // Winnipeg is UTC-5 (during standard time) or UTC-6 (during daylight saving)
      // For simplicity, we'll use UTC-5 (Central Time)
      const winnipegOffset = -5 * 60 * 60 * 1000; // -5 hours in milliseconds
      
      // Calculate Winnipeg time
      const winnipegTime = new Date(utcTime + winnipegOffset);
      
      // Format the date manually to ensure correct display
      const month = winnipegTime.getMonth() + 1; // Months are 0-indexed
      const day = winnipegTime.getDate();
      const year = winnipegTime.getFullYear();
      const hours = winnipegTime.getHours().toString().padStart(2, '0');
      const minutes = winnipegTime.getMinutes().toString().padStart(2, '0');
      const seconds = winnipegTime.getSeconds().toString().padStart(2, '0');
      
      return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleFilterChange = (category, field, value) => {
    setFilters(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const resetFilters = () => {
    setFilters({
      confidenceScore: { min: '', max: '' },
      amount: { min: '', max: '' },
      invoiceDate: { from: '', to: '' },
      uploadDate: { from: '', to: '' }
    });
  };

  const handleSortChange = (option) => {
    setSortOption(option);
    setShowSortMenu(false);
  };
  
  const handlePageChange = (delta) => {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };
  
  // Add a function to display raw data for testing
  const displayRawData = (invoice) => {
    console.log('Raw invoice data:', invoice);
    alert(JSON.stringify(invoice, null, 2));
  };
  
  const renderPaginationControls = () => {
    if (totalPages <= 1) return null;
    
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    // Calculate range of page numbers to show
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return (
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(-1)}
            disabled={currentPage === 1}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
              currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === totalPages}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
              currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredInvoices.length)}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</span> of{' '}
              <span className="font-medium">{filteredInvoices.length}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(-1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                  currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                }`}
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
              {startPage > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    1
                  </button>
                  {startPage > 2 && (
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                      ...
                    </span>
                  )}
                </>
              )}
              
              {pageNumbers.map(number => (
                <button
                  key={number}
                  onClick={() => setCurrentPage(number)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    currentPage === number
                      ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {number}
                </button>
              ))}
              
              {endPage < totalPages && (
                <>
                  {endPage < totalPages - 1 && (
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                      ...
                    </span>
                  )}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                  currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                }`}
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // Add a function to get the display text for the sort option
  const getSortDisplayText = () => {
    switch (sortOption) {
      case 'confidence-asc':
        return 'Confidence (Low to High)';
      case 'confidence-desc':
        return 'Confidence (High to Low)';
      case 'invoice-date-asc':
        return 'Invoice Date (Old to New)';
      case 'invoice-date-desc':
        return 'Invoice Date (New to Old)';
      case 'amount-asc':
        return 'Amount (Low to High)';
      case 'amount-desc':
        return 'Amount (High to Low)';
      case 'upload-date-asc':
        return 'Upload Date (Old to New)';
      case 'upload-date-desc':
        return 'Upload Date (New to Old)';
      default:
        return 'Sort';
    }
  };

  // Function to get the secure URL for the document
  const getDocumentUrl = (storagePath, isAiResponse = false) => {
    if (!storagePath) {
      console.log('No storage path provided');
      return null;
    }
    console.log('getDocumentUrl - Input storage path:', storagePath);
    console.log('getDocumentUrl - isAiResponse:', isAiResponse);
    
    // Extract the filename from the storage path, handling both documents/ and ai-responses/ prefixes
    const matches = storagePath.match(/gs:\/\/[^\/]+\/(?:documents\/|ai-responses\/)?(.+)/);
    console.log('getDocumentUrl - Regex matches:', matches);
    
    if (!matches) {
      console.log('Invalid storage path format:', storagePath);
      return null;
    }
    
    const filename = matches[1];
    console.log('getDocumentUrl - Extracted filename:', filename);
    
    // For AI responses, use a different endpoint
    if (isAiResponse) {
      // Extract just the filename without the path
      const filenameOnly = filename.split('/').pop();
      console.log('getDocumentUrl - AI Response filename only:', filenameOnly);
      const url = `http://localhost:3001/api/ai-responses/${encodeURIComponent(filenameOnly)}`;
      console.log('getDocumentUrl - Generated AI response URL:', url);
      return url;
    }
    
    const url = `http://localhost:3001/api/file/${encodeURIComponent(filename)}`;
    console.log('getDocumentUrl - Generated regular file URL:', url);
    return url;
  };

  // Function to load and render PDF
  const loadPDF = async (url) => {
    try {
      console.log('Starting PDF load process...');
      
      if (!canvasRef.current) {
        console.error('Canvas not ready');
        return;
      }

      console.log('Loading PDF from URL:', url);
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      console.log('PDF loaded successfully:', pdf);
      
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      setPdfCurrentPage(1);
      
      // Render the first page
      console.log('Starting page render...');
      const page = await pdf.getPage(1);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Calculate scale to fit width
      const viewport = page.getViewport({ scale: 1.0 });
      const containerWidth = canvas.parentElement.clientWidth;
      const newScale = containerWidth / viewport.width;
      console.log('Calculated scale:', newScale);
      setScale(newScale);

      // Render page
      const scaledViewport = page.getViewport({ scale: newScale });
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      await page.render(renderContext).promise;
      console.log('Page rendered successfully');
    } catch (error) {
      console.error('Error in PDF loading process:', error);
    }
  };

  // Function to render a specific page
  const renderPage = async (pageNumber) => {
    if (!pdfDocument || !canvasRef.current) {
      console.log('Cannot render page:', { 
        pdfDocument: !!pdfDocument, 
        canvasRef: !!canvasRef.current,
        pageNumber 
      });
      return;
    }

    try {
      console.log('Rendering page:', pageNumber);
      const page = await pdfDocument.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Calculate scale to fit width
      const viewport = page.getViewport({ scale: 1.0 });
      const containerWidth = canvas.parentElement.clientWidth;
      const newScale = containerWidth / viewport.width;
      console.log('Calculated scale:', newScale);
      setScale(newScale);

      // Render page
      const scaledViewport = page.getViewport({ scale: newScale });
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      await page.render(renderContext).promise;
      console.log('Page rendered successfully');
      setPdfCurrentPage(pageNumber);
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  // Function to normalize AI response data
  const normalizeAiResponse = (data) => {
    // Check if the data has the expected structure
    if (data && data.entities) {
      return data;
    }
    
    // If the data is in a different format, try to normalize it
    console.log('Normalizing AI response data:', data);
    
    // Check if the data has a different structure for entities
    if (data && data.document && data.document.entities) {
      return {
        entities: data.document.entities
      };
    }
    
    // If the data has a different structure for entities
    if (data && data.document && data.document.pages) {
      // Extract entities from pages
      const entities = [];
      data.document.pages.forEach(page => {
        if (page.entities) {
          page.entities.forEach(entity => {
            // Add page reference to each entity
            entities.push({
              ...entity,
              pageAnchor: {
                pageRefs: [{
                  page: page.pageNumber - 1 // Convert to 0-based index if needed
                }]
              }
            });
          });
        }
      });
      
      return { entities };
    }
    
    // If we can't normalize the data, return null
    console.error('Could not normalize AI response data:', data);
    return null;
  };

  // Function to fetch extracted data for an invoice
  const fetchExtractedData = async (invoice) => {
    try {
      setLoadingExtractedData(true);
      console.log('fetchExtractedData - Starting with invoice:', invoice);
      
      // Check if the AI response is stored directly in the invoice record
      if (invoice.ai_response_data) {
        console.log('Using AI response data from invoice record');
        const normalizedData = normalizeAiResponse(invoice.ai_response_data);
        setExtractedData(normalizedData);
        return;
      }
      
      // Use the ai_response_url from the invoice record
      if (!invoice.ai_response_url) {
        console.error('No AI response URL found for invoice:', invoice.id);
        setExtractedData(null);
        return;
      }
      
      console.log('fetchExtractedData - AI response URL:', invoice.ai_response_url);
      
      // Try different URL patterns
      const urlPatterns = [
        // Pattern 1: Using the ai-responses endpoint with just the filename
        () => {
          console.log('Trying Pattern 1');
          const matches = invoice.ai_response_url.match(/[^\/]+\.json$/);
          console.log('Pattern 1 matches:', matches);
          if (matches) {
            const url = `http://localhost:3001/api/ai-responses/${encodeURIComponent(matches[0])}`;
            console.log('Pattern 1 generated URL:', url);
            return url;
          }
          return null;
        },
        // Pattern 2: Using the file endpoint with isAiResponse=true
        () => {
          console.log('Trying Pattern 2');
          const url = getDocumentUrl(invoice.ai_response_url, true);
          console.log('Pattern 2 generated URL:', url);
          return url;
        },
        // Pattern 3: Direct URL if it's already a full URL
        () => {
          console.log('Trying Pattern 3');
          if (invoice.ai_response_url.startsWith('http')) {
            console.log('Pattern 3 using direct URL:', invoice.ai_response_url);
            return invoice.ai_response_url;
          }
          return null;
        },
        // Pattern 4: Try to extract just the filename and use a different endpoint
        () => {
          console.log('Trying Pattern 4');
          const matches = invoice.ai_response_url.match(/[^\/]+\.json$/);
          console.log('Pattern 4 matches:', matches);
          if (matches) {
            const url = `http://localhost:3001/api/ai-responses/${encodeURIComponent(matches[0])}`;
            console.log('Pattern 4 generated URL:', url);
            return url;
          }
          return null;
        }
      ];
      
      // Try each URL pattern until one works
      let response = null;
      let aiResponseUrl = null;
      let error = null;
      
      for (const getUrl of urlPatterns) {
        try {
          aiResponseUrl = getUrl();
          if (!aiResponseUrl) {
            console.log('URL pattern returned null, trying next pattern');
            continue;
          }
          
          console.log('Attempting to fetch from URL:', aiResponseUrl);
          response = await fetch(aiResponseUrl);
          
          if (response.ok) {
            console.log('Successfully fetched AI response from:', aiResponseUrl);
            break;
          } else {
            console.log('Fetch failed with status:', response.status);
          }
        } catch (e) {
          console.warn('Failed to fetch with URL pattern:', aiResponseUrl, e);
          error = e;
        }
      }
      
      // If all patterns failed, throw the last error
      if (!response || !response.ok) {
        throw error || new Error('Failed to fetch AI response with all URL patterns');
      }
      
      const data = await response.json();
      console.log('AI response data:', data);
      
      // Normalize the data to ensure it has the expected structure
      const normalizedData = normalizeAiResponse(data);
      setExtractedData(normalizedData);
    } catch (error) {
      console.error('Error fetching extracted data:', error);
      setExtractedData(null);
    } finally {
      setLoadingExtractedData(false);
    }
  };

  // Function to verify an invoice
  const verifyInvoice = async (invoice) => {
    try {
      setSubmissionStatus('submitting');
      // Update the invoice status to 'verified'
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'verified' })
        .eq('id', invoice.id);

      if (error) {
        console.error('Error verifying invoice:', error);
        throw error;
      }

      setSubmissionStatus('success');
      
      // Wait for 2 seconds to show success message
      setTimeout(() => {
        // Find the next invoice in the queue
        const currentIndex = filteredInvoices.findIndex(i => i.id === invoice.id);
        const nextInvoice = filteredInvoices[currentIndex + 1];
        
        if (nextInvoice) {
          // Select the next invoice
          handleInvoiceSelect(nextInvoice);
          setSubmissionStatus(null);
        } else {
          // No more invoices, show completion message
          setSubmissionStatus('complete');
          setSelectedInvoice(null);
        }
        
        // Refresh the list of unreviewed invoices
        fetchUnreviewedInvoices();
      }, 2000);
    } catch (error) {
      console.error('Error verifying invoice:', error);
      setError(error.message);
      setSubmissionStatus('error');
    }
  };

  // Function to handle invoice selection
  const handleInvoiceSelect = (invoice) => {
    setSelectedInvoice(invoice);
    
    // Get the document URL
    const documentUrl = getDocumentUrl(invoice.document_url);
    if (documentUrl) {
      // Use setTimeout to ensure the canvas is rendered before loading the PDF
      setTimeout(() => {
        // Load the PDF
        loadPDF(documentUrl);
        
        // Fetch the extracted data
        fetchExtractedData(invoice);
      }, 100);
    }
  };

  // Function to format confidence score
  const formatConfidence = (confidence) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  // Function to format field type
  const formatFieldType = (type) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Function to organize entities by page and type
  const organizeEntities = (entities) => {
    // First organize by page
    const byPage = {};
    
    console.log('Organizing entities:', entities);
    
    entities.forEach(entity => {
      // Convert from zero-based Document AI page number to one-based UI page number
      const docAIPage = entity.pageAnchor?.pageRefs?.[0]?.page;
      const pageNumber = docAIPage ? parseInt(docAIPage, 10) + 1 : 1;
      
      console.log(`Processing entity: ${entity.type}, Page: ${pageNumber}`);

      if (!byPage[pageNumber]) {
        byPage[pageNumber] = {
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

        byPage[pageNumber].lineItems.push(lineItem);
      } else if (type.includes('supplier')) {
        byPage[pageNumber].supplier.push(entity);
      } else if (type.includes('invoice')) {
        byPage[pageNumber].invoice.push(entity);
      } else if (type.includes('receiver')) {
        byPage[pageNumber].receiver.push(entity);
      } else if (type.includes('amount') || type.includes('total')) {
        console.log(`Adding to totals: ${entity.type} with text: ${entity.mentionText}`);
        byPage[pageNumber].totals.push(entity);
      } else {
        byPage[pageNumber].other.push(entity);
      }
    });

    console.log('Organized entities by page:', byPage);
    return byPage;
  };

  // Function to convert normalized coordinates to pixel coordinates
  const getPixelCoordinates = (normalizedVertices, containerWidth, containerHeight) => {
    if (!normalizedVertices || normalizedVertices.length !== 4) return null;
    
    return normalizedVertices.map(vertex => ({
      x: vertex.x * containerWidth,
      y: vertex.y * containerHeight
    }));
  };

  // Function to handle field click
  const handleFieldClick = (entity) => {
    console.log('Field clicked:', entity.type);
    
    // Check if the entity has page information and convert from zero-based to one-based
    const docAIPage = entity.pageAnchor?.pageRefs?.[0]?.page;
    if (docAIPage !== undefined) {
      const pageNumber = parseInt(docAIPage, 10) + 1;
      console.log('Setting page to:', pageNumber, 'for entity:', entity.type);
      
      // Set the highlighted entity first
      setHighlightedEntity(entity);
      
      // Then update the page
      renderPage(pageNumber).then(() => {
        // Add a small delay to ensure the page is fully rendered
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const rect = canvas.getBoundingClientRect();
          const vertices = getPixelCoordinates(
            entity.pageAnchor.pageRefs[0].boundingPoly.normalizedVertices,
            rect.width,
            rect.height
          );

          if (!vertices) return;

          // Calculate the highlight position
          const minY = Math.min(...vertices.map(v => v.y));
          const maxY = Math.max(...vertices.map(v => v.y));
          const highlightCenter = (minY + maxY) / 2;

          // Find the PDF viewer container by traversing up from the canvas
          let container = canvas;
          while (container && !container.classList.contains('overflow-auto')) {
            container = container.parentElement;
          }
          
          if (!container) return;

          const containerHeight = container.clientHeight;
          const containerScrollTop = container.scrollTop;

          // Calculate the target scroll position to center the highlight
          const targetScrollTop = highlightCenter - (containerHeight / 2);

          // Smoothly scroll to the target position
          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }, 100); // 100ms delay to ensure rendering is complete
      });
    } else {
      setHighlightedEntity(entity);
    }
  };

  // Function to render highlight overlay
  const renderHighlight = (entity) => {
    if (!entity?.pageAnchor?.pageRefs?.[0]?.boundingPoly?.normalizedVertices) {
      console.log('No normalized vertices found for entity', entity.type);
      return null;
    }

    // Check if the entity is on the current page
    const docAIPage = entity.pageAnchor?.pageRefs?.[0]?.page;
    const entityPage = docAIPage !== undefined ? parseInt(docAIPage, 10) + 1 : 1;
    
    console.log('Highlight check:', { 
      entityPage, 
      currentPage: pdfCurrentPage, 
      entityType: entity.type,
      matchesCurrentPage: entityPage === pdfCurrentPage
    });
    
    if (entityPage !== pdfCurrentPage) {
      console.log('Page mismatch - not rendering highlight');
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('No canvas found');
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const vertices = getPixelCoordinates(
      entity.pageAnchor.pageRefs[0].boundingPoly.normalizedVertices,
      rect.width,
      rect.height
    );

    if (!vertices) {
      console.log('No vertices found');
      return null;
    }

    const minX = Math.min(...vertices.map(v => v.x));
    const maxX = Math.max(...vertices.map(v => v.x));
    const minY = Math.min(...vertices.map(v => v.y));
    const maxY = Math.max(...vertices.map(v => v.y));

    console.log('Rendering highlight at:', {
      page: entityPage,
      currentPage: pdfCurrentPage,
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
      canvasWidth: rect.width,
      canvasHeight: rect.height
    });

    return (
      <div
        key={entity.id}
        className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
        style={{
          left: `${minX}px`,
          top: `${minY}px`,
          width: `${maxX - minX}px`,
          height: `${maxY - minY}px`,
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
        title={`${formatFieldType(entity.type)}: ${entity.mentionText}`}
      />
    );
  };

  // Function to render highlights container
  const renderHighlights = () => {
    if (!highlightedEntity || !canvasRef.current) return null;

    return (
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'visible',
          zIndex: 1000,
        }}
      >
        {renderHighlight(highlightedEntity)}
      </div>
    );
  };

  // Function to handle field value changes
  const handleFieldChange = (entityId, newValue) => {
    setEditedValues(prev => ({
      ...prev,
      [entityId]: newValue
    }));
    
    // Clear validation errors for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[entityId];
      return newErrors;
    });
  };

  // Function to render a field item
  const renderFieldItem = (entity) => (
    <div 
      className={`flex justify-between items-start cursor-pointer p-2 rounded-md transition-colors
        ${highlightedEntity?.id === entity.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
        ${validationErrors[entity.id] ? 'border border-red-500 bg-red-50' : ''}`}
      onClick={() => handleFieldClick(entity)}
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">
          {formatFieldType(entity.type)}
        </p>
        <input
          type="text"
          value={editedValues[entity.id] ?? entity.mentionText}
          onChange={(e) => handleFieldChange(entity.id, e.target.value)}
          onClick={(e) => e.stopPropagation()} // Prevent field click when editing
          className={`text-sm text-gray-600 mt-1 w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${validationErrors[entity.id] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          placeholder={entity.mentionText}
        />
        {validationErrors[entity.id] && (
          <p className="text-xs text-red-500 mt-1">{validationErrors[entity.id]}</p>
        )}
      </div>
      <div className="flex items-center ml-4">
        <span className={`text-xs font-medium ${editedValues[entity.id] ? 'text-blue-500' : 'text-gray-500'}`}>
          {editedValues[entity.id] ? 'Edited' : formatConfidence(entity.confidence)}
        </span>
      </div>
    </div>
  );

  // Function to render a section
  const renderSection = (title, entities) => {
    // Filter out 'Invoice Type' from invoice information section
    const filteredEntities = title === 'Invoice Information' 
      ? entities.filter(entity => !entity.type.toLowerCase().includes('invoice_type'))
      : entities;

    if (filteredEntities.length === 0) return null;

    // Special handling for Totals section
    if (title === 'Totals') {
      // Define the desired order
      const order = ['net_amount', 'total_tax_amount', 'total_amount'];
      
      // Sort entities based on the defined order
      const sortedEntities = [...filteredEntities].sort((a, b) => {
        const aType = a.type.toLowerCase();
        const bType = b.type.toLowerCase();
        const aIndex = order.findIndex(type => aType.includes(type));
        const bIndex = order.findIndex(type => bType.includes(type));
        return aIndex - bIndex;
      });

      return (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
          <div className="space-y-4">
            {sortedEntities.map((entity, index) => (
              <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                {renderFieldItem(entity)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
        <div className="space-y-4">
          {filteredEntities.map((entity, index) => (
            <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
              {renderFieldItem(entity)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Function to render line items
  const renderLineItems = (lineItems) => {
    if (lineItems.length === 0) return null;

    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Line Items</h4>
        <div className="space-y-4">
          {lineItems.map((item, index) => {
            const isEdited = editedValues[`${item.id}_quantity`] || 
                           editedValues[`${item.id}_description`] || 
                           editedValues[`${item.id}_amount`];
            
            const hasError = validationErrors[`${item.id}_amount`];

            return (
              <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                <div className={`flex justify-between items-start cursor-pointer p-2 rounded-md transition-colors hover:bg-gray-50
                  ${hasError ? 'border border-red-500 bg-red-50' : ''}`}
                     onClick={() => handleFieldClick(item)}>
                  <div className="flex-1">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Quantity</p>
                        <input
                          type="text"
                          value={editedValues[`${item.id}_quantity`] ?? (item.properties.quantity?.text || '-')}
                          onChange={(e) => handleFieldChange(`${item.id}_quantity`, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm font-medium text-gray-900 w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            ${validationErrors[`${item.id}_quantity`] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        />
                        {validationErrors[`${item.id}_quantity`] && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors[`${item.id}_quantity`]}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Description</p>
                        <input
                          type="text"
                          value={editedValues[`${item.id}_description`] ?? (item.properties.description?.text || '-')}
                          onChange={(e) => handleFieldChange(`${item.id}_description`, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm font-medium text-gray-900 w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            ${validationErrors[`${item.id}_description`] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        />
                        {validationErrors[`${item.id}_description`] && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors[`${item.id}_description`]}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <input
                          type="text"
                          value={editedValues[`${item.id}_amount`] ?? (item.properties.amount?.text || '-')}
                          onChange={(e) => handleFieldChange(`${item.id}_amount`, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm font-medium text-gray-900 w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            ${validationErrors[`${item.id}_amount`] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        />
                        {validationErrors[`${item.id}_amount`] && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors[`${item.id}_amount`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className={`text-xs font-medium ${isEdited ? 'text-blue-500' : 'text-gray-500'}`}>
                      {isEdited ? 'Edited' : formatConfidence(item.confidence)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Function to calculate aggregate confidence score
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

  // Function to get confidence color based on score
  const getConfidenceColor = (confidence) => {
    if (confidence < 0.5) {
      return 'text-red-500';
    } else if (confidence < 0.8) {
      return 'text-yellow-500';
    } else {
      return 'text-green-500';
    }
  };

  // Function to get confidence background color based on score
  const getConfidenceBgColor = (confidence) => {
    if (confidence < 0.5) {
      return 'bg-red-50';
    } else if (confidence < 0.8) {
      return 'bg-yellow-50';
    } else {
      return 'bg-green-50';
    }
  };

  // Combined effect to handle filtering, sorting, and pagination
  useEffect(() => {
    // Step 1: Apply filters
    let filtered = [...invoices];
    
    // Filter by confidence score
    if (filters.confidenceScore.min !== '') {
      filtered = filtered.filter(invoice => 
        invoice.confidence_score >= parseFloat(filters.confidenceScore.min)
      );
    }
    if (filters.confidenceScore.max !== '') {
      filtered = filtered.filter(invoice => 
        invoice.confidence_score <= parseFloat(filters.confidenceScore.max)
      );
    }
    
    // Filter by amount
    if (filters.amount.min !== '') {
      filtered = filtered.filter(invoice => 
        invoice.total_amount >= parseFloat(filters.amount.min)
      );
    }
    if (filters.amount.max !== '') {
      filtered = filtered.filter(invoice => 
        invoice.total_amount <= parseFloat(filters.amount.max)
      );
    }
    
    // Filter by invoice date
    if (filters.invoiceDate.from !== '') {
      const fromDate = new Date(filters.invoiceDate.from);
      filtered = filtered.filter(invoice => 
        new Date(invoice.invoice_date) >= fromDate
      );
    }
    if (filters.invoiceDate.to !== '') {
      const toDate = new Date(filters.invoiceDate.to);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(invoice => 
        new Date(invoice.invoice_date) <= toDate
      );
    }
    
    // Filter by upload date
    if (filters.uploadDate.from !== '') {
      const fromDate = new Date(filters.uploadDate.from);
      filtered = filtered.filter(invoice => 
        new Date(invoice.created_at) >= fromDate
      );
    }
    if (filters.uploadDate.to !== '') {
      const toDate = new Date(filters.uploadDate.to);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(invoice => 
        new Date(invoice.created_at) <= toDate
      );
    }
    
    // Step 2: Apply sorting
    if (sortOption) {
      switch (sortOption) {
        case 'confidence-asc':
          filtered.sort((a, b) => a.confidence_score - b.confidence_score);
          break;
        case 'confidence-desc':
          filtered.sort((a, b) => b.confidence_score - a.confidence_score);
          break;
        case 'invoice-date-asc':
          filtered.sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));
          break;
        case 'invoice-date-desc':
          filtered.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
          break;
        case 'amount-asc':
          filtered.sort((a, b) => a.total_amount - b.total_amount);
          break;
        case 'amount-desc':
          filtered.sort((a, b) => b.total_amount - a.total_amount);
          break;
        case 'upload-date-asc':
          filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          break;
        case 'upload-date-desc':
          filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          break;
        default:
          break;
      }
    }
    
    // Update filtered invoices
    setFilteredInvoices(filtered);
    
    // Step 3: Apply pagination
    const total = Math.ceil(filtered.length / itemsPerPage);
    setTotalPages(total);
    
    // Get current items
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    
    setPaginatedInvoices(currentItems);
    
    // Reset to first page when filters or sorting change
    if (currentPage > total && total > 0) {
      setCurrentPage(1);
    }
  }, [invoices, filters, sortOption, currentPage, itemsPerPage]);

  // Initial data fetch
  useEffect(() => {
    fetchUnreviewedInvoices();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    Unreviewed Invoices
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({filteredInvoices.length} total)
                    </span>
                  </h2>
                  <button
                    onClick={() => setShowGallery(!showGallery)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    {showGallery ? 'Hide Gallery' : 'Show Gallery'}
                  </button>
                </div>
                <div className="flex space-x-2">
                  {/* Sort Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortMenu(!showSortMenu)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors flex items-center"
                    >
                      <span>{getSortDisplayText()}</span>
                      <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </button>
                    
                    {showSortMenu && (
                      <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                        <div className="py-1">
                          <button
                            onClick={() => handleSortChange('confidence-asc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'confidence-asc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Confidence (Lowest to Highest)
                          </button>
                          <button
                            onClick={() => handleSortChange('confidence-desc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'confidence-desc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Confidence (Highest to Lowest)
                          </button>
                          <button
                            onClick={() => handleSortChange('invoice-date-asc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'invoice-date-asc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Invoice Date (Oldest to Newest)
                          </button>
                          <button
                            onClick={() => handleSortChange('invoice-date-desc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'invoice-date-desc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Invoice Date (Newest to Oldest)
                          </button>
                          <button
                            onClick={() => handleSortChange('amount-asc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'amount-asc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Amount (Lowest to Highest)
                          </button>
                          <button
                            onClick={() => handleSortChange('amount-desc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'amount-desc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Amount (Highest to Lowest)
                          </button>
                          <button
                            onClick={() => handleSortChange('upload-date-asc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'upload-date-asc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Upload Date (Oldest to Newest)
                          </button>
                          <button
                            onClick={() => handleSortChange('upload-date-desc')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              sortOption === 'upload-date-desc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Upload Date (Newest to Oldest)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Filter Button */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                  </button>
                </div>
              </div>
              
              {showFilters && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-md font-medium text-gray-700 mb-3">Filter Options</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Confidence Score Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confidence Score</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          placeholder="Min"
                          value={filters.confidenceScore.min}
                          onChange={(e) => handleFilterChange('confidenceScore', 'min', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          placeholder="Max"
                          value={filters.confidenceScore.max}
                          onChange={(e) => handleFilterChange('confidenceScore', 'max', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    {/* Amount Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Min"
                          value={filters.amount.min}
                          onChange={(e) => handleFilterChange('amount', 'min', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Max"
                          value={filters.amount.max}
                          onChange={(e) => handleFilterChange('amount', 'max', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    {/* Invoice Date Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                      <div className="flex space-x-2">
                        <input
                          type="date"
                          placeholder="From"
                          value={filters.invoiceDate.from}
                          onChange={(e) => handleFilterChange('invoiceDate', 'from', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="date"
                          placeholder="To"
                          value={filters.invoiceDate.to}
                          onChange={(e) => handleFilterChange('invoiceDate', 'to', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    {/* Upload Date Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Upload Date</label>
                      <div className="flex space-x-2">
                        <input
                          type="date"
                          placeholder="From"
                          value={filters.uploadDate.from}
                          onChange={(e) => handleFilterChange('uploadDate', 'from', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="date"
                          placeholder="To"
                          value={filters.uploadDate.to}
                          onChange={(e) => handleFilterChange('uploadDate', 'to', e.target.value)}
                          className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors mr-2"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              )}
              
              {showGallery && (
                <>
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
                      <p className="text-gray-600">No unreviewed invoices found.</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <div className="max-h-[400px] overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {paginatedInvoices.map((invoice) => (
                                <tr 
                                  key={invoice.id} 
                                  className={`hover:bg-gray-50 cursor-pointer ${selectedInvoice?.id === invoice.id ? 'bg-blue-50' : ''}`}
                                  onClick={() => handleInvoiceSelect(invoice)}
                                >
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
                                    {formatDateTime(invoice.created_at)}
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
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    <div className="flex space-x-2">
                                      <button
                                        className="text-blue-600 hover:text-blue-900"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const documentUrl = getDocumentUrl(invoice.document_url);
                                          if (documentUrl) {
                                            setSelectedDocument(documentUrl);
                                          }
                                        }}
                                      >
                                        Review
                                      </button>
                                      <button
                                        className="text-purple-600 hover:text-purple-900"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          displayRawData(invoice);
                                        }}
                                      >
                                        Raw Data
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      {/* Pagination Controls */}
                      {renderPaginationControls()}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Overlay and Document Viewer */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Semi-transparent backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setSelectedInvoice(null)}
          />
          
          {/* Main content container */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="flex h-full">
              {/* Document Viewer */}
              <div className="flex-1 bg-white">
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-medium text-gray-900">Document Viewer</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRawText(!showRawText)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        {showRawText ? 'Hide Raw Text' : 'Show Raw Text'}
                      </button>
                      <button
                        onClick={() => setSelectedInvoice(null)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {showRawText ? (
                      <pre className="whitespace-pre-wrap text-sm text-gray-600">
                        {JSON.stringify(extractedData, null, 2)}
                      </pre>
                    ) : (
                      <div className="relative h-full">
                        <div className="relative">
                          <canvas ref={canvasRef} className="mx-auto" />
                          {renderHighlights()}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Pagination Controls */}
                  <div className="p-4 border-t flex justify-center items-center space-x-4">
                    <button
                      onClick={() => {
                        if (pdfCurrentPage > 1) {
                          renderPage(pdfCurrentPage - 1);
                        }
                      }}
                      disabled={pdfCurrentPage <= 1}
                      className={`px-4 py-2 bg-blue-500 text-white rounded-md transition-colors ${
                        pdfCurrentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                      }`}
                    >
                      Previous
                    </button>
                    <span className="text-gray-700">
                      Page {pdfCurrentPage} of {numPages}
                    </span>
                    <button
                      onClick={() => {
                        if (pdfCurrentPage < numPages) {
                          renderPage(pdfCurrentPage + 1);
                        }
                      }}
                      disabled={pdfCurrentPage >= numPages}
                      className={`px-4 py-2 bg-blue-500 text-white rounded-md transition-colors ${
                        pdfCurrentPage >= numPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              {/* Extracted Fields Side Panel */}
              <div className="w-96 bg-white border-l">
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        Extracted Fields - Page {pdfCurrentPage}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            console.log('Selected Invoice:', selectedInvoice);
                            console.log('Extracted Data:', extractedData);
                            alert('Debug info logged to console');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Debug
                        </button>
                        <button
                          onClick={() => verifyInvoice(selectedInvoice)}
                          className="px-3 py-1 text-sm text-white bg-green-500 hover:bg-green-600 rounded-md transition-colors"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {loadingExtractedData ? (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <p className="mt-2 text-gray-600">Loading extracted data...</p>
                      </div>
                    ) : extractedData && extractedData.entities ? (
                      (() => {
                        const organizedByPage = organizeEntities(extractedData.entities);
                        const currentPageEntities = organizedByPage[pdfCurrentPage] || {
                          supplier: [],
                          invoice: [],
                          receiver: [],
                          lineItems: [],
                          totals: [],
                          other: []
                        };
                        
                        // Calculate aggregate confidence score
                        const aggregateConfidence = calculateAggregateConfidence(organizedByPage);
                        const confidenceColor = getConfidenceColor(aggregateConfidence);
                        const confidenceBgColor = getConfidenceBgColor(aggregateConfidence);
                        
                        // Collect totals from all pages
                        const allPages = Object.keys(organizedByPage).map(Number).sort((a, b) => a - b);
                        const allTotals = [];
                        allPages.forEach(pageNum => {
                          const pageTotals = organizedByPage[pageNum]?.totals || [];
                          allTotals.push(...pageTotals);
                        });
                        
                        // Define the desired order for totals
                        const totalsOrder = ['net_amount', 'total_tax_amount', 'total_amount'];
                        
                        // Sort totals based on the defined order
                        const sortedTotals = [...allTotals].sort((a, b) => {
                          const aType = a.type.toLowerCase();
                          const bType = b.type.toLowerCase();
                          const aIndex = totalsOrder.findIndex(type => aType.includes(type));
                          const bIndex = totalsOrder.findIndex(type => bType.includes(type));
                          return aIndex - bIndex;
                        });

                        return (
                          <>
                            {/* Aggregate Confidence Score */}
                            <div className={`mb-6 p-4 rounded-lg ${confidenceBgColor} border border-gray-200`}>
                              <div className="flex justify-between items-center">
                                <h4 className="text-sm font-semibold text-gray-700">Overall Confidence Score</h4>
                                <span className={`text-lg font-bold ${confidenceColor}`}>
                                  {formatConfidence(aggregateConfidence)}
                                </span>
                              </div>
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    aggregateConfidence < 0.5 ? 'bg-red-500' : 
                                    aggregateConfidence < 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${aggregateConfidence * 100}%` }}
                                ></div>
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                {aggregateConfidence < 0.5 ? 'Low confidence - Review carefully' : 
                                 aggregateConfidence < 0.8 ? 'Medium confidence - Some review may be needed' : 
                                 'High confidence - Likely accurate'}
                              </div>
                            </div>
                            
                            <div className="flex justify-end mb-4">
                              <span className="text-xs font-medium text-gray-500">Confidence Score</span>
                            </div>
                            
                            {renderSection('Supplier Information', currentPageEntities.supplier)}
                            {renderSection('Invoice Information', currentPageEntities.invoice)}
                            {renderSection('Receiver Information', currentPageEntities.receiver)}
                            {renderLineItems(currentPageEntities.lineItems)}
                            
                            {/* Render totals from all pages */}
                            {sortedTotals.length > 0 && (
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Totals</h4>
                                <div className="space-y-4">
                                  {sortedTotals.map((entity, index) => (
                                    <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                                      {renderFieldItem(entity)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Verify button at the bottom */}
                            <div className="mt-8 pt-4 border-t border-gray-200">
                              {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                                  {error}
                                </div>
                              )}
                              
                              {submissionStatus === 'submitting' && (
                                <div className="mb-4 p-3 bg-blue-50 text-blue-600 rounded-md text-sm">
                                  Verifying invoice...
                                </div>
                              )}
                              
                              {submissionStatus === 'success' && (
                                <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md text-sm">
                                  Invoice verified successfully!
                                </div>
                              )}
                              
                              {submissionStatus === 'complete' && (
                                <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md text-sm">
                                  All queued invoices have been processed!
                                </div>
                              )}
                              
                              {submissionStatus === 'error' && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                                  Error verifying invoice. Please try again.
                                </div>
                              )}
                              
                              {pdfCurrentPage === numPages && !submissionStatus && (
                                <button
                                  onClick={() => verifyInvoice(selectedInvoice)}
                                  className="w-full px-4 py-2 text-sm text-white bg-green-500 hover:bg-green-600 rounded-md transition-colors"
                                >
                                  Verify Invoice
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-600">No extracted data available.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {selectedDocument && (
        <PDFViewerModal
          documentUrl={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
};

export default Review; 