# CLARK - Intelligent Document Processing System

CLARK is an intelligent document processing system that uses Google Cloud Document AI to extract and process information from invoices and other documents.

## Features

- Document upload and processing
- Batch document processing
- Intelligent data extraction
- Document review and verification
- Analytics dashboard
- Export functionality

## Tech Stack

- Frontend: React.js with Tailwind CSS
- Backend: Node.js with Express
- Database: Supabase
- Document Processing: Google Cloud Document AI
- Storage: Google Cloud Storage

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Cloud account with Document AI enabled
- Supabase account
- Environment variables configured

## Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Create a `.env` file in the backend directory:

```env
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_LOCATION=your_location
DOCUMENT_AI_PROCESSOR_ID=your_processor_id
GOOGLE_CLOUD_BUCKET_NAME=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=path_to_your_credentials.json
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/clark.git
cd clark
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
```

4. Start the development servers:

Frontend (in the root directory):
```bash
npm start
```

Backend (in the backend directory):
```bash
npm start
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Upload documents through the interface
3. Review and verify extracted information
4. Export processed data as needed

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google Cloud Document AI
- Supabase
- React.js community
- Tailwind CSS
