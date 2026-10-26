# 13 · Security & Data Privacy

Client books contain GSTINs, bank details and turnover figures. Treat them as confidential.

## Rules for the product
1. **Localhost only.** The Tauri HTTP allow-list permits `http://localhost:*` / `127.0.0.1:*`, plus the Claude API domain **only** when AI is enabled. Nothing else.
2. **No telemetry by default.** Crash logs stay on disk, and the user can choose to send them.
3. **AI opt-in per company and per document.** Show exactly what will be sent. Never send whole Tally exports.
4. **Secrets:** the API key is stored in the Windows Credential Manager (Tauri stronghold/keyring), never in SQLite or in plain files.
5. **Least write power:** the app only creates, alters and deletes vouchers/ledgers that **it** created (tracked by REMOTEID). Deleting anything else is blocked.
6. **Backups:** suggest a Tally backup before the first big push of the month. SQLite is backed up before each migration.
7. **Logs:** redact GSTINs and account numbers (keep the last 4 digits) and rotate them.

## Rules for the team (repo hygiene)
- **Never commit real client data.** `fixtures/` contains only anonymised or synthetic files. `.gitignore` blocks `*.xlsx`, `*.pdf` and `*.xml` outside `fixtures/`.
- Don't copy anything from the accountant's PC into the repo (logs, Tally XML, statements) without anonymising it first.
- Third-party tools (VouchrIt, TrulyInvoice, Eazy Auto Vch) are studied **only through public behaviour** (the XML they send to Tally). We don't decompile or copy their code.
- Remote access tools are installed on the PC (UltraViewer). Use them only with the owner's consent.
