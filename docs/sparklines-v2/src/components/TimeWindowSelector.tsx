import React from 'react';

interface TimeWindowSelectorProps {
  selectedWindow: number;
  onWindowChange: (window: number) => void;
}

const windowOptions = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hr' },
  { value: 240, label: '4 hr' },
  { value: 360, label: '6 hr' },
  { value: 720, label: '12 hr' },
  { value: 1440, label: '24 hr' },
];

const TimeWindowSelector: React.FC<TimeWindowSelectorProps> = ({
  selectedWindow,
  onWindowChange,
}) => {
  return (
    <div className='mb-4 flex items-center space-x-2'>
      <label className='mr-2'>Time Window Duration:</label>
      {windowOptions.map((option) => (
        <button
          key={option.value}
          data-window={option.value}
          className={`text-xs m-1 p-1 border rounded ${
            selectedWindow === option.value
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
          }`}
          onClick={() => onWindowChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default TimeWindowSelector;
