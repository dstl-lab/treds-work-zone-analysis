import React from 'react';

interface MinControlVehiclesProps {
  value: number;
  onChange: (value: number) => void;
}

const MinControlVehicles: React.FC<MinControlVehiclesProps> = ({
  value,
  onChange,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(event.target.value, 10));
  };

  return (
    <div className='mb-2'>
      <label htmlFor='control-threshold' className='mr-2'>
        Min Control Vehicles:
      </label>
      <input
        type='number'
        id='control-threshold'
        name='control-threshold'
        min='0'
        value={value}
        onChange={handleChange}
        className='border rounded px-2 py-1'
      />
    </div>
  );
};

export default MinControlVehicles;
