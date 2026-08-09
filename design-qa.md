# Design QA: Goal account selector

## Comparison target

- Source visual truth: user-provided browser annotation screenshot for the goal “Add funds” drawer in the current request.
- Implementation screenshot: `/Users/aaarun/Documents/code/Luna/design-qa-goal-account-rail.png`.
- Home alert implementation screenshot: `/Users/aaarun/Documents/code/Luna/design-qa-home-goal-drawer.png`.
- Viewport: 393 x 833 CSS px; implementation captured at the same viewport and density.
- State: goal detail page with the direct “Add funds” money drawer open, Cash selected, and NPR 60 entered without submitting.
- Normalization: no scaling or device-frame normalization required; both are mobile viewport captures.

## Evidence

The source shows the shared goal action drawer and account choices. The requested refinement changes the account choices from a vertical stack into the application’s established horizontal account rail. The implementation now uses the shared money drawer directly, matching the transfer flow: the goal summary, account rail, Note (optional), keypad, and final Add funds action live in one drawer.

Focused implementation evidence at 393px:

- Account rail client width: 393px.
- Account rail scroll width: 587px.
- Computed horizontal overflow: `auto`.
- Page scroll width: 393px, so the rail does not create page-level horizontal overflow.
- Account cards remain shrink-resistant with widths of 145px, 158px, 96px, and 132px.
- After entering NPR 60, the direct money drawer shows the amount in its header and an enabled bottom `Add funds` button.
- The obsolete `Enter amount` header control and inline `Amount NPR 0` / `Add funds` controls are absent.
- Home alert evidence: selecting Allocate opens the same direct Add funds drawer with the goal summary, account rail, note field, keypad, and bottom Add funds action.

## Required fidelity surfaces

- Fonts and typography: existing Luna drawer typography and hierarchy are preserved; account names remain truncated within each compact card.
- Spacing and layout rhythm: the selector follows the established compact horizontal rail spacing and remains within the drawer content bounds.
- Colors and visual tokens: existing account avatar colors, primary selected state, card borders, and drawer tokens are preserved.
- Image quality and asset fidelity: existing `AccountAvatar` assets are reused; no replacement artwork was introduced.
- Copy and content: the existing “Choose the account to take from” label, account names, balances, and note field are preserved.
- Interaction: the Note (optional) field remains in place above the keypad; Add funds is the shared drawer’s bottom confirmation action.

## Findings

No actionable P0, P1, or P2 findings remain.

## Comparison history

- Initial state: account choices were stacked vertically, creating a tall drawer and diverging from the application’s horizontal account selector pattern.
- Fix: replaced the vertical grid with a labeled, touch-scrollable horizontal rail using fixed-size cards, hidden scrollbar styling, `overscroll-x-contain`, `aria-pressed`, and existing account avatars.
- Post-fix evidence: implementation screenshot and measured rail geometry confirm horizontal scrolling without page overflow.
- Follow-up state: the setup drawer contained an inline Amount NPR 0 trigger, a header Enter amount control, and a separate inline Add funds button.
- Follow-up fix: removed those duplicate controls and moved the goal contribution flow into the shared MoneyEditor drawer, with account/details in topContent and Add funds as the bottom keypad confirmation.
- Follow-up evidence: the final screenshot shows one direct Add funds drawer with Note (optional), the keypad, and the bottom Add funds action.
- Home alert follow-up: replaced its separate Allocate drawer and nested Enter amount flow with the same shared money drawer pattern used by the goal detail page.

## Implementation checklist

- [x] Horizontal account rail in the goal action drawer.
- [x] Account avatars, balances, and selected state retained.
- [x] Keyboard/assistive state retained with `aria-pressed`.
- [x] No page-level horizontal overflow at 393px.
- [x] Note field retained beneath the account rail.
- [x] Direct amount drawer opens with the goal details and account rail.
- [x] Add funds CTA appears below the keypad and enables after a valid amount.
- [x] Home Allocate opens the same drawer pattern as goal detail Add funds.
- [x] Typecheck, lint, diff check, and production build pass.

## Follow-up polish

- P3: A small “Swipe to see more” hint could be added if future testing shows the overflow affordance is not discoverable enough.

final result: passed

---

# Design QA: Shared frosted page headers

## Comparison target

- Source visual truth: browser annotation screenshot supplied in the current request for the Emergency fund detail header at 403 x 833 CSS px.
- Implementation screenshots: `/Users/aaarun/Documents/code/Luna/.codex-audit/header-glass-goal.jpg` and `/Users/aaarun/Documents/code/Luna/.codex-audit/header-glass-analytics.jpg`.
- Implementation capture: 1280 x 720 pixels at density 1.
- State: authenticated goal detail and expense analytics pages at the top of the route.
- Normalization: the supplied source is a narrow mobile crop while the available implementation capture is desktop-width. Comparison therefore focuses on the app-owned header surface, hierarchy, controls, tokens, and responsive component behavior rather than identical full-page geometry.

## Evidence

- The goal reference and implementation retain the same back button, title/subtitle hierarchy, right edit action, and underlying hero tint.
- The shared header now uses a translucent background, stronger backdrop blur, increased backdrop saturation, a restrained translucent divider, and a light scroll-state shadow.
- Detail pages no longer override the shared surface with `bg-transparent`.
- Expense analytics, feature guides, and the category icon picker now use `StickyPageHeader` instead of independent sticky-header styling.
- Runtime smoke checks passed for goal detail, Profile, Expenses analytics, Transactions, Accounts, and the category editor with no browser console errors.

## Required fidelity surfaces

- Fonts and typography: existing Geist hierarchy, weights, truncation, title size, and subtitle size are unchanged.
- Spacing and layout rhythm: existing safe-area padding, 44px controls, gutters, and title/action alignment are preserved by the shared component.
- Colors and visual tokens: `background`, `border`, `card`, and semantic action tokens remain authoritative; translucency uses token colors rather than a new palette.
- Image quality and asset fidelity: no image assets were added or replaced; the reference uses existing Lucide controls and app surfaces.
- Copy and content: all route-specific titles, subtitles, labels, and actions are preserved.

## Findings

No actionable P0, P1, or P2 differences remain for the requested shared frosted-header treatment.

## Comparison history

- Initial state: the shared header used a nearly opaque `bg-background/95`; three detail pages forced `bg-transparent`; analytics, feature guides, and the category icon picker duplicated their own header styles.
- Fix: centralized the frosted surface and scroll treatment in `StickyPageHeader`, removed transparent overrides, and migrated the remaining repeated primary sticky headers.
- Post-fix evidence: goal and analytics captures show consistent title/action hierarchy and the representative route sweep completed without runtime errors.

## Implementation checklist

- [x] Shared frosted background and backdrop treatment.
- [x] Scroll-aware divider, opacity, and subtle elevation.
- [x] Detail-page transparent overrides removed.
- [x] Analytics, guide, and category-picker headers migrated.
- [x] Existing home header remains intentionally non-sticky.
- [x] Typecheck, lint, and diff checks pass.

## Follow-up polish

- P3: Browser rendering strength for `backdrop-filter` varies slightly by platform; the opaque fallback remains readable and consistent.

final result: passed
