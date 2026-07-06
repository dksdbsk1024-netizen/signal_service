---
name: danggi-maemae-signal-dashboard-design
description: Use this skill to generate well-branded interfaces and assets for the 단기매매 신호 대시보드 (Korean day-trading buy/sell signal dashboard), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, components, and a UI kit for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Fixed rules this brand always enforces: buy/up = red (`--signal-buy`), sell/down = blue (`--signal-sell`), neutral = gray — this is the Korean market convention, opposite of Western red/green. Dark mode is the primary theme (long trading sessions); light tokens exist too. Numeric readability is the top priority — always use `.ds-numeric` / tabular-nums for prices, scores, and percentages. Avoid decoration; this is a professional trading terminal, not a consumer app.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without other guidance, ask what they want to build, ask a few questions, and act as an expert designer who outputs HTML artifacts or production code depending on the need.
