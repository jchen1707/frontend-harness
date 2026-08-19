# Test-review checklist — frontend-harness

The stack half of the shared `test-reviewer` frame. The frame carries the classes of bad test;
this is what each one looks like here, and which tier owns what.

## The tiers, and their isolation

- **Beside the code they cover**, inside the feature slice — `ui/Thing.test.tsx`,
  `services/useThing.test.tsx`, `repositories/thing.test.ts`. The default `pnpm test` run.
  **Offline**: MSW intercepts every request, so a test that would reach a real host is broken
  even while it passes.
- `e2e/` — Playwright specs, run by `pnpm test:e2e`, never by Vitest. Real browser, real
  navigation, real layout.

## Stack-specific shapes

- **Testing implementation instead of behaviour.** Asserting on internal state, on a hook's
  return shape, or on class names rather than on what the user can see and do. Testing Library
  exists to make the behavioural assertion the easy one — `getByRole` over
  `container.querySelector`, a test id only where no role exists.
- **Mocked-away subject.** The unit under test replaced by a mock, so the test exercises the
  mock. Mock the network at the MSW layer, not the module you are testing.
- **Missing failure modes.** Loading, error and empty are the states users actually hit. A
  component test covering only the resolved-data path is half a test.
- **Async flakiness.** Missing `findBy*` or `waitFor` where the assertion races the render,
  arbitrary sleeps, or a test that passes only because of ordering.
- **The wrong tier.** A Playwright spec asserting logic a Vitest test could cover is slow,
  flaky coverage in the wrong place — and the reverse, UI behaviour asserted only in jsdom
  when it depends on real layout, navigation or focus across a page load.
