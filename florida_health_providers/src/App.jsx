import { useEffect, useRef, useState } from 'react'
import ComparisonBar from './components/ComparisonBar'
import ComparisonTable from './components/ComparisonTable'
import FilterPanel from './components/FilterPanel'
import ProviderCard from './components/ProviderCard'
import { providers } from './data/providers'

const STORAGE_KEY = 'florida-health-plan-comparisons'
const premiumValues = providers.map((provider) => provider.monthlyPremium)
const MIN_PREMIUM = Math.min(...premiumValues)
const MAX_PREMIUM = Math.max(...premiumValues)

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function getInitialSelected() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export default function App() {
  const [sortOrder, setSortOrder] = useState('low')
  const [coverageFilter, setCoverageFilter] = useState('All')
  const [maxPremium, setMaxPremium] = useState(MAX_PREMIUM)
  const [selectedIds, setSelectedIds] = useState(getInitialSelected)
  const comparisonRef = useRef(null)

  useEffect(() => {
    const validIds = new Set(providers.map((provider) => provider.id))
    setSelectedIds((current) =>
      current.filter((id, index) => validIds.has(id) && current.indexOf(id) === index).slice(0, 3),
    )
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds))
  }, [selectedIds])

  const filteredProviders = providers
    .filter((provider) => {
      const matchesCoverage =
        coverageFilter === 'All' || provider.coverageLevels.includes(coverageFilter)
      const matchesPremium = provider.monthlyPremium <= maxPremium
      return matchesCoverage && matchesPremium
    })
    .sort((a, b) =>
      sortOrder === 'low'
        ? a.monthlyPremium - b.monthlyPremium
        : b.monthlyPremium - a.monthlyPremium,
    )

  const selectedProviders = providers.filter((provider) => selectedIds.includes(provider.id))

  function handleToggleSelection(providerId) {
    setSelectedIds((current) => {
      if (current.includes(providerId)) {
        return current.filter((id) => id !== providerId)
      }

      if (current.length >= 3) {
        return current
      }

      return [...current, providerId]
    })
  }

  function handleResetFilters() {
    setSortOrder('low')
    setCoverageFilter('All')
    setMaxPremium(MAX_PREMIUM)
  }

  function handleCompareScroll() {
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handlePremiumChange(value) {
    if (Number.isNaN(value)) {
      return
    }

    const nextValue = Math.min(Math.max(value, MIN_PREMIUM), MAX_PREMIUM)
    setMaxPremium(nextValue)
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Florida health coverage</p>
          <h1>Compare private individual plans with less guesswork.</h1>
          <p className="hero-text">
            Explore 18 Florida providers, filter by available metal level, and keep up to
            three plans in a live comparison tray. Premium values are shown as average
            reference premiums from the source workbook.
          </p>
        </div>

        <div className="hero-panel">
          <div className="stat-card">
            <span>Providers loaded</span>
            <strong>{providers.length}</strong>
          </div>
          <div className="stat-card">
            <span>Lowest premium</span>
            <strong>{formatCurrency(MIN_PREMIUM)}</strong>
          </div>
          <div className="stat-card">
            <span>Highest premium</span>
            <strong>{formatCurrency(MAX_PREMIUM)}</strong>
          </div>
        </div>
      </header>

      <main className="content-grid">
        <FilterPanel
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          coverageFilter={coverageFilter}
          onCoverageChange={setCoverageFilter}
          maxPremium={maxPremium}
          onMaxPremiumChange={handlePremiumChange}
          minPremium={MIN_PREMIUM}
          maxPremiumLimit={MAX_PREMIUM}
          resultsCount={filteredProviders.length}
          onReset={handleResetFilters}
        />

        <section className="providers-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Provider listing</p>
              <h2>Browse by cost, availability, and fit</h2>
            </div>
            <p className="section-copy">
              Select up to three providers to keep them pinned in the sticky comparison bar.
            </p>
          </div>

          <div className="provider-grid">
            {filteredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                selected={selectedIds.includes(provider.id)}
                disabled={selectedIds.length >= 3 && !selectedIds.includes(provider.id)}
                onToggle={handleToggleSelection}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </section>

        {selectedProviders.length > 0 ? (
          <div ref={comparisonRef}>
            <ComparisonTable providers={selectedProviders} formatCurrency={formatCurrency} />
          </div>
        ) : null}
      </main>

      {selectedProviders.length > 0 ? (
        <ComparisonBar
          selectedProviders={selectedProviders}
          onRemove={handleToggleSelection}
          onClear={() => setSelectedIds([])}
          onCompare={handleCompareScroll}
          formatCurrency={formatCurrency}
        />
      ) : null}
    </div>
  )
}
