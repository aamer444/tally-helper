// Dummy TallyPrime XML server for development and tests. No dependencies.
//   node tools/tally-mock/server.mjs            (listens on :9900, or TALLY_MOCK_PORT)
// Reads are answered from samples/*.res.xml. Imports are validated like Tally does
// (company open, ledgers exist, Dr = Cr, date >= books) and kept in memory.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLES = join(dirname(fileURLToPath(import.meta.url)), 'samples');
const PORT = Number(process.env.TALLY_MOCK_PORT || 9900);
const BOOKS_FROM = '20250401';
const sample = (f) => readFileSync(join(SAMPLES, f), 'utf8');
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
const tag = (xml, name) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`, 'i'))?.[1];

const companies = new Set([...sample('02-companies.res.xml').matchAll(/<COMPANY NAME="([^"]+)"/g)].map((m) => unescape(m[1])));
const ledgers = new Set([...sample('03-ledgers.res.xml').matchAll(/<LEDGER NAME="([^"]+)"/g)].map((m) => unescape(m[1])));
const vouchers = new Map(); // remoteId -> { alterId, xml }
let lastVchId = 5020;

const collectionSamples = {
  COMPANY: '02-companies.res.xml', LEDGER: '03-ledgers.res.xml', GROUP: '04-groups.res.xml',
  VOUCHERTYPE: '05-voucher-types.res.xml', STOCKITEM: '06-stock-items.res.xml',
  VOUCHER: '07-vouchers-since-alterid.res.xml', VOUCHERS: '07-vouchers-since-alterid.res.xml', BILLS: '08-pending-bills.res.xml',
};
const reportSamples = { 'DAY BOOK': '09-daybook.res.xml', 'TRIAL BALANCE': '10-trial-balance.res.xml', LISTOFVOUCHERS: '11-tdl-report-list-of-vouchers.res.xml' };

function importResult({ created = 0, altered = 0, deleted = 0, errors = [] }) {
  const lineErrors = errors.map((e) => `\n  <LINEERROR>${e}</LINEERROR>`).join('');
  return `<ENVELOPE>
 <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
 <BODY><DESC></DESC><DATA>${lineErrors}
  <IMPORTRESULT>
   <CREATED>${created}</CREATED><ALTERED>${altered}</ALTERED><DELETED>${deleted}</DELETED>
   <LASTVCHID>${created || altered ? lastVchId : 0}</LASTVCHID><LASTMID>0</LASTMID><COMBINED>0</COMBINED>
   <IGNORED>0</IGNORED><ERRORS>${errors.length}</ERRORS><CANCELLED>0</CANCELLED><EXCEPTIONS>0</EXCEPTIONS>
  </IMPORTRESULT>
 </DATA></BODY>
</ENVELOPE>`;
}

const toPaise = (s) => Math.round(parseFloat(s) * 100);
const formatAmt = (p) => (Math.abs(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function checkVoucher(v) {
  const date = tag(v, 'DATE') || '';
  if (date < BOOKS_FROM) return 'Voucher date is before Books Beginning date';
  // Top-level ledger lines only; bill/bank allocation amounts are nested inside and ignored.
  const lines = [...v.matchAll(/<(?:ALL)?LEDGERENTRIES\.LIST>\s*<LEDGERNAME>([^<]*)<\/LEDGERNAME>[\s\S]*?<AMOUNT>([^<]*)<\/AMOUNT>/g)];
  for (const [, name] of lines) if (!ledgers.has(unescape(name))) return `Ledger '${name}' does not exist!`;
  const dr = lines.map((l) => toPaise(l[2])).filter((p) => p < 0).reduce((a, b) => a + b, 0);
  const cr = lines.map((l) => toPaise(l[2])).filter((p) => p > 0).reduce((a, b) => a + b, 0);
  if (dr + cr !== 0) return `Voucher totals do not match! Dr: ${formatAmt(dr)} Dr  Cr: ${formatAmt(cr)} Cr  Diff: ${formatAmt(dr + cr)} ${dr + cr < 0 ? 'Dr' : 'Cr'}`;
  return null;
}

function handleImport(body) {
  const report = (tag(body, 'REPORTNAME') || '').toUpperCase();
  const res = { created: 0, altered: 0, deleted: 0, errors: [] };
  if (report === 'ALL MASTERS') {
    for (const [, name] of body.matchAll(/<LEDGER NAME="([^"]+)"[^>]*>/g)) {
      ledgers.has(unescape(name)) ? res.altered++ : res.created++;
      ledgers.add(unescape(name));
    }
    return importResult(res);
  }
  for (const [v, attrs] of body.matchAll(/<VOUCHER(\s[^>]*)>[\s\S]*?<\/VOUCHER>/g)) {
    const remoteId = attrs.match(/REMOTEID="([^"]*)"/)?.[1] || `auto-${lastVchId + 1}`;
    const action = (attrs.match(/ACTION="([^"]*)"/)?.[1] || 'Create').toLowerCase();
    if (action === 'delete') {
      if (vouchers.delete(remoteId)) res.deleted++;
      else res.errors.push('Voucher does not exist!');
      continue;
    }
    const err = checkVoucher(v);
    if (err) { res.errors.push(err); continue; }
    lastVchId++;
    vouchers.has(remoteId) ? res.altered++ : res.created++; // VERIFY on real 7.1 (roadmap S0)
    vouchers.set(remoteId, { alterId: lastVchId, xml: v });
  }
  return importResult(res);
}

function handle(body) {
  const company = tag(body, 'SVCURRENTCOMPANY');
  if (company && !companies.has(unescape(company.trim()))) {
    return `<ENVELOPE>\n <HEADER><VERSION>1</VERSION><STATUS>0</STATUS></HEADER>\n <BODY><DATA><LINEERROR>Could not set 'SVCurrentCompany' to '${company.trim()}'.</LINEERROR></DATA></BODY>\n</ENVELOPE>`;
  }
  const request = (tag(body, 'TALLYREQUEST') || '').toUpperCase();
  if (request.startsWith('IMPORT')) return handleImport(body);

  const type = (body.match(/<HEADER>[\s\S]*?<TYPE>([^<]*)<\/TYPE>/i)?.[1] || '').toUpperCase();
  if (type === 'COLLECTION') {
    const objType = (body.match(/<COLLECTION[^>]*>[\s\S]*?<TYPE>([^<]*)<\/TYPE>/i)?.[1] || '').toUpperCase();
    if (collectionSamples[objType]) return sample(collectionSamples[objType]);
  }
  const id = (body.match(/<HEADER>[\s\S]*?<ID>([^<]*)<\/ID>/i)?.[1] || tag(body, 'REPORTNAME') || '').toUpperCase();
  if (reportSamples[id]) return sample(reportSamples[id]);
  return '<ENVELOPE></ENVELOPE>';
}

http.createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const out = req.method === 'GET' || !body.trim() ? sample('01-ping.res.xml') : handle(body);
    res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(out);
  });
}).listen(PORT, () => console.log(`Dummy Tally listening on http://localhost:${PORT} (companies: ${[...companies].join(', ')})`));
