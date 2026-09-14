# 08 — UI / UX Spec

Status: 🟡 DRAFT

## Screen Inventory

| # | Screen name | Purpose | Entry points |
|---|---|---|---|
| 1 | [ ] | [ ] | [ ] |
| 2 | [ ] | [ ] | [ ] |

## Navigation Flow

```
[Splash] -> [Home] -> [Detail]
                   -> [Search] -> [Detail]
                   -> [Settings]
```

## Design System

- Color palette: [primary / secondary / background / error colors, hex values]
- Typography: [font family, scale — h1/h2/body/caption sizes]
- Spacing scale: [e.g. 4/8/16/24/32 px system]
- Component library: [Material / custom / shadcn / etc.]
- Dark mode: [supported? default?]

## Required States for Every Screen

Every screen/component must explicitly design for:

- [ ] **Loading state** — skeleton/spinner, not a blank screen
- [ ] **Empty state** — friendly message + call to action, not just nothing
- [ ] **Error state** — clear message + retry action, see `09_ERROR_HANDLING.md`
- [ ] **Success/populated state** — the "happy path"
- [ ] **Offline state** (if applicable)

## Accessibility Requirements

- Minimum tap target size: [e.g. 44x44 px]
- Color contrast ratio: [WCAG AA minimum 4.5:1 for text]
- Screen reader labels required on: [icons, images, interactive elements]

## Responsive Rules

- Breakpoints: [mobile / tablet / desktop widths]
- Layout changes at each breakpoint: [ ]
