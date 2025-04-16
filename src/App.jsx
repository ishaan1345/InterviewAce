import React, { useState, useRef, useEffect, useCallback } from 'react';
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

// Import Modal component
import Modal from './components/common/Modal'; 

// Import Supabase client
import { supabase } from './supabaseClient'; // Import Supabase client

// Fix the version mismatch - update worker to version 3.11.174 to match the API version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// API URL Configuration
const apiUrl = '/api/generate-answer'; // Use relative path for deployment

function App() {
  const { user, session, signOut } = useAuth(); // Use the auth hook
  
  // State for Auth Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' or 'signup'

  // State variables
  const [resumeText, setResumeText] = useState(''); // Initialize empty
  const [resumeFile, setResumeFile] = useState(null);
  const [isLoadingResume, setIsLoadingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true); // New state for initial data load
  const [currentResumeId, setCurrentResumeId] = useState(null); // To link history
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
  const [isJobInfoVisible, setIsJobInfoVisible] = useState(false);
  const [currentJobInfoId, setCurrentJobInfoId] = useState(null);
  const [isJobInfoDirty, setIsJobInfoDirty] = useState(false);
  const [isSavingJobInfo, setIsSavingJobInfo] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const answerRef = useRef(null);

  // --- Load User Data from Supabase --- 
  useEffect(() => {
    const loadUserData = async () => {
      if (user && supabase) {
        console.log(`User logged in (${user.id}). Fetching data...`);
        setIsDataLoading(true);
        // Reset states before loading
        setResumeText(''); setResumeFile(null); setCurrentResumeId(null);
        setJobTitle(''); setJobCompany(''); setJobDescription(''); setJobResponsibilities(''); setCurrentJobInfoId(null); setIsJobInfoDirty(false);
        setRecentAnswers([]);

        try {
          // Fetch latest resume
          const { data: resumeData, error: resumeError } = await supabase
            .from('resumes')
            .select('id, resume_text, file_name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(); // Fetch only one record or null

          if (resumeError && resumeError.code !== 'PGRST116') { // Ignore error if no rows found
            console.error(`Error fetching resume: ${resumeError.message}`);
          }
          if (resumeData) {
            console.log("Resume found, setting state.");
            setResumeText(resumeData.resume_text || '');
            setResumeFile(resumeData.file_name ? { name: resumeData.file_name } : null);
            setCurrentResumeId(resumeData.id);
          } else {
            console.log("No resume found for user.");
            // Clear local state if no resume in DB
            setResumeText('');
            setResumeFile(null);
            setCurrentResumeId(null);
          }

          // Fetch latest Job Info
          const { data: jobData, error: jobError } = await supabase
            .from('job_info')
            .select('id, job_title, job_company, job_description, job_responsibilities')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (jobError && jobError.code !== 'PGRST116') { 
             console.error(`Error fetching job info: ${jobError.message}`);
          } else if (jobData) {
             console.log("Job info found, setting state.");
             setJobTitle(jobData.job_title || '');
             setJobCompany(jobData.job_company || '');
             setJobDescription(jobData.job_description || '');
             setJobResponsibilities(jobData.job_responsibilities || '');
             setCurrentJobInfoId(jobData.id);
             setIsJobInfoDirty(false);
          }

          // TODO: Fetch Answer History (similar logic)

        } catch (error) {
          console.error("Error loading user data:", error);
          alert(`Error loading your data: ${error.message}`);
          // Optionally clear local state on error?
        } finally {
          setIsDataLoading(false);
          console.log("Data loading finished.");
        }
      } else {
        // User logged out or Supabase not ready
        console.log("User logged out or Supabase not ready. Clearing data.");
        setResumeText('');
        setResumeFile(null);
        setCurrentResumeId(null);
        // TODO: Clear Job Info state
        // TODO: Clear History state
        setIsDataLoading(false); // Ensure loading is false even if no user
      }
    };

    loadUserData();

  }, [user]); // Re-run when user logs in/out

  // --- Save Resume to Supabase ---
  const saveResumeToDb = async (textToSave, fileName) => {
    if (!user || !supabase || !textToSave) return; // Need user, supabase, and text

    console.log(`Saving resume for user ${user.id}...`);
    try {
      const { data, error } = await supabase
        .from('resumes')
        .upsert({
          user_id: user.id,
          resume_text: textToSave,
          file_name: fileName || null,
          // If upserting based on user_id, Supabase needs a unique constraint
          // or primary key involving user_id for upsert to work reliably 
          // without specifying an id. Let's assume we replace any existing.
          // For simplicity now, we insert a new one each time and load the latest.
          // A better approach might be upsert on (user_id) if only one resume per user.
          // OR, we could fetch first, then update if exists, insert if not.
          // Let's stick to INSERT for now and fetch latest in useEffect.
        })
        // Switching to explicit insert and storing the ID
        .insert({
          user_id: user.id,
          resume_text: textToSave,
          file_name: fileName || null,
        })
        .select('id') // Select the id of the inserted row
        .single(); // Expecting a single row back

      if (error) {
        throw new Error(`Error saving resume: ${error.message}`);
      }
      
      if (data) {
        console.log("Resume saved successfully. New resume ID:", data.id);
        setCurrentResumeId(data.id); // Update the current resume ID state
      } else {
        console.warn("Resume saved but no ID returned?");
      }

    } catch (error) {
      console.error("Error saving resume to DB:", error);
      setResumeError(`Failed to save resume: ${error.message}`); // Show error to user
    }
  };

  // --- Save Job Info to Supabase ---
  const saveJobInfoToDb = async () => {
    if (!user || !supabase || !isJobInfoDirty) return; // Only save if logged in and changed
    
    setIsSavingJobInfo(true);
    console.log(`Saving job info for user ${user.id}...`);
    try {
      const jobDataToSave = {
        user_id: user.id,
        job_title: jobTitle,
        job_company: jobCompany,
        job_description: jobDescription,
        job_responsibilities: jobResponsibilities,
      };

      // We will INSERT a new record each time, similar to resume for simplicity
      // The useEffect load logic fetches the latest one.
      const { data, error } = await supabase
        .from('job_info')
        .insert(jobDataToSave)
        .select('id')
        .single();

      if (error) {
        throw new Error(`Error saving job info: ${error.message}`);
      }

      if (data) {
        console.log("Job info saved successfully. New job info ID:", data.id);
        setCurrentJobInfoId(data.id); // Update current ID
        setIsJobInfoDirty(false); // Reset dirty flag
      } else {
         console.warn("Job info saved but no ID returned?");
      }

    } catch (error) {
      console.error("Error saving job info to DB:", error);
      alert(`Failed to save job info: ${error.message}`); // Show error
    } finally {
      setIsSavingJobInfo(false);
    }
  };

  // Handle resume file drop
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setResumeError('');
    setIsLoadingResume(true);
    setResumeFile(file);
    setResumeText(''); // Clear previous text
    setCurrentResumeId(null); // Reset current ID on new upload

    try {
      const text = await extractText(file); // Use existing extractText function
      setResumeText(text);
      // --> Save to DB after extracting text
      if (user) {
        await saveResumeToDb(text, file.name); 
      }
      // <---
    } catch (error) {
      console.error("Error during resume processing:", error);
      setResumeError(error.toString());
      setResumeFile(null); // Clear file on error
    } finally {
      setIsLoadingResume(false);
    }
  }, [user]); // Add user dependency to onDrop

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

  // --- Handlers for opening the auth modal ---
  const openLoginModal = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openSignupModal = () => {
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  };

  const closeModal = () => {
    setIsAuthModalOpen(false);
  };

  // --- Update Input Handlers to set dirty flag ---
  const handleJobTitleChange = (e) => { setJobTitle(e.target.value); setIsJobInfoDirty(true); };
  const handleJobCompanyChange = (e) => { setJobCompany(e.target.value); setIsJobInfoDirty(true); };
  const handleJobDescriptionChange = (e) => { setJobDescription(e.target.value); setIsJobInfoDirty(true); };
  const handleJobResponsibilitiesChange = (e) => { setJobResponsibilities(e.target.value); setIsJobInfoDirty(true); };

  // --- Main App Rendering (Always render) --- 
  if (isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary-600">InterviewAce</h1>
              <span className="ml-2 text-sm text-gray-500 hidden md:inline">AI Interview Prep</span>
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
                // Logged-out state: Use modal triggers
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={openLoginModal} 
                    variant="secondary" 
                    size="sm"
                  >
                    Login
                  </Button>
                  <Button 
                    onClick={openSignupModal} 
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
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <InputGroup
                    label="Job Title"
                    id="jobTitle"
                    value={jobTitle}
                    onChange={handleJobTitleChange}
                    placeholder="e.g. Frontend Developer"
                  />
                  <InputGroup
                    label="Company"
                    id="jobCompany"
                    value={jobCompany}
                    onChange={handleJobCompanyChange}
                    placeholder="e.g. Tech Solutions Inc."
                  />
                  <TextAreaGroup
                    label="Job Description"
                    id="jobDescription"
                    value={jobDescription}
                    onChange={handleJobDescriptionChange}
                    placeholder="Copy and paste the job description here..."
                    rows={4}
                  />
                  <TextAreaGroup
                    label="Key Responsibilities"
                    id="jobResponsibilities"
                    value={jobResponsibilities}
                    onChange={handleJobResponsibilitiesChange}
                    placeholder="List the key responsibilities from the job description..."
                    rows={3}
                  />
                  {/* Save Button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={saveJobInfoToDb}
                      disabled={!isJobInfoDirty || isSavingJobInfo}
                      loading={isSavingJobInfo}
                      size="sm"
                    >
                      {isSavingJobInfo ? 'Saving...' : (isJobInfoDirty ? 'Save Job Info' : 'Job Info Saved')}
                    </Button>
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

      {/* Authentication Modal */}
      <Modal 
        isOpen={isAuthModalOpen} 
        onClose={closeModal} 
        title={authModalMode === 'login' ? 'Log In' : 'Sign Up'}
      >
        {authModalMode === 'login' ? (
          <Login onSwitchMode={() => setAuthModalMode('signup')} />
        ) : (
          <Signup onSwitchMode={() => setAuthModalMode('login')} />
        )}
      </Modal>

    </div>
  );
}

export default App;
