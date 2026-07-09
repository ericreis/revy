I want to build an agentic PR review tool that better leverages AI to help me review PRs quickly and better. Here are a few things that I would like for it to do:

- I would prefer that it would be model/agent agnostic, but my primary use would be with claude code, so we could start with it and then extend. everything we do should account for being agnostic in the future.
- For now I want to review mainly PRs that are on GitHub
- I want to be able to add review comments on this tool and it sends the comment to GitHub so that its shown in their default UI
- I want it to keep the code diff principles that we have on github
- I want to be able to spin it through a skill that runs a local server with this tool that connects with the agent or its subagents for review conversations. I dont want to have an external web application for it, I want to have it working locally for now. We can think about extending it further later.

Here are some of the pains that I feel riht now when reviewing, and how I think we could solve.improve:

- Where should I start? Right now its kinda like Ill review in the order its shown in github ui, or if I already have a good knowledge of the feature / code base I can go with my own order. I would prefer if the order that the changes are shown would be better recommended by an agent.
- I need to fetch code context from the PR and give it to an agent to ask questions or clarify stuff. The same way we can add review comments to line(s)/files I wish I could select pieces of code and ask questions directly to the agent and then have a conversation thread of each of them directly in the tool UI

For now, thats the main things Id like for it to do. We can iterate on these further. Any other feature can be added later.
