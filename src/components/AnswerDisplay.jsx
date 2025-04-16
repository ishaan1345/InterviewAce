import React, { useState } from 'react';
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline';
import Button from './Button'; // Assuming Button component exists

function AnswerDisplay({ answer, jobTitle, jobCompany, onAskAnother }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (answer) {
      navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-primary-200 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-50 px-6 py-4 border-b border-primary-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-primary-800">Your Interview Answer</h3>
        <Button 
          variant="secondary"
          onClick={copyToClipboard}
          icon={copied ? CheckIcon : DocumentDuplicateIcon}
          className="bg-primary-100 text-primary-700 border-primary-200 hover:bg-primary-200"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      
      {/* Body */}
      <div className="px-6 py-5">
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
          {answer}
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="text-xs text-gray-500">
          {jobTitle && jobCompany && (
            <span className="inline-flex items-center">
              <span className="font-medium text-gray-600 mr-1.5">For:</span>
              {jobTitle} at {jobCompany}
            </span>
          )}
        </div>
        <Button variant="text" onClick={onAskAnother} className="text-xs px-2 py-1">
          Ask another question
        </Button>
      </div>
    </div>
  );
}

export default AnswerDisplay; 