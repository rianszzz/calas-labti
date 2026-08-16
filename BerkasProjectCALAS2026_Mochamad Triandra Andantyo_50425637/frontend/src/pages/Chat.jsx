import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { ArrowLeft, Send, FileText, Loader2, Bot, User, AlertCircle } from 'lucide-react';

export default function Chat() {
  const { document_id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [expandedSources, setExpandedSources] = useState({});

  const toggleSource = (msgIdx, srcIdx) => {
    const key = `${msgIdx}-${srcIdx}`;
    setExpandedSources(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [docError, setDocError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    
    fetch(`${API_BASE_URL}/documents/${document_id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) throw new Error('Dokumen tidak ditemukan atau akses ditolak.');
        const data = await res.json();
        if (data.status !== 'ready') throw new Error(`Dokumen belum siap (status: ${data.status}).`);
        return data;
      })
      .then(data => {
        setDoc(data);
        setMessages([{ role: 'assistant', content: `Halo! Saya siap menjawab pertanyaan seputar dokumen "${data.original_name}".` }]);
      })
      .catch(err => setDocError(err.message));
  }, [document_id, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if(!input.trim()) return;
    const query = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ query, document_id })
      });
      let data;
      if (!res.ok) {
        data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Terjadi kesalahan tidak dikenal saat menghubungi server.');
      }
      data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Gagal: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (docError) {
    return (
      <div className="h-screen bg-primary flex flex-col items-center justify-center p-4">
        <div className="dashboard-card p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl mx-auto flex items-center justify-center mb-4"><AlertCircle size={32} /></div>
          <h1 className="text-xl font-heading mb-2">Akses Ditolak</h1>
          <p className="text-text-muted mb-6">{docError}</p>
          <button onClick={() => navigate('/')} className="bg-secondary text-white px-6 py-2 rounded-xl hover:bg-secondary/90 transition-colors">Kembali ke Dashboard</button>
        </div>
      </div>
    );
  }

  if(!doc) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary" size={32} /></div>;

  return (
    <div className="h-screen bg-primary flex flex-col">
      {/* Header */}
      <div className="h-16 bg-white border-b border-black/5 flex items-center px-6 gap-4">
        <button onClick={() => navigate('/documents')} className="p-2 hover:bg-black/5 rounded-lg transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg text-secondary"><FileText size={20} /></div>
          <div>
            <h1 className="font-medium text-text-main">{doc.original_name}</h1>
            <p className="text-xs text-text-muted capitalize">Status: {doc.status}</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary text-white' : 'bg-white border border-black/10 text-secondary'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-secondary text-white rounded-tr-none' : 'bg-white border border-black/5 text-text-main rounded-tl-none shadow-sm'}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 w-full max-w-sm">
                  {msg.sources.map((src, i) => {
                    const isExpanded = expandedSources[`${idx}-${i}`];
                    return (
                      <div key={i} className="bg-white border border-black/10 rounded-lg overflow-hidden shadow-sm">
                        <button 
                          onClick={() => toggleSource(idx, i)}
                          className="w-full px-3 py-2 text-left text-xs bg-black/[0.02] hover:bg-black/[0.04] transition-colors border-b border-black/5 flex items-center justify-between"
                        >
                          <span className="font-medium text-text-main">Sumber (Hal. {src.page})</span>
                          <span className="text-text-muted">{isExpanded ? 'Tutup' : 'Lihat'}</span>
                        </button>
                        {isExpanded && src.snippet && (
                          <div className="p-3 text-xs text-text-muted whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {src.snippet}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-white border border-black/10 text-secondary flex items-center justify-center shrink-0"><Bot size={16} /></div>
            <div className="p-4 bg-white border border-black/5 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
              <div className="w-2 h-2 bg-black/20 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-black/20 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-black/20 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white border-t border-black/5">
        <div className="max-w-4xl mx-auto relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => { if (e.target.value.length <= 1000) setInput(e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Tanyakan sesuatu tentang dokumen ini..." 
            className="w-full pl-6 pr-14 py-4 bg-primary/50 border border-black/5 rounded-full focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all text-text-main"
          />
          <div className="absolute right-14 top-1/2 -translate-y-1/2 text-xs text-text-muted px-2">
            {input.length}/1000
          </div>
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-secondary text-white rounded-full flex items-center justify-center hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
