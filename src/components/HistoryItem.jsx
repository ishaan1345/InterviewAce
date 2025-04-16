import React from 'react';
import Button from './Button'; // Assuming Button component exists

function HistoryItem({ item, onViewReuse }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 transition-shadow hover:shadow-sm">
      <h3 
        className="font-medium text-gray-800 text-sm mb-1.5 truncate cursor-default" 
        title={item.question}
      >
        {item.question}
      </h3>
      
      {item.jobInfo?.title && (
        <div className="flex items-center text-xs text-gray-500 mb-2">
          <span className="font-medium mr-1.5">For:</span> {item.jobInfo.title}
        </div>
      )}
      
      <p className="text-gray-600 text-xs line-clamp-2 mb-3">{item.answer}</p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {new Date(item.timestamp).toLocaleString(undefined, { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute:'2-digit' 
          })}
        </span>
        <Button 
          variant="text" 
          onClick={() => onViewReuse(item)}
          className="text-xs px-2 py-1 h-auto"
        >
          View/Reuse
        </Button>
      </div>
    </div>
  );
}

export default HistoryItem; 