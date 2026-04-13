# CLAUDE.md - Betaline AI 2

## Project Overview

Premium B2B landing page for **Betaline AI** — an AI employee solution for sales automation and customer engagement. The site targets the Russian market (all content in Russian) and is deployed on Vercel as a static site.

## Tech Stack

- **HTML5 / Vanilla JavaScript / CSS3** — no frameworks, no bundler, no build step
- **GSAP 3.12.5 + ScrollTrigger** — scroll-triggered animations, parallax, counters (CDN)
- **tsParticles 2.12.0** — particle system for hero background (CDN)
- **Google Fonts** — Unbounded (headings), Manrope (body)
- **Deployment** — Vercel (static hosting, no build required)

## File Structure

```
/
├── index.html          # Single-page HTML (~454 lines)
├── main.js             # Core interactivity & animations (~310 lines)
├── marketing.js        # Marketing features: CTAs, modals, toasts (~153 lines)
├── style.css           # Full design system & responsive styles (~1398 lines)
├── assets/
│   ├── hero-bg.png
│   ├── custom-bg.png
│   └── pain-split.png
└── .agent/skills/      # Claude Code agent skill definitions
```

## Architecture

**No backend, no database, no auth.** Everything is client-side:

- **Routing**: Anchor-based (`#hero`, `#pain`, `#how`, `#offer`, `#custom`, `#audit`) with smooth scrolling
- **State**: `localStorage` for theme preference, `sessionStorage` for exit-popup tracking, global JS variables for scroll/animation state
- **Forms**: Client-side validation only — `submitBrief()`, `submitExitEmail()` show toast notifications (no actual backend submission)
- **i18n**: All text hardcoded in Russian, numbers formatted with `Intl.NumberFormat('ru-RU')`

## Key Sections & Components

| Section | CSS Class | Description |
|---------|-----------|-------------|
| Navigation | `.navbar` | Sticky nav with burger menu for mobile |
| Hero | `.hero` | Typewriter effect, particle system, URL input CTA |
| World Data | `.world-data-slider` | Infinite marquee carousel with statistics |
| Pain | `.pain-section` | Problem statement with image reveal |
| Stats | `.stats-bar` | Animated counter statistics |
| How It Works | `.steps-grid` | 3-step process cards with 3D tilt |
| Pricing | `.pricing-grid` | 2 pricing tiers with countdown timer |
| ROI Calculator | `.roi-calculator` | Interactive expandable calculator |
| Custom Integration | `.custom-grid` | Advanced service offering cards |
| Audit CTA | `#audit` | Call-to-action for consultation |
| Sticky CTA | `.sticky-cta` | Persistent footer CTA bar |
| Modal | `.modal-overlay` | Audit form modal |
| Exit Popup | `.exit-popup-overlay` | Exit-intent engagement popup |
| Toasts | `.toast-container` | Social proof notification toasts |

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| CSS classes | kebab-case | `.hero-badge`, `.step-card`, `.price-card` |
| HTML IDs | camelCase | `#heroTitle`, `#roiToggle`, `#exitPopup` |
| CSS variables | `--kebab-case` | `--bg-primary`, `--accent-glow`, `--ease-out` |
| JS functions | camelCase | `updateROI()`, `showToast()`, `typeWriter()` |
| Global handlers | `window.functionName` | `window.openModal`, `window.closeModal` |
| Data attributes | `data-*` | `data-tilt`, `data-count`, `data-speed` |

## Design System

### Theme

Dark theme by default, light mode via `[data-theme="light"]` on `<html>`.

```css
--bg-primary: #0F0F0F;        /* Dark background */
--accent: #00D4FF;             /* Cyan/turquoise primary */
--accent-emerald: #00C9A7;     /* Green secondary */
--font-heading: 'Unbounded';
--font-body: 'Manrope';
```

### Responsive Approach

- **Mobile-first** with `clamp()` for fluid typography and spacing
- **Breakpoints**: `1024px` (tablet), `768px` (mobile)
- **Layout**: CSS Flexbox and Grid
- Glass-morphism effects with `backdrop-filter`

### Button Variants

- `.btn` — primary cyan background
- `.btn-outline` — transparent with border
- `.btn-gold` — gold gradient for premium CTAs

## Animation Layers

1. **CSS @keyframes** — simple repeating effects (`pulse-dot`, `blink-caret`)
2. **CSS transitions** — state changes (`all 0.3s var(--ease-out)`)
3. **GSAP + ScrollTrigger** — scroll-triggered reveals, parallax, counters
4. **requestAnimationFrame** — custom cursor ring following with 12% easing

Animation elements use `.reveal` class, toggled to `.active` on scroll at 85% viewport.

## Performance Notes

- Font and hero image preloads in `<head>`
- `loading="lazy"` on non-critical images
- `defer` on GSAP and tsParticles scripts
- Custom cursor only enabled on `pointer: fine` devices
- Animations use `transform` and `opacity` (GPU-accelerated)
- tsParticles and GSAP gracefully degrade if CDN fails

## Development Workflow

### Running Locally

No build step required. Serve the directory with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

### Deploying

Push to `master` branch — Vercel auto-deploys from the repo.

### Making Changes

- **Layout/content**: Edit `index.html`
- **Animations/interactions**: Edit `main.js`
- **Marketing features** (modals, toasts, countdown, exit-intent): Edit `marketing.js`
- **Styling/theming**: Edit `style.css` — all design tokens are CSS variables in `:root`

### No Build Tools

There is no `package.json`, no linter, no formatter, no test suite. Changes are immediate — edit and reload.

## Common Pitfalls

- All external libraries load from CDN — changes require updating `<script>` tags in `index.html`
- Global function exports use `window.functionName = function()` pattern for `onclick` handlers in HTML
- The countdown timer in marketing.js has a hardcoded deadline date — update `deadline` variable when changing promotions
- Social proof toast messages are hardcoded in `proofMessages` array in `marketing.js`
- Currency is Russian Ruble (₽), formatted via `Intl.NumberFormat('ru-RU')`

## Git Conventions

- Commit messages use conventional format: `feat:`, `fix:`, `refactor:`, etc.
- Main branch: `master`
- 3 commits in history (initial commit + 2 feature additions)
