# Inclusion Dashboard — Design System

> Reference document for all UI decisions. Use this when implementing any visual element in the dashboard or landing page. All colour, typography, and state decisions are recorded here.

---

## 1. Neutral Foundation (Layer 1)

The structural backbone of every screen. No pure whites or blacks anywhere in the interface.

| Role | Token Name | Hex | Notes |
|---|---|---|---|
| App canvas background | `bg-canvas` | `#F7F8FA` | All screens sit on this. Never pure white. |
| Sidebar / structural anchor | `bg-structure` | `#F0F2F5` | Pure neutral gray. No colour tint to avoid clashing with domain colours. |
| Card surface | `bg-card` | `#FFFFFF` | Cards sit on canvas — the contrast creates hierarchy. |
| Subtle border / divider | `border-subtle` | `#E2E8F0` | Defines space without overpowering. Use for separators and card edges. |
| Strong border | `border-strong` | `#CBD5E0` | Use sparingly for more prominent divisions. |

---

## 2. Brand / Interface Colour (Layer 2)

A single unified navy drives all interactive elements. No separate brand blue — everything derives from the header navy.

| Role | Token Name | Hex | Notes |
|---|---|---|---|
| Primary anchor (header bg) | `brand-navy` | `#1B365D` | The header. All interface actions derive from this. |
| Primary button / action | `action-primary` | `#1B365D` | "Generate Report", "Add Evidence". White text on top. |
| Button hover | `action-hover` | `#152A4A` | Slightly darker variant of brand navy. |
| Active sidebar state (bg) | `action-active-bg` | `rgba(27,54,93,0.10)` | 10% opacity wash of brand navy. |
| Active sidebar state (text) | `action-active-text` | `#1B365D` | Bold brand navy text paired with the wash bg. |

---

## 3. RAG Status Palette (Layer 3 — Functional Register)

Used exclusively for provision point status. Never used for domain identity. These colours operate in a completely separate visual register from domain colours.

| Status | Token Name | Hex | OKLCH Approx | Usage |
|---|---|---|---|---|
| Completed / In Place | `status-green` | `#257A3B` | `oklch(54% 0.16 145)` | Progress bars, "In Place" pills, Completed node state. |
| In Progress | `status-amber` | `#D4751A` | `oklch(68% 0.14 65)` | Progress bars, "In Progress" pills. Slightly cooler than #E67E22 to read as amber not orange. |
| Not in Place / Overdue | `status-red` | `#EA4335` | `oklch(60% 0.18 25)` | "Not in Place" pills, overdue dates, alert indicators. |

**Rule:** If it communicates provision status, use only these three colours. Nothing else.

---

## 4. Domain Identity Palette (Layer 3 — Identity Register)

Used exclusively for domain navigation and orientation. Never used for status. Hues are deliberately chosen to stay clear of the RAG spectrum (no standard greens, yellows, or bright reds).

Applied as: soft background tint (5–10% opacity) on cards/pills, with the deep tone used for text and icons.

| Domain | Identity Tint (bg) | Text / Icon Colour | Notes |
|---|---|---|---|
| SEND Support & Needs | `#EEF2FF` | `#4338CA` | Shifted to clear Royal Indigo, distinct from brand navy. |
| Equity & Disadvantage | `#FEF9EC` | `#7A5C13` | Warm ochre / bronze. |
| Attendance & Engagement | `#E6F4F2` | `#0E6251` | Rich teal. |
| Enrichment | `#F5F0FA` | `#6B21A8` | Muted plum / purple. Shifted away from burgundy to avoid red association. |
| Belonging | `#F0F4F8` | `#334E68` | Deep slate blue. |
| Wellbeing | `#F3F0FA` | `#5B3A9C` | Editorial violet. |

**Rule:** Domain colour identifies where you are. RAG colour tells you how you're doing. They never overlap.

---

## 5. Node States

Four states for every provision point. Maps directly to the functional register.

| State | Visual Treatment | Background | Border | Text | Icon |
|---|---|---|---|---|---|
| Untouched | Hollow pill, no icon | `#E2E8F0` | None | `#64748B` | None |
| Untouched by Choice | Slate pill + minus icon | `#CBD5E1` | None | `#475569` | ⊖ (minus circle) |
| In Progress | Tinted pill + amber border | `rgba(212,117,26,0.22)` | `#D4751A` (2px) | `#D4751A` | None |
| Completed | Solid green pill + check | `#257A3B` | None | `#FFFFFF` | ✓ |

**Notes:**
- In Progress tint is set at 22% opacity (not 15%) to ensure sufficient contrast against the #F7F8FA canvas.
- Completed uses solid green with white text to convey the weight of Approver sign-off.
- Untouched by Choice must never read as a warning — the slate tone and ⊖ icon signal deliberate omission, not an error.

---

## 6. Typography Scale

**Primary typeface:** Inter (load via Google Fonts or Fontsource)
**Fallback:** Plus Jakarta Sans

| Tier | Role | Size | Weight | Colour | Notes |
|---|---|---|---|---|---|
| H1 | Page titles / Welcome | 24px | 700 (Bold) | `#1B365D` | "Good morning", "Report Builder" |
| H2 | Domain / Section headers | 18px | 600 (SemiBold) | `#1A202C` | Card titles, section anchors |
| H3 | Key metrics / Large stats | 32–36px | 700 (Bold) | `#1A202C` or status colour | "86% Overall Readiness" |
| Body Lead | Provision point rows | 14px | 500 (Medium) | `#1A202C` | Main data entry rows |
| Body Small | Secondary descriptions | 13–14px | 400 (Regular) | `#4A5568` | Hints, contextual text |
| Subtext / Meta | Timestamps, counts, labels | 12px | 400–500 | `#64748B` | Dates, micro-counts, button labels |

**Standing rules:**
- No pure black (`#000000`) anywhere. Darkest text is `#1A202C`.
- No bold on standard body text. Size and colour contrast carry hierarchy.
- Subtext minimum is `#64748B` (not `#718096` — fails WCAG AA at 12px).

---

## 7. Accessibility Baseline

All colour combinations in this system must meet WCAG AA:
- Normal text (below 18px): minimum 4.5:1 contrast ratio
- Large text (18px+ or 14px bold): minimum 3:1 contrast ratio

Key combinations to verify on implementation:
- White text on `status-green` (#257A3B) — verify passes 4.5:1
- `#D4751A` amber text on `rgba(212,117,26,0.22)` tinted background — verify passes 3:1
- `#64748B` subtext on `#FFFFFF` card — verify passes 4.5:1
- `#475569` text on `#CBD5E1` (Untouched by Choice) — verify passes 4.5:1

Recommended tool: https://webaim.org/resources/contrastchecker/

---

## 8. Charting Palette

For multi-series data visualisation (radar/spider chart, demographic comparison bars). Generated using OKLCH at fixed Lightness 65%, Chroma 0.15, hue increments of ~28 degrees.

| Series | Hex Approx | OKLCH |
|---|---|---|
| Series 1 | `#4A90D9` | `oklch(65% 0.15 240)` |
| Series 2 | `#5BAD6F` | `oklch(65% 0.15 150)` |
| Series 3 | `#D4884A` | `oklch(65% 0.15 60)` |
| Series 4 | `#9B6DD4` | `oklch(65% 0.15 300)` |
| Series 5 | `#D45B7A` | `oklch(65% 0.15 10)` |

**Notes:**
- For radar charts, pair each colour with a distinct line style (solid, dashed, dotted) as a secondary differentiator.
- This ensures accessibility for colour-blind users and improves legibility when series overlap.

---

## 9. Quick Reference — What Goes Where

| Element | Colour Source |
|---|---|
| App background | Layer 1 (canvas) |
| Card surfaces | Layer 1 (card white) |
| Nav header | Brand navy |
| Buttons / CTAs | Brand navy |
| Active sidebar state | Brand navy at 10% opacity |
| Provision point status | RAG palette only |
| Domain pills / cards | Domain identity palette only |
| Progress bars | RAG palette only |
| Node state badges | Node state spec (Section 5) |
| Chart series | Charting palette (Section 8) |
| All text | Typography scale (Section 6) |

---

*Last updated: June 2026. Apply to all dashboard screens and the landing page.*
