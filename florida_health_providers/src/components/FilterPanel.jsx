const coverageOptions = ['All', 'Bronze', 'Silver', 'Gold']

export default function FilterPanel({
  sortOrder,
  onSortChange,
  coverageFilter,
  onCoverageChange,
  maxPremium,
  onMaxPremiumChange,
  minPremium,
  maxPremiumLimit,
  resultsCount,
  onReset,
}) {
  return (
    <section className="filter-panel">
      <div className="filter-header">
        <div>
          <p className="eyebrow">Filter and sort</p>
          <h2>Refine the shortlist</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="filter-grid">
        <label className="field-group">
          <span>Sort by premium</span>
          <select value={sortOrder} onChange={(event) => onSortChange(event.target.value)}>
            <option value="low">Lowest premium</option>
            <option value="high">Highest premium</option>
          </select>
        </label>

        <label className="field-group">
          <span>Coverage level</span>
          <select
            value={coverageFilter}
            onChange={(event) => onCoverageChange(event.target.value)}
          >
            {coverageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group premium-field">
          <span>Max monthly premium</span>
          <div className="slider-wrap">
            <input
              type="range"
              min={minPremium}
              max={maxPremiumLimit}
              step="5"
              value={maxPremium}
              onChange={(event) => onMaxPremiumChange(Number(event.target.value))}
            />
            <input
              type="number"
              min={minPremium}
              max={maxPremiumLimit}
              value={maxPremium}
              onChange={(event) => onMaxPremiumChange(Number(event.target.value))}
            />
          </div>
        </label>
      </div>

      <p className="results-copy">{resultsCount} providers match the current filters.</p>
    </section>
  )
}
