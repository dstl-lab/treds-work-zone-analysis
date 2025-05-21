// workzones-metadata.json has a list of objects with the following schema:
export interface WorkzoneMetadata {
  workzone_id: string;
  n: number;
}

// each workzone file has a list of objects with the following schema:
export interface VehicleData {
  vehicle_id: number;
  district: number;
  visit_date: Date; // Parsed from ISO date string
  is_control_group: boolean;
  workzone_id: string;
  is_chins_reportable?: string;
  cause?: string;
  message?: string;
  data: VehicleDataPoint[];
}

export interface VehicleDataPoint {
  event_time: Date; // Parsed from string
  speed: number;
  acceleration?: number;
}

// after processing, we have a list of objects with the following schema:
export interface ResampledData {
  start_time: Date;
  end_time: Date;
  control_group_vehicles: VehicleData[]; // ordered by visit_date
  test_group_vehicles: VehicleData[]; // ordered by visit_date
}
