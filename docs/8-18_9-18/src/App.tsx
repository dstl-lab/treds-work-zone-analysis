import { useEffect, useState } from 'react';
import WorkzoneSelector from '@/components/WorkzoneSelector';
import WorkzoneMeta from '@/components/WorkzoneMeta';
import VehicleTimeline from '@/components/VehicleTimeline';
import SyncedSpeedPlots from '@/components/SyncedSpeedPlots';
import { loadVehicleData } from '@/utils';
import { useStore } from '@/store';
import type { VehicleData } from '@/types';

function App() {
  const workzoneId = useStore((state) => state.workzoneId);
  const [loadedData, setLoadedData] = useState<{
    workzoneId: string;
    data: VehicleData[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadVehicleData(workzoneId).then((data) => {
      if (!cancelled) setLoadedData({ workzoneId, data });
    });
    return () => {
      cancelled = true;
    };
  }, [workzoneId]);

  const loading = loadedData === null || loadedData.workzoneId !== workzoneId;
  const vehicleData = loading ? [] : loadedData.data;

  return (
    <div className='py-8'>
      <div className='max-w-4xl mx-auto px-4'>
        <h1 className='text-3xl font-bold text-center'>TREDS Analysis</h1>
        <p className='text-center text-gray-600'>
          8-18 to 9-18 Dataset, all workzones with at least 20 control vehicles.
        </p>

        <div className='mt-2 space-y-4'>
          <WorkzoneSelector />
          <WorkzoneMeta />
          {loading ? (
            <div className='bg-white rounded-lg border border-gray-200 p-6'>
              <p className='text-gray-500 text-center'>
                Loading vehicle data...
              </p>
            </div>
          ) : (
            <VehicleTimeline data={vehicleData} />
          )}
        </div>
      </div>

      {!loading && (
        <div className='mt-4 px-4 w-full'>
          <SyncedSpeedPlots data={vehicleData} />
        </div>
      )}
    </div>
  );
}

export default App;
