import React, { useRef, useState } from 'react';
import {
  clampPreferenceWeight,
  type PreferenceDimensionDefinition,
  type PreferenceDimensionId,
  type PreferenceWeights,
} from '../utils/customRanking';
import { getRadarDomainLines } from './RadarChart';

interface PreferenceRadarProps {
  dimensions: readonly PreferenceDimensionDefinition[];
  weights: PreferenceWeights;
  onChange: (dimensionId: PreferenceDimensionId, value: number) => void;
  ariaLabel: string;
  testId: string;
  size?: number;
  valueFormatter?: (value: number) => string;
}

export const PreferenceRadar: React.FC<PreferenceRadarProps> = ({
  dimensions,
  weights,
  onChange,
  ariaLabel,
  testId,
  size = 420,
  valueFormatter,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const activeDimensionRef = useRef<PreferenceDimensionId | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [activeDimension, setActiveDimension] = useState<PreferenceDimensionId | null>(null);
  const center = size / 2;
  const radius = size * 0.33;
  const labelRadius = radius + size * 0.105;

  const getAngle = (index: number) => (
    (index * 2 * Math.PI) / dimensions.length - Math.PI / 2
  );

  const getPoint = (value: number, index: number) => {
    const angle = getAngle(index);
    const pointRadius = (clampPreferenceWeight(value) / 100) * radius;
    return {
      x: center + pointRadius * Math.cos(angle),
      y: center + pointRadius * Math.sin(angle),
    };
  };

  const polygonPoints = dimensions.map((dimension, index) => {
    const point = getPoint(weights[dimension.id], index);
    return `${point.x},${point.y}`;
  }).join(' ');

  const updateFromClientPoint = (
    clientX: number,
    clientY: number,
    dimensionId: PreferenceDimensionId,
    index: number,
  ) => {
    const svg = svgRef.current;
    if (!svg) return;

    const bounds = svg.getBoundingClientRect();
    const svgX = ((clientX - bounds.left) / bounds.width) * size;
    const svgY = ((clientY - bounds.top) / bounds.height) * size;
    const angle = getAngle(index);
    const projection = (svgX - center) * Math.cos(angle)
      + (svgY - center) * Math.sin(angle);
    onChange(dimensionId, (projection / radius) * 100);
  };

  const rings = [25, 50, 75, 100];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      className="w-full select-none overflow-visible touch-none"
      role="group"
      aria-label={ariaLabel}
      data-testid={testId}
      onPointerMove={(event) => {
        const dimensionId = activeDimensionRef.current;
        const index = activeIndexRef.current;
        if (dimensionId !== null && index !== null) {
          updateFromClientPoint(event.clientX, event.clientY, dimensionId, index);
        }
      }}
      onPointerUp={(event) => {
        if (activePointerIdRef.current === event.pointerId && svgRef.current?.hasPointerCapture(event.pointerId)) {
          svgRef.current.releasePointerCapture(event.pointerId);
        }
        activeDimensionRef.current = null;
        activeIndexRef.current = null;
        activePointerIdRef.current = null;
        setActiveDimension(null);
      }}
      onPointerCancel={() => {
        activeDimensionRef.current = null;
        activeIndexRef.current = null;
        activePointerIdRef.current = null;
        setActiveDimension(null);
      }}
      onLostPointerCapture={() => {
        activeDimensionRef.current = null;
        activeIndexRef.current = null;
        activePointerIdRef.current = null;
        setActiveDimension(null);
      }}
    >
      {rings.map((ring) => {
        const points = dimensions.map((_, index) => {
          const point = getPoint(ring, index);
          return `${point.x},${point.y}`;
        }).join(' ');

        return (
          <polygon
            key={ring}
            points={points}
            fill={ring === 100 ? '#FAFAFA' : 'none'}
            stroke={ring === 100 ? '#D4D4D4' : '#E5E5E5'}
            strokeWidth={ring === 100 ? 1.5 : 1}
          />
        );
      })}

      {dimensions.map((_, index) => {
        const angle = getAngle(index);
        return (
          <line
            key={`spoke-${index}`}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="#E5E5E5"
            strokeWidth="1"
          />
        );
      })}

      <polygon
        points={polygonPoints}
        fill="#581C87"
        fillOpacity="0.12"
        stroke="#581C87"
        strokeWidth="3"
        strokeLinejoin="round"
        className="transition-[points] duration-100"
      />

      {dimensions.map((dimension, index) => {
        const point = getPoint(weights[dimension.id], index);
        const isActive = activeDimension === dimension.id;
        const clampedValue = clampPreferenceWeight(weights[dimension.id]);

        return (
          <g
            key={dimension.id}
            role="slider"
            tabIndex={0}
            aria-label={`${dimension.label}关心程度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clampedValue}
            aria-valuetext={valueFormatter ? valueFormatter(clampedValue) : `${clampedValue} 分`}
            data-testid={`preference-handle-${dimension.id}`}
            className="group cursor-grab outline-none focus-visible:cursor-grabbing"
            onPointerDown={(event) => {
              event.preventDefault();
              svgRef.current?.setPointerCapture(event.pointerId);
              activeDimensionRef.current = dimension.id;
              activeIndexRef.current = index;
              activePointerIdRef.current = event.pointerId;
              setActiveDimension(dimension.id);
              updateFromClientPoint(event.clientX, event.clientY, dimension.id, index);
            }}
            onKeyDown={(event) => {
              const current = weights[dimension.id];
              let next = current;
              if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next += 5;
              if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next -= 5;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = 100;
              if (next !== current) {
                event.preventDefault();
                onChange(dimension.id, next);
              }
            }}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r="15"
              fill="transparent"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={isActive ? 8 : 6.5}
              fill={dimension.color}
              stroke="#FFFFFF"
              strokeWidth="3"
              className="drop-shadow-sm transition-all"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={isActive ? 11 : 9}
              fill="none"
              stroke={isActive ? '#171717' : 'transparent'}
              strokeWidth="1.5"
              className="group-focus-visible:stroke-neutral-950"
            />
          </g>
        );
      })}

      {dimensions.map((dimension, index) => {
        const angle = getAngle(index);
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        const labelLines = getRadarDomainLines(dimension.shortLabel);
        const clampedValue = clampPreferenceWeight(weights[dimension.id]);
        const displayedValue = valueFormatter
          ? valueFormatter(clampedValue)
          : String(clampedValue);
        const cosine = Math.cos(angle);
        const textAnchor = Math.abs(cosine) < 0.15
          ? 'middle'
          : cosine > 0 ? 'start' : 'end';
        const lineGap = Math.max(11, size * 0.035);

        return (
          <g
            key={`label-${dimension.id}`}
            className="pointer-events-none font-brand-mono select-none"
          >
            <text
              x={x}
              y={y - lineGap * 0.6}
              fill={dimension.color}
              fontSize="13"
              fontWeight="900"
              textAnchor={textAnchor}
              dominantBaseline="central"
            >
              {displayedValue}
            </text>
            {labelLines.map((line, lineIndex) => (
              <text
                key={`${dimension.id}-line-${lineIndex}`}
                x={x}
                y={y + lineGap * (0.55 + lineIndex * 0.95)}
                fill={dimension.color}
                fontSize="9"
                fontWeight="700"
                textAnchor={textAnchor}
                dominantBaseline="central"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};
