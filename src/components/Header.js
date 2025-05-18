import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow">
      <div className="px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              CLARK
            </button>
            <p className="ml-2 text-lg text-gray-600">
              Intelligent Document Processing
            </p>
          </div>
          <div className="flex items-center">
            <div className="relative group">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer">
                RI
              </div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 px-3 hidden group-hover:block z-10">
                <div className="text-sm font-medium text-gray-900">Robert Ingram</div>
                <div className="text-xs text-gray-500">Supply Chain Department</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 