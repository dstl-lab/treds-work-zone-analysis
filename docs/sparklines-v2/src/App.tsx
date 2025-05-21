import { useEffect, useState } from 'react';
import './App.css';
import MinControlVehicles from './components/MinControlVehicles';
import TimeWindowSelector from './components/TimeWindowSelector';
import WorkzoneSelector from './components/WorkzoneSelector';
import SparklinePlots from './components/SparklinePlots';
import { metadata, loadVehicleData, resampleVehicleData } from './utils';
import type { ResampledData, VehicleData } from './types';

function App() {
  const [selectedWorkzone, setSelectedWorkzone] = useState<string | null>(null);
  const [minControlVehicles, setMinControlVehicles] = useState<number>(1);
  const [selectedWindow, setSelectedWindow] = useState<number>(120); // Default to 2 hours (120 minutes)
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [resampledData, setResampledData] = useState<ResampledData[]>([]);

  useEffect(() => {
    if (metadata.length > 0) {
      setSelectedWorkzone(metadata[0].workzone_id);
    }
  }, []);

  useEffect(() => {
    const fetchVehicleData = async () => {
      if (selectedWorkzone) {
        const data = await loadVehicleData(selectedWorkzone);
        setVehicleData(data);
      } else {
        setVehicleData([]);
      }
    };
    fetchVehicleData();
  }, [selectedWorkzone]);

  useEffect(() => {
    if (vehicleData.length > 0) {
      const resampledData = resampleVehicleData(vehicleData, selectedWindow);
      setResampledData(resampledData);
    }
  }, [vehicleData, selectedWindow]);

  return (
    <div className='container mx-auto my-8 px-4'>
      <h1 className='text-3xl text-center mb-4'>TREDS Sparklines</h1>
      <p className='text-center mb-8'>
        This page contains sparklines for each vehicle in the TREDS dataset. The
        sparklines are split by workzone, and the plots are grouped together by
        the timestamp of the vehicle visit. Control group vehicles are on the
        left, and test group vehicles are on the right.
      </p>
      <WorkzoneSelector
        metadata={metadata}
        selectedWorkzone={selectedWorkzone}
        setSelectedWorkzone={setSelectedWorkzone}
      />
      <MinControlVehicles
        value={minControlVehicles}
        onChange={setMinControlVehicles}
      />
      <TimeWindowSelector
        selectedWindow={selectedWindow}
        onWindowChange={setSelectedWindow}
      />
      {resampledData && (
        <SparklinePlots
          resampledData={resampledData}
          minControlVehicles={minControlVehicles}
        />
      )}
    </div>
  );
}

export default App;
