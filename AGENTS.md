
- Accounting figures (ledger screen, PDF, XLSX, CSV) come only from the `sales_ledger` RPC + `src/lib/ledger.ts` computeLedger; never add per-screen calculation logic. Why: all reports must reconcile identically.
