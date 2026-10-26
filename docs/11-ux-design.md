# 11 · UX Design: "everything in one place, easy for an accountant"

## Design rules
1. **One flow everywhere:** `Upload → Map → Review → Push → Done`. Learn it once and it works for every module.
2. **Keyboard first, like Tally.** Enter moves to the next field, Esc goes back, Alt+letters jump between modules, Ctrl+Enter pushes. The mouse is optional.
3. **Never surprise.** Nothing reaches Tally without the review screen, and every push can be undone.
4. **Traffic lights:** 🟢 ready · 🟡 needs a look (low confidence / new ledger) · 🔴 must fix. A filter shows only 🟡🔴.
5. **Plain language.** "Ledger *ABC Tradrs* not found. Did you mean *ABC Traders*?" instead of raw Tally errors.
6. **Remembers everything per company:** column templates, ledger choices, last-used voucher types.
7. **Indian formats:** `DD-MM-YYYY`, ₹ with lakh/crore grouping (`1,23,456.00`), FY labels like `2025-26`.

## Main layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tally Helper   [Company: Client A – 2025-26 ▼]    ● Tally connected (7.1)  ⚙ │
├──────────────┬───────────────────────────────────────────────────────────────┤
│ 🏠 Home      │  Bank Statement › SBI CC A/c                                    │
│ 🧾 Sales     │  ① Upload ─ ② Map ─ ③ Review ─ ④ Push ─ ⑤ Done                  │
│ 📥 Purchase  │ ┌───────────────────────────────────────────────────────────┐  │
│ 🏦 Bank      │ │ Filter: [All ▼] 🟢 212  🟡 31  🔴 4    Search…   Bulk: [Set ▼]│  │
│ 🔁 Cr/Dr Note│ ├────┬──────────┬──────────────────────┬──────┬────────┬─────┤  │
│ 📒 Journal   │ │ ✓  │ 05-04-25 │ UPI/ABC TRADERS/...  │ Rcpt │ABC Trad│ 🟢  │  │
│ 📚 Masters   │ │ ✓  │ 06-04-25 │ BANK CHARGES QTR     │ Pymt │Bank Chg│ 🟢  │  │
│ 🕘 History   │ │ ☐  │ 07-04-25 │ NEFT-UNKNOWN PARTY   │ Pymt │Suspense│ 🟡  │  │
│              │ └────┴──────────┴──────────────────────┴──────┴────────┴─────┘  │
│              │  ₹ Dr 4,52,300.00  Cr 6,10,900.00     [Back]  [Push 247 ▶]      │
└──────────────┴───────────────────────────────────────────────────────────────┘
```

## Home screen
- Tally status card (connected? which company is open? port).
- Per-client cards: last import date, pending drafts, "Bank last done till 31-Mar".
- Quick actions: "Import bank statement", "Import sales Excel".
- Health warnings found automatically (e.g. HTTP log size, data path not accessible; see [01](01-discovery-findings.md)).

## Key components
| Component | Behaviour |
|---|---|
| **CompanySwitcher** | Lists the companies open in Tally. Switching refreshes the masters cache. |
| **ColumnMapper** | Shows the first 10 rows of the file. A dropdown above each column offers auto-guesses, plus "Save as template". |
| **ReviewGrid** | Virtualised, inline editable, keyboard nav, row expand for ledger lines, totals footer. |
| **LedgerPicker** | Type-ahead over cached ledgers, ranked by fuzzy score + learned frequency, with "+ Create ledger…". |
| **PushDialog** | Summary (count, totals, voucher types), confirm, progress, pause. |
| **ResultPanel** | Created/failed counts, error list linked to rows, "Retry failed", "Undo batch". |

## Onboarding (first run)
1. Detect Tally automatically (try :9000). If that fails, show the 3-click guide to enable it (F1 › Settings › Connectivity).
2. Pick the companies to manage.
3. Sync masters, with a progress bar.
4. Offer a 2-minute demo using the built-in sample file on a demo company.

## Accessibility & language
- Minimum 14px text, high contrast, and a Bright/Comfort theme that matches Tally's ComfortView.
- i18n-ready strings (English first, then Marathi/Hindi).
