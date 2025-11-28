import { parquetReadObjects } from 'hyparquet';
import * as d3 from 'd3';
import type { WorkzoneMetadata, VehicleData } from '@/types';

import workzonesJSONL from '@/data/workzones.json?raw';

// https://d3js.org/d3-scale-chromatic/categorical#schemeTableau10
export const colors = {
  blue: d3.schemeTableau10[0],
  orange: d3.schemeTableau10[1],
  red: d3.schemeTableau10[2],
  lightblue: d3.schemeTableau10[3],
  green: d3.schemeTableau10[4],
  yellow: d3.schemeTableau10[5],
} as const;

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

  // Fetch entire file as ArrayBuffer (GitHub Pages doesn't support range requests)
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  // Create an AsyncBuffer-compatible wrapper around the ArrayBuffer
  const file = {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end?: number) => arrayBuffer.slice(start, end),
  };

  const objects = await parquetReadObjects({ file });
  return objects as VehicleData[];
}
