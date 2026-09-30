#!/usr/bin/env node
// Validates tax-rules.json before it is committed or deployed.
const fs = require('fs');
const path = process.argv[2] || 'tax-rules.json';
const r = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];
const need = (obj, keys, where) => keys.forEach(k => { if (obj[k] === undefined) errors.push(`${where}: missing "${k}"`); });
const checkSlabs = (slabs, where) => {
  if (!Array.isArray(slabs) || slabs.length < 2) return errors.push(`${where}: slabs must be an array of [limit, rate]`);
  let prev = 0;
  slabs.forEach(([lim, rate], i) => {
    if (i === slabs.length - 1 && lim !== null) errors.push(`${where}: last slab limit must be null`);
    if (lim !== null && lim <= prev) errors.push(`${where}: slab limits must increase (index ${i})`);
    if (lim !== null) prev = lim;
    if (typeof rate !== 'number' || rate < 0 || rate > 1) errors.push(`${where}: rate at index ${i} must be 0..1`);
  });
};
need(r, ['schema', 'updated', 'default_fy', 'rulesets'], 'root');
if (!/^\d{4}-\d{2}-\d{2}$/.test(r.updated)) errors.push('root.updated must be YYYY-MM-DD');
if (!r.rulesets[r.default_fy]) errors.push(`default_fy ${r.default_fy} has no ruleset`);
for (const [fy, rs] of Object.entries(r.rulesets)) {
  if (!/^\d{4}-\d{2}$/.test(fy)) errors.push(`ruleset key ${fy} must look like 2026-27`);
  need(rs, ['label', 'verified_on', 'status', 'cess', 'new_regime', 'old_regime', 'deductions_old_regime', 'house_property', 'capital_gains', 'presumptive', 'tax_audit', 'advance_tax', 'gst', 'filing', 'small_savings_rates'], fy);
  if (!['verified', 'provisional', 'draft'].includes(rs.status)) errors.push(`${fy}: status must be verified|provisional|draft`);
  if (rs.new_regime) { need(rs.new_regime, ['slabs', 'standard_deduction', 'rebate_income_limit', 'rebate_max', 'employer_nps_pct_of_basic', 'surcharge', 'surcharge_cap_capital_gains'], fy + '.new_regime'); checkSlabs(rs.new_regime.slabs, fy + '.new_regime.slabs'); }
  if (rs.old_regime) { need(rs.old_regime, ['slabs_below_60', 'slabs_60_to_79', 'slabs_80_plus', 'standard_deduction', 'rebate_income_limit', 'rebate_max', 'surcharge'], fy + '.old_regime'); ['slabs_below_60', 'slabs_60_to_79', 'slabs_80_plus'].forEach(k => rs.old_regime[k] && checkSlabs(rs.old_regime[k], `${fy}.old_regime.${k}`)); }
  if (rs.capital_gains) need(rs.capital_gains, ['equity_stcg_rate', 'equity_ltcg_rate', 'equity_ltcg_exemption', 'other_ltcg_rate'], fy + '.capital_gains');
  if (rs.presumptive) need(rs.presumptive, ['44AD_turnover_limit', '44AD_turnover_limit_digital', '44AD_rate_cash', '44AD_rate_digital', '44ADA_receipts_limit', '44ADA_receipts_limit_digital', '44ADA_rate', 'digital_threshold_pct'], fy + '.presumptive');
  if (rs.advance_tax && rs.advance_tax.instalments) { const last = rs.advance_tax.instalments.at(-1); if (!last || last[1] !== 1) errors.push(`${fy}: last advance-tax instalment must reach 1.00`); }
}
// Warn if the current Indian FY has no ruleset
const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; const curFY = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
if (!r.rulesets[curFY]) console.warn(`WARNING: no ruleset for current FY ${curFY}; app will fall back to the latest one.`);
if (errors.length) { console.error('tax-rules.json is INVALID:\n - ' + errors.join('\n - ')); process.exit(1); }
console.log(`tax-rules.json OK — ${Object.keys(r.rulesets).length} ruleset(s), default ${r.default_fy}, updated ${r.updated}`);
