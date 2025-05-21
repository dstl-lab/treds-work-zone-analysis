import type { WorkzoneMetadata, VehicleData } from '../types';

interface WorkzoneInfoProps {
  selectedWorkzone: string;
  metadata: WorkzoneMetadata[];
  vehicleData: VehicleData[];
}

const WorkzoneInfo: React.FC<WorkzoneInfoProps> = ({
  selectedWorkzone,
  metadata,
  vehicleData,
}) => {
  const workzone = metadata.find((wz) => wz.workzone_id === selectedWorkzone);
  const firstVehicleWithMessage = vehicleData?.find(
    (vehicle) =>
      vehicle.message !== null &&
      vehicle.message !== undefined &&
      vehicle.message !== '',
  );

  if (!workzone) {
    return <p>Workzone information not found.</p>;
  }

  return (
    <div className='my-4 p-4 border rounded-md shadow-sm'>
      <div className='grid grid-cols-6 gap-2'>
        <div>
          <p className='font-semibold'>Workzone ID:</p>
          <p>{workzone.workzone_id}</p>
        </div>
        <div>
          <p className='font-semibold'>Number of Vehicles:</p>
          <p>{workzone.n}</p>
        </div>
        {firstVehicleWithMessage && (
          <>
            <div>
              <p className='font-semibold'>CHINS Reportable:</p>
              <p>
                {firstVehicleWithMessage.is_chins_reportable ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className='font-semibold'>Cause:</p>
              <p>{firstVehicleWithMessage.cause}</p>
            </div>
            <div className='col-span-2'>
              <p className='font-semibold'>Message:</p>
              <p>{firstVehicleWithMessage.message}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkzoneInfo;
