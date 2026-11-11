
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from sklearn.ensemble import RandomForestClassifier


# ==========================================
# PATHS AND CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "pima_raw.csv"
MODEL_PATH = BASE_DIR / "data" / "diabetes_model.joblib"

FEATURES = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]

MISSING_MEASUREMENTS = [
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
]


# ==========================================
# LOAD TRAINED RANDOM FOREST PIPELINE
# ==========================================

model = joblib.load(MODEL_PATH)

imputer = model.named_steps["imputer"]
scaler = model.named_steps["scaler"]
classifier = model.named_steps["classifier"]

if not isinstance(classifier, RandomForestClassifier):
    raise TypeError(
        "The saved pipeline does not contain a Random Forest classifier."
    )


# ==========================================
# PREPARE SHAP BACKGROUND DATA
# ==========================================

df = pd.read_csv(
    DATA_PATH,
    header=None,
    names=FEATURES + ["Outcome"],
)

background = df[FEATURES].copy()

background[MISSING_MEASUREMENTS] = (
    background[MISSING_MEASUREMENTS].replace(0, np.nan)
)

background_imputed = imputer.transform(background)
background_scaled = scaler.transform(background_imputed)

# Use a representative subset as SHAP background.
background_sample = background_scaled[:100]

explainer = shap.TreeExplainer(
    classifier,
    data=background_sample,
    feature_perturbation="interventional",
    model_output="probability",
)


# ==========================================
# SHAP OUTPUT HELPER
# ==========================================

def get_positive_class_explanation(explanation):
    """Extract SHAP values and base value for class 1."""

    values = explanation.values
    base_values = explanation.base_values

    # Handle SHAP versions returning a list per class.
    if isinstance(values, list):
        shap_values = np.asarray(values[1])[0]

    else:
        values = np.asarray(values)

        if values.ndim == 3:
            # Shape: samples x features x classes
            shap_values = values[0, :, 1]

        elif values.ndim == 2:
            # Shape: samples x features
            shap_values = values[0]

        else:
            raise ValueError(
                f"Unexpected SHAP values shape: {values.shape}"
            )

    if isinstance(base_values, list):
        base_value = float(np.asarray(base_values[1]).reshape(-1)[0])

    else:
        base_values = np.asarray(base_values)

        if base_values.ndim == 2:
            base_value = float(base_values[0, 1])

        elif base_values.ndim == 1 and base_values.size > 1:
            base_value = float(base_values[1])

        else:
            base_value = float(base_values.reshape(-1)[0])

    return shap_values, base_value


# ==========================================
# DIABETES PREDICTION
# ==========================================

def predict_diabetes(data: dict) -> dict:

    row = pd.DataFrame(
        [[data[feature] for feature in FEATURES]],
        columns=FEATURES,
    )

    # Treat medically invalid zero measurements as missing.
    row[MISSING_MEASUREMENTS] = (
        row[MISSING_MEASUREMENTS].replace(0, np.nan)
    )

    # Predict using the complete saved pipeline.
    probability = float(model.predict_proba(row)[0][1])
    prediction = int(probability >= 0.5)

    # Prepare input for SHAP.
    imputed_row = imputer.transform(row)
    scaled_row = scaler.transform(imputed_row)

    # Explain the positive-class probability.
    explanation = explainer(scaled_row)

    shap_values, base_value = get_positive_class_explanation(
        explanation
    )

    contributions = []

    for feature, value, shap_value in zip(
        FEATURES,
        row.iloc[0].values,
        shap_values,
    ):
        contributions.append({
            "feature": feature,
            "input_value": (
                None if pd.isna(value) else float(value)
            ),
            "shap_value": float(shap_value),
            "impact": (
                "increases predicted probability"
                if shap_value > 0
                else "decreases predicted probability"
                if shap_value < 0
                else "neutral"
            ),
        })

    contributions.sort(
        key=lambda item: abs(item["shap_value"]),
        reverse=True,
    )

    return {
        "prediction": prediction,
        "prediction_label": (
            "Higher predicted diabetes probability"
            if prediction == 1
            else "Lower predicted diabetes probability"
        ),
        "predicted_probability_percent": round(
            probability * 100, 2
        ),
        "threshold": 0.5,
        "shap_explanation": {
            "output_type": "probability",
            "base_value": base_value,
            "features": contributions,
        },
        "disclaimer": (
            "Research prototype only. This prediction is not "
            "a medical diagnosis or a substitute for clinical advice."
        ),
    }
