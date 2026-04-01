const levelTone = {
  Bronze: 'level-bronze',
  Silver: 'level-silver',
  Gold: 'level-gold',
}

export default function ProviderCard({
  provider,
  selected,
  disabled,
  onToggle,
  formatCurrency,
}) {
  return (
    <article className={`provider-card${selected ? ' provider-card-selected' : ''}`}>
      <div className="provider-card-top">
        <div>
          <p className="eyebrow">Florida individual coverage</p>
          <h3>{provider.name}</h3>
        </div>
        <button
          type="button"
          className={`select-button${selected ? ' is-selected' : ''}`}
          onClick={() => onToggle(provider.id)}
          disabled={disabled}
        >
          {selected ? 'Selected' : disabled ? 'Limit reached' : 'Compare'}
        </button>
      </div>

      <p className="provider-description">{provider.description}</p>

      <div className="card-metrics">
        <div>
          <span>Avg. monthly premium</span>
          <strong>{formatCurrency(provider.monthlyPremium)}</strong>
        </div>
        <div>
          <span>Deductible</span>
          <strong>{formatCurrency(provider.deductible)}</strong>
        </div>
        <div>
          <span>Out-of-pocket max</span>
          <strong>{formatCurrency(provider.outOfPocketMax)}</strong>
        </div>
      </div>

      <div className="card-footer">
        <div className="coverage-badges" aria-label="Coverage levels">
          {provider.coverageLevels.map((level) => (
            <span key={level} className={`level-pill ${levelTone[level]}`}>
              {level}
            </span>
          ))}
        </div>
        <span className="region-text">{provider.region || 'Regional footprint varies'}</span>
      </div>
    </article>
  )
}
