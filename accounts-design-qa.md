# Accounts page design QA

## Evidence

- Reference: `/Users/aaarun/Downloads/67hirASh.jpg`
- Original implementation: `/Users/aaarun/Documents/code/cocomelon/frontend/accounts-implementation.png`
- Latest implementation: `/Users/aaarun/Documents/code/cocomelon/frontend/accounts-color-implementation.png`
- Original reference comparison: `/Users/aaarun/Documents/code/cocomelon/frontend/accounts-comparison.png`
- Color and image comparison: `/Users/aaarun/Documents/code/cocomelon/frontend/accounts-color-comparison.png`
- Tested viewport: 390 × 844 px
- Tested state: default accounts list at `/accounts`

## Comparison

- Preserved the reference hierarchy: page title, balance summary, and an account list with balance plus monthly income and expense.
- Adapted the dark, oversized reference cards to the app's established light visual system.
- Reduced each account card to roughly 130 px high so multiple accounts remain visible on a mobile screen.
- Kept income and expense figures legible with clear positive and negative color treatment.
- Added the requested “Add new account” card as the final list item.
- Assigned each account a restrained light-theme preset: sage, sky, lavender, or sand.
- Added a deterministic custom DiceBear image for every account and kept it in a consistent 44 px rounded-square frame.
- Preserved green and red exclusively for income and expense meaning; card backgrounds remain decorative and low contrast.

## Interaction and layout checks

- Back control has a 44 × 44 px mobile touch target.
- Header utility control uses the same bordered button treatment as the rest of the application.
- Account rows and the add-account card provide full-width touch targets.
- Page width matches the 390 px viewport with no horizontal overflow.
- Vertical scrolling is expected for the complete account list.
- Custom images have empty alternative text because the adjacent account name carries the same identity.

## Findings

- No P0, P1, or P2 visual issues found.
- Intentional differences from the reference: light preset palette, smaller cards, custom account imagery, and removal of bottom navigation for consistency with the current application scope.

Final result: passed
