'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock, ArrowRight, ArrowLeft, Target, ShieldAlert, AlertTriangle, Play, Lock, Calculator, X, Delete } from 'lucide-react'
import { gradeAndSubmitQuiz } from './actions'
import { useRouter } from 'next/navigation'

interface QuizClientProps {
  quiz: any;
  classId: string | null;
  questions: any[];
  studentName: string;
}

export default function QuizClient({ quiz, classId, questions, studentName }: QuizClientProps) {
  const router = useRouter() 

  const [hasStarted, setHasStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(quiz.time_limit * 60)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  
  const [isCalcOpen, setIsCalcOpen] = useState(false)
  const [calcDisplay, setCalcDisplay] = useState('')
  
  // --- ANTI-CHEAT MODAL STATE ---
  const [violationModal, setViolationModal] = useState<{
    show: boolean;
    type: 'back_attempt' | 'tab_switch';
    title: string;
    message: string;
  } | null>(null)
  
  const violationsRef = useRef(0)
  const answersRef = useRef(answers)
  const timeLeftRef = useRef(timeLeft)

  const currentQ = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (!hasStarted) return; 

    if (timeLeft <= 0) {
      handleFinalSubmit(answersRef.current) 
      return
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, hasStarted])

  // --- STRICT ANTI-CHEAT ENGINE ---
  useEffect(() => {
    if (!hasStarted) return;

    // 1. THE HISTORY TRAP (Blocks the Back Button)
    // Push a dummy state immediately so the back button has somewhere to go that ISN'T the previous page
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = (e: PopStateEvent) => {
      // If they press back, push the state AGAIN to trap them on the page
      window.history.pushState(null, '', window.location.href);
      
      // Trigger the violation modal
      setViolationModal({
        show: true,
        type: 'back_attempt',
        title: "UNAUTHORIZED NAVIGATION",
        message: "You are attempting to leave an active operation. Navigating away is strictly prohibited. If you proceed, your mission will be immediately terminated and your current score will be submitted as final."
      });
    };

    // 2. THE VISIBILITY OBSERVER (Detects tab switches, minimize, locking phone)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isSubmittingRef.current) {
        // Log the violation the moment they leave
        violationsRef.current += 1;
        
        // If this is Strike 2, auto-submit immediately in the background
        if (violationsRef.current >= 2) {
          handleFinalSubmit(answersRef.current);
          setTimeout(() => {
            alert("CRITICAL SECURITY BREACH: Multiple window exits detected. Mission forcibly terminated and submitted.");
          }, 100);
        }
      } else if (document.visibilityState === 'visible' && !isSubmittingRef.current) {
        // When they come back, if it was Strike 1, show them the warning
        if (violationsRef.current === 1) {
          setViolationModal({
            show: true,
            type: 'tab_switch',
            title: "SECURITY VIOLATION DETECTED",
            message: "You minimized the application, locked your device, or switched tabs. This compromises the integrity of the assessment. You have ONE strike remaining. Doing this again will result in instant termination and auto-submission."
          });
        }
      }
    }

    // 3. THE RELOAD BLOCKER
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmittingRef.current) {
        e.preventDefault();
        e.returnValue = ''; // Triggers the browser's native "Leave Site?" prompt
      }
    }

    window.addEventListener('popstate', handlePopState);
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasStarted])

  // --- CALCULATOR LOGIC ---
  const handleCalcInput = (val: string) => {
    if (calcDisplay === 'Error') {
      setCalcDisplay(val)
      return
    }
    setCalcDisplay(prev => prev + val)
  }

  const handleCalcEval = () => {
    try {
      const sanitized = calcDisplay.replace(/[^-()\d/*+.]/g, '')
      if (!sanitized) return
      const result = new Function('return ' + sanitized)()
      setCalcDisplay(String(Math.round(result * 10000) / 10000)) 
    } catch {
      setCalcDisplay('Error')
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleSelectOption = (optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: optionIndex }))
  }

  const handleFinalSubmit = async (forcedAnswers = answers) => {
    if (isSubmittingRef.current) return
    
    isSubmittingRef.current = true
    setIsSubmitting(true)
    setViolationModal(null) // Clear any modals
    
    const timeTaken = (quiz.time_limit * 60) - timeLeftRef.current

    try {
      const res = await gradeAndSubmitQuiz(quiz.id, classId, studentName, timeTaken, forcedAnswers)
      if (res?.success) {
        router.push(`/student/campaign/${quiz.id}`)
      }
    } catch (error: any) {
      console.error(error)
      alert(`Submission Error: ${error.message}`)
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // --- START SCREEN ---
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#0B1426] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white/5 border border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-white/5 pointer-events-none"><Lock size={250} /></div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-yellow-400/10 text-yellow-400 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-yellow-400/20 mb-6">
              <ShieldAlert size={14} /> Security Protocol Active
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-4">Mission Briefing</h1>
            <p className="text-slate-400 mb-8 text-sm md:text-base leading-relaxed">
              You are about to initialize <strong className="text-white">{quiz.title}</strong>. Read the rules of engagement carefully before proceeding.
            </p>

            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-4 p-4 bg-[#0B1426]/50 rounded-xl border border-white/5">
                <Clock className="text-yellow-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-bold text-white mb-1">Time Limit: {quiz.time_limit} Minutes</h3>
                  <p className="text-xs text-slate-500">The operation will automatically submit the moment the countdown reaches zero.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-bold text-red-400 mb-1">Strict Anti-Cheat Enforced</h3>
                  <p className="text-xs text-red-400/80">Navigation is locked. Do not use the back button, minimize this window, or switch applications. Violations will trigger immediate security protocols.</p>
                </div>
              </div>
            </div>

            <button onClick={() => setHasStarted(true)} className="w-full py-4 bg-yellow-400 text-[#0B1426] rounded-xl font-black uppercase tracking-widest text-lg hover:bg-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
              <Play fill="currentColor" size={18} /> Acknowledge & Start
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black flex flex-col relative">
      
      {/* VIOLATION OVERLAY MODAL */}
      {violationModal?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="max-w-lg w-full bg-[#120505] border-2 border-red-500 rounded-3xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6 mx-auto border border-red-500/50">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center text-red-500 uppercase tracking-widest mb-4">
              {violationModal.title}
            </h2>
            <p className="text-red-200/80 text-center mb-10 leading-relaxed">
              {violationModal.message}
            </p>
            
            {/* Dynamic Buttons based on Violation Type */}
            {violationModal.type === 'back_attempt' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setViolationModal(null)} 
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel, Return
                </button>
                <button 
                  onClick={() => handleFinalSubmit(answers)} 
                  disabled={isSubmitting}
                  className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase tracking-wider transition-colors flex justify-center items-center gap-2"
                >
                  {isSubmitting ? 'Terminating...' : 'Abort & Submit'}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setViolationModal(null)} 
                className="w-full px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase tracking-wider transition-colors"
              >
                I Understand. Resume Operation.
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- NORMAL QUIZ UI --- */}
      <header className="border-b border-white/10 bg-[#0B1426] sticky top-0 z-20 shadow-md">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-red-400 uppercase flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Live
            </p>
            <h1 className="text-sm sm:text-base font-bold text-white line-clamp-1">{quiz.title}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCalcOpen(!isCalcOpen)}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${isCalcOpen ? 'bg-yellow-400 text-[#0B1426] border-yellow-400' : 'bg-white/5 text-slate-300 border-white/10 hover:border-slate-400'}`}
              title="Open Calculator"
            >
              <Calculator size={18} />
              <span className="text-xs font-bold hidden sm:block">CALC</span>
            </button>

            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl font-black text-lg border ${timeLeft < 60 ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' : 'bg-white/5 text-yellow-400 border-white/10'}`}>
              <Clock size={18} />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
        <div className="w-full bg-white/5 h-1">
          <div className="bg-yellow-400 h-full transition-all duration-300" style={{ width: `${((currentIndex) / questions.length) * 100}%` }} />
        </div>
      </header>

      {/* CALCULATOR UI */}
      {isCalcOpen && (
        <div className="absolute top-24 right-6 w-64 bg-[#121E36]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
          <div className="bg-black/20 p-3 flex justify-between items-center border-b border-white/5">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calculator size={12}/> Terminal</span>
            <button onClick={() => setIsCalcOpen(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="p-4">
            <div className="w-full bg-black/40 rounded-xl p-3 mb-4 text-right text-xl font-mono text-white h-12 flex items-center justify-end overflow-hidden border border-white/5">
              {calcDisplay.replace(/\*/g, '×').replace(/\//g, '÷') || '0'}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setCalcDisplay('')} className="col-span-2 bg-red-500/10 text-red-400 rounded-lg py-2 font-bold hover:bg-red-500/20">AC</button>
              <button onClick={() => setCalcDisplay(prev => prev.slice(0, -1))} className="bg-white/5 text-white rounded-lg py-2 font-bold hover:bg-white/10 flex justify-center items-center"><Delete size={16} /></button>
              <button onClick={() => handleCalcInput('/')} className="bg-yellow-400/10 text-yellow-400 rounded-lg py-2 font-bold hover:bg-yellow-400/20">÷</button>
              
              {[7, 8, 9, '*'].map(btn => (
                <button key={btn} onClick={() => handleCalcInput(String(btn))} className={`rounded-lg py-2 font-bold ${typeof btn === 'number' ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'}`}>
                  {btn === '*' ? '×' : btn}
                </button>
              ))}
              {[4, 5, 6, '-'].map(btn => (
                <button key={btn} onClick={() => handleCalcInput(String(btn))} className={`rounded-lg py-2 font-bold ${typeof btn === 'number' ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'}`}>
                  {btn}
                </button>
              ))}
              {[1, 2, 3, '+'].map(btn => (
                <button key={btn} onClick={() => handleCalcInput(String(btn))} className={`rounded-lg py-2 font-bold ${typeof btn === 'number' ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'}`}>
                  {btn}
                </button>
              ))}
              <button onClick={() => handleCalcInput('0')} className="col-span-2 bg-white/5 text-white rounded-lg py-2 font-bold hover:bg-white/10">0</button>
              <button onClick={() => handleCalcInput('.')} className="bg-white/5 text-white rounded-lg py-2 font-bold hover:bg-white/10">.</button>
              <button onClick={handleCalcEval} className="bg-yellow-400 text-[#0B1426] rounded-lg py-2 font-bold hover:bg-yellow-300">=</button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION UI */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col relative z-10">
        <div className="mb-8 flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest">
          <Target size={14} className="text-yellow-400" />
          Question {currentIndex + 1} of {questions.length}
        </div>

        {currentQ.media_assets?.file_url && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-white/10 bg-white/5 relative">
            <img 
              src={currentQ.media_assets.file_url} 
              alt="Reference Asset" 
              className="w-full max-h-64 object-contain mx-auto"
            />
          </div>
        )}

        <h2 className="text-2xl sm:text-3xl font-medium text-white mb-10 leading-relaxed">
          {currentQ.question_text}
        </h2>

        <div className="space-y-4 mb-12">
          {currentQ.options.map((opt: string, index: number) => {
            const isSelected = answers[currentQ.id] === index
            return (
              <button
                key={index}
                onClick={() => handleSelectOption(index)}
                className={`w-full text-left p-6 rounded-2xl border transition-all flex items-center gap-4 ${isSelected ? 'bg-yellow-400/10 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.15)]' : 'bg-white/5 border-white/10 hover:border-slate-500 hover:bg-white/10'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm transition-colors ${isSelected ? 'bg-yellow-400 text-[#0B1426]' : 'bg-[#0B1426] text-slate-400 border border-white/10'}`}>
                  {['A', 'B', 'C', 'D'][index]}
                </div>
                <span className={`text-base sm:text-lg ${isSelected ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                  {opt}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/10">
          <button
            onClick={() => setCurrentIndex(prev => prev - 1)}
            disabled={currentIndex === 0}
            className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-0 disabled:pointer-events-none"
          >
            <ArrowLeft size={18} /> Prev
          </button>

          {!isLastQuestion ? (
            <button
              onClick={() => setCurrentIndex(prev => prev + 1)}
              className="px-8 py-3 bg-white/10 text-white rounded-xl font-black tracking-wide hover:bg-white/20 transition-all flex items-center gap-2"
            >
              Next <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => handleFinalSubmit(answers)}
              disabled={isSubmitting || Object.keys(answers).length === 0}
              className="px-8 py-3 bg-yellow-400 text-[#0B1426] rounded-xl font-black tracking-widest uppercase hover:bg-yellow-300 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? 'Transmitting...' : 'Submit Operation'}
              {!isSubmitting && <ShieldAlert size={18} />}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}