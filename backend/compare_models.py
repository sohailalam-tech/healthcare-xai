
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.base import clone
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import (
    train_test_split,
    StratifiedKFold,
    cross_validate,
)
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier


# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "pima_raw.csv"
OUTPUT_DIR = BASE_DIR / "data" / "model_comparison"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42

# Load the original dataset
df = pd.read_csv(DATA_PATH, header=None)
df.columns = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
    "Outcome",
]

target_column = "Outcome"
if target_column not in df.columns:
    raise ValueError(
        f"Target column '{target_column}' not found. "
        f"Available columns: {list(df.columns)}"
    )

X = df.drop(columns=[target_column]).copy()
y = df[target_column].astype(int)

# Replace medically invalid zero values with missing values.
# Zero pregnancies is valid, so it is retained.
for column in [
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
]:
    if column in X.columns:
        X[column] = X[column].replace(0, np.nan)

# Keep the test set untouched until final evaluation.
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    stratify=y,
    random_state=RANDOM_STATE,
)

# Compare five classifiers.
models = {
    "Logistic Regression": LogisticRegression(
        max_iter=2000,
        random_state=RANDOM_STATE,
    ),
    "Decision Tree": DecisionTreeClassifier(
        random_state=RANDOM_STATE,
        class_weight="balanced",
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=300,
        random_state=RANDOM_STATE,
        class_weight="balanced",
        n_jobs=-1,
    ),
    "SVM": SVC(
        probability=True,
        random_state=RANDOM_STATE,
        class_weight="balanced",
    ),
    "XGBoost": XGBClassifier(
        n_estimators=300,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=RANDOM_STATE,
        n_jobs=1,
    ),
}

# All preprocessing is fitted inside each training fold.
def make_pipeline(classifier):
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("classifier", clone(classifier)),
    ])


cv = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=RANDOM_STATE,
)

scoring = {
    "accuracy": "accuracy",
    "precision": "precision",
    "recall": "recall",
    "f1": "f1",
    "roc_auc": "roc_auc",
}

cv_rows = []
test_rows = []

print("\nHealthcare XAI - 5 Model Comparison")
print("=" * 55)
print(f"Dataset rows: {len(df)}")
print(f"Training rows: {len(X_train)}")
print(f"Test rows: {len(X_test)}")
print("\nRunning stratified 5-fold cross-validation...\n")

for name, classifier in models.items():
    print(f"Evaluating {name}...")

    pipeline = make_pipeline(classifier)

    scores = cross_validate(
        pipeline,
        X_train,
        y_train,
        cv=cv,
        scoring=scoring,
        n_jobs=1,
        error_score="raise",
    )

    cv_row = {"Model": name}
    for metric in scoring:
        values = scores[f"test_{metric}"]
        cv_row[f"{metric.capitalize()}_mean"] = values.mean()
        cv_row[f"{metric.capitalize()}_std"] = values.std()

    cv_rows.append(cv_row)

    # Fit on the complete training split and evaluate once on test data.
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    probabilities = pipeline.predict_proba(X_test)[:, 1]

        # Fit on the complete training split and evaluate once on test data.
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    probabilities = pipeline.predict_proba(X_test)[:, 1]

    # Calculate confusion matrix with fixed class order.
    tn, fp, fn, tp = confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1]
    ).ravel()

    test_rows.append({
        "Model": name,
        "Accuracy": accuracy_score(y_test, predictions),
        "Precision": precision_score(
            y_test, predictions, zero_division=0
        ),
        "Recall": recall_score(
            y_test, predictions, zero_division=0
        ),
        "F1": f1_score(
            y_test, predictions, zero_division=0
        ),
        "ROC_AUC": roc_auc_score(y_test, probabilities),
        "TN": int(tn),
        "FP": int(fp),
        "FN": int(fn),
        "TP": int(tp),
    })
cv_results = pd.DataFrame(cv_rows).sort_values(
    "Roc_auc_mean", ascending=False
)
test_results = pd.DataFrame(test_rows).sort_values(
    "ROC_AUC", ascending=False
)

cv_path = OUTPUT_DIR / "cross_validation_results.csv"
test_path = OUTPUT_DIR / "test_set_results.csv"

cv_results.to_csv(cv_path, index=False)
test_results.to_csv(test_path, index=False)

pd.set_option("display.max_columns", None)
pd.set_option("display.width", 180)

print("\n\nCROSS-VALIDATION RESULTS (mean scores)")
print("=" * 85)
print(cv_results.round(4).to_string(index=False))

print("\n\nHELD-OUT TEST RESULTS")
print("=" * 85)
print(test_results.round(4).to_string(index=False))

print("\n\nResults saved to:")
print(cv_path)
print(test_path)

print(
    "\nImportant: Use these results to compare models, "
    "not as proof of clinical suitability. "
    "The test set should not be used to tune model settings."
)
