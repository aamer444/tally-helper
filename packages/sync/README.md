# @th/sync

Keeps the local SQLite mirror of Tally fresh: polls cheap company counters (AltMstId/AltVchId), pulls only records with a higher AlterID, upserts by GUID, and runs a periodic GUID-list pass to catch deletions. The UI reads lists only from the mirror.

See [docs/17-sync-and-company-workspace.md](../../docs/17-sync-and-company-workspace.md).
