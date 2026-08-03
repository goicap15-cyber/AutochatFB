# Enterprise Design System — FB Messenger CRM

> **Application:** Messenger CRM for Facebook  
> **Design Philosophy:** Linear-inspired Enterprise Productivity System  
> **Core Aesthetic:** Calm, Clean, Confident, Ergonomic for 8 Hours/Day Daily Operations  
> **Anti-Patterns:** NO excessive gradients, NO neon glow, NO glassmorphism everywhere, NO visual noise, NO Dribbble/Behance concept art  

---

## 1. Design Philosophy & Core Principles

### 1.1 Ergonomic Visual Comfort (8-Hour Ergonomics)
- **Zero Eye Strain:** Solid neutral slate and obsidian dark tones (`#090d16`, `#0f172a`) replace bright neon highlights and heavy drop shadows.
- **Calm Density:** High data density balanced by generous whitespace and subtle 1px dividers rather than floating colorful cards.

### 1.2 Linear-Grade Efficiency & Focus
- **Instant Keyboard Navigation:** Sub-30ms interaction feedback, `Ctrl+K` global search overlay, `Esc` modal dismiss.
- **Predictable Controls:** Flat, 1px-bordered input fields and buttons with subtle 100ms hover transitions.

### 1.3 Professional Enterprise Reliability
- **Subtle Functional Indicators:** Color is reserved strictly for status communication (Blue = Active/Primary, Green = Success/Captured, Red = Warning/Unsent, Muted = Secondary).
- **No Novelty Animations:** Avoid bouncing elements, pulsing glows, or decorative particle effects. Use clean 0.15s ease-in-out transitions.

---

## 2. Color System

Strict neutral palette with zero neon or random accent colors.

### 2.1 Color Tokens

```
[Background & Surface]
--bg-app:        #090d16  (Deep Obsidian Base)
--bg-surface:    #0f172a  (Panel Surface & Cards)
--bg-elevated:   #1e293b  (Input Fields, Hover States, Active Tab)
--bg-overlay:    rgba(0, 0, 0, 0.75) (Modal Mask)

[Borders & Dividers]
--border-subtle: #1e293b  (Panel Dividers & Quiet Borders)
--border-strong: #334155  (Focus States & Active Selection Borders)

[Typography Text Tokens]
--text-heading:  #f8fafc  (Primary Headings & Active Values)
--text-body:     #cbd5e1  (Chat Text & Form Labels)
--text-muted:    #64748b  (Timestamps, Secondary Meta, Placeholders)

[Functional Status Accents (Restrained)]
--accent-primary:#2563eb  (Linear Blue - Primary Action & Outgoing Chat)
--accent-success:#059669  (Slate Green - Completed & Lead Verified)
--accent-warning:#d97706  (Amber - AI Paused & System Alerts)
--accent-danger: #dc2626  (Crimson - Unsent Message & Checkpoint Action)
```

---

## 3. Typography & Hierarchy

Font Family: **Inter** (`font-sans`), Monospace for IDs/Tokens: **JetBrains Mono**.

| Level | Size / Line-height | Weight | Letter-spacing | Color Token |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | 16px / 24px | Semibold (600) | -0.01em | `--text-heading` |
| **Section Header** | 13px / 18px | Semibold (600) | -0.01em | `--text-heading` |
| **Body / Chat** | 13px / 20px | Regular (400) | normal | `--text-body` |
| **Meta / Time** | 11px / 16px | Medium (500) | normal | `--text-muted` |
| **Tag / Monospace** | 10px / 14px | Semibold (600) | 0.02em UPPERCASE | `--text-muted` |

---

## 4. Layout Architecture (Solid 4-Column Grid)

- **Sidebar Navigation:** 56px fixed width, solid `#090d16`, 1px right border `#1e293b`.
- **Thread List Panel:** 320px fixed width, solid `#0f172a`, 1px right border `#1e293b`.
- **Chat Area Panel:** Flexible center flex grow, solid `#090d16`.
- **Lead Context Panel:** 340px fixed width, solid `#0f172a`, 1px left border `#1e293b`.

---

## 5. Component Specifications (Clean Enterprise UI)

### 5.1 Buttons
- **Primary:** `bg-blue-600 hover:bg-blue-500 text-white rounded-md px-3 py-1.5 text-xs font-medium` (No drop shadow, no glow).
- **Secondary:** `bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-md px-3 py-1.5 text-xs font-medium`.
- **Ghost:** `text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md p-1.5`.

### 5.2 Form Inputs & Textareas
- **Background:** `bg-slate-950` (`#090d16`).
- **Border:** `1px solid #1e293b`.
- **Focus:** `border-blue-500 outline-none ring-1 ring-blue-500/30`.
- **Padding:** `px-3 py-2 text-xs text-slate-100 rounded-md`.

### 5.3 Modals & Overlays
- **Backdrop:** `bg-black/75` (Solid dim, no excessive blur).
- **Dialog Box:** `bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden`.
- **Header:** `px-5 py-4 border-b border-slate-800 text-sm font-semibold text-slate-100`.

### 5.4 Message Bubbles
- **Customer (Incoming):** `bg-slate-800/90 text-slate-200 rounded-lg rounded-tl-none p-3 text-xs border border-slate-700/50`.
- **Agent (Outgoing):** `bg-blue-600 text-white rounded-lg rounded-tr-none p-3 text-xs`.
- **Unsent Warning:** `bg-slate-900 text-red-300 border border-red-500/30 rounded-lg p-3 text-xs`.
