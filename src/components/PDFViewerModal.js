import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PDFViewerModal = ({ documentUrl, onClose }) => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const canvasRef = useRef(null);

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
      setCurrentPage(1);
      
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
      setCurrentPage(pageNumber);
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  // Function to handle page navigation
  const handlePageChange = (delta) => {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= numPages) {
      renderPage(newPage);
    }
  };

  // Load PDF when component mounts or URL changes
  useEffect(() => {
    if (documentUrl) {
      loadPDF(documentUrl);
    }
  }, [documentUrl]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Document Viewer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="relative">
            <canvas ref={canvasRef} className="mx-auto" />
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
      </div>
    </div>
  );
};

export default PDFViewerModal; 