# app.py
import os
import io
import json
import traceback
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PyPDF2 import PdfReader
from dotenv import load_dotenv
import openai


load_dotenv()
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    print("⚠️ API key loaded: False - put API_KEY in .env")
else:
    print("✅ API key loaded: True")

openai.api_key = API_KEY

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


interview_sessions = {}

def extract_text_from_pdf_bytes(b: bytes) -> str:
    try:
        r = PdfReader(io.BytesIO(b))
        text = ""
        for p in r.pages:
            t = p.extract_text()
            if t:
                text += t + "\n"
        return text.strip()
    except Exception:
        return ""

@app.get("/")
def root():
    return {"message": "Hire Ready AI backend running"}

@app.post("/analyze_resume")
async def analyze_resume(file: UploadFile = File(...)):
    """
    Accept resume file, return analysis text and a list of 3 job role suggestions.
    The model is asked to output JSON only, e.g.:
    {
      "analysis":"short readable analysis text ...",
      "job_roles": ["Role 1","Role 2","Role 3"]
    }
    """
    try:
        file_bytes = await file.read()
        resume_text = extract_text_from_pdf_bytes(file_bytes)
        if not resume_text.strip():
            # try docx
            try:
                from docx import Document
                doc = Document(io.BytesIO(file_bytes))
                resume_text = "\n".join([p.text for p in doc.paragraphs if p.text])
            except Exception:
                resume_text = ""

        if not resume_text.strip():
            return JSONResponse({"error": "No text extracted from resume. Upload PDF/DOCX with selectable text."}, status_code=400)

       
        system_prompt = "You are an expert recruiter. Return a JSON object only."
        user_prompt = (
            "Analyze the candidate resume below. Respond with JSON only, exactly this structure:\n"
            '{ "analysis": "<short summary (3-6 sentences)>", "job_roles": ["Role 1","Role 2","Role 3"] }\n\n'
            "Resume:\n" + resume_text
        )

        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role":"system", "content": system_prompt},
                {"role":"user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=800,
        )

        raw = resp["choices"][0]["message"]["content"].strip()

       
        parsed = None
        try:
            # model should output JSON only, but if there is extra text we try to extract JSON substring
            jstart = raw.find("{")
            jend = raw.rfind("}")
            if jstart != -1 and jend != -1:
                json_text = raw[jstart:jend+1]
                parsed = json.loads(json_text)
        except Exception:
            parsed = None

        if not parsed:
            # fallback: put whole raw analysis into 'analysis' and try to extract 3 roles heuristically
            roles = []
            for line in raw.splitlines():
                line = line.strip("-• \t")
                if len(line) > 2 and len(roles) < 3:
                    # pick lines that look like roles
                    if len(line.split()) <= 4 and any(word.lower() in line.lower() for word in ["engineer","developer","analyst","manager","specialist","designer","intern","qa","data"]):
                        roles.append(line)
            parsed = {
                "analysis": raw,
                "job_roles": roles or ["Software Engineer", "Full Stack Developer", "QA Engineer"]
            }

        return {"analysis": parsed.get("analysis",""), "job_roles": parsed.get("job_roles", [])}

    except openai.error.RateLimitError as e:
        # quota error -> tell frontend
        return JSONResponse({"error": "OpenAI quota/limit error: " + str(e)}, status_code=429)
    except Exception as e:
        tb = traceback.format_exc()
        print("❌ analyze_resume error:\n", tb)
        return JSONResponse({"error": str(e), "trace": tb}, status_code=500)


@app.post("/interview/start")
async def start_interview(job_role: str = Form(...)):
    """
    Create a session with 10 interview questions tailored to job_role.
    Returns session_id and first question.
    """
    try:
        prompt = (
            f"You are an experienced technical interviewer hiring for the role: {job_role}.\n"
            "Generate exactly 10 high-quality interview questions (one per line). Do NOT include answers."
        )

        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role":"system", "content":"You are a professional interviewer."},
                {"role":"user", "content":prompt},
            ],
            temperature=0.6,
            max_tokens=500,
        )

        raw = resp["choices"][0]["message"]["content"]
        # split into lines and clean
        lines = [l.strip("0123456789.). \t-•") for l in raw.splitlines() if l.strip()]
        # ensure we have at least 10; if fewer, ask model again (simple fallback: keep as-is)
        questions = [l for l in lines if len(l) > 5]
        if len(questions) < 10:
            # try to split by sentences
            parts = []
            for l in lines:
                parts.extend([s.strip() for s in l.split("?") if s.strip()])
            questions = [p + "?" for p in parts][:10]
        questions = questions[:10]

        session_id = len(interview_sessions) + 1
        interview_sessions[session_id] = {
            "role": job_role,
            "questions": questions,
            "index": 0,
            "feedback": []
        }

        return {"session_id": session_id, "question": questions[0] if questions else ""}
    except Exception as e:
        tb = traceback.format_exc()
        print("❌ start_interview error:\n", tb)
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/interview/answer")
async def interview_answer(session_id: int = Form(...), answer: str = Form(...)):
    """
    Evaluate current answer and return the next question (no feedback returned yet).
    Only when interview completes we return final summary + per-question feedback list.
    """
    try:
        session = interview_sessions.get(session_id)
        if not session:
            return JSONResponse({"error":"Invalid session id"}, status_code=400)

        idx = session["index"]
        if idx >= len(session["questions"]):
            return {"error":"Interview already completed", "completed": True}

        current_q = session["questions"][idx]

        rating_prompt = (
            f"You are an experienced interviewer. Evaluate the candidate's answer.\n"
            f"Question: {current_q}\n"
            f"Candidate Answer: {answer}\n\n"
            "Return a small JSON object only with keys: feedback (1-2 lines), score (integer 0-10), tip (one short improvement tip)."
        )

        rate_resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role":"system","content":"You evaluate interview answers."},
                {"role":"user","content":rating_prompt},
            ],
            temperature=0.2,
            max_tokens=250,
        )

        raw = rate_resp["choices"][0]["message"]["content"].strip()
        # try parse JSON
        parsed = None
        try:
            jstart = raw.find("{")
            jend = raw.rfind("}")
            if jstart != -1 and jend != -1:
                parsed = json.loads(raw[jstart:jend+1])
        except Exception:
            parsed = None

        if not parsed:
            # fallback: put whole raw into 'feedback' and assign 5/10
            parsed = {"feedback": raw, "score": 5, "tip": ""}

        session["feedback"].append({
            "question": current_q,
            "answer": answer,
            "feedback": parsed.get("feedback",""),
            "score": parsed.get("score",0),
            "tip": parsed.get("tip","")
        })
        session["index"] += 1

        if session["index"] < len(session["questions"]):
            return {"next_question": session["questions"][session["index"]], "completed": False}
        else:
            # Interview complete -> create final summary
            summary_prompt = (
                "You are an HR expert. Given this list of per-question feedback items (feedback, score, tip), produce a concise final summary (3-5 lines) and an overall score out of 100.\n\n"
                f"{json.dumps(session['feedback'], ensure_ascii=False)}"
            )

            summ_resp = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role":"system","content":"You summarize candidate performance."},
                    {"role":"user","content":summary_prompt},
                ],
                temperature=0.2,
                max_tokens=400,
            )

            summary_text = summ_resp["choices"][0]["message"]["content"]
            # return final summary and the detailed feedback list
            return {
                "completed": True,
                "summary": summary_text,
                "details": session["feedback"]
            }

    except Exception as e:
        tb = traceback.format_exc()
        print("❌ interview/answer error:\n", tb)
        return JSONResponse({"error": str(e)}, status_code=500)
