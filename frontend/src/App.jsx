
import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import './App.css'
import HealthAssessment from './HealthAssessment'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const TOKEN_KEY = 'healthai_access_token'
const USER_KEY = 'healthai_user'

function App() {
  const [page, setPage] = useState('dashboard')
  const [authMode, setAuthMode] = useState('login')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    } catch {
      return null
    }
  })
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [authLoading, setAuthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historySearch, setHistorySearch] = useState('')
const [historyFilter, setHistoryFilter] = useState('all')
const [historySort, setHistorySort] = useState('newest')
const [selectedHistoryItem, setSelectedHistoryItem] = useState(null)

  const saveSession = (accessToken, currentUser) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    setToken(accessToken)
    setUser(currentUser)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken('')
    setUser(null)
    setHistory([])
    setPage('dashboard')
  }

  const openPage = (nextPage) => {
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
 
  const downloadPredictionPDF = (item) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 18
    const contentWidth = pageWidth - margin * 2
    let y = 20

    const addText = (text, options = {}) => {
      const {
        size = 10,
        bold = false,
        color = [65, 75, 70],
        gap = 7,
      } = options

      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      doc.setTextColor(...color)

      const lines = doc.splitTextToSize(String(text), contentWidth)
      const requiredHeight = lines.length * (size * 0.45) + gap

      if (y + requiredHeight > pageHeight - 18) {
        doc.addPage()
        y = 20
      }

      doc.text(lines, margin, y)
      y += requiredHeight
    }

    const shap = item.shap_data
    const features = Array.isArray(shap?.features)
      ? shap.features
      : []

    addText('HealthAI', {
      size: 22,
      bold: true,
      color: [32, 61, 48],
      gap: 9,
    })

    addText('DIABETES PREDICTION REPORT', {
      size: 13,
      bold: true,
      color: [160, 120, 65],
    })

    addText(`Prediction ID: ${item.id}`, { bold: true })

    addText(
      `Date: ${
        item.created_at
          ? new Date(item.created_at).toLocaleString()
          : 'Not available'
      }`
    )

    addText('PREDICTION RESULT', {
      size: 13,
      bold: true,
      color: [32, 61, 48],
      gap: 8,
    })

    addText(
      `Result: ${
        String(item.prediction) === '1'
          ? 'Higher predicted diabetes probability'
          : 'Lower predicted diabetes probability'
      }`,
      { bold: true }
    )

    addText(
      `Predicted probability: ${
        item.probability == null
          ? 'Not available'
          : `${(Number(item.probability) * 100).toFixed(2)}%`
      }`
    )

    addText('INPUT MEASUREMENTS', {
      size: 13,
      bold: true,
      color: [32, 61, 48],
      gap: 8,
    })

    Object.entries(item.input_data || {}).forEach(([key, value]) => {
      const label = key.replace(/([a-z])([A-Z])/g, '$1 $2')
      addText(`${label}: ${value ?? 'Not available'}`)
    })

    addText('SHAP EXPLANATION', {
      size: 13,
      bold: true,
      color: [32, 61, 48],
      gap: 8,
    })

    if (shap && features.length > 0) {
      addText(`Base value: ${Number(shap.base_value).toFixed(4)}`)
      addText('Feature contributions:')

      features.forEach((feature) => {
        const name = feature.feature || 'Unknown feature'
        const value = Number(feature.input_value)
        const contribution = Number(feature.shap_value)

        addText(
          `${name} | Input: ${
            Number.isFinite(value) ? value : 'Not available'
          } | SHAP: ${
            Number.isFinite(contribution)
              ? contribution.toFixed(4)
              : 'Not available'
          } | ${
            feature.impact || 'Impact not available'
          }`
        )
      })

      // SHAP contribution chart
      addText('SHAP CONTRIBUTION CHART', {
        size: 13,
        bold: true,
        color: [32, 61, 48],
        gap: 5,
      })

      addText(
        'Green = positive contribution | Red = negative contribution',
        {
          size: 9,
          color: [100, 110, 105],
          gap: 8,
        }
      )

      const maxMagnitude = Math.max(
        ...features.map((feature) =>
          Math.abs(Number(feature.shap_value) || 0)
        ),
        0.000001
      )

      features.forEach((feature) => {
        const name = feature.feature || 'Unknown feature'
        const value = Number(feature.shap_value) || 0

        const labelLines = doc.splitTextToSize(
          name,
          contentWidth - 25
        )

        const rowHeight = labelLines.length * 4 + 10

        if (y + rowHeight > pageHeight - 18) {
          doc.addPage()
          y = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(45, 65, 55)
        doc.text(labelLines, margin, y)

        doc.setTextColor(
          value >= 0 ? 35 : 190,
          value >= 0 ? 130 : 75,
          value >= 0 ? 85 : 75
        )

        doc.text(
          `${value > 0 ? '+' : ''}${value.toFixed(4)}`,
          pageWidth - margin,
          y,
          { align: 'right' }
        )

        y += labelLines.length * 4 + 2

        // Background track
        doc.setFillColor(232, 236, 232)
        doc.roundedRect(
          margin,
          y,
          contentWidth,
          4,
          2,
          2,
          'F'
        )

        // Contribution bar
        const barWidth =
          (Math.abs(value) / maxMagnitude) * contentWidth

        doc.setFillColor(
          value >= 0 ? 57 : 199,
          value >= 0 ? 139 : 106,
          value >= 0 ? 98 : 101
        )

        if (barWidth > 0) {
          doc.roundedRect(
            margin,
            y,
            barWidth,
            4,
            2,
            2,
            'F'
          )
        }

        y += 10
      })
    } else {
      addText('SHAP explanation is not available for this record.')
    }

    addText('IMPORTANT DISCLAIMER', {
      size: 12,
      bold: true,
      color: [160, 100, 55],
      gap: 8,
    })

    addText(
      'This report is generated by an educational research prototype. It is not a medical diagnosis and must not replace professional medical advice. A lower model estimate does not rule out diabetes.'
    )

    addText('Generated by HealthAI - Explainable AI Research Project', {
      size: 9,
      color: [110, 120, 115],
    })

    doc.save(`HealthAI_Prediction_${item.id}.pdf`)
  }



  useEffect(() => {
    if (!token) return

    let cancelled = false

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired')
        return response.json()
      })
      .then((result) => {
        if (!cancelled && result.user) {
          setUser(result.user)
          localStorage.setItem(USER_KEY, JSON.stringify(result.user))
        }
      })
      .catch(() => {
        if (!cancelled) logout()
      })

    return () => {
      cancelled = true
    }
  }, [token])

 
useEffect(() => {
  if (!token || !['dashboard', 'history'].includes(page)) return

  let cancelled = false

  const loadHistory = async () => {
    setHistoryLoading(true)
    setHistoryError('')

    try {
      const response = await fetch(`${API_URL}/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'Could not load prediction history.'
        )
      }

      if (!cancelled) {
        setHistory(result.history || [])
      }
    } catch (error) {
      if (!cancelled) {
        setHistoryError(error.message)
      }
    } finally {
      if (!cancelled) {
        setHistoryLoading(false)
      }
    }
  }

  loadHistory()

  return () => {
    cancelled = true
  }
}, [page, token])


const filteredHistory = history
  .filter((item) => {
    const matchesSearch = String(item.id)
      .includes(historySearch.trim())

    const prediction = String(item.prediction)

    const matchesFilter =
      historyFilter === 'all' ||
      (historyFilter === 'higher' && prediction === '1') ||
      (historyFilter === 'lower' && prediction === '0')

    return matchesSearch && matchesFilter
  })
  .sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()

    return historySort === 'newest'
      ? dateB - dateA
      : dateA - dateB
  })
  const selectedShapFeatures = Array.isArray(
  selectedHistoryItem?.shap_data?.features
)
  ? selectedHistoryItem.shap_data.features
  : []

const maxShapMagnitude = Math.max(
  ...selectedShapFeatures.map((feature) =>
    Math.abs(Number(feature.shap_value) || 0)
  ),
  0.000001
)
  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    try {
      const isRegister = authMode === 'register'
      const endpoint = isRegister ? '/auth/register' : '/auth/login'

      const body = isRegister
        ? {
            name: authForm.name.trim(),
            email: authForm.email.trim(),
            password: authForm.password,
          }
        : {
            email: authForm.email.trim(),
            password: authForm.password,
          }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok) {
        const detail = result.detail
        throw new Error(
          Array.isArray(detail)
            ? detail.map((item) => item.msg).join(', ')
            : detail || 'Authentication failed.',
        )
      }

      if (isRegister) {
        setAuthMode('login')
        setAuthForm((previous) => ({ ...previous, password: '' }))
        setAuthError('Account created! Please log in with your credentials.')
        return
      }

      saveSession(result.access_token, result.user)
      setAuthForm({ name: '', email: '', password: '' })
      openPage('dashboard')
    } catch (error) {
      setAuthError(error.message || 'Unable to connect to the server.')
    } finally {
      setAuthLoading(false)
    }
  }

  const requireLogin = (destination) => {
    if (!token || !user) {
      setPage('auth')
      setAuthMode('login')
      setAuthError('Please log in to continue.')
      return
    }

    openPage(destination)
  }

  const nav = (
    <nav className="premium-nav">
      <button onClick={() => openPage('dashboard')}>Overview</button>
      {token && (
        <>
          <button onClick={() => requireLogin('assessment')}>Assessment</button>
          <button onClick={() => requireLogin('history')}>History</button>
        </>
      )}
      {!token ? (
        <button className="primary-btn" onClick={() => openPage('auth')}>
          Login / Register <span>↗</span>
        </button>
      ) : (
        <>
          <span className="welcome-user">Hi, {user?.name || 'User'}</span>
          <button className="primary-btn" onClick={logout}>Logout ↗</button>
        </>
      )}
    </nav>
  )

  if (page === 'auth') {
    return (
      <div className="app premium-app">
        <header className="navbar premium-navbar">
          <button className="brand premium-brand" onClick={() => openPage('dashboard')}>
            <span className="brand-mark">H</span>
            <span className="brand-copy">
              <strong>HealthAI</strong>
              <small>EXPLAINABLE HEALTH AI</small>
            </span>
          </button>
          {nav}
        </header>

        <main className="auth-page">
          <section className="auth-card">
            <span className="section-tag">YOUR HEALTHAI WORKSPACE</span>
            <h1>{authMode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
            <p>Sign in to run assessments and access your saved prediction history.</p>

            <div className="auth-switch">
              <button
                className={authMode === 'login' ? 'selected' : ''}
                onClick={() => { setAuthMode('login'); setAuthError('') }}
              >
                Login
              </button>
              <button
                className={authMode === 'register' ? 'selected' : ''}
                onClick={() => { setAuthMode('register'); setAuthError('') }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === 'register' && (
                <label>
                  Full name
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="Enter your name"
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  required
                  placeholder="you@example.com"
                />
              </label>

            <label>
  Password

  <div className="password-input-wrapper">
    <input
      type={showPassword ? 'text' : 'password'}
      value={authForm.password}
      onChange={(event) =>
        setAuthForm({ ...authForm, password: event.target.value })
      }
      minLength={authMode === 'register' ? 8 : 1}
      maxLength={128}
      required
      placeholder={
        authMode === 'register'
          ? 'At least 8 characters'
          : 'Enter your password'
      }
    />

    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowPassword((previous) => !previous)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      title={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? '🙈' : '👁️'}
    </button>
  </div>
</label>

              {authError && <p className="auth-message" role="alert">{authError}</p>}

              <button className="primary-btn auth-submit" disabled={authLoading}>
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Login to HealthAI →'
                    : 'Create account →'}
              </button>
            </form>

            <p className="auth-footnote">
              Research prototype only. This application does not provide a medical diagnosis.
            </p>
          </section>
        </main>
      </div>
    )
  }

  if (page === 'assessment') {
    return (
      <div className="dashboard-app">
        <aside className="sidebar">
          <button className="sidebar-brand" onClick={() => openPage('dashboard')}>
            <span className="brand-mark">H</span>
            <span className="sidebar-brand-copy">
              <strong>HealthAI</strong>
              <small>Explainable health AI</small>
            </span>
          </button>

          <p className="sidebar-section-title">WORKSPACE</p>
          <div className="sidebar-menu">
            <button className="sidebar-item" onClick={() => openPage('dashboard')}>⌂ <span>Overview</span></button>
            <button className="sidebar-item active">＋ <span>Diabetes assessment</span></button>
            <button className="sidebar-item" onClick={() => openPage('history')}>▤ <span>Prediction history</span></button>
          </div>

          <div className="sidebar-bottom">
            <div className="sidebar-help">
              <span>i</span>
              <div><strong>Research prototype</strong><p>Not a medical diagnosis.</p></div>
            </div>
            <button className="sidebar-item" onClick={logout}>↪ <span>Logout</span></button>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="assessment-topbar">
            <button className="back-button" onClick={() => openPage('dashboard')}>← Back to overview</button>
            <span className="welcome-user">{user?.name}</span>
          </div>
          <HealthAssessment token={token} />
        </main>
      </div>
    )
  }

  
  if (page === 'history') {
    return (
      <div className="app premium-app">
        <header className="navbar premium-navbar">
          <button
            className="brand premium-brand"
            onClick={() => openPage('dashboard')}
          >
            <span className="brand-mark">H</span>
            <span className="brand-copy">
              <strong>HealthAI</strong>
              <small>EXPLAINABLE HEALTH AI</small>
            </span>
          </button>
          {nav}
        </header>

        <main className="history-page">
          <span className="section-tag">PERSONAL WORKSPACE</span>
          <h1>Your prediction history</h1>
          <p className="history-intro">
            Review previous predictions, submitted measurements and saved SHAP explanations.
          </p>

          {historyLoading && <p>Loading your history...</p>}

{!historyLoading && !historyError && history.length > 0 && (
  <div className="history-toolbar">
    <input
      type="search"
      placeholder="Search by prediction ID..."
      value={historySearch}
      onChange={(event) => setHistorySearch(event.target.value)}
    />

    <select
      value={historyFilter}
      onChange={(event) => setHistoryFilter(event.target.value)}
    >
      <option value="all">All predictions</option>
      <option value="higher">Higher probability</option>
      <option value="lower">Lower probability</option>
    </select>

    <select
      value={historySort}
      onChange={(event) => setHistorySort(event.target.value)}
    >
      <option value="newest">Latest first</option>
      <option value="oldest">Oldest first</option>
    </select>
  </div>
)}


          {historyError && (
            <p className="auth-message" role="alert">
              {historyError}
            </p>
          )}

          {!historyLoading && !historyError && history.length === 0 && (
            <section className="empty-history">
              <h2>No predictions yet</h2>
              <p>Your completed assessments will appear here.</p>
              <button
                className="primary-btn"
                onClick={() => requireLogin('assessment')}
              >
                Start assessment →
              </button>
            </section>
          )}

          <div className="history-grid">
             {filteredHistory.map((item) => {
              const shap = item.shap_data
              const features = Array.isArray(shap?.features)
                ? shap.features
                : []

              const positive = features
                .filter((feature) => Number(feature.shap_value) > 0)
                .sort(
                  (a, b) =>
                    Number(b.shap_value) - Number(a.shap_value)
                )
                .slice(0, 3)

              const negative = features
                .filter((feature) => Number(feature.shap_value) < 0)
                .sort(
                  (a, b) =>
                    Number(a.shap_value) - Number(b.shap_value)
                )
                .slice(0, 3)

              return (
                <article className="history-card" key={item.id}>
                  <div className="history-card-top">
                    <span>Prediction #{item.id}</span>

                    <span
                      className={`risk-badge ${
                        String(item.prediction) === '1' ? 'high' : 'low'
                      }`}
                    >
                      Class {item.prediction}
                    </span>
                  </div>

                  <h2>
                    {item.probability == null
                      ? 'Probability unavailable'
                      : `${(Number(item.probability) * 100).toFixed(2)}% predicted probability`}
                  </h2>

                  <p>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : 'Date unavailable'}
                  </p>

                 <button
  className="history-view-btn"
  onClick={() => setSelectedHistoryItem(item)}
>
  View full details →
</button>

                  <button
                    className="primary-btn"
                    onClick={() => downloadPredictionPDF(item)}
                  >
                    Download PDF report ↓
                  </button>

                  <p className="history-disclaimer">
                    Research prototype only. Not a medical diagnosis.
                  </p>
                </article>
              )
            })}
            {!historyLoading && !historyError &&
  history.length > 0 && filteredHistory.length === 0 && (
    <p className="history-empty-result">
      No matching predictions found.
    </p>
)}
          </div>
          
{selectedHistoryItem && (
  <div
    className="history-modal-overlay"
    onClick={() => setSelectedHistoryItem(null)}
  >
    <section
      className="history-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="history-modal-header">
        <div>
          <span className="section-tag">PREDICTION REPORT</span>
          <h2 id="history-modal-title">
            Prediction #{selectedHistoryItem.id}
          </h2>
          <p>
            {selectedHistoryItem.created_at
              ? new Date(selectedHistoryItem.created_at).toLocaleString()
              : 'Date unavailable'}
          </p>
        </div>

        <button
          className="history-modal-close"
          onClick={() => setSelectedHistoryItem(null)}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className="history-modal-result">
        <span>
          {String(selectedHistoryItem.prediction) === '1'
            ? 'Higher predicted probability'
            : 'Lower predicted probability'}
        </span>

        <strong>
          {selectedHistoryItem.probability == null
            ? 'N/A'
            : `${(Number(selectedHistoryItem.probability) * 100).toFixed(2)}%`}
        </strong>

        <small>Class {selectedHistoryItem.prediction}</small>
      </div>

      <div className="history-modal-section">
        <h3>Input measurements</h3>

        <div className="history-modal-measurements">
          {Object.entries(selectedHistoryItem.input_data || {}).map(
            ([key, value]) => (
              <div key={key}>
                <span>
                  {key.replace(/([a-z])([A-Z])/g, '$1 $2')}
                </span>
                <strong>{value ?? 'Not available'}</strong>
              </div>
            )
          )}
        </div>
      </div>

      <div className="history-modal-section">
        <h3>SHAP explanation</h3>

        {Array.isArray(selectedHistoryItem.shap_data?.features) &&
        selectedHistoryItem.shap_data.features.length > 0 ? (
          <>
            <p className="history-modal-base">
              Base value:{' '}
              {Number(selectedHistoryItem.shap_data.base_value).toFixed(4)}
            </p>
            
<div className="shap-chart">
  <h4>Feature contribution chart</h4>

  <p className="shap-chart-note">
    Positive and negative SHAP contributions
  </p>

  {selectedShapFeatures.map((feature, index) => {
    const value = Number(feature.shap_value) || 0
    const percentage =
      (Math.abs(value) / maxShapMagnitude) * 100

    return (
      <div className="shap-chart-row" key={`${feature.feature}-${index}`}>
        <div className="shap-chart-label">
          <strong>
            {feature.feature.replace(/([a-z])([A-Z])/g, '$1 $2')}
          </strong>
          <span className={value >= 0 ? 'shap-positive' : 'shap-negative'}>
            {value > 0 ? '+' : ''}{value.toFixed(4)}
          </span>
        </div>

        <div className="shap-chart-track">
          <div
            className={`shap-chart-bar ${
              value >= 0 ? 'positive' : 'negative'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  })}
</div>

            <div className="history-modal-shap">
              {selectedHistoryItem.shap_data.features.map(
                (feature, index) => (
                  <div
                    className="history-modal-shap-item"
                    key={`${feature.feature}-${index}`}
                  >
                    <strong>
                      {feature.feature.replace(
                        /([a-z])([A-Z])/g,
                        '$1 $2'
                      )}
                    </strong>

                    <span>Input: {feature.input_value ?? 'N/A'}</span>

                    <span>
                      SHAP: {Number(feature.shap_value).toFixed(4)}
                    </span>

                    <small>{feature.impact}</small>
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <p>SHAP details are unavailable for this prediction.</p>
        )}
      </div>

      <p className="history-modal-disclaimer">
        Research prototype only. Not a medical diagnosis.
      </p>

      <button
        className="primary-btn history-modal-download"
        onClick={() => downloadPredictionPDF(selectedHistoryItem)}
      >
        Download PDF report ↓
      </button>
    </section>
  </div>
)}

          <div className="history-actions">
            <button
              className="primary-btn"
              onClick={() => requireLogin('assessment')}
            >
              New assessment →
            </button>

            <button className="secondary-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </main>
      </div>
    )
  }


  return (
    <div className="app premium-app">
      <header className="navbar premium-navbar">
        <button className="brand premium-brand" onClick={() => openPage('dashboard')}>
          <span className="brand-mark">H</span>
          <span className="brand-copy">
            <strong>HealthAI</strong>
            <small>EXPLAINABLE HEALTH AI</small>
          </span>
        </button>
        {nav}
      </header>

      <main>
        <section className="hero-section premium-hero" id="dashboard">
          <div className="hero-content premium-hero-content">
            <div className="eyebrow premium-eyebrow"><span /> MACHINE LEARNING · EXPLAINABLE AI</div>
            <h1>Intelligence you can<br /><strong>understand.</strong></h1>
            <p className="hero-text">
              Explore diabetes prediction through machine learning, with transparent explanations of the features influencing each model output.
            </p>

            <div className="hero-actions">
              <button className="primary-btn large-btn" onClick={() => requireLogin('assessment')}>
                {token ? 'Launch assessment' : 'Login to get started'} <span>→</span>
              </button>
              <button className="secondary-btn" onClick={() => openPage('history')}>
                Prediction history
              </button>
            </div>

            <div className="trust-row premium-trust-row">
              <div><span className="trust-icon">✓</span> ML prediction</div>
              <div><span className="trust-icon">✓</span> SHAP explanations</div>
              <div><span className="trust-icon">✓</span> Research project</div>
            </div>
          </div>

          <div className="health-card-wrapper premium-overview">
            <div className="health-card premium-model-card">
              <div className="card-top">
                <div><div className="small-label">MODEL OVERVIEW</div><h3>Diabetes prediction</h3></div>
                <span className="model-status"><i /> Research</span>
              </div>
              <div className="premium-model-visual">
                <div className="premium-model-symbol">H</div>
                <div><span className="result-label">EXPLAINABILITY ENGINE</span><h4>SHAP analysis</h4><p>Understand feature contributions.</p></div>
              </div>
             <div className="metrics premium-metrics">
  <div className="metric">
    <span>Total predictions</span>
    <strong>{historyLoading ? '...' : history.length}</strong>
  </div>

  <div className="metric">
    <span>Higher probability</span>
    <strong>
      {history.filter(item => String(item.prediction) === '1').length}
    </strong>
  </div>

  <div className="metric">
    <span>Lower probability</span>
    <strong>
      {history.filter(item => String(item.prediction) === '0').length}
    </strong>
  </div>

  <div className="metric">
    <span>Selected algorithm</span>
    <strong>Random Forest</strong>
  </div>

</div>
              <div className="explanation-box">
                <span className="explanation-icon">i</span>
                <div><strong>Clarity over black-box predictions</strong><p>SHAP explains model behaviour, not medical causation.</p></div>
              </div>
            </div>
            <div className="floating-note premium-floating-note"><span>✦</span> Prediction with explanations</div>
          </div>
        </section>

        <section className="features-section premium-section" id="assessment">
          <div className="section-heading premium-heading">
            <span>THE PLATFORM</span>
            <h2>Your research workspace</h2>
            <p>Log in to run assessments and review your saved predictions.</p>
          </div>
          <div className="feature-grid premium-feature-grid">
            <article className="feature-card premium-feature-card">
              <div className="premium-feature-top"><span className="feature-number">01</span><span className="premium-feature-icon">◈</span></div>
              <h3>Health measurements</h3><p>Eight numerical inputs power the diabetes prediction model.</p>
              <button className="feature-link" onClick={() => requireLogin('assessment')}>Open assessment →</button>
            </article>
            <article className="feature-card premium-feature-card">
              <div className="premium-feature-top"><span className="feature-number">02</span><span className="premium-feature-icon">⌁</span></div>
              <h3>Prediction history</h3><p>Review your saved predictions and submitted measurements.</p>
              <button className="feature-link" onClick={() => requireLogin('history')}>View history →</button>
            </article>
            <article className="feature-card premium-feature-card">
              <div className="premium-feature-top"><span className="feature-number">03</span><span className="premium-feature-icon">◎</span></div>
              <h3>Explainable AI</h3><p>SHAP contributions help explain the model output for each input.</p>
              <button className="feature-link" onClick={() => requireLogin('assessment')}>Explore model →</button>
            </article>
          </div>
        </section>

<section className="features-section premium-section" id="reports">
  <div className="section-heading premium-heading">
    <span>MODEL EVALUATION</span>
    <h2>Random Forest Performance</h2>
    <p>
      Results from the held-out test set. These metrics evaluate
      the model's performance and are not guarantees of clinical accuracy.
    </p>
  </div>

  <div className="feature-grid premium-metric-grid">
    <article className="feature-card premium-score-card">
      <span className="feature-number">01 / ACCURACY</span>
      <h3>74.68%</h3>
      <p>Overall correct classifications on the test set.</p>
    </article>

    <article className="feature-card premium-score-card">
      <span className="feature-number">02 / PRECISION</span>
      <h3>62.30%</h3>
      <p>Positive predictions that were actually positive.</p>
    </article>

    <article className="feature-card premium-score-card">
      <span className="feature-number">03 / RECALL</span>
      <h3>70.37%</h3>
      <p>Diabetes-positive cases detected by the model.</p>
    </article>

    <article className="feature-card premium-score-card">
      <span className="feature-number">04 / F1-SCORE</span>
      <h3>66.09%</h3>
      <p>Balance between precision and recall.</p>
    </article>

    <article className="feature-card premium-score-card">
      <span className="feature-number">05 / ROC-AUC</span>
      <h3>83.06%</h3>
      <p>Test-set measure of ranking discrimination.</p>
    </article>
  </div>

  <div className="premium-limitation">
    <span>!</span>
    <div>
      <strong>Know the limitations</strong>
      <p>
        The model missed 16 out of 54 positive cases in the held-out
        test set. A low prediction does not rule out diabetes.
        This project is for research and education, not medical diagnosis.
      </p>
    </div>
  </div>
</section>

      </main>

      <footer className="premium-footer">
        <div className="footer-brand"><span className="brand-mark">H</span><div><strong>HealthAI</strong><span>Diabetes prediction · Explainable AI</span></div></div>
        <p>Educational research prototype. Not a medical device or a substitute for professional medical advice.</p>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
      </footer>
    </div>
  )
}

export default App
