# 03 · Existing tools vs. TallyPrime built-ins vs. what we build

## 3.1 What each existing tool covers

| Capability | Eazy Auto Vch | VouchrIt | TrulyInvoice | Livekeeping | TallyPrime 7.1 built-in |
|---|---|---|---|---|---|
| Excel → Sales/Purchase | ✅ | ✅ | ⚠️ | ❌ | ✅ (Import from Excel, since Prime 5.x) |
| Bank statement → vouchers | ⚠️ Excel only | ✅ PDF/Excel | ❌ | ❌ | ⚠️ Bank-reco import; voucher creation is limited* |
| Invoice PDF/photo OCR | ❌ | ✅ | ✅ | ❌ | ⚠️ TallyIra "docai" (new)* |
| Credit/Debit notes | ✅ | ✅ | ⚠️ | ❌ | ✅ via Excel import |
| Auto ledger suggestion / learning | ❌ | ✅ | ✅ | ❌ | ❌ |
| GSTR-2B vs books matching | ❌ | ⚠️ | ❌ | ❌ | ✅ connected GST (reconciliation) |
| Mobile reports | ❌ | ❌ | ❌ | ✅ | ⚠️ TallyPrime mobile / browser access |
| Works offline / data stays local | ✅ | ❌ cloud | ❌ cloud | ❌ cloud | ✅ |
| Cost | One-time | Subscription | Subscription | Subscription | Included with TSS |

✅ good · ⚠️ partial · ❌ none · \* = verify hands-on with 7.1 during Phase 0. Tally's release notes change quickly.

## 3.2 Pain points we heard and observed

1. **Too many tools.** Four separate apps for one goal, each with its own login, layout and bill.
2. **Data leaves the office.** The cloud tools upload clients' bank statements and invoices.
3. **Repeated mapping.** He picks the same ledger for the same narration every month (for example "NEFT-XYZ TRADERS" → Sundry Creditor *XYZ Traders*).
4. **Many companies.** He switches clients constantly, and the tools don't remember per-company settings well.
5. **Slow PC.** Several heavy background connectors already run.

## 3.3 Our positioning

> **One local desktop app** that takes *any* source (Excel, CSV, bank PDF, invoice, GSTR-2B), turns it into
> **reviewed, balanced Tally vouchers**, learns his ledger choices **per company**, and pushes to Tally safely.

**What we do not rebuild:**
- Mobile reporting (Livekeeping and Tally already do it).
- GST filing (Tally's connected GST already does it).
- A TDL add-on. We stay an external app so we can offer a modern UI and are not limited by Tally's UI.

**Our edge:**
- Same 5-step flow for every module (Upload → Map → Review → Push → Result).
- A learning rules engine kept per company, stored locally.
- AI extraction is **optional** and opt-in per document.
- Light enough for an i3 with 8 GB RAM.
