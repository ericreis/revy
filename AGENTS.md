# Agent instructions for revy

## Linking branches and PRs to GitHub issues

When work is tied to a GitHub issue (e.g. "fix issue #6"), link the branch and PR to
it using GitHub's native mechanisms instead of hand-naming the branch or hoping a PR
description happens to mention the issue.

- **Branch**: create it with `gh issue develop <N> --checkout` (add
  `--name "<N>-slug"` for a custom name). This registers the branch as linked to the
  issue in GitHub's "Development" sidebar immediately, before any PR exists.
- **PR**: once a PR is open, make sure its body contains a closing keyword so GitHub
  auto-links it under the issue's Development section and auto-closes the issue on
  merge:
  ```sh
  gh pr edit <PR#> --body "$(gh pr view <PR#> --json body -q .body)

  Closes #<N>"
  ```
  If you're driving `no-mistakes`, add this after its PR step opens the PR - the tool
  has no config for branch naming or PR body templates, so this step has to be done
  by hand each time.
- **PR title**: prefix it with a leading `[#N]` tag, ahead of the existing
  `type(scope): description` convention, so the issue number is the first thing
  visible in a PR list:
  ```
  [#6] feat(web): add split (side-by-side) diff view toggle
  ```
  If you're driving `no-mistakes`, it writes the `type(scope): description` part
  itself - after it opens the PR, prepend the tag by hand:
  ```sh
  gh pr edit <PR#> --title "[#<N>] $(gh pr view <PR#> --json title -q .title)"
  ```
