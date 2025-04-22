// JSON has list of objects with the following schema:

// interface VehicleData {
//   vehicle_id: number;
//   district: number;
//   visit_date: string; // ISO date string
//   is_control_group: boolean;
//   workzone_id: string;
//   is_chins_reportable: string;
//   cause: string;
//   message: string;
//   data: {
//     speed: number;
//     bearing: number;
//     event_time: string | Date; // Can be string initially, Date after parsing
//     acceleration: number | null;
//     longitude: number;
//     latitude: number;
//   };
// }

// After parsing, we'll group into an array of objects with the following schema:

// interface WorkZoneData {
//   workzone_id: string;
//   vehicles: ResampledData[];
// }
//
// interface ResampledData {
//   start_time: Date;
//   end_time: Date;
//   control_group_vehicles: VehicleData[]; // ordered by visit_date
//   test_group_vehicles: VehicleData[]; // ordered by visit_date
// }

import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';

// Determine data URL based on hostname
let dataUrl = '../data/filtered-work-zones-grouped.json';
// const hostname = window.location.hostname;
// if (hostname === 'localhost' || hostname === '127.0.0.1') {
//   dataUrl = '../data/filtered-work-zones-grouped.json'; // Use non-gzipped for local dev
//   console.log('Running locally, using .json data file.');
// } else {
//   dataUrl = '../data/filtered-work-zones-grouped.json.gz'; // Use gzipped for production/other envs
// }

// Placeholder type for insufficient data intervals
const INSUFFICIENT_DATA_PLACEHOLDER = 'insufficient_control_data';

export async function loadData() {
  try {
    const rawData = await d3.json(dataUrl);
    if (!Array.isArray(rawData)) {
      console.error('Loaded data is not an array:', rawData);
      // If data isn't an array, return an empty array or handle as appropriate
      return [];
    }

    // Process data: parse event_time strings into Date objects
    const allVehicleData = rawData.map((vehicle) => ({
      ...vehicle,
      visit_date: new Date(vehicle.visit_date), // Parse visit_date
      data: vehicle.data.map((point) => ({
        ...point,
        event_time: new Date(point.event_time),
      })),
    }));

    console.log(
      `Loaded and processed ${allVehicleData.length} vehicle records from ${dataUrl}`,
    );
    return allVehicleData;
  } catch (error) {
    console.error(`Error loading or processing data from ${dataUrl}:`, error);
    // Rethrow or return an empty array to signal failure
    return [];
  }
}

/**
 * Filters time intervals based on the minimum number of control vehicles.
 * Intervals with fewer control vehicles than the threshold are replaced with a placeholder.
 * @param {ResampledData[]} intervals - Array of time interval data.
 * @param {number} minControlVehicles - The minimum number of control vehicles required.
 * @returns {(ResampledData | { insufficient_control_data: true, start_time: Date })[]} - Filtered array with placeholders.
 */
export function filterIntervalsByControlCount(intervals, minControlVehicles) {
  if (minControlVehicles <= 0) {
    return intervals; // No filtering needed if threshold is 0 or less
  }
  return intervals.map((interval) => {
    if (interval.control_group_vehicles.length < minControlVehicles) {
      // Instead of returning a new object, add a flag to the existing one
      return {
        ...interval, // Keep original properties like start_time and end_time
        insufficient_control_data: true, // Add the flag
      };
    }
    return interval;
  });
}

/**
 * Groups vehicle data by workzone_id, then by a specified time interval based on visit_date,
 * separating vehicles into control and test groups for each interval.
 * @param {VehicleData[]} allVehicleData - Array of all vehicle data records.
 * @param {number} [intervalHours=1] - The time interval duration in hours for grouping (e.g., 0.25, 0.5, 1, 2). Default: 1 hour.
 * @returns {WorkZoneData[]} - Array of work zone data objects matching the new schema.
 */
export function groupDataByWorkzone(allVehicleData, intervalHours = 1) {
  if (!allVehicleData || allVehicleData.length === 0) {
    return [];
  }
  if (typeof intervalHours !== 'number' || intervalHours <= 0) {
    console.warn(
      `Invalid intervalHours: ${intervalHours}. Defaulting to 1 hour.`,
    );
    intervalHours = 1;
  }

  const intervalMillis = intervalHours * 60 * 60 * 1000;

  // Helper to get the start of the interval (UTC)
  const getIntervalStart = (date, intervalMs) => {
    const timeMs = new Date(date).getTime();
    const startMs = Math.floor(timeMs / intervalMs) * intervalMs;
    return new Date(startMs);
  };

  // Helper to get the end of the interval (UTC)
  const getIntervalEnd = (startDate, intervalMs) => {
    const startMs = startDate.getTime();
    // End is start + duration - 1 millisecond
    const endMs = startMs + intervalMs - 1;
    return new Date(endMs);
  };

  // 1. Group vehicles by workzone_id
  const groupedByWorkzone = allVehicleData.reduce((acc, vehicle) => {
    const { workzone_id: workzoneId } = vehicle;
    if (!acc[workzoneId]) {
      acc[workzoneId] = [];
    }
    acc[workzoneId].push(vehicle);
    return acc;
  }, {});

  // 2. Process each workzone group
  const workZoneDataArray = Object.entries(groupedByWorkzone).map(
    ([workzone_id, vehiclesInWorkzone]) => {
      // Sort vehicles by visit_date (ascending) first
      vehiclesInWorkzone.sort((a, b) => a.visit_date - b.visit_date);

      // Group vehicles within the workzone by the specified interval
      const groupedByInterval = vehiclesInWorkzone.reduce((acc, vehicle) => {
        const intervalStart = getIntervalStart(
          vehicle.visit_date,
          intervalMillis,
        );
        const intervalKey = intervalStart.toISOString(); // Use ISO string as the key

        if (!acc[intervalKey]) {
          acc[intervalKey] = { vehicles: [], intervalStart }; // Store start date with vehicles
        }
        acc[intervalKey].vehicles.push(vehicle);
        return acc;
      }, {});

      // 3. Create ResampledData objects for each interval
      const resampledVehicles = Object.values(groupedByInterval) // Use Object.values now
        .map(({ vehicles: vehiclesInInterval, intervalStart }) => {
          const intervalEnd = getIntervalEnd(intervalStart, intervalMillis);

          const control_group_vehicles = [];
          const test_group_vehicles = [];

          vehiclesInInterval.forEach((vehicle) => {
            if (vehicle.is_control_group) {
              control_group_vehicles.push(vehicle);
            } else {
              test_group_vehicles.push(vehicle);
            }
          });

          // Vehicles are already sorted by visit_date from the earlier sort

          return {
            start_time: intervalStart,
            end_time: intervalEnd,
            control_group_vehicles,
            test_group_vehicles,
          };
        })
        .sort((a, b) => a.start_time - b.start_time); // Sort interval buckets chronologically

      // Calculate total vehicles for sorting workzones later
      const totalVehiclesInWorkzone = vehiclesInWorkzone.length;

      return {
        workzone_id,
        vehicles: resampledVehicles, // This now holds ResampledData[]
        totalVehicles: totalVehiclesInWorkzone, // Store total for sorting
      };
    },
  );

  // 4. Sort the work zones by the total number of vehicles (descending)
  workZoneDataArray.sort((a, b) => b.totalVehicles - a.totalVehicles);

  // Remove the temporary totalVehicles property if not needed in the final output
  // workZoneDataArray.forEach(wz => delete wz.totalVehicles);

  return workZoneDataArray;
}

/**
 * Generates a speed over time plot for a single vehicle's data, including a title.
 * @param {VehicleData} vehicleData - The entire data object for a single vehicle.
 * @returns {HTMLElement | null} - The container element with title and plot, or null if no data.
 */
function plotVehicleSpeed(vehicleData) {
  const {
    data: vehiclePoints,
    vehicle_id: vehicleId,
    is_control_group: isControlGroup,
    visit_date: visitDate, // visit_date is now a Date object
  } = vehicleData;

  if (!vehiclePoints || vehiclePoints.length === 0) {
    console.error('No data points provided for plotting.');
    return null;
  }

  const titleText = `Vehicle ID: ${vehicleId || 'Unknown'}`;

  // Create a container div
  const container = document.createElement('div');
  container.className = 'vehicle-plot-container'; // Optional: Add a class for styling

  // Create the title element
  const titleElement = document.createElement('h3');
  titleElement.className = 'vehicle-plot-title text-xs'; // Optional: Add classes for styling
  titleElement.textContent = titleText;

  // Append the title to the container
  container.appendChild(titleElement);

  const plot = Plot.plot({
    marks: [
      Plot.lineY(vehiclePoints, {
        x: 'event_time',
        y: 'speed',
        stroke: 'steelblue',
      }),
      // Add a vertical rule at the visit_date
      Plot.ruleX([visitDate], {
        stroke: 'red',
        strokeDasharray: '4,2', // Make it dashed
      }),
    ],
    x: {
      type: 'time',
      label: 'Time',
      tickFormat: d3.timeFormat('%I:%M %p'), // Format ticks as HH:MM AM/PM
    },
    y: {
      grid: true,
      label: 'Speed (mph)', // Add units if known
      domain: [0, 70], // Set y-axis domain from 0 to 70 mph
    },
    width: 200, // Adjust width as needed
    height: 100, // Adjust height as needed
  });

  // Append the plot to the container
  if (plot) {
    container.appendChild(plot);
  }

  return container; // Return the container with title and plot
}

// Define Tailwind classes for button states
const baseButtonClasses =
  'workzone-selector-button text-xs m-1 p-1 border rounded';
// Inactive state specific classes (adjust as needed)
const inactiveButtonClasses =
  'bg-white text-gray-800 border-gray-300 hover:bg-gray-100';
// Active state specific classes (adjust as needed)
const activeButtonClasses = 'bg-blue-600 text-white border-blue-700'; // Example active styles

/**
 * Creates buttons to select a work zone and renders them into a container.
 * @param {WorkZoneData[]} workZoneData - Array of all work zone data, sorted.
 * @param {HTMLElement} selectorContainer - The container element to add the buttons to.
 * @param {HTMLElement} plotsContainer - The container element where plots will be rendered.
 * @param {function} renderCallback - The function to call when a button is clicked (e.g., renderWorkzonePlots).
 */
export function renderWorkzoneSelector(
  workZoneData,
  selectorContainer,
  plotsContainer,
  renderCallback,
) {
  // Clear existing buttons
  selectorContainer.innerHTML = '';

  if (!workZoneData || workZoneData.length === 0) {
    selectorContainer.textContent = 'No work zone data available.';
    return;
  }

  workZoneData.forEach((workZone, index) => {
    const button = document.createElement('button');
    button.textContent = `${workZone.workzone_id} (n=${
      workZone.totalVehicles || 0
    })`;
    button.className = `${baseButtonClasses} ${inactiveButtonClasses}`;
    button.dataset.workzoneId = workZone.workzone_id;

    button.onclick = () => {
      // Clear the plots container before rendering new plots
      plotsContainer.innerHTML = '';
      renderCallback(workZone, plotsContainer);

      // Update button styles: remove active style from all buttons
      document.querySelectorAll('.workzone-selector-button').forEach((btn) => {
        btn.classList.remove(...activeButtonClasses.split(' '));
        btn.classList.add(...inactiveButtonClasses.split(' '));
      });

      // Add active style to the clicked button
      button.classList.remove(...inactiveButtonClasses.split(' '));
      button.classList.add(...activeButtonClasses.split(' '));
    };

    selectorContainer.appendChild(button);
  });

  // Render the plots for the *first* work zone by default
  if (workZoneData.length > 0) {
    const firstWorkZone = workZoneData[0];
    // Ensure plotsContainer is cleared before rendering initial plots
    plotsContainer.innerHTML = '';
    renderCallback(firstWorkZone, plotsContainer);
    // Optional: highlight the first button initially
    const firstButton = selectorContainer.querySelector(
      '.workzone-selector-button', // Use the same selector class
    );
    if (firstButton) {
      // Apply active styles to the first button
      firstButton.classList.remove(...inactiveButtonClasses.split(' '));
      firstButton.classList.add(...activeButtonClasses.split(' '));
    }
  }
}

/**
 * Renders plots for a selected work zone into the specified container.
 * Applies filtering based on the minimum control vehicle count.
 * @param {WorkZoneData} workZone - The work zone data object.
 * @param {HTMLElement} plotsContainer - The container element to render plots into.
 * @param {number} minControlVehicles - The minimum number of control vehicles required per interval.
 */
export function renderWorkzonePlots(
  workZone,
  plotsContainer,
  minControlVehicles,
) {
  // Clear previous plots
  plotsContainer.innerHTML = '';

  if (!workZone || !workZone.vehicles || workZone.vehicles.length === 0) {
    plotsContainer.textContent =
      'No vehicle data available for this work zone.';
    return;
  }

  // Filter the intervals based on the minimum control vehicle count
  const filteredIntervals = filterIntervalsByControlCount(
    workZone.vehicles,
    minControlVehicles,
  );

  // Group plots by interval start time
  filteredIntervals.forEach((intervalData) => {
    const intervalContainer = document.createElement('div');
    intervalContainer.className =
      'interval-container border-t border-gray-300 py-1 mb-1'; // Add some styling

    const intervalHeader = document.createElement('h2');
    intervalHeader.className = 'text-xs';
    // Format the start_time and end_time for display
    intervalHeader.textContent = `${intervalData.start_time.toLocaleString()} - ${intervalData.end_time.toLocaleString()}`;
    intervalContainer.appendChild(intervalHeader);

    // Check if this interval has insufficient control data
    if (intervalData.insufficient_control_data) {
      const placeholder = document.createElement('div');
      placeholder.className = 'text-xs text-center text-gray-500 italic';
      placeholder.textContent = `Insufficient control vehicle data (less than ${minControlVehicles}).`;
      intervalContainer.appendChild(placeholder);
      intervalContainer.classList.add('flex', 'flex-row', 'gap-2');
    } else {
      // Destructure properties needed for plotting (start/end time already used)
      const { control_group_vehicles, test_group_vehicles } = intervalData;

      const plotRow = document.createElement('div');
      plotRow.className = 'flex flex-wrap justify-between'; // Use flexbox to arrange columns

      // Create containers for control and test groups
      const controlGroupContainer = document.createElement('div');
      controlGroupContainer.className =
        'w-full md:w-1/2 pr-2 flex flex-wrap place-content-start'; // Half width on medium screens and up, padding right
      const controlGroupHeader = document.createElement('h3');
      controlGroupHeader.className = 'w-full text-sm mb-1 text-center';
      controlGroupHeader.textContent = `Control Group (n=${control_group_vehicles.length})`;
      controlGroupContainer.appendChild(controlGroupHeader);

      const testGroupContainer = document.createElement('div');
      testGroupContainer.className =
        'w-full md:w-1/2 pl-2 flex flex-wrap place-content-start'; // Half width on medium screens and up, padding left
      const testGroupHeader = document.createElement('h3');
      testGroupHeader.className = 'w-full text-sm mb-1 text-center';
      testGroupHeader.textContent = `Test Group (n=${test_group_vehicles.length})`;
      testGroupContainer.appendChild(testGroupHeader);

      // Generate and append plots for control group vehicles
      if (control_group_vehicles.length > 0) {
        control_group_vehicles.forEach((vehicle) => {
          const plotElement = plotVehicleSpeed(vehicle);
          if (plotElement) {
            controlGroupContainer.appendChild(plotElement);
          }
        });
      } else {
        controlGroupContainer.innerHTML +=
          '<p class="text-center text-gray-500 italic">No control vehicles in this interval.</p>';
      }

      // Generate and append plots for test group vehicles
      if (test_group_vehicles.length > 0) {
        test_group_vehicles.forEach((vehicle) => {
          const plotElement = plotVehicleSpeed(vehicle);
          if (plotElement) {
            testGroupContainer.appendChild(plotElement);
          }
        });
      } else {
        testGroupContainer.innerHTML +=
          '<p class="text-center text-gray-500 italic">No test vehicles in this interval.</p>';
      }

      // Append group containers to the row
      plotRow.appendChild(controlGroupContainer);
      plotRow.appendChild(testGroupContainer);
      intervalContainer.appendChild(plotRow); // Append the row to the interval container
    }

    plotsContainer.appendChild(intervalContainer); // Append interval container to main plots container
  });
}

/**
 * Sets up the time interval selector buttons.
 * @param {function(number): void} onChangeCallback - Function to call when the interval changes. Passes the interval in minutes.
 */
export function setupTimeIntervalButtons(onChangeCallback) {
  const container = document.getElementById('time-interval-selector');
  if (!container) {
    console.error('Time interval selector container not found');
    return;
  }
  const buttons = container.querySelectorAll('.time-interval-btn');
  let selectedInterval = 60; // Default to 1 hr (as set in HTML)

  // Find initial selected interval from HTML classes
  buttons.forEach((button) => {
    if (button.classList.contains('bg-blue-500')) {
      selectedInterval = parseInt(button.dataset.interval, 10);
    }
  });

  console.log(`Initial time interval selected: ${selectedInterval} minutes`);
  // Call the callback initially
  onChangeCallback(selectedInterval);

  container.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('time-interval-btn')) {
      const newInterval = parseInt(target.dataset.interval, 10);
      if (newInterval !== selectedInterval) {
        selectedInterval = newInterval;
        console.log(`Time interval changed to: ${selectedInterval} minutes`);

        // Update button styles
        buttons.forEach((button) => {
          button.classList.remove(
            'bg-blue-500',
            'hover:bg-blue-700',
            'text-white',
          );
          button.classList.add(
            'bg-gray-300',
            'hover:bg-gray-400',
            'text-gray-800',
          );
        });
        target.classList.remove(
          'bg-gray-300',
          'hover:bg-gray-400',
          'text-gray-800',
        );
        target.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white');

        // Notify the main script
        onChangeCallback(selectedInterval);
      }
    }
  });
}
