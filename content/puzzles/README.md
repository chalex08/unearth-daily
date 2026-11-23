# Daily puzzles

One JSON file per daily puzzle, written offline with the `/write-puzzle` Claude Code skill.

Every puzzle is a funnel (SPEC §2): **500 or more** answers at layer 1 down to **5 to 10** at layer 10, with each layer keeping 35% to 85% of the one above. `npm run validate:puzzles` and a test over every file here enforce it.

Drafts go in `drafts/` and are not validated or bundled until moved here by `npm run review`. The skill writes them from a compact depth list (`drafts/<date>.ladder.txt`) that `npm run puzzle:build -- <date>` expands. See [docs/CONTENT.md](../../docs/CONTENT.md).
