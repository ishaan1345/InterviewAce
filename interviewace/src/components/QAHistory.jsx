import { useState } from 'react';

function QAHistory({ recentAnswers, onSelectAnswer, popularQuestions, onSelectQuestion }) {
  const [activeTab, setActiveTab] = useState('popular');

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex mb-4 border-b">
        <button
          className={`pb-2 px-4 ${activeTab === 'popular' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('popular')}
        >
          Popular Questions
        </button>
        <button
          className={`pb-2 px-4 ${activeTab === 'recent' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('recent')}
        >
          Recent Answers
        </button>
      </div>

      {activeTab === 'popular' && (
        <div>
          <ul className="space-y-2">
            {popularQuestions.map((q, i) => (
              <li key={i}>
                <button
                  onClick={() => onSelectQuestion(q)}
                  className="w-full text-left p-2 hover:bg-gray-100 rounded text-blue-600"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === 'recent' && (
        <div>
          {recentAnswers.length > 0 ? (
            <ul className="space-y-3">
              {recentAnswers.map((item, i) => (
                <li key={i} className="border-b pb-2">
                  <button
                    onClick={() => onSelectAnswer(item)}
                    className="w-full text-left hover:bg-gray-100 p-1 rounded"
                  >
                    <p className="font-medium">{item.question}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                    {item.companyName && (
                      <p className="text-xs text-gray-400">Company: {item.companyName}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No recent answers yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default QAHistory;
