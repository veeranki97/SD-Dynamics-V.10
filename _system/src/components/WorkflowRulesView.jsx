import { useMemo, useState } from 'react';
import { toast } from './Toast';

const KEY = 'fgsb_workflow_rules';
const MAX_DAYS = 3650;
const CHANNELS = ['email', 'whatsapp'];

const DEFAULTS = [
  { id: 'overdue_15', enabled: true, days: 15, channel: 'email', label: 'If invoice > 15 days overdue, remind client' },
  { id: 'overdue_30', enabled: false, days: 30, channel: 'whatsapp', label: 'If invoice > 30 days overdue, WhatsApp reminder' },
];

const makeId = () => `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function normalizeRule(rule, index) {
  if (!rule || typeof rule !== 'object') return null;
  const days = Number(rule.days);
  const channel = CHANNELS.includes(String(rule.channel).toLowerCase())
    ? String(rule.channel).toLowerCase()
    : 'email';
  const id = typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : `rule_${index + 1}`;
  const safeDays = Number.isFinite(days) ? Math.min(MAX_DAYS, Math.max(1, Math.floor(days))) : 15;
  const label = typeof rule.label === 'string' && rule.label.trim()
    ? rule.label.trim()
    : `If invoice is ${safeDays} days overdue, send a reminder`;
  return { id, enabled: rule.enabled !== false, days: safeDays, channel, label };
}

function normalizeRules(value) {
  if (!Array.isArray(value)) return DEFAULTS.map(rule => ({ ...rule }));
  const seen = new Set();
  const rules = value
    .map(normalizeRule)
    .filter(rule => {
      if (!rule || seen.has(rule.id)) return false;
      seen.add(rule.id);
      return true;
    });
  return rules;
}

export function getWorkflowRules() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return normalizeRules(JSON.parse(raw));
  } catch (error) {
    console.warn('Could not read workflow rules from localStorage:', error);
  }
  return DEFAULTS.map(rule => ({ ...rule }));
}

function formatRuleLabel(days, channel) {
  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'email';
  return `If invoice is ${days} days overdue, send ${channelLabel} reminder`;
}

function getDueDate(bill) {
  return bill?.data?.details?.dueDate || bill?.dueDate || bill?.invoiceDate || null;
}

// Parse date-only strings as local calendar dates to avoid UTC timezone shifting.
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysOverdueAt(dueDate, now) {
  const due = parseDate(dueDate);
  if (!due) return null;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - dueDay) / 86400000);
}

/** Evaluate enabled rules against bills; returns matches only and never sends reminders. */
export function runWorkflowRules(bills = [], now = new Date()) {
  const rules = normalizeRules(getWorkflowRules()).filter(rule => rule.enabled && rule.days >= 1);
  if (!rules.length || !Array.isArray(bills)) return [];

  const hits = [];
  bills.forEach(bill => {
    const status = String(bill?.status || '').trim().toLowerCase();
    if (['paid', 'cancelled', 'received', 'void', 'deleted'].includes(status)) return;

    const dueDate = getDueDate(bill);
    if (!dueDate) return;
    const overdueDays = daysOverdueAt(dueDate, now);
    if (overdueDays === null || overdueDays < 0) return;

    rules.forEach(rule => {
      if (overdueDays >= rule.days) {
        hits.push({
          billId: bill.id,
          invoiceNumber: bill.invoiceNumber,
          clientName: bill.clientName,
          daysOverdue: overdueDays,
          channel: rule.channel,
          ruleId: rule.id,
          label: rule.label,
        });
      }
    });
  });
  return hits;
}

const inputStyle = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '9px 10px',
  border: '1px solid var(--border-color, #d8dee8)',
  borderRadius: 8,
  background: 'var(--input-bg, var(--card-bg, #fff))',
  color: 'var(--text-primary, inherit)',
  font: 'inherit',
};

const buttonStyle = {
  border: '1px solid var(--border-color, #d8dee8)',
  borderRadius: 8,
  padding: '8px 12px',
  background: 'var(--card-bg, #fff)',
  color: 'var(--text-primary, inherit)',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 600,
};

export default function WorkflowRulesView() {
  const [rules, setRules] = useState(() => getWorkflowRules());
  const [savedRules, setSavedRules] = useState(() => getWorkflowRules());
  const [saveError, setSaveError] = useState('');

  const dirty = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(savedRules),
    [rules, savedRules],
  );
  const enabledCount = rules.filter(rule => rule.enabled).length;

  const updateRule = (id, patch) => {
    setSaveError('');
    setRules(current => current.map(rule => {
      if (rule.id !== id) return rule;
      const next = { ...rule, ...patch };
      if ('days' in patch || 'channel' in patch) {
        next.label = formatRuleLabel(next.days, next.channel);
      }
      return next;
    }));
  };

  const save = () => {
    const invalid = rules.find(rule => !Number.isInteger(Number(rule.days)) || Number(rule.days) < 1 || Number(rule.days) > MAX_DAYS);
    if (invalid) {
      setSaveError(`Days must be a whole number between 1 and ${MAX_DAYS}.`);
      return;
    }
    try {
      const clean = normalizeRules(rules);
      localStorage.setItem(KEY, JSON.stringify(clean));
      setRules(clean);
      setSavedRules(clean);
      setSaveError('');
      toast('Workflow rules saved', 'success');
    } catch (error) {
      console.error('Could not save workflow rules:', error);
      setSaveError('Could not save settings in this browser. Check storage permissions and try again.');
      toast('Could not save workflow rules', 'error');
    }
  };

  const addRule = () => {
    const newRule = {
      id: makeId(),
      enabled: true,
      days: 7,
      channel: 'email',
      label: formatRuleLabel(7, 'email'),
    };
    setRules(current => [...current, newRule]);
    setSaveError('');
  };

  const removeRule = (id) => {
    setRules(current => current.filter(rule => rule.id !== id));
    setSaveError('');
  };

  const resetDefaults = () => {
    setRules(DEFAULTS.map(rule => ({ ...rule })));
    setSaveError('');
  };

  return (
    <div className="page workflow-rules-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>Workflow Rules</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary, #667085)', lineHeight: 1.5 }}>
            Configure invoice follow-up thresholds. Rules generate matches only; they do not send messages automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #667085)', padding: '6px 9px', borderRadius: 20, background: 'var(--surface-muted, #f2f4f7)' }}>
            {enabledCount} of {rules.length} enabled
          </span>
          <button type="button" style={buttonStyle} onClick={resetDefaults}>Reset defaults</button>
          <button type="button" style={{ ...buttonStyle, background: 'var(--primary, #2563eb)', color: '#fff', borderColor: 'var(--primary, #2563eb)' }} onClick={save} disabled={!dirty}>
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {saveError && (
        <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #f3b7b7', background: '#fff3f3', color: '#a32121' }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
        {rules.map(rule => (
          <section key={rule.id} style={{ border: '1px solid var(--border-color, #e1e6ee)', borderRadius: 12, background: 'var(--card-bg, #fff)', padding: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!rule.enabled}
                  onChange={event => updateRule(rule.id, { enabled: event.target.checked })}
                />
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </label>
              <button type="button" style={{ ...buttonStyle, padding: '5px 9px', color: 'var(--danger, #b42318)' }} onClick={() => removeRule(rule.id)} aria-label={`Remove rule ${rule.label}`}>
                Remove
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }} htmlFor={`days-${rule.id}`}>Overdue after (days)</label>
                <input
                  id={`days-${rule.id}`}
                  type="number"
                  min="1"
                  max={MAX_DAYS}
                  step="1"
                  inputMode="numeric"
                  style={inputStyle}
                  value={rule.days}
                  onChange={event => {
                    const value = event.target.value === '' ? '' : Number(event.target.value);
                    setSaveError('');
                    setRules(current => current.map(item => item.id === rule.id
                      ? { ...item, days: value, label: formatRuleLabel(value || 0, item.channel) }
                      : item));
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }} htmlFor={`channel-${rule.id}`}>Channel</label>
                <select id={`channel-${rule.id}`} style={inputStyle} value={rule.channel} onChange={event => updateRule(rule.id, { channel: event.target.value })}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-muted, #f5f7fa)', color: 'var(--text-secondary, #667085)', fontSize: 13, lineHeight: 1.45 }}>
              {rule.days ? `When an invoice is at least ${rule.days} day${Number(rule.days) === 1 ? '' : 's'} overdue, create a ${rule.channel === 'whatsapp' ? 'WhatsApp' : 'email'} follow-up match.` : 'Enter a valid overdue threshold to define this rule.'}
            </div>
          </section>
        ))}
      </div>

      {rules.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary, #667085)', border: '1px dashed var(--border-color, #d8dee8)', borderRadius: 12 }}>
          No workflow rules configured yet. Add a rule to get started.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" style={buttonStyle} onClick={addRule}>+ Add rule</button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #667085)' }}>
          Changes stay local to this browser until you save.
        </span>
      </div>
    </div>
  );
}
