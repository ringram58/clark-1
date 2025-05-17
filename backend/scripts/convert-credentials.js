const fs = require('fs');
const path = require('path');

// Path to your service account JSON file
const credentialsPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || './authentic-codex-455217-s7-de793150f65d.json');

try {
  // Read the JSON file
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  // Create the .env content
  const envContent = `# Google Cloud Credentials
GOOGLE_CLOUD_PROJECT_ID=${credentials.project_id}
GOOGLE_CLOUD_PRIVATE_KEY="${credentials.private_key}"
GOOGLE_CLOUD_CLIENT_EMAIL=${credentials.client_email}

# Other Google Cloud Settings
# To find your location:
# 1. Go to Google Cloud Console (https://console.cloud.google.com)
# 2. Navigate to Document AI
# 3. Click on "Processors" in the left sidebar
# 4. Find your processor in the list
# 5. The location will be shown in the "Location" column
# Common locations: us, eu, asia
GOOGLE_CLOUD_LOCATION=us

# To find your processor ID:
# 1. Go to Google Cloud Console
# 2. Navigate to Document AI > Processors
# 3. Click on your processor
# 4. The processor ID is in the URL or details page
DOCUMENT_AI_PROCESSOR_ID=your-processor-id

# To find your bucket name:
# 1. Go to Google Cloud Console
# 2. Navigate to Cloud Storage
# 3. Find your bucket in the list
GOOGLE_CLOUD_BUCKET_NAME=your-bucket-name
`;

  // Write to .env file
  fs.writeFileSync(path.join(__dirname, '../.env'), envContent);
  console.log('Successfully created .env file with credentials!');
  console.log('\nPlease update the following values in the .env file:');
  console.log('\n1. GOOGLE_CLOUD_LOCATION:');
  console.log('   - Go to Google Cloud Console > Document AI > Processors');
  console.log('   - Find your processor and check the "Location" column');
  console.log('   - Common values: us, eu, asia');
  
  console.log('\n2. DOCUMENT_AI_PROCESSOR_ID:');
  console.log('   - Go to Google Cloud Console > Document AI > Processors');
  console.log('   - Click on your processor');
  console.log('   - The ID is in the URL or details page');
  
  console.log('\n3. GOOGLE_CLOUD_BUCKET_NAME:');
  console.log('   - Go to Google Cloud Console > Cloud Storage');
  console.log('   - Find your bucket in the list');

} catch (error) {
  console.error('Error converting credentials:', error.message);
  process.exit(1);
} 