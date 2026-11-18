---
version: alpha
name: ChatGPT Minimal Light
description: A restrained, utility-first light interface with strong contrast, soft borders, and generous empty space.
colors:
  primary: "#000000"
  secondary: "#5d5d5d"
  tertiary: "#e5e7eb"
  neutral: "#fcfcfc"
  surface: "#ffffff"
  on-surface: "#0d0d0d"
  error: "#d92d20"
  border: "#00000033"
typography:
  headline-display:
    fontFamily: -apple-system-body
    fontSize: 28px
    fontWeight: 400
    lineHeight: 32px
    letterSpacing: 0px
  headline-lg:
    fontFamily: -apple-system-body
    fontSize: 24px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0.07px
  headline-md:
    fontFamily: -apple-system-body
    fontSize: 22px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  headline-sm:
    fontFamily: -apple-system-body
    fontSize: 20px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  body-lg:
    fontFamily: -apple-system-body
    fontSize: 18px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: -0.05px
  body-md:
    fontFamily: -apple-system-body
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: -0.1px
  body-sm:
    fontFamily: -apple-system-body
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  label-lg:
    fontFamily: -apple-system-body
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0px
  label-md:
    fontFamily: -apple-system-body
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  label-sm:
    fontFamily: -apple-system-body
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 30px
  lg: 62px
  xl: 154px
components:
  button-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 15px 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 15px 12px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: 15px 12px
    height: 44px
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.none}"
    padding: 0px
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 14px 16px
    height: 50px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 10px 14px
    height: 40px
---

# ChatGPT Minimal Light

## Overview
This system feels calm, efficient, and highly utilitarian, with very little visual noise. It is built for a broad consumer audience that wants clarity and fast task entry rather than ornamental branding. The tone is friendly but restrained, using subtle borders, soft shadows, and large areas of whitespace to keep the interface approachable.

## Colors
- **Primary (#000000):** Used for the strongest contrast points, including the filled action button, key icons, and prominent text accents.
- **Secondary (#5d5d5d):** A muted gray for secondary copy, helper text, and low-emphasis links where legibility still matters.
- **Tertiary (#e5e7eb):** A pale border gray that supports card edges, dividers, and input outlines without drawing attention.
- **Neutral (#fcfcfc):** The page background tone, nearly white but slightly softened to avoid the harshness of pure white.
- **Surface (#ffffff):** The cleanest panel and control fill for buttons, inputs, and raised elements.
- **On-surface (#0d0d0d):** The primary readable ink for controls and important text on light surfaces.
- **Error (#d92d20):** Reserved for destructive actions and validation feedback; it should stay rare and highly visible.
- **Border (#00000033):** A translucent hairline border used to keep controls defined while preserving the airy feel.

## Typography
Typography is system-based and platform-native, relying on `-apple-system-body` and its fallbacks for a familiar, crisp UI. Headings are intentionally light in weight at 400, which keeps the interface from feeling overly editorial or heavy. Body text sits at 16px/24px with slight negative letter spacing, while labels use 12px–14px sizes with stronger or semibold weight depending on emphasis. Uppercase styling is not a defining trait here; readability and quiet hierarchy are more important than typographic flair.

## Layout
The layout is open and spacious, with a fixed left rail and a large, mostly empty central workspace. Vertical rhythm is governed by a simple spacing scale that jumps from 8px to 16px, then into larger structural gaps like 30px, 62px, and 154px for major separations. Cards and panels use compact internal padding, while the main canvas relies on whitespace rather than dense container stacking. This system favors centered focal areas, edge-aligned navigation, and generous breathing room around interactive entry points.

## Elevation & Depth
Depth is intentionally subtle. The interface uses light borders and faint shadows rather than strong layering or dramatic elevation. The strongest depth cues appear on interactive pills and the composer field, where a soft shadow and border help controls feel tappable without making them visually heavy. Overall, the UI stays close to flat, with hierarchy created through contrast, spacing, and alignment instead of stacked surfaces.

## Shapes
The shape language is soft and highly rounded. Most prominent interactive elements use pill geometry with `rounded.full`, giving buttons, chips, and inputs a friendly, approachable appearance. Cards use a moderate `rounded.md` radius, which is enough to soften edges without making panels feel decorative. The result is a calm, modern look that feels ergonomic rather than expressive.

## Components
Buttons are the clearest expression of the system. `button-secondary` is the strongest call to action, using a black fill with white text and pill corners, while `button-primary` stays light with a white surface, dark text, and a subtle border. `button-tertiary` should remain text-like and minimal, with no border and no filled background. All buttons should keep the compact 44px visual height standard and use medium-heavy label weight for clarity.

Inputs should be wide, horizontally centered when used as the primary composer, and visually quiet. `input` uses a white surface, thin border, pill radius, and generous horizontal padding so placeholder text and icons have room. Focus states should preserve the clean look while increasing clarity through border or shadow emphasis rather than color overload.

Cards should feel like organized containers, not elevated panels. `card` uses the neutral background, a 1px border, and modest 16px padding to frame content without competing with it. Use cards for secondary informational groupings, onboarding prompts, and utility blocks.

Chips and quick actions should be compact and pill-shaped. `chip` should echo the input and button radius language, with restrained padding and strong text contrast. Keep iconography minimal and thin-stroked, matching the understated behavior of the surrounding controls.

Links and supporting text should remain understated. Use `button-tertiary` or `label-sm` styling for footer links, legal text, and low-priority navigation, avoiding any heavy visual treatment unless the interaction is primary. Icons should stay monochrome, line-based, and proportional to text rather than becoming decorative.

## Do's and Don'ts
- Do keep the interface spacious and centered around a clear primary action.
- Do use black, white, and soft grays as the core palette.
- Do prefer pill-shaped controls for primary actions and composer elements.
- Do rely on borders and whitespace before adding stronger shadows or color.
- Don't introduce loud gradients, saturated accent colors, or decorative fills.
- Don't use heavy typography weights or oversized headings for standard content.
- Don't make cards feel like floating layers unless there is a functional reason.
- Don't crowd the layout with dense panels, stacked blocks, or excessive dividers.