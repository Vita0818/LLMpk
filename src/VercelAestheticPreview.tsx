import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowUpDown,
  ArrowLeft,
  Play,
} from 'lucide-react';
import { DOMAIN_DEFINITIONS } from './engine/scoringEngine';
import publicLeaderboardSnapshot from './data/publicLeaderboardSnapshot.json';
import { DomainId } from './types/llm_pk';
import type {
  PublicLeaderboardScore,
  PublicLeaderboardSnapshot,
} from './types/publicLeaderboard';
import { SideBySideCompareView } from './components/SideBySideCompareView';
import { CustomRankingView } from './components/CustomRankingView';
import { RadarOverviewGallery } from './components/RadarOverviewGallery';
import {
  ConfigurationMetricList,
  ConfigurationRadar,
  parseConfigurationName,
} from './components/ConfigurationDetailContent';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from './utils/practicalAdjustment';
import { PlayModeHud } from './components/PlayModeHud';
import { AnimatedScore } from './components/AnimatedScore';
import {
  buildPlayModeQueue,
  sortRadarOverviewScores,
} from './utils/playModeQueue';
import {
  getPlayModeRadarOverviewDurationMs,
  getPlayModeRadarOverviewScrollTop,
  PLAY_MODE_RADAR_OVERVIEW_MIN_DURATION_MS,
} from './utils/playModeRadarOverview';
import {
  PlayModeCreditsCard,
  PlayModeIntroCard,
  PlayModeWeightsCard,
} from './components/PlayModeTitleCards';
import { PLAY_MODE_ENABLED } from './config/featureFlags';

type SortKey = 'rawCapabilityScore' | 'practicalScore' | DomainId;

/** intro -> model loop -> radar overview -> outro weights -> outro credits. */
type PlayModePhase =
  | 'intro'
  | 'model'
  | 'radar_overview'
  | 'outro_weights'
  | 'outro_credits';

const PLAY_MODE_HUD_UPDATE_INTERVAL_MS = 100;

const PUBLIC_SCORES = (
  publicLeaderboardSnapshot as unknown as PublicLeaderboardSnapshot
).scores;

const getScoreDepthStyle = (score: number | null | undefined) => {
  if (score === null || score === undefined || isNaN(score)) {
    return { opacity: 0.35, fontWeight: 500 };
  }
  const normalized = Math.max(0, Math.min(100, score));
  // 100 score -> 1.0 (darkest), 0 score -> 0.45 (softest readable floor)
  const opacity = 0.45 + (normalized / 100) * 0.55;
  const fontWeight = normalized >= 80 ? 900 : normalized >= 50 ? 800 : 700;
  return { opacity, fontWeight };
};

/**
 * 100% Authentic Artificial Analysis (artificialanalysis.ai) Replica Design System
 * - Heading Font: Instrument Serif (font-brand-serif)
 * - UI Font: Inter (font-sans)
 * - Metric Font: JetBrains Mono (font-brand-mono)
 * - Header Pill Navbar: bg-neutral-100 rounded-[1.5rem] with bg-black active pill
 */
export const VercelAestheticPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'custom' | 'side_by_side' | 'overview' | 'detail'>('leaderboard');
  const [lastMainTab, setLastMainTab] = useState<'leaderboard' | 'custom' | 'side_by_side' | 'overview'>('leaderboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'reasoning' | 'top'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('practicalScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hoveredDomain, setHoveredDomain] = useState<DomainId | null>(null);
  const [comparisonSelectedIds, setComparisonSelectedIds] = useState<string[]>(() =>
    PUBLIC_SCORES.filter((item) => item.eligibleForGlobalLeaderboard !== false)
      .slice(0, 3)
      .map((item) => item.config.id)
  );
  const scores: PublicLeaderboardScore[] = PUBLIC_SCORES;

  // Play Mode: rank one representative configuration per distinct radar route.
  const [isPlayModeActive, setIsPlayModeActive] = useState(false);
  const [isPlayModePlaying, setIsPlayModePlaying] = useState(false);
  const [playModePhase, setPlayModePhase] = useState<PlayModePhase>('intro');
  const [playModeIndex, setPlayModeIndex] = useState(0); // 0 = last place, total - 1 = #1 rank
  const [playModeElapsedMs, setPlayModeElapsedMs] = useState(0);
  const playModeElapsedMsRef = useRef(0);
  const [isPlayModeFinished, setIsPlayModeFinished] = useState(false);
  const [playModeStaySeconds, setPlayModeStaySeconds] = useState(5);
  const [isPlayModeCleanView, setIsPlayModeCleanView] = useState(false);
  const playModeRadarOverviewRef = useRef<HTMLDivElement>(null);
  const [playModeRadarScrollDistance, setPlayModeRadarScrollDistance] = useState(0);
  const [playModeRadarDurationMs, setPlayModeRadarDurationMs] = useState(
    PLAY_MODE_RADAR_OVERVIEW_MIN_DURATION_MS,
  );

  // Filtered scores
  const filteredScores = useMemo(() => {
    return scores
      .filter((s) => {
        const matchSearch =
          s.config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.config.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.config.execution.harness.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchSearch) return false;

        if (filterCategory === 'reasoning') {
          const lowerName = s.config.name.toLowerCase();
          return (
            lowerName.includes('reasoning') ||
            lowerName.includes('pro') ||
            lowerName.includes('max') ||
            lowerName.includes('o3') ||
            lowerName.includes('r1') ||
            lowerName.includes('high')
          );
        }

        if (filterCategory === 'top') {
          return (s.rawCapabilityScore || 0) >= 60;
        }

        return true;
      })
      .sort((a, b) => {
        let valueA: number | null;
        let valueB: number | null;

        if (sortKey === 'rawCapabilityScore') {
          // Sort by the original unadjusted capability score (Intelligence Index)
          valueA = a.rawCapabilityScore;
          valueB = b.rawCapabilityScore;
        } else if (sortKey === 'practicalScore') {
          valueA = a.practicalBreakdown.practicalScore;
          valueB = b.practicalBreakdown.practicalScore;
        } else {
          valueA = a.domainScores[sortKey].score;
          valueB = b.domainScores[sortKey].score;
        }

        // Missing values always remain at the bottom, even for ascending sorts.
        if (valueA === null && valueB === null) {
          return a.config.name.localeCompare(b.config.name);
        }
        if (valueA === null) return 1;
        if (valueB === null) return -1;

        const primaryDifference = sortOrder === 'desc'
          ? valueB - valueA
          : valueA - valueB;
        if (Math.abs(primaryDifference) > Number.EPSILON) {
          return primaryDifference;
        }

        // Keep ties deterministic and favor the stronger capability score.
        const capabilityA = a.rawCapabilityScore ?? Number.NEGATIVE_INFINITY;
        const capabilityB = b.rawCapabilityScore ?? Number.NEGATIVE_INFINITY;
        return capabilityB - capabilityA
          || a.config.name.localeCompare(b.config.name);
      });
  }, [scores, searchTerm, filterCategory, sortKey, sortOrder]);

  // Playback and radar overview deliberately ignore search/filter UI state.
  // Equivalent API and subscription routes share one radar slot, represented
  // by the route with the highest practical score.
  const representativeRouteScores = useMemo(
    () => buildPlayModeQueue(scores),
    [scores],
  );
  const playModeQueue = PLAY_MODE_ENABLED ? representativeRouteScores : [];
  const radarOverviewScores = useMemo(
    () => sortRadarOverviewScores(representativeRouteScores),
    [representativeRouteScores],
  );
  const currentPlayModePhaseDurationMs = playModePhase === 'radar_overview'
    ? playModeRadarDurationMs
    : playModeStaySeconds * 1000;

  const resetPlayModeElapsed = useCallback(() => {
    playModeElapsedMsRef.current = 0;
    setPlayModeElapsedMs(0);
  }, []);

  const showPlayModeIndex = useCallback((index: number) => {
    const queueLength = playModeQueue.length;
    const target = playModeQueue[queueLength - 1 - index];
    if (!target) return;

    setSelectedConfigId(target.config.id);
    setActiveTab('detail');
    setHoveredDomain(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [playModeQueue]);

  const resetPlayMode = useCallback((shouldPlay: boolean) => {
    if (!PLAY_MODE_ENABLED || playModeQueue.length === 0) return;

    setPlayModePhase('intro');
    setPlayModeIndex(0);
    resetPlayModeElapsed();
    setIsPlayModeFinished(false);
    setIsPlayModeActive(true);
    setIsPlayModePlaying(shouldPlay);
    showPlayModeIndex(0);
  }, [playModeQueue.length, resetPlayModeElapsed, showPlayModeIndex]);

  // The overview is a real copy of the gallery page, so its playback length is
  // measured from the rendered document instead of using the per-model delay.
  useEffect(() => {
    if (
      !PLAY_MODE_ENABLED
      || !isPlayModeActive
      || playModePhase !== 'radar_overview'
    ) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const measureScrollDistance = () => {
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const scrollDistance = Math.max(0, documentHeight - window.innerHeight);
      const durationMs = getPlayModeRadarOverviewDurationMs(scrollDistance);

      setPlayModeRadarScrollDistance((current) => (
        Math.abs(current - scrollDistance) < 0.5 ? current : scrollDistance
      ));
      setPlayModeRadarDurationMs((current) => (
        Math.abs(current - durationMs) < 0.5 ? current : durationMs
      ));
    };

    const animationFrame = window.requestAnimationFrame(measureScrollDistance);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measureScrollDistance);
    if (playModeRadarOverviewRef.current) {
      resizeObserver?.observe(playModeRadarOverviewRef.current);
    }
    window.addEventListener('resize', measureScrollDistance);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureScrollDistance);
    };
  }, [isPlayModeActive, isPlayModeCleanView, playModePhase]);

  // Drive the visible scroll on every display frame, while updating React only
  // often enough for the HUD. This keeps the 43 SVG charts out of the hot path.
  useEffect(() => {
    if (!PLAY_MODE_ENABLED || !isPlayModeActive || !isPlayModePlaying || isPlayModeFinished) return;

    let previousFrame = performance.now();
    let lastHudUpdate = previousFrame;
    let animationFrame = 0;

    const tick = (now: number) => {
      const elapsedSinceFrame = Math.max(0, now - previousFrame);
      previousFrame = now;

      const nextElapsedMs = Math.min(
        currentPlayModePhaseDurationMs,
        playModeElapsedMsRef.current + elapsedSinceFrame,
      );
      playModeElapsedMsRef.current = nextElapsedMs;

      if (playModePhase === 'radar_overview') {
        window.scrollTo({
          top: getPlayModeRadarOverviewScrollTop(
            nextElapsedMs,
            playModeRadarScrollDistance,
          ),
          left: 0,
          behavior: 'auto',
        });
      }

      const phaseFinished = nextElapsedMs >= currentPlayModePhaseDurationMs;
      if (
        phaseFinished
        || (
          !isPlayModeCleanView
          && now - lastHudUpdate >= PLAY_MODE_HUD_UPDATE_INTERVAL_MS
        )
      ) {
        lastHudUpdate = now;
        setPlayModeElapsedMs(nextElapsedMs);
      }

      if (!phaseFinished) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    isPlayModeActive,
    isPlayModePlaying,
    isPlayModeFinished,
    currentPlayModePhaseDurationMs,
    isPlayModeCleanView,
    playModePhase,
    playModeIndex,
    playModeRadarScrollDistance,
  ]);

  useEffect(() => {
    if (
      !PLAY_MODE_ENABLED
      || !isPlayModeActive
      || !isPlayModePlaying
      || isPlayModeFinished
      || playModeElapsedMs < currentPlayModePhaseDurationMs
    ) {
      return;
    }

    if (playModePhase === 'intro') {
      setPlayModePhase('model');
      resetPlayModeElapsed();
      showPlayModeIndex(0);
      return;
    }

    if (playModePhase === 'model') {
      const nextIndex = playModeIndex + 1;
      if (nextIndex >= playModeQueue.length) {
        setPlayModePhase('radar_overview');
        resetPlayModeElapsed();
        return;
      }

      setPlayModeIndex(nextIndex);
      resetPlayModeElapsed();
      showPlayModeIndex(nextIndex);
      return;
    }

    if (playModePhase === 'radar_overview') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      setPlayModePhase('outro_weights');
      resetPlayModeElapsed();
      return;
    }

    if (playModePhase === 'outro_weights') {
      setPlayModePhase('outro_credits');
      resetPlayModeElapsed();
      return;
    }

    setIsPlayModeFinished(true);
    setIsPlayModePlaying(false);
  }, [
    isPlayModeActive,
    isPlayModePlaying,
    isPlayModeFinished,
    playModeElapsedMs,
    currentPlayModePhaseDurationMs,
    playModePhase,
    playModeIndex,
    playModeQueue.length,
    resetPlayModeElapsed,
    showPlayModeIndex,
  ]);

  const handleStartPlayMode = useCallback(() => {
    if (!PLAY_MODE_ENABLED) return;
    setIsPlayModeCleanView(false);
    resetPlayMode(true);
  }, [resetPlayMode]);

  const handlePlayModeTogglePlay = useCallback(() => {
    if (isPlayModeFinished) {
      resetPlayMode(true);
      return;
    }
    setIsPlayModePlaying((prev) => !prev);
  }, [isPlayModeFinished, resetPlayMode]);

  const handlePlayModeNext = useCallback(() => {
    const queueLength = playModeQueue.length;
    resetPlayModeElapsed();
    setIsPlayModeFinished(false);

    if (playModePhase === 'intro') {
      setPlayModePhase('model');
      setPlayModeIndex(0);
      showPlayModeIndex(0);
      return;
    }
    if (playModePhase === 'model') {
      if (playModeIndex < queueLength - 1) {
        const nextIdx = playModeIndex + 1;
        setPlayModeIndex(nextIdx);
        showPlayModeIndex(nextIdx);
      } else {
        setPlayModePhase('radar_overview');
      }
      return;
    }
    if (playModePhase === 'radar_overview') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      setPlayModePhase('outro_weights');
      return;
    }
    if (playModePhase === 'outro_weights') {
      setPlayModePhase('outro_credits');
    }
  }, [
    playModePhase,
    playModeIndex,
    playModeQueue.length,
    resetPlayModeElapsed,
    showPlayModeIndex,
  ]);

  const handlePlayModePrev = useCallback(() => {
    resetPlayModeElapsed();
    setIsPlayModeFinished(false);

    if (playModePhase === 'outro_credits') {
      setPlayModePhase('outro_weights');
      return;
    }
    if (playModePhase === 'outro_weights') {
      setPlayModePhase('radar_overview');
      return;
    }
    if (playModePhase === 'radar_overview') {
      const lastIdx = playModeQueue.length - 1;
      setPlayModePhase('model');
      setPlayModeIndex(lastIdx);
      showPlayModeIndex(lastIdx);
      return;
    }
    if (playModePhase === 'model') {
      if (playModeIndex > 0) {
        const prevIdx = playModeIndex - 1;
        setPlayModeIndex(prevIdx);
        showPlayModeIndex(prevIdx);
      } else {
        setPlayModePhase('intro');
      }
    }
  }, [
    playModePhase,
    playModeIndex,
    playModeQueue.length,
    resetPlayModeElapsed,
    showPlayModeIndex,
  ]);

  const handlePlayModeReplay = useCallback(() => {
    resetPlayMode(true);
  }, [resetPlayMode]);

  const leaveFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const handlePlayModeExit = useCallback(() => {
    setIsPlayModeActive(false);
    setIsPlayModePlaying(false);
    setIsPlayModeFinished(false);
    resetPlayModeElapsed();
    setIsPlayModeCleanView(false);
    leaveFullscreen();
    setActiveTab(lastMainTab);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [lastMainTab, leaveFullscreen, resetPlayModeElapsed]);

  const handlePrepareRecording = useCallback(() => {
    resetPlayMode(false);
    setIsPlayModeCleanView(true);

    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, [resetPlayMode]);

  const handleLeaveCleanView = useCallback(() => {
    setIsPlayModeCleanView(false);
    leaveFullscreen();
  }, [leaveFullscreen]);

  const handleStayDurationChange = useCallback((seconds: number) => {
    setPlayModeStaySeconds(seconds);
    resetPlayModeElapsed();
  }, [resetPlayModeElapsed]);

  useEffect(() => {
    if (!PLAY_MODE_ENABLED || !isPlayModeActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormControl = target?.tagName === 'INPUT'
        || target?.tagName === 'SELECT'
        || target?.tagName === 'TEXTAREA';
      if (isFormControl && event.key !== 'Escape') return;

      if (event.code === 'Space') {
        event.preventDefault();
        handlePlayModeTogglePlay();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handlePlayModeNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePlayModePrev();
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        handlePlayModeReplay();
      } else if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        if (isPlayModeCleanView) {
          handleLeaveCleanView();
        } else {
          handlePrepareRecording();
        }
      } else if (event.key === 'Escape' && isPlayModeCleanView) {
        handleLeaveCleanView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlayModeActive,
    isPlayModeCleanView,
    handleLeaveCleanView,
    handlePlayModeNext,
    handlePlayModePrev,
    handlePlayModeReplay,
    handlePlayModeTogglePlay,
    handlePrepareRecording,
  ]);

  useEffect(() => {
    if (!PLAY_MODE_ENABLED || !isPlayModeCleanView) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPlayModeCleanView(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isPlayModeCleanView]);

  const selectedScoreItem =
    scores.find((s) => s.config.id === selectedConfigId) || scores[0];
  const currentPlayModeItem = PLAY_MODE_ENABLED && isPlayModeActive
    ? playModeQueue[playModeQueue.length - 1 - playModeIndex]
    : null;
  const currentPlayModeRank = currentPlayModeItem
    ? playModeQueue.length - playModeIndex
    : null;
  const selectedParsedName = parseConfigurationName(selectedScoreItem.config.name);
  const selectedPracticalAdjustment = getPracticalAdjustment(
    selectedScoreItem.practicalBreakdown,
  );

  const domainList: DomainId[] = [
    'chatting',
    'math_science',
    'coding',
    'engineering',
    'agentic_work',
    'search_knowledge',
  ];

  const formatScore = (s: number | null) => (s === null ? '--' : s.toFixed(1));
  const parseConfigName = parseConfigurationName;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((current) => current === 'desc' ? 'asc' : 'desc');
      return;
    }

    setSortKey(key);
    setSortOrder('desc');
  };

  const renderSortLabel = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors hover:text-black ${
        sortKey === key ? 'text-black' : ''
      }`}
      title={`按 ${label} ${sortKey === key && sortOrder === 'desc' ? '升序' : '降序'}排列`}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={`h-3 w-3 ${
          sortKey === key ? 'text-black' : 'text-neutral-400'
        }`}
      />
      {sortKey === key && (
        <span className="text-[10px] font-black" aria-hidden="true">
          {sortOrder === 'desc' ? '↓' : '↑'}
        </span>
      )}
    </button>
  );

  return (
    <div
      className={`min-h-screen bg-white text-neutral-900 font-brand-mono antialiased selection:bg-black selection:text-white ${
        PLAY_MODE_ENABLED && isPlayModeCleanView
          ? `play-mode-clean-view ${
              playModePhase === 'radar_overview'
                ? 'play-mode-clean-view--scrolling'
                : ''
            }`
          : ''
      }`}
    >
      {/* Floating Play Mode Controller HUD */}
      {PLAY_MODE_ENABLED && isPlayModeActive && !isPlayModeCleanView && (() => {
        const queueLength = playModeQueue.length;
        const isModelPhase = playModePhase === 'model';
        const isRadarOverviewPhase = playModePhase === 'radar_overview';
        const currentItem = isModelPhase ? currentPlayModeItem : null;
        const parsed = currentItem ? parseConfigName(currentItem.config.name) : null;
        // Virtual timeline: intro + models + radar overview + weights + credits.
        const virtualIndex =
          playModePhase === 'intro'
            ? 0
            : playModePhase === 'model'
              ? playModeIndex + 1
              : playModePhase === 'radar_overview'
                ? queueLength + 1
                : playModePhase === 'outro_weights'
                  ? queueLength + 2
                  : queueLength + 3;
        const stageLabel =
          playModePhase === 'intro' ? '片头'
            : playModePhase === 'model' ? undefined
              : playModePhase === 'radar_overview' ? '总览'
                : '片尾';
        const stageTitle =
          playModePhase === 'intro' ? 'LLMpk'
            : playModePhase === 'radar_overview' ? '雷达图总览'
              : playModePhase === 'outro_weights' ? '评分权重'
                : playModePhase === 'outro_credits' ? 'Thanks for Watching'
                  : '';

        return (
          <PlayModeHud
            totalItems={queueLength}
            totalSteps={queueLength + 4}
            currentIndex={virtualIndex}
            currentRank={isModelPhase ? currentPlayModeRank : null}
            stageLabel={stageLabel}
            currentModelName={isModelPhase
              ? (parsed ? parsed.model : currentItem?.config.name || '')
              : stageTitle}
            currentHarness={isModelPhase ? parsed?.harness : undefined}
            currentProvider={isModelPhase ? parsed?.provider : undefined}
            currentScore={isModelPhase ? currentItem?.practicalBreakdown.practicalScore ?? null : null}
            scoreLabel="实用分"
            isPlaying={isPlayModePlaying}
            isFinished={isPlayModeFinished}
            stayDurationSeconds={isRadarOverviewPhase
              ? currentPlayModePhaseDurationMs / 1000
              : playModeStaySeconds}
            durationLabel={isRadarOverviewPhase ? '滚动' : '停留'}
            elapsedMs={playModeElapsedMs}
            onTogglePlay={handlePlayModeTogglePlay}
            onNext={handlePlayModeNext}
            onPrev={handlePlayModePrev}
            onReplay={handlePlayModeReplay}
            onExit={handlePlayModeExit}
            onStayDurationChange={isRadarOverviewPhase
              ? undefined
              : handleStayDurationChange}
            onPrepareRecording={handlePrepareRecording}
          />
        );
      })()}

      {/* 1. Header Navigation */}
      {(!PLAY_MODE_ENABLED || !isPlayModeCleanView) && (
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 shadow-2xs">
          <div className="max-w-[1500px] mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Circular Back Button Next to LLMpk */}
          <div className="flex items-center gap-3">
            <a href={import.meta.env.BASE_URL} className="font-brand-mono text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight select-none hover:opacity-90 transition-opacity">
              LLMpk
            </a>

            {/* Minimalist Pure Circular Back Button (hidden on homepage/overview, visible on detail page) */}
            {activeTab === 'detail' && (
              <button
                onClick={() => setActiveTab(lastMainTab)}
                className="w-8 h-8 rounded-full border border-neutral-200 bg-neutral-100/90 hover:bg-black hover:border-black text-neutral-700 hover:text-white flex items-center justify-center transition-all shadow-2xs shrink-0"
                title="返回"
                aria-label="返回"
              >
                <ArrowLeft className="w-4 h-4 text-current shrink-0" />
              </button>
            )}
          </div>

          {/* Top Right Main Tab Switcher & Play Mode Button */}
          <div className="flex items-center gap-2">
            {activeTab !== 'detail' && (
              <div className="flex items-center p-1 bg-neutral-100/90 rounded-full border border-neutral-200/80 text-[10px] sm:text-xs font-bold font-brand-mono">
                <button
                  onClick={() => {
                    setActiveTab('leaderboard');
                    setLastMainTab('leaderboard');
                  }}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all ${
                    activeTab === 'leaderboard'
                      ? 'bg-black text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <span className="sm:hidden">榜单</span>
                  <span className="hidden sm:inline">全量榜单</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('custom');
                    setLastMainTab('custom');
                  }}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all ${
                    activeTab === 'custom'
                      ? 'bg-black text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <span className="sm:hidden">自定义</span>
                  <span className="hidden sm:inline">自定义排行</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('side_by_side');
                    setLastMainTab('side_by_side');
                  }}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all ${
                    activeTab === 'side_by_side'
                      ? 'bg-black text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <span className="sm:hidden">对比</span>
                  <span className="hidden sm:inline">并排对比</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('overview');
                    setLastMainTab('overview');
                  }}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-full transition-all ${
                    activeTab === 'overview'
                      ? 'bg-black text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <span className="sm:hidden">雷达</span>
                  <span className="hidden sm:inline">雷达图总览</span>
                </button>
              </div>
            )}

            {/* Play Mode Launch Button */}
            {PLAY_MODE_ENABLED && (
              <button
                onClick={handleStartPlayMode}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs shadow-2xs transition-all border border-neutral-800 shrink-0 cursor-pointer"
                title={`开启播放模式（${playModeQueue.length} 个代表配置，从末位播放至第 1 名）`}
              >
                <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                <span>播放模式</span>
              </button>
            )}
            </div>
          </div>
        </header>
      )}

      {/* 2. Main Section */}
      <main
        className={
          PLAY_MODE_ENABLED && isPlayModeCleanView
            ? playModePhase === 'radar_overview'
              ? 'play-mode-clean-stage mx-auto min-h-screen w-full max-w-[1500px] px-6 py-4'
              : 'play-mode-clean-stage mx-auto h-screen w-full max-w-[1500px] px-6 py-4'
            : PLAY_MODE_ENABLED && isPlayModeActive
              ? 'mx-auto w-full max-w-[1500px] px-4 pb-6 pt-36'
              : 'mx-auto w-full max-w-[1500px] px-4 py-6'
        }
      >
        {/* VIEW 1: MODELS LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* High-Density Authentic Table */}
            <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-neutral-600 font-brand-mono text-[10px] sm:text-[11px] border-b border-neutral-200 bg-neutral-50/70 uppercase tracking-wider">
                    <th className="px-1.5 sm:px-4 py-3 text-center w-6 sm:w-12 font-bold shrink-0">#</th>
                    <th className="px-2 sm:px-5 py-3 font-bold text-left w-full">Model Configuration</th>
                    <th className="px-2 sm:px-5 py-3 text-right sm:text-center font-bold text-black whitespace-nowrap shrink-0">
                      <span className="md:hidden">{renderSortLabel('Score', 'practicalScore')}</span>
                      <span className="hidden md:inline">{renderSortLabel('Intelligence & Practical', 'practicalScore')}</span>
                    </th>
                    <th className="hidden md:table-cell px-3.5 py-3.5 text-center font-bold text-purple-900 border-l border-neutral-200">
                      {renderSortLabel('Chatting', 'chatting')}
                    </th>
                    <th className="hidden md:table-cell px-3.5 py-3.5 text-center font-bold text-amber-900">
                      {renderSortLabel('Math & Sci', 'math_science')}
                    </th>
                    <th className="hidden md:table-cell px-3.5 py-3.5 text-center font-bold text-emerald-900">
                      {renderSortLabel('Coding', 'coding')}
                    </th>
                    <th className="hidden md:table-cell px-3.5 py-3.5 text-center font-bold text-amber-900">
                      {renderSortLabel('Engineering', 'engineering')}
                    </th>
                    <th className="hidden md:table-cell px-3.5 py-3.5 text-center font-bold text-blue-900">
                      {renderSortLabel('Agentic', 'agentic_work')}
                    </th>
                    <th className="hidden md:table-cell px-3.5 py-3.5 text-center font-bold text-cyan-900">
                      {renderSortLabel('Search', 'search_knowledge')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-sans text-neutral-900">
                  {filteredScores.map((item, index) => {
                    const rank = item.eligibleForGlobalLeaderboard
                      ? filteredScores
                          .slice(0, index + 1)
                          .filter((score) => score.eligibleForGlobalLeaderboard).length
                      : null;
                    const parsed = parseConfigName(item.config.name);
                    const capabilityScore = item.rawCapabilityScore;
                    const practicalAdjustment = getPracticalAdjustment(item.practicalBreakdown);

                    return (
                      <tr
                        key={item.config.id}
                        onClick={() => {
                          setSelectedConfigId(item.config.id);
                          setActiveTab('detail');
                        }}
                        className="hover:bg-neutral-50/90 transition-colors duration-100 cursor-pointer group"
                      >
                        {/* Rank Badge */}
                        <td className="px-1.5 sm:px-4 py-3 sm:py-3.5 text-center font-brand-mono font-bold text-neutral-500 shrink-0">
                          {rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-900 text-white text-[11px] sm:text-xs font-black shadow-2xs">1</span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-200 text-neutral-900 text-[11px] sm:text-xs font-bold">2</span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-300 text-[11px] sm:text-xs font-bold">3</span>
                          ) : rank !== null ? (
                            rank
                          ) : (
                            <span className="text-neutral-300" title="数据不足，暂不生成名次">—</span>
                          )}
                        </td>

                        {/* Model Configuration: Left-Aligned, Fills All Available Middle Space */}
                        <td className="px-2 sm:px-5 py-3 sm:py-3.5 font-brand-mono text-left w-full min-w-0">
                          <div className="space-y-0.5 sm:space-y-1">
                            <div className="font-extrabold text-neutral-950 text-sm sm:text-base group-hover:text-purple-900 transition-colors leading-tight">
                              {parsed.model}
                            </div>
                            {/* Desktop: Harness | Provider on single line */}
                            <div className="hidden sm:flex items-center gap-1 font-bold text-neutral-600 text-[15px] truncate">
                              <span className="truncate">{parsed.harness}</span>
                              <span className="text-neutral-300 font-normal shrink-0">|</span>
                              <span className="truncate">{parsed.provider}</span>
                            </div>
                            {/* Mobile: 2 Separate Stacked Lines for Harness & Provider (Total 3 Lines) */}
                            <div className="sm:hidden space-y-0.5 text-xs">
                              <div className="font-bold text-neutral-700 truncate">{parsed.harness}</div>
                              <div className="font-semibold text-neutral-500 truncate">{parsed.provider}</div>
                            </div>
                          </div>
                        </td>

                        {/* Scores Column: Right-Aligned to Far Edge, Shrink-0 */}
                        <td className="px-2 sm:px-5 py-3 sm:py-3.5 text-right sm:text-center font-brand-mono shrink-0 whitespace-nowrap">
                          <div className="flex flex-col items-end sm:items-center">
                            {/* Line 1: Main Intelligence Score */}
                            <div className="font-black text-black text-base sm:text-xl leading-none">
                              {formatScore(capabilityScore)}
                            </div>
                            {/* Line 2: Practical Score Adjustment & Final Score */}
                            <div className="text-[11px] sm:text-sm text-neutral-500 font-medium whitespace-nowrap mt-1">
                              (
                              <span className={`font-bold ${practicalAdjustmentTextClass(practicalAdjustment)}`}>
                                {formatPracticalAdjustment(practicalAdjustment)}
                              </span>
                              {' -> '}
                              <span className="text-neutral-950 font-black">
                                {formatScore(item.practicalBreakdown.practicalScore)}
                              </span>
                              )
                            </div>
                          </div>
                        </td>

                        {/* 6 Domains Scores with Dynamic Score-Based Depth (Hidden on Mobile) */}
                        {domainList.map((dId, dIdx) => {
                          const score = item.domainScores[dId].score;
                          const def = DOMAIN_DEFINITIONS[dId];
                          const { opacity, fontWeight } = getScoreDepthStyle(score);

                          return (
                            <td
                              key={dId}
                              className={`hidden md:table-cell px-3.5 py-4 text-center font-brand-mono text-base ${dIdx === 0 ? 'border-l border-neutral-100' : ''}`}
                              style={{
                                color: def.color,
                                opacity,
                                fontWeight,
                              }}
                            >
                              {formatScore(score)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: USER-WEIGHTED CUSTOM RANKING */}
        {activeTab === 'custom' && (
          <CustomRankingView
            representativeScoreItems={representativeRouteScores}
            onSelectConfigForDetail={(item) => {
              setSelectedConfigId(item.config.id);
              setActiveTab('detail');
            }}
          />
        )}

        {/* VIEW 3: RADAR OVERVIEW GALLERY (4 PER ROW) */}
        {activeTab === 'overview' && (
          <RadarOverviewGallery
            scoreItems={radarOverviewScores}
            onSelectConfigForDetail={(item) => {
              setSelectedConfigId(item.config.id);
              setActiveTab('detail');
            }}
            testId="radar-overview-gallery"
          />
        )}

        {/* VIEW 4: SIDE-BY-SIDE COMPARE */}
        {activeTab === 'side_by_side' && (
          <SideBySideCompareView
            scoreItems={scores}
            selectedIds={comparisonSelectedIds}
            onSelectedIdsChange={setComparisonSelectedIds}
            onSelectConfigForDetail={(item) => {
              setSelectedConfigId(item.config.id);
              setActiveTab('detail');
            }}
          />
        )}

        {/* PLAY MODE OVERVIEW: the existing gallery, scrolling from top to bottom. */}
        {PLAY_MODE_ENABLED && isPlayModeActive && playModePhase === 'radar_overview' && (
          <RadarOverviewGallery
            ref={playModeRadarOverviewRef}
            scoreItems={radarOverviewScores}
            testId="play-mode-radar-overview"
          />
        )}

        {/* PLAY MODE TITLE CARDS: intro + outro phases replace the detail stage */}
        {PLAY_MODE_ENABLED && isPlayModeActive && playModePhase === 'intro' && (
          <PlayModeIntroCard />
        )}
        {PLAY_MODE_ENABLED && isPlayModeActive && playModePhase === 'outro_weights' && (
          <PlayModeWeightsCard />
        )}
        {PLAY_MODE_ENABLED && isPlayModeActive && playModePhase === 'outro_credits' && (
          <PlayModeCreditsCard />
        )}

        {/* VIEW 3: RADAR & CONFIGURATION DETAIL */}
        {activeTab === 'detail' && selectedScoreItem && (!PLAY_MODE_ENABLED || !isPlayModeActive || playModePhase === 'model') && (
          <div
            key={selectedScoreItem.config.id}
            className={`space-y-4 ${
              PLAY_MODE_ENABLED && isPlayModeActive ? 'play-mode-scene-enter' : ''
            }`}
          >
            {PLAY_MODE_ENABLED && isPlayModeActive && currentPlayModeRank !== null && (
              <div className="play-mode-rank-enter flex items-center justify-between font-brand-mono">
                <div className="select-none text-4xl font-black tracking-tight text-neutral-950">
                  LLMpk
                </div>
                <div className="-mb-6 flex translate-y-4 items-baseline gap-2">
                  <span className="text-[4.5rem] font-black leading-none text-neutral-950">
                    #{currentPlayModeRank}
                  </span>
                  <span className="text-lg font-bold text-neutral-400">
                    / {playModeQueue.length}
                  </span>
                </div>
              </div>
            )}

            {/* Header Area directly on background WITHOUT grey bottom border */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1 font-brand-mono">
              <div className={`space-y-0.5 sm:space-y-1 ${
                PLAY_MODE_ENABLED && isPlayModeActive ? 'play-mode-title-enter' : ''
              }`}>
                {/* Line 1: Model Name */}
                <h2 className="text-3xl sm:text-4xl font-black text-neutral-950 tracking-tight leading-tight">
                  {selectedParsedName.model}
                </h2>

                {/* Desktop: Harness | Provider on single line */}
                <div className="hidden sm:flex items-center gap-1.5 font-bold text-neutral-950 text-3xl sm:text-4xl tracking-tight">
                  <span>{selectedParsedName.harness}</span>
                  <span className="text-neutral-300 font-normal">|</span>
                  <span>{selectedParsedName.provider}</span>
                </div>

                {/* Mobile: 2 Separate Stacked Lines for Harness & Provider (Total 3 Lines) */}
                <div className="sm:hidden space-y-0.5 font-brand-mono">
                  <div className="text-base font-bold text-neutral-800">
                    {selectedParsedName.harness}
                  </div>
                  <div className="text-base font-semibold text-neutral-500">
                    {selectedParsedName.provider}
                  </div>
                </div>
              </div>

              {/* Scores directly on background - Enlarged Font Sizes */}
              {PLAY_MODE_ENABLED && isPlayModeActive ? (
                <div className="play-mode-scores-enter shrink-0 translate-y-3 font-brand-mono">
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-5xl font-black text-neutral-950 sm:text-6xl">
                      <AnimatedScore value={selectedScoreItem.rawCapabilityScore} />
                    </span>
                    <span className="text-2xl font-bold text-neutral-400 sm:text-3xl">
                      (
                      <span className={practicalAdjustmentTextClass(selectedPracticalAdjustment)}>
                        <AnimatedScore
                          value={selectedPracticalAdjustment}
                          showPlus
                        />
                      </span>
                      <span> → </span>
                      <span className="font-black text-purple-950">
                        <AnimatedScore
                          value={selectedScoreItem.practicalBreakdown.practicalScore}
                        />
                      </span>
                      )
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex shrink-0 flex-wrap items-center gap-5 font-brand-mono sm:gap-7">
                  <div>
                    <div className="text-neutral-500 text-xs uppercase font-bold tracking-wider">Practical Score</div>
                    <div className="mt-0.5 text-4xl font-black text-purple-950 sm:text-5xl">
                      {formatScore(selectedScoreItem.practicalBreakdown.practicalScore)}
                    </div>
                  </div>
                  <div className="hidden h-10 w-px bg-neutral-200 sm:block" />
                  <div>
                    <div className="text-neutral-500 text-xs uppercase font-bold tracking-wider">Intelligence Index</div>
                    <div className="mt-0.5 text-3xl font-black text-neutral-950 sm:text-4xl">
                      {formatScore(selectedScoreItem.rawCapabilityScore)}
                    </div>
                  </div>
                  <div className="hidden h-10 w-px bg-neutral-200 sm:block" />
                  <div>
                    <div className="text-neutral-500 text-xs uppercase font-bold tracking-wider">Practical Delta</div>
                    <div className={`mt-0.5 text-3xl font-black sm:text-4xl ${
                      practicalAdjustmentTextClass(selectedPracticalAdjustment)
                    }`}>
                      {formatPracticalAdjustment(selectedPracticalAdjustment)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Radar Display & Domain Progress Bars directly on background */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
              {/* Radar Chart comfortably centered */}
              <div className="lg:col-span-7 flex justify-center items-center -ml-4 py-0">
                <ConfigurationRadar
                  scoreItem={selectedScoreItem}
                  size={680}
                  hoveredDomain={hoveredDomain}
                  onHoverDomain={setHoveredDomain}
                  animate={PLAY_MODE_ENABLED && isPlayModeActive}
                />
              </div>

              {/* Atomic & Practical Metrics List - Stacked cleanly on mobile, side-by-side on desktop */}
              <div className={`lg:col-span-5 pl-0 lg:pl-2 mt-4 lg:-mt-4 ${
                PLAY_MODE_ENABLED && isPlayModeActive ? 'play-mode-metrics-enter' : ''
              }`}>
                <ConfigurationMetricList
                  scoreItem={selectedScoreItem}
                  columns={2}
                  hoveredDomain={hoveredDomain}
                  onHoverDomain={setHoveredDomain}
                />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
