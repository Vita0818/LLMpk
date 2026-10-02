# LLMpk

LLMpk is a configuration-level LLM leaderboard that combines capability,
engineering, agentic, search, pricing, and latency observations from multiple
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
