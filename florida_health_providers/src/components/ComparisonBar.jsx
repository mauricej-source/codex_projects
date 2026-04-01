export default function ComparisonBar({
  selectedProviders,
  onRemove,
  onClear,
  onCompare,
  formatCurrency,
}) {
  return (
    <aside className="comparison-bar">
      <div className="comparison-bar-copy">
        <p className="eyebrow">Comparison tray</p>
        <h2>{selectedProviders.length} of 3 plans selected</h2>
      </div>

      <div className="comparison-chip-list">
        {selectedProviders.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className="comparison-chip"
            onClick={() => onRemove(provider.id)}
          >
            <span>{provider.name}</span>
            <small>{formatCurrency(provider.monthlyPremium)}</small>
          </button>
        ))}
      </div>

      <div className="comparison-actions">
        <button type="button" className="ghost-button" onClick={onClear}>
          Clear all
        </button>
        <button type="button" className="primary-button" onClick={onCompare}>
          Compare plans
        </button>
      </div>
    </aside>
  )
}
