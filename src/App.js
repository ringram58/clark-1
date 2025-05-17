import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import FileUpload from './components/FileUpload';
import BatchUpload from './components/BatchUpload';
import Review from './components/Review';
import History from './components/History';
import Analytics from './components/Analytics';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<FileUpload />} />
        <Route path="/batch-upload" element={<BatchUpload />} />
        <Route path="/review" element={<Review />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<div className="p-8 text-center">Settings page coming soon</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
