# Final browser evidence — 22 July 2026

Reference surface: exact assembled `build/web`, served unchanged with COOP/COEP headers by `browser-qa-server.mjs`. The server mocked only authenticated `GET /api/account/session` as `qa-pair`; it did not call or mutate Supabase, cloud progress, or production.

## 1366×768 full replay

1. `final-01-launch-1366x768.png` — fresh lobby and immediate pair start.
2. `final-02-level-1-1366x768.png` — Level 1 names one next action.
3. `final-03-studio-roles-1366x768.png` — two-row Now/Partner role strip after handoff.
4. `final-04-level-1-done-1366x768.png` — both visible pair actions complete.
5. `final-05-level-2-1366x768.png` — Level 2 starts with Attention.
6. `final-06-aida-done-1366x768.png` — Action states AIDA is complete and directs return.
7. `final-07-level-3-1366x768.png` — Level 3 starts with price.
8. `final-08-price-done-1366x768.png` — visible protected $8.50 price on the ad.
9. `final-09-route-start-1366x768.png` — only Product strengths is initially revealed.
10. `final-10-route-done-1366x768.png` — submitted route report and return instruction.
11. `final-11-level-3-ready-1366x768.png` — Level 3 explicitly opens the final check.
12. `final-12-final-check-ready-1366x768.png` — locked Level 3 exposes only Final check.
13. `final-13-market-gate-1366x768.png` — market-card gate.
14. `final-14-published-1366x768.png` — accepted market card and open practice market.
15. `final-15-market-cards-1366x768.png` — two distinct sellers available to back.
16. `final-16-complete-1366x768.png` — terminal practice-round completion condition.

## 1440×900 spot check

17. `final-17-launch-1440x900.png` — fresh 16:10 lobby.
18. `final-18-level-1-1440x900.png` — centered Level 1 run state.
19. `final-19-studio-1440x900.png` — Studio fit and full two-row role strip.

## Instrument findings

- Current console warnings/errors across both final tabs: 0.
- 1440×900 DOM: document 1440×900 with matching scroll dimensions; no clipped visible button, input, select, or tab.
- 1366×768 Studio DOM: document 1366×768 with matching scroll dimensions; role card 56 px client/scroll height. A below-fold Build control belongs to the visible, intentionally scrollable drawer.
- The OpenRouter panel received identical text/DOM evidence only. These screenshots were captured after that single paid pass and were not supplied to any panel seat.
