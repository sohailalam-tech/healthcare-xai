
from pathlib import Path
import shutil
import joblib
import numpy as np
import pandas as pd

from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier


# ==========================================
# PATH CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "pima_raw.csv"
MODEL_PATH = BASE_DIR / "data" / "diabetes_model.joblib"
BACKUP_PATH = BASE_DIR / "data" / "diabetes_model_logistic_backup.joblib"

RANDOM_STATE = 42

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
# LOAD DATASET
# ==========================================

print("\nHealthcare XAI - Random Forest Training")
print("=" * 50)

df = pd.read_csv(
    DATA_PATH,
    header=None,
    names=FEATURES + ["Outcome"]
)

X = df[FEATURES].copy()
y = df["Outcome"].astype(int)

# Replace medically invalid zero measurements with NaN.
X[MISSING_MEASUREMENTS] = (
    X[MISSING_MEASUREMENTS].replace(0, np.nan)
)

print("Dataset rows:", len(df))
print("Features:", len(FEATURES))


# ==========================================
# BUILD RANDOM FOREST PIPELINE
# ==========================================

model = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),

    ("scaler", StandardScaler()),

    ("classifier", RandomForestClassifier(
        n_estimators=300,
        random_state=RANDOM_STATE,
        class_weight="balanced",
        n_jobs=-1
    ))
])


# ==========================================
# BACKUP EXISTING MODEL
# ==========================================

if MODEL_PATH.exists() and not BACKUP_PATH.exists():
    shutil.copy2(MODEL_PATH, BACKUP_PATH)
    print("\nExisting model backup created.")

elif BACKUP_PATH.exists():
    print("\nExisting backup already present.")


# ==========================================
# TRAIN FINAL MODEL
# ==========================================

print("\nTraining Random Forest on full dataset...")

model.fit(X, y)

# Verify probability prediction works.
sample_probability = model.predict_proba(X.iloc[:1])[0][1]

if not np.isfinite(sample_probability):
    raise ValueError("Model probability verification failed.")

# Save trained pipeline.
joblib.dump(model, MODEL_PATH)

# Verify saved model can be loaded.
loaded_model = joblib.load(MODEL_PATH)

if not hasattr(loaded_model, "predict_proba"):
    raise ValueError("Saved model is missing predict_proba().")

print("\nTraining completed successfully!")
print("Model:", "Random Forest")
print("Estimators:", 300)
print("Training records:", len(X))
print("Sample probability:", round(sample_probability * 100, 2), "%")
print("Saved model:", MODEL_PATH)
print("Backup model:", BACKUP_PATH)

print("\nNote: This model is a research prototype,")
print("not clinically validated for medical diagnosis.")
