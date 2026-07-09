# revy

> An agentic PR review tool, built as a local AXI.

`revy` is a command-line tool that spins up a **local browser review surface** for a GitHub pull
request and turns the coding agent that launched it into a live review partner. It recommends where
to start, lets you ask questions anchored to selected code in persistent threads, and syncs your
review comments back to **GitHub's native PR UI**.

The interaction model is inspired by [lavish-axi](https://github.com/kunchenguid/lavish-axi): a CLI
starts a detached local server, opens a browser UI, and mediates a human ↔ agent conversation through
a long-poll loop. `revy` applies that pattern to PR review.

> **Status: early development.** The design is settled (see the milestones below); the first
> vertical slice is being built. Commands below describe the intended workflow.

## Why

Reviewing PRs, three things are missing from existing tools:

1. **Comments that sync to GitHub's native UI** - review locally, but land the comments where the team sees them.
2. **AI-recommended review order** - the agent suggests where to start instead of top-to-bottom.
3. **Select code → ask the agent → persistent threads** - ask questions anchored to specific lines, with the conversation kept in-tool.

`revy` combines all three in one local, model/agent-agnostic tool (Claude Code first).

## How it works

- The agent runs `revy <pr>`; revy fetches the PR via the `gh` CLI and opens a browser diff view.
- You review in the browser: select lines to **add a review comment** (draft) or **ask the agent** (a live thread).
- The agent long-polls (`revy poll`), answers your questions in anchored threads, and can rank the files for you.
- On `revy submit`, your draft comments post to GitHub as **one batched pending review**.
- Agent Q&A threads stay local by default and are never auto-posted; you can optionally convert a takeaway into a review comment.

## Usage (intended)

```sh
# Open a PR for review (fetches the diff, starts the local server, opens the browser)
revy owner/repo#1234
# ...or by URL
revy https://github.com/owner/repo/pull/1234

# The agent side of the loop
revy poll                       # long-poll for the reviewer's questions/comments
revy reply --thread <id> "..."  # answer a thread
revy order review-order.json    # push an AI-recommended review order to the UI

# Post your review to GitHub as one batched pending review
revy submit

# Session control
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

## Tech

TypeScript (Node, ESM) · express · React + Vite · [`react-diff-view`](https://github.com/otakustay/react-diff-view) · the `gh` CLI for GitHub sync.
