
import { useState } from 'react'
import './HealthAssessment.css'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const fields = [
  { name: 'pregnancies', label: 'Pregnancies', unit: 'Count', min: 0, max: 30, step: 1 },
  { name: 'glucose', label: 'Glucose', unit: 'mg/dL', min: 0, max: 500, step: 1 },
  { name: 'bloodPressure', label: 'Blood Pressure', unit: 'mmHg (diastolic)', min: 0, max: 250, step: 1 },
  { name: 'skinThickness', label: 'Skin Thickness', unit: 'mm', min: 0, max: 150, step: 1 },
  { name: 'insulin', label: 'Insulin', unit: 'mu U/mL', min: 0, max: 2000, step: 1 },
  { name: 'bmi', label: 'BMI', unit: 'kg/m²', min: 0, max: 100, step: 0.1 },
  { name: 'diabetesPedigreeFunction', label: 'Diabetes Pedigree Function', unit: 'Dataset score', min: 0, max: 10, step: 0.01 },
  { name: 'age', label: 'Age', unit: 'Years', min: 1, max: 120, step: 1 },
]

const initialForm = Object.fromEntries(
  fields.map((field) => [field.name, ''])
)

const reportMapping = {
  Pregnancies: 'pregnancies',
  Glucose: 'glucose',
  BloodPressure: 'bloodPressure',
  SkinThickness: 'skinThickness',
  Insulin: 'insulin',
  BMI: 'bmi',
  DiabetesPedigreeFunction: 'diabetesPedigreeFunction',
  Age: 'age',
}

function HealthAssessment({ token }) {
  const [formData, setFormData] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [error, setError] = useState('')

  const [selectedFile, setSelectedFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [reportError, setReportError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleReportUpload = async () => {
    setReportMessage('')
    setReportError('')

    if (!selectedFile) {
      setReportError('Please select a PDF, JPG or JPEG report.')
      return
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
    ]

    const extensionAllowed = /\.(pdf|jpe?g)$/i.test(selectedFile.name)

    if (
      !extensionAllowed ||
      !allowedTypes.includes(selectedFile.type)
    ) {
      setReportError('Only valid PDF, JPG or JPEG files are supported.')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setReportError('File size must be 10 MB or less.')
      return
    }

    if (!token) {
      setReportError('Please log in again before uploading a report.')
      return
    }

    const uploadData = new FormData()
    uploadData.append('file', selectedFile)

    setExtracting(true)

    try {
      const response = await fetch(`${API_URL}/reports/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'Report extraction failed. Please try another report.'
        )
      }

      const extracted = result.data || {}
      const updates = {}

      for (const [apiName, formName] of Object.entries(reportMapping)) {
        const value = extracted[apiName] ?? extracted[formName]

        if (
          value !== undefined &&
          value !== null &&
          value !== '' &&
          Number.isFinite(Number(value))
        ) {
          const number = Number(value)
          const field = fields.find((item) => item.name === formName)

          if (field && number >= field.min && number <= field.max) {
            updates[formName] = String(number)
          }
        }
      }

      setFormData((previous) => ({ ...previous, ...updates }))
      setPrediction(null)

      if (Object.keys(updates).length > 0) {
        setReportMessage(
          `${Object.keys(updates).length} value(s) extracted. Please verify every field before predicting.`
        )
      } else {
        setReportMessage(
          'No matching values were found. Enter the measurements manually.'
        )
      }
    } catch (err) {
      setReportError(
        err.message || 'Unable to read the report. Please try again.'
      )
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setPrediction(null)

    if (!token) {
      setError('Your session may have expired. Please log in again.')
      return
    }

    const payload = {}

    for (const field of fields) {
      const value = formData[field.name]

      if (value.trim() === '') {
        setError(`Please enter ${field.label}.`)
        return
      }

      const number = Number(value)

      if (
        !Number.isFinite(number) ||
        number < field.min ||
        number > field.max
      ) {
        setError(
          `${field.label} must be between ${field.min} and ${field.max}.`
        )
        return
      }

      payload[field.name] = number
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        const detail = result.detail

        throw new Error(
          Array.isArray(detail)
            ? detail.map((item) => item.msg).join(', ')
            : typeof detail === 'string'
              ? detail
              : 'The server could not process your request.'
        )
      }

      if (!result.success || !result.data) {
        throw new Error(
          result.message || 'Prediction could not be generated.'
        )
      }

      setPrediction(result.data)
    } catch (err) {
      console.error('Prediction error:', err)
      setError(
        err.message ||
          'Unable to connect. Check whether the backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialForm)
    setPrediction(null)
    setError('')
    setSelectedFile(null)
    setReportMessage('')
    setReportError('')
  }

  const features = prediction?.shap_explanation?.features || []

  const maxImpact = Math.max(
    0.000001,
    ...features.map((item) => Math.abs(Number(item.shap_value) || 0))
  )

  const formatName = (name) =>
    name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (character) => character.toUpperCase())


  const positiveDrivers = [...features]
    .filter((item) => Number(item.shap_value) > 0)
    .sort((a, b) => Number(b.shap_value) - Number(a.shap_value))
    .slice(0, 3)

  const negativeDrivers = [...features]
    .filter((item) => Number(item.shap_value) < 0)
    .sort((a, b) => Number(a.shap_value) - Number(b.shap_value))
    .slice(0, 3)

  const positiveText = positiveDrivers
    .map((item) => formatName(item.feature))
    .join(', ')

  const negativeText = negativeDrivers
    .map((item) => formatName(item.feature))
    .join(', ')


  return (
    <div className="assessment-page">
      <div className="assessment-header">
        <div>
          <span className="card-label">
            HEALTHCARE XAI · DIABETES MODEL
          </span>
          <h1>Diabetes prediction</h1>
          <p>
            Enter measurements manually or upload a report to
            pre-fill available values. Review all values before
            generating a prediction.
          </p>
        </div>

        <div className="assessment-step">
          <span>MODEL INPUTS</span>
          <strong>08 FEATURES</strong>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <section className="assessment-card report-upload-card">
          <div className="assessment-section-heading">
            <div className="section-number">01</div>
            <div>
              <h2>Upload medical report</h2>
              <p>
                Supported formats: PDF, JPG and JPEG. Maximum size: 10 MB.
              </p>
            </div>
          </div>

          <label htmlFor="medical-report">Choose your report</label>
          <input
            id="medical-report"
            type="file"
            accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null)
              setReportMessage('')
              setReportError('')
            }}
          />

          {selectedFile && (
            <p className="report-file-name">
              Selected: {selectedFile.name}
            </p>
          )}

          <button
            type="button"
            className="secondary-btn"
            onClick={handleReportUpload}
            disabled={extracting || !selectedFile}
          >
            {extracting ? 'Reading report...' : 'Extract values from report'}
          </button>

          {reportMessage && (
            <p role="status" aria-live="polite">
              {reportMessage}
            </p>
          )}

          {reportError && (
            <p className="prediction-error" role="alert">
              {reportError}
            </p>
          )}

          <p className="shap-note">
            Extracted values may be incomplete or incorrect. Check every
            field and enter missing values manually before continuing.
          </p>
        </section>

        <section className="assessment-card">
          <div className="assessment-section-heading">
            <div className="section-number">02</div>
            <div>
              <h2>Health measurements</h2>
              <p>
                Type the available measurements directly into the fields.
              </p>
            </div>
          </div>

          <div className="assessment-grid">
            {fields.map((field) => (
              <div className="assessment-field" key={field.name}>
                <label htmlFor={field.name}>
                  {field.label} <span>*</span>
                </label>

                <input
                  id={field.name}
                  type="number"
                  name={field.name}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={formData[field.name]}
                  onChange={handleChange}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  required
                />

                <small>{field.unit}</small>
              </div>
            ))}
          </div>

          <div className="optional-note">
            <span>i</span>
            <p>
              Enter actual measurements when available. Do not guess missing
              medical values; the model requires all eight inputs.
            </p>
          </div>
        </section>

        {error && (
          <div className="prediction-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        <div className="assessment-actions">
          <div className="privacy-message">
            <span>✓</span>
            <p>Your inputs are sent to the configured prediction API.</p>
          </div>

          <button
            type="submit"
            className="assessment-submit"
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Predict diabetes'}
            <span>{loading ? '...' : '→'}</span>
          </button>
        </div>
      </form>

      {prediction && (
        <section className="prediction-result-card">
          <div className="prediction-result-header">
            <div>
              <span className="card-label">MODEL OUTPUT</span>
              <h2>Prediction results</h2>
            </div>

            <div
              className={`risk-badge ${
                prediction.prediction === 1 ? 'high' : 'low'
              }`}
            >
              Class {prediction.prediction}
            </div>
          </div>

          <div className="prediction-result-grid">
            <div className="prediction-score">
              <span>PREDICTED PROBABILITY</span>
              <strong>
                {Number(
                  prediction.predicted_probability_percent ?? 0
                ).toFixed(2)}%
              </strong>

              <div className="probability-track">
                <div
                  className="probability-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Number(prediction.predicted_probability_percent) || 0
                      )
                    )}%`,
                  }}
                />
              </div>

              <small>
                Classification threshold:{' '}
                {(prediction.threshold ?? 0.5) * 100}%
              </small>
            </div>

            <div className="prediction-explanation">
              <span>MODEL CLASSIFICATION</span>
              <h3>{prediction.prediction_label}</h3>
              <p>
                This is a model-generated estimate, not a confirmed diagnosis.
              </p>
            </div>
          </div>

          <div className="shap-section">
            <div className="assessment-section-heading">
              <div className="section-number">03</div>
              <div>
                <h2>Why did the model predict this?</h2>
                <p>
                  SHAP feature contributions, ordered by absolute impact
                  on model output.
                </p>
              </div>
            </div>

            <div className="shap-legend">
              <span>
                <i className="shap-dot negative" />
                Decreases model output
              </span>
              <span>
                <i className="shap-dot positive" />
                Increases model output
              </span>
            </div>

            {features.map((item) => {
              const value = Number(item.shap_value) || 0
              const positive = value > 0
              const width = (Math.abs(value) / maxImpact) * 100

              return (
                <div className="shap-row" key={item.feature}>
                  <div className="shap-row-heading">
                    <strong>{formatName(item.feature)}</strong>
                    <span>
                      {value > 0 ? '+' : ''}
                      {value.toFixed(4)}
                    </span>
                  </div>

                  <div className="shap-track">
                    <div
                      className={`shap-bar ${
                        positive ? 'positive' : 'negative'
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  <small>
                    Input value: {item.input_value ?? 'Not available'} ·{' '}
                    {item.impact}
                  </small>
                </div>
              )
            })}


  <div className="shap-narrative">
    <h3>What influenced this prediction?</h3>

    {positiveDrivers.length > 0 ? (
      <p>
        <strong>{positiveText}</strong>
        {' '}had the strongest positive contributions to the
        model output, meaning these features increased the
        predicted probability for this individual assessment.
      </p>
    ) : (
      <p>No positive feature contributions were identified.</p>
    )}

    {negativeDrivers.length > 0 && (
      <p>
        <strong>{negativeText}</strong>
        {' '}contributed negatively, meaning these features
        decreased the model output.
      </p>
    )}

    <small>
      This explanation describes model behaviour, not medical
      causation or a confirmed diagnosis.
    </small>
  </div>


           
<p className="shap-note">
  SHAP values represent contributions to the model's predicted
  probability output. Positive values increase the model output,
  while negative values decrease it. These contributions explain
  model behaviour, not medical causes.
</p>

          </div>

          <div className="prediction-disclaimer">
            <strong>Research prototype only</strong>
            <p>
              This result is not a medical diagnosis and must not replace
              professional medical advice. A low model estimate does not
              rule out diabetes.
            </p>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={resetForm}
          >
            Start a new assessment
          </button>
        </section>
      )}
    </div>
  )
}

export default HealthAssessment
