import React, { useEffect, useRef } from 'react';
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';
import type { VehicleData } from '../types'; // Import the types

interface SparklineProps {
  vehicleData: VehicleData;
}

export default function Sparkline({ vehicleData }: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    data: data,
    vehicle_id: vehicleId,
    visit_date: visitDate,
  } = vehicleData;

  useEffect(() => {
    if (!data || data.length === 0 || !containerRef.current) {
      // Optionally render a placeholder or error message if data is missing
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<p class="text-xs text-gray-500">No data to display.</p>';
      }
      return;
    }

    // Clear previous plot
    containerRef.current.innerHTML = '';

    const titleText = `Vehicle ID: ${vehicleId || 'Unknown'}`;

    // Create the title element
    const titleElement = document.createElement('h3');
    titleElement.className = 'vehicle-plot-title text-xs';
    titleElement.textContent = titleText;
    containerRef.current.appendChild(titleElement);

    const plot = Plot.plot({
      marks: [
        Plot.lineY(data, {
          x: 'event_time',
          y: 'speed',
          stroke: 'steelblue',
        }),
        Plot.ruleX([visitDate], {
          // visitDate is now ensured to be a Date object
          stroke: 'red',
          strokeDasharray: '4,2',
        }),
      ],
      x: {
        type: 'time',
        label: 'Time',
        tickFormat: d3.timeFormat('%I:%M %p') as (
          domainValue: Date | d3.NumberValue,
          index: number,
        ) => string,
      },
      y: {
        grid: true,
        label: 'Speed (mph)',
        domain: [0, 70],
      },
      width: 200,
      height: 100,
    });

    if (plot) {
      containerRef.current.appendChild(plot);
    }
  }, [data, vehicleId, visitDate]); // Dependencies for useEffect

  return <div ref={containerRef} className='vehicle-plot-container' />;
}
