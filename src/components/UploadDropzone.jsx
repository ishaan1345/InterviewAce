import React, { useRef } from 'react';
import { DocumentTextIcon, CheckIcon } from '@heroicons/react/24/outline';

function UploadDropzone({ 
  resumeText, 
  fileName, 
  uploadProgress, 
  onFileChange, 
  onClearResume 
}) {
  const fileInputRef = useRef(null);

  const handleDropzoneClick = () => {
    fileInputRef.current.click();
  };

  // Define base styles and state-specific styles
  const baseDropzoneStyles = "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-150";
  const idleStyles = "border-gray-300 text-gray-500 hover:border-primary-400 hover:bg-primary-50";
  const successStyles = "border-green-300 bg-green-50 text-green-700";

  return (
    <div>
      <div
        className={`${baseDropzoneStyles} ${
          resumeText ? successStyles : idleStyles
        }`}
        onClick={handleDropzoneClick}
      >
        {resumeText ? (
          // Success State
          <div className="flex flex-col items-center">
            <CheckIcon className="h-10 w-10 text-green-500 mb-3" />
            <p className="font-medium">Resume uploaded successfully!</p>
            <p className="text-sm text-gray-600 mt-1">{fileName}</p>
          </div>
        ) : (
          // Idle State
          <div className="flex flex-col items-center">
            <DocumentTextIcon className="h-10 w-10 text-gray-400 mb-3" />
            <p className="font-medium text-gray-700">Click to upload your resume</p>
            <p className="text-sm text-gray-500 mt-1">PDF or TXT files only</p>
          </div>
        )}

        {/* Progress Bar (shown only during upload) */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="w-full max-w-xs mx-auto mt-4">
            <div className="bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-primary-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{uploadProgress}% processed</p>
          </div>
        )}

        {/* Hidden File Input */}
        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt"
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}

export default UploadDropzone; 