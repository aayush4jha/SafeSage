# Design System Specification: High-Fidelity Cybersecurity Interface

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Guardian’s Atelier"**
In an industry dominated by dark, aggressive "hacker" aesthetics, this design system takes an editorial, high-end approach. We are moving away from the "command center" cliché toward a sophisticated, airy, and hyper-legible workspace.

The system breaks the "standard dashboard" mold through **Intentional Asymmetry** and **Tonal Depth**. Instead of rigid grids, we use breathing room and overlapping surfaces to create a sense of calm authority. We treat data not as a series of boxes, but as a curated gallery of insights.

---

## 2. Colors & Surface Philosophy

### The "No-Line" Rule
**Strict Mandate:** 1px solid borders are prohibited for sectioning or layout containment. Use background color shifts (e.g., `surface-container-low` vs. `surface`) or subtle tonal transitions to define boundaries. 

### Color Tokens (Material Design Convention)
*   **Primary (Security/Trust):** `primary` (#006b2c) | `on_primary_container` (#f7fff2)
*   **Neutral (Foundation):** `surface` (#f8f9fa) | `surface_container_low` (#f3f4f5) | `surface_container_highest` (#e1e3e4)
*   **Accent (Alert/Warning):** `error` (#ba1a1a) | `tertiary` (#825100)

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use `surface_container` tiers to create "nested" depth.
*   **Level 0 (App Background):** `surface` (#f8f9fa).
*   **Level 1 (Main Content Area):** `surface_container_low`.
*   **Level 2 (Data Cards):** `surface_container_lowest` (#ffffff). This creates a soft "lift" without needing a shadow.

### The Glass & Gradient Rule
To move beyond a "flat" SaaS look:
*   **Glassmorphism:** Use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur for floating modals or navigation rails.
*   **Signature Textures:** For high-level metrics or CTAs, use a linear gradient: `primary` (#006b2c) to `primary_container` (#00873a) at a 135° angle.

---

## 3. Typography
We utilize a dual-font strategy to balance technical precision with editorial elegance.

*   **Display & Headlines (Manrope):** Used for high-level numbers and page titles. Its geometric nature feels modern and authoritative.
    *   *Headline-LG:* 2rem / Bold / Tracking -0.02em.
*   **Interface & Body (Inter):** Used for all functional data, labels, and paragraph text. Inter’s tall x-height ensures readability in dense security logs.
    *   *Body-MD:* 0.875rem / Regular / Leading 1.5.
*   **Hierarchy Note:** Use `on_surface_variant` (#3e4a3d) for secondary labels to create a soft contrast against the high-black `on_surface` (#191c1d).

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering**. Place a `surface_container_lowest` card on a `surface_container_low` background. This "paper-on-table" effect is the hallmark of premium SaaS design.

### Ambient Shadows
Shadows must be invisible until noticed.
*   **Standard Lift:** `0 4px 20px -2px rgba(25, 28, 29, 0.06)`. 
*   **Color Tinting:** Shadows should use a tinted version of `on_surface` rather than pure black to maintain a light, "airy" feel.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., input fields), use a **Ghost Border**: `outline_variant` (#bdcaba) at 20% opacity. Never use 100% opaque borders.

---

## 5. Components

### Cards & Lists
*   **No Dividers:** Forbid the use of divider lines. Use vertical white space (`spacing-6`) or subtle background shifts.
*   **Rounding:** Apply `xl` (1.5rem) for large dashboard containers and `lg` (1rem) for internal cards.

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`) with a soft `primary_fixed` glow on hover.
*   **Secondary:** `surface_container_high` background with `on_secondary_container` text. No border.

### Input Fields
*   **State:** Default state uses `surface_container_highest`. On focus, transition to `surface_container_lowest` with a 2px `primary` "Ghost Border" (20% opacity).

### Cybersecurity Specifics
*   **Threat Gauges:** Use semi-circular "Ring" charts. Use `primary` for "Safe" and `error` for "Breached."
*   **Status Chips:** Use `primary_fixed` for "Active" and `error_container` for "Critical." Text should be the "on" variant (e.g., `on_primary_fixed_variant`).

---

## 6. Do’s and Don'ts

### Do
*   **Do** use asymmetrical layouts (e.g., a wide 2/3 column for a main graph, a narrow 1/3 for activity feeds).
*   **Do** use `display-sm` for "big numbers" (e.g., 99.9% Uptime) to create editorial impact.
*   **Do** prioritize whitespace. If a section feels crowded, increase the spacing from `spacing-4` to `spacing-8`.

### Don't
*   **Don't** use pure black (#000000) for text. Use `on_surface`.
*   **Don't** use "Alert Red" for anything other than critical security failures. Use `tertiary` (Orange) for warnings.
*   **Don't** use standard box-shadows. If a card doesn't "pop" enough through color shifts, use a more diffused, lower-opacity shadow.