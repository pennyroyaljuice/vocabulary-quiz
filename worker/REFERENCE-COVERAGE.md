# Reference coverage, 2026-10-02

Release: `2026-10-02-reference-draft-v9`.

Japanese dictionary definitions remain the preferred source. The parser now accepts linked/comma-separated readings and explicit kana cross-references. Alternate readings of one definition do not trigger the different-senses ambiguity error. Different readings with different definitions still require a hint or context.

When the direct lookup has no candidates, the existing dictionary Worker supplies Japanese readings through a service binding. Repeated-character spellings are searched too. A reading entry is accepted only when its Japanese headword identifies the original spelling. Searches are bounded to three alternatives and three direct cross-references. If no Japanese definition is found, the first bilingual gloss matching the exact word and selected reading supports the draft. Other glosses are excluded to prevent merging different senses; the hint does not establish Japanese dictionary verification.

If no suitable Japanese definition is available but the reading index confirms the exact word and reading, the existing Llama model translates a short definition from the hint and reviews it in a second call. The application retains the dictionary reading instead of asking the model to regenerate it. Without reading evidence, no draft is generated. Drafts return `referenceCheck: ai_unverified`, no invented sources, and a persistent “AI仮案・辞書未確認” label in the pending list and editor. They require the existing user confirmation to become vocabulary entries. Model review is not independent dictionary verification. Unknown/rejected/malformed drafts fail. Verified religious entries and ambiguous readings retain their existing safeguards.

Validation: existing regression tests plus `reference-coverage.test.mjs`, auto-generation browser test (including label persistence after reload), and live generation after deployment.
