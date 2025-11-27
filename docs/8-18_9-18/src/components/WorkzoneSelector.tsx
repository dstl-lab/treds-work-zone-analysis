import type { WorkzoneMetadata } from '@/types.ts';

interface WorkzoneSelectorProps {
  workzones: WorkzoneMetadata[];
  selectedWorkzone: string | null;
  setSelectedWorkzone: (workzone: string) => void;
}

function WorkzoneSelector({
  workzones,
  selectedWorkzone,
  setSelectedWorkzone,
}: WorkzoneSelectorProps) {
  return (
    <div
      id='selector-container'
      className='mb-4 grid grid-cols-6 grid-auto-rows-max'
    >
      {workzones.map((workzone) => (
        <button
          key={workzone.workzone_id}
          onClick={() => setSelectedWorkzone(workzone.workzone_id)}
          className={`text-xs m-1 p-1 border rounded ${
            selectedWorkzone === workzone.workzone_id
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
          }`}
        >
          {workzone.workzone_id} (n={workzone.test_n + workzone.control_n})
        </button>
      ))}
    </div>
  );
}

export default WorkzoneSelector;
