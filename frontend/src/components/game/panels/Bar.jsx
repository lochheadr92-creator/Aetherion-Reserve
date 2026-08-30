// Shared meter bar used by inspect panels.
export default function Bar({ label, value, color, testId, cause }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="space-y-1" title={cause || `${label}: ${(v * 100).toFixed(0)}%`}>
      <div className="flex justify-between text-[11px]">
        <span className="text-[var(--text-2)]">{label}</span>
        <span className="mono text-[var(--text-3)]" data-testid={testId}>{(v * 100).toFixed(0)}%</span>
      </div>
      <div className="nl-bar-track">
        <div
          className="nl-bar-fill"
          style={{ width: `${v * 100}%`, background: color || (v > 0.65 ? 'var(--success)' : v > 0.4 ? 'var(--warning)' : 'var(--danger)') }}
        />
      </div>
    </div>
  );
}
