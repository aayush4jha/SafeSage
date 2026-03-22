```markdown
# Visual Identity & Design System Specification

## 1. Overview & Creative North Star: "The Digital Sanctuary"

This design system is built upon the concept of **The Digital Sanctuary**. In an era of chaotic interfaces and loud "fintech-blue" aesthetics, this system leans into a sophisticated, editorial-heavy visual language that balances the clinical precision of high-end security with the organic warmth of a trusted advisor. 

We reject the "template" look. Instead of rigid grids and 1px borders, we use **Intentional Asymmetry** and **Tonal Depth**. Our goal is to create a UI that feels curated—where white space is a functional element of prestige, and every transition feels like a physical layer of glass or fine paper moving in space. 

### The Editorial Shift
- **Asymmetry:** Use off-center alignments in hero sections to create visual tension and interest.
- **Scale:** Dramatic contrast between `display-lg` typography and `body-sm` metadata creates a hierarchy that feels authoritative and modern.
- **Breathing Room:** We utilize the upper ends of our spacing scale (4rem+) to separate core value propositions, ensuring the user never feels overwhelmed.

---

## 2. Color & Surface Philosophy

The palette is anchored in a deep, verdant Green (`primary: #006c3c`) and a series of sophisticated Neutrals. The application of these colors must follow three non-negotiable rules to maintain a premium feel.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections or containers. 
Boundaries must be created solely through background shifts. For example, a `surface-container-low` section should sit directly against a `surface` background. The change in tone is enough to signal a transition.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create depth:
- **Base Layer:** `surface` (#f8fafb)
- **Primary Content Blocks:** `surface-container-low` (#f2f4f5)
- **Interactive Cards:** `surface-container-lowest` (#ffffff)
- **Navigation/Modals:** `surface-container-highest` (#e1e3e4)

### The "Glass & Gradient" Rule
To escape a "flat" appearance, floating elements (like dropdowns or sticky headers) should utilize **Glassmorphism**. Use semi-transparent variants of `surface` with a `backdrop-blur` of 12px–20px. 
**Signature Texture:** Use a subtle linear gradient from `primary` (#006c3c) to `primary_container` (#1a874f) at a 135-degree angle for primary CTAs to give them a "jewel-like" depth.

---

## 3. Typography: The Voice of Authority

We pair **Manrope** (Display/Headline) with **Inter** (Body/UI). Manrope provides a modern, geometric clarity, while Inter ensures maximum legibility for complex data.

- **Display (Manrope):** Use for high-impact statements. The wide apertures of Manrope feel welcoming yet professional.
- **Body (Inter):** Use for all functional UI and long-form text. 
- **The Contrast Rule:** Headlines should always be `tight` (tracking -2%) to feel impactful. Labels and captions should have slightly increased letter spacing (+1% to +2%) to maintain "premium" airiness at small scales.

| Token | Font | Size | Weight | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| `display-lg` | Manrope | 3.5rem | 700 | Hero Statements |
| `headline-md` | Manrope | 1.75rem | 600 | Section Headers |
| `title-md` | Inter | 1.125rem | 500 | Card Titles |
| `body-md` | Inter | 0.875rem | 400 | Standard Copy |
| `label-sm` | Inter | 0.6875rem | 600 | Overlines / Micro-data |

---

## 4. Elevation & Depth: Tonal Layering

We avoid traditional "material" shadows in favor of a more natural, ambient lighting model.

### The Layering Principle
Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-low` background creates a "soft lift." This is our primary method of elevation.

### Ambient Shadows
When a "floating" effect is required (e.g., a primary modal):
- **Blur:** 40px - 60px.
- **Opacity:** 4% - 8%.
- **Color:** Use a tinted version of `on_surface` (a deep grey-green) rather than pure black. This mimics natural light passing through glass.

### The "Ghost Border" Fallback
If accessibility requirements demand a border, use the **Ghost Border**:
- `outline_variant` token at **15% opacity**.
- Never use a 100% opaque border for containment.

---

## 5. Components

### Buttons (The "Jewel" Standard)
- **Primary:** Gradient (`primary` to `primary_container`), `md` (0.75rem) roundedness. No border. Text: `on_primary`.
- **Secondary:** Surface-tonal. Use `secondary_container`. Text: `on_secondary_container`.
- **Tertiary:** Text only. Use `primary` color. High-emphasis hover state using a `surface-container-high` background pill.

### Cards & Lists (The "Border-Free" Rule)
- **Cards:** Forbid divider lines. Separate content using the Spacing Scale (typically `spacing-6` or `spacing-8`).
- **Nesting:** Place a `surface-container-lowest` card inside a `surface-container-low` section to define the card area.

### Input Fields
- **Default State:** `surface-container-high` background. No border.
- **Focus State:** `outline` color applied as a 2px inner-glow or a very soft shadow, rather than a harsh border change.

### Sanctuary Chips
- Use for status or filtering. High roundedness (`full`). Background: `secondary_container` with `on_secondary_container` text.

---

## 6. Do's and Don'ts

### Do:
- **Do** use intentional white space. If a layout feels "crowded," double the spacing token.
- **Do** use `surface_bright` for areas meant to draw the eye without using high-saturation colors.
- **Do** use `Manrope` for any text larger than 24px.

### Don't:
- **Don't** use 1px solid #EEEEEE lines to separate list items; use 12px of vertical space or a subtle background shift.
- **Don't** use pure black (#000000) for text. Always use `on_surface` or `on_background` to maintain the sophisticated tonal palette.
- **Don't** use standard "drop shadows" with high opacity. If the shadow is noticeable at first glance, it is too heavy.

---

## 7. Spacing & Rhythm

All layouts must adhere to the spacing scale to maintain a rhythmic, editorial flow. 

- **Section Padding:** Minimum `spacing-16` (4rem) to `spacing-24` (6rem) for top/bottom margins.
- **Component Gaps:** Use `spacing-4` (1rem) for related elements and `spacing-8` (2rem) for distinct groups.
- **Rounding:** Stick to `md` (0.75rem) for cards and `lg` (1rem) for larger containers to maintain a soft, modern approachable feel. Avoid `none` (square corners) as it feels too aggressive for a "Sanctuary" concept.```