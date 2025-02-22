import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';
import {
  renderWorkzonePlots,
  loadData,
  groupDataByWorkzone,
  renderWorkzoneSelector,
  setupTimeIntervalButtons,
} from './utils.js';

const allVehicleData = await loadData();

// Store grouped data in a variable that can be updated
let currentWorkZoneData = groupDataByWorkzone(allVehicleData); // Default: 1 hour

// Get the container element for plots
const plotsContainer = document.getElementById('plots-container');

// Create and insert the container for selector buttons
const selectorContainer = document.getElementById('selector-container');

// Get the control threshold input
const controlThresholdInput = document.getElementById('control-threshold');

// Variable to store the currently selected workzone ID
let currentSelectedWorkzoneId = null;
// Initialize with the first workzone ID if data exists
if (currentWorkZoneData.length > 0) {
  currentSelectedWorkzoneId = currentWorkZoneData[0].workzone_id;
}

// Function to re-render plots based on current selection and threshold
function rerenderCurrentWorkzone() {
  if (currentSelectedWorkzoneId) {
    // Find the workzone in the *currently* grouped data
    const selectedWorkzoneData = currentWorkZoneData.find(
      (wz) => wz.workzone_id === currentSelectedWorkzoneId,
    );
    const currentThreshold = parseInt(controlThresholdInput.value, 10) || 0;
    if (selectedWorkzoneData) {
      renderWorkzonePlots(
        selectedWorkzoneData,
        plotsContainer,
        currentThreshold,
      );
    } else {
      console.error(
        'Could not find data for workzone ID:',
        currentSelectedWorkzoneId,
      );
      plotsContainer.innerHTML =
        'Error: Could not find data for the selected work zone.';
    }
  } else {
    // Optionally clear plots or show a message if no workzone is selected
    // plotsContainer.innerHTML = 'Please select a work zone.';
  }
}

// Define the callback for the workzone selector
const workzoneSelectionCallback = (workZone, container) => {
  currentSelectedWorkzoneId = workZone.workzone_id;
  const currentThreshold = parseInt(controlThresholdInput.value, 10) || 0;
  renderWorkzonePlots(workZone, container, currentThreshold);
};

// --- Time Interval Handling ---

// Define the callback for the time interval buttons
function handleTimeIntervalChange(newIntervalMinutes) {
  console.log(
    `Main: Interval changed callback received: ${newIntervalMinutes} minutes`,
  );
  const intervalHours = newIntervalMinutes / 60;

  // Re-group the original data with the new interval
  currentWorkZoneData = groupDataByWorkzone(allVehicleData, intervalHours);
  console.log(
    `Regrouped data for ${intervalHours} hour interval:`,
    currentWorkZoneData,
  );

  // Re-render the workzone selector with the new data
  // This will also trigger rendering the first workzone's plots
  renderWorkzoneSelector(
    currentWorkZoneData,
    selectorContainer,
    plotsContainer,
    workzoneSelectionCallback, // Use the existing callback
  );

  // Update the currentSelectedWorkzoneId to the first one in the new list
  if (currentWorkZoneData.length > 0) {
    currentSelectedWorkzoneId = currentWorkZoneData[0].workzone_id;
    console.log(`Current workzone ID set to: ${currentSelectedWorkzoneId}`);
  } else {
    currentSelectedWorkzoneId = null;
    console.log('Current workzone ID set to null (no data)');
    plotsContainer.innerHTML = 'No data available for this time interval.'; // Clear plots if no data
  }

  // Note: Rerendering plots for the *new* first workzone is handled
  // automatically by the renderWorkzoneSelector function.
}

// --- Initial Setup ---

// Call the function to render the initial workzone selector buttons
renderWorkzoneSelector(
  currentWorkZoneData,
  selectorContainer,
  plotsContainer,
  workzoneSelectionCallback,
);

// Add event listener to the threshold input
controlThresholdInput.addEventListener('change', () => {
  rerenderCurrentWorkzone();
});

// Set up the time interval buttons and provide the callback
setupTimeIntervalButtons(handleTimeIntervalChange);

// Initial rendering of the first workzone is handled by renderWorkzoneSelector
