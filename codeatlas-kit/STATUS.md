# STATUS.md — the shared log

This is how the six agents talk to each other. **Append, never delete.**
Newest entry at the bottom. Every session ends with a new entry here before
the agent stops.

Format:

```
### [Agent <n> - <role>] <date> <time>
Did: <what you built/changed>
Exposed: <new/changed endpoint, event, or contract — link to CONTRACTS.md section>
Blocked on: <what you need from another agent, or "nothing">
Next: <what you'll do next session>
```

---

### [Human] project kickoff
Kit generated. Six agents about to start on their own branches. CONTRACTS.md
v0.1 is the starting shape — expect it to evolve as Agent 1 and Agent 2 build
the real models.

<!-- New entries go below this line -->
