import type { SourceObservation } from '../types/admin_mapping';

/**
 * Arena Agent publishes each component's 95% CI as a radius inside the
 * lossless source record rather than as lower/upper columns.
 */
export const ARENA_AGENT_SOURCE_SIGNAL_BY_METRIC_ID:
Readonly<Record<string, string>> = {
  arena_agent_success: 'task_outcome_explicit',
  arena_agent_steerability: 'steerability',
  arena_agent_praise: 'praise_complaint',
  arena_agent_bash_recovery: 'bash_recovery_steps',
  arena_agent_tool_hallucination: 'tool_hallucination',
};

export function getEmbeddedConfidenceRadius(
  observation: SourceObservation,
): number | undefined {
  const sourceSignal = ARENA_AGENT_SOURCE_SIGNAL_BY_METRIC_ID[
    observation.metricId
  ];
  if (!sourceSignal) return undefined;

  const signalCi = observation.metadataJson?.sourceRecord?.signalCi;
  // The October payload also renamed the associated CI field. Keep both
  // transport versions so a refreshed score retains its source uncertainty.
  const signals = observation.metricId === 'arena_agent_steerability'
    ? [sourceSignal, 'steering_burden']
    : [sourceSignal];
  return signals.map((signal) => signalCi?.[signal])
    .find((radius): radius is number => (
      typeof radius === 'number' && Number.isFinite(radius) && radius > 0
    ));
}
