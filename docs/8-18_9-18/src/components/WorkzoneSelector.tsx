import { workzones } from '@/utils';
import { useStore } from '@/store';

function WorkzoneSelector() {
  const { workzoneId, setWorkzoneId } = useStore();

  return (
    <div
      id='selector-container'
      className='mb-4 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))]'
    >
      {workzones.map((workzone) => (
        <button
          key={workzone.workzone_id}
          onClick={() => setWorkzoneId(workzone.workzone_id)}
          className={`text-xs m-1 p-1 border rounded ${
            workzoneId === workzone.workzone_id
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-800 hover:bg-gray-100'
          } ${
            workzone.is_chins_reportable ? 'border-gray-600' : 'border-gray-300'
          }`}
        >
          {workzone.workzone_id} (control n={workzone.control_n})
        </button>
      ))}
    </div>
  );
}

export default WorkzoneSelector;
