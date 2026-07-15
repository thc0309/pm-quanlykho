# Frontend Profile Template

Use this when a task includes UI, routes, components, browser behavior, or E2E checks.

## Stack Selection

Do not choose a frontend stack by default. Record the selected stack in `SPEC.md`.

Common options:

- Vite + React + Tailwind for client-heavy apps, dashboards, prototypes, and static deployments.
- Next.js only when the spec needs SSR, file-based full-stack routing, image optimization, or platform features that justify it.
- Existing project stack always wins over new preferences.

## Acceptance Checklist

- Responsive at 320px, 768px, 1024px, and 1440px.
- Accessible names, semantic landmarks, valid heading order, visible focus states.
- Keyboard navigation covers every interactive path.
- Loading, error, empty, and disabled states are implemented.
- Forms validate client-side and show useful errors without layout shift.
- Console has no unexpected errors or warnings in verified flows.
- Performance budget is stated in the task: route JS budget, image budget, or Core Web Vitals target when applicable.
- Browser/E2E coverage exists in `tasks/test-plan.md` for critical flows.

## Slice Plan

Use small vertical slices:

1. Route/page shell with navigation and layout constraints.
2. Static UI with realistic content and responsive behavior.
3. State/data wiring with loading, error, and empty states.
4. Validation and user feedback.
5. Unit/component tests for behavior.
6. Browser or E2E test cases in `tasks/test-plan.md`.

## Component Rules

- Do not create a component library early.
- Add design tokens or shared components only after 2-3 real use cases prove the abstraction.
- Prefer existing design system primitives before adding new UI primitives.
- Keep components focused; split only when readability or reuse is real.
- Avoid generic AI visual defaults: one-hue purple palettes, decorative gradients, oversized cards, and placeholder copy.

## Verification Evidence

Record:

- viewport sizes tested,
- accessibility checks performed,
- screenshots or browser observations for changed flows,
- test/build command output.
