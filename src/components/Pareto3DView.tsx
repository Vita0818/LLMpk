import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Filter,
  Minus,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import { parseConfigurationName } from './ConfigurationDetailContent';
import { PROVIDER_BRAND_MAP } from '../utils/providerColors';
import {
  buildParetoEnvelopeFaces,
  calculateParetoLayers,
  type ParetoDatum,
} from '../utils/pareto';

interface Pareto3DViewProps {
  scoreItems: readonly PublicLeaderboardScore[];
  onSelectConfigForDetail: (item: PublicLeaderboardScore) => void;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  perspectiveScale: number;
}

type GestureLikeEvent = Event & { scale?: number };

type ViewPreset = 'perspective' | 'cost-intelligence' | 'speed-intelligence' | 'cost-speed' | 'free';
type LabelMode = 'frontier' | 'all' | 'none';

const VIEWBOX_WIDTH = 1100;
const VIEWBOX_HEIGHT = 700;
const SCENE_CENTER_X = 550;
const SCENE_CENTER_Y = 330;
const SCENE_SCALE = 230;
const COST_SYMLOG_CONSTANT = 0.05;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.12;
const WHEEL_ZOOM_SENSITIVITY = Math.log(ZOOM_STEP) / 100;

const CAMERA_PRESETS: Record<Exclude<ViewPreset, 'free'>, {
  yaw: number;
  pitch: number;
  zoom: number;
  orthographic: boolean;
}> = {
  perspective: { yaw: -0.68, pitch: 0.36, zoom: 1, orthographic: false },
  'cost-intelligence': { yaw: 0, pitch: 0, zoom: 1, orthographic: true },
  'speed-intelligence': { yaw: -Math.PI / 2, pitch: 0, zoom: 1, orthographic: true },
  'cost-speed': { yaw: 0, pitch: -Math.PI / 2, zoom: 1, orthographic: true },
};

const CUBE_EDGES: readonly [Point3D, Point3D][] = [
  [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
  [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
  [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }],
  [{ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }],
  [{ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }],
  [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }],
  [{ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 1 }],
  [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
  [{ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }],
  [{ x: 1, y: 1, z: 0 }, { x: 1, y: 1, z: 1 }],
  [{ x: 1, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }],
  [{ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }],
];

const GRID_SEGMENTS: readonly [Point3D, Point3D][] = [0.2, 0.4, 0.6, 0.8].flatMap(
  (fraction) => [
    [{ x: 0, y: 0, z: fraction }, { x: 1, y: 0, z: fraction }],
    [{ x: fraction, y: 0, z: 0 }, { x: fraction, y: 0, z: 1 }],
    [{ x: 0, y: fraction, z: 0 }, { x: 1, y: fraction, z: 0 }],
    [{ x: fraction, y: 0, z: 0 }, { x: fraction, y: 1, z: 0 }],
    [{ x: 0, y: fraction, z: 0 }, { x: 0, y: fraction, z: 1 }],
    [{ x: 0, y: 0, z: fraction }, { x: 0, y: 1, z: fraction }],
  ] as [Point3D, Point3D][],
);

const PLANE_EDGES: Record<
  Exclude<ViewPreset, 'perspective' | 'free'>,
  readonly [Point3D, Point3D][]
> = {
  'cost-intelligence': [
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
    [{ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }],
    [{ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }],
    [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }],
  ],
  'speed-intelligence': [
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }],
    [{ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }],
    [{ x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: 0 }],
    [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }],
  ],
  'cost-speed': [
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
    [{ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }],
    [{ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }],
    [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }],
  ],
};

const PLANE_GRID_SEGMENTS: Record<
  Exclude<ViewPreset, 'perspective' | 'free'>,
  readonly [Point3D, Point3D][]
> = {
  'cost-intelligence': [0.2, 0.4, 0.6, 0.8].flatMap((fraction) => [
    [{ x: 0, y: fraction, z: 0 }, { x: 1, y: fraction, z: 0 }],
    [{ x: fraction, y: 0, z: 0 }, { x: fraction, y: 1, z: 0 }],
  ] as [Point3D, Point3D][]),
  'speed-intelligence': [0.2, 0.4, 0.6, 0.8].flatMap((fraction) => [
    [{ x: 0, y: fraction, z: 0 }, { x: 0, y: fraction, z: 1 }],
    [{ x: 0, y: 0, z: fraction }, { x: 0, y: 1, z: fraction }],
  ] as [Point3D, Point3D][]),
  'cost-speed': [0.2, 0.4, 0.6, 0.8].flatMap((fraction) => [
    [{ x: 0, y: 0, z: fraction }, { x: 1, y: 0, z: fraction }],
    [{ x: fraction, y: 0, z: 0 }, { x: fraction, y: 0, z: 1 }],
  ] as [Point3D, Point3D][]),
};

const getViewFrontier = (
  data: readonly ParetoDatum[],
  view: ViewPreset,
) => {
  if (view === 'perspective' || view === 'free') {
    return data.filter((datum) => datum.layer === 1);
  }

  return data.filter((candidate) => !data.some((other) => {
    if (other.item.config.id === candidate.item.config.id) return false;
    const left = other.objectives;
    const right = candidate.objectives;

    if (view === 'cost-intelligence') {
      return left.intelligence >= right.intelligence
        && left.effectiveScenarioCostUSD <= right.effectiveScenarioCostUSD
        && (
          left.intelligence > right.intelligence
          || left.effectiveScenarioCostUSD < right.effectiveScenarioCostUSD
        );
    }
    if (view === 'speed-intelligence') {
      return left.intelligence >= right.intelligence
        && left.outputTokensPerSecond >= right.outputTokensPerSecond
        && (
          left.intelligence > right.intelligence
          || left.outputTokensPerSecond > right.outputTokensPerSecond
        );
    }
    return left.effectiveScenarioCostUSD <= right.effectiveScenarioCostUSD
      && left.outputTokensPerSecond >= right.outputTokensPerSecond
      && (
        left.effectiveScenarioCostUSD < right.effectiveScenarioCostUSD
        || left.outputTokensPerSecond > right.outputTokensPerSecond
      );
  }));
};

const AXES: readonly {
  id: 'cost' | 'intelligence' | 'speed';
  to: Point3D;
  label: string;
  direction: string;
}[] = [
  {
    id: 'cost',
    to: { x: 1, y: 0, z: 0 },
    label: 'COST · USD / SCENARIO',
    direction: 'LOWER IS BETTER',
  },
  {
    id: 'intelligence',
    to: { x: 0, y: 1, z: 0 },
    label: 'INTELLIGENCE INDEX',
    direction: 'HIGHER IS BETTER',
  },
  {
    id: 'speed',
    to: { x: 0, y: 0, z: 1 },
    label: 'OUTPUT SPEED · TOKENS / SEC',
    direction: 'HIGHER IS BETTER',
  },
];

const MODEL_CREATOR_GROUPS: readonly { label: string; keys: readonly string[] }[] = [
  { label: 'OpenAI', keys: ['openai', 'chatgpt', 'gpt-', 'gpt '] },
  { label: 'Anthropic', keys: ['anthropic', 'claude'] },
  { label: 'Google', keys: ['google', 'gemini'] },
  { label: 'Meta', keys: ['meta', 'muse'] },
  { label: 'xAI', keys: ['xai', 'grok', 'supergrok'] },
  { label: 'DeepSeek', keys: ['deepseek'] },
  { label: 'Alibaba', keys: ['alibaba', 'qwen'] },
  { label: 'Z.ai', keys: ['z.ai', 'zhipu', 'glm'] },
  { label: 'Moonshot AI', keys: ['moonshot', 'kimi'] },
  { label: 'MiniMax', keys: ['minimax'] },
  { label: 'NVIDIA', keys: ['nvidia', 'nemotron'] },
  { label: 'Mistral', keys: ['mistral'] },
  { label: 'Cohere', keys: ['cohere', 'command a', 'north'] },
  { label: 'Tencent', keys: ['tencent', 'hunyuan', 'hy3', 'hy4'] },
  { label: 'Meituan', keys: ['meituan', 'longcat'] },
  { label: 'StepFun', keys: ['stepfun', 'step 3'] },
  { label: 'Thinking Machines', keys: ['thinking machines', 'inkling'] },
];

const FALLBACK_PROVIDER_COLORS = [
  '#0F766E', '#BE123C', '#7C3AED', '#0369A1',
  '#B45309', '#4D7C0F', '#A21CAF', '#475569',
];

const hashString = (value: string) => Array.from(value).reduce(
  (hash, character) => ((hash * 31) + character.charCodeAt(0)) | 0,
  0,
);

const getProviderColor = (provider: string) => {
  const normalized = provider.toLowerCase();
  const knownTheme = Object.entries(PROVIDER_BRAND_MAP).find(([key]) => normalized.includes(key));
  if (knownTheme) return knownTheme[1].color;
  return FALLBACK_PROVIDER_COLORS[
    Math.abs(hashString(normalized)) % FALLBACK_PROVIDER_COLORS.length
  ];
};

const getModelCreator = (item: PublicLeaderboardScore) => {
  const haystack = `${item.config.name} ${item.config.provider}`.toLowerCase();
  return MODEL_CREATOR_GROUPS.find(({ keys }) => (
    keys.some((key) => haystack.includes(key))
  ))?.label ?? item.config.provider;
};

const formatMetric = (value: number, digits = 1) => (
  Number.isFinite(value) ? value.toFixed(digits) : '—'
);

const formatCost = (value: number) => {
  if (value === 0) return '$0';
  if (value < 0.1) return `$${value.toFixed(3)}`;
  if (value < 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(value >= 10 ? 1 : 2)}`;
};

const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const niceSpeedMaximum = (scores: readonly ParetoDatum[]) => {
  const maximum = Math.max(50, ...scores.map((datum) => datum.objectives.outputTokensPerSecond));
  return Math.ceil(maximum / 50) * 50;
};

const niceCostMaximum = (scores: readonly ParetoDatum[]) => {
  const maximum = Math.max(1, ...scores.map((datum) => datum.objectives.effectiveScenarioCostUSD));
  return [1, 2, 5, 10, 25, 50, 100, 250].find((candidate) => candidate >= maximum)
    ?? Math.ceil(maximum / 100) * 100;
};

export const Pareto3DView: React.FC<Pareto3DViewProps> = ({
  scoreItems,
  onSelectConfigForDetail,
}) => {
  const [yaw, setYaw] = useState(CAMERA_PRESETS.perspective.yaw);
  const [pitch, setPitch] = useState(CAMERA_PRESETS.perspective.pitch);
  const [zoom, setZoom] = useState(CAMERA_PRESETS.perspective.zoom);
  const [orthographic, setOrthographic] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('perspective');
  const [labelMode, setLabelMode] = useState<LabelMode>('frontier');
  const [showGrid, setShowGrid] = useState(true);
  const [showParetoBoundary, setShowParetoBoundary] = useState(true);
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hiddenProviders, setHiddenProviders] = useState<Set<string>>(() => new Set());
  const [hoveredId, setHoveredId] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const gestureStartZoom = useRef(zoom);
  const dragState = useRef<{
    pointerId: number;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);
  const pointerPositions = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{ distance: number; zoom: number } | null>(null);

  const allLayeredData = useMemo(() => calculateParetoLayers(scoreItems), [scoreItems]);
  const providers = useMemo(() => (
    Array.from(new Set(allLayeredData.map((datum) => getModelCreator(datum.item))))
      .sort((left, right) => left.localeCompare(right))
  ), [allLayeredData]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allLayeredData
      .map((datum) => datum.item)
      .filter((item) => (
        !hiddenProviders.has(getModelCreator(item))
        && (
          query.length === 0
          || item.config.name.toLowerCase().includes(query)
          || item.config.provider.toLowerCase().includes(query)
          || item.config.execution.harness.toLowerCase().includes(query)
        )
      ));
  }, [allLayeredData, hiddenProviders, searchTerm]);

  const layeredData = useMemo(() => calculateParetoLayers(filteredItems), [filteredItems]);
  const frontier = useMemo(
    () => getViewFrontier(layeredData, viewPreset),
    [layeredData, viewPreset],
  );
  const frontierIds = useMemo(
    () => new Set(frontier.map((datum) => datum.item.config.id)),
    [frontier],
  );
  const visibleData = frontierOnly ? frontier : layeredData;
  const speedMaximum = useMemo(() => niceSpeedMaximum(allLayeredData), [allLayeredData]);
  const costMaximum = useMemo(() => niceCostMaximum(allLayeredData), [allLayeredData]);
  const costDenominator = Math.log1p(costMaximum / COST_SYMLOG_CONSTANT);

  const projectPoint = useCallback((point: Point3D): ProjectedPoint => {
    const x = (point.x - 0.5) * 2;
    const y = (point.y - 0.5) * 2;
    const z = (point.z - 0.5) * 2;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const rotatedX = (x * cosYaw) - (z * sinYaw);
    const yawDepth = (x * sinYaw) + (z * cosYaw);
    const rotatedY = (y * cosPitch) - (yawDepth * sinPitch);
    const depth = (y * sinPitch) + (yawDepth * cosPitch);
    const perspectiveScale = orthographic ? 1 : 4.5 / (4.5 - depth);

    const horizontalScale = orthographic ? 410 : SCENE_SCALE;
    const verticalScale = orthographic ? 240 : SCENE_SCALE;

    return {
      x: SCENE_CENTER_X + (rotatedX * horizontalScale * zoom * perspectiveScale),
      y: SCENE_CENTER_Y - (rotatedY * verticalScale * zoom * perspectiveScale),
      depth,
      perspectiveScale,
    };
  }, [orthographic, pitch, yaw, zoom]);

  const sceneData = useMemo(() => visibleData.map((datum) => {
    const point = {
      x: Math.log1p(
        datum.objectives.effectiveScenarioCostUSD / COST_SYMLOG_CONSTANT,
      ) / costDenominator,
      y: Math.max(0, Math.min(1, datum.objectives.intelligence / 100)),
      z: Math.max(0, Math.min(1, datum.objectives.outputTokensPerSecond / speedMaximum)),
    };
    return { ...datum, point, projected: projectPoint(point) };
  }).sort((left, right) => left.projected.depth - right.projected.depth), [
    costDenominator,
    projectPoint,
    speedMaximum,
    visibleData,
  ]);

  const hoveredDatum = layeredData.find((datum) => datum.item.config.id === hoveredId) ?? null;
  const hoveredName = hoveredDatum ? parseConfigurationName(hoveredDatum.item.config.name) : null;

  const frontierBoundaryPath = useMemo(() => {
    const orderedFrontier = sceneData
      .filter((datum) => frontierIds.has(datum.item.config.id))
      .sort((left, right) => (
        (viewPreset === 'speed-intelligence'
          ? left.objectives.outputTokensPerSecond - right.objectives.outputTokensPerSecond
          : left.objectives.effectiveScenarioCostUSD - right.objectives.effectiveScenarioCostUSD)
        || left.objectives.intelligence - right.objectives.intelligence
      ));
    if (orderedFrontier.length === 0) return '';

    const pointOnActivePlane = (point: Point3D): Point3D => {
      if (viewPreset === 'cost-intelligence') return { x: point.x, y: point.y, z: 0 };
      if (viewPreset === 'speed-intelligence') return { x: 0, y: point.y, z: point.z };
      if (viewPreset === 'cost-speed') return { x: point.x, y: 0, z: point.z };
      return point;
    };
    const first = pointOnActivePlane(orderedFrontier[0].point);
    const firstProjected = projectPoint(first);
    const commands = [`M ${firstProjected.x} ${firstProjected.y}`];

    for (let index = 1; index < orderedFrontier.length; index += 1) {
      const previous = pointOnActivePlane(orderedFrontier[index - 1].point);
      const current = pointOnActivePlane(orderedFrontier[index].point);
      const corner = viewPreset === 'speed-intelligence'
        ? { x: 0, y: previous.y, z: current.z }
        : viewPreset === 'cost-speed'
          ? { x: current.x, y: 0, z: previous.z }
          : { x: current.x, y: previous.y, z: 0 };
      const cornerProjected = projectPoint(corner);
      const currentProjected = projectPoint(current);
      commands.push(
        `L ${cornerProjected.x} ${cornerProjected.y}`,
        `L ${currentProjected.x} ${currentProjected.y}`,
      );
    }

    return commands.join(' ');
  }, [frontierIds, projectPoint, sceneData, viewPreset]);

  const isTwoDimensional = (
    viewPreset === 'cost-intelligence'
    || viewPreset === 'speed-intelligence'
    || viewPreset === 'cost-speed'
  );
  const frameEdges = isTwoDimensional ? PLANE_EDGES[viewPreset] : CUBE_EDGES;
  const gridSegments = isTwoDimensional ? PLANE_GRID_SEGMENTS[viewPreset] : GRID_SEGMENTS;
  const visibleAxisIds = viewPreset === 'cost-intelligence'
    ? new Set(['cost', 'intelligence'])
    : viewPreset === 'speed-intelligence'
      ? new Set(['speed', 'intelligence'])
      : viewPreset === 'cost-speed'
        ? new Set(['cost', 'speed'])
        : new Set(['cost', 'intelligence', 'speed']);

  const envelopeFaces = useMemo(() => {
    if (isTwoDimensional) return [];
    return buildParetoEnvelopeFaces(frontier.map((datum) => ({
      cost: Math.log1p(
        datum.objectives.effectiveScenarioCostUSD / COST_SYMLOG_CONSTANT,
      ) / costDenominator,
      intelligence: Math.max(0, Math.min(1, datum.objectives.intelligence / 100)),
      speed: Math.max(0, Math.min(1, datum.objectives.outputTokensPerSecond / speedMaximum)),
    })));
  }, [costDenominator, frontier, isTwoDimensional, speedMaximum]);

  const projectedEnvelopeFaces = useMemo(() => envelopeFaces.map((face) => {
    const projected = face.points.map((point) => projectPoint({
      x: point.cost,
      y: point.intelligence,
      z: point.speed,
    }));
    return {
      ...face,
      projected,
      depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length,
    };
  }).sort((left, right) => left.depth - right.depth), [envelopeFaces, projectPoint]);

  const applyPreset = useCallback((preset: Exclude<ViewPreset, 'free'>) => {
    const camera = CAMERA_PRESETS[preset];
    setYaw(camera.yaw);
    setPitch(camera.pitch);
    setZoom(camera.zoom);
    setOrthographic(camera.orthographic);
    setViewPreset(preset);
  }, []);

  const rotateCamera = useCallback((deltaYaw: number, deltaPitch: number) => {
    setYaw((current) => current + deltaYaw);
    setPitch((current) => Math.max(-1.35, Math.min(1.35, current + deltaPitch)));
    setOrthographic(false);
    setViewPreset('free');
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setZoom((current) => clampZoom(current * factor));
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const wheelDeltaInPixels = (event: WheelEvent) => (
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * window.innerHeight
          : event.deltaY
    );
    const handleWheel = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const isOverCanvas = Boolean(target?.closest('[data-pareto-canvas="true"]'));

      // Chromium trackpad pinch arrives as Ctrl+wheel. Capture it natively with
      // a non-passive listener so the browser never receives a page-zoom gesture.
      if (!event.ctrlKey && !isOverCanvas) return;
      event.preventDefault();
      zoomBy(Math.exp(-wheelDeltaInPixels(event) * WHEEL_ZOOM_SENSITIVITY));
    };
    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartZoom.current = zoomRef.current;
    };
    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as GestureLikeEvent).scale ?? 1;
      setZoom(clampZoom(gestureStartZoom.current * scale));
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    root.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    root.addEventListener('gesturestart', handleGestureStart, { capture: true, passive: false });
    root.addEventListener('gesturechange', handleGestureChange, { capture: true, passive: false });
    root.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });

    return () => {
      root.removeEventListener('wheel', handleWheel, true);
      root.removeEventListener('gesturestart', handleGestureStart, true);
      root.removeEventListener('gesturechange', handleGestureChange, true);
      root.removeEventListener('touchmove', handleTouchMove, true);
    };
  }, [zoomBy]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerPositions.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragState.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      yaw,
      pitch,
    };
    if (pointerPositions.current.size === 2) {
      const [first, second] = Array.from(pointerPositions.current.values());
      pinchState.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        zoom,
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pointerPositions.current.has(event.pointerId)) return;
    pointerPositions.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointerPositions.current.size >= 2 && pinchState.current) {
      const [first, second] = Array.from(pointerPositions.current.values());
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const nextZoom = pinchState.current.zoom * distance / Math.max(1, pinchState.current.distance);
      setZoom(clampZoom(nextZoom));
      return;
    }

    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) < 2) return;

    // Match the conventional orbit-control direction used by trackpads and mice.
    setYaw(drag.yaw - (deltaX * 0.006));
    setPitch(Math.max(-1.35, Math.min(1.35, drag.pitch + (deltaY * 0.006))));
    setOrthographic(false);
    setViewPreset('free');
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    pointerPositions.current.delete(event.pointerId);
    pinchState.current = null;
    if (dragState.current?.pointerId === event.pointerId || pointerPositions.current.size === 0) {
      dragState.current = null;
    } else if (pointerPositions.current.size === 1) {
      const [pointerId, position] = Array.from(pointerPositions.current.entries())[0];
      dragState.current = { pointerId, x: position.x, y: position.y, yaw, pitch };
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleProvider = (provider: string) => {
    setHiddenProviders((current) => {
      const next = new Set(current);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const costTicks = [0, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50]
    .filter((value) => value <= costMaximum);
  const intelligenceTicks = [0, 20, 40, 60, 80, 100];
  const speedTicks = Array.from(
    { length: Math.floor(speedMaximum / 50) + 1 },
    (_, index) => index * 50,
  );

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-[1440px] overscroll-contain font-brand-mono" data-testid="pareto-3d-view">
      <section className="overflow-visible bg-white" aria-labelledby="pareto-chart-heading">
        <header className="relative flex flex-col gap-2 border-b border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h1 id="pareto-chart-heading" className="text-lg font-black tracking-tight text-neutral-950">
              三维 Pareto
            </h1>
            <p className="mt-1 text-[10px] font-bold text-neutral-400">
              Intelligence Index · Effective Cost · Output Speed
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
            <span className="rounded-lg bg-neutral-100 px-3 py-2 text-neutral-600">
              {visibleData.length} / {allLayeredData.length}
            </span>
            <button
              type="button"
              onClick={() => setFrontierOnly((current) => !current)}
              className={`rounded-lg border px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                frontierOnly
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
              aria-pressed={frontierOnly}
            >
              Pareto only
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFilterOpen((current) => !current);
                  setDisplayOpen(false);
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                  filterOpen || hiddenProviders.size > 0 || searchTerm
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
                aria-label="筛选模型"
                aria-expanded={filterOpen}
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-10 z-40 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-neutral-950">筛选</span>
                    <button type="button" onClick={() => setFilterOpen(false)} aria-label="关闭筛选" className="text-neutral-400 hover:text-neutral-950">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="模型、Harness 或厂商"
                    className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
                  />
                  <div className="mt-3 flex items-center justify-between border-b border-neutral-100 pb-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Providers</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenProviders(new Set());
                        setSearchTerm('');
                      }}
                      className="text-[9px] font-black text-neutral-500 hover:text-neutral-950"
                    >
                      重置
                    </button>
                  </div>
                  <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
                    {providers.map((provider) => {
                      const checked = !hiddenProviders.has(provider);
                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => toggleProvider(provider)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] font-bold text-neutral-700 hover:bg-neutral-50"
                          role="checkbox"
                          aria-checked={checked}
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300'}`}>
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getProviderColor(provider) }} />
                          {provider}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setDisplayOpen((current) => !current);
                  setFilterOpen(false);
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                  displayOpen ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
                aria-label="图表显示设置"
                aria-expanded={displayOpen}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              {displayOpen && (
                <div className="absolute right-0 top-10 z-40 w-64 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-neutral-950">显示</span>
                    <button type="button" onClick={() => setDisplayOpen(false)} aria-label="关闭显示设置" className="text-neutral-400 hover:text-neutral-950">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 text-[10px] text-neutral-700">
                    <label className="flex items-center justify-between gap-3">
                      <span>坐标网格</span>
                      <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} className="accent-neutral-950" />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span>{isTwoDimensional ? 'Pareto 阶梯线' : 'Pareto 包络面'}</span>
                      <input type="checkbox" checked={showParetoBoundary} onChange={(event) => setShowParetoBoundary(event.target.checked)} className="accent-neutral-950" />
                    </label>
                    <div className="grid grid-cols-3 gap-1 border-t border-neutral-100 pt-3">
                      {([
                        ['frontier', 'Pareto'],
                        ['all', '全部'],
                        ['none', '无标签'],
                      ] as [LabelMode, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setLabelMode(value)}
                          className={`rounded-md px-2 py-1.5 ${labelMode === value ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                          aria-pressed={labelMode === value}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-neutral-100 px-4 py-2 text-[9px] font-bold text-neutral-600 sm:px-5">
          <span className="inline-flex items-center gap-1.5 text-neutral-950">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-neutral-950 bg-white" />
            {isTwoDimensional ? 'Pareto frontier' : 'Pareto points'}
          </span>
          {!isTwoDimensional && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 border border-neutral-400 bg-neutral-200/60" />
              Pareto surface
            </span>
          )}
          {isTwoDimensional && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 border-t border-dashed border-neutral-700" />
              Pareto boundary
            </span>
          )}
          <span className="hidden h-4 w-px bg-neutral-200 sm:block" />
          {providers.map((provider) => {
            const hidden = hiddenProviders.has(provider);
            return (
              <button
                key={provider}
                type="button"
                onClick={() => toggleProvider(provider)}
                className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-60 ${hidden ? 'opacity-25 line-through' : ''}`}
                aria-pressed={!hidden}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getProviderColor(provider) }} />
                {provider}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-0 overflow-x-auto">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 text-[9px] font-black shadow-sm backdrop-blur sm:left-5">
            {([
              ['perspective', '3D'],
              ['cost-intelligence', '成本 × 能力'],
              ['speed-intelligence', '速度 × 能力'],
              ['cost-speed', '成本 × 速度'],
            ] as [Exclude<ViewPreset, 'free'>, string][]).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  viewPreset === preset ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
                aria-pressed={viewPreset === preset}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="absolute right-4 top-4 z-20 flex items-center rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur sm:right-5">
            <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950" aria-label="缩小">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setZoom(1)} className="h-7 min-w-11 rounded-md px-1.5 text-center text-[9px] font-black text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950" aria-label="重置缩放到 100%">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => zoomBy(ZOOM_STEP)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950" aria-label="放大">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {hoveredDatum && hoveredName && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[9px] font-bold text-neutral-500 shadow-sm backdrop-blur sm:left-5">
              <div className="text-[11px] font-black text-neutral-950">{hoveredName.model}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>I {formatMetric(hoveredDatum.objectives.intelligence)}</span>
                <span>{formatCost(hoveredDatum.objectives.effectiveScenarioCostUSD)}</span>
                <span>{formatMetric(hoveredDatum.objectives.outputTokensPerSecond, 0)} t/s</span>
                <span>{frontierIds.has(hoveredDatum.item.config.id) ? 'Pareto' : 'Dominated'}</span>
              </div>
            </div>
          )}

          {visibleData.length > 0 ? (
            <svg
              data-pareto-canvas="true"
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="block h-[calc(100dvh-188px)] min-h-[480px] max-h-[700px] min-w-[760px] w-full cursor-grab select-none outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-950"
              role="application"
              aria-label="三维 Pareto 坐标系"
              tabIndex={0}
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') rotateCamera(-0.08, 0);
                else if (event.key === 'ArrowRight') rotateCamera(0.08, 0);
                else if (event.key === 'ArrowUp') rotateCamera(0, 0.08);
                else if (event.key === 'ArrowDown') rotateCamera(0, -0.08);
                else if (event.key.toLowerCase() === 'r') applyPreset('perspective');
                else return;
                event.preventDefault();
              }}
            >
              <defs>
                <marker id="pareto-axis-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#171717" />
                </marker>
                <filter id="pareto-point-shadow" x="-100%" y="-100%" width="300%" height="300%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.14" />
                </filter>
              </defs>

              {!isTwoDimensional && showParetoBoundary && (
                <g data-testid="pareto-envelope-surface" pointerEvents="none">
                  {projectedEnvelopeFaces.map((face, index) => (
                    <polygon
                      key={`${face.kind}-${index}`}
                      points={face.projected.map((point) => `${point.x},${point.y}`).join(' ')}
                      fill={face.kind === 'top' ? '#737373' : '#A3A3A3'}
                      fillOpacity={face.kind === 'top' ? 0.1 : 0.055}
                      stroke="#737373"
                      strokeOpacity={face.kind === 'top' ? 0.26 : 0.18}
                      strokeWidth="0.7"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              )}

              {showGrid && (
                <g stroke="#E5E5E5" strokeWidth="0.85" strokeOpacity="0.72">
                  {gridSegments.map(([from, to], index) => {
                    const start = projectPoint(from);
                    const end = projectPoint(to);
                    return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
                  })}
                </g>
              )}

              <g fill="none" stroke="#BDBDBD" strokeWidth="1.1">
                {frameEdges.map(([from, to], index) => {
                  const start = projectPoint(from);
                  const end = projectPoint(to);
                  return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
                })}
              </g>

              <g>
                {AXES.filter((axis) => visibleAxisIds.has(axis.id)).map((axis) => {
                  const start = projectPoint({ x: 0, y: 0, z: 0 });
                  const end = projectPoint(axis.to);
                  const labelOffset = axis.id === 'intelligence'
                    ? { x: -12, y: -16, anchor: 'end' as const }
                    : axis.id === 'cost'
                      ? { x: 14, y: 18, anchor: 'start' as const }
                      : { x: -6, y: 22, anchor: 'middle' as const };
                  return (
                    <g key={axis.id}>
                      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#171717" strokeWidth="1.8" markerEnd="url(#pareto-axis-arrow)" />
                      <text x={end.x + labelOffset.x} y={end.y + labelOffset.y} textAnchor={labelOffset.anchor} fill="#171717" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="900">
                        {axis.label}
                      </text>
                      <text x={end.x + labelOffset.x} y={end.y + labelOffset.y + 14} textAnchor={labelOffset.anchor} fill="#A3A3A3" fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="700">
                        {axis.direction}
                      </text>
                    </g>
                  );
                })}
              </g>

              {showGrid && (
                <g fill="#737373" fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="700">
                  {visibleAxisIds.has('cost') && costTicks.map((value) => {
                    const point = projectPoint({
                      x: Math.log1p(value / COST_SYMLOG_CONSTANT) / costDenominator,
                      y: 0,
                      z: 0,
                    });
                    return (
                      <g key={`cost-${value}`}>
                        <circle cx={point.x} cy={point.y} r="1.7" fill="#171717" />
                        <text x={point.x} y={point.y + 14} textAnchor="middle">{formatCost(value)}</text>
                      </g>
                    );
                  })}
                  {visibleAxisIds.has('intelligence') && intelligenceTicks.map((value) => {
                    const point = projectPoint({ x: 0, y: value / 100, z: 0 });
                    return (
                      <g key={`intelligence-${value}`}>
                        <circle cx={point.x} cy={point.y} r="1.7" fill="#171717" />
                        <text x={point.x - 8} y={point.y + 3} textAnchor="end">{value}</text>
                      </g>
                    );
                  })}
                  {visibleAxisIds.has('speed') && speedTicks.map((value) => {
                    const point = projectPoint({ x: 0, y: 0, z: value / speedMaximum });
                    return (
                      <g key={`speed-${value}`}>
                        <circle cx={point.x} cy={point.y} r="1.7" fill="#171717" />
                        <text x={point.x + 7} y={point.y + 3} textAnchor="start">{value}</text>
                      </g>
                    );
                  })}
                </g>
              )}

              {isTwoDimensional && showParetoBoundary && frontierBoundaryPath && (
                <path
                  data-testid="pareto-step-boundary"
                  d={frontierBoundaryPath}
                  fill="none"
                  stroke="#171717"
                  strokeWidth="1.8"
                  strokeDasharray="2.5 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.78"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              <g>
                {sceneData.map((datum, index) => {
                  const id = datum.item.config.id;
                  const isFrontier = frontierIds.has(id);
                  const hovered = id === hoveredId;
                  const showLabel = (
                    hovered
                    || labelMode === 'all'
                    || (labelMode === 'frontier' && isFrontier)
                  );
                  const color = getProviderColor(getModelCreator(datum.item));
                  const radius = (hovered ? 8.5 : isFrontier ? 6.3 : 4.2)
                    * datum.projected.perspectiveScale;
                  const labelOnRight = datum.projected.x < SCENE_CENTER_X || index % 2 === 0;
                  const modelLabel = parseConfigurationName(datum.item.config.name).model;
                  return (
                    <g
                      key={id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${datum.item.config.name}，能力 ${formatMetric(datum.objectives.intelligence)}，成本 ${formatCost(datum.objectives.effectiveScenarioCostUSD)}，速度 ${formatMetric(datum.objectives.outputTokensPerSecond)} tokens per second，${isFrontier ? 'Pareto 最优' : '非 Pareto 最优'}`}
                      onPointerEnter={() => setHoveredId(id)}
                      onPointerLeave={() => setHoveredId('')}
                      onPointerDown={(event) => event.stopPropagation()}
                      onFocus={() => setHoveredId(id)}
                      onBlur={() => setHoveredId('')}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectConfigForDetail(datum.item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectConfigForDetail(datum.item);
                        }
                      }}
                      className="cursor-pointer outline-none"
                    >
                      {isFrontier && (
                        <circle
                          cx={datum.projected.x}
                          cy={datum.projected.y}
                          r={radius + 4}
                          fill="white"
                          fillOpacity="0.76"
                          stroke="#171717"
                          strokeWidth={hovered ? 2.2 : 1.45}
                          vectorEffect="non-scaling-stroke"
                          filter="url(#pareto-point-shadow)"
                        />
                      )}
                      <circle
                        cx={datum.projected.x}
                        cy={datum.projected.y}
                        r={radius}
                        fill={color}
                        fillOpacity={isFrontier ? 1 : hovered ? 0.95 : 0.56}
                        stroke={hovered ? '#171717' : 'white'}
                        strokeWidth={hovered ? 2.2 : 1.1}
                        vectorEffect="non-scaling-stroke"
                      />
                      {showLabel && (
                        <text
                          x={datum.projected.x + (labelOnRight ? radius + 6 : -(radius + 6))}
                          y={datum.projected.y + (index % 3 === 0 ? -7 : 4)}
                          textAnchor={labelOnRight ? 'start' : 'end'}
                          fill={hovered ? '#171717' : isFrontier ? '#404040' : '#737373'}
                          fontFamily="JetBrains Mono, monospace"
                          fontSize={hovered ? 11 : isFrontier ? 9.5 : 8}
                          fontWeight={hovered ? 800 : 700}
                          paintOrder="stroke"
                          stroke="white"
                          strokeWidth="3.5"
                          strokeLinejoin="round"
                        >
                          {modelLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          ) : (
            <div className="flex h-[560px] min-w-[680px] flex-col items-center justify-center text-center">
              <p className="text-sm font-black text-neutral-950">没有符合条件的配置</p>
              <button
                type="button"
                onClick={() => {
                  setHiddenProviders(new Set());
                  setSearchTerm('');
                }}
                className="mt-3 text-[10px] font-black text-neutral-500 hover:text-neutral-950"
              >
                重置筛选
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
