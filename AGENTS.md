# Theme Guidelines: Professional, Simple & Flat

When building or styling UIs in this project, strictly adhere to the following design system to maintain a cohesive, professional, flat, and modern interface:

## 1. Overall Aesthetic (Flat & Minimal)
- **Flat Design:** No gradients (`bg-gradient`, `from-*`, `to-*`), no heavy or blurry shadows (`shadow-md`, `shadow-lg`, `shadow-2xl` etc.).
- **Structure via Borders:** Use subtle borders (`border border-slate-200` or `border-slate-100`) to define hierarchy instead of shadows.

## 2. Background & Textures
- **Main Background:** Use `bg-slate-50`.
- **Subtle Grid:** Implement a faint architectural grid background using CSS linear-gradients on the `body` (e.g., repeating 1px lines every 24px with `rgba(226, 232, 240, 0.4)`).
- **Cards/Containers:** Pure `bg-white` with a `slate-200` border to stand out cleanly from the grid.

## 3. Shapes & Radiuses
- Consistently use **`rounded-xl`** for main containers, cards, dialogs, and modals.
- Consistently use **`rounded-lg`** for smaller interactive elements like buttons, inputs, and badges. 
- Avoid excessively round corners (e.g., `rounded-2xl`, `rounded-3xl` or full pills) unless it is specifically an avatar or icon container.

## 4. Interactive States (Hover, Active, Focus)
- **Hover:** Keep it subtle. `hover:bg-slate-50` for white buttons, or `hover:bg-slate-800` for primary buttons.
- **Active:** Add small tactile feedback using `active:scale-[0.98]` or `active:scale-95`.
- **Focus Rings:** Flat, sharp rings strictly without blur. Use: `focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900`. 
- Avoid default blue outlines or thick blurry `focus:ring-4`.

## 5. Color Palette (High-Contrast Neutral)
- **Primary Elements:** `slate-900` for bold UI anchors, primary actions, and major headings. 
- **Secondary Elements:** `slate-500` for helper texts and inactive icons.
- **Status/State Colors:** Use soft background tints paired with deep text and a distinct, faint border (e.g., `bg-emerald-50 text-emerald-700 border border-emerald-100`).

## 6. Typography
- **Clean tracking:** Apply `tracking-tight` carefully on large headings, and keep body text clean.
- Ensure typographic hierarchy via `font-bold`, `font-semibold`, and `text-sm`/`text-xs`.

## 7. Motion & Animations
- **Library:** Use `framer-motion` (atau `motion/react`).
- **Transitions:** Use smooth, professional ease-outs (`transition={{ duration: 0.2, ease: "easeOut" }}`).
- **Mount/Unmount:** Wrap dynamic lists or changing states with `<AnimatePresence>` and apply layout animations (`layout`).
- **Initial States:** Simple fade-ins (`opacity: 0` to `opacity: 1`) or slight slide-ups (`y: 10` to `y: 0`). Nothing too bouncy or dramatic.
