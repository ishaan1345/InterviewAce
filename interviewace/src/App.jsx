import React, { useState, useRef, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  MicrophoneIcon, 
  ArrowPathIcon, 
  XMarkIcon, 
  PaperAirplaneIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import * as pdfjsLib from 'pdfjs-dist';

// Fix the version mismatch - update worker to version 3.11.174 to match the API version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function App() {
  // State variables
  const [resumeText, setResumeText] = useState(() => {
    // Check if we should load from localStorage or start fresh
    const savedResume = localStorage.getItem('resumeText');
    return savedResume || '';
  });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState(() => localStorage.getItem('fileName') || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobTitle, setJobTitle] = useState(() => localStorage.getItem('jobTitle') || '');
  const [jobCompany, setJobCompany] = useState(() => localStorage.getItem('jobCompany') || '');
  const [jobDescription, setJobDescription] = useState(() => localStorage.getItem('jobDescription') || '');
  const [jobResponsibilities, setJobResponsibilities] = useState(() => localStorage.getItem('jobResponsibilities') || '');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recentAnswers, setRecentAnswers] = useState(() => {
    const saved = localStorage.getItem('recentAnswers');
    return saved ? JSON.parse(saved) : [];
  });
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [manualInputMode, setManualInputMode] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const answerRef = useRef(null);

  // Function to clear saved resume and job data
  const clearSavedData = () => {
    // Clear localStorage
    localStorage.removeItem('resumeText');
    localStorage.removeItem('fileName');
    localStorage.removeItem('jobTitle');
    localStorage.removeItem('jobCompany');
    localStorage.removeItem('jobDescription');
    localStorage.removeItem('jobResponsibilities');
    
    // Reset state
    setResumeText('');
    setFileName('');
    setJobTitle('');
    setJobCompany('');
    setJobDescription('');
    setJobResponsibilities('');
  };

  // Save to localStorage whenever these values change
  useEffect(() => {
    localStorage.setItem('resumeText', resumeText);
    localStorage.setItem('fileName', fileName);
    localStorage.setItem('jobTitle', jobTitle);
    localStorage.setItem('jobCompany', jobCompany);
    localStorage.setItem('jobDescription', jobDescription);
    localStorage.setItem('jobResponsibilities', jobResponsibilities);
  }, [resumeText, fileName, jobTitle, jobCompany, jobDescription, jobResponsibilities]);

  // Auto-scroll to the answer when generated
  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [answer]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setUploadProgress(0);
    
    // Check if file is a PDF or text file
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const text = await extractTextFromPDF(arrayBuffer);
        setResumeText(text);
      } catch (error) {
        console.error('Error extracting text from PDF:', error);
        // Display the specific error message from the extractTextFromPDF function
        alert(error.message || 'Error extracting text from PDF. Please try again.');
        
        // Clear file name since upload failed
        setFileName('');
      }
    } else if (file.type === 'text/plain') {
      try {
        const text = await readFileAsText(file);
        setResumeText(text);
      } catch (error) {
        console.error('Error reading text file:', error);
        alert('Error reading text file. Please try again.');
        setFileName('');
      }
    } else {
      alert('Please upload a PDF or text file.');
      setFileName('');
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };
      
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };
      
      reader.readAsText(file);
    });
  };

  const extractTextFromPDF = async (arrayBuffer) => {
    try {
      console.log("Starting PDF extraction with buffer size:", arrayBuffer.byteLength);
      
      // Basic PDF.js setup with minimal options - Fix cMapUrl to match worker version
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        // Update cMapUrl to match worker version 3.11.174
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        // Add standardFontDataUrl for consistent font handling
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
      });
      
      console.log("PDF loading task created");
      const pdf = await loadingTask.promise;
      console.log("PDF loaded successfully with", pdf.numPages, "pages");
      
      let extractedText = '';
      
      // Simple extraction approach
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i} of ${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + ' ';
        
        // Update progress
        setUploadProgress(Math.round((i / pdf.numPages) * 100));
        console.log(`Page ${i} processed, progress: ${Math.round((i / pdf.numPages) * 100)}%`);
      }
      
      console.log("PDF extraction completed, extracted text length:", extractedText.length);
      return extractedText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      // More detailed error logging
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      throw new Error('Could not extract text from PDF. Try a different PDF or paste your resume text manually.');
    }
  };

  const generateAnswer = async () => {
    if (!resumeText) {
      alert('Please upload a resume first.');
      return;
    }
    
    if (!question) {
      alert('Please enter an interview question.');
      return;
    }
    
    setIsLoading(true);
    setAnswer('');
    
    try {
      // Fix API URL to point to the correct endpoint
      const apiUrl = 'http://localhost:3001/api/generate-answer';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume: resumeText,
          question: question,
          jobTitle: jobTitle,
          jobCompany: jobCompany,
          jobDescription: jobDescription,
          jobResponsibilities: jobResponsibilities
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      setAnswer(data.answer);
      
      // Add to recent answers
      const newAnswer = {
        id: Date.now(),
        question: question,
        answer: data.answer,
        timestamp: new Date().toISOString(),
        jobInfo: {
          title: jobTitle,
          company: jobCompany,
          description: jobDescription,
          responsibilities: jobResponsibilities
        }
      };
      
      const updatedAnswers = [newAnswer, ...recentAnswers.slice(0, 9)];
      setRecentAnswers(updatedAnswers);
      localStorage.setItem('recentAnswers', JSON.stringify(updatedAnswers));
      
    } catch (error) {
      console.error('Error generating answer:', error);
      alert('Error generating answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (!isListening) {
      // Start listening
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          alert('Speech recognition is not supported in this browser.');
          return;
        }
        
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setTranscript('');
        };
        
        recognitionRef.current.onresult = (event) => {
          const currentTranscript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          
          setTranscript(currentTranscript);
          
          // Auto-detect if this is a complete question
          const lastChar = currentTranscript.trim().slice(-1);
          if (lastChar === '?' || lastChar === '.') {
            setQuestion(currentTranscript);
            
            // Auto-submit after a short delay if ends with question mark
            if (lastChar === '?') {
              setTimeout(() => {
                recognitionRef.current.stop();
                generateAnswer();
              }, 1000);
            }
          } else {
            setQuestion(currentTranscript);
          }
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        alert('Could not start speech recognition. Please check your browser permissions.');
      }
    } else {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const copyToClipboard = () => {
    if (answer) {
      navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const clearQuestion = () => {
    setQuestion('');
    setAnswer('');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary-600">InterviewAce</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Resume Upload Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">1. Upload Your Resume</h2>
            <p className="text-gray-500 mb-4">We'll extract your skills and experience to personalize answers.</p>
            
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                resumeText ? 'border-green-200 bg-green-50' : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
              }`}
              onClick={() => fileInputRef.current.click()}
            >
              {resumeText ? (
                <div className="flex flex-col items-center">
                  <CheckIcon className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-green-700 font-medium">Resume uploaded successfully!</p>
                  <p className="text-sm text-gray-500 mt-1">{fileName}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <DocumentTextIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-700 font-medium">Click to upload your resume</p>
                  <p className="text-sm text-gray-500 mt-1">PDF or TXT files only</p>
                </div>
              )}
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full max-w-xs mx-auto mt-4">
                  <div className="bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary-500 h-2 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{uploadProgress}% processed</p>
                </div>
              )}
              
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden"
                accept=".pdf,.txt"
                onChange={handleFileChange}
              />
            </div>
            
            {!resumeText && (
              <div className="mt-4">
                <button 
                  onClick={() => setManualInputMode(!manualInputMode)}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  {manualInputMode ? "Hide manual input" : "Or paste resume text manually"}
                </button>
                
                {manualInputMode && (
                  <div className="mt-2">
                    <textarea 
                      className="w-full bg-white rounded-md border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-3 py-2 text-gray-900 placeholder-gray-400 text-sm"
                      placeholder="Copy and paste your resume text here..."
                      rows={8}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                    {resumeText && (
                      <button 
                        onClick={() => {
                          setManualInputMode(false);
                          setFileName('Manual entry');
                        }}
                        className="mt-2 text-xs text-white bg-green-500 hover:bg-green-600 py-1 px-3 rounded"
                      >
                        Save Resume Text
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {resumeText && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Resume Preview</h3>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        setResumeText('');
                        setFileName('');
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                    <button 
                      onClick={clearSavedData}
                      className="text-xs text-orange-500 hover:text-orange-700"
                    >
                      Clear All Saved Data
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded border border-gray-200 p-4 max-h-60 overflow-y-auto text-sm">
                  <p className="text-gray-600 whitespace-pre-line">{resumeText.substring(0, 300)}...</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Job Information Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">2. Job Information (Optional)</h2>
            <p className="text-gray-500 mb-4">Add details about the job to tailor your answers.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input 
                  id="jobTitle"
                  type="text" 
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full bg-white rounded-md border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-3 py-2 text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="e.g. Software Engineer"
                />
              </div>
              
              <div>
                <label htmlFor="jobCompany" className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input 
                  id="jobCompany"
                  type="text" 
                  value={jobCompany}
                  onChange={(e) => setJobCompany(e.target.value)}
                  className="w-full bg-white rounded-md border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-3 py-2 text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="e.g. Acme Inc."
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Description 
                  <span className="text-gray-400 text-xs ml-1">(optional)</span>
                </label>
                <textarea 
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full bg-white rounded-md border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-3 py-2 text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="Copy and paste the job description here..."
                  rows={4}
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="jobResponsibilities" className="block text-sm font-medium text-gray-700 mb-1">
                  Key Responsibilities 
                  <span className="text-gray-400 text-xs ml-1">(optional)</span>
                </label>
                <textarea 
                  id="jobResponsibilities"
                  value={jobResponsibilities}
                  onChange={(e) => setJobResponsibilities(e.target.value)}
                  className="w-full bg-white rounded-md border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-3 py-2 text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="List the key responsibilities of the role..."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Question Input Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">3. Ask an Interview Question</h2>
              <button 
                className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
                onClick={() => setShowTips(!showTips)}
              >
                <InformationCircleIcon className="h-4 w-4" />
                {showTips ? 'Hide Tips' : 'Show Tips'}
              </button>
            </div>
            
            {showTips && (
              <div className="bg-primary-50 rounded-md p-4 mb-4 text-sm text-primary-800">
                <h3 className="font-medium mb-2">Tips for better answers:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Ask specific questions about your experiences and skills</li>
                  <li>Include the job title in your question for more targeted responses</li>
                  <li>Try questions like "Tell me about a time when..." or "How would you handle..."</li>
                  <li>Use voice input for a more natural conversation flow</li>
                </ul>
              </div>
            )}
            
            <div className="relative mb-4">
              <textarea 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full bg-white rounded-md border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-4 py-3 pr-12 text-gray-900 placeholder-gray-400"
                placeholder="Type your interview question here or use the microphone..."
                rows={3}
              />
              
              <div className="absolute right-2 bottom-2 flex space-x-1">
                {question && (
                  <button
                    onClick={clearQuestion}
                    className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    title="Clear question"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
                
                <button
                  onClick={toggleListening}
                  className={`p-2 rounded-full ${
                    isListening 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
              </div>
              
              {isListening && (
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
                  <div className="bg-red-500 bg-opacity-10 p-3 rounded-full animate-pulse">
                    <div className="bg-red-500 rounded-full h-4 w-4"></div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={generateAnswer}
              disabled={isLoading || !question || !resumeText}
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? (
                <><ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Generating your answer...</>
              ) : (
                <><PaperAirplaneIcon className="h-4 w-4 mr-2" /> Generate Interview Answer</>
              )}
            </button>
            
            {!resumeText && (
              <p className="text-xs text-red-500 mt-2 text-center">Please upload your resume to enable answer generation.</p>
            )}
          </div>
        </div>

        {/* Answer Section */}
        {answer && (
          <div ref={answerRef} className="bg-white rounded-xl shadow-sm overflow-hidden border border-primary-100">
            <div className="bg-primary-50 px-6 py-4 border-b border-primary-100 flex justify-between items-center">
              <h3 className="text-lg font-medium text-primary-900">Your Interview Answer</h3>
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none transition-colors"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-line">
                {answer}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-xs text-gray-500">
                  {jobTitle && jobCompany && (
                    <span className="inline-flex items-center mr-3">
                      <span className="font-medium text-gray-600 mr-1">Position:</span>
                      {jobTitle} at {jobCompany}
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    setQuestion('');
                    setAnswer('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Ask another question
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Answer History</h2>
            
            {recentAnswers.length > 0 ? (
              <div className="space-y-4">
                {recentAnswers.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-medium text-gray-800 text-sm mb-1 truncate" title={item.question}>{item.question}</h3>
                    
                    {item.jobInfo?.title && (
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <span className="font-medium mr-1">For:</span> {item.jobInfo.title}
                      </div>
                    )}
                    
                    <p className="text-gray-600 text-xs line-clamp-2 mb-2">{item.answer}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</span>
                      <button
                        onClick={() => {
                          setQuestion(item.question);
                          setAnswer(item.answer);
                          window.scrollTo({ top: answerRef.current?.offsetTop || 0, behavior: 'smooth' });
                        }}
                        className="text-xs text-primary-600 hover:text-primary-800"
                      >
                        View/Reuse
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <DocumentTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <h3 className="text-base font-medium text-gray-900 mb-1">No history yet</h3>
                <p className="text-sm text-gray-500">Your generated answers will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} InterviewAce — Ace your next interview with confidence
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
