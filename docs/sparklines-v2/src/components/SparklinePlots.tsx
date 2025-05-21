import type { ResampledData, VehicleData } from '@/types';
import Sparkline from './Sparkline';

interface SparklinePlotsProps {
  resampledData: ResampledData[];
  minControlVehicles: number;
  selectedPlotType: 'speed' | 'acceleration';
}

function SparklinePlots({
  resampledData,
  minControlVehicles,
  selectedPlotType,
}: SparklinePlotsProps) {
  return (
    <div>
      {resampledData.map((intervalData, index) => {
        // Check if this interval has insufficient control data
        const insufficientControlData =
          intervalData.control_group_vehicles.length < minControlVehicles;

        return (
          <div
            key={index}
            className={`interval-container border-t border-gray-300 py-1 mb-1 ${
              insufficientControlData ? 'flex gap-2' : ''
            }`.trim()}
          >
            <h2 className='text-xs'>
              {`${new Date(
                intervalData.start_time,
              ).toLocaleString()} - ${new Date(
                intervalData.end_time,
              ).toLocaleString()}`}
            </h2>
            {insufficientControlData ? (
              <div className='text-xs text-center text-gray-500 italic'>
                {`Insufficient control vehicle data (less than ${minControlVehicles}).`}
              </div>
            ) : (
              <div className='flex flex-wrap justify-between'>
                <div className='w-full md:w-1/2 pr-2 flex flex-wrap place-content-start'>
                  <h3 className='w-full text-sm mb-1 text-center'>
                    {`Control Group (n=${intervalData.control_group_vehicles.length})`}
                  </h3>
                  {intervalData.control_group_vehicles.length > 0 ? (
                    intervalData.control_group_vehicles.map(
                      (vehicle: VehicleData) => (
                        <Sparkline
                          key={vehicle.vehicle_id}
                          vehicleData={vehicle}
                          selectedPlotType={selectedPlotType}
                        />
                      ),
                    )
                  ) : (
                    <p className='text-center text-gray-500 italic'>
                      No control vehicles in this interval.
                    </p>
                  )}
                </div>
                <div className='w-full md:w-1/2 pl-2 flex flex-wrap place-content-start'>
                  <h3 className='w-full text-sm mb-1 text-center'>
                    {`Test Group (n=${intervalData.test_group_vehicles.length})`}
                  </h3>
                  {intervalData.test_group_vehicles.length > 0 ? (
                    intervalData.test_group_vehicles.map(
                      (vehicle: VehicleData) => (
                        <Sparkline
                          key={vehicle.vehicle_id}
                          vehicleData={vehicle}
                          selectedPlotType={selectedPlotType}
                        />
                      ),
                    )
                  ) : (
                    <p className='text-center text-gray-500 italic'>
                      No test vehicles in this interval.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SparklinePlots;
