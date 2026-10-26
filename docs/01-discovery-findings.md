# 01 · Discovery Findings (what is on the accountant's PC)

> Read-only survey done on 2026-10-26 on the accountant's machine (`DESKTOP-K6UOMQ6`).
> Client names, GSTINs and amounts are deliberately **not** recorded here.

## 1. Machine

| Item | Value | Why it matters |
|---|---|---|
| CPU / RAM | Intel i3-7020U / 7.9 GB | Low-end. Our tool must be **light**. Several Electron connectors already run alongside Tally and Chrome. |
| OS | Windows 10 Pro | Windows-only desktop target is fine. |
| Disk | ~1.1 TB across C: D: E: F: G: | Plenty of space. |

## 2. Tally setup

| Install | Version | Path | Notes |
|---|---|---|---|
| Main | TallyPrime **7.1** (Silver, 1 user) | `C:\Program Files\TallyPrime (1)` | Used daily. TSS valid till 31-Oct-26. |
| Old | TallyPrime 7.0 | `C:\Program Files\TallyPrime` | Unused since Jul-2026. |
| Old | TallyPrime 6.2 | `E:\TallyPrime6.0` | Contains older company folders and the Eazy Auto Vch TCP. |

Key `tally.ini` settings (7.1):

- `Data=D:\TallyPrime6.0\Data`. The About screen shows this as **"Not Accessible"**, which needs checking (see the health issues below).
- `TDL=E:\TallyPrime6.0\Eazy Auto Vch_Abhi (5).tcp`: one third-party TDL is loaded. It dates from 2023 and loads into 7.1 from the 6.0 folder.
- `Client Server=Both`, `ServerPort=9002`, `Enable ODBC Server=Yes`.
- Gateway server on `:10007`, Tally Scheduler on `:10090`.
- The XML/HTTP server (default **port 9000**) is in use. Large `tallyhttp.log` files show that the connectors talk to Tally constantly.

The accountant handles **6 or more client companies**, all GST-registered traders in Maharashtra, with yearly company splits (for example `... - 2025-2026`). Companies use **custom voucher types** such as "RSPL CASH SALE", so we can't hard-code "Sales" or "Purchase".

## 3. Third-party tools already installed

| Tool | Type | What it does | How it talks to Tally |
|---|---|---|---|
| **Eazy Auto Vch (Abhi)** | TDL add-on (`.tcp`) | Excel → voucher import, inside Tally's own menus | Runs *inside* Tally, so no network is involved |
| **VouchrIt Tally Connector v2.0** | Desktop connector + cloud web app | Bank statements and invoices → vouchers | Local `.exe` → HTTP XML → `localhost:9000` |
| **TrulyInvoice Connector 5.0.1** | Electron app + cloud | Invoice scanning (OCR) → purchase/sales vouchers | HTTP XML `Import Data` → `localhost:9000` (46 imports seen in its log) |
| **Livekeeping Data Connector 3.2.1** | .NET tray app + cloud | Mirrors Tally data to a mobile app (reports) | HTTP XML `Export` with inline TDL ("My Trial Balance", "My Ledger Outstandings", ...) |
| **TallyIra** (Tally's own AI) | `tallyagent.exe`, ships with 7.x | Chat AI (`convai`) + document AI (`docai`) | Built into TallyPrime 7.1 (`tallyai.log`) |

Leftover import files were also found: `Sales_25-26-RSPL-22/23/24.xml` and `Tally.xml` in the Tally folder. These are full Tally **Import Data** envelopes (item-invoice sales vouchers). They are the best real-world reference for our XML format; see [07-tally-xml-reference.md](07-tally-xml-reference.md).

## 4. Health issues found (quick wins to tell the accountant)

1. **"Data path Not Accessible"** on the About screen. The configured `D:\TallyPrime6.0\Data` may be wrong or missing permissions. Verify where the companies actually load from.
2. **Huge HTTP logs:** `tallyhttp.log` is about 185 MB (7.1) and about 170 MB (6.2). HTTP logging is switched on and grows with every connector poll. Turn it off (F1 › Settings › Connectivity) or rotate it.
3. **TallyIra agent fails to start:** socket error `10055` (no buffer space) in `tallyai.log`. This is a symptom of too many local connections, likely several connectors polling Tally at once.
4. **Three Tally installs:** 7.0 and 6.2 can likely be removed once the data location is confirmed.
5. **Old TDL loaded into a new release:** Eazy Auto Vch dates from 2023, so check its compatibility with 7.1.

## 5. What this tells us about the product

- He already pays for or juggles **4 tools** for one job: getting data *into* Tally. Our main value is **one place, one workflow**.
- Every tool, cloud or not, ends up at the same door: **Tally's XML server on localhost:9000**. That is our integration point too (see [02](02-how-data-reaches-tally.md)).
- He works across many companies, so a **company switcher plus per-company memory** (ledger mappings, Excel templates) is essential.
- The PC is weak, so we need a native-light app (Tauri), not another heavy Electron app.
