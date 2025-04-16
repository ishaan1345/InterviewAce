import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Setup the worker for PDF.js
const workerScript = `
importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');
`;
const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

function ResumeUpload({ setResumeText }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setProgress(0);
    setError('');
    
    try {
      let text = '';
      
      // Check file type
      if (file.type === 'application/pdf') {
        // Handle PDF files
        const arrayBuffer = await readFileAsArrayBuffer(file, updateProgress);
        text = await extractTextFromPDF(arrayBuffer);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        // Handle text files
        text = await readFileAsText(file, updateProgress);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        // For Word docs, we'd need a separate library
        setError('Word documents (.docx) are not supported yet. Please upload a PDF or text file.');
        setLoading(false);
        return;
      } else {
        setError(`Unsupported file type: ${file.type}. Please upload a PDF or text file.`);
        setLoading(false);
        return;
      }
      
      setResumeText(text);
    } catch (err) {
      console.error('Error reading file:', err);
      setError(`Error reading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const readFileAsArrayBuffer = (file, progressCallback) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          progressCallback(progress);
        }
      };
      
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Error reading file'));
      
      reader.readAsArrayBuffer(file);
    });
  };
  
  const readFileAsText = (file, progressCallback) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          progressCallback(progress);
        }
      };
      
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Error reading file'));
      
      reader.readAsText(file);
    });
  };
  
  const extractTextFromPDF = async (arrayBuffer) => {
    try {
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let extractedText = '';
      
      // Get total pages for progress calculation
      const totalPages = pdf.numPages;
      
      // Extract text from each page
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n';
        
        // Update progress based on current page
        updateProgress(Math.round((i / totalPages) * 100));
      }
      
      return extractedText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };
  
  const updateProgress = (value) => {
    setProgress(value);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2">Upload resume (.pdf, .txt)</label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.txt,.docx"
          className="w-full p-2 border rounded"
        />
      </div>
      
      {loading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${progress}%` }}
          ></div>
          <p className="text-sm text-gray-500 mt-1">Processing: {progress}%</p>
        </div>
      )}
      
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div>
        <label className="block mb-2">Or paste your resume text</label>
        <textarea
          onChange={(e) => setResumeText(e.target.value)}
          className="w-full p-2 border rounded h-40"
          placeholder="Paste your resume text here..."
        ></textarea>
      </div>
    </div>
  );
}

export default ResumeUpload;
