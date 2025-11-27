import { workzones } from '@/utils';
import { useState } from 'react';
import WorkzoneSelector from '@/components/WorkzoneSelector';

const firstWorkzone = workzones[0].workzone_id;

function App() {
  const [selectedWorkzone, setSelectedWorkzone] =
    useState<string>(firstWorkzone);

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold text-center'>TREDS Analysis</h1>
      <p className='text-center text-gray-600'>8-18 to 9-18 Dataset</p>

      <WorkzoneSelector
        workzones={workzones}
        selectedWorkzone={selectedWorkzone}
        setSelectedWorkzone={setSelectedWorkzone}
      />
    </div>
  );
}

export default App;
