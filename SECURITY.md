# Security notes

## Dependency risk register

### Transitive `nanoid` advisories

The previous dependency audit reported three high-severity advisories for the
transitive `nanoid` package. Luna does not import `nanoid` directly; the
current dependency graph reaches it through the Next.js/PostCSS toolchain.

This remains an upstream watch item until Next.js/PostCSS publish a compatible
dependency graph that removes the advisories. Do not add a direct `nanoid`
override without verifying that it remains compatible with both toolchains.

Recheck the item with:

```bash
npm ls nanoid --all
npm audit --omit=dev --audit-level=high
```

The CI quality workflow runs the audit on every push and pull request. Close
this entry only after the audit is clean in CI and the resolved dependency
tree no longer routes through the affected package version.
