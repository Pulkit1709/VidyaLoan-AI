import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [step, setStep] = useState('initial')
  const [report, setReport] = useState(null)
  const [userId] = useState('user' + Math.random().toString(36).substr(2, 9))
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef(null)

  const suggestions = {
    initial: [
      'MIT + Computer Science',
      'Stanford + Engineering',
      'IIT Delhi + CS',
      'How does it work?'
    ],
    interviewing: ['Next question', 'Tell me more', 'Skip']
  }

  const recognition = typeof window !== 'undefined' ? new (window.SpeechRecognition || window.webkitSpeechRecognition)() : null
  if (recognition) {
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const startListening = () => {
    if (recognition) {
      setIsListening(true)
      recognition.start()
    }
  }

  const sendMessage = async (text = null) => {
    const messageText = text || input.trim()
    if (!messageText) return

    setShowSuggestions(false)
    const userMessage = { type: 'user', text: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    try {
      let response
      if (step === 'initial') {
        response = await fetch('http://localhost:8000/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initial: messageText, user_id: userId })
        })
        setStep('interviewing')
      } else if (step === 'interviewing') {
        response = await fetch('http://localhost:8000/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: messageText, user_id: userId })
        })
      }

      const data = await response.json()
      
      // Simulate realistic typing delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500))
      
      const botMessage = { type: 'bot', text: data.message || '', data: data.data }
      setMessages(prev => [...prev, botMessage])
      setIsTyping(false)

      if (data.type === 'report') {
        setReport(data.data)
        setStep('report')
      }
    } catch (err) {
      setIsTyping(false)
      setMessages(prev => [...prev, { type: 'bot', text: 'Oops! Something went wrong. Please try again.' }])
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app">
      {/* Background Content */}
      <div className="app-content">
        <header className="hero-section">
          <div className="hero-content">
            <h1>VidyaLoan AI</h1>
            <p>Instant Loan Eligibility. Real ROI. Smart Repayment Plans.</p>
            <p className="subtext">Get your personalized education loan assessment in 90 seconds</p>
          </div>
        </header>
      </div>

      {/* Floating Assistant */}
      <div className={`floating-assistant ${isOpen ? 'open' : 'closed'}`}>
        {/* Collapsed Button */}
        {!isOpen && (
          <button
            className="floating-button"
            onClick={() => setIsOpen(true)}
            aria-label="Open VidyaLoan AI Assistant"
          >
            <div className="button-icon">💬</div>
            <span className="pulse-ring"></span>
            <span className="floating-tooltip">Chat with VidyaLoan AI</span>
          </button>
        )}

        {/* Chat Window */}
        {isOpen && (
          <div className="chat-window">
            {/* Header */}
            <div className="chat-header">
              <div className="header-content">
                <div className="bot-avatar">🤖</div>
                <div className="header-text">
                  <h3>VidyaLoan AI</h3>
                  <span className="status">Ready to help</span>
                </div>
              </div>
              <button
                className="close-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>

            {/* Messages Area */}
            <div className="messages-container">
              {messages.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🎓</div>
                  <h3>Welcome to VidyaLoan AI</h3>
                  <p>Tell me about your dream university and course, and I'll assess your loan eligibility in 90 seconds.</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`message-wrapper ${msg.type}`}>
                  {msg.type === 'bot' && <div className="message-avatar">🤖</div>}
                  <div className={`message-bubble ${msg.type}`}>
                    <p>{msg.text}</p>
                    {msg.data && (
                      <div className="report-card">
                        <div className="score-badge">
                          <span className="label">Eligibility Score</span>
                          <span className="value">{msg.data.eligibility_score}</span>
                        </div>
                        <div className="verdict-badge" data-verdict={msg.data.eligibility_verdict.toLowerCase()}>
                          {msg.data.eligibility_verdict}
                        </div>
                        {msg.data.suggestions && msg.data.suggestions.length > 0 && (
                          <div className="suggestions-list">
                            <strong>💡 Path to Approval:</strong>
                            {msg.data.suggestions.map((s, i) => <p key={i}>• {s}</p>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="message-wrapper bot">
                  <div className="message-avatar">🤖</div>
                  <div className="message-bubble bot">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Smart Suggestions */}
            {showSuggestions && step === 'initial' && messages.length === 0 && (
              <div className="suggestions-area">
                <p className="suggestions-label">Quick start:</p>
                <div className="suggestion-buttons">
                  {suggestions.initial.map((s, i) => (
                    <button
                      key={i}
                      className="suggestion-btn"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Report Section */}
            {step === 'report' && report && (
              <div className="full-report">
                <div className="report-header">📊 Loan Intelligence Report</div>
                <div className="report-grid">
                  <div className="report-item">
                    <div className="label">Eligibility Score</div>
                    <div className="value">{report.eligibility_score}/100</div>
                  </div>
                  <div className="report-item">
                    <div className="label">ROI Score</div>
                    <div className="value">{report.roi_score}x</div>
                  </div>
                  <div className="report-item">
                    <div className="label">Monthly Payment</div>
                    <div className="value">₹{report.repayment_simulation.monthly_payment}</div>
                  </div>
                  <div className="report-item">
                    <div className="label">Loan-to-Income</div>
                    <div className="value">{report.repayment_simulation.loan_to_income_ratio}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="input-area">
              <div className="input-wrapper">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={step === 'report' ? 'Ask a follow-up...' : 'Tell me your dream university and course...'}
                  className="chat-input"
                />
                <button
                  className="voice-btn"
                  onClick={startListening}
                  disabled={isListening}
                  title="Voice input"
                >
                  {isListening ? '🎙️' : '🎤'}
                </button>
                <button
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isTyping}
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App