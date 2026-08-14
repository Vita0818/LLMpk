import React, { useState } from 'react';
import { DomainId } from '../types/llm_pk';
import { DOMAIN_DEFINITIONS } from '../engine/scoringEngine';

export interface RadarSeries {
  id: string;
  name: string;
  color: string;
  /** Custom fill color for the data polygon (e.g. 'transparent', '#3B82F6'). Defaults to `color`. */
  fillColor?: string;
  /** Custom fill opacity for the data polygon. Defaults to 0.18 (or 0.14 when domains are missing). */
  fillOpacity?: number | string;
  /** Null means the domain has zero real observations and is not plotted. */
  scores: Record<DomainId, number | null>;
}

interface RadarChartProps {
  seriesList: RadarSeries[];
  size?: number;
  showLegend?: boolean;
  hoveredDomain?: DomainId | null;
  onHoverDomain?: (domain: DomainId | null) => void;
  showDomainNames?: boolean;
  animateSeries?: boolean;
}

const DOMAIN_ORDER: DomainId[] = [
  'chatting',
  'math_science',
  'coding',
  'engineering',
  'agentic_work',
  'search_knowledge',
];

export const getRadarDomainLines = (nameEn: string): string[] => {
  if (nameEn === 'Chatting & Dialogue') return ['Chatting & Dialogue'];
  if (nameEn === 'Math & Science Reasoning') return ['Math & Science', 'Reasoning'];
  if (nameEn === 'Coding') return ['Coding'];
  if (nameEn === 'Engineering') return ['Engineering'];
  if (nameEn === 'Agentic Work') return ['Agentic Work'];
  if (nameEn === 'Search & Knowledge') return ['Search &', 'Knowledge'];
  const parts = nameEn.split(' ');
  if (parts.length <= 2) return [nameEn];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
};

export const RadarChart: React.FC<RadarChartProps> = ({
  seriesList,
  size = 360,
  showLegend = true,
  hoveredDomain: controlledHoveredDomain,
  onHoverDomain,
  showDomainNames = true,
  animateSeries = false,
}) => {
  const [internalHoveredDomain, setInternalHoveredDomain] = useState<DomainId | null>(null);
  const hoveredDomain = controlledHoveredDomain !== undefined ? controlledHoveredDomain : internalHoveredDomain;

  const handleSetHoveredDomain = (d: DomainId | null) => {
    setInternalHoveredDomain(d);
    if (onHoverDomain) {
      onHoverDomain(d);
    }
  };

  const center = size / 2;
  const radius = (size / 2) * 0.78;

  const getAngle = (index: number) => {
    return (index * 2 * Math.PI) / 6 - Math.PI / 2;
  };

  const getPointCoordinates = (value: number, index: number) => {
    const angle = getAngle(index);
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // This marker sits just outside the scale rather than at a numeric value, so
  // an unavailable domain cannot be mistaken for 0, 50, or 100.
  const getMissingMarkerCoordinates = (index: number) => {
    const angle = getAngle(index);
    const markerRadius = radius + 6;
    return {
      x: center + markerRadius * Math.cos(angle),
      y: center + markerRadius * Math.sin(angle),
    };
  };

  const isAvailableScore = (value: number | null | undefined): value is number => (
    typeof value === 'number' && Number.isFinite(value)
  );

  const rings = [20, 40, 60, 80, 100];

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-full max-w-[680px] aspect-square flex items-center justify-center" style={{ maxWidth: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
          {/* Background Grid Rings */}
          {rings.map((ringValue) => {
            const points = DOMAIN_ORDER.map((_, idx) => {
              const { x, y } = getPointCoordinates(ringValue, idx);
              return `${x},${y}`;
            }).join(' ');

            return (
              <polygon
                key={`ring-${ringValue}`}
                points={points}
                fill={ringValue === 100 ? '#F8FAFC' : 'none'}
                stroke={ringValue === 100 ? '#CBD5E1' : '#E2E8F0'}
                strokeDasharray={ringValue === 50 ? '3,3' : undefined}
                strokeWidth={ringValue === 100 ? '1.5' : '1'}
              />
            );
          })}

          {/* Spokes */}
          {DOMAIN_ORDER.map((dId, idx) => {
            const angle = getAngle(idx);
            const x2 = center + radius * Math.cos(angle);
            const y2 = center + radius * Math.sin(angle);
            const isHovered = hoveredDomain === dId;

            return (
              <line
                key={`spoke-${dId}`}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
            );
          })}

          {/* Series Data Polygons */}
          {seriesList.map((series) => {
            const points = DOMAIN_ORDER.map((dId, idx) => {
              const value = series.scores[dId];
              return {
                dId,
                idx,
                value,
                isAvailable: isAvailableScore(value),
                ...(isAvailableScore(value) ? getPointCoordinates(value, idx) : getMissingMarkerCoordinates(idx)),
              };
            });
            const availablePoints = points.filter((point) => point.isAvailable);
            const hasMissingDomain = points.some((point) => !point.isAvailable);
            const fullPolygonPoints = points.map(({ x, y }) => `${x},${y}`).join(' ');
            const availablePolygonPoints = availablePoints.map(({ x, y }) => `${x},${y}`).join(' ');

            const polygonFill = series.fillColor ?? series.color;
            const polygonOpacity = series.fillOpacity ?? '0.18';
            const missingPolygonOpacity = series.fillOpacity ?? '0.14';

            return (
              <g
                key={`series-group-${series.id}`}
                className={animateSeries ? 'radar-series-enter' : undefined}
              >
                {hasMissingDomain ? (
                  availablePoints.length >= 3 ? (
                    <polygon
                      points={availablePolygonPoints}
                      fill={polygonFill}
                      fillOpacity={missingPolygonOpacity}
                      stroke={series.color}
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      className="transition-all duration-200"
                    />
                  ) : availablePoints.length === 2 ? (
                    <line
                      x1={availablePoints[0].x}
                      y1={availablePoints[0].y}
                      x2={availablePoints[1].x}
                      y2={availablePoints[1].y}
                      stroke={series.color}
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      className="transition-all duration-200"
                    />
                  ) : null
                ) : (
                  <polygon
                    points={fullPolygonPoints}
                    fill={polygonFill}
                    fillOpacity={polygonOpacity}
                    stroke={series.color}
                    strokeWidth="3"
                    className="transition-all duration-200"
                  />
                )}

                {points.map((point) => {
                  const isHovered = hoveredDomain === point.dId;

                  if (!isAvailableScore(point.value)) {
                    return null;
                  }

                  return (
                    <circle
                      key={`pt-${series.id}-${point.dId}`}
                      cx={point.x}
                      cy={point.y}
                      r={isHovered ? '7' : '4.5'}
                      fill={series.color}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => handleSetHoveredDomain(point.dId)}
                      onMouseLeave={() => handleSetHoveredDomain(null)}
                    >
                      <title>{`${series.name} - ${DOMAIN_DEFINITIONS[point.dId].name}: ${point.value.toFixed(1)}分`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}

          {/* Vertex Scores rendered directly in Domain Colors */}
          {DOMAIN_ORDER.map((dId, idx) => {
            const angle = getAngle(idx);
            const def = DOMAIN_DEFINITIONS[dId];
            const isHovered = hoveredDomain === dId;

            // Primary series score for this domain
            const scoreVal = seriesList[0]?.scores[dId];
            const hasScore = isAvailableScore(scoreVal);

            // Position and anchor per vertex angle
            let textAnchor: 'start' | 'end' | 'middle' = 'middle';
            let extraRadius = 24;

            if (idx === 0) {
              // TOP vertex (Chatting & Dialogue)
              textAnchor = 'middle';
              extraRadius = 24;
            } else if (idx === 3) {
              // BOTTOM vertex (Engineering)
              textAnchor = 'middle';
              extraRadius = 24;
            } else if (Math.cos(angle) > 0) {
              // RIGHT vertices (Top-Right, Bottom-Right)
              textAnchor = 'start';
              extraRadius = 22;
            } else {
              // LEFT vertices (Top-Left, Bottom-Left)
              textAnchor = 'end';
              extraRadius = 28;
            }

            const labelRadius = radius + extraRadius;
            const lx = center + labelRadius * Math.cos(angle);
            const ly = center + labelRadius * Math.sin(angle);

            // ISOLATED OVERVIEW MODE (showDomainNames === false): Pure Vertex Numeric Scores
            if (!showDomainNames) {
              const overviewRadius = radius + 15;
              const olx = center + overviewRadius * Math.cos(angle);
              const oly = center + overviewRadius * Math.sin(angle);

              let oAnchor: 'start' | 'middle' | 'end' = 'middle';
              if (Math.abs(angle - (-Math.PI / 2)) < 0.1 || Math.abs(angle - (Math.PI / 2)) < 0.1) {
                oAnchor = 'middle';
              } else if (Math.cos(angle) > 0) {
                oAnchor = 'start';
              } else {
                oAnchor = 'end';
              }

              const oScoreFontSize = Math.max(11, Math.round(size / 24));

              return (
                <g
                  key={`vertex-score-${dId}`}
                  className="cursor-pointer group"
                  onMouseEnter={() => handleSetHoveredDomain(dId)}
                  onMouseLeave={() => handleSetHoveredDomain(null)}
                >
                  <text
                    x={olx}
                    y={oly}
                    fill={def.color}
                    fontSize={oScoreFontSize}
                    fontWeight="900"
                    fontFamily="'JetBrains Mono', monospace"
                    textAnchor={oAnchor}
                    dominantBaseline="central"
                    className="font-brand-mono select-none transition-all drop-shadow-2xs"
                    opacity={isHovered ? 1 : 0.95}
                  >
                    {hasScore ? scoreVal.toFixed(1) : '--'}
                    <title>{`${def.name}: ${hasScore ? `${scoreVal.toFixed(1)}分` : '无数据'}`}</title>
                  </text>
                </g>
              );
            }

            // ORIGINAL DETAIL MODE (showDomainNames === true): 100% Untouched
            const scoreFontSize = Math.max(14, Math.round(size / 26));
            const labelFontSize = Math.max(9, Math.round(scoreFontSize * 0.62));
            const lineGap = labelFontSize * 1.35;

            const domainLines = getRadarDomainLines(def.nameEn);

            // Custom vertical line placement per vertex position
            let scoreY = ly - lineGap * 0.75;
            let lineYOffset = (lineIdx: number) => ly + lineGap * (0.5 + lineIdx * 0.95);

            if (idx === 0) {
              // Top vertex: Score at top (ly - 14), Domain Name below (ly + 6)
              scoreY = ly - lineGap * 0.9;
              lineYOffset = (lineIdx: number) => ly + lineGap * (0.35 + lineIdx * 0.95);
            } else if (idx === 3) {
              // Bottom vertex: Score at top (ly + 4), Domain Name below (ly + 22)
              scoreY = ly + lineGap * 0.25;
              lineYOffset = (lineIdx: number) => ly + lineGap * (1.35 + lineIdx * 0.95);
            } else if (idx === 5) {
              // Top-Left vertex cleanly spaced
              scoreY = ly - lineGap * 0.9;
              lineYOffset = (lineIdx: number) => ly + lineGap * (0.2 + lineIdx * 0.95);
            }

            return (
              <g
                key={`vertex-score-${dId}`}
                className="cursor-pointer group"
                onMouseEnter={() => handleSetHoveredDomain(dId)}
                onMouseLeave={() => handleSetHoveredDomain(null)}
              >
                {/* Line 1: Score Number in Domain Color */}
                <text
                  x={lx}
                  y={scoreY}
                  fill={def.color}
                  fontSize={scoreFontSize}
                  fontWeight="900"
                  fontFamily="'JetBrains Mono', monospace"
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  className="font-brand-mono select-none transition-all drop-shadow-2xs"
                  opacity={isHovered ? 1 : 0.95}
                >
                  {hasScore ? scoreVal.toFixed(1) : '--'}
                  <title>{`${def.name}: ${hasScore ? `${scoreVal.toFixed(1)}分` : '无数据'}`}</title>
                </text>

                {/* Line 2 & 3: Full English Domain Name */}
                {domainLines.map((line, lIdx) => (
                  <text
                    key={`line-${lIdx}`}
                    x={lx}
                    y={lineYOffset(lIdx)}
                    fill={def.color}
                    fontSize={labelFontSize}
                    fontWeight="700"
                    fontFamily="'JetBrains Mono', monospace"
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    className="font-brand-mono select-none transition-all"
                    opacity={isHovered ? 1 : 0.85}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Multi-series legend for PK mode only */}
      {showLegend && seriesList.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs">
          {seriesList.map((s) => (
            <div key={`legend-${s.id}`} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-semibold">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
