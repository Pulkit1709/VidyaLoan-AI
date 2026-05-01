from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import openai
import os
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="VidyaLoan AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai.api_key = os.getenv("OPENAI_API_KEY")

university_data = {
    "MIT": {
        "Computer Science": {
            "avg_salary": 127000,
            "placement_rate": 0.95,
            "roi_years": 4.2
        }
    },
    "Stanford": {
        "Computer Science": {
            "avg_salary": 120000,
            "placement_rate": 0.92,
            "roi_years": 4.5
        }
    },
    "IIT Delhi": {
        "Computer Science": {
            "avg_salary": 85000,
            "placement_rate": 0.89,
            "roi_years": 5.1
        }
    },
}

class StartRequest(BaseModel):
    initial: str
    user_id: Optional[str] = "default"

class AnswerRequest(BaseModel):
    answer: str
    user_id: Optional[str] = "default"

user_states = {}

def calculate_eligibility(age, family_income, cgpa, co_signer_income=0, loan_amount=0):
    score = (family_income / 100000 * 20 + cgpa * 10 + (30 - age) * 2 + co_signer_income / 100000 * 10) - loan_amount / 100000 * 5
    score = min(100, max(0, score))
    return score

def get_roi(university, course):
    return university_data.get(university, {}).get(course, {})

def simulate_repayment(loan_amount, interest_rate=0.08, tenure=10, salary=100000):
    if salary == 0:
        return {"monthly_payment": 0, "loan_to_income_ratio": 0}
    monthly_payment = loan_amount * (interest_rate / 12) * (1 + interest_rate / 12)**(tenure*12) / ((1 + interest_rate / 12)**(tenure*12) - 1)
    loan_to_income = monthly_payment / (salary / 12)
    return {"monthly_payment": round(monthly_payment, 2), "loan_to_income_ratio": round(loan_to_income, 2)}

@app.post("/start")
async def start_interview(request: StartRequest):
    words = request.initial.lower().split()
    university = "MIT"
    course = "Computer Science"
    if "mit" in words:
        university = "MIT"
    if "stanford" in words:
        university = "Stanford"
    if "iit" in words or "delhi" in words:
        university = "IIT Delhi"
    if "cs" in words or "computer" in words:
        course = "Computer Science"
    
    user_states[request.user_id] = {
        "info": {"university": university, "course": course},
        "questions_asked": 0,
        "questions": [
            "What is your age?",
            "What is your family's annual income (in rupees)?",
            "What is your CGPA?",
            "Does your co-signer have annual income? If yes, how much (in rupees)?",
            "How much loan amount do you need (in rupees)?"
        ]
    }
    return {"type": "question", "message": f"Great! Studying {course} at {university}. Let's assess your eligibility. {user_states[request.user_id]['questions'][0]}"}

@app.post("/answer")
async def answer_question(request: AnswerRequest):
    if request.user_id not in user_states:
        return {"error": "Start interview first"}
    
    state = user_states[request.user_id]
    if state["questions_asked"] >= len(state["questions"]):
        return {"error": "Interview complete"}
    
    q_index = state["questions_asked"]
    q = state["questions"][q_index]
    answer = request.answer.strip()
    
    # Parse answers safely
    if "age" in q.lower():
        try:
            state["info"]["age"] = int(answer.split()[0])
        except:
            state["info"]["age"] = 20
    elif "income" in q.lower() and "family" in q.lower():
        try:
            state["info"]["family_income"] = float(answer.replace(",", "").split()[0])
        except:
            state["info"]["family_income"] = 500000
    elif "cgpa" in q.lower():
        try:
            state["info"]["cgpa"] = float(answer.split()[0])
        except:
            state["info"]["cgpa"] = 8.0
    elif "co-signer" in q.lower():
        if answer.lower() in ["no", "0", "nope", "none"]:
            state["info"]["co_signer_income"] = 0
        else:
            try:
                state["info"]["co_signer_income"] = float(answer.replace(",", "").split()[0])
            except:
                state["info"]["co_signer_income"] = 0
    elif "loan amount" in q.lower():
        try:
            state["info"]["loan_amount"] = float(answer.replace(",", "").split()[0])
        except:
            state["info"]["loan_amount"] = 2000000
    
    state["questions_asked"] += 1
    
    if state["questions_asked"] < len(state["questions"]):
        return {"type": "question", "message": state["questions"][state["questions_asked"]]}
    else:
        # Generate report
        info = state["info"]
        roi_data = get_roi(info["university"], info["course"])
        score = calculate_eligibility(
            info.get("age", 20),
            info.get("family_income", 500000),
            info.get("cgpa", 8.0),
            info.get("co_signer_income", 0),
            info.get("loan_amount", 2000000)
        )
        verdict = "Eligible" if score >= 70 else "Not Eligible"
        suggestions = []
        if score < 70:
            if info.get("co_signer_income", 0) == 0:
                suggestions.append("Add a co-signer with income.")
            if info.get("loan_amount", 2000000) > 1500000:
                suggestions.append("Reduce loan amount to ₹15L.")
            suggestions.append(f"Increase family income by ₹{int((70 - score) * 5000)} annually.")
        
        repayment = simulate_repayment(
            info.get("loan_amount", 2000000),
            salary=roi_data.get("avg_salary", 100000)
        )
        
        report = {
            "eligibility_score": round(score),
            "eligibility_verdict": verdict,
            "suggestions": suggestions,
            "roi_score": roi_data.get("roi_years", 5.0),
            "repayment_simulation": repayment,
            "application_form": {
                "student_name": "",
                "university": info["university"],
                "course": info["course"],
                "loan_amount": info.get("loan_amount", 2000000),
                "age": info.get("age", 20),
                "family_income": info.get("family_income", 500000),
                "cgpa": info.get("cgpa", 8.0),
                "co_signer_income": info.get("co_signer_income", 0)
            }
        }
        return {"type": "report", "data": report}

@app.get("/")
async def root():
    return {"message": "VidyaLoan AI Backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)