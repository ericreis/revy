# revy

> An agentic PR review tool, built as a local AXI.

`revy` is a command-line tool that spins up a **local browser review surface** for a GitHub pull
request and turns the coding agent that launched it into a live review partner. It recommends where
to start, lets you ask questions anchored to selected code in persistent threads, and syncs your
review comments back to **GitHub's native PR UI**.

The interaction model is inspired by [lavish-axi](https://github.com/kunchenguid/lavish-axi): a CLI
starts a detached local server, opens a browser UI, and mediates a human ↔ agent conversation through
a long-poll loop. `revy` applies that pattern to PR review.

> **Status: early development.** The design is settled (see the milestones below); the M1 vertical
> slice - launch, add a line comment, `revy submit` to sync it to GitHub - is built. `revy poll`,
> `reply`, `order`, `end`, and `stop` below describe the intended workflow and aren't implemented yet.

## Why

Reviewing PRs, three things are missing from existing tools:

1. **Comments that sync to GitHub's native UI** - review locally, but land the comments where the team sees them.
2. **AI-recommended review order** - the agent suggests where to start instead of top-to-bottom.
3. **Select code → ask the agent → persistent threads** - ask questions anchored to specific lines, with the conversation kept in-tool.

`revy` combines all three in one local, model/agent-agnostic tool (Claude Code first).

## How it works

- The agent runs `revy <pr>`; revy fetches the PR via the `gh` CLI and opens a browser diff view.
- You review in the browser: click (or shift-click to select a range of) gutter lines and **add a
  review comment** (draft). Relaunching `revy <pr>` re-syncs synced/resolved threads from GitHub.
- On `revy submit`, your draft comments post to GitHub as **one batched pending review**.
- Planned: select code to **ask the agent** (a live thread), with the agent long-polling
  (`revy poll`), answering in anchored threads, and ranking the files for you. Agent Q&A threads
  will stay local by default and never auto-post; you'll be able to convert a takeaway into a
  review comment.

## Usage (intended)

```sh
# Open a PR for review (fetches the diff, starts the local server, opens the browser)
revy owner/repo#1234
# ...or by URL
revy https://github.com/owner/repo/pull/1234

# Post your draft review comments to GitHub as one batched pending review
# <session-key> is the id shown in the review URL (http://127.0.0.1:<port>/session/<session-key>)
revy submit <session-key>

# Not yet implemented - the agent side of the loop
revy poll                       # long-poll for the reviewer's questions/comments
revy reply --thread <id> "..."  # answer a thread
revy order review-order.json    # push an AI-recommended review order to the UI

# Not yet implemented - session control
revy end        # end the review session
revy stop       # shut down the local server
```

Sessions are stored one file per PR under `~/.revy/sessions/`, so you can relaunch `revy <pr>` later
and pick up where you left off (author replies and resolved threads are re-synced from GitHub).

## Requirements

- Node.js ≥ 22
- The [`gh`](https://cli.github.com/) CLI, authenticated (`gh auth login`) - revy uses your existing GitHub auth.

## Roadmap

Tracked as GitHub milestones:

- **M1 · Vertical slice** - launch → render diff → add a line comment → sync to GitHub.
- **M2 · Threads + chat** - range selection, anchored threads, the poll/reply loop, live updates.
- **M3 · Review order** - AI-recommended review order.
- **M4 · Agent-agnostic polish** - pluggable agent adapter, resolve/unresolve, rate-limit handling, docs.

## Testing

Testing is a first-class citizen, with **end-to-end tests as the primary focus** - they drive the
real stack the way a user does, so they cover the whole flow rather than isolated pieces.

```sh
npm test              # unit + e2e
npm run test:unit     # Vitest: pure logic + the express app + the gh integration
npm run test:e2e      # Playwright: the full launch → render → interact flow
npm run test:watch    # Vitest in watch mode
```

- **E2E (`e2e/`, Playwright):** runs the built `revy` CLI exactly as a user would
  (`revy <pr> --no-open`), which spawns the detached loopback server, then drives a real Chromium
  browser against the rendered review - asserting the header, file tree, diff bodies,
  auto-collapse, collapse/expand, tree navigation, server reuse on relaunch, error states, gutter
  line selection, and adding a draft review comment (composer → thread widget).
- **Hermetic, no network:** a fake `gh` (`tests/helpers/`) backed by fixtures in `tests/fixtures/pr/`
  is put on `PATH`, and each run uses an isolated `REVY_STATE_DIR`, so tests never hit GitHub. The
  fake also answers the `gh api graphql` review-threads query and the `gh api` review-submission
  calls so the comment/sync flow stays hermetic.
- **Unit (`tests/unit/`, Vitest):** PR-arg parsing, the session store + key stability, thread id
  assignment, diff parsing and large/generated-file detection, the express routes, and `gh` error
  translation.

The first time you run the E2E tests locally, install the browser once:

```sh
npx playwright install chromium
```

CI (`.github/workflows/ci.yml`) runs typecheck, unit, and e2e on every push and PR.

## Tech

TypeScript (Node, ESM) · express · React + Vite · [`react-diff-view`](https://github.com/otakustay/react-diff-view) · the `gh` CLI for GitHub sync.
