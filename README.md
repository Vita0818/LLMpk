# LLMpk

LLMpk is a configuration-level LLM leaderboard that combines Chatting, Reasoning, Coding, Frontend, Agentic, Documents, pricing, and latency observations from multiple
public benchmark sources.

## Local development

```bash
npm ci
npm run dev
```

The development server is available at `http://localhost:5173/`.

Recording playback is enabled for local development and local builds. Set
`VITE_ENABLE_PLAY_MODE=false` to produce the public-reader build without the
playback controls.

## Validation

```bash
npm test
npm run build
```

## Deployment

Pushes to `main` are tested, built, and deployed to GitHub Pages by
`.github/workflows/deploy-pages.yml`. The workflow explicitly disables the
local-only recording playback feature while publishing the same current data.

The production site is expected at:

<https://vita0818.github.io/LLMpk/>

## Current scoring policy

The reviewed successor-pruned inventory contains 30 model families / 40 configurations.
Scoring v3 requires every domain to reach 60% weighted observed evidence and
at least 75% overall coverage before assigning a total or rank. Missing
observations are null; insufficient configurations remain inspectable.

- [Scoring v3](llm_pk_scoring_methodology_v3.md)
- [Domain weights v3](llm_pk_domain_classification_weighting_v3.md)
- [Source registry v3](llm_pk_data_source_registry_v3.md)

Refresh the current FrontierCode 1.1 Main evidence with `npm run refresh:frontiercode`.
DesignArena integration uses its official API and is pending a key; no Elo is fabricated.
