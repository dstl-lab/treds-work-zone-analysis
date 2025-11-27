import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet';
import type { WorkzoneMetadata, VehicleData } from '@/types';

import workzonesJSONL from '@/data/workzones.json?raw';

export const workzones: WorkzoneMetadata[] = workzonesJSONL
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line)) as WorkzoneMetadata[];

export async function loadVehicleData(
  workzoneId: string,
): Promise<VehicleData[]> {
  const dataModule = await import(
    `@/data/vehicles/workzone_id=${workzoneId}/data_0.parquet`
  );
  const url = dataModule.default;
  const file = await asyncBufferFromUrl({ url });
  const objects = await parquetReadObjects({ file });
  return objects as VehicleData[];
}

loadVehicleData('8-15200');
