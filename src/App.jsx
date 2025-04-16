import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowPathIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  CheckIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import * as pdfjsLib from 'pdfjs-dist';

// Reusable Components
import Card from './components/Card';
import InputGroup from './components/InputGroup';
import TextAreaGroup from './components/TextAreaGroup';
import Button from './components/Button';
import UploadDropzone from './components/UploadDropzone';
import AnswerDisplay from './components/AnswerDisplay';
import HistoryItem from './components/HistoryItem';

// Import Auth related components and hook
import { useAuth } from './context/AuthContext'; // Correct path
import Login from './Login.jsx';              // Import from src
import Signup from './Signup.jsx';             // Import from src

// Fix the version mismatch - update worker to version 3.11.174 to match the API version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// API URL Configuration
const apiUrl = '/api/generate-answer'; // Use relative path for deployment

function App() {
  const { user, session, signOut } = useAuth(); // Use the auth hook
  // Remove authMode state for now, will re-introduce if using modal
  // const [authMode, setAuthMode] = useState('login'); 

  // State variables
  const [resumeText, setResumeText] = useState(''); // Initialize empty, load later
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobResponsibilities, setJobResponsibilities] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recentAnswers, setRecentAnswers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [manualInputMode, setManualInputMode] = useState(false);
  const [isJobInfoVisible, setIsJobInfoVisible] = useState(true);

  // Refs
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const answerRef = useRef(null);

  // --- Load/Save Data Logic (Placeholder for DB interaction) ---
  // We removed localStorage persistence. Data is now in-memory per session.
  // Will add Supabase loading/saving based on 'user' state later.
  useEffect(() => {
    // Placeholder: If we were loading data for a logged-in user, we'd do it here.
    // Example: if (user) { loadDataFromSupabase(user.id); }
    // For now, data resets on refresh.
    console.log("Current user:", user);
    // Clear potentially stale data if user logs out or logs in
    // You might want more sophisticated state management later
    // clearAllAppData(); // Example function call
  }, [user]);

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

  // Function to handle reuse from history
  const handleReuseHistory = (item) => {
    setQuestion(item.question);
    setAnswer(item.answer);
    // Optionally set job info too if needed
    // setJobTitle(item.jobInfo?.title || '');
    // setJobCompany(item.jobInfo?.company || '');
    // setJobDescription(item.jobInfo?.description || '');
    // setJobResponsibilities(item.jobInfo?.responsibilities || '');
    window.scrollTo({ top: answerRef.current?.offsetTop || 0, behavior: 'smooth' });
  };

  // --- Main App Rendering (Always render) --- 
  // No more conditional rendering based on user
  // if (!user) { return <AuthContainer />; }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary-600">InterviewAce</h1>
            </div>
            <div>
              {user ? (
                // Logged-in state: Show email and Logout button
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
                  <Button onClick={signOut} variant="secondary" size="sm">
                    Logout
                  </Button>
                </div>
              ) : (
                // Logged-out state: Show Login and Signup buttons
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={() => alert('Login functionality to be added.')} 
                    variant="secondary" 
                    size="sm"
                  >
                    Login
                  </Button>
                  <Button 
                    onClick={() => alert('Signup functionality to be added.')} 
                    variant="primary" 
                    size="sm"
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Always Renders */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Left Column (Main Flow) - Takes 2/3 width on large screens */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Resume */}
            <Card title="1. Your Resume">
              <UploadDropzone
                resumeText={resumeText}
                fileName={fileName}
                uploadProgress={uploadProgress}
                onFileChange={handleFileChange}
                onClearResume={() => { setResumeText(''); setFileName(''); }}
              />

              {/* Manual Input Section */} 
              {!resumeText && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Button 
                    variant="text"
                    onClick={() => setManualInputMode(!manualInputMode)}
                    className="text-xs px-0 py-1 h-auto"
                  >
                    {manualInputMode ? "Hide manual input" : "Or paste resume text manually"}
                  </Button>
                  
                  {manualInputMode && (
                    <div className="mt-3">
                      <TextAreaGroup 
                        id="manualResume"
                        label="Paste Resume Text"
                        value={resumeText} // Bind to resumeText state
                        onChange={(e) => setResumeText(e.target.value)}
                        placeholder="Copy and paste your resume text here..."
                        rows={10}
                        required
                      />
                      {resumeText && (
                        <Button 
                          variant="secondary" 
                          onClick={() => {
                            setManualInputMode(false);
                            setFileName('Manual entry');
                          }}
                          className="mt-3 text-xs"
                          icon={CheckIcon}
                        >
                          Use Pasted Text
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Resume Preview & Clear Buttons */}
              {resumeText && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Resume Preview</h3>
                  <div className="bg-gray-50 rounded border border-gray-200 p-3 max-h-40 overflow-y-auto text-xs text-gray-600 whitespace-pre-line mb-3">
                    {resumeText.substring(0, 500)}{resumeText.length > 500 ? '...' : ''}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="danger"
                      onClick={() => { setResumeText(''); setFileName(''); }}
                      className="text-xs"
                    >
                      Clear Resume & Job Data
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Step 2: Job Info (Now Collapsible) */}
            <Card 
              title="2. Job Information (Optional)"
            >
              <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-500">
                    Add details about the job to tailor answers more accurately.
                  </p>
                  <Button 
                    variant="text"
                    onClick={() => setIsJobInfoVisible(!isJobInfoVisible)}
                    className="text-xs px-2 py-1 h-auto flex items-center gap-1 text-gray-500 hover:text-gray-700"
                  >
                    {isJobInfoVisible ? (
                      <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4" />
                    )}
                    {isJobInfoVisible ? 'Collapse' : 'Expand'}
                  </Button>
                </div>

              {/* Collapsible Content */}
              {isJobInfoVisible && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputGroup
                    id="jobTitle"
                    label="Job Title"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Frontend Developer"
                  />
                  <InputGroup
                    id="jobCompany"
                    label="Company"
                    value={jobCompany}
                    onChange={(e) => setJobCompany(e.target.value)}
                    placeholder="e.g. Tech Solutions Inc."
                  />
                  <div className="sm:col-span-2">
                    <TextAreaGroup
                      id="jobDescription"
                      label="Job Description"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Copy and paste the job description here..."
                      rows={5}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <TextAreaGroup
                      id="jobResponsibilities"
                      label="Key Responsibilities"
                      value={jobResponsibilities}
                      onChange={(e) => setJobResponsibilities(e.target.value)}
                      placeholder="List the key responsibilities from the job description..."
                      rows={5}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Step 3: Question & Answer */}
            <Card title="3. Ask an Interview Question">
              <div className="flex justify-end mb-2">
                <Button 
                  variant="text" 
                  className="text-xs px-2 py-1 h-auto flex items-center gap-1"
                  onClick={() => setShowTips(!showTips)}
                >
                  <InformationCircleIcon className="h-4 w-4" />
                  {showTips ? 'Hide Tips' : 'Show Tips'}
                </Button>
              </div>
              
              {showTips && (
                <div className="bg-primary-50 rounded-md p-4 mb-4 text-sm text-primary-800 border border-primary-200">
                  <h3 className="font-medium mb-2 text-primary-900">Tips for better answers:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-primary-700">
                    <li>Ask specific questions about your experiences and skills.</li>
                    <li>Include the job title in your question for more targeted responses.</li>
                    <li>Try questions like "Tell me about a time when..." or "How would you handle..."</li>
                    <li>Use voice input for a more natural conversation flow.</li>
                  </ul>
                </div>
              )}
              
              <div className="relative mb-4">
                <TextAreaGroup
                  id="interviewQuestion"
                  label="Interview Question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Type your question here or use the microphone..."
                  rows={3}
                  required
                />
                <div className="absolute right-2 bottom-2 flex space-x-1">
                  {question && (
                    <Button
                      variant="secondary"
                      onClick={clearQuestion}
                      className="p-1.5 h-auto w-auto rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                      title="Clear question"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant={isListening ? "danger" : "secondary"}
                    onClick={toggleListening}
                    className={`p-1.5 h-auto w-auto rounded-full ${isListening ? '' : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    <MicrophoneIcon className="h-4 w-4" />
                  </Button>
                </div>
                
                {isListening && (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
                    <span className="relative flex h-4 w-4 mt-4 mr-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                  </div>
                )}
              </div>
              
              <Button
                type="button" // Changed from submit as it's not in a form
                onClick={generateAnswer}
                disabled={isLoading || !question || !resumeText}
                isLoading={isLoading}
                className="w-full"
                icon={PaperAirplaneIcon}
              >
                {isLoading ? 'Generating...' : 'Generate Interview Answer'}
              </Button>
              
              {!resumeText && (
                <p className="text-xs text-red-500 mt-2 text-center">Please provide resume text to enable answer generation.</p>
              )}
            </Card>

            {/* Answer Section (conditionally rendered) */}
            {answer && (
              <div ref={answerRef}>
                <AnswerDisplay
                  answer={answer}
                  jobTitle={jobTitle}
                  jobCompany={jobCompany}
                  onAskAnother={clearQuestion}
                />
              </div>
            )}
          </div>

          {/* Right Column (History) - Takes 1/3 width on large screens */}
          <div className="lg:col-span-1 space-y-6">
            <Card title="Answer History">
              {recentAnswers.length > 0 ? (
                <div className="space-y-3">
                  {recentAnswers.map((item) => (
                    <HistoryItem 
                      key={item.id} 
                      item={item} 
                      onViewReuse={handleReuseHistory} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <DocumentTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">No history yet</p>
                  <p className="text-xs">Your generated answers will appear here.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-xs">
            &copy; {new Date().getFullYear()} InterviewAce — Ace your next interview with confidence
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
