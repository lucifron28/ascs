# PlantUML Diagram Assets

ASCS architecture diagrams are maintained as self-contained PlantUML source
files and rendered into both SVG and PNG. PlantUML is used instead of Mermaid
so the assets can be regenerated for manuscript and presentation work.

## Layout

```text
docs/diagrams/src/   editable .puml sources
docs/diagrams/svg/   preferred manuscript/presentation output
docs/diagrams/png/   preview output for Codex and common office tools
```

Required diagrams:

1. `01-system-context.puml` - conceptual actors and external services.
2. `02-container-architecture.puml` - browser, Next.js, Server Actions, SDKs,
   and Rules boundary.
3. `03-vercel-firebase-deployment.puml` - fictional-data demo deployment.
4. `04-role-rbac.puml` - nine roles grouped by responsibility.
5. `05-clearance-workflow.puml` - five-step status derivation and Dean approval.
6. `06-auth-session-sequence.puml` - sign-in, session, authorization, and
   invalidation flow.
7. `07-firestore-data-model.puml` - logical document relationships.
8. `08-reporting-data-flow.puml` - Admin/Dean scope and CSV flow.

## Regeneration

From the repository root:

```bash
npm run docs:diagrams
```

The script checks for an installed `plantuml` executable first, then
`PLANTUML_JAR`, then `tools/.cache/plantuml.jar`. The JAR is a local tool cache
and is ignored by Git; it is never downloaded during unit tests. The script
performs syntax validation before writing SVG and PNG output, fails when a
source cannot be rendered, and verifies that every required output exists.

The SVG files are the recommended architecture-slide assets. PNG files are
provided for quick preview and tools that do not embed SVG.
