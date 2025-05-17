import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import { useNavigate } from 'react-router-dom';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../lib/supabase';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const documentRef = useRef(null);
  const [highlightedEntity, setHighlightedEntity] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfDocument, setPdfDocument] = useState(null);
  const canvasRef = useRef(null);
  const pdfViewerRef = useRef(null);
  const [pdfScrollPosition, setPdfScrollPosition] = useState(0);
  const navigate = useNavigate();
  const [editedValues, setEditedValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Add custom styles to the component
  useEffect(() => {
    // Add custom CSS to fix PDF viewer positioning
    const style = document.createElement('style');
    style.textContent = `
      .pdf-viewer {
        height: 100% !important;
      }
      .pdf-container {
        overflow: hidden !important;
      }
      .pdf-page {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add useEffect to load PDF when results change
  useEffect(() => {
    if (results?.storagePath) {
      const url = getImageUrl(results.storagePath);
      if (url.toLowerCase().endsWith('.pdf')) {
        console.log('Loading PDF from URL:', url);
        loadPDF(url);
      }
    }
  }, [results]);

  // Add useEffect to check for duplicate invoice when results change
  useEffect(() => {
    if (results && results.entities) {
      const organizedByPage = organizeEntities(results.entities);
      checkForDuplicateOnProcess(organizedByPage);
    }
  }, [results]);

  const onDrop = useCallback(async (acceptedFiles) => {
    setFiles(acceptedFiles);
    setLoading(true);
    setError(null);
    setResults(null);
    setValidationErrors({});
    setEditedValues({});
    setSubmitError(null);
    setSubmitSuccess(false);
    // Reset PDF viewer state
    setPdfDocument(null);
    setNumPages(null);
    setCurrentPage(1);
    setHighlightedEntity(null);
    setSelectedEntity(null);

    try {
      console.log('Preparing to upload file:', acceptedFiles[0].name);
      const formData = new FormData();
      formData.append('file', acceptedFiles[0]);

      console.log('Sending request to backend...');
      const response = await fetch('http://localhost:3001/api/process-invoice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process invoice');
      }

      console.log('Response received from backend');
      const data = await response.json();
      console.log('Processing results:', data);
      setResults(data);
    } catch (err) {
      console.error('Error details:', err);
      setError(err.message || 'An error occurred while processing the file');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: false
  });

  // Function to format confidence score as percentage
  const formatConfidence = (confidence) => {
    return `${(confidence * 100).toFixed(2)}%`;
  };

  // Function to format field type for display
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

  // Function to group line items
  const groupLineItems = (lineItems) => {
    const grouped = [];
    const itemMap = new Map();

    lineItems.forEach(item => {
      const type = item.type.split('/')[1]; // Get the part after 'line_item/'
      const textAnchor = item.textAnchor?.textSegments?.[0];
      if (!textAnchor) return;

      // Use the startIndex as a key to group related items
      const key = textAnchor.startIndex;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          description: '',
          unit_price: '',
          quantity: '',
          amount: '',
          confidence: item.confidence
        });
      }

      const group = itemMap.get(key);
      group[type] = item.mentionText;
    });

    // Convert map to array
    itemMap.forEach((value, key) => {
      grouped.push(value);
    });

    return grouped;
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
      
      // Set all state updates in a single batch
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      
      // Now render the first page
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

  // Function to handle page navigation
  const handlePageChange = (delta) => {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= numPages) {
      renderPage(newPage);
    }
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
      renderPage(pageNumber);
    } else {
      setHighlightedEntity(entity);
    }
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

  // Function to parse amount strings to numbers
  const parseAmount = (amountStr) => {
    if (!amountStr) {
      console.log('No amount string provided');
      return 0;
    }
    console.log('Processing amount string:', amountStr);
    
    // Handle different formats
    let cleanedStr = amountStr;
    
    // Remove currency symbols and commas
    cleanedStr = cleanedStr.replace(/[^0-9.-]+/g, '');
    console.log('Cleaned amount string:', cleanedStr);
    
    // Handle empty string after cleaning
    if (!cleanedStr) {
      console.log('Empty string after cleaning');
      return 0;
    }
    
    // Parse the value
    const value = parseFloat(cleanedStr);
    console.log('Parsed amount value:', value);
    
    // Check if the value is a valid number
    if (isNaN(value)) {
      console.log('Invalid number after parsing');
      return 0;
    }
    
    // Round to 2 decimal places
    const roundedValue = Math.round(value * 100) / 100;
    console.log('Rounded amount value:', roundedValue);
    return roundedValue;
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

  // Function to get the secure URL for the image
  const getImageUrl = (storagePath) => {
    if (!storagePath) {
      console.log('No storage path provided');
      return null;
    }
    console.log('Storage path:', storagePath);
    
    // Extract the filename from the storage path, removing the documents/ prefix if present
    const matches = storagePath.match(/gs:\/\/[^\/]+\/(?:documents\/)?(.+)/);
    if (!matches) {
      console.log('Invalid storage path format:', storagePath);
      return null;
    }
    
    const filename = matches[1];
    const url = `http://localhost:3001/api/file/${encodeURIComponent(filename)}`;
    console.log('Generated URL:', url);
    return url;
  };

  // Function to convert normalized coordinates to pixel coordinates
  const getPixelCoordinates = (normalizedVertices, containerWidth, containerHeight) => {
    if (!normalizedVertices || normalizedVertices.length !== 4) return null;
    
    return normalizedVertices.map(vertex => ({
      x: vertex.x * containerWidth,
      y: vertex.y * containerHeight
    }));
  };

  // Function to handle PDF load
  const onDocumentLoad = (e) => {
    setNumPages(e.doc._pdfInfo.numPages);
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
      currentPage, 
      entityType: entity.type,
      matchesCurrentPage: entityPage === currentPage
    });
    
    if (entityPage !== currentPage) {
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
      currentPage,
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

  // Function to render selected entity details
  const renderSelectedEntityDetails = () => {
    if (!selectedEntity) return null;

    return (
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-sm font-medium text-gray-900">
            {formatFieldType(selectedEntity.type)}
          </h4>
          <button
            onClick={() => setSelectedEntity(null)}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-600">{selectedEntity.mentionText}</p>
        <div className="mt-2 text-xs text-gray-500">
          Confidence: {formatConfidence(selectedEntity.confidence)}
        </div>
      </div>
    );
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
      setCurrentPage(pageNumber);
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  // Function to validate totals
  const validateTotals = (organizedByPage) => {
    const errors = {};
    
    // Collect all totals entities from all pages
    const allPages = Object.keys(organizedByPage).map(Number).sort((a, b) => a - b);
    const allTotals = [];
    allPages.forEach(pageNum => {
      const pageTotals = organizedByPage[pageNum]?.totals || [];
      allTotals.push(...pageTotals);
    });
    
    console.log('All totals entities:', allTotals.map(e => ({
      type: e.type,
      text: e.mentionText,
      id: e.id
    })));
    
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
    
    console.log('Found entities:', {
      totalAmountEntity: totalAmountEntity ? { type: totalAmountEntity.type, text: totalAmountEntity.mentionText, id: totalAmountEntity.id } : null,
      taxAmountEntity: taxAmountEntity ? { type: taxAmountEntity.type, text: taxAmountEntity.mentionText, id: taxAmountEntity.id } : null,
      netAmountEntity: netAmountEntity ? { type: netAmountEntity.type, text: netAmountEntity.mentionText, id: netAmountEntity.id } : null
    });
    
    // Get the values
    const totalAmount = parseAmount(editedValues[totalAmountEntity?.id] || totalAmountEntity?.mentionText);
    const taxAmount = parseAmount(editedValues[taxAmountEntity?.id] || taxAmountEntity?.mentionText);
    const netAmount = parseAmount(editedValues[netAmountEntity?.id] || netAmountEntity?.mentionText);
    
    console.log('Validating totals:', {
      totalAmount,
      taxAmount,
      netAmount,
      calculatedTotal: netAmount + taxAmount,
      editedValues: Object.keys(editedValues).filter(key => key.includes('amount'))
    });
    
    // Check if the totals add up
    const calculatedTotal = netAmount + taxAmount;
    const difference = Math.abs(calculatedTotal - totalAmount);
    
    // If there's a significant difference (more than 0.01 to account for rounding)
    if (difference > 0.01) {
      if (totalAmountEntity) {
        errors[totalAmountEntity.id] = `Total amount (${totalAmount.toFixed(2)}) does not match Net Amount (${netAmount.toFixed(2)}) + Tax Amount (${taxAmount.toFixed(2)}) = ${calculatedTotal.toFixed(2)}`;
      }
      if (taxAmountEntity) {
        errors[taxAmountEntity.id] = `Tax amount (${taxAmount.toFixed(2)}) does not match Total Amount (${totalAmount.toFixed(2)}) - Net Amount (${netAmount.toFixed(2)}) = ${(totalAmount - netAmount).toFixed(2)}`;
      }
      if (netAmountEntity) {
        errors[netAmountEntity.id] = `Net amount (${netAmount.toFixed(2)}) does not match Total Amount (${totalAmount.toFixed(2)}) - Tax Amount (${taxAmount.toFixed(2)}) = ${(totalAmount - taxAmount).toFixed(2)}`;
      }
    }
    
    return errors;
  };

  // Function to check for duplicate invoices
  const checkForDuplicateInvoice = async (invoiceNumber, supplierName, invoiceDate) => {
    try {
      console.log('Checking for duplicate invoice:', { invoiceNumber, supplierName, invoiceDate });
      
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, supplier_name, invoice_date')
        .eq('invoice_number', invoiceNumber)
        .eq('supplier_name', supplierName)
        .eq('invoice_date', invoiceDate);
      
      if (error) {
        console.error('Error checking for duplicate invoice:', error);
        return null;
      }
      
      console.log('Duplicate check results:', data);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Exception checking for duplicate invoice:', error);
      return null;
    }
  };

  // Function to check for duplicate invoice when document is processed
  const checkForDuplicateOnProcess = async (organizedByPage) => {
    try {
      // Find the invoice information
      const invoiceInfo = organizedByPage[1]?.invoice.find(e => e.type === 'invoice_id') || {};
      const invoiceDate = organizedByPage[1]?.invoice.find(e => e.type === 'invoice_date') || {};
      
      // Get supplier name
      const supplierName = organizedByPage[1]?.supplier.find(e => e.type === 'supplier_name')?.mentionText || '';
      
      // Get invoice number
      const invoiceNumber = invoiceInfo.mentionText || '';
      
      // Format the invoice date
      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        
        // Remove any extra spaces
        dateStr = dateStr.trim();
        
        // Handle different date formats
        let day, month, year;
        if (dateStr.includes('/')) {
          // Assume MM/DD/YY format for US dates
          [month, day, year] = dateStr.split('/');
        } else if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          // Check if the first part is a year (4 digits)
          if (parts[0].length === 4) {
            // Format is YYYY-MM-DD
            [year, month, day] = parts;
          } else {
            // Format is DD-MM-YYYY
            [day, month, year] = parts;
          }
        } else {
          return null;
        }

        // Ensure we have valid numbers
        day = parseInt(day, 10);
        month = parseInt(month, 10);
        year = parseInt(year, 10);

        // Validate the date
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          return null;
        }

        // Validate date ranges
        if (month < 1 || month > 12) {
          return null;
        }
        if (day < 1 || day > 31) {
          return null;
        }
        
        // Handle 2-digit years
        if (year < 100) {
          year += 2000; // Assume 20xx for 2-digit years
        }
        
        if (year < 1900 || year > 2100) {
          return null;
        }

        // Format for PostgreSQL (YYYY-MM-DD)
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      };

      const formattedInvoiceDate = formatDate(invoiceDate.mentionText);
      
      // Only check if we have all required fields
      if (invoiceNumber && supplierName && formattedInvoiceDate) {
        const duplicateInvoice = await checkForDuplicateInvoice(
          invoiceNumber, 
          supplierName, 
          formattedInvoiceDate
        );
        
        if (duplicateInvoice) {
          console.log('Duplicate invoice found during processing:', duplicateInvoice);
          setDuplicateWarning({
            message: `Warning: This invoice appears to be a duplicate. Invoice #${duplicateInvoice.invoice_number} from ${duplicateInvoice.supplier_name} on ${duplicateInvoice.invoice_date} already exists in the database. You can edit the fields if you believe this is incorrect.`,
            invoice: duplicateInvoice
          });
        } else {
          setDuplicateWarning(null);
        }
      }
    } catch (error) {
      console.error('Error checking for duplicate during processing:', error);
    }
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

  // Function to handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Get all entities organized by page
      const organizedByPage = organizeEntities(results.entities);
      
      // Calculate aggregate confidence score
      const aggregateConfidence = calculateAggregateConfidence(organizedByPage);
      
      // Validate totals before submitting
      const errors = validateTotals(organizedByPage);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setSubmitError('Please fix the validation errors before submitting.');
        setIsSubmitting(false);
        return;
      }
      
      // Find the invoice information
      const invoiceInfo = organizedByPage[1]?.invoice.find(e => e.type === 'invoice_id') || {};
      const invoiceDate = organizedByPage[1]?.invoice.find(e => e.type === 'invoice_date') || {};
      const dueDate = organizedByPage[1]?.invoice.find(e => e.type === 'due_date') || {};
      
      // Convert date strings to ISO format
      const formatDate = (dateStr) => {
        if (!dateStr) {
          console.log('No date string provided');
          return null;
        }
        
        // Remove any extra spaces
        dateStr = dateStr.trim();
        console.log('Processing date string:', dateStr);
        
        // Handle different date formats
        let day, month, year;
        if (dateStr.includes('/')) {
          // Assume MM/DD/YY format for US dates
          [month, day, year] = dateStr.split('/');
        } else if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          // Check if the first part is a year (4 digits)
          if (parts[0].length === 4) {
            // Format is YYYY-MM-DD
            [year, month, day] = parts;
          } else {
            // Format is DD-MM-YYYY
            [day, month, year] = parts;
          }
        } else {
          console.error('Unsupported date format:', dateStr);
          return null;
        }

        console.log('Split date components:', { day, month, year });

        // Ensure we have valid numbers
        day = parseInt(day, 10);
        month = parseInt(month, 10);
        year = parseInt(year, 10);

        console.log('Parsed date components:', { day, month, year });

        // Validate the date
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          console.error('Invalid date components:', { day, month, year });
          return null;
        }

        // Validate date ranges
        if (month < 1 || month > 12) {
          console.error('Invalid month:', month);
          return null;
        }
        if (day < 1 || day > 31) {
          console.error('Invalid day:', day);
          return null;
        }
        
        // Handle 2-digit years
        if (year < 100) {
          year += 2000; // Assume 20xx for 2-digit years
        }
        
        if (year < 1900 || year > 2100) {
          console.error('Invalid year:', year);
          return null;
        }

        // Format for PostgreSQL (YYYY-MM-DD)
        const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log('Formatted date for PostgreSQL:', formattedDate);
        return formattedDate;
      };

      // Create invoice record
      const invoiceDateStr = editedValues[invoiceDate.id] || invoiceDate.mentionText;
      const dueDateStr = editedValues[dueDate.id] || dueDate.mentionText;
      
      console.log('Raw invoice date:', invoiceDateStr);
      console.log('Raw due date:', dueDateStr);
      console.log('Invoice date entity:', invoiceDate);
      console.log('Edited values:', editedValues);

      const formattedInvoiceDate = formatDate(invoiceDateStr);
      const formattedDueDate = formatDate(dueDateStr);

      console.log('Formatted invoice date:', formattedInvoiceDate);
      console.log('Formatted due date:', formattedDueDate);

      // Get supplier name
      const supplierName = editedValues[organizedByPage[1]?.supplier.find(e => e.type === 'supplier_name')?.id] || 
                          organizedByPage[1]?.supplier.find(e => e.type === 'supplier_name')?.mentionText;
      
      // Get invoice number
      const invoiceNumber = editedValues[invoiceInfo.id] || invoiceInfo.mentionText;
      
      // Check for duplicate invoice
      const duplicateInvoice = await checkForDuplicateInvoice(
        invoiceNumber, 
        supplierName, 
        formattedInvoiceDate
      );
      
      if (duplicateInvoice) {
        console.log('Duplicate invoice found:', duplicateInvoice);
        setSubmitError(`This invoice has already been submitted. Invoice #${duplicateInvoice.invoice_number} from ${duplicateInvoice.supplier_name} on ${duplicateInvoice.invoice_date} already exists in the database.`);
        setIsSubmitting(false);
        return;
      }

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
      
      console.log('Total amount entity (after search):', totalAmountEntity);
      console.log('Tax amount entity (after search):', taxAmountEntity);
      console.log('Net amount entity (after search):', netAmountEntity);
      
      console.log('Total amount from edited values:', editedValues[totalAmountEntity?.id]);
      console.log('Tax amount from edited values:', editedValues[taxAmountEntity?.id]);
      console.log('Net amount from edited values:', editedValues[netAmountEntity?.id]);
      
      // Log the actual values being submitted
      console.log('Submitting total_amount:', parseAmount(editedValues[totalAmountEntity?.id] || totalAmountEntity?.mentionText));
      console.log('Submitting tax_amount:', parseAmount(editedValues[taxAmountEntity?.id] || taxAmountEntity?.mentionText));
      console.log('Submitting net_amount:', parseAmount(editedValues[netAmountEntity?.id] || netAmountEntity?.mentionText));
      console.log('Submitting confidence_score:', aggregateConfidence);

      // Prepare the invoice data
      const invoiceData = {
        invoice_number: invoiceNumber,
        invoice_date: formattedInvoiceDate,
        due_date: formattedDueDate,
        supplier_name: supplierName,
        supplier_address: editedValues[organizedByPage[1]?.supplier.find(e => e.type === 'supplier_address')?.id] || 
                        organizedByPage[1]?.supplier.find(e => e.type === 'supplier_address')?.mentionText,
        receiver_name: editedValues[organizedByPage[1]?.receiver.find(e => e.type === 'receiver_name')?.id] || 
                     organizedByPage[1]?.receiver.find(e => e.type === 'receiver_name')?.mentionText,
        receiver_address: editedValues[organizedByPage[1]?.receiver.find(e => e.type === 'receiver_address')?.id] || 
                        organizedByPage[1]?.receiver.find(e => e.type === 'receiver_address')?.mentionText,
        total_amount: parseAmount(editedValues[totalAmountEntity?.id] || totalAmountEntity?.mentionText),
        tax_amount: parseAmount(editedValues[taxAmountEntity?.id] || taxAmountEntity?.mentionText),
        net_amount: parseAmount(editedValues[netAmountEntity?.id] || netAmountEntity?.mentionText),
        confidence_score: aggregateConfidence,
        status: 'reviewed',
        document_url: results.storagePath,
        sync_status: 'not_synced',
        processed_at: new Date().toISOString()
      };
      
      console.log('Submitting invoice data:', invoiceData);

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) {
        console.error('Supabase error details:', invoiceError);
        throw new Error(`Supabase error: ${invoiceError.message}. Code: ${invoiceError.code}. Details: ${JSON.stringify(invoiceError.details)}`);
      }

      // Insert line items - collect from all pages
      const allLineItems = [];
      allPages.forEach(pageNum => {
        const pageLineItems = organizedByPage[pageNum]?.lineItems || [];
        console.log(`Line items on page ${pageNum}:`, pageLineItems.length);
        allLineItems.push(...pageLineItems);
      });
      
      console.log('Total line items across all pages:', allLineItems.length);
      
      const lineItemsToInsert = allLineItems.map(item => ({
        invoice_id: invoice.id,
        description: editedValues[`${item.id}_description`] || item.properties.description?.text || '',
        quantity: parseAmount(editedValues[`${item.id}_quantity`] || item.properties.quantity?.text || '0'),
        unit_price: parseAmount(editedValues[`${item.id}_unit_price`] || item.properties.unit_price?.text || '0'),
        amount: parseAmount(editedValues[`${item.id}_amount`] || item.properties.amount?.text || '0')
      }));

      const { error: lineItemsError } = await supabase
        .from('line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) {
        console.error('Line items error details:', lineItemsError);
        throw new Error(`Line items error: ${lineItemsError.message}. Code: ${lineItemsError.code}. Details: ${JSON.stringify(lineItemsError.details)}`);
      }

      // Clear validation errors on successful submission
      setValidationErrors({});
      setSubmitSuccess(true);
      
      // Reset the form after 3 seconds
      setTimeout(() => {
        resetForm();
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting to Supabase:', error);
      setSubmitError(error.message || 'An unknown error occurred while submitting the invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to reset the form
  const resetForm = () => {
    setFiles([]);
    setResults(null);
    setError(null);
    setValidationErrors({});
    setEditedValues({});
    setSubmitError(null);
    setSubmitSuccess(false);
    setDuplicateWarning(null);
    // Reset PDF viewer state
    setPdfDocument(null);
    setNumPages(null);
    setCurrentPage(1);
    setHighlightedEntity(null);
    setSelectedEntity(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                CLARK
              </h1>
              <p className="ml-4 text-lg text-gray-600">
                Intelligent Document Processing
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                title="Home"
              >
                🏠 Home
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                title="Settings"
              >
                ⚙️ Settings
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 p-6">
          {/* Upload area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}`}
          >
            <input {...getInputProps()} />
            <div className="space-y-3">
              <div className="flex justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
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
                <p className="text-base font-medium">
                  {isDragActive
                    ? 'Drop the file here...'
                    : 'Drag and drop your invoice here, or click to select file'}
                </p>
                <p className="text-sm mt-1">
                  Supported formats: PDF, PNG, JPG, JPEG
                </p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">Processing invoice...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Duplicate Invoice Detected</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{duplicateWarning.message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="flex gap-6">
              {/* Document Viewer */}
              <div className="flex-1">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-medium text-gray-900">Document Viewer</h3>
                    </div>
                    <div className="flex gap-2">
                      {highlightedEntity && (
                        <button
                          onClick={() => setHighlightedEntity(null)}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          Clear Highlight
                        </button>
                      )}
                      <button
                        onClick={() => setShowRawText(!showRawText)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        {showRawText ? 'Hide Raw Text' : 'Show Raw Text'}
                      </button>
                    </div>
                  </div>
                  {showRawText ? (
                    <pre className="whitespace-pre-wrap text-sm text-gray-600">
                      {JSON.stringify(results, null, 2)}
                    </pre>
                  ) : (
                    <div className="relative h-[800px] overflow-auto" ref={pdfViewerRef}>
                      <div className="relative">
                        <canvas ref={canvasRef} className="mx-auto" />
                        {renderHighlights()}
                      </div>
                      <div className="flex justify-center items-center mt-4 space-x-4">
                        <button
                          onClick={() => handlePageChange(-1)}
                          disabled={currentPage <= 1}
                          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                        >
                          Previous
                        </button>
                        <span className="text-gray-700">
                          Page {currentPage} of {numPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage >= numPages}
                          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Fields Side Panel */}
              <div className="w-96">
                <div className="bg-white rounded-lg border border-gray-200 h-[800px] flex flex-col">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">
                      Extracted Fields - Page {currentPage}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {(() => {
                      const organizedByPage = organizeEntities(results.entities);
                      const currentPageEntities = organizedByPage[currentPage] || {
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
                          
                          {/* Submit Button - Only show on last page */}
                          {currentPage === numPages && (
                            <div className="mt-6">
                              {submitError && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                                  {submitError}
                                </div>
                              )}
                              {submitSuccess && (
                                <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md text-sm">
                                  Invoice successfully submitted!
                                </div>
                              )}
                              <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`w-full py-2 px-4 rounded-md transition-colors ${
                                  duplicateWarning 
                                    ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                }`}
                              >
                                {isSubmitting ? 'Submitting...' : duplicateWarning ? 'Submit Anyway (Check for Duplicates)' : 'Submit Invoice'}
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FileUpload; 