import { useState, useEffect } from 'react';

function JobDetailsForm({ 
  jobTitle, 
  setJobTitle, 
  companyName, 
  setCompanyName, 
  jobDescription, 
  setJobDescription, 
  responsibilities, 
  setResponsibilities 
}) {
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Try to load saved job info when component mounts
    const savedJobInfo = localStorage.getItem('jobInfo');
    if (savedJobInfo) {
      try {
        const { jobTitle: savedTitle, companyName: savedCompany, jobDescription: savedDesc, responsibilities: savedResp } = JSON.parse(savedJobInfo);
        
        if (savedTitle) setJobTitle(savedTitle);
        if (savedCompany) setCompanyName(savedCompany);
        if (savedDesc) setJobDescription(savedDesc);
        if (savedResp) setResponsibilities(savedResp);
      } catch (e) {
        console.error('Error parsing saved job info:', e);
      }
    }
  }, [setJobTitle, setCompanyName, setJobDescription, setResponsibilities]);

  const handleSubmit = () => {
    localStorage.setItem('jobInfo', JSON.stringify({
      jobTitle,
      companyName,
      jobDescription,
      responsibilities
    }));
    
    setSaveMessage('Job information saved!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Job Title</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Software Engineer"
          />
        </div>
        
        <div>
          <label className="block mb-2">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Google"
          />
        </div>
      </div>
      
      <div>
        <label className="block mb-2">Job Description</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="w-full p-2 border rounded h-24"
          placeholder="Paste the job description here..."
        ></textarea>
      </div>
      
      <div>
        <label className="block mb-2">Key Responsibilities</label>
        <textarea
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
          className="w-full p-2 border rounded h-24"
          placeholder="List the key responsibilities..."
        ></textarea>
      </div>
      
      <button
        onClick={handleSubmit}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Submit with Job Info
      </button>
      
      {saveMessage && (
        <div className="p-2 bg-green-100 text-green-700 rounded">
          {saveMessage}
        </div>
      )}
    </div>
  );
}

export default JobDetailsForm;
