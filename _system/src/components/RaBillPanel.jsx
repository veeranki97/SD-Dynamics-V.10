import { useMemo } from 'react';
import { computeRaSchedule } from '../utils/raBilling';
import { formatCurrency } from '../utils';

/**
 * Running Account (RA) Certificate of Payment panel for InvoiceGenerator.
 * Controlled via invoiceOptions + local RA fields on details/options.
 */
export default function RaBillPanel({ enabled, value = {}, grossTotal = 0, onChange }) {
  if (!enabled) return null;
  const v = value || {};
  const schedule = useMemo(
    () =>
      computeRaSchedule({
        grossWorkDone: Number(v.grossWorkDone) || grossTotal,
        previousGrossPassed: v.previousGrossPassed,
        mobilizationAdvanceTotal: v.mobilizationAdvanceTotal,
        mobilizationRecoveryPercent: v.mobilizationRecoveryPercent ?? 10,
        retentionPercent: v.retentionPercent ?? 5,
        maxRetentionCapPercent: v.maxRetentionCapPercent ?? 5,
        previousRetentionHeld: v.previousRetentionHeld,
        deductTds194c: !!v.deductTds194c,
        deductGstTds: !!v.deductGstTds,
        deductBocw: !!v.deductBocw,
        tdsItPercent: v.tdsItPercent ?? 2,
        tdsGstPercent: v.tdsGstPercent ?? 2,
        bocwPercent: v.bocwPercent ?? 1,
      }),
    [v, grossTotal]
  );
  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div className="glass-panel" style={{ padding: 16, marginTop: 12, border: '1px solid #c7d2fe' }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Running Account — Certificate of Payment</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <label style={{ fontSize: 12 }}>Previous Gross Passed (₹)
          <input className="form-input" type="number" value={v.previousGrossPassed || ''} onChange={e => set({ previousGrossPassed: e.target.value })} />
        </label>
        <label style={{ fontSize: 12 }}>Mobilization Advance Total (₹)
          <input className="form-input" type="number" value={v.mobilizationAdvanceTotal || ''} onChange={e => set({ mobilizationAdvanceTotal: e.target.value })} />
        </label>
        <label style={{ fontSize: 12 }}>Mob. Recovery %
          <input className="form-input" type="number" value={v.mobilizationRecoveryPercent ?? 10} onChange={e => set({ mobilizationRecoveryPercent: e.target.value })} />
        </label>
        <label style={{ fontSize: 12 }}>Retention %
          <input className="form-input" type="number" value={v.retentionPercent ?? 5} onChange={e => set({ retentionPercent: e.target.value })} />
        </label>
        <label style={{ fontSize: 12 }}>Max Retention Cap %
          <input className="form-input" type="number" value={v.maxRetentionCapPercent ?? 5} onChange={e => set({ maxRetentionCapPercent: e.target.value })} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 13 }}>
        <label><input type="checkbox" checked={!!v.deductTds194c} onChange={e => set({ deductTds194c: e.target.checked })} /> TDS 194C (2%)</label>
        <label><input type="checkbox" checked={!!v.deductGstTds} onChange={e => set({ deductGstTds: e.target.checked })} /> GST-TDS Sec 51 (2%)</label>
        <label><input type="checkbox" checked={!!v.deductBocw} onChange={e => set({ deductBocw: e.target.checked })} /> BOCW Cess (1%)</label>
      </div>
      <table className="data-table" style={{ width: '100%', marginTop: 12, fontSize: 13 }}>
        <tbody>
          <tr><td>Gross Work Done</td><td className="text-end">{formatCurrency(schedule.grossWorkDone)}</td></tr>
          <tr><td>This Bill Gross</td><td className="text-end">{formatCurrency(schedule.thisBillGross)}</td></tr>
          <tr><td>Less: Mobilization Advance Recovery</td><td className="text-end">{formatCurrency(schedule.mobilizationRecovery)}</td></tr>
          <tr><td>Less: Retention Withheld</td><td className="text-end">{formatCurrency(schedule.retentionWithheld)}</td></tr>
          <tr><td>Less: Statutory (TDS + GST-TDS + Cess)</td><td className="text-end">{formatCurrency(schedule.statutoryWithholdings)}</td></tr>
          <tr style={{ fontWeight: 700 }}><td>Net Certified Amount Payable</td><td className="text-end">{formatCurrency(schedule.netCertifiedAmount)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
