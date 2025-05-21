import { useEffect, useState } from 'react';
import './App.css';
import MinControlVehicles from './components/MinControlVehicles';
import TimeWindowSelector from './components/TimeWindowSelector';
import WorkzoneSelector from './components/WorkzoneSelector';
import WorkzoneInfo from './components/WorkzoneInfo';
import SparklinePlots from './components/SparklinePlots';
import PlotTypeSelector from './components/PlotTypeSelector';
import { metadata, loadVehicleData, resampleVehicleData } from './utils';
import type { ResampledData, VehicleData } from './types';

function App() {
  const [selectedWorkzone, setSelectedWorkzone] = useState<string | null>(null);
  const [minControlVehicles, setMinControlVehicles] = useState<number>(1);
  const [selectedWindow, setSelectedWindow] = useState<number>(120); // Default to 2 hours (120 minutes)
  const [selectedPlotType, setSelectedPlotType] = useState<
    'speed' | 'acceleration'
  >('speed');
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [resampledData, setResampledData] = useState<ResampledData[]>([]);
  const [initialHashRead, setInitialHashRead] = useState(false);

  useEffect(() => {
    const updateStateFromHash = () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const workzoneFromHash = params.get('workzone');
      const minControlFromHash = params.get('minControl');
      const windowFromHash = params.get('window');
      const plotTypeFromHash = params.get('plotType');

      if (workzoneFromHash) {
        setSelectedWorkzone(workzoneFromHash);
      } else if (metadata.length > 0) {
        setSelectedWorkzone(metadata[0].workzone_id);
      }

      // Set to default if not in hash, otherwise parse
      setMinControlVehicles(
        minControlFromHash ? parseInt(minControlFromHash, 10) : 1,
      );
      setSelectedWindow(windowFromHash ? parseInt(windowFromHash, 10) : 120);
      setSelectedPlotType(plotTypeFromHash as 'speed' | 'acceleration');
    };

    window.addEventListener('hashchange', updateStateFromHash);

    updateStateFromHash();
    setInitialHashRead(true);

    return () => {
      window.removeEventListener('hashchange', updateStateFromHash);
    };
  }, []);

  useEffect(() => {
    if (!initialHashRead) {
      return; // Don't update hash until initial read is complete
    }
    const params = new URLSearchParams();
    if (selectedWorkzone) {
      params.set('workzone', selectedWorkzone);
    }
    params.set('minControl', minControlVehicles.toString());
    params.set('window', selectedWindow.toString());
    params.set('plotType', selectedPlotType);
    window.location.hash = params.toString();
  }, [selectedWorkzone, minControlVehicles, selectedWindow, selectedPlotType]);

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
      <PlotTypeSelector
        selectedPlotType={selectedPlotType}
        onPlotTypeChange={setSelectedPlotType}
      />
      {selectedWorkzone && metadata && (
        <WorkzoneInfo
          selectedWorkzone={selectedWorkzone}
          metadata={metadata}
          vehicleData={vehicleData}
        />
      )}
      {resampledData && (
        <SparklinePlots
          resampledData={resampledData}
          minControlVehicles={minControlVehicles}
          selectedPlotType={selectedPlotType}
        />
      )}
    </div>
  );
}

export default App;
