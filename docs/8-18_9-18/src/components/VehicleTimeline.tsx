import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { VehicleData } from '@/types';
import { colors } from '@/utils';

interface VehicleTimelineProps {
  data: VehicleData[];
}

interface DateCount {
  date: Date;
  control: number;
}

export default function VehicleTimeline({ data }: VehicleTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Filter to control vehicles only and aggregate by date
    const controlData = data.filter((d) => d.is_control_group);
    const dateCounts = d3.rollup(
      controlData,
      (v) => v.length,
      (d) => d3.timeDay.floor(new Date(d.visit_date)).getTime(),
    );

    const aggregated: DateCount[] = Array.from(dateCounts, ([time, count]) => ({
      date: new Date(time),
      control: count,
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Chart dimensions
    const margin = { top: 16, right: 24, bottom: 48, left: 56 };
    const width = 800;
    const height = 150;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'w-full h-auto');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales - fixed date range: Aug 18, 2025 to Sep 18, 2025 (with padding)
    const minDate = new Date(2025, 7, 18); // Aug 18, 2025
    const maxDate = new Date(2025, 8, 18); // Sep 18, 2025
    const x = d3
      .scaleTime()
      .domain([
        d3.timeDay.offset(minDate, -0.5),
        d3.timeDay.offset(maxDate, 0.5),
      ])
      .range([0, innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(aggregated, (d) => d.control) ?? 0])
      .nice()
      .range([innerHeight, 0]);

    // Bar width = 1 day in pixels, with some padding
    const barWidth = Math.max(
      1,
      x(d3.timeDay.offset(minDate, 1)) - x(minDate) - 2,
    );

    // Axes
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeDay.every(1))
          .tickSizeOuter(0)
          .tickFormat((d) => d3.timeFormat('%b %d')(d as Date)),
      );

    xAxis
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.25em')
      .attr('class', 'text-xs fill-gray-600');

    xAxis.select('.domain').attr('class', 'stroke-gray-300');
    xAxis.selectAll('.tick line').attr('class', 'stroke-gray-300');

    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(6));

    yAxis.select('.domain').attr('class', 'stroke-gray-300');
    yAxis.selectAll('.tick line').attr('class', 'stroke-gray-300');
    yAxis.selectAll('text').attr('class', 'text-xs fill-gray-600');

    // Y-axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 16)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-sm fill-gray-700 font-medium')
      .text('Vehicle Count');

    g.selectAll('.bar-control')
      .data(aggregated)
      .join('rect')
      .attr('class', 'bar-control')
      .attr('fill', colors.orange)
      .attr('x', (d) => x(d.date) - barWidth / 2)
      .attr('y', (d) => y(d.control))
      .attr('width', barWidth)
      .attr('height', (d) => innerHeight - y(d.control))
      .attr('rx', 1);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className='bg-white rounded-lg border border-gray-200 p-6'>
        <p className='text-gray-500 text-center'>No vehicle data available</p>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg border border-gray-200 p-4'>
      <h3 className='text-sm font-semibold text-gray-800 '>
        Control Vehicles by Visit Date
      </h3>
      <svg ref={svgRef} />
    </div>
  );
}
