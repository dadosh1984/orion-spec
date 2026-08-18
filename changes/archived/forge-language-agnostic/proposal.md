# Proposal — forge-language-agnostic

## Goal
Make forge (RED-GREEN-REFACTOR) language-agnostic: abstract `ForgeConfig`, auto-detect project type by markers (build.gradle → Gradle/Java, package.json → TS/Node.js), implement GradleAdapter (JUnit 5 template, `./gradlew test` command, output parsing), refactor tddCore.refactor() to use config, support `.java` snippets, add tests, document Java config. Don't break existing TS projects.

## Context

| Aspect | Value |
|--------|-------|
| Platform | Don't break existing TS projects, all current tests must pass unchanged, no new runtime deps (Gradle/JUnit called via spawnSync). Auto-detect optional — no markers = TS fallback. |
| Budget | compact |
| Constraints | compact |
