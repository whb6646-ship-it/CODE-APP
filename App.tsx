/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Code2, 
  MessageSquareQuote, 
  Settings as SettingsIcon,
  ChevronRight,
  Plus,
  History,
  Copy,
  Trash2,
  ChevronDown,
  Check,
  Download,
  FileText,
  FileCode,
  Braces
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

type Section = 'dashboard' | 'editor' | 'generator' | 'settings';
type Language = 'javascript' | 'python' | 'cpp' | 'java' | 'html' | 'css';
type CommentStyle = 'beginner' | 'professional' | 'detailed' | 'inline';
type Theme = 'light' | 'dark' | 'amoled';

interface Snippet {
  id: string;
  code: string;
  language: Language;
  timestamp: string;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
];

const COMMENT_STYLES: { value: CommentStyle; label: string }[] = [
  { value: 'beginner', label: 'Beginner Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'detailed', label: 'Detailed Explanation' },
  { value: 'inline', label: 'Inline Code Comments' },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<Language>('javascript');
  const [commentStyle, setCommentStyle] = useState<CommentStyle>('professional');
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [suggestionsOutput, setSuggestionsOutput] = useState('');
  const [activeGeneratorTab, setActiveGeneratorTab] = useState<'comments' | 'suggestions'>('comments');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [history, setHistory] = useState<Snippet[]>(() => {
    const saved = localStorage.getItem('snippet_history');
    return saved ? JSON.parse(saved) : [];
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('snippet_history', JSON.stringify(history));
  }, [history]);

  const saveToHistory = (codeToSave: string, lang: Language) => {
    if (!codeToSave.trim()) return;

    setHistory(prev => {
      // Remove if already exists to move to top
      const filtered = prev.filter(s => s.code !== codeToSave);
      const newSnippet: Snippet = {
        id: Date.now().toString(),
        code: codeToSave,
        language: lang,
        timestamp: new Date().toISOString()
      };
      return [newSnippet, ...filtered].slice(0, 10);
    });
  };

  const lineCount = code.split('\n').length;

  const analyzeCode = () => {
    const lines = code.split('\n');
    const functionMatches = code.match(/(function\s+\w+|const\s+\w+\s*=\s*\(|def\s+\w+|public\s+\w+\s+\w+\(|class\s+\w+)/g) || [];
    const commentMatches = code.match(/(\/\/|\/\*|#|<!--)/g) || [];
    
    // Simple Cyclomatic Complexity heuristic
    const complexityKeywords = code.match(/(if|for|while|switch|case|catch|&&|\|\||\?)/g) || [];
    const complexity = complexityKeywords.length + 1;

    return {
      functions: functionMatches.length,
      comments: commentMatches.length,
      complexity: complexity
    };
  };

  const analysis = analyzeCode();

  const generateComments = async () => {
    if (!code.trim()) return;
    
    setIsGenerating(true);
    setGeneratedOutput('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      
      const stylePrompts = {
        beginner: "Task: Provide simple, easy-to-understand explanations of what this code does. Use analogies and avoid overly technical jargon. Focus on the 'why' and 'what' in a friendly tone.",
        professional: "Task: Provide short, precise, and professional documentation for this code. Focus on technical accuracy, parameters, and return values. Use industry-standard terminology.",
        detailed: "Task: Provide a comprehensive, step-by-step breakdown of the code's logic. Explain the flow of execution, data transformations, and any complex algorithms used. Use a structured list format.",
        inline: "Task: Rewrite the provided code and insert meaningful inline comments directly into the code to explain each significant line or block. Ensure the output is valid code in the specified language."
      };

      const prompt = `
        Language: ${language}
        Style: ${COMMENT_STYLES.find(s => s.value === commentStyle)?.label}
        
        ${stylePrompts[commentStyle]}
        
        Code to analyze:
        \`\`\`${language}
        ${code}
        \`\`\`
        
        Important: Return ONLY the requested content (explanations or commented code). Do not include introductory text like "Here is the explanation...".
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text = response.text;
      if (text) {
        setGeneratedOutput(text);
      } else {
        throw new Error("No response from AI");
      }
    } catch (error) {
      console.error("Generation error:", error);
      setGeneratedOutput("⚠️ Error: Failed to generate comments. Please check your connection or try again later.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSuggestions = async () => {
    if (!code.trim()) return;
    
    setIsGeneratingSuggestions(true);
    setSuggestionsOutput('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Language: ${language}
        
        Task: Analyze the following code and provide:
        1. Potential bugs or edge cases.
        2. Performance improvements.
        3. Best practices and style recommendations.
        4. Modern alternatives (if applicable).
        
        Code:
        \`\`\`${language}
        ${code}
        \`\`\`
        
        Format the output clearly with headers and bullet points. Be constructive and specific.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text = response.text;
      if (text) {
        setSuggestionsOutput(text);
      } else {
        throw new Error("No response from AI");
      }
    } catch (error) {
      console.error("Suggestions error:", error);
      setSuggestionsOutput("⚠️ Error: Failed to generate suggestions. Please try again.");
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Clear all code?')) {
      setCode('');
    }
  };

  const handleDownload = (format: 'txt' | 'md' | 'json') => {
    if (!generatedOutput) return;
    
    let content = '';
    let fileName = `code-comments-${Date.now()}.${format}`;
    let mimeType = 'text/plain';

    if (format === 'txt') {
      content = `CODE:\n${code}\n\nGENERATED COMMENTS:\n${generatedOutput}`;
    } else if (format === 'md') {
      content = `# Code Analysis\n\n## Original Code (${language})\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n## AI Generated Comments (${commentStyle})\n\n${generatedOutput}`;
    } else if (format === 'json') {
      content = JSON.stringify({
        language,
        style: commentStyle,
        code,
        comments: generatedOutput,
        timestamp: new Date().toISOString()
      }, null, 2);
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-12"
          >
            <header className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
              <p className="text-zinc-500 text-sm font-medium">Welcome back to Code Commenter</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveSection('editor')}
                className={`p-6 border rounded-3xl shadow-sm flex flex-col items-start gap-4 transition-all text-left group hover:scale-[1.02] active:scale-[0.98] ${
                  theme === 'light' ? 'bg-white border-zinc-200 hover:border-indigo-200' : 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50'
                }`}
              >
                <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <div>
                  <div className="font-bold text-base">New Project</div>
                  <div className="text-xs text-zinc-500 font-medium">Start commenting code</div>
                </div>
              </button>
              <div className={`p-6 border rounded-3xl shadow-sm flex flex-col items-start gap-4 opacity-40 grayscale transition-all ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                  <History size={24} />
                </div>
                <div>
                  <div className="font-bold text-base">History</div>
                  <div className="text-xs text-zinc-500 font-medium">Coming soon</div>
                </div>
              </div>
            </div>

            {/* Quick Code Input Widget */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Quick Start</h2>
              </div>
              <div className={`border rounded-3xl p-6 shadow-sm space-y-4 transition-colors ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste code here for a quick start..."
                  className={`w-full h-32 p-4 rounded-2xl text-xs font-mono resize-none outline-none transition-all border ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-100 focus:border-indigo-200' : 'bg-black/40 border-zinc-800 focus:border-indigo-500/50'
                  }`}
                />
                <button 
                  onClick={() => {
                    saveToHistory(code, language);
                    setActiveSection('editor');
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-50 text-white hover:text-indigo-600 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/10"
                >
                  <Code2 size={20} />
                  Open in Code Editor
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recent Snippets</h2>
              </div>
              <div className="space-y-4">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => {
                        setCode(item.code);
                        setLanguage(item.language);
                        setActiveSection('editor');
                      }}
                      className={`p-5 border rounded-3xl shadow-sm transition-all cursor-pointer group hover:scale-[1.01] active:scale-[0.99] ${
                        theme === 'light' ? 'bg-white border-zinc-200 hover:border-indigo-200' : 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            theme === 'light' ? 'bg-zinc-100 text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-600' : 'bg-black/40 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500'
                          }`}>
                            <Code2 size={20} />
                          </div>
                          <div>
                            <div className="text-sm font-bold truncate max-w-[180px]">
                              {item.code.split('\n')[0].substring(0, 25) || 'Untitled Snippet'}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                              {item.language} • {new Date(item.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-zinc-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </div>
                      <div className={`rounded-xl p-3 font-mono text-[10px] truncate border border-dashed ${
                        theme === 'light' ? 'bg-zinc-50 text-zinc-500 border-zinc-200' : 'bg-black/20 text-zinc-400 border-zinc-800'
                      }`}>
                        {item.code}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`p-12 text-center border border-dashed rounded-3xl transition-colors ${
                    theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                  }`}>
                    <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <History size={32} className="text-zinc-300" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">No history yet. Start editing to see snippets here.</p>
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        );
      case 'editor':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 h-[calc(100vh-160px)] flex flex-col"
          >
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-extrabold tracking-tight">Code Editor</h1>
                <p className="text-zinc-500 text-xs font-medium">Write or paste your code below</p>
              </div>
              <button 
                onClick={() => {
                  saveToHistory(code, language);
                  setActiveSection('generator');
                }}
                disabled={!code.trim()}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                Generate AI Insights
              </button>
            </header>

            {/* Editor Toolbar */}
            <div className={`flex flex-wrap items-center justify-between gap-3 border p-2 rounded-2xl shadow-sm transition-colors ${
              theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <div className="relative flex-1 min-w-[140px] max-w-[200px]">
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className={`w-full appearance-none rounded-xl px-4 py-2 text-xs font-bold outline-none transition-all pr-10 border ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-100 focus:border-indigo-200' : 'bg-black/40 border-zinc-800 focus:border-indigo-500/50'
                  }`}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button 
                  onClick={handleCopy}
                  className={`p-2.5 rounded-xl transition-all relative ${
                    theme === 'light' ? 'hover:bg-zinc-100 text-zinc-500' : 'hover:bg-zinc-800 text-zinc-400'
                  }`}
                  title="Copy Code"
                >
                  {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
                <button 
                  onClick={handleClear}
                  className={`p-2.5 rounded-xl transition-all ${
                    theme === 'light' ? 'hover:bg-red-50 text-zinc-500 hover:text-red-500' : 'hover:bg-red-500/10 text-zinc-400 hover:text-red-400'
                  }`}
                  title="Clear Code"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Advanced Editor Layout */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
              <div className={`flex-1 border rounded-3xl overflow-hidden shadow-inner flex flex-col relative transition-all duration-300 ${
                theme === 'amoled' ? 'bg-black border-zinc-800' : theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              }`}>
                <div className="flex-1 flex overflow-hidden">
                  {/* Line Numbers */}
                  {showLineNumbers && (
                    <div className={`w-12 border-r flex flex-col py-4 select-none transition-colors ${
                      theme === 'light' ? 'bg-zinc-50/50 border-zinc-100' : 'bg-black/20 border-zinc-800/50'
                    }`}>
                      {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                        <div key={i} className="text-[10px] font-mono text-zinc-500 text-right pr-3 leading-6 h-6 opacity-40">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Paste your code here..."
                    className={`flex-1 p-6 pt-4 font-mono resize-none outline-none bg-transparent leading-6 transition-colors ${
                      theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}
                    spellCheck={false}
                    style={{ tabSize: 2, fontSize: `${fontSize}px` }}
                  />
                </div>
              </div>

              {/* Analysis Sidebar */}
              <div className="w-full md:w-28 flex flex-wrap md:flex-col gap-3 py-1">
                <AnalysisCard label="Lines" value={lineCount} color="indigo" theme={theme} />
                <AnalysisCard label="Funcs" value={analysis.functions} color="emerald" theme={theme} />
                <AnalysisCard label="Comments" value={analysis.comments} color="amber" theme={theme} />
                <AnalysisCard 
                  label="Complexity" 
                  value={analysis.complexity} 
                  color="rose" 
                  theme={theme}
                  subValue={analysis.complexity < 5 ? 'Low' : analysis.complexity < 15 ? 'Moderate' : 'High'}
                />
              </div>
            </div>
          </motion.div>
        );
      case 'generator':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-12"
          >
            <header className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight">AI Insights</h1>
              <p className="text-zinc-500 text-sm font-medium">Leverage Gemini to understand and improve your code</p>
            </header>

            {/* Code Preview (Read-only) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Source Code</h2>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider border ${
                  theme === 'light' ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>{language}</span>
              </div>
              <div className={`rounded-3xl p-6 font-mono text-xs overflow-x-auto whitespace-pre max-h-48 border shadow-inner transition-colors ${
                theme === 'light' ? 'bg-zinc-50 text-zinc-700 border-zinc-100' : 'bg-black/40 text-zinc-300 border-zinc-800'
              }`}>
                {code || "// No code provided yet. Go to Editor to paste some code."}
              </div>
            </section>

            {/* Configuration */}
            <section className={`rounded-3xl p-6 border shadow-sm space-y-6 transition-colors ${
              theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <div className={`flex p-1 rounded-2xl transition-colors ${
                theme === 'light' ? 'bg-zinc-100' : 'bg-black/40'
              }`}>
                <button
                  onClick={() => setActiveGeneratorTab('comments')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                    activeGeneratorTab === 'comments' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-600'
                  }`}
                >
                  Comments
                </button>
                <button
                  onClick={() => setActiveGeneratorTab('suggestions')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                    activeGeneratorTab === 'suggestions' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-600'
                  }`}
                >
                  Suggestions
                </button>
              </div>

              {activeGeneratorTab === 'comments' ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Comment Style</label>
                    <div className="relative">
                      <select 
                        value={commentStyle}
                        onChange={(e) => setCommentStyle(e.target.value as CommentStyle)}
                        className={`w-full appearance-none rounded-2xl px-5 py-4 text-sm font-bold outline-none transition-all pr-12 border ${
                          theme === 'light' ? 'bg-zinc-50 border-zinc-100 focus:border-indigo-200' : 'bg-black/40 border-zinc-800 focus:border-indigo-500/50'
                        }`}
                      >
                        {COMMENT_STYLES.map(style => (
                          <option key={style.value} value={style.value}>{style.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  <button 
                    disabled={!code.trim() || isGenerating}
                    onClick={generateComments}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-extrabold shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <MessageSquareQuote size={22} />
                        Generate Comments
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button 
                  disabled={!code.trim() || isGeneratingSuggestions}
                  onClick={generateSuggestions}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isGeneratingSuggestions ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Braces size={22} />
                      Get Suggestions
                    </>
                  )}
                </button>
              )}
            </section>

            {/* Output Panel */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  {activeGeneratorTab === 'comments' ? 'Generated Comments' : 'Code Review'}
                </h2>
              </div>
              <div className={`rounded-3xl min-h-[300px] p-8 border shadow-sm relative group transition-colors overflow-hidden ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/20"></div>
                
                {activeGeneratorTab === 'comments' ? (
                  <>
                    {!generatedOutput && !isGenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 space-y-4 p-8 text-center">
                        <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                          <Plus size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Ready to generate intelligent documentation.</p>
                      </div>
                    ) : (
                      <div className={`text-sm whitespace-pre-wrap font-medium leading-relaxed transition-colors ${
                        theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'
                      }`}>
                        {generatedOutput || (isGenerating && "AI is analyzing your code structure...")}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {!suggestionsOutput && !isGeneratingSuggestions ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 space-y-4 p-8 text-center">
                        <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                          <Braces size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Ready to provide expert code suggestions.</p>
                      </div>
                    ) : (
                      <div className={`text-sm whitespace-pre-wrap font-medium leading-relaxed transition-colors ${
                        theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'
                      }`}>
                        {suggestionsOutput || (isGeneratingSuggestions && "AI is reviewing your code logic...")}
                      </div>
                    )}
                  </>
                )}

                {((activeGeneratorTab === 'comments' && generatedOutput) || (activeGeneratorTab === 'suggestions' && suggestionsOutput)) && (
                  <button 
                    onClick={() => {
                      const textToCopy = activeGeneratorTab === 'comments' ? generatedOutput : suggestionsOutput;
                      navigator.clipboard.writeText(textToCopy);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`absolute top-6 right-6 p-3 rounded-xl transition-all shadow-sm border ${
                      theme === 'light' ? 'bg-zinc-50 border-zinc-100 hover:bg-zinc-100 text-zinc-500' : 'bg-black/40 border-zinc-800 hover:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                )}
              </div>
            </section>

            {/* Export Tools */}
            <AnimatePresence>
              {generatedOutput && (
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Export Options</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ExportButton 
                      onClick={() => {
                        navigator.clipboard.writeText(`CODE:\n${code}\n\nCOMMENTS:\n${generatedOutput}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      icon={<Copy size={20} />}
                      label="Copy All"
                      subLabel="Clipboard"
                      color="indigo"
                      theme={theme}
                    />
                    <ExportButton 
                      onClick={() => handleDownload('txt')}
                      icon={<FileText size={20} />}
                      label=".TXT File"
                      subLabel="Plain Text"
                      color="zinc"
                      theme={theme}
                    />
                    <ExportButton 
                      onClick={() => handleDownload('md')}
                      icon={<FileCode size={20} />}
                      label=".MD File"
                      subLabel="Markdown"
                      color="zinc"
                      theme={theme}
                    />
                    <ExportButton 
                      onClick={() => handleDownload('json')}
                      icon={<Braces size={20} />}
                      label=".JSON File"
                      subLabel="Data Object"
                      color="zinc"
                      theme={theme}
                    />
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-12"
          >
            <header className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
              <p className="text-zinc-500 text-sm font-medium">Personalize your development experience</p>
            </header>

            <div className="space-y-8">
              {/* Appearance Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Appearance</h2>
                </div>
                <div className={`border rounded-3xl overflow-hidden shadow-sm transition-colors ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}>
                  <div className="p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                          <SettingsIcon size={20} />
                        </div>
                        <div>
                          <span className="text-sm font-bold block">Theme Mode</span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Interface color palette</span>
                        </div>
                      </div>
                      <div className={`flex flex-wrap p-1 rounded-2xl transition-colors ${
                        theme === 'light' ? 'bg-zinc-100' : 'bg-black/40'
                      }`}>
                        {(['light', 'dark', 'amoled'] as Theme[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`flex-1 sm:flex-none px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                              theme === t 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-600'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Editor Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Editor Preferences</h2>
                </div>
                <div className={`border rounded-3xl overflow-hidden shadow-sm transition-colors ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}>
                  <div className="p-6 space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                          <FileCode size={20} />
                        </div>
                        <div>
                          <span className="text-sm font-bold block">Font Size</span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Adjust editor text size</span>
                        </div>
                      </div>
                      <div className={`flex items-center justify-center gap-2 p-1 rounded-2xl ${
                        theme === 'light' ? 'bg-zinc-100' : 'bg-black/40'
                      }`}>
                        <button 
                          onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                            theme === 'light' ? 'bg-white text-zinc-500 hover:bg-zinc-50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          -
                        </button>
                        <span className="text-sm font-mono font-extrabold w-10 text-center">{fontSize}</span>
                        <button 
                          onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                            theme === 'light' ? 'bg-white text-zinc-500 hover:bg-zinc-50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                          <Braces size={20} />
                        </div>
                        <div>
                          <span className="text-sm font-bold block">Line Numbers</span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Toggle vertical numbering</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowLineNumbers(!showLineNumbers)}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${showLineNumbers ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-800'}`}
                      >
                        <motion.div 
                          animate={{ x: showLineNumbers ? 26 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Danger Zone</h2>
                </div>
                <div className={`border rounded-3xl overflow-hidden shadow-sm transition-colors ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}>
                  <button 
                    onClick={() => {
                      if (window.confirm('Clear all history and settings? This cannot be undone.')) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="w-full p-6 text-left flex items-center justify-between hover:bg-red-500/5 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-bold block text-red-500">Reset Application</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Clear all local data and preferences</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-zinc-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className={`min-h-screen flex flex-col max-w-4xl mx-auto shadow-2xl relative overflow-hidden transition-colors duration-500 ${
      theme === 'amoled' ? 'bg-black text-zinc-100' : theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <main className="flex-1 overflow-y-auto pb-28 px-4 md:px-8 pt-6">
        <AnimatePresence mode="wait">
          {renderSection()}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-6 left-4 right-4 sm:left-0 sm:right-0 flex justify-center z-50 pointer-events-none">
        <nav className={`pointer-events-auto flex items-center gap-1 p-2 rounded-2xl border transition-all duration-300 shadow-2xl ${
          theme === 'amoled' ? 'bg-zinc-900/90 border-zinc-800' : theme === 'dark' ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-zinc-200'
        } backdrop-blur-xl`}>
          <NavButton 
            active={activeSection === 'dashboard'} 
            onClick={() => setActiveSection('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Home"
            theme={theme}
          />
          <NavButton 
            active={activeSection === 'editor'} 
            onClick={() => setActiveSection('editor')}
            icon={<Code2 size={20} />}
            label="Editor"
            theme={theme}
          />
          <NavButton 
            active={activeSection === 'generator'} 
            onClick={() => setActiveSection('generator')}
            icon={<MessageSquareQuote size={20} />}
            label="AI"
            theme={theme}
          />
          <NavButton 
            active={activeSection === 'settings'} 
            onClick={() => setActiveSection('settings')}
            icon={<SettingsIcon size={20} />}
            label="Settings"
            theme={theme}
          />
        </nav>
      </div>
    </div>
  );
}

function NavButton({ 
  active, 
  onClick, 
  icon, 
  label,
  theme
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode;
  label: string;
  theme: Theme;
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
      }`}
    >
      <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'scale-100 group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className={`text-xs font-bold tracking-wide transition-all ${active ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto'}`}>
        {label}
      </span>
    </button>
  );
}

function AnalysisCard({ label, value, color, theme, subValue }: { 
  label: string; 
  value: number; 
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
  theme: Theme;
  subValue?: string;
}) {
  const colors = {
    indigo: 'text-indigo-600 bg-indigo-500/10',
    emerald: 'text-emerald-600 bg-emerald-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    rose: 'text-rose-600 bg-rose-500/10'
  };

  return (
    <div className={`flex-1 md:flex-none p-4 border rounded-2xl shadow-sm space-y-1 transition-all hover:scale-105 ${
      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
    }`}>
      <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">{label}</div>
      <div className={`text-xl font-mono font-black leading-none ${colors[color] || 'text-zinc-600'}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter opacity-60">
          {subValue}
        </div>
      )}
    </div>
  );
}

function ExportButton({ onClick, icon, label, subLabel, color, theme }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  color: 'indigo' | 'zinc';
  theme: Theme;
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 p-4 border rounded-2xl transition-all text-left group ${
        theme === 'light' 
          ? 'bg-white border-zinc-200 hover:border-indigo-200 hover:shadow-md' 
          : 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/50'
      }`}
    >
      <div className={`p-3 rounded-xl transition-all group-hover:scale-110 ${
        color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-zinc-500/10 text-zinc-500'
      }`}>
        {icon}
      </div>
      <div>
        <div className="text-xs font-bold block">{label}</div>
        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{subLabel}</div>
      </div>
    </button>
  );
}
