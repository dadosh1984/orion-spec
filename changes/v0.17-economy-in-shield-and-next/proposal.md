# Proposal — v0.17-economy-in-shield-and-next

**Goal:** Make the token economy genuinely useful in the daily loop: (A) a new 'economy' step in shield — a read-only budget check that reads the token-economy cache stats (size vs maxSize from orionTrack config, default 100MB) and reports WARN when the cache exceeds 60% of its budget, with an honest detail line (cache 78 MB of 100 MB, N entries — consider orion track prune) plus the economy ledger savings (≈ N tok saved across M compress ops); WARN never breaks allPass, exactly like the yagni signal; the economy step must NOT be cache-cached because cache size is live state, so it always runs fresh. (B) orion next appends an honest token-economy footer to its summary: ≈ N tok saved across M compress op(s) (from economyStats), or an honest 'no compress ops recorded yet' when the ledger is empty. (C) live MCP proof: a raw JSON-RPC handshake against orion mcp (initialize -> tools/list -> metrics call) to prove any external agent can connect, plus docs on wiring an agent to orion mcp. Zero new CLI commands, zero new dependencies.

- Platform: any
- Constraints: none
- Budget: unlimited
- **Lessons applied (v0.12):** v0.14-lessons-in-result-and-compress-rules:out:5de90ec114d9, v0.14-lessons-in-result-and-compress-rules:shield:a4e1424604aa, orion-spec:session:34adfd1f5b25, orion-spec:session:4d99052ba17f, orion-spec:session:675e310bd560
