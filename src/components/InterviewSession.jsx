import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

function InterviewSession({ 
  question, 
  setQuestion, 
  resumeText,
  jobTitle,
  companyName,
  jobDescription,
  responsibilities,
  customInstructions,
  setCustomInstructions,
  setGeneratedAnswer,
  setRecentAnswers
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef(null);
  
  // API URL - Use relative URL for production compatibility
  const apiUrl = '/api/generate-answer';
  
  const toggleListening = () => {
    if (!isListening) {
      startListening();
    } else {
      stopListening();
    }
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        
        setTranscript(transcript);
        setQuestion(transcript);
        
        // Auto-submit if it detects a complete question
        const lastChar = transcript.trim().slice(-1);
        if (lastChar === '?' && resumeText.trim().length > 0) {
          recognitionRef.current.stop();
          setIsListening(false);
          setTimeout(() => generateAnswer(), 500);
        }
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.start();
      setIsListening(true);
    } else {
      setError('Speech recognition is not supported in your browser');
    }
  };
  
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!question.trim()) {
      setError('Please enter an interview question');
      return;
    }
    
    if (!resumeText.trim()) {
      setError('Please upload or paste your resume');
      return;
    }
    
    // Save job information for later use
    localStorage.setItem('jobInfo', JSON.stringify({
      jobTitle,
      companyName,
      jobDescription,
      responsibilities
    }));
    
    generateAnswer();
  };
  
  const generateAnswer = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(apiUrl, {
        question,
        resumeText,
        jobTitle,
        companyName,
        jobDescription,
        responsibilities,
        customInstructions
      });
      
      const answer = response.data.answer;
      setGeneratedAnswer(answer);
      
      // Save to recent answers
      const newAnswer = {
        question,
        answer,
        timestamp: new Date().toISOString(),
        jobTitle,
        companyName,
        jobDescription,
        responsibilities
      };
      
      setRecentAnswers(prev => [newAnswer, ...prev.slice(0, 9)]); // Keep only 10 recent answers
    } catch (err) {
      console.error('Error generating answer:', err);
      setError(`Error generating answer: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2">Interview Question</label>
        <div className="flex">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-grow p-2 border rounded-l"
            placeholder="Type or ask a question..."
          />
          <button
            onClick={toggleListening}
            className={`p-2 ${isListening ? 'bg-red-600' : 'bg-blue-600'} text-white rounded-r`}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? (
              <StopIcon className="h-6 w-6" />
            ) : (
              <MicrophoneIcon className="h-6 w-6" />
            )}
          </button>
        </div>
        {isListening && (
          <p className="text-sm text-blue-600 mt-1">Listening... Speak your question</p>
        )}
      </div>
      
      <div>
        <label className="block mb-2">Custom Instructions (Optional)</label>
        <textarea
          value={customInstructions || ''}
          onChange={(e) => setCustomInstructions(e.target.value)}
          className="w-full p-2 border rounded h-24"
          placeholder="Any specific guidance for generating the answer..."
        ></textarea>
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
      >
        {loading ? 'Generating...' : 'Generate Answer'}
      </button>
    </div>
  );
}

export default InterviewSession;
