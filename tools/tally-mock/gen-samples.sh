#!/usr/bin/env bash
# Regenerates samples/*.xml (request/response pairs for every Tally operation we use).
# Run from anywhere:  bash tools/tally-mock/gen-samples.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p samples && cd samples && rm -f ./*.xml ./*.txt
C='Demo Traders - 2025-26'

env_exp() { # $1=TYPE $2=ID $3=extra static vars $4=tdl body
  cat <<EOF
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>$1</TYPE><ID>$2</ID></HEADER>
 <BODY><DESC>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>\$\$SysName:XML</SVEXPORTFORMAT>
   <SVCURRENTCOMPANY>$C</SVCURRENTCOMPANY>$3
  </STATICVARIABLES>
  <TDL><TDLMESSAGE>
$4
  </TDLMESSAGE></TDL>
 </DESC></BODY>
</ENVELOPE>
EOF
}
res_coll() {
  cat <<EOF
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
 <BODY><DESC></DESC><DATA><COLLECTION>
$1
 </COLLECTION></DATA></BODY>
</ENVELOPE>
EOF
}
env_imp() { # $1=REPORTNAME $2=body
  cat <<EOF
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>$1</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>$C</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
$2
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>
EOF
}
res_imp() { # created altered deleted errors lastvchid [lineerror]
  local le=""
  if [ -n "${6:-}" ]; then le="
  <LINEERROR>$6</LINEERROR>"; fi
  cat <<EOF
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
 <BODY><DESC></DESC><DATA>$le
  <IMPORTRESULT>
   <CREATED>$1</CREATED><ALTERED>$2</ALTERED><DELETED>$3</DELETED>
   <LASTVCHID>$5</LASTVCHID><LASTMID>0</LASTMID><COMBINED>0</COMBINED>
   <IGNORED>0</IGNORED><ERRORS>$4</ERRORS><CANCELLED>0</CANCELLED><EXCEPTIONS>0</EXCEPTIONS>
  </IMPORTRESULT>
 </DATA></BODY>
</ENVELOPE>
EOF
}
L() { # ledger line: name amount(Tally sign: Dr negative) [extra xml]
  local pos=No
  case "$2" in -*) pos=Yes ;; esac
  echo "     <ALLLEDGERENTRIES.LIST><LEDGERNAME>$1</LEDGERNAME><ISDEEMEDPOSITIVE>$pos</ISDEEMEDPOSITIVE><AMOUNT>$2</AMOUNT>${3:-}</ALLLEDGERENTRIES.LIST>"
}
V() { # type date number party narration lines remoteid [extra header xml]
  local party="" num=""
  if [ -n "$4" ]; then party="
     <PARTYLEDGERNAME>$4</PARTYLEDGERNAME>"; fi
  if [ -n "$3" ]; then num="
     <VOUCHERNUMBER>$3</VOUCHERNUMBER>"; fi
  cat <<EOF
    <VOUCHER VCHTYPE="$1" ACTION="Create" OBJVIEW="Accounting Voucher View" REMOTEID="$7">
     <DATE>$2</DATE><EFFECTIVEDATE>$2</EFFECTIVEDATE>
     <VOUCHERTYPENAME>$1</VOUCHERTYPENAME>$num$party${8:-}
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <NARRATION>$5</NARRATION>
$6
    </VOUCHER>
EOF
}
BANK() { echo "<BANKALLOCATIONS.LIST><DATE>$1</DATE><INSTRUMENTDATE>$1</INSTRUMENTDATE><TRANSACTIONTYPE>$2</TRANSACTIONTYPE><INSTRUMENTNUMBER>$3</INSTRUMENTNUMBER><PAYMENTFAVOURING>$4</PAYMENTFAVOURING><AMOUNT>$5</AMOUNT></BANKALLOCATIONS.LIST>"; }
BILL() { echo "<BILLALLOCATIONS.LIST><NAME>$1</NAME><BILLTYPE>$2</BILLTYPE><AMOUNT>$3</AMOUNT></BILLALLOCATIONS.LIST>"; }

# ---------- 01 ping ----------
echo "GET http://localhost:9000/" > 01-ping.req.txt
echo "<RESPONSE>TallyPrime Server is Running</RESPONSE>" > 01-ping.res.xml

# ---------- 02 companies ----------
cat > 02-companies.req.xml <<'EOF'
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
 <BODY><DESC>
  <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="CompanyList" ISMODIFY="No">
    <TYPE>Company</TYPE>
    <FETCH>Name, GUID, StartingFrom, BooksFrom, StateName, AltMstId, AltVchId</FETCH>
   </COLLECTION>
  </TDLMESSAGE></TDL>
 </DESC></BODY>
</ENVELOPE>
EOF
CMP() {
  cat <<EOF
  <COMPANY NAME="$1" RESERVEDNAME="">
   <NAME TYPE="String">$1</NAME>
   <GUID TYPE="String">7e18f7c9-0000-4ab2-9b0f-00000000000$2</GUID>
   <STARTINGFROM TYPE="Date">20250401</STARTINGFROM>
   <BOOKSFROM TYPE="Date">20250401</BOOKSFROM>
   <STATENAME TYPE="String">Maharashtra</STATENAME>
   <ALTMSTID TYPE="Number">$3</ALTMSTID>
   <ALTVCHID TYPE="Number">$4</ALTVCHID>
  </COMPANY>
EOF
}
res_coll "$(CMP "$C" 1 412 5020)
$(CMP 'Demo Agencies - 2025-26' 2 96 880)" > 02-companies.res.xml

# ---------- 03 ledgers (incremental by AlterID) ----------
env_exp Collection LedSync "" '   <COLLECTION NAME="LedSync" ISMODIFY="No">
    <TYPE>Ledger</TYPE>
    <FETCH>Name, GUID, AlterID, Parent, LedStateName, PartyGSTIN, IsBillWiseOn, OpeningBalance, ClosingBalance</FETCH>
    <FILTER>AfterAlter</FILTER>
   </COLLECTION>
   <SYSTEM TYPE="Formulae" NAME="AfterAlter">$AlterID &gt; 0</SYSTEM>' > 03-ledgers.req.xml
LED() {
  cat <<EOF
  <LEDGER NAME="$1" RESERVEDNAME="">
   <NAME TYPE="String">$1</NAME>
   <GUID TYPE="String">7e18f7c9-0000-4ab2-9b0f-1000000000$2</GUID>
   <ALTERID TYPE="Number">$2</ALTERID>
   <PARENT TYPE="String">$3</PARENT>
   <PARTYGSTIN TYPE="String">$4</PARTYGSTIN>
   <LEDSTATENAME TYPE="String">$5</LEDSTATENAME>
   <ISBILLWISEON TYPE="Logical">$6</ISBILLWISEON>
   <OPENINGBALANCE TYPE="Amount">$7</OPENINGBALANCE>
   <CLOSINGBALANCE TYPE="Amount">$8</CLOSINGBALANCE>
  </LEDGER>
EOF
}
M=Maharashtra
res_coll "$(LED 'Cash' 11 'Cash-in-Hand' '' $M No -5000.00 -12300.00)
$(LED 'SBI Current A/c' 12 'Bank Accounts' '' $M No -150000.00 -210450.00)
$(LED 'HDFC CC A/c' 13 'Bank OD A/c' '' $M No 0.00 45000.00)
$(LED 'ABC Traders' 14 'Sundry Debtors' 27AAAAA0000A1Z5 $M Yes 0.00 -11800.00)
$(LED 'XYZ Agencies' 15 'Sundry Debtors' 29BBBBB1111B1Z6 Karnataka Yes 0.00 0.00)
$(LED 'Om Distributors' 16 'Sundry Creditors' 27CCCCC2222C1Z7 $M Yes 0.00 23600.00)
$(LED 'Sales GST 18%' 17 'Sales Accounts' '' $M No 0.00 10000.00)
$(LED 'Purchase GST 18%' 18 'Purchase Accounts' '' $M No 0.00 -20000.00)
$(LED 'Output CGST 9%' 19 'Duties &amp; Taxes' '' $M No 0.00 900.00)
$(LED 'Output SGST 9%' 20 'Duties &amp; Taxes' '' $M No 0.00 900.00)
$(LED 'Output IGST 18%' 21 'Duties &amp; Taxes' '' $M No 0.00 0.00)
$(LED 'Input CGST 9%' 22 'Duties &amp; Taxes' '' $M No 0.00 -1800.00)
$(LED 'Input SGST 9%' 23 'Duties &amp; Taxes' '' $M No 0.00 -1800.00)
$(LED 'Sales Return 18%' 24 'Sales Accounts' '' $M No 0.00 0.00)
$(LED 'Purchase Return 18%' 25 'Purchase Accounts' '' $M No 0.00 0.00)
$(LED 'Bank Charges' 26 'Indirect Expenses' '' $M No 0.00 -236.00)
$(LED 'Round Off' 27 'Indirect Expenses' '' $M No 0.00 0.00)
$(LED 'Suspense A/c' 28 'Suspense A/c' '' $M No 0.00 0.00)
$(LED 'Input IGST 18%' 29 'Duties &amp; Taxes' '' $M No 0.00 0.00)
$(LED 'Delhi Footwear Co' 30 'Sundry Creditors' 07AAACD1234E1ZB Delhi Yes 0.00 0.00)
$(LED 'Discount Received' 31 'Indirect Incomes' '' $M No 0.00 0.00)" > 03-ledgers.res.xml

# ---------- 04 groups ----------
env_exp Collection GroupList "" '   <COLLECTION NAME="GroupList" ISMODIFY="No">
    <TYPE>Group</TYPE>
    <FETCH>Name, Parent, PrimaryGroup, IsRevenue, IsDeemedPositive</FETCH>
   </COLLECTION>' > 04-groups.req.xml
GRP() { echo "  <GROUP NAME=\"$1\" RESERVEDNAME=\"$1\"><NAME TYPE=\"String\">$1</NAME><PARENT TYPE=\"String\">$2</PARENT><PRIMARYGROUP TYPE=\"String\">$3</PRIMARYGROUP><ISREVENUE TYPE=\"Logical\">$4</ISREVENUE><ISDEEMEDPOSITIVE TYPE=\"Logical\">$5</ISDEEMEDPOSITIVE></GROUP>"; }
res_coll "$(GRP 'Sundry Debtors' 'Current Assets' 'Current Assets' No Yes)
$(GRP 'Sundry Creditors' 'Current Liabilities' 'Current Liabilities' No No)
$(GRP 'Bank Accounts' 'Current Assets' 'Current Assets' No Yes)
$(GRP 'Bank OD A/c' 'Loans (Liability)' 'Loans (Liability)' No No)
$(GRP 'Cash-in-Hand' 'Current Assets' 'Current Assets' No Yes)
$(GRP 'Sales Accounts' '' 'Sales Accounts' Yes No)
$(GRP 'Purchase Accounts' '' 'Purchase Accounts' Yes Yes)
$(GRP 'Duties &amp; Taxes' 'Current Liabilities' 'Current Liabilities' No No)
$(GRP 'Indirect Expenses' '' 'Indirect Expenses' Yes Yes)
$(GRP 'Suspense A/c' '' 'Suspense A/c' No No)" > 04-groups.res.xml

# ---------- 05 voucher types ----------
env_exp Collection VchTypeList "" '   <COLLECTION NAME="VchTypeList" ISMODIFY="No">
    <TYPE>VoucherType</TYPE>
    <FETCH>Name, Parent, NumberingMethod, IsActive</FETCH>
   </COLLECTION>' > 05-voucher-types.req.xml
VT() { echo "  <VOUCHERTYPE NAME=\"$1\" RESERVEDNAME=\"$3\"><NAME TYPE=\"String\">$1</NAME><PARENT TYPE=\"String\">$2</PARENT><NUMBERINGMETHOD TYPE=\"String\">$4</NUMBERINGMETHOD><ISACTIVE TYPE=\"Logical\">Yes</ISACTIVE></VOUCHERTYPE>"; }
res_coll "$(VT Sales Sales Sales Automatic)
$(VT 'RSPL CASH SALE' Sales '' 'Auto Renumber')
$(VT Purchase Purchase Purchase Manual)
$(VT Payment Payment Payment Automatic)
$(VT Receipt Receipt Receipt Automatic)
$(VT Contra Contra Contra Automatic)
$(VT 'Credit Note' 'Credit Note' 'Credit Note' Automatic)
$(VT 'Debit Note' 'Debit Note' 'Debit Note' Automatic)
$(VT Journal Journal Journal Automatic)" > 05-voucher-types.res.xml

# ---------- 06 stock items ----------
env_exp Collection ItemList "" '   <COLLECTION NAME="ItemList" ISMODIFY="No">
    <TYPE>StockItem</TYPE>
    <FETCH>Name, Parent, BaseUnits, ClosingBalance, ClosingRate</FETCH>
   </COLLECTION>' > 06-stock-items.req.xml
res_coll '  <STOCKITEM NAME="Item A 500g" RESERVEDNAME=""><NAME TYPE="String">Item A 500g</NAME><PARENT TYPE="String">Primary</PARENT><BASEUNITS TYPE="String">Nos</BASEUNITS><CLOSINGBALANCE TYPE="Quantity"> 120 Nos</CLOSINGBALANCE><CLOSINGRATE TYPE="Rate">85.00/Nos</CLOSINGRATE></STOCKITEM>
  <STOCKITEM NAME="Item B 1kg" RESERVEDNAME=""><NAME TYPE="String">Item B 1kg</NAME><PARENT TYPE="String">Primary</PARENT><BASEUNITS TYPE="String">Kgs</BASEUNITS><CLOSINGBALANCE TYPE="Quantity"> 42.500 Kgs</CLOSINGBALANCE><CLOSINGRATE TYPE="Rate">160.00/Kgs</CLOSINGRATE></STOCKITEM>' > 06-stock-items.res.xml

# ---------- 07 vouchers changed since AlterID ----------
env_exp Collection VchSync '
   <SVFROMDATE TYPE="Date">20250401</SVFROMDATE><SVTODATE TYPE="Date">20260331</SVTODATE>' '   <COLLECTION NAME="VchSync" ISMODIFY="No">
    <TYPE>Voucher</TYPE>
    <FETCH>GUID, MasterID, AlterID, Date, VoucherTypeName, VoucherNumber, Reference, PartyLedgerName, Narration, IsCancelled, AllLedgerEntries.LedgerName, AllLedgerEntries.Amount</FETCH>
    <FILTER>AfterAlter</FILTER>
   </COLLECTION>
   <SYSTEM TYPE="Formulae" NAME="AfterAlter">$AlterID &gt; 5000</SYSTEM>' > 07-vouchers-since-alterid.req.xml
VS() { # guid-suffix masterid alterid date type number party narration lines
  cat <<EOF
  <VOUCHER REMOTEID="7e18f7c9-0000-4ab2-9b0f-20000000$1" VCHTYPE="$5" OBJVIEW="Accounting Voucher View">
   <GUID TYPE="String">7e18f7c9-0000-4ab2-9b0f-20000000$1</GUID>
   <MASTERID TYPE="Number">$2</MASTERID>
   <ALTERID TYPE="Number">$3</ALTERID>
   <DATE TYPE="Date">$4</DATE>
   <VOUCHERTYPENAME TYPE="String">$5</VOUCHERTYPENAME>
   <VOUCHERNUMBER TYPE="String">$6</VOUCHERNUMBER>
   <PARTYLEDGERNAME TYPE="String">$7</PARTYLEDGERNAME>
   <NARRATION TYPE="String">$8</NARRATION>
   <ISCANCELLED TYPE="Logical">No</ISCANCELLED>
$9
  </VOUCHER>
EOF
}
SL() { echo "   <ALLLEDGERENTRIES.LIST><LEDGERNAME TYPE=\"String\">$1</LEDGERNAME><AMOUNT TYPE=\"Amount\">$2</AMOUNT></ALLLEDGERENTRIES.LIST>"; }
res_coll "$(VS 5019 1201 5019 20250405 Sales INV-101 'ABC Traders' '' "$(SL 'ABC Traders' -11800.00)
$(SL 'Sales GST 18%' 10000.00)
$(SL 'Output CGST 9%' 900.00)
$(SL 'Output SGST 9%' 900.00)")
$(VS 5020 1202 5020 20250410 Payment 12 'Om Distributors' 'NEFT/OM DISTRIBUTORS/UTR123456789012' "$(SL 'Om Distributors' -5000.00)
$(SL 'SBI Current A/c' 5000.00)")" > 07-vouchers-since-alterid.res.xml

# ---------- 08 pending bills ----------
env_exp Collection PendingBills "" '   <COLLECTION NAME="PendingBills" ISMODIFY="No">
    <TYPE>Bills</TYPE>
    <FETCH>Name, Parent, BillDate, ClosingBalance, BillCreditPeriod</FETCH>
    <FILTER>IsPending</FILTER>
   </COLLECTION>
   <SYSTEM TYPE="Formulae" NAME="IsPending">NOT $$IsZero:$ClosingBalance</SYSTEM>' > 08-pending-bills.req.xml
res_coll '  <BILL NAME="INV-101" RESERVEDNAME=""><NAME TYPE="String">INV-101</NAME><PARENT TYPE="String">ABC Traders</PARENT><BILLDATE TYPE="Date">20250405</BILLDATE><CLOSINGBALANCE TYPE="Amount">-11800.00</CLOSINGBALANCE><BILLCREDITPERIOD TYPE="Due Date">30 Days</BILLCREDITPERIOD></BILL>
  <BILL NAME="OD/2025/77" RESERVEDNAME=""><NAME TYPE="String">OD/2025/77</NAME><PARENT TYPE="String">Om Distributors</PARENT><BILLDATE TYPE="Date">20250407</BILLDATE><CLOSINGBALANCE TYPE="Amount">23600.00</CLOSINGBALANCE><BILLCREDITPERIOD TYPE="Due Date"></BILLCREDITPERIOD></BILL>' > 08-pending-bills.res.xml

# ---------- 09 Day Book (built-in report) ----------
RPT() { # report from to
  cat <<EOF
<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY><EXPORTDATA><REQUESTDESC>
  <REPORTNAME>$1</REPORTNAME>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>\$\$SysName:XML</SVEXPORTFORMAT>
   <SVCURRENTCOMPANY>$C</SVCURRENTCOMPANY>
   <SVFROMDATE TYPE="Date">$2</SVFROMDATE><SVTODATE TYPE="Date">$3</SVTODATE>
  </STATICVARIABLES>
 </REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>
EOF
}
RPT 'Day Book' 20250405 20250405 > 09-daybook.req.xml
cat > 09-daybook.res.xml <<'EOF'
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Demo Traders - 2025-26</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="7e18f7c9-0000-4ab2-9b0f-200000005019" VCHKEY="7e18f7c9-0000-4ab2-9b0f-200000005019:00000008" VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
     <DATE>20250405</DATE>
     <GUID>7e18f7c9-0000-4ab2-9b0f-200000005019</GUID>
     <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
     <VOUCHERNUMBER>INV-101</VOUCHERNUMBER>
     <PARTYLEDGERNAME>ABC Traders</PARTYLEDGERNAME>
     <MASTERID> 1201</MASTERID>
     <ALTERID> 5019</ALTERID>
     <LEDGERENTRIES.LIST><LEDGERNAME>ABC Traders</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-11800.00</AMOUNT></LEDGERENTRIES.LIST>
     <LEDGERENTRIES.LIST><LEDGERNAME>Sales GST 18%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>10000.00</AMOUNT></LEDGERENTRIES.LIST>
     <LEDGERENTRIES.LIST><LEDGERNAME>Output CGST 9%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>900.00</AMOUNT></LEDGERENTRIES.LIST>
     <LEDGERENTRIES.LIST><LEDGERNAME>Output SGST 9%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>900.00</AMOUNT></LEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>
EOF

# ---------- 10 Trial Balance (built-in report) ----------
RPT 'Trial Balance' 20250401 20260331 > 10-trial-balance.req.xml
TB() { printf ' <DSPACCNAME><DSPDISPNAME>%s</DSPDISPNAME></DSPACCNAME>\n <DSPACCINFO><DSPCLDRAMT><DSPCLDRAMTA>%s</DSPCLDRAMTA></DSPCLDRAMT><DSPCLCRAMT><DSPCLCRAMTA>%s</DSPCLCRAMTA></DSPCLCRAMT></DSPACCINFO>\n' "$1" "$2" "$3"; }
{ echo "<ENVELOPE>"
  TB 'Capital Account' '' '200000.00'
  TB 'Current Liabilities' '' '27200.00'
  TB 'Current Assets' '-234550.00' ''
  TB 'Sales Accounts' '' '10000.00'
  TB 'Purchase Accounts' '-20000.00' ''
  TB 'Indirect Expenses' '-236.00' ''
  echo "</ENVELOPE>"; } > 10-trial-balance.res.xml

# ---------- 11 custom TDL report (request captured from Livekeeping) ----------
sed "s/{COMPANY}/$C/" ../../../research/xml-captures/tally-http-log/002_EXPORT_DATA_ListOfVouchers.xml > 11-tdl-report-list-of-vouchers.req.xml
cat > 11-tdl-report-list-of-vouchers.res.xml <<'EOF'
<ENVELOPE>
 <LISTOFVOUCHERS>
  <DATE>20250405</DATE><ALTERID>5019</ALTERID><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
  <DATE>20250410</DATE><ALTERID>5020</ALTERID><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
 </LISTOFVOUCHERS>
</ENVELOPE>
EOF

# ---------- 12 create ledger ----------
env_imp 'All Masters' '    <LEDGER NAME="New Party Traders" ACTION="Create">
     <NAME.LIST><NAME>New Party Traders</NAME></NAME.LIST>
     <PARENT>Sundry Creditors</PARENT>
     <ISBILLWISEON>Yes</ISBILLWISEON>
     <LEDSTATENAME>Maharashtra</LEDSTATENAME>
     <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
     <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
     <PARTYGSTIN>27DDDDD3333D1Z8</PARTYGSTIN>
     <LEDMAILINGDETAILS.LIST>
      <APPLICABLEFROM>20250401</APPLICABLEFROM>
      <MAILINGNAME>New Party Traders</MAILINGNAME>
      <ADDRESS.LIST TYPE="String"><ADDRESS>Main Road, Nanded</ADDRESS></ADDRESS.LIST>
      <STATE>Maharashtra</STATE><PINCODE>431601</PINCODE><COUNTRY>India</COUNTRY>
     </LEDMAILINGDETAILS.LIST>
    </LEDGER>' > 12-create-ledger.req.xml
res_imp 1 0 0 0 0 > 12-create-ledger.res.xml

# ---------- 13-20 vouchers ----------
env_imp Vouchers "$(V Sales 20250405 INV-101 'ABC Traders' 'Sale as per bill INV-101' "$(L 'ABC Traders' -11800.00 "$(BILL INV-101 'New Ref' -11800.00)")
$(L 'Sales GST 18%' 10000.00)
$(L 'Output CGST 9%' 900.00)
$(L 'Output SGST 9%' 900.00)" th-sales-0001)" > 13-sales.req.xml
res_imp 1 0 0 0 5021 > 13-sales.res.xml

env_imp Vouchers "$(V Purchase 20250408 PB-77 'Om Distributors' 'Supplier bill OD/2025/77' "$(L 'Purchase GST 18%' -20000.00)
$(L 'Input CGST 9%' -1800.00)
$(L 'Input SGST 9%' -1800.00)
$(L 'Om Distributors' 23600.00 "$(BILL OD/2025/77 'New Ref' 23600.00)")" th-purc-0001 '
     <REFERENCE>OD/2025/77</REFERENCE><REFERENCEDATE>20250407</REFERENCEDATE>')" > 14-purchase.req.xml
res_imp 1 0 0 0 5022 > 14-purchase.res.xml

env_imp Vouchers "$(V Payment 20250410 '' 'Om Distributors' 'NEFT/OM DISTRIBUTORS/UTR123456789012' "$(L 'Om Distributors' -5000.00 "$(BILL OD/2025/77 'Agst Ref' -5000.00)")
$(L 'SBI Current A/c' 5000.00 "$(BANK 20250410 'e-Fund Transfer' UTR123456789012 'Om Distributors' 5000.00)")" th-bank-0001)" > 15-payment-bank.req.xml
res_imp 1 0 0 0 5023 > 15-payment-bank.res.xml

env_imp Vouchers "$(V Receipt 20250412 '' 'ABC Traders' 'UPI/ABC TRADERS/412345678901' "$(L 'SBI Current A/c' -11800.00 "$(BANK 20250412 'Others' 412345678901 'ABC Traders' -11800.00)")
$(L 'ABC Traders' 11800.00 "$(BILL INV-101 'Agst Ref' 11800.00)")" th-bank-0002)" > 16-receipt-bank.req.xml
res_imp 1 0 0 0 5024 > 16-receipt-bank.res.xml

env_imp Vouchers "$(V Contra 20250415 '' '' 'CASH DEPOSIT' "$(L 'SBI Current A/c' -10000.00 "$(BANK 20250415 'Others' '' '' -10000.00)")
$(L 'Cash' 10000.00)" th-bank-0003)" > 17-contra.req.xml
res_imp 1 0 0 0 5025 > 17-contra.res.xml

env_imp Vouchers "$(V 'Credit Note' 20250420 CN-5 'ABC Traders' 'Goods returned against INV-101' "$(L 'Sales Return 18%' -1000.00)
$(L 'Output CGST 9%' -90.00)
$(L 'Output SGST 9%' -90.00)
$(L 'ABC Traders' 1180.00 "$(BILL INV-101 'Agst Ref' 1180.00)")" th-cn-0001 '
     <REFERENCE>INV-101</REFERENCE><REFERENCEDATE>20250405</REFERENCEDATE>')" > 18-credit-note.req.xml
res_imp 1 0 0 0 5026 > 18-credit-note.res.xml

env_imp Vouchers "$(V 'Debit Note' 20250422 DN-2 'Om Distributors' 'Goods returned against OD/2025/77' "$(L 'Om Distributors' -2360.00 "$(BILL OD/2025/77 'Agst Ref' -2360.00)")
$(L 'Purchase Return 18%' 2000.00)
$(L 'Input CGST 9%' 180.00)
$(L 'Input SGST 9%' 180.00)" th-dn-0001 '
     <REFERENCE>OD/2025/77</REFERENCE><REFERENCEDATE>20250407</REFERENCEDATE>')" > 19-debit-note.req.xml
res_imp 1 0 0 0 5027 > 19-debit-note.res.xml

env_imp Vouchers "$(V Journal 20250430 '' '' 'Bank charges for April' "$(L 'Bank Charges' -236.00)
$(L 'SBI Current A/c' 236.00)" th-jv-0001)" > 20-journal.req.xml
res_imp 1 0 0 0 5028 > 20-journal.res.xml

# ---------- 21-22 alter / delete ----------
cp 13-sales.req.xml 21-resend-same-remoteid.req.xml
res_imp 0 1 0 0 5021 > 21-resend-same-remoteid.res.xml

env_imp Vouchers '    <VOUCHER REMOTEID="th-sales-0001" VCHTYPE="Sales" ACTION="Delete">
     <DATE>20250405</DATE>
     <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
     <VOUCHERNUMBER>INV-101</VOUCHERNUMBER>
    </VOUCHER>' > 22-delete-voucher.req.xml
res_imp 0 0 1 0 0 > 22-delete-voucher.res.xml

# ---------- 23-27 errors and variants ----------
sed 's#<LEDGERNAME>ABC Traders</LEDGERNAME>#<LEDGERNAME>ABC Tradrs</LEDGERNAME>#' 13-sales.req.xml > 23-error-ledger-missing.req.xml
res_imp 0 0 0 1 0 "Ledger 'ABC Tradrs' does not exist!" > 23-error-ledger-missing.res.xml

sed 's#<AMOUNT>900.00</AMOUNT>#<AMOUNT>800.00</AMOUNT>#' 13-sales.req.xml > 24-error-unbalanced.req.xml
res_imp 0 0 0 1 0 "Voucher totals do not match! Dr: 11,800.00 Dr  Cr: 11,600.00 Cr  Diff: 200.00 Dr" > 24-error-unbalanced.res.xml

sed "s#$C#Some Other Company - 2025-26#" 13-sales.req.xml > 25-error-company-not-open.req.xml
cat > 25-error-company-not-open.res.xml <<'EOF'
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><STATUS>0</STATUS></HEADER>
 <BODY><DATA><LINEERROR>Could not set 'SVCurrentCompany' to 'Some Other Company - 2025-26'.</LINEERROR></DATA></BODY>
</ENVELOPE>
EOF

sed 's#<DATE>20250405</DATE><EFFECTIVEDATE>20250405</EFFECTIVEDATE>#<DATE>20240405</DATE><EFFECTIVEDATE>20240405</EFFECTIVEDATE>#' 13-sales.req.xml > 26-error-date-before-books.req.xml
res_imp 0 0 0 1 0 "Voucher date is before Books Beginning date" > 26-error-date-before-books.res.xml

cat > 27-legacy-import-response.res.xml <<'EOF'
<RESPONSE>
 <CREATED>1</CREATED><ALTERED>0</ALTERED><DELETED>0</DELETED><LASTVCHID>5021</LASTVCHID><LASTMID>0</LASTMID>
 <COMBINED>0</COMBINED><IGNORED>0</IGNORED><ERRORS>0</ERRORS><CANCELLED>0</CANCELLED>
</RESPONSE>
EOF

echo "generated $(ls | wc -l) files"
