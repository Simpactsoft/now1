# Backlog — Future Tasks & Investigations

## CPQ / Configurator

### 🔍 Investigate: Configuration Lineage (Source → Child Inheritance)
**Priority**: Low | **Type**: Research  
**Added**: 2026-02-17

**Context**: When cloning a saved configuration template into a new configuration, we currently store `source_configuration_id` as a reference. The question is whether to invest in **deeper inheritance** capabilities.

**What to investigate**:
- [ ] Is there real user demand for "re-sync from template" (apply template updates to existing configs)?
- [ ] Should we show a "lineage tree" in the UI (template → all derived configurations)?
- [ ] Do we need version tracking on configuration templates (`source_template_version`)?
- [ ] Should child configurations get a notification/badge when their source template was updated?

**Use cases that justify the investment**:
1. **Bulk price updates** — template price changes, propagate to all draft configurations
2. **Compliance/Audit** — "show me all quotes derived from this configuration"
3. **Re-quoting** — customer returns after 6 months, salesperson loads original config + applies latest pricing
4. **A/B comparison** — "what changed between original template and this custom config?"

**Use cases where it's NOT worth it**:
1. Low volume of configurations per template
2. Configurations are always one-off (no re-use pattern)
3. Users don't revisit old configurations

**Current state**: `sourceConfigurationId` field exists and is populated by `cloneConfiguration()`. This is sufficient for basic traceability. Deeper inheritance should wait for real user feedback.
