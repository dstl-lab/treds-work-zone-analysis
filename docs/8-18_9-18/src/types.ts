// workzones.json has a list of objects with the following schema:
export interface WorkzoneMetadata {
  workzone_id: string;
  district: number;
  is_chins_reportable: boolean;
  cause: string;
  test_n: number;
  control_n: number;
}

export interface VehicleData {
  vehicle_id: number;
  visit_date: Date;
  is_control_group: boolean;
  message: string;
  data: VehicleDataPoint[];
}

export interface VehicleDataPoint {
  event_time: Date;
  speed: number;
  acceleration?: number;
}
