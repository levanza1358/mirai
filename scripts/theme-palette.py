#!/usr/bin/env python3
"""Mirai theme: swap the brand palette from orange/coral to emerald/teal."""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "src", "app", "globals.css")

with io.open(CSS, "r", encoding="utf-8", errors="surrogateescape") as f:
    css = f.read()

# --- Light theme palette block -------------------------------------------------
old_light = """/* ============================================================
   Mirai palette \u2014 adopted from 9remote_private/web
   Brand orange (dark) / soft coral (light), neutral warm bases
   ============================================================ */
:root {
  /* Brand scale (light) - centered on #E56A4A */
  --color-brand-50: #fdf1ed;
  --color-brand-100: #fadccf;
  --color-brand-200: #f4b59c;
  --color-brand-300: #ee8d6a;
  --color-brand-400: #ea7855;
  --color-brand-500: #E56A4A;
  --color-brand-600: #cc5236;
  --color-brand-700: #a64027;
  --color-brand-800: #7a2f1d;
  --color-brand-900: #4d1e12;

  /* Primary (legacy alias for backward compat with existing components) */
  --color-primary: var(--color-brand-500);
  --color-primary-hover: var(--color-brand-600);

  /* Surfaces & backgrounds (light) */
  --color-bg: #FDFAF6;
  --color-bg-alt: #F7F3EE;
  --color-surface: #ffffff;
  --color-surface-2: #f4f4f5;
  --color-surface-3: #e7e7e9;
  --color-sidebar: rgba(244, 241, 236, 0.85);"""

new_light = """/* ============================================================
   Mirai palette \u2014 fresh & clean emerald / teal
   Brand emerald (dark) / soft mint (light), cool neutral bases
   ============================================================ */
:root {
  /* Brand scale (light) - centered on #10B981 (emerald 500) */
  --color-brand-50: #ecfdf5;
  --color-brand-100: #d1fae5;
  --color-brand-200: #a7f3d0;
  --color-brand-300: #6ee7b7;
  --color-brand-400: #34d399;
  --color-brand-500: #10b981;
  --color-brand-600: #059669;
  --color-brand-700: #047857;
  --color-brand-800: #065f46;
  --color-brand-900: #064e3b;

  /* Primary (legacy alias for backward compat with existing components) */
  --color-primary: var(--color-brand-500);
  --color-primary-hover: var(--color-brand-600);

  /* Accent (teal) - secondary hue for gradients / highlights */
  --color-accent-400: #2dd4bf;
  --color-accent-500: #14b8a6;
  --color-accent-600: #0d9488;

  /* Surfaces & backgrounds (light) */
  --color-bg: #F6FBF9;
  --color-bg-alt: #EDF7F3;
  --color-surface: #ffffff;
  --color-surface-2: #f3f5f4;
  --color-surface-3: #e6eae8;
  --color-sidebar: rgba(236, 245, 241, 0.85);"""

# --- Dark theme palette block --------------------------------------------------
old_dark = """  /* Brand scale (dark) - centered on #E56A4A, same as light for consistency */
  --color-brand-50: #fdf1ed;
  --color-brand-100: #fadccf;
  --color-brand-200: #f4b59c;
  --color-brand-300: #ee8d6a;
  --color-brand-400: #ea7855;
  --color-brand-500: #E56A4A;
  --color-brand-600: #cc5236;
  --color-brand-700: #a64027;
  --color-brand-800: #7a2f1d;
  --color-brand-900: #4d1e12;

  --color-primary: #E56A4A;
  --color-primary-hover: #cc5236;"""

new_dark = """  /* Brand scale (dark) - centered on #34D399, brighter for contrast on dark */
  --color-brand-50: #ecfdf5;
  --color-brand-100: #d1fae5;
  --color-brand-200: #a7f3d0;
  --color-brand-300: #6ee7b7;
  --color-brand-400: #34d399;
  --color-brand-500: #10b981;
  --color-brand-600: #059669;
  --color-brand-700: #047857;
  --color-brand-800: #065f46;
  --color-brand-900: #064e3b;

  --color-primary: #34d399;
  --color-primary-hover: #10b981;

  /* Accent (teal) */
  --color-accent-400: #2dd4bf;
  --color-accent-500: #14b8a6;
  --color-accent-600: #0d9488;"""

count = 0
for old, new in ((old_light, new_light), (old_dark, new_dark)):
    if old not in css:
        print("WARN: block not found (first 60 chars):", old[:60].replace("\n", " | "))
        continue
    css = css.replace(old, new, 1)
    count += 1

# --- Neutral warm -> cool surfaces ---------------------------------------------
neutral = [
    ('/* Surfaces (dark - Claude-like neutral warm) */', '/* Surfaces (dark - cool neutral) */'),
    ('--color-bg-light: #FCFBF9;', '--color-bg-light: #F6FBF9;'),
    ('--color-sidebar-light: #F4F1EC;', '--color-sidebar-light: #ECF5F1;'),
    ('--color-bg-dark: #1a1a1a;', '--color-bg-dark: #0F1512;'),
    ('--color-bg-alt: #1F1F1E;', '--color-bg-alt: #141B18;'),
    ('--color-surface: #262626;', '--color-surface: #1A211E;'),
    ('--color-surface-2: #303030;', '--color-surface-2: #222A27;'),
    ('--color-surface-3: #3a3a3a;', '--color-surface-3: #2C3633;'),
    ('--color-sidebar-dark: #1F1F1E;', '--color-sidebar-dark: #141B18;'),
    ('--color-sidebar: rgba(30, 30, 30, 0.85);', '--color-sidebar: rgba(20, 27, 24, 0.85);'),
    ('--color-border: #333333;', '--color-border: #2A3632;'),
    ('--color-border-subtle: #2a2a2a;', '--color-border-subtle: #202A27;'),
    ('--color-text: #ededed;', '--color-text: #E7F1EC;'),
    ('--color-text-main: #ededed;', '--color-text-main: #E7F1EC;'),
    ('--shadow-warm: 0 2px 12px -2px rgba(229, 106, 74, 0.25);', '--shadow-warm: 0 2px 12px -2px rgba(16, 185, 129, 0.25);'),
    ('--shadow-warm: 0 2px 12px -2px rgba(229, 106, 74, 0.18);', '--shadow-warm: 0 2px 12px -2px rgba(16, 185, 129, 0.18);'),
    ('--shadow-focus: 0 0 0 3px rgba(229,106,74,0.18);', '--shadow-focus: 0 0 0 3px rgba(16,185,129,0.22);'),
    ('--shadow-focus: 0 0 0 3px rgba(229, 106, 74, 0.18);', '--shadow-focus: 0 0 0 3px rgba(16, 185, 129, 0.22);'),
]
for old, new in neutral:
    if old in css:
        css = css.replace(old, new)
        count += 1

# Expose the accent scale to Tailwind's @theme (so `accent-500` utilities work).
anchor = "  --color-brand-900: var(--color-brand-900);\n"
if anchor in css and "--color-accent-500: var(--color-accent-500);" not in css:
    css = css.replace(
        anchor,
        anchor
        + "\n  /* Accent scale (teal) */\n"
        + "  --color-accent-400: var(--color-accent-400);\n"
        + "  --color-accent-500: var(--color-accent-500);\n"
        + "  --color-accent-600: var(--color-accent-600);\n",
        1,
    )
    count += 1

with io.open(CSS, "w", encoding="utf-8", errors="surrogateescape") as f:
    f.write(css)

print("globals.css: %d edits applied" % count)
