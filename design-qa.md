# Design QA

- Source visual truth: `/Users/vita/Others/LLMpk/tmp/design-qa/source-homepage.png`
- Implementation: `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-desktop-final.png`
- Full-view comparison: `/Users/vita/Others/LLMpk/tmp/design-qa/desktop-side-by-side.png`
- Focused table comparison: `/Users/vita/Others/LLMpk/tmp/design-qa/table-focused-side-by-side.png`
- Desktop CSS viewport: `1440 × 900`, `devicePixelRatio: 1`
- Desktop screenshot pixels: source `1425 × 891`, implementation `1425 × 891`
- Density normalization: none required; source and implementation use the same browser, viewport, DPR, and capture path. The full-view comparison scales both sides equally for review; the focused table comparison uses equal-size `690 × 300` 1:1 crops.
- Desktop state: source is the default official leaderboard; implementation is Custom Ranking with all eight preference values at the balanced value of `50`.
- Responsive evidence: `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-mobile-fixed.png` and `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-mobile-table.png`; configured CSS viewport `390 × 844`, captured pixels `375 × 812`, DPR `1`.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: passed. The implementation preserves the source's JetBrains Mono hierarchy, heavy model-name weights, uppercase micro-labels, numeric emphasis, truncation behavior, and antialiasing. The focused comparison shows matching row typography and score hierarchy.
- Spacing and layout rhythm: passed. The new two-column composition deliberately reserves `390px` for preferences while the ranking table retains the source header height, row density, borders, radii, badge sizing, and vertical rhythm. The mobile layout stacks the two regions and keeps rank, model, and preference score visible without horizontal scrolling.
- Colors and visual tokens: passed. Neutral backgrounds, purple active/rank accents, domain colors, subtle borders, and score opacity follow the existing leaderboard tokens.
- Image quality and asset fidelity: passed. The source has no raster product imagery or custom decorative assets to reproduce. Existing library icons are reused, and the radar is an interactive data visualization rather than a substitute image asset.
- Copy and content: passed. “自定义排行”, “偏好得分”, the balanced reset, normalized percentages, and the official-score secondary label clearly distinguish personalized output from the official leaderboard.
- Accessibility and affordance: passed. All eight handles expose `role="slider"`, numeric ARIA values, keyboard arrows/Home/End, visible focus/active treatment, and enlarged pointer targets.

**Open Questions**

- None blocking. Preference persistence across reloads is intentionally outside the requested page scope.

**Comparison History**

1. Initial implementation evidence: `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-initial.png`.
   - [P1] Fast pointer drags could apply only the first movement because drag state depended on an asynchronous render.
   - [P2] At the mobile breakpoint, the four navigation labels wrapped vertically and the play control overflowed.
   - [P2] The mobile table's fixed minimum width placed the preference-score column offscreen.
2. Fixes applied:
   - Moved active drag identity to refs and captured pointer movement on the SVG root, so the final pointer position is always applied.
   - Added compact mobile tab labels and hid the nonessential play-mode launcher below the small breakpoint.
   - Switched the mobile ranking table to fixed rank/model/score columns while retaining the full domain matrix at desktop width.
3. Post-fix evidence:
   - Pointer drag: `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-cost-100.png`; dragging “省钱” from `50` to `100` updated the live score.
   - Mobile navigation and radar: `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-mobile-fixed.png`.
   - Mobile visible score column: `/Users/vita/Others/LLMpk/tmp/design-qa/custom-ranking-mobile-table.png`.
   - Final desktop comparison: `/Users/vita/Others/LLMpk/tmp/design-qa/desktop-side-by-side.png`.

**Primary Interactions Tested**

- Opened “自定义排行” from the main navigation.
- Set all dimensions to zero and Coding to `100` with keyboard controls; the top result changed from GPT-5.6 Sol Max to Claude Fable 5 Max with a `100.0` preference score.
- Dragged Cost Efficiency with the pointer from `50` to `100`; the radar, normalized shares, and ranking score updated immediately.
- Used the balanced reset to restore all eight dimensions to `50`.
- Opened the first ranked configuration, verified the detail screen, and returned to Custom Ranking.
- Checked desktop and mobile responsive states.
- Browser console errors: none.

**Implementation Checklist**

- [x] Two-region custom ranking page
- [x] Pointer and keyboard adjustable radar
- [x] Eight-dimension relative weight normalization
- [x] Live personalized reranking of all 64 configurations
- [x] Homepage-compatible ranking table styling
- [x] Detail navigation and return path
- [x] Desktop and mobile responsive behavior
- [x] Focused tests, full suite, production build, and browser verification

**Follow-up Polish**

- [P3] A future iteration could persist the last preference mix locally, but the current balanced reset is clearer for a first release.

final result: passed
