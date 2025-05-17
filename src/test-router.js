import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

function TestComponent() {
  const navigate = useNavigate();
  return <div>Test Component</div>;
}

export default function TestRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TestComponent />} />
      </Routes>
    </BrowserRouter>
  );
} 