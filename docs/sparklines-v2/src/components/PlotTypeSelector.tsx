import React from 'react';

interface PlotTypeSelectorProps {
  selectedPlotType: string;
  onPlotTypeChange: (plotType: string) => void;
}

const PlotTypeSelector: React.FC<PlotTypeSelectorProps> = ({
  selectedPlotType,
  onPlotTypeChange,
}) => {
  const plotTypes = [
    { value: 'speed', label: 'Speed' },
    { value: 'acceleration', label: 'Acceleration' },
  ];

  return (
    <div className='mb-2 flex items-center space-x-2'>
      <label className='mr-2'>Plot Type:</label>
      <div className='flex items-center space-x-2'>
        {plotTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => onPlotTypeChange(type.value)}
            className={`text-xs m-1 p-1 border rounded ${
              selectedPlotType === type.value
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlotTypeSelector;
