require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { Storage } = require('@google-cloud/storage');
const { Readable } = require('stream');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Log environment variables (excluding sensitive data)
console.log('Environment check:');
console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('Location:', process.env.GOOGLE_CLOUD_LOCATION);
console.log('Processor ID:', process.env.DOCUMENT_AI_PROCESSOR_ID);
console.log('Bucket Name:', process.env.GOOGLE_CLOUD_BUCKET_NAME);

// Update CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Initialize Google Cloud clients with explicit configuration
const documentProcessorClient = new DocumentProcessorServiceClient({
  apiEndpoint: 'us-documentai.googleapis.com',
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
  },
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
  },
  autoRetry: true,
  maxRetries: 3
});

// Your Google Cloud project details
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

// Helper function to sanitize filename
function sanitizeFilename(filename) {
  // Remove special characters and spaces, keep only alphanumeric, dots, and hyphens
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Helper function to generate unique filename
function generateUniqueFilename(originalFilename) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedOriginalName = sanitizeFilename(originalFilename);
  return `${timestamp}_${sanitizedOriginalName}`;
}

// Helper function to upload file to GCS
async function uploadToGCS(file, filename) {
  return new Promise((resolve, reject) => {
    const bucket = storage.bucket(bucketName);
    const documentsFolder = 'documents/';
    const fullPath = documentsFolder + filename;
    const blob = bucket.file(fullPath);
    const stream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype
      }
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      reject(error);
    });

    stream.on('finish', () => {
      console.log('Upload completed to documents folder:', fullPath);
      resolve(fullPath);
    });

    // Create a readable stream from the buffer
    const readable = new Readable();
    readable.push(file.buffer);
    readable.push(null);

    // Pipe the readable stream to the write stream
    readable.pipe(stream);
  });
}

// Helper function to upload JSON response to GCS
async function uploadJSONResponse(jsonData, filename) {
  return new Promise((resolve, reject) => {
    const bucket = storage.bucket(bucketName);
    const aiResponsesFolder = 'ai-responses/';
    // Replace the file extension with .json
    const jsonFilename = filename.replace(/\.[^/.]+$/, '.json');
    const fullPath = aiResponsesFolder + jsonFilename;
    const blob = bucket.file(fullPath);
    
    // Convert JSON to string
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    const stream = blob.createWriteStream({
      metadata: {
        contentType: 'application/json'
      }
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      reject(error);
    });

    stream.on('finish', () => {
      console.log('JSON response uploaded to ai-responses folder:', fullPath);
      resolve(fullPath);
    });

    // Create a readable stream from the JSON string
    const readable = new Readable();
    readable.push(jsonString);
    readable.push(null);

    // Pipe the readable stream to the write stream
    readable.pipe(stream);
  });
}

// Endpoint to process uploaded files
app.post('/api/process-invoice', upload.single('file'), async (req, res) => {
  try {
    console.log('Received file upload request');
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname);

    // Generate unique filename and full path
    const uniqueFilename = generateUniqueFilename(req.file.originalname);
    const documentsFolder = 'documents/';
    const fullPath = documentsFolder + uniqueFilename;

    // Upload file to Google Cloud Storage
    console.log('About to upload file to GCS bucket:', bucketName);
    const uploadedPath = await uploadToGCS(req.file, uniqueFilename);
    console.log('File uploaded to GCS successfully at path:', uploadedPath);

    // Get the full path of the processor
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log('Using processor:', name);

    // Read the file into memory
    console.log('About to download file from GCS');
    const bucket = storage.bucket(bucketName);
    const [file] = await bucket.file(uploadedPath).download();
    console.log('File downloaded from GCS successfully');

    // Configure the process request
    const request = {
      name,
      rawDocument: {
        content: file.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    // Process the document
    console.log('Sending to Document AI');
    const [result] = await documentProcessorClient.processDocument(request);
    const { document } = result;
    console.log('Document processed successfully');

    // Prepare the response data
    const responseData = {
      text: document.text,
      entities: document.entities,
      confidence: document.confidence,
      storagePath: `gs://${bucketName}/${uploadedPath}`
    };

    // Upload the Document AI response to GCS
    console.log('About to upload Document AI response to GCS');
    const aiResponsePath = await uploadJSONResponse(responseData, uniqueFilename);
    console.log('Document AI response uploaded successfully at path:', aiResponsePath);

    // Add the AI response path to the response
    responseData.aiResponsePath = `gs://${bucketName}/${aiResponsePath}`;

    // Send the processed results back to the client
    res.json(responseData);
  } catch (error) {
    console.error('Error processing document:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details
    });
    res.status(500).json({ 
      error: error.message,
      details: error.details || 'No additional details available'
    });
  }
});

// Add this new endpoint to serve files
app.get('/api/file/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log('Attempting to serve file:', filename);
    
    const bucket = storage.bucket(bucketName);
    // Look for files in the 'documents' folder with the new naming convention
    const documentsFolder = 'documents/';
    const fullPath = documentsFolder + filename;
    const file = bucket.file(fullPath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('File not found:', fullPath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    console.log('File metadata:', metadata);
    
    // Set appropriate content type
    res.setHeader('Content-Type', metadata.contentType);
    
    // For PDFs, set Content-Disposition to inline
    if (metadata.contentType === 'application/pdf') {
      res.setHeader('Content-Disposition', 'inline');
    }
    
    // Create read stream and pipe to response
    const stream = file.createReadStream();
    stream.pipe(res);

    // Handle errors
    stream.on('error', (error) => {
      console.error('Error streaming file:', error);
      res.status(500).json({ error: 'Error streaming file' });
    });

    // Handle successful completion
    stream.on('end', () => {
      console.log('File stream completed successfully');
    });
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Error serving file' });
  }
});

// Add this new endpoint to serve AI response files
app.get('/api/ai-responses/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log('Attempting to serve AI response file:', filename);
    
    const bucket = storage.bucket(bucketName);
    const aiResponsesFolder = 'ai-responses/';
    const fullPath = aiResponsesFolder + filename;
    const file = bucket.file(fullPath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('AI response file not found:', fullPath);
      return res.status(404).json({ error: 'AI response file not found' });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    console.log('AI response file metadata:', metadata);
    
    // Set appropriate content type
    res.setHeader('Content-Type', 'application/json');
    
    // Create read stream and pipe to response
    const stream = file.createReadStream();
    stream.pipe(res);

    // Handle errors
    stream.on('error', (error) => {
      console.error('Error streaming AI response file:', error);
      res.status(500).json({ error: 'Error streaming AI response file' });
    });

    // Handle successful completion
    stream.on('end', () => {
      console.log('AI response file stream completed successfully');
    });
  } catch (error) {
    console.error('Error serving AI response file:', error);
    res.status(500).json({ error: 'Error serving AI response file' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('CORS enabled for http://localhost:3000');
}); 