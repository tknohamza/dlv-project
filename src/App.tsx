import React, { useState, useEffect } from 'react';
import { MdLoop as Loader2, MdDownload as Download, MdSearch as Search, MdOutlineOndemandVideo as Youtube, MdLink as LinkIcon, MdErrorOutline as AlertCircle, MdAudiotrack as FileAudio, MdMovie as FileVideo, MdVpnKey as Key, MdCheckCircleOutline as CheckCircle2 } from 'react-icons/md';

interface MediaInfo {
  title: string;
  thumbnail: string;
  duration: string;
  uploader: string;
  webpage_url: string;
}

const FORMATS = [
  { id: 'b', label: 'Best Quality (Video + Audio)', icon: FileVideo },
  { id: 'w', label: 'Smallest Size (Video + Audio)', icon: FileVideo },
  { id: 'bestaudio', label: 'Best Audio Only', icon: FileAudio },
  { id: 'bestvideo', label: 'Best Video Only (No Audio)', icon: FileVideo },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'downloads' | 'auth'>('downloads');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [format, setFormat] = useState('b');
  
  // Cookies state
  const [cookiesText, setCookiesText] = useState('');
  const [cookiesActive, setCookiesActive] = useState(false);
  const [savingCookies, setSavingCookies] = useState(false);
  const [cookiesStatusMsg, setCookiesStatusMsg] = useState('');

  useEffect(() => {
    fetch('/api/cookies/status')
      .then(res => res.json())
      .then(data => setCookiesActive(data.active))
      .catch(() => {});
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setInfo(null);

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch media info');
      }
      const data = await res.json();
      setInfo(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!info) return;
    const dlUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}&title=${encodeURIComponent(info.title)}`;
    
    // We open it in a new window to let the browser trigger the download flow
    const newWindow = window.open(dlUrl, '_blank');
    if (newWindow) newWindow.opener = null;
  };

  const handleSaveCookies = async () => {
    setSavingCookies(true);
    setCookiesStatusMsg('');
    try {
      const res = await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesText }),
      });
      const data = await res.json();
      setCookiesStatusMsg(data.message);
      setCookiesActive(cookiesText.trim().length > 0);
      if (cookiesText.trim().length === 0) {
         setCookiesText('');
      }
    } catch (err) {
      setCookiesStatusMsg('Failed to save cookies.');
    } finally {
      setSavingCookies(false);
      setTimeout(() => setCookiesStatusMsg(''), 3000);
    }
  };

  return (
    <div className="h-screen bg-bg flex overflow-hidden font-sans text-text-main">
      <header className="w-[240px] bg-sidebar border-r border-border-subtle p-6 flex flex-col flex-shrink-0">
        <div className="text-[20px] font-[800] tracking-[-0.5px] text-accent mb-[40px] flex items-center gap-2">
          <span>◈</span> YT-DLP
        </div>
        
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[1px] text-text-dim mb-3">Main</div>
          <div 
            onClick={() => setActiveTab('downloads')}
            className={`py-2.5 text-[14px] cursor-pointer flex items-center gap-3 transition-colors ${activeTab === 'downloads' ? 'text-text-main font-medium' : 'text-text-dim hover:text-text-main'}`}
          >
             <Download className="w-4 h-4"/>
             Downloads
          </div>
        </div>

        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[1px] text-text-dim mb-3">Config</div>
          <div 
            onClick={() => setActiveTab('auth')}
            className={`py-2.5 text-[14px] cursor-pointer flex items-center gap-3 transition-colors ${activeTab === 'auth' ? 'text-text-main font-medium' : 'text-text-dim hover:text-text-main'}`}
          >
             <Key className="w-4 h-4"/>
             Authentication
          </div>
        </div>

        <div className="mt-auto text-[12px] text-text-dim flex items-center">
          <span className="w-2 h-2 rounded-full bg-[#4ade80] inline-block mr-2"></span>
          yt-dlp Ready
        </div>
      </header>

      <main className="flex-1 p-[32px] flex flex-col gap-[24px] overflow-y-auto">
        {activeTab === 'downloads' ? (
          <>
            <form onSubmit={handleAnalyze} className="bg-card border border-border-subtle rounded-xl px-5 py-4 flex items-center gap-4">
              <span className="text-text-dim text-[15px] hidden sm:inline">URL</span>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-transparent border-none text-text-main font-mono text-[15px] outline-none placeholder-text-dim/50 h-full w-full"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="bg-accent text-white border-none rounded-md px-4 py-2 font-semibold text-[13px] hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center whitespace-nowrap gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
              </button>
            </form>

            <div className="flex flex-col flex-1">
              <div className="text-[18px] font-semibold mb-4 flex justify-between items-center text-text-main">
                Active Tasks
                {info && <span className="text-[10px] bg-border-subtle px-2 py-0.5 rounded text-text-dim">1 Ready</span>}
              </div>

              {error && (
                <div className="mb-6 p-4 bg-[#1a0f0f] text-[#ff6b6b] border border-[#ff6b6b]/20 rounded-xl flex items-start font-mono text-[12px] break-words">
                  <AlertCircle className="w-4 h-4 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="leading-relaxed whitespace-pre-wrap">{error}</p>
                    {error.includes("Sign in to confirm you") && (
                       <button onClick={() => setActiveTab('auth')} className="mt-3 text-accent underline hover:text-white flex items-center gap-1">
                          <Key className="w-3 h-3"/> Provide cookies to bypass this error
                       </button>
                    )}
                  </div>
                </div>
              )}

              {info && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-card border border-border-subtle rounded-2xl p-5 relative">
                    
                    <div className="flex">
                      <div className="w-[100px] h-[56px] flex-shrink-0 bg-[#333] rounded overflow-hidden mr-4 relative">
                        {info.thumbnail ? (
                          <img
                            src={info.thumbnail}
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-[#2c3e50] to-[#000]" />
                        )}
                      </div>

                      <div className="overflow-hidden flex-1">
                        <div className="text-[14px] font-medium mb-1 whitespace-nowrap overflow-hidden text-ellipsis text-text-main" title={info.title}>
                          {info.title}
                        </div>
                        <div className="text-[12px] text-text-dim mb-3">
                          {info.uploader && <span>{info.uploader}</span>}
                          {info.uploader && <span> • </span>}
                          {info.duration && <span>{info.duration}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {FORMATS.map(f => {
                          const Icon = f.icon;
                          const isSelected = format === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setFormat(f.id)}
                              className={`flex items-center p-3 rounded-md border text-left transition-all ${
                                isSelected
                                  ? 'bg-bg border-accent'
                                  : 'bg-bg border-border-subtle hover:border-text-dim'
                              }`}
                            >
                              <Icon className={`w-4 h-4 flex-shrink-0 mr-3 ${isSelected ? 'text-accent' : 'text-text-dim'}`} />
                              <div className={`text-[12px] ${isSelected ? 'text-text-main font-medium' : 'text-text-dim'}`}>
                                {f.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-5 flex justify-end">
                        <button
                          autoFocus
                          onClick={handleDownload}
                          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white font-semibold text-[13px] rounded-md transition-colors flex items-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Save to Disk
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex-1 flex flex-col min-h-[150px]">
                 <div className="text-[18px] font-semibold mb-4 text-text-main">Console Output</div>
                 <div className="bg-[#000] rounded-lg p-4 flex-1 border border-border-subtle font-mono text-[12px] text-[#4ade80] leading-relaxed overflow-y-auto">
                   [system] UI Initialization complete.<br/>
                   [debug] YT-DLP Web Server is running on port 3000<br/>
                   {cookiesActive && `[auth] Browser cookies are currently active and loaded.\n`}
                   {info && `[info] Target URL analyzed: ${url}\n`}
                   {info && `[info] Extracted metadata for: ${info.title}\n`}
                   <span className="animate-pulse">_</span>
                 </div>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 max-w-3xl">
             <div className="text-[18px] font-semibold mb-6 text-text-main flex items-center">
               <Key className="w-5 h-5 mr-3 text-text-dim" />
               Authentication & Cookies
             </div>
             
             <div className="bg-card border border-border-subtle rounded-xl p-6">
                <h3 className="text-[14px] font-medium mb-2 text-text-main">Netscape HTTP Cookie File</h3>
                <p className="text-[13px] text-text-dim mb-4 leading-relaxed">
                  To bypass "Sign in to confirm you're not a bot" errors or access age-restricted/private videos, export your YouTube cookies to a <code className="bg-bg px-1.5 py-0.5 rounded text-accent">cookies.txt</code> file and paste the contents below. 
                  You can use browser extensions like <strong>Get cookies.txt LOCALLY</strong> to generate this file.
                </p>

                {cookiesActive && (
                  <div className="mb-4 bg-[#1a2e1d] text-[#4ade80] border border-[#4ade80]/20 px-4 py-3 rounded-md flex items-center text-[12px] font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Custom cookies are currently saved on the server and are actively being injected into yt-dlp queries!
                  </div>
                )}
                
                <textarea 
                  className="w-full h-64 bg-bg border border-border-subtle rounded-md p-4 font-mono text-[11px] text-text-main outline-none focus:border-accent transition-colors resize-none placeholder-text-dim/40"
                  placeholder="# Netscape HTTP Cookie File&#10;# https://curl.haxx.se/rfc/cookie_spec.html&#10;# This is a generated file!  Do not edit.&#10;&#10;.youtube.com	TRUE	/	TRUE	1744933932	LOGIN_INFO	AFmmF2s...&#10;.youtube.com	TRUE	/	TRUE	1744933932	SID	g.a000nAh....&#10;"
                  value={cookiesText}
                  onChange={(e) => setCookiesText(e.target.value)}
                ></textarea>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-[12px] text-text-dim">
                    {cookiesStatusMsg && (
                       <span className="text-accent">{cookiesStatusMsg}</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                     <button 
                       onClick={() => { setCookiesText(''); handleSaveCookies(); }}
                       className="px-4 py-2 hover:bg-white/5 border border-border-subtle rounded-md text-[13px] font-medium transition-colors"
                     >
                       Clear Cookies
                     </button>
                     <button 
                       onClick={handleSaveCookies}
                       disabled={savingCookies}
                       className="px-6 py-2 bg-accent hover:bg-accent/90 text-white border-none rounded-md text-[13px] font-semibold transition-colors flex items-center"
                     >
                       {savingCookies ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Cookies'}
                     </button>
                  </div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
