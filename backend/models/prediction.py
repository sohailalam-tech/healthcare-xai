# backend/models/prediction.py


def predict_health_risk(data):
    """
    Healthcare XAI prediction engine.

    This version provides:
    - Health risk score
    - Risk level
    - Detected symptoms
    - Possible disease predictions
    - Risk factors
    - Explainable reasoning

    NOTE:
    This is a prototype/rule-based AI engine.
    It is not a medical diagnosis system.
    """

    risk_score = 0
    risk_factors = []
    detected_symptoms = []
    disease_predictions = []

    # ==================================================
    # AGE
    # ==================================================

    age = data.get("age")

    if age is not None:
        try:
            age = float(age)

            if age >= 60:
                risk_score += 20
                risk_factors.append("Age is above 60")

            elif age >= 45:
                risk_score += 10
                risk_factors.append("Age is above 45")

        except (ValueError, TypeError):
            pass


    # ==================================================
    # BLOOD PRESSURE
    # ==================================================

    blood_pressure = data.get("bloodPressure")

    if blood_pressure:

        try:
            parts = str(blood_pressure).split("/")

            if len(parts) == 2:

                systolic = float(parts[0])
                diastolic = float(parts[1])

                if systolic >= 140 or diastolic >= 90:

                    risk_score += 20

                    risk_factors.append(
                        "Blood pressure is elevated"
                    )

                elif systolic >= 130 or diastolic >= 80:

                    risk_score += 10

                    risk_factors.append(
                        "Blood pressure is above the normal range"
                    )

        except (ValueError, TypeError):
            pass


    # ==================================================
    # BLOOD GLUCOSE
    # ==================================================

    glucose = data.get("bloodGlucose")

    if glucose is not None:

        try:

            glucose = float(glucose)

            if glucose >= 126:

                risk_score += 25

                risk_factors.append(
                    "Blood glucose is high"
                )

            elif glucose >= 100:

                risk_score += 10

                risk_factors.append(
                    "Blood glucose is above the normal range"
                )

        except (ValueError, TypeError):
            pass


    # ==================================================
    # HEART RATE
    # ==================================================

    heart_rate = data.get("heartRate")

    if heart_rate is not None:

        try:

            heart_rate = float(heart_rate)

            if heart_rate > 100:

                risk_score += 10

                risk_factors.append(
                    "Heart rate is elevated"
                )

            elif heart_rate < 50:

                risk_score += 10

                risk_factors.append(
                    "Heart rate is below the usual resting range"
                )

        except (ValueError, TypeError):
            pass


    # ==================================================
    # SMOKING
    # ==================================================

    smoking = str(
        data.get("smoking", "")
    ).lower()

    if smoking == "current":

        risk_score += 20

        risk_factors.append(
            "Current smoking status"
        )

    elif smoking == "former":

        risk_score += 5

        risk_factors.append(
            "Previous smoking history"
        )


    # ==================================================
    # PHYSICAL ACTIVITY
    # ==================================================

    activity = str(
        data.get("activity", "")
    ).lower()

    if activity == "low":

        risk_score += 10

        risk_factors.append(
            "Low physical activity"
        )


    # ==================================================
    # FAMILY HISTORY
    # ==================================================

    family_history = str(
        data.get("familyHistory", "")
    ).lower()

    if family_history in [
        "diabetes",
        "heart",
        "hypertension"
    ]:

        risk_score += 10

        risk_factors.append(
            "Relevant family medical history"
        )


    # ==================================================
    # SYMPTOM ANALYSIS
    # ==================================================

    symptoms = str(
        data.get("symptoms", "")
    ).strip().lower()


    symptom_keywords = {

        "chest pain": 20,

        "shortness of breath": 15,

        "breathing difficulty": 15,

        "dizziness": 10,

        "fainting": 15,

        "fatigue": 5,

        "excessive thirst": 10,

        "frequent urination": 10,

        "headache": 5,

        "blurred vision": 10,

        "nausea": 5,

        "vomiting": 5,

        "fever": 5,

        "cough": 5,

        "sore throat": 5,

        "weight loss": 10,

        "weight gain": 5,

        "swelling": 10,

        "palpitations": 10,

        "weakness": 5,

    }


    for keyword, points in symptom_keywords.items():

        if keyword in symptoms:

            risk_score += points

            detected_symptoms.append(keyword)


    if detected_symptoms:

        risk_factors.append(
            "Symptoms detected: "
            + ", ".join(detected_symptoms)
        )


    # ==================================================
    # DISEASE PREDICTION RULES
    # ==================================================

    # ------------------------------------------
    # Diabetes
    # ------------------------------------------

    diabetes_score = 0

    if glucose is not None:

        try:

            glucose_value = float(glucose)

            if glucose_value >= 126:
                diabetes_score += 60

            elif glucose_value >= 100:
                diabetes_score += 30

        except (ValueError, TypeError):
            pass


    if "excessive thirst" in detected_symptoms:
        diabetes_score += 20

    if "frequent urination" in detected_symptoms:
        diabetes_score += 20

    if "blurred vision" in detected_symptoms:
        diabetes_score += 15

    if "weight loss" in detected_symptoms:
        diabetes_score += 10

    if family_history == "diabetes":
        diabetes_score += 20


    if diabetes_score >= 40:

        disease_predictions.append({
            "disease": "Diabetes",
            "score": min(diabetes_score, 100),
            "reason": "Blood glucose and/or related symptoms indicate possible diabetes risk."
        })


    # ------------------------------------------
    # Hypertension
    # ------------------------------------------

    hypertension_score = 0

    if blood_pressure:

        try:

            parts = str(
                blood_pressure
            ).split("/")

            if len(parts) == 2:

                systolic = float(parts[0])
                diastolic = float(parts[1])

                if systolic >= 140 or diastolic >= 90:

                    hypertension_score += 70

                elif systolic >= 130 or diastolic >= 80:

                    hypertension_score += 40

        except (ValueError, TypeError):
            pass


    if "headache" in detected_symptoms:
        hypertension_score += 10

    if "dizziness" in detected_symptoms:
        hypertension_score += 10

    if family_history == "hypertension":
        hypertension_score += 20


    if hypertension_score >= 40:

        disease_predictions.append({
            "disease": "Hypertension",
            "score": min(hypertension_score, 100),
            "reason": "Blood pressure readings and related factors suggest possible hypertension risk."
        })


    # ------------------------------------------
    # Cardiovascular Risk
    # ------------------------------------------

    heart_score = 0

    if "chest pain" in detected_symptoms:
        heart_score += 40

    if "shortness of breath" in detected_symptoms:
        heart_score += 25

    if "breathing difficulty" in detected_symptoms:
        heart_score += 25

    if "palpitations" in detected_symptoms:
        heart_score += 20

    if "fainting" in detected_symptoms:
        heart_score += 20

    if heart_rate is not None:

        try:

            heart_value = float(heart_rate)

            if heart_value > 100:
                heart_score += 15

            elif heart_value < 50:
                heart_score += 15

        except (ValueError, TypeError):
            pass


    if smoking == "current":
        heart_score += 15

    if family_history == "heart":
        heart_score += 20


    if heart_score >= 40:

        disease_predictions.append({
            "disease": "Cardiovascular Risk",
            "score": min(heart_score, 100),
            "reason": "Symptoms and cardiovascular risk factors indicate possible cardiovascular risk."
        })


    # ------------------------------------------
    # Respiratory Risk
    # ------------------------------------------

    respiratory_score = 0

    if "shortness of breath" in detected_symptoms:
        respiratory_score += 35

    if "breathing difficulty" in detected_symptoms:
        respiratory_score += 35

    if "cough" in detected_symptoms:
        respiratory_score += 20

    if "sore throat" in detected_symptoms:
        respiratory_score += 10

    if smoking == "current":
        respiratory_score += 20


    if respiratory_score >= 40:

        disease_predictions.append({
            "disease": "Respiratory Condition",
            "score": min(respiratory_score, 100),
            "reason": "Respiratory symptoms and lifestyle factors indicate possible respiratory risk."
        })


    # ------------------------------------------
    # General Infection Risk
    # ------------------------------------------

    infection_score = 0

    if "fever" in detected_symptoms:
        infection_score += 40

    if "cough" in detected_symptoms:
        infection_score += 20

    if "sore throat" in detected_symptoms:
        infection_score += 20

    if "fatigue" in detected_symptoms:
        infection_score += 10

    if "weakness" in detected_symptoms:
        infection_score += 10


    if infection_score >= 40:

        disease_predictions.append({
            "disease": "Possible Infection",
            "score": min(infection_score, 100),
            "reason": "The reported symptoms may be consistent with an infectious condition."
        })


    # ==================================================
    # LIMIT RISK SCORE
    # ==================================================

    risk_score = min(risk_score, 100)


    # ==================================================
    # RISK LEVEL
    # ==================================================

    if risk_score >= 60:

        risk_level = "High risk"

    elif risk_score >= 30:

        risk_level = "Moderate risk"

    else:

        risk_level = "Low risk"


    # ==================================================
    # SORT DISEASE PREDICTIONS
    # ==================================================

    disease_predictions.sort(
        key=lambda x: x["score"],
        reverse=True
    )


    # ==================================================
    # EXPLANATION
    # ==================================================

    if risk_factors:

        explanation = (
            "The assessment identified the following factors: "
            + "; ".join(risk_factors)
            + "."
        )

    else:

        explanation = (
            "No major risk factors were identified "
            "from the information provided."
        )


    # ==================================================
    # FINAL RESULT
    # ==================================================

    return {

        "risk_score": risk_score,

        "risk_level": risk_level,

        "risk_factors": risk_factors,

        "detected_symptoms": detected_symptoms,

        "disease_predictions": disease_predictions,

        "explanation": explanation,

    }