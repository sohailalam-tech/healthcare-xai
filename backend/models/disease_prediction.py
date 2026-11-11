# backend/models/disease_prediction.py


def predict_diseases(data):
    """
    Initial disease-risk prediction module.

    This is a prototype rule-based engine.
    Later, it can be replaced with trained ML models.
    """

    results = []

    # -----------------------------------------
    # Diabetes Risk
    # -----------------------------------------

    diabetes_score = 0
    diabetes_factors = []

    glucose = data.get("bloodGlucose")
    age = data.get("age")
    family_history = str(
        data.get("familyHistory", "")
    ).lower()
    symptoms = str(
        data.get("symptoms", "")
    ).lower()

    try:
        if glucose is not None:
            glucose = float(glucose)

            if glucose >= 126:
                diabetes_score += 45
                diabetes_factors.append(
                    "Blood glucose is high"
                )

            elif glucose >= 100:
                diabetes_score += 20
                diabetes_factors.append(
                    "Blood glucose is above the normal range"
                )

    except (ValueError, TypeError):
        pass

    if family_history == "diabetes":
        diabetes_score += 20
        diabetes_factors.append(
            "Family history of diabetes"
        )

    if "excessive thirst" in symptoms:
        diabetes_score += 15
        diabetes_factors.append(
            "Excessive thirst reported"
        )

    if "frequent urination" in symptoms:
        diabetes_score += 15
        diabetes_factors.append(
            "Frequent urination reported"
        )

    if age is not None:
        try:
            if float(age) >= 45:
                diabetes_score += 10
                diabetes_factors.append(
                    "Age is 45 or above"
                )
        except (ValueError, TypeError):
            pass

    diabetes_score = min(diabetes_score, 100)

    if diabetes_score >= 60:
        diabetes_level = "High"
    elif diabetes_score >= 30:
        diabetes_level = "Moderate"
    else:
        diabetes_level = "Low"

    results.append({
        "disease": "Diabetes",
        "risk_score": diabetes_score,
        "risk_level": diabetes_level,
        "factors": diabetes_factors
    })


    # -----------------------------------------
    # Heart Disease Risk
    # -----------------------------------------

    heart_score = 0
    heart_factors = []

    blood_pressure = data.get(
        "bloodPressure"
    )

    heart_rate = data.get(
        "heartRate"
    )

    smoking = str(
        data.get("smoking", "")
    ).lower()

    family_history = str(
        data.get("familyHistory", "")
    ).lower()

    try:
        if blood_pressure:
            parts = str(
                blood_pressure
            ).split("/")

            if len(parts) == 2:
                systolic = float(parts[0])
                diastolic = float(parts[1])

                if systolic >= 140 or diastolic >= 90:
                    heart_score += 30
                    heart_factors.append(
                        "Blood pressure is elevated"
                    )

                elif systolic >= 130 or diastolic >= 80:
                    heart_score += 15
                    heart_factors.append(
                        "Blood pressure is above the normal range"
                    )

    except (ValueError, TypeError):
        pass

    try:
        if heart_rate is not None:
            heart_rate = float(heart_rate)

            if heart_rate > 100:
                heart_score += 15
                heart_factors.append(
                    "Heart rate is elevated"
                )

            elif heart_rate < 50:
                heart_score += 15
                heart_factors.append(
                    "Heart rate is below the usual resting range"
                )

    except (ValueError, TypeError):
        pass

    if smoking == "current":
        heart_score += 20
        heart_factors.append(
            "Current smoking status"
        )

    elif smoking == "former":
        heart_score += 5
        heart_factors.append(
            "Previous smoking history"
        )

    if family_history == "heart":
        heart_score += 20
        heart_factors.append(
            "Family history of heart disease"
        )

    if "chest pain" in symptoms:
        heart_score += 20
        heart_factors.append(
            "Chest pain reported"
        )

    if "shortness of breath" in symptoms:
        heart_score += 10
        heart_factors.append(
            "Shortness of breath reported"
        )

    heart_score = min(heart_score, 100)

    if heart_score >= 60:
        heart_level = "High"
    elif heart_score >= 30:
        heart_level = "Moderate"
    else:
        heart_level = "Low"

    results.append({
        "disease": "Heart Disease",
        "risk_score": heart_score,
        "risk_level": heart_level,
        "factors": heart_factors
    })


    # -----------------------------------------
    # Respiratory / Lung Risk
    # -----------------------------------------

    lung_score = 0
    lung_factors = []

    if smoking == "current":
        lung_score += 30
        lung_factors.append(
            "Current smoking status"
        )

    elif smoking == "former":
        lung_score += 10
        lung_factors.append(
            "Previous smoking history"
        )

    if "shortness of breath" in symptoms:
        lung_score += 25
        lung_factors.append(
            "Shortness of breath reported"
        )

    if "breathing difficulty" in symptoms:
        lung_score += 25
        lung_factors.append(
            "Breathing difficulty reported"
        )

    if "cough" in symptoms:
        lung_score += 15
        lung_factors.append(
            "Cough reported"
        )

    if "chest pain" in symptoms:
        lung_score += 10
        lung_factors.append(
            "Chest pain reported"
        )

    lung_score = min(lung_score, 100)

    if lung_score >= 60:
        lung_level = "High"
    elif lung_score >= 30:
        lung_level = "Moderate"
    else:
        lung_level = "Low"

    results.append({
        "disease": "Respiratory Risk",
        "risk_score": lung_score,
        "risk_level": lung_level,
        "factors": lung_factors
    })


    # -----------------------------------------
    # Final response
    # -----------------------------------------

    return results