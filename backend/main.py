
import io
import re
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageOps
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.diabetes_xai import predict_diabetes
from auth_routes import router as auth_router, get_current_user
from database import SessionLocal
from models_db import PredictionHistory, User


# ==========================================
# FASTAPI APP
# ==========================================

app = FastAPI(
    title="Healthcare XAI API",
    description="Diabetes Prediction API with Authentication and Report Extraction",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================
# CONFIGURATION
# ==========================================

MAX_REPORT_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg"}
MAX_PDF_PAGES = 10

# If Tesseract is not in PATH, uncomment and adjust this path:
# pytesseract.pytesseract.tesseract_cmd = (
#     r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# )


# ==========================================
# DIABETES INPUT MODEL
# ==========================================

class DiabetesData(BaseModel):
    pregnancies: int = Field(..., ge=0, le=30)
    glucose: float = Field(..., ge=0, le=500)
    bloodPressure: float = Field(..., ge=0, le=250)
    skinThickness: float = Field(..., ge=0, le=150)
    insulin: float = Field(..., ge=0, le=2000)
    bmi: float = Field(..., ge=0, le=100)
    diabetesPedigreeFunction: float = Field(..., ge=0, le=10)
    age: int = Field(..., ge=1, le=120)


# ==========================================
# REPORT TEXT EXTRACTION
# ==========================================

def extract_report_text(file_bytes: bytes, extension: str) -> str:
    """Extract selectable PDF text or use OCR for scanned pages/images."""

    text_parts = []

    try:
        if extension == ".pdf":
            with fitz.open(stream=file_bytes, filetype="pdf") as document:
                if document.page_count > MAX_PDF_PAGES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"PDF must contain no more than {MAX_PDF_PAGES} pages.",
                    )

                for page in document:
                    page_text = page.get_text("text").strip()

                    # OCR scanned pages with little or no selectable text.
                    if len(page_text) < 20:
                        pix = page.get_pixmap(
                            matrix=fitz.Matrix(2, 2),
                            alpha=False,
                        )
                        image = Image.open(
                            io.BytesIO(pix.tobytes("png"))
                        )
                        page_text = pytesseract.image_to_string(
                            ImageOps.grayscale(image),
                            config="--psm 6",
                        )

                    if page_text:
                        text_parts.append(page_text)

        else:
            image = Image.open(io.BytesIO(file_bytes))
            image = ImageOps.exif_transpose(image).convert("RGB")

            text = pytesseract.image_to_string(
                ImageOps.grayscale(image),
                config="--psm 6",
            )
            
           
            print("RAW OCR TEXT:")
            print(repr(text))
            
            text_parts.append(text)

    except HTTPException:
        raise
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=(
                "OCR engine not found. Install Tesseract OCR and "
                "ensure its executable is available in PATH."
            ),
        )
    except Exception as exc:
        print("Report extraction error:", repr(exc))
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not read this file. Check that it is a valid, "
                "unlocked PDF, JPG or JPEG."
            ),
        ) from exc

    return "\n".join(text_parts)


# ==========================================
# LABELED VALUE PARSING
# ==========================================

def find_labeled_number(
    text: str,
    labels: list[str],
    min_value: float,
    max_value: float,
):
    """
    Find a number on the same line as a matching label.
    Avoid filling values based on unrelated numbers elsewhere.
    """

    for line in text.splitlines():
        normalized = re.sub(r"\s+", " ", line).strip()

        if not normalized:
            continue

        for label in labels:
            pattern = (
                r"(?<![A-Za-z])"
                + label
                + r"(?![A-Za-z])"
                + r"\s*(?:[:=]|\s)\s*"
                + r"(-?\d+(?:\.\d+)?)"
            )

            match = re.search(pattern, normalized, re.IGNORECASE)

            if not match:
                continue

            try:
                value = float(match.group(1))
            except ValueError:
                continue

            if min_value <= value <= max_value:
                return int(value) if value.is_integer() else value

    return None


def extract_measurements(text: str) -> dict:
    """Return only explicitly labeled measurements found in the report."""

    normalized_text = text.replace("\u00a0", " ")

    data = {
        "Pregnancies": find_labeled_number(
            normalized_text,
            [r"number\s+of\s+pregnancies", r"pregnancies", r"gravidity"],
            0,
            30,
        ),
        "Glucose": find_labeled_number(
            normalized_text,
            [
                r"fasting\s+blood\s+glucose",
                r"fasting\s+glucose",
                r"blood\s+glucose",
                r"glucose\s+level",
                r"glucose",
            ],
            0,
            500,
        ),
        "BloodPressure": None,
        "SkinThickness": find_labeled_number(
            normalized_text,
            [r"skin\s+thickness", r"skinfold\s+thickness"],
            0,
            150,
        ),
        "Insulin": find_labeled_number(
            normalized_text,
            [r"serum\s+insulin", r"insulin\s+level", r"insulin"],
            0,
            2000,
        ),
        "BMI": find_labeled_number(
            normalized_text,
            [r"body\s+mass\s+index", r"\bBMI\b"],
            0,
            100,
        ),
        "DiabetesPedigreeFunction": find_labeled_number(
            normalized_text,
            [
                r"diabetes\s+pedigree\s+function",
                r"diabetes\s+pedigree\s+score",
            ],
            0,
            10,
        ),
        "Age": find_labeled_number(
            normalized_text,
            [r"patient\s+age", r"\bage\b"],
            1,
            120,
        ),
    }

    # Extract diastolic BP only when a clearly labeled BP reading
    # has the standard systolic/diastolic format, e.g. 120/80 mmHg.
    for line in normalized_text.splitlines():
        if not re.search(
            r"blood\s+pressure|\bBP\b|\bB\.P\.",
            line,
            re.IGNORECASE,
        ):
            continue

        match = re.search(
            r"(\d{2,3})\s*/\s*(\d{2,3})",
            line,
        )

        if match:
            diastolic = int(match.group(2))
            if 0 <= diastolic <= 250:
                data["BloodPressure"] = diastolic
                break

    return {
        key: value
        for key, value in data.items()
        if value is not None
    }


# ==========================================
# HOME & HEALTH CHECK
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Healthcare XAI API is running",
        "status": "online",
        "project": "Diabetes Prediction",
    }


@app.get("/health")
def health_check():
    return {
        "success": True,
        "status": "online",
        "service": "Healthcare XAI API",
    }


# ==========================================
# MEDICAL REPORT UPLOAD
# ==========================================

@app.post("/reports/extract")
async def extract_report(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    # Authentication is required. The endpoint does not save
    # the uploaded file to disk or store its contents in the database.
    del current_user

    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Only PDF, JPG and JPEG files are supported.",
        )

    content_type = (file.content_type or "").lower()

    if extension == ".pdf" and content_type != "application/pdf":
        raise HTTPException(
            status_code=415,
            detail="The selected PDF file has an unexpected content type.",
        )

    if extension in {".jpg", ".jpeg"} and content_type != "image/jpeg":
        raise HTTPException(
            status_code=415,
            detail="The selected image must be a JPEG file.",
        )

    try:
        file_bytes = await file.read(MAX_REPORT_SIZE + 1)
    finally:
        await file.close()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="The file is empty.")

    if len(file_bytes) > MAX_REPORT_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size must be 10 MB or less.",
        )

    # Check file signatures rather than trusting the extension alone.
    if extension == ".pdf" and not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not appear to be a valid PDF.",
        )

    if extension in {".jpg", ".jpeg"} and not file_bytes.startswith(
        b"\xff\xd8\xff"
    ):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not appear to be a valid JPEG.",
        )

    text = extract_report_text(file_bytes, extension)

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "No readable text was found. Try a clearer image or "
                "a PDF with selectable text."
            ),
        )

    measurements = extract_measurements(text)

    return {
        "success": True,
        "message": "Report processed. Verify extracted values before prediction.",
        "data": measurements,
        "fields_found": len(measurements),
        "fields_missing": [
            field
            for field in [
                "Pregnancies",
                "Glucose",
                "BloodPressure",
                "SkinThickness",
                "Insulin",
                "BMI",
                "DiabetesPedigreeFunction",
                "Age",
            ]
            if field not in measurements
        ],
        "disclaimer": (
            "Extracted values may be incomplete or incorrect. "
            "Verify every value before using the research model."
        ),
    }


# ==========================================
# DIABETES PREDICTION
# ==========================================

@app.post("/predict")
def predict(
    data: DiabetesData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = {
        "Pregnancies": data.pregnancies,
        "Glucose": data.glucose,
        "BloodPressure": data.bloodPressure,
        "SkinThickness": data.skinThickness,
        "Insulin": data.insulin,
        "BMI": data.bmi,
        "DiabetesPedigreeFunction": data.diabetesPedigreeFunction,
        "Age": data.age,
    }

    result = predict_diabetes(payload)

    probability_percent = result.get("predicted_probability_percent")
    probability_value = (
        float(probability_percent) / 100
        if probability_percent is not None
        else None
    )

   


    history = PredictionHistory(
        user_id=current_user.id,
        prediction=str(result["prediction"]),
        probability=probability_value,
        input_data=payload,
        shap_data=result.get("shap_explanation"),
    )

    db.add(history)
    db.commit()
    db.refresh(history)



    return {
        "success": True,
        "message": "Prediction completed and saved to history",
        "history_id": history.id,
        "data": result,
        "disclaimer": (
            "Research prototype only. This result is not a medical diagnosis."
        ),
    }


# ==========================================
# USER PREDICTION HISTORY
# ==========================================

@app.get("/history")
def get_prediction_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = (
        db.query(PredictionHistory)
        .filter(PredictionHistory.user_id == current_user.id)
        .order_by(PredictionHistory.created_at.desc())
        .all()
    )

    return {
        "success": True,
        "count": len(records),
        "history": [
            {
                "id": item.id,
                "prediction": item.prediction,
                "probability": item.probability,
                "input_data": item.input_data,
                "shap_data": item.shap_data,
                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
            }
            for item in records
        ],
    }
