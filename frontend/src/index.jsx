// src/App.jsx
import React, { useState } from "react";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";
import "@fontsource/poppins/600.css";

const GlobalStyle = createGlobalStyle`
  :root {
    --neon1: #00f2fe;
    --neon2: #4facfe;
    --bg1: #0f0c29;
    --bg2: #302b63;
    --bg3: #24243e;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: 'Poppins', sans-serif;
    background: linear-gradient(135deg, var(--bg1), var(--bg2), var(--bg3));
    min-height: 100vh;
    color: #fff;

    display: flex;
    flex-direction: column;
  }

  #root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
`;


const Header = styled.header`
  background: linear-gradient(135deg,#0f2b3a,#203a43);
  padding: 26px;
  text-align: center;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
`;
const Title = styled.h1` 
  color: var(--neon1); 
  margin:0; 
  font-size:2.4rem; 
  text-shadow:0 0 14px var(--neon1); 
`;

const Container = styled.div`
  flex: 1;
  max-width:900px;
  margin: 40px auto;
  padding: 20px;
`;

const Glass = styled.div`
  background: rgba(255,255,255,0.04);
  padding: 28px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
`;

const Row = styled.div` 
  display:flex; 
  gap:12px; 
  align-items:center; 
  justify-content:center; 
  flex-wrap:wrap; 
`;

const PrimaryBtn = styled.button`
  background: linear-gradient(135deg,var(--neon1),var(--neon2));
  color:#00121a;
  border:none;
  padding:10px 18px;
  border-radius:10px;
  font-weight:700;
  cursor:pointer;
`;

const JobCard = styled.button`
  background: rgba(255,255,255,0.03);
  color: #cfe7ff;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  &:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
`;

const QuestionBox = styled.div`
  margin-top:18px;
  text-align:center;
  font-size:1.05rem;
`;

const TextArea = styled.textarea`
  width:100%;
  min-height:120px;
  border-radius:10px;
  padding:12px;
  margin-top:12px;
  background:#0b1220; color:#fff; border:1px solid #213051;
`;

const ResultBox = styled.pre`a
  text-align:left;
  white-space:pre-wrap;
  background: rgba(0,0,0,0.3);
  padding:14px; border-radius:10px; color:#e6f7ff; max-height:360px; overflow:auto;
`;

/* === Footer Styling === */
/* === Footer Styling === */
const Footer = styled.footer`
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
  padding: 40px 20px 30px 20px;
  border-top: 1px solid rgba(255,255,255,0.1);
  margin-top: 80px;
  backdrop-filter: blur(10px);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
`;

const FooterTitle = styled.h3`
  color: var(--neon1);
  margin-bottom: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  text-shadow: 0 0 8px var(--neon1);
`;

const Divider = styled.div`
  width: 60%;
  height: 1.5px;
  background: linear-gradient(to right, transparent, var(--neon2), transparent);
  margin: 0 auto 18px auto;
`;

const Social = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 16px;

  a img {
    width: 38px;
    height: 38px;
    transition: transform 0.3s, filter 0.3s;
    filter: drop-shadow(0 0 8px var(--neon2));
    border-radius: 8px;
  }

  a:hover img {
    transform: scale(1.15);
    filter: drop-shadow(0 0 12px var(--neon1));
  }
`;

const Brand = styled.p`
  color: #b7dfff;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px var(--neon1);
`;


function App(){
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [inInterview, setInInterview] = useState(false);
  const [finalResult, setFinalResult] = useState(null); 

  const handleFile = (e) => setFile(e.target.files[0]);

  const handleAnalyze = async () => {
    if(!file) return alert("Upload resume first");
    const fd = new FormData();
    fd.append("file", file);
    setLoading(true);
    setAnalysis(""); setJobs([]); setFinalResult(null);
    try{
      const r = await axios.post("http://127.0.0.1:8000/analyze_resume", fd, {
        headers: {"Content-Type": "multipart/form-data"}
      });
      if(r.data.error){
        setAnalysis("Error: " + r.data.error);
      } else {
        setAnalysis(r.data.analysis || "No analysis text");
        setJobs(r.data.job_roles || []);
      }
    }catch(err){
      console.error(err);
      setAnalysis("Server error: " + (err.response?.data?.error || err.message));
    }finally{ setLoading(false); }
  };

  const startInterview = async (role) => {
    setLoading(true);
    try{
      const fd = new FormData();
      fd.append("job_role", role);
      const r = await axios.post("http://127.0.0.1:8000/interview/start", fd);
      if(r.data.error) { alert(r.data.error); return; }
      setSessionId(r.data.session_id);
      setCurrentQuestion(r.data.question);
      setInInterview(true);
      setFinalResult(null);
    }catch(err){
      console.error(err);
      alert("Could not start interview: " + (err.response?.data?.error || err.message));
    }finally{ setLoading(false); }
  };

  const submitAnswer = async () => {
    if(!answerText.trim()) return alert("Type your answer");
    setLoading(true);
    try{
      const fd = new FormData();
      fd.append("session_id", sessionId);
      fd.append("answer", answerText);
      const r = await axios.post("http://127.0.0.1:8000/interview/answer", fd);
      if(r.data.error){ alert(r.data.error); return; }

      if(r.data.completed){
        setFinalResult({ summary: r.data.summary, details: r.data.details });
        setInInterview(false);
        setSessionId(null);
        setCurrentQuestion("");
        setAnswerText("");
      } else {
        setCurrentQuestion(r.data.next_question);
        setAnswerText("");
      }
    }catch(err){
      console.error(err);
      alert("Server error: " + (err.response?.data?.error || err.message));
    }finally{ setLoading(false); }
  };

  return (
    <>
      <GlobalStyle />
      <Header><Title>Hire Ready AI ⚡</Title></Header>
      <Container>
        <Glass>
          <Row style={{marginBottom:16}}>
            <input type="file" accept=".pdf,.docx" onChange={handleFile} />
            <PrimaryBtn onClick={handleAnalyze} disabled={loading}>
              {loading ? "Please wait..." : "Analyze Resume"}
            </PrimaryBtn>
          </Row>

          {analysis && (
            <>
              <h3 style={{textAlign:"center", marginTop:8}}>Analysis</h3>
              <ResultBox>{analysis}</ResultBox>
            </>
          )}

          {jobs && jobs.length > 0 && !inInterview && (
            <>
              <h3 style={{textAlign:"center", marginTop:12}}>Suggested Job Roles</h3>
              <Row style={{justifyContent:"center", marginTop:8}}>
                {jobs.map((j,i) => (
                  <JobCard key={i} onClick={() => startInterview(j)}>{j}</JobCard>
                ))}
              </Row>
              <p style={{textAlign:"center",marginTop:12,color:"#cfe7ff"}}>Tap a role to start interview simulation</p>
            </>
          )}

          {inInterview && (
            <QuestionBox>
              <h3>🧠 Question</h3>
              <p style={{fontSize:18, maxWidth:800, margin:"8px auto"}}>{currentQuestion}</p>
              <TextArea value={answerText} onChange={(e)=>setAnswerText(e.target.value)} placeholder="Type your answer here..." />
              <div style={{textAlign:"center", marginTop:12}}>
                <PrimaryBtn onClick={submitAnswer} disabled={loading}>
                  {loading ? "Submitting..." : "Submit Answer"}
                </PrimaryBtn>
              </div>
            </QuestionBox>
          )}

          {finalResult && (
            <>
              <h3 style={{textAlign:"center", marginTop:18}}>Interview Summary</h3>
              <ResultBox>{finalResult.summary}</ResultBox>
              <h4 style={{marginTop:12}}>Per-question Feedback</h4>
              <div>
                {finalResult.details.map((d,i)=>(
                  <ResultBox key={i} style={{marginTop:8}}>
                    <strong>Q:</strong> {d.question}
                    {"\n\n"}
                    <strong>Answer:</strong> {d.answer}
                    {"\n\n"}
                    <strong>Feedback:</strong> {d.feedback}
                    {"\n"}
                    <strong>Score:</strong> {d.score} / 10
                    {"\n"}
                    <strong>Tip:</strong> {d.tip}
                  </ResultBox>
                ))}
              </div>
            </>
          )}
        </Glass>
      </Container>

      {/* === Footer Section === */}
      <Footer>
        <FooterTitle>FOLLOW US ON :</FooterTitle>
        <Divider />
        <Social>
          <a href="https://www.facebook.com" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook"/></a>
          <a href="https://twitter.com" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/9/95/Twitter_new_X_logo.png" alt="Twitter"/></a>
          <a href="https://www.instagram.com/harvitron_tech" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" alt="Instagram"/></a>
          
        </Social>
        <Brand>© HARVITRON TECH : We Build The Future</Brand>
      </Footer>
    </>
  );
}

export default App;
