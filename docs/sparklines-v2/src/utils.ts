import type { ResampledData, VehicleData } from '@/types';

import metadata from '@/data/workzones-metadata.json';

export { metadata };

export async function loadVehicleData(
  workzoneId: string,
): Promise<VehicleData[]> {
  const dataModule = await import(`@/data/workzones/${workzoneId}.json`);
  const rawData: VehicleData[] = dataModule.default;

  // Process data: parse event_time strings into Date objects
  const allVehicleData: VehicleData[] = rawData.map((vehicle) => ({
    ...vehicle,
    visit_date: new Date(vehicle.visit_date), // Parse visit_date
    data: vehicle.data.map((point) => ({
      ...point,
      event_time: new Date(point.event_time),
    })),
  }));

  return allVehicleData;
}

/**
 * Resamples vehicle data by grouping vehicles into time intervals.
 */
export function resampleVehicleData(
  vehicleData: VehicleData[],
  windowMinutes: number = 60,
): ResampledData[] {
  const windowMs = windowMinutes * 60 * 1000;

  // Helper to get the start of the interval (UTC)
  const getIntervalStart = (date: Date, intervalMs: number) => {
    const timeMs = new Date(date).getTime();
    const startMs = Math.floor(timeMs / intervalMs) * intervalMs;
    return new Date(startMs);
  };

  // Helper to get the end of the interval (UTC)
  const getIntervalEnd = (startDate: Date, intervalMs: number) => {
    const startMs = startDate.getTime();
    // End is start + duration - 1 millisecond
    const endMs = startMs + intervalMs - 1;
    return new Date(endMs);
  };

  if (!vehicleData || vehicleData.length === 0) {
    return [];
  }

  // Sort vehicles by visit_date (ascending) first
  const sortedVehicleData = [...vehicleData].sort(
    (a, b) => a.visit_date.getTime() - b.visit_date.getTime(),
  );

  // Group vehicles by the specified interval
  const groupedByInterval = sortedVehicleData.reduce<
    Record<string, { vehicles: VehicleData[]; intervalStart: Date }>
  >((acc, vehicle) => {
    const intervalStart = getIntervalStart(vehicle.visit_date, windowMs);
    const intervalKey = intervalStart.toISOString(); // Use ISO string as the key

    if (!acc[intervalKey]) {
      acc[intervalKey] = { vehicles: [], intervalStart }; // Store start date with vehicles
    }
    acc[intervalKey].vehicles.push(vehicle);
    return acc;
  }, {});

  // Create ResampledData objects for each interval
  const resampledVehicles = Object.values(groupedByInterval)
    .map(({ vehicles: vehiclesInInterval, intervalStart }) => {
      const intervalEnd = getIntervalEnd(intervalStart, windowMs);

      const control_group_vehicles: VehicleData[] = [];
      const test_group_vehicles: VehicleData[] = [];

      vehiclesInInterval.forEach((vehicle) => {
        if (vehicle.is_control_group) {
          control_group_vehicles.push(vehicle);
        } else {
          test_group_vehicles.push(vehicle);
        }
      });

      return {
        start_time: intervalStart,
        end_time: intervalEnd,
        control_group_vehicles,
        test_group_vehicles,
      };
    })
    .sort((a, b) => a.start_time.getTime() - b.start_time.getTime()); // Sort interval buckets chronologically

  return resampledVehicles;
}
