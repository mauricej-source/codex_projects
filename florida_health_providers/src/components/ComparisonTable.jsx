const rows = [
  { label: 'Avg. monthly premium', key: 'monthlyPremium' },
  { label: 'Deductible', key: 'deductible' },
  { label: 'Out-of-pocket max', key: 'outOfPocketMax' },
]

export default function ComparisonTable({ providers, formatCurrency }) {
  const bestValues = {
    monthlyPremium: Math.min(...providers.map((provider) => provider.monthlyPremium)),
    deductible: Math.min(...providers.map((provider) => provider.deductible)),
    outOfPocketMax: Math.min(...providers.map((provider) => provider.outOfPocketMax)),
  }

  return (
    <section className="comparison-section" id="comparison-table">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Side-by-side comparison</p>
          <h2>See the tradeoffs clearly</h2>
        </div>
        <p className="section-copy">
          The strongest numeric value in each row is highlighted to make the lowest cost
          option easy to spot.
        </p>
      </div>

      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Category</th>
              {providers.map((provider) => (
                <th key={provider.id}>
                  <div className="table-provider">
                    <strong>{provider.name}</strong>
                    <span>{provider.region || 'Florida provider'}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th>{row.label}</th>
                {providers.map((provider) => {
                  const isBest = provider[row.key] === bestValues[row.key]
                  return (
                    <td key={provider.id} className={isBest ? 'best-value' : ''}>
                      {formatCurrency(provider[row.key])}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th>Coverage levels</th>
              {providers.map((provider) => (
                <td key={provider.id}>{provider.coverageLevels.join(', ')}</td>
              ))}
            </tr>
            <tr>
              <th>Description</th>
              {providers.map((provider) => (
                <td key={provider.id}>{provider.description}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
