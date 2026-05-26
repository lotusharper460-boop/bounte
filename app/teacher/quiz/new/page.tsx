'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { 
  ArrowLeft, ArrowRight, CheckCircle, PlusCircle, 
  Trash2, Clock, Calendar, Trophy, Target, 
  UploadCloud, FileText, AlertCircle, Image as ImageIcon, Loader2, Users
} from 'lucide-react'

// 1. Aligned interfaces with the database schema
interface Question {
  questionText: string;
  options: string[];
  correctIndex: number;
  question_type: string;
  media_asset_id: string | null;
  previewUrl?: string; // Client-side only preview
}

interface QuizState {
  title: string;
  timeLimit: number;
  deadline: string;
  rewardType: string;
  rewardValue: number; // Schema expects integer
  class_id: string; // NEW: Added for class assignment
  questions: Question[];
}

export default function SetQuizPage() {
  const router = useRouter()
  
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))
  
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null)
  
  const [entryMode, setEntryMode] = useState<'manual' | 'document'>('manual')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // NEW: State to hold fetched classes
  const [classes, setClasses] = useState<{ id: string, name: string }[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)

  const [quizData, setQuizData] = useState<QuizState>({
    title: '',
    timeLimit: 30,
    deadline: '',
    rewardType: 'Bounty Points',
    rewardValue: 100,
    class_id: '', // Default to empty (Global)
    questions: [
      { 
        questionText: '', 
        options: ['', '', '', ''], 
        correctIndex: 0, 
        question_type: 'mcq',
        media_asset_id: null 
      }
    ]
  })

  // NEW: Fetch classes on component mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id)

        if (error) throw error
        if (data) setClasses(data)
      } catch (error) {
        console.error("Error fetching classes:", error)
      } finally {
        setIsLoadingClasses(false)
      }
    }

    fetchClasses()
  }, [supabase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setQuizData(prev => ({ 
      ...prev, 
      [name]: name === 'rewardValue' || name === 'timeLimit' ? parseInt(value) || 0 : value 
    }))
  }

  const addQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [...prev.questions, { 
        questionText: '', 
        options: ['', '', '', ''], 
        correctIndex: 0, 
        question_type: 'mcq',
        media_asset_id: null 
      }]
    }))
  }

  const removeQuestion = (index: number) => {
    const updated = [...quizData.questions]
    updated.splice(index, 1)
    setQuizData(prev => ({ ...prev, questions: updated }))
  }

  const updateQuestion = (qIndex: number, field: keyof Question, value: any) => {
    const updated = [...quizData.questions]
    updated[qIndex] = { ...updated[qIndex], [field]: value }
    setQuizData(prev => ({ ...prev, questions: updated }))
  }

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...quizData.questions]
    updated[qIndex].options[optIndex] = value
    setQuizData(prev => ({ ...prev, questions: updated }))
  }

  // 2. Image Upload Logic aligning with `media_assets` table
  const handleQuestionImageUpload = async (qIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImageIndex(qIndex);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required to upload images.");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // A. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('quiz-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('quiz-media')
        .getPublicUrl(filePath);

      // B. Insert into media_assets table
      const { data: mediaAsset, error: dbError } = await supabase
        .from('media_assets')
        .insert({
          uploader_id: user.id,
          file_name: file.name,
          file_url: publicUrl,
          storage_path: filePath,
          mime_type: file.type,
          file_size_kb: Math.round(file.size / 1024),
          asset_type: 'image'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // C. Update the question with the new media asset ID
      const updatedQuestions = [...quizData.questions];
      updatedQuestions[qIndex] = { 
        ...updatedQuestions[qIndex], 
        media_asset_id: mediaAsset.id,
        previewUrl: publicUrl
      };
      setQuizData(prev => ({ ...prev, questions: updatedQuestions }));

    } catch (error: any) {
      console.error("Image upload failed:", error);
      alert("Failed to upload image: " + error.message);
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExtractionError(null)
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0])
    }
  }

  const triggerExtraction = async () => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    setExtractionError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Extraction failed on the server. Check Next.js console logs.");
      }

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const mappedQuestions = data.questions.map((q: any) => ({
          questionText: q.questionText || q.question,
          options: q.options || [],
          correctIndex: q.correctIndex || 0,
          question_type: 'mcq',
          media_asset_id: null
        }));

        setQuizData(prevData => ({
          ...prevData,
          questions: mappedQuestions
        }));
        
        setEntryMode('manual');
        setUploadedFile(null);
      } else {
        throw new Error("The Logic Engine couldn't find any clear formatted questions in that document.");
      }

    } catch (error: any) {
      console.error("Extraction process error:", error);
      setExtractionError(error.message || "An unexpected error occurred during extraction.");
    } finally {
      setIsExtracting(false);
    }
  }

  // 3. Deployment Logic aligned with Database Schema
  const handleDeploy = async () => {
    if (quizData.questions.length === 0) {
      alert("Tactical Error: You cannot deploy an empty assessment.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed. Please log in again.");

      // NEW: Handle nullification of empty class_id
      const finalClassId = quizData.class_id === "" ? null : quizData.class_id;

      // Insert Quiz exactly as schema requires
      const { data: quizRecord, error: quizError } = await supabase
        .from('quizzes')
        .insert([{
            teacher_id: user.id,
            title: quizData.title || "Untitled Assessment",
            time_limit: quizData.timeLimit,
            deadline: quizData.deadline || null,
            reward_type: quizData.rewardType,
            reward_value: quizData.rewardValue,
            class_id: finalClassId,
            status: 'active', // ✅ ACTIVATES THE MISSION IMMEDIATELY
            pass_mark: 50
        }])
        .select()
        .single();

      if (quizError) throw quizError;

      // Insert Questions exactly as schema requires
      const questionsToInsert = quizData.questions.map((q, index) => ({
        quiz_id: quizRecord.id,
        question_text: q.questionText,
        question_type: q.question_type,
        options: q.options, 
        correct_index: q.correctIndex,
        media_asset_id: q.media_asset_id,
        marks: 1,
        order_index: index
      }));

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      router.refresh();
      router.push('/teacher/quizzes');
      
    } catch (error: any) {
      console.error("🔥 Deployment Failed:", error.message);
      alert("Database Synchronization Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center gap-6">
          <Link href="/teacher/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">Quiz Generator</p>
            <h1 className="text-lg font-bold text-white">Initialize New Assessment</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-12">
        
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 -z-10 rounded-full"></div>
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-yellow-400 -z-10 rounded-full transition-all duration-500`} style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
          
          {[1, 2, 3].map((num) => (
            <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors duration-300 ${step >= num ? 'bg-yellow-400 text-[#0B1426]' : 'bg-[#0B1426] text-white/40 border-2 border-white/10'}`}>
              {num}
            </div>
          ))}
        </div>

        {/* STEP 1: PARAMETERS */}
        {step === 1 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black uppercase tracking-wide mb-8 text-white flex items-center gap-3">
              <Target className="text-yellow-400" /> Mission Parameters
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Assessment Title</label>
                <input type="text" name="title" value={quizData.title} onChange={handleInputChange} placeholder="e.g., Week 4 Mathematics Standard Test" className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
              </div>

              {/* NEW: Class Assignment Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users size={14} /> Assign to Class
                </label>
                <select 
                  name="class_id" 
                  value={quizData.class_id} 
                  onChange={handleInputChange} 
                  disabled={isLoadingClasses}
                  className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">-- No Class (Global Assessment) --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
                {isLoadingClasses && <p className="text-xs text-yellow-400 mt-2 animate-pulse">Syncing class data...</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Clock size={14} /> Time Limit (Minutes)</label>
                  <input type="number" name="timeLimit" value={quizData.timeLimit} onChange={handleInputChange} className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Calendar size={14} /> Deadline</label>
                  <input type="datetime-local" name="deadline" value={quizData.deadline} onChange={handleInputChange} className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors [color-scheme:dark]" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Trophy size={14} /> Reward Type</label>
                  <select name="rewardType" value={quizData.rewardType} onChange={handleInputChange} className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors appearance-none">
                    <option value="Bounty Points">Bounty Points</option>
                    <option value="Class Ranking">Class Ranking</option>
                    <option value="Digital Badge">Digital Badge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reward Value</label>
                  <input type="number" name="rewardValue" value={quizData.rewardValue} onChange={handleInputChange} placeholder="e.g., 500" className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: QUESTIONS */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <h2 className="text-2xl font-black uppercase tracking-wide text-white">Data Entry Phase</h2>
              
              <div className="flex bg-[#0B1426]/50 border border-white/10 p-1 rounded-lg">
                <button 
                  onClick={() => setEntryMode('manual')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${entryMode === 'manual' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  Manual Override
                </button>
                <button 
                  onClick={() => setEntryMode('document')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${entryMode === 'document' ? 'bg-yellow-400 text-[#0B1426]' : 'text-slate-500 hover:text-yellow-400'}`}
                >
                  <UploadCloud size={14} /> Import Doc
                </button>
              </div>
            </div>

            {/* DOCUMENT UPLOAD MODE */}
            {entryMode === 'document' ? (
               <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-12 text-center transition-all hover:border-yellow-400">
               <input 
                 type="file" 
                 accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                 className="hidden" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload}
               />
               
               {!uploadedFile ? (
                 <div className="flex flex-col items-center justify-center">
                   <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                     <FileText className="text-slate-400" size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Upload Assessment Document</h3>
                   <p className="text-slate-400 text-sm max-w-md mx-auto mb-8">
                     Upload a document containing formatted CBT questions. The Groq engine will automatically extract them.
                   </p>
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold tracking-wide transition-colors"
                   >
                     Select File
                   </button>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center">
                   <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mb-6 border border-yellow-400/50">
                     <FileText className="text-yellow-400" size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">{uploadedFile.name}</h3>
                   
                   {extractionError && (
                     <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-start gap-3 text-left max-w-md w-full">
                       <AlertCircle className="shrink-0 mt-0.5" size={16} />
                       <p>{extractionError}</p>
                     </div>
                   )}

                   <button 
                     onClick={triggerExtraction}
                     disabled={isExtracting}
                     className="px-8 py-3 bg-yellow-400 text-[#0B1426] rounded-xl font-black uppercase tracking-widest hover:bg-yellow-300 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                   >
                     {isExtracting ? 'Extracting Data...' : 'Execute Extraction Engine'}
                   </button>
                   
                   <button onClick={() => { setUploadedFile(null); setExtractionError(null); }} className="mt-4 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-wider">
                     Cancel / Reselect
                   </button>
                 </div>
               )}
             </div>
            ) : (
              /* MANUAL ENTRY MODE */
              <>
                <div className="space-y-8">
                  {quizData.questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
                      <div className="absolute -top-3 -left-3 w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-[#0B1426] font-black text-sm shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                        {qIndex + 1}
                      </div>
                      
                      {quizData.questions.length > 1 && (
                        <button onClick={() => removeQuestion(qIndex)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors" title="Remove Question">
                          <Trash2 size={18} />
                        </button>
                      )}

                      <div className="mb-6 mt-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Question Query</label>
                        <input type="text" value={q.questionText} onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)} placeholder="Enter the exact question here..." className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
                      </div>

                      <div className="mb-6">
                        {q.previewUrl ? (
                          <div className="relative inline-block border border-white/10 rounded-xl overflow-hidden">
                            <img src={q.previewUrl} alt="Question Graphic" className="max-h-40 object-contain bg-[#0B1426]/50" />
                            <button 
                              onClick={() => {
                                updateQuestion(qIndex, 'media_asset_id', null);
                                updateQuestion(qIndex, 'previewUrl', undefined);
                              }} 
                              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-md transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input 
                              type="file" 
                              id={`image-upload-${qIndex}`}
                              accept="image/*" 
                              className="hidden"
                              onChange={(e) => handleQuestionImageUpload(qIndex, e)}
                            />
                            <label 
                              htmlFor={`image-upload-${qIndex}`}
                              className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-white/20 rounded-lg text-slate-400 hover:text-yellow-400 hover:border-yellow-400 transition-colors cursor-pointer text-sm font-bold uppercase"
                            >
                              {uploadingImageIndex === qIndex ? (
                                <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                              ) : (
                                <><ImageIcon size={16} /> Attach Reference Image</>
                              )}
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                              <input 
                                type="radio" 
                                name={`correct-${qIndex}`} 
                                checked={q.correctIndex === optIndex} 
                                onChange={() => updateQuestion(qIndex, 'correctIndex', optIndex)}
                                className="w-4 h-4 accent-yellow-400 cursor-pointer"
                                title="Mark as correct answer"
                              />
                            </div>
                            <input 
                              type="text" 
                              value={opt} 
                              onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} 
                              placeholder={`Option ${['A', 'B', 'C', 'D'][optIndex]}`} 
                              className={`w-full bg-[#0B1426]/50 border rounded-xl p-4 pl-12 text-sm text-white focus:outline-none transition-colors ${q.correctIndex === optIndex ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.1)]' : 'border-white/10 focus:border-slate-500'}`} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={addQuestion} className="mt-8 w-full py-4 rounded-xl border border-dashed border-white/20 text-slate-400 font-bold tracking-wide uppercase hover:border-yellow-400 hover:text-yellow-400 transition-all flex items-center justify-center gap-2">
                  <PlusCircle size={18} /> Append Question
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 3: REVIEW */}
        {step === 3 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black uppercase tracking-wide mb-8 text-white flex items-center gap-3">
              <CheckCircle className="text-yellow-400" /> Pre-Flight Verification
            </h2>

            <div className="space-y-6 bg-[#0B1426]/50 p-6 rounded-xl border border-white/5">
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-slate-400 font-medium">Title</span>
                <span className="text-white font-bold">{quizData.title || 'Untitled Assessment'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-slate-400 font-medium">Class Assignment</span>
                <span className="text-white font-bold">
                  {quizData.class_id ? classes.find(c => c.id === quizData.class_id)?.name || 'Unknown Class' : 'Global (No Class)'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-slate-400 font-medium">Time Limit</span>
                <span className="text-white font-bold">{quizData.timeLimit} Minutes</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-slate-400 font-medium">Total Questions</span>
                <span className="text-white font-bold">{quizData.questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Reward Output</span>
                <span className="text-yellow-400 font-black">{quizData.rewardValue} {quizData.rewardType}</span>
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION CONTROLS */}
        <div className="mt-12 flex items-center justify-between">
          <button 
            onClick={() => setStep(step > 1 ? step - 1 : 1)} 
            disabled={step === 1}
            className={`px-6 py-3 rounded-xl font-bold tracking-wide flex items-center gap-2 transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white/5 text-white hover:bg-white/10'}`}
          >
            <ArrowLeft size={18} /> Retreat
          </button>

          {step < 3 ? (
            <button 
              onClick={() => {
                if (step === 2 && entryMode === 'document' && uploadedFile) {
                  alert("Please Execute Extraction Engine or switch to Manual Override before advancing.");
                  return;
                }
                setStep(step + 1)
              }} 
              className="px-8 py-3 bg-yellow-400 text-[#0B1426] rounded-xl font-black uppercase tracking-widest hover:bg-yellow-300 active:scale-95 transition-all flex items-center gap-2"
            >
              Advance <ArrowRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handleDeploy}
              disabled={isSubmitting}
              className="px-8 py-3 bg-yellow-400 text-[#0B1426] rounded-xl font-black uppercase tracking-widest hover:bg-yellow-300 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Deploying...' : 'Deploy Assessment'}
            </button>
          )}
        </div>

      </main>
    </div>
  )
}