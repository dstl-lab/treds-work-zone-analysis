import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { VehicleData } from '@/types';
import { colors } from '@/utils';

interface SyncedSpeedPlotsProps {
  data: VehicleData[];
}

interface BinnedData {
  time: Date;
  avgSpeed: number;
  count: number;
}

const AVG_HEIGHT = 240;
const RAW_HEIGHT = 320;
const HEADER_HEIGHT = 32;
const GAP = 16;
const MARGIN = { top: 16, right: 24, bottom: 40, left: 48 };

export default function SyncedSpeedPlots({ data }: SyncedSpeedPlotsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const testCount = data.filter((d) => !d.is_control_group).length;
  const controlCount = data.filter((d) => d.is_control_group).length;

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Calculate shared time extent and dimensions
  const { timeExtent, totalWidth } = useMemo(() => {
    if (data.length === 0) {
      return { timeExtent: null, totalWidth: 800 };
    }

    const allTimes = data.flatMap((v) =>
      v.data.map((d) => new Date(d.event_time)),
    );

    if (allTimes.length === 0) {
      return { timeExtent: null, totalWidth: 800 };
    }

    const extent = d3.extent(allTimes) as [Date, Date];
    const duration = extent[1].getTime() - extent[0].getTime();
    const hours = duration / (1000 * 60 * 60);
    const width = Math.max(containerWidth - MARGIN.left, hours * 1000);

    return { timeExtent: extent, totalWidth: width };
  }, [data, containerWidth]);

  // Calculate binned data for average speed plot
  const { controlSegments, testSegments, avgMaxSpeed } = useMemo(() => {
    if (!timeExtent || data.length === 0) {
      return { controlSegments: [], testSegments: [], avgMaxSpeed: 80 };
    }

    const allPoints = data.flatMap((v) =>
      v.data.map((d) => ({
        time: new Date(d.event_time),
        speed: d.speed,
        isControl: v.is_control_group,
      })),
    );

    const binInterval = 60 * 1000;
    const controlPoints = allPoints.filter((p) => p.isControl);
    const testPoints = allPoints.filter((p) => !p.isControl);

    const binData = (
      points: typeof allPoints,
    ): { binIndex: number; data: BinnedData }[] => {
      const bins: Map<number, { speeds: number[]; time: Date }> = new Map();

      points.forEach((p) => {
        const binIndex = Math.floor(
          (p.time.getTime() - timeExtent[0].getTime()) / binInterval,
        );
        const binTime = new Date(
          timeExtent[0].getTime() + binIndex * binInterval + binInterval / 2,
        );

        if (!bins.has(binIndex)) {
          bins.set(binIndex, { speeds: [], time: binTime });
        }
        bins.get(binIndex)!.speeds.push(p.speed);
      });

      return Array.from(bins.entries())
        .map(([binIndex, bin]) => ({
          binIndex,
          data: {
            time: bin.time,
            avgSpeed: d3.mean(bin.speeds) ?? 0,
            count: bin.speeds.length,
          },
        }))
        .sort((a, b) => a.binIndex - b.binIndex);
    };

    const splitIntoSegments = (
      binsWithIndex: { binIndex: number; data: BinnedData }[],
    ): BinnedData[][] => {
      if (binsWithIndex.length === 0) return [];

      const segments: BinnedData[][] = [];
      let currentSegment: BinnedData[] = [binsWithIndex[0].data];

      for (let i = 1; i < binsWithIndex.length; i++) {
        const gap = binsWithIndex[i].binIndex - binsWithIndex[i - 1].binIndex;
        if (gap > 1) {
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
          }
          currentSegment = [binsWithIndex[i].data];
        } else {
          currentSegment.push(binsWithIndex[i].data);
        }
      }

      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      return segments;
    };

    const cBinsWithIndex = binData(controlPoints);
    const tBinsWithIndex = binData(testPoints);

    const allAvgSpeeds = [
      ...cBinsWithIndex.map((b) => b.data.avgSpeed),
      ...tBinsWithIndex.map((b) => b.data.avgSpeed),
    ];
    const max = d3.max(allAvgSpeeds) ?? 80;

    return {
      controlSegments: splitIntoSegments(cBinsWithIndex),
      testSegments: splitIntoSegments(tBinsWithIndex),
      avgMaxSpeed: max,
    };
  }, [data, timeExtent]);

  // Calculate raw speed max
  const rawMaxSpeed = useMemo(() => {
    if (data.length === 0) return 100;
    const allSpeeds = data.flatMap((v) => v.data.map((d) => d.speed));
    return d3.max(allSpeeds) ?? 100;
  }, [data]);

  // Render charts
  useEffect(() => {
    if (!containerRef.current || !timeExtent) return;

    d3.select(containerRef.current).selectAll('*').remove();

    const totalHeight =
      HEADER_HEIGHT + AVG_HEIGHT + GAP + HEADER_HEIGHT + RAW_HEIGHT;

    // Shared X scale
    const x = d3
      .scaleTime()
      .domain(timeExtent)
      .range([0, totalWidth - MARGIN.right]);

    // Y scales
    const yAvg = d3
      .scaleLinear()
      .domain([0, Math.max(avgMaxSpeed, 80)])
      .nice()
      .range([AVG_HEIGHT - MARGIN.bottom, MARGIN.top]);

    const yRaw = d3
      .scaleLinear()
      .domain([-2, rawMaxSpeed])
      .nice()
      .range([RAW_HEIGHT - MARGIN.bottom, MARGIN.top]);

    // Create flex container
    const container = d3
      .select(containerRef.current)
      .style('display', 'flex')
      .style('height', `${totalHeight}px`);

    // === Fixed Y-axis column ===
    const yAxisCol = container
      .append('div')
      .style('flex-shrink', '0')
      .style('width', `${MARGIN.left}px`)
      .style('background', 'white')
      .style('z-index', '10');

    // Spacer for first header
    yAxisCol.append('div').style('height', `${HEADER_HEIGHT}px`);

    // Y-axis for average speed plot
    const yAxisSvg1 = yAxisCol
      .append('svg')
      .attr('width', MARGIN.left)
      .attr('height', AVG_HEIGHT);

    const yAxisGroup1 = yAxisSvg1
      .append('g')
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(yAvg).ticks(5));

    yAxisGroup1.select('.domain').attr('class', 'stroke-gray-300');
    yAxisGroup1.selectAll('.tick line').attr('class', 'stroke-gray-300');
    yAxisGroup1.selectAll('text').attr('class', 'text-xs fill-gray-600');

    yAxisSvg1
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 12)
      .attr('x', -(AVG_HEIGHT - MARGIN.bottom + MARGIN.top) / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs fill-gray-700 font-medium')
      .text('Avg Speed (mph)');

    // Gap + second header spacer
    yAxisCol.append('div').style('height', `${GAP + HEADER_HEIGHT}px`);

    // Y-axis for raw speed plot
    const yAxisSvg2 = yAxisCol
      .append('svg')
      .attr('width', MARGIN.left)
      .attr('height', RAW_HEIGHT);

    const yAxisGroup2 = yAxisSvg2
      .append('g')
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(yRaw).ticks(6));

    yAxisGroup2.select('.domain').attr('class', 'stroke-gray-300');
    yAxisGroup2.selectAll('.tick line').attr('class', 'stroke-gray-300');
    yAxisGroup2.selectAll('text').attr('class', 'text-xs fill-gray-600');

    yAxisSvg2
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 12)
      .attr('x', -(RAW_HEIGHT - MARGIN.bottom + MARGIN.top) / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs fill-gray-700 font-medium')
      .text('Speed (mph)');

    // === Scrollable charts area ===
    const scrollContainer = container
      .append('div')
      .style('flex', '1')
      .style('overflow-x', 'scroll')
      .style('-webkit-overflow-scrolling', 'touch');

    const chartsWrapper = scrollContainer
      .append('div')
      .style('width', `${totalWidth}px`)
      .style('min-width', '100%');

    // First header spacer (charts start after header)
    chartsWrapper.append('div').style('height', `${HEADER_HEIGHT}px`);

    // === Average Speed Chart ===
    const svg1 = chartsWrapper
      .append('svg')
      .attr('width', totalWidth)
      .attr('height', AVG_HEIGHT)
      .style('display', 'block');

    // Grid lines
    const yTicks1 = yAvg.ticks(5);
    svg1
      .append('g')
      .selectAll('line')
      .data(yTicks1)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', totalWidth - MARGIN.right)
      .attr('y1', (d) => yAvg(d))
      .attr('y2', (d) => yAvg(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Reference line at 55
    svg1
      .append('line')
      .attr('x1', 0)
      .attr('x2', totalWidth - MARGIN.right)
      .attr('y1', yAvg(55))
      .attr('y2', yAvg(55))
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4');

    // X-axis
    const xAxisGroup1 = svg1
      .append('g')
      .attr('transform', `translate(0,${AVG_HEIGHT - MARGIN.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(Math.max(4, Math.floor(totalWidth / 120)))
          .tickSizeOuter(0),
      );

    xAxisGroup1.select('.domain').attr('class', 'stroke-gray-300');
    xAxisGroup1.selectAll('.tick line').attr('class', 'stroke-gray-300');
    xAxisGroup1.selectAll('text').attr('class', 'text-xs fill-gray-600');

    // Line and area generators for avg plot
    const avgLine = d3
      .line<BinnedData>()
      .x((d) => x(d.time))
      .y((d) => yAvg(d.avgSpeed))
      .curve(d3.curveMonotoneX);

    const avgArea = d3
      .area<BinnedData>()
      .x((d) => x(d.time))
      .y0(AVG_HEIGHT - MARGIN.bottom)
      .y1((d) => yAvg(d.avgSpeed))
      .curve(d3.curveMonotoneX);

    // Draw areas
    testSegments.forEach((segment) => {
      if (segment.length > 1) {
        svg1
          .append('path')
          .datum(segment)
          .attr('fill', colors.blue)
          .attr('fill-opacity', 0.08)
          .attr('d', avgArea);
      }
    });

    controlSegments.forEach((segment) => {
      if (segment.length > 1) {
        svg1
          .append('path')
          .datum(segment)
          .attr('fill', colors.orange)
          .attr('fill-opacity', 0.08)
          .attr('d', avgArea);
      }
    });

    // Draw lines
    testSegments.forEach((segment) => {
      if (segment.length > 1) {
        svg1
          .append('path')
          .datum(segment)
          .attr('fill', 'none')
          .attr('stroke', colors.blue)
          .attr('stroke-width', 2.5)
          .attr('d', avgLine);
      }
    });

    controlSegments.forEach((segment) => {
      if (segment.length > 1) {
        svg1
          .append('path')
          .datum(segment)
          .attr('fill', 'none')
          .attr('stroke', colors.orange)
          .attr('stroke-width', 2.5)
          .attr('d', avgLine);
      }
    });

    // Gap + second header spacer
    chartsWrapper.append('div').style('height', `${GAP + HEADER_HEIGHT}px`);

    // === Raw Speed Chart ===
    const svg2 = chartsWrapper
      .append('svg')
      .attr('width', totalWidth)
      .attr('height', RAW_HEIGHT)
      .style('display', 'block');

    // Grid lines
    const yTicks2 = yRaw.ticks(6);
    svg2
      .append('g')
      .selectAll('line')
      .data(yTicks2)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', totalWidth - MARGIN.right)
      .attr('y1', (d) => yRaw(d))
      .attr('y2', (d) => yRaw(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Reference line at 55
    svg2
      .append('line')
      .attr('x1', 0)
      .attr('x2', totalWidth - MARGIN.right)
      .attr('y1', yRaw(55))
      .attr('y2', yRaw(55))
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1.5);

    // X-axis
    const xAxisGroup2 = svg2
      .append('g')
      .attr('transform', `translate(0,${RAW_HEIGHT - MARGIN.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(Math.max(4, Math.floor(totalWidth / 120)))
          .tickSizeOuter(0),
      );

    xAxisGroup2.select('.domain').attr('class', 'stroke-gray-300');
    xAxisGroup2.selectAll('.tick line').attr('class', 'stroke-gray-300');
    xAxisGroup2.selectAll('text').attr('class', 'text-xs fill-gray-600');

    // Line generator for raw plot
    const rawLine = d3
      .line<{ event_time: Date; speed: number }>()
      .x((d) => x(d.event_time))
      .y((d) => yRaw(d.speed));

    // Sort vehicles: test first, control on top
    const sortedVehicles = [...data].sort(
      (a, b) => (a.is_control_group ? 1 : 0) - (b.is_control_group ? 1 : 0),
    );

    // Draw vehicle lines
    sortedVehicles.forEach((vehicle) => {
      if (vehicle.data.length < 2) return;

      const sortedData = [...vehicle.data].sort(
        (a, b) =>
          new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
      );

      svg2
        .append('path')
        .datum(sortedData)
        .attr('fill', 'none')
        .attr('stroke', vehicle.is_control_group ? colors.orange : colors.blue)
        .attr('stroke-width', 2)
        .attr('d', rawLine);
    });
  }, [
    timeExtent,
    totalWidth,
    containerWidth,
    controlSegments,
    testSegments,
    avgMaxSpeed,
    rawMaxSpeed,
    data,
  ]);

  if (data.length === 0) {
    return null;
  }

  const totalHeight =
    HEADER_HEIGHT + AVG_HEIGHT + GAP + HEADER_HEIGHT + RAW_HEIGHT;

  const legend = (
    <div className='flex items-center gap-4 text-xs shrink-0'>
      <span className='flex items-center gap-1.5'>
        <span
          className='w-3 h-0.5 rounded'
          style={{ backgroundColor: colors.blue }}
        />
        Test (n={testCount})
      </span>
      <span className='flex items-center gap-1.5'>
        <span
          className='w-3 h-0.5 rounded'
          style={{ backgroundColor: colors.orange }}
        />
        Control (n={controlCount})
      </span>
    </div>
  );

  return (
    <div className='bg-white rounded-lg border border-gray-200 p-4 relative'>
      {/* Fixed headers overlay */}
      <div
        className='absolute left-4 right-4 pointer-events-none z-20'
        style={{ top: 16 }}
      >
        <div
          className='flex items-center justify-between bg-white'
          style={{ height: HEADER_HEIGHT }}
        >
          <h3 className='text-sm font-semibold text-gray-800'>
            Average Vehicle Speeds Over Time
          </h3>
          {legend}
        </div>
        <div style={{ height: AVG_HEIGHT + GAP }} />
        <div
          className='flex items-center justify-between bg-white'
          style={{ height: HEADER_HEIGHT }}
        >
          <h3 className='text-sm font-semibold text-gray-800'>
            Raw Vehicle Speeds Over Time
          </h3>
          {legend}
        </div>
      </div>

      {/* Charts container */}
      <div ref={containerRef} style={{ height: totalHeight }} />
    </div>
  );
}
