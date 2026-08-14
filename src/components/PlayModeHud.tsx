import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  Trophy,
  Sparkles,
  Clock,
  Maximize2,
} from 'lucide-react';

export interface PlayModeHudProps {
  totalItems: number;
  /** Virtual timeline length (title cards + models); defaults to totalItems. */
  totalSteps?: number;
  currentIndex: number; // index inside the virtual timeline
  currentRank: number | null;
  /** Set during title-card phases to replace the rank badge. */
  stageLabel?: string;
  currentModelName: string;
  currentHarness?: string;
  currentProvider?: string;
  currentScore: number | null;
  scoreLabel?: string;
  isPlaying: boolean;
  isFinished: boolean;
  stayDurationSeconds: number; // default 5
  durationLabel?: string;
  stayDurationOptions?: readonly number[];
  elapsedMs: number;
  onTogglePlay: () => void;
  onNext: () => void; // move toward Rank 1
  onPrev: () => void; // move toward Rank N
  onReplay: () => void;
  onExit: () => void;
  onStayDurationChange?: (seconds: number) => void;
  onPrepareRecording?: () => void;
}

export const PlayModeHud: React.FC<PlayModeHudProps> = ({
  totalItems,
  totalSteps,
  currentIndex,
  currentRank,
  stageLabel,
  currentModelName,
  currentHarness,
  currentProvider,
  currentScore,
  scoreLabel = '能力分',
  isPlaying,
  isFinished,
  stayDurationSeconds,
  durationLabel = '停留',
  stayDurationOptions = [2, 3, 4, 5, 7, 10],
  elapsedMs,
  onTogglePlay,
  onNext,
  onPrev,
  onReplay,
  onExit,
  onStayDurationChange,
  onPrepareRecording,
}) => {
  const totalMs = stayDurationSeconds * 1000;
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const secondsLeft = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
  const lastStepIndex = (totalSteps ?? totalItems) - 1;

  const formatScore = (s: number | null) => (s === null ? '--' : s.toFixed(1));

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-4 pointer-events-auto transition-all duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-neutral-950/95 text-white backdrop-blur-xl border border-neutral-800 shadow-2xl p-4">
        {/* Countdown Progress Bar at Top Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-800">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              isFinished
                ? 'bg-amber-400'
                : isPlaying
                ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400'
                : 'bg-neutral-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          {/* Left Info: Mode Badge + Rank + Model Name */}
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            {/* Live Playing Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-neutral-300 shrink-0">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-mono uppercase tracking-wider">{isPlaying ? '播放中' : isFinished ? '已完成' : '已暂停'}</span>
            </div>

            {/* Rank Badge (stage badge during title-card phases) */}
            <div className="shrink-0 font-mono">
              {stageLabel ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/40 text-xs font-black tracking-wider">
                  {stageLabel}
                </span>
              ) : currentRank === 1 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  #1 第一名
                </span>
              ) : currentRank !== null ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-200 text-xs font-black border border-neutral-700">
                  #{currentRank} / {totalItems}
                </span>
              ) : (
                <span className="text-neutral-500 text-xs">—</span>
              )}
            </div>

            {/* Model Name & Details */}
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2">
                <span className="font-brand-mono font-extrabold text-sm sm:text-base text-white truncate">
                  {currentModelName}
                </span>
                {currentScore !== null && (
                  <span className="font-brand-mono font-black text-emerald-400 text-xs sm:text-sm shrink-0">
                    {scoreLabel} {formatScore(currentScore)}
                  </span>
                )}
              </div>
              {(currentHarness || currentProvider) && (
                <div className="text-[11px] font-mono text-neutral-400 truncate">
                  {currentHarness} {currentHarness && currentProvider ? '|' : ''} {currentProvider}
                </div>
              )}
            </div>
          </div>

          {/* Middle: configurable timer countdown */}
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 shrink-0">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            {onStayDurationChange ? (
              <label className="flex items-center gap-1.5">
                <span>{durationLabel}</span>
                <select
                  value={stayDurationSeconds}
                  onChange={(event) => onStayDurationChange(Number(event.target.value))}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                  aria-label="每个配置的停留时间"
                >
                  {stayDurationOptions.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds}s
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>{durationLabel} {Math.ceil(stayDurationSeconds)}s</span>
            )}
            <span className="text-white font-bold bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800 text-xs">
              {isFinished ? '0s' : `${secondsLeft}s`}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Prev (toward bottom rank) */}
            <button
              onClick={onPrev}
              disabled={currentIndex <= 0}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-900 transition-all"
              title="上一个模型 (靠后名次)"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play/Pause or Replay */}
            {isFinished ? (
              <button
                onClick={onReplay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition-all shadow-md"
                title="重新播放"
              >
                <RotateCcw className="w-4 h-4" />
                <span>重新播放</span>
              </button>
            ) : (
              <button
                onClick={onTogglePlay}
                className={`p-2.5 rounded-xl font-bold transition-all shadow-md ${
                  isPlaying
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950'
                }`}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
            )}

            {/* Next (toward Rank 1 / outro cards) */}
            <button
              onClick={onNext}
              disabled={currentIndex >= lastStepIndex}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-900 transition-all"
              title="下一个模型 (靠前名次)"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {onPrepareRecording && (
              <button
                onClick={onPrepareRecording}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 hover:text-emerald-200"
                title="回到末位并进入全屏净画面；按空格开始播放"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden lg:inline">准备录屏</span>
              </button>
            )}

            {/* Exit Play Mode */}
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-red-950 hover:text-red-400 text-neutral-400 border border-neutral-800 transition-all ml-1"
              title="退出播放模式"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {onPrepareRecording && !isFinished && (
          <div className="mt-2 border-t border-neutral-800 pt-2 text-center font-mono text-[10px] text-neutral-500">
            空格 播放/暂停 · ← → 切换 · R 重新播放 · H 录屏净画面 · Esc 退出净画面
          </div>
        )}

        {/* Finished Notification Overlay banner */}
        {isFinished && (
          <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 text-xs font-mono text-amber-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              <span>
                播放完成！已从倒数第一巡展至第 1 名{stageLabel ? '。' : `（${currentModelName}）。`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onReplay}
                className="px-3 py-1 rounded-lg bg-amber-400 text-neutral-950 font-bold hover:bg-amber-300 transition-all"
              >
                再次播放
              </button>
              <button
                onClick={onExit}
                className="px-3 py-1 rounded-lg bg-neutral-800 text-neutral-300 font-bold hover:bg-neutral-700 transition-all"
              >
                退出
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
