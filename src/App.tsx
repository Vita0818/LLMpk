import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navbar, ViewPage } from './components/Navbar';
import { LeaderboardView } from './components/LeaderboardView';
import { SideBySideCompareView } from './components/SideBySideCompareView';
import { ModelDetailView } from './components/ModelDetailView';
import { AdminMappingView } from './components/AdminMappingView';
import { PlayModeHud } from './components/PlayModeHud';
import { parseConfigurationName } from './components/ConfigurationDetailContent';

import { adminMappingStore } from './store/adminMappingStore';
import { CURRENT_COHORT_SNAPSHOT } from './data/cohortMetadata';
import { ProcessedConfigurationScore, LLMConfiguration } from './types/llm_pk';
import { syncLatestCohortData } from './services/dataFetcher';
import { SCORING_CONFIG } from './engine/scoringConfig';
import type { BuiltInConfigurationPresetInstallReport } from './types/admin_mapping';
import { BUILT_IN_CONFIGURATION_PRESET_INVENTORY_VERSION } from './data/builtInConfigurationPresets';
import { PLAY_MODE_ENABLED } from './config/featureFlags';

export function App() {
  const [activePage, setActivePage] = useState<ViewPage>('leaderboard');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [presetInstallReport, setPresetInstallReport] = useState<BuiltInConfigurationPresetInstallReport | null>(null);
  const initialPresetInstallReport = useRef<BuiltInConfigurationPresetInstallReport | null>(null);

  // Play Mode State
  const [isPlayModeActive, setIsPlayModeActive] = useState(false);
  const [isPlayModePlaying, setIsPlayModePlaying] = useState(false);
  const [playModeIndex, setPlayModeIndex] = useState(0);
  const [playModeElapsedMs, setPlayModeElapsedMs] = useState(0);
  const [isPlayModeFinished, setIsPlayModeFinished] = useState(false);

  // The bundled configuration inventory is installed enabled and visible by
  // default. This runs after persisted user boxes have been loaded, so the
  // store can preserve them and use each stable built-in preset ID for
  // idempotency.
  useEffect(() => {
    // A Fast Refresh can preserve the singleton store from an older bundled
    // source snapshot. Reconcile that catalog first, otherwise newly-added
    // source-backed configurations would resolve against stale cards.
    adminMappingStore.resetToLatestVerifiedCatalog();
    const report = adminMappingStore.synchronizeBuiltInConfigurationPresets();
    // React Strict Mode intentionally runs effects twice in development. Keep
    // the first report when it installed configurations, rather than replacing the
    // useful "added N" message with the idempotent second-pass zero.
    if (
      report.installedBoxCount > 0
      || report.removedBuiltInBoxCount > 0
      || report.removedRetiredLegacyBoxCount > 0
      || !initialPresetInstallReport.current
    ) {
      initialPresetInstallReport.current = report;
      setPresetInstallReport(report);
    }
    // resetToLatestVerifiedCatalog replaces the in-memory observations even
    // when no box/link changed. Always recompute so a page loaded from a
    // truncated legacy browser payload cannot keep its first stale score set.
    setRefreshTrigger((previous) => previous + 1);
  // Depend on the inventory revision so Fast Refresh reconciles newly bundled
  // configurations with the browser's persisted local store instead of
  // retaining the pre-update snapshot.
  }, [BUILT_IN_CONFIGURATION_PRESET_INVENTORY_VERSION]);

  // Compute leaderboard scores dynamically from Admin Mapping Store
  const processedScores = useMemo(() => {
    return adminMappingStore.computeLeaderboardScores();
  }, [refreshTrigger]);

  // Play Mode timer effect (bottom rank -> #1 rank, stay 5s per model)
  useEffect(() => {
    if (!PLAY_MODE_ENABLED || !isPlayModeActive || !isPlayModePlaying || isPlayModeFinished) return;

    const intervalMs = 100;
    const stayMs = 5000;

    const timer = setInterval(() => {
      setPlayModeElapsedMs((prev) => {
        const next = prev + intervalMs;
        if (next >= stayMs) {
          setPlayModeIndex((currIdx) => {
            const queueLength = processedScores.length;
            const nextIdx = currIdx + 1;
            if (nextIdx >= queueLength) {
              setIsPlayModeFinished(true);
              setIsPlayModePlaying(false);
              return currIdx;
            } else {
              const targetModel = processedScores[queueLength - 1 - nextIdx];
              if (targetModel) {
                setSelectedModelId(targetModel.config.id);
                setActivePage('model_summary');
              }
              return nextIdx;
            }
          });
          return 0;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlayModeActive, isPlayModePlaying, isPlayModeFinished, processedScores]);

  const handleStartPlayMode = () => {
    if (!PLAY_MODE_ENABLED || processedScores.length === 0) return;
    const queueLength = processedScores.length;
    setPlayModeIndex(0);
    setPlayModeElapsedMs(0);
    setIsPlayModeFinished(false);
    setIsPlayModeActive(true);
    setIsPlayModePlaying(true);

    const lastModel = processedScores[queueLength - 1];
    if (lastModel) {
      setSelectedModelId(lastModel.config.id);
      setActivePage('model_summary');
    }
  };

  const handleSelectConfigForDetail = (item: ProcessedConfigurationScore) => {
    setSelectedModelId(item.config.id);
    setActivePage('model_summary');
  };

  const handleSyncLiveData = async () => {
    const existingConfigs: LLMConfiguration[] = adminMappingStore.boxes.map((b) =>
      adminMappingStore.buildLLMConfiguration(b)
    );
    const result = await syncLatestCohortData(existingConfigs);
    if (result.success) {
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased">
      {/* Play Mode Floating HUD */}
      {PLAY_MODE_ENABLED && isPlayModeActive && (() => {
        const queueLength = processedScores.length;
        const currentItem = processedScores[queueLength - 1 - playModeIndex];
        const parsed = currentItem ? parseConfigurationName(currentItem.config.name) : null;
        const currentRank = queueLength - playModeIndex;

        return (
          <PlayModeHud
            totalItems={queueLength}
            currentIndex={playModeIndex}
            currentRank={currentRank}
            currentModelName={parsed ? parsed.model : currentItem?.config.name || ''}
            currentHarness={parsed?.harness}
            currentProvider={parsed?.provider}
            currentScore={currentItem?.rawCapabilityScore ?? null}
            isPlaying={isPlayModePlaying}
            isFinished={isPlayModeFinished}
            stayDurationSeconds={5}
            elapsedMs={playModeElapsedMs}
            onTogglePlay={() => setIsPlayModePlaying((prev) => !prev)}
            onNext={() => {
              const qLen = processedScores.length;
              if (playModeIndex < qLen - 1) {
                const nextIdx = playModeIndex + 1;
                setPlayModeIndex(nextIdx);
                setPlayModeElapsedMs(0);
                const target = processedScores[qLen - 1 - nextIdx];
                if (target) {
                  setSelectedModelId(target.config.id);
                  setActivePage('model_summary');
                }
                if (nextIdx === qLen - 1) setIsPlayModeFinished(false);
              }
            }}
            onPrev={() => {
              if (playModeIndex > 0) {
                const prevIdx = playModeIndex - 1;
                setPlayModeIndex(prevIdx);
                setPlayModeElapsedMs(0);
                setIsPlayModeFinished(false);
                const target = processedScores[processedScores.length - 1 - prevIdx];
                if (target) {
                  setSelectedModelId(target.config.id);
                  setActivePage('model_summary');
                }
              }
            }}
            onReplay={handleStartPlayMode}
            onExit={() => {
              setIsPlayModeActive(false);
              setIsPlayModePlaying(false);
              setIsPlayModeFinished(false);
              setPlayModeElapsedMs(0);
              setActivePage('leaderboard');
            }}
          />
        );
      })()}

      {/* Navigation */}
      <Navbar
        activePage={activePage}
        onSelectPage={setActivePage}
        cohort={CURRENT_COHORT_SNAPSHOT}
        onSyncLiveData={handleSyncLiveData}
        onStartPlayMode={PLAY_MODE_ENABLED ? handleStartPlayMode : undefined}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-8 lg:px-12 py-8">
        {activePage === 'leaderboard' && (
          <LeaderboardView
            scoreItems={processedScores}
            onSelectConfigForDetail={handleSelectConfigForDetail}
          />
        )}

        {activePage === 'side_by_side' && (
          <SideBySideCompareView
            scoreItems={processedScores}
            onSelectConfigForDetail={handleSelectConfigForDetail}
          />
        )}

        {activePage === 'model_summary' && (
          <ModelDetailView
            scoreItems={processedScores}
            selectedConfigId={selectedModelId}
          />
        )}

        {activePage === 'admin_mapping' && (
          <AdminMappingView
            onRefreshLeaderboard={() => setRefreshTrigger((prev) => prev + 1)}
            builtInPresetInstallReport={presetInstallReport}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-5 text-xs text-slate-500">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-800 text-sm tracking-tight">LLMpk Arena</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono">
            <span>Scoring v{SCORING_CONFIG.version}</span>
            <span>&bull;</span>
            <span>Weighting v2.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
