import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Plus, FileText, ArrowLeft, Trash2, Check, Star } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function FolderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [folder, setFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [moving, setMoving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return navigate('/login');
    try {
      const [foldRes, docRes] = await Promise.all([
        fetch(`${API_BASE_URL}/folders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/documents`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (foldRes.status === 401 || docRes.status === 401) {
        localStorage.removeItem('token');
        return navigate('/login');
      }
      
      if (foldRes.ok && docRes.ok) {
        const foldData = await foldRes.json();
        const docData = await docRes.json();
        
        const currentFolder = (foldData || []).find(f => f.id === id);
        if (!currentFolder) return navigate('/folders');
        
        setFolder(currentFolder);
        setAllDocuments(docData.documents || []);
        setDocuments((docData.documents || []).filter(d => d.folder_id === id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, token, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMoveToFolder = async () => {
    if (selectedDocs.size === 0) return;
    setMoving(true);
    try {
      await Promise.all(Array.from(selectedDocs).map(docId => 
        fetch(`${API_BASE_URL}/documents/${docId}/folder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ folder_id: id })
        })
      ));
      setIsModalOpen(false);
      setSelectedDocs(new Set());
      loadData();
    } catch (error) {
      alert("Gagal memindahkan sebagian file");
    } finally {
      setMoving(false);
    }
  };
  
  const handleRemoveFromFolder = async (docId) => {
    try {
      await fetch(`${API_BASE_URL}/documents/${docId}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ folder_id: null })
      });
      loadData();
    } catch (e) {
      alert("Gagal mengeluarkan dokumen");
    }
  };

  const handleToggleFavorite = async (doc, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newStatus = !doc.is_favorite;
    setDocuments(docs => docs.map(d => d.id === doc.id ? { ...d, is_favorite: newStatus } : d));
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${doc.id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_favorite: newStatus })
      });
      if (!res.ok) {
        setDocuments(docs => docs.map(d => d.id === doc.id ? { ...d, is_favorite: !newStatus } : d));
        alert("Gagal memperbarui favorites");
      }
    } catch {
      setDocuments(docs => docs.map(d => d.id === doc.id ? { ...d, is_favorite: !newStatus } : d));
    }
  };

  const availableDocs = allDocuments.filter(d => d.folder_id !== id);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></div>;
  if (!folder) return null;

  return (
    <div>
      <button onClick={() => navigate('/folders')} className="flex items-center gap-2 text-text-muted hover:text-secondary mb-6 transition-colors">
        <ArrowLeft size={18} /> Kembali ke Folders
      </button>
      
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-heading text-text-main truncate">{folder.name}</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-secondary text-white rounded-xl font-medium hover:bg-secondary/90 transition-colors flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus size={18} /> Masukkan File
        </button>
      </div>

      <div className="dashboard-card overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-12 text-center text-text-muted font-medium">
            Belum ada file
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {documents.map(doc => (
              <div key={doc.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-primary/20 transition-colors group">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => handleToggleFavorite(doc, e)} 
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${doc.is_favorite ? 'text-yellow-400' : 'text-black/10 hover:text-yellow-400 group-hover:text-black/20'}`}
                  >
                    <Star size={16} fill={doc.is_favorite ? "currentColor" : "none"} />
                  </button>
                  <div className="p-2 bg-primary rounded-lg text-text-muted"><FileText size={16} /></div>
                  <span className="font-medium text-text-main block truncate text-sm">{doc.original_name}</span>
                </div>
                <button 
                  onClick={() => handleRemoveFromFolder(doc.id)}
                  title="Keluarkan dari folder"
                  className="p-1.5 text-black/20 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-5 border-b border-black/5 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-heading">Masukkan File</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-black">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {availableDocs.length === 0 ? (
                <div className="text-center text-text-muted py-8">Tidak ada file tersedia untuk dimasukkan.</div>
              ) : (
                <div className="space-y-2">
                  {availableDocs.map(doc => (
                    <div 
                      key={doc.id}
                      onClick={() => {
                        const next = new Set(selectedDocs);
                        if (next.has(doc.id)) next.delete(doc.id);
                        else next.add(doc.id);
                        setSelectedDocs(next);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-black/5 cursor-pointer hover:bg-primary/30"
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedDocs.has(doc.id) ? 'bg-secondary border-secondary text-white' : 'border-black/20'}`}>
                        {selectedDocs.has(doc.id) && <Check size={12} />}
                      </div>
                      <span className="text-sm truncate">{doc.original_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-black/5 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-text-muted hover:bg-black/5 rounded-xl font-medium">Batal</button>
              <button 
                onClick={handleMoveToFolder} 
                disabled={moving || selectedDocs.size === 0}
                className="px-4 py-2 bg-secondary text-white rounded-xl font-medium hover:bg-secondary/90 disabled:opacity-50"
              >
                {moving ? <Loader2 size={18} className="animate-spin" /> : `Masukkan (${selectedDocs.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
