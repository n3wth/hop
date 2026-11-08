---
title: Balance footer groups and keep navigation opaque
date: 2026-11-07
category: ui
tags: [footer, navigation, responsive]
---

The footer's fourth group wrapped beneath a three-column grid, while the brand
stacked above it with centered text. Oliver requested removal of Family. Keep
the three remaining groups balanced, left-align the brand, and separate the
copyright row. Educational links belong in Learn rather than extending Explore.

The scrolling navigation used a 75% opaque surface, letting destination photos
tint its background. Use the existing opaque surface token for stable contrast.

Verified the production build at 1440, 800, and 390 CSS pixels. The footer remains
hidden below the existing mobile breakpoint; the bottom navigation remains intact.
The repository check passed all 1,463 tests, with 136 existing lint warnings.
