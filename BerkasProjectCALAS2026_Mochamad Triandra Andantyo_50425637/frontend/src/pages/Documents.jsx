import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Search, Loader2, Star, FileText, MessageSquare, Trash2, Folder } from 'lucide-react';

export default function Documents() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const filterFolderId = searchParams.get("folder_id") || "All";
  const setFilterFolderId = (v) => setSearchParams(v === "All" ? {} : { folder_id: v });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, a-z, z-a

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    try {
      const [docRes, foldRes] = await Promise.all([
        fetch(`${API_BASE_URL}/documents`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/folders`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (docRes.status === 401 || foldRes.status === 401) {
        localStorage.removeItem('token');
        return navigate('/login');
      }
      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents);
      }
      if (foldRes.ok) {
        const data = await foldRes.json();
        setFolders(data);
      }
    } catch (e) {
      console.error("Gagal memuat data", e);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus dokumen ini?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) await loadData();
      else alert('Gagal menghapus dokumen.');
    } catch {
      console.error(e);
      alert('Terjadi kesalahan saat menghapus dokumen.');
    }
  };

  const handleToggleFavorite = async (doc, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const token = localStorage.getItem('token');
    const newStatus = !doc.is_favorite;
    setDocuments(docs => docs.map(d => d.id === doc.id ? { ...d, is_favorite: newStatus } : d));
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${doc.id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_favorite: newStatus })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Toggle favorite failed:", err);
        setDocuments(docs => docs.map(d => d.id === doc.id ? { ...d, is_favorite: !newStatus } : d));
        alert("Gagal memperbarui favorites di server");
      } else {
        // Force a data refresh to ensure sync with backend, but in background
        fetch(`${API_BASE_URL}/documents`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (data && data.documents) setDocuments(data.documents);
          });
      }
    } catch (err) {
      console.error("Network error toggling favorite:", err);
      setDocuments(docs => docs.map(d => d.id === doc.id ? { ...d, is_favorite: !newStatus } : d));
      alert("Terjadi kesalahan jaringan saat menyimpan favorite");
    }
  };

  const handleMoveDoc = async (id, folder_id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ folder_id: folder_id === 'none' ? null : folder_id })
      });
      if (res.ok) await loadData();
      else alert('Gagal memindahkan dokumen.');
    } catch {
      alert('Terjadi kesalahan.');
    }
  };
  
  const handleRetry = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Retry berhasil dijadwalkan.');
        await loadData();
      } else {
        alert('Gagal melakukan retry.');
      }
    } catch {
      alert('Terjadi kesalahan.');
    }
  };

  const activeFolder = filterFolderId !== "All" && filterFolderId !== "None" ? folders.find(f => f.id === filterFolderId) : null;
  
  let displayDocs = documents.filter(d => 
    (filterFolderId === "All" || (filterFolderId === "None" ? !d.folder_id : d.folder_id === filterFolderId)) &&
    (location.pathname === '/favorites' ? d.is_favorite : true) &&
    (statusFilter === 'all' || d.status === statusFilter) &&
    (searchQuery === '' || d.original_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  displayDocs.sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.uploaded_at) - new Date(a.uploaded_at);
    if (sortOrder === 'oldest') return new Date(a.uploaded_at) - new Date(b.uploaded_at);
    if (sortOrder === 'a-z') return a.original_name.localeCompare(b.original_name);
    if (sortOrder === 'z-a') return b.original_name.localeCompare(a.original_name);
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Row 1: Title + Add action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl text-text-main">
            {location.pathname === '/favorites' ? 'Favorite Documents' : 
             activeFolder ? activeFolder.name : 'All Documents'}
          </h2>
          {activeFolder && (
            <p className="text-sm text-text-muted mt-1">{displayDocs.length} dokumen dalam folder ini</p>
          )}
        </div>
        {activeFolder && (
          <div className="flex items-center gap-2">
            <select 
              id="doc-to-add" 
              className="p-2.5 text-sm rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/50 min-w-[200px]"
              defaultValue=""
            >
              <option value="" disabled>Pilih dokumen...</option>
              {documents.filter(d => d.folder_id !== filterFolderId).map(doc => (
                <option key={doc.id} value={doc.id}>{doc.original_name}</option>
              ))}
            </select>
            <button 
              onClick={() => {
                const sel = document.getElementById('doc-to-add');
                if (sel.value) { handleMoveDoc(sel.value, filterFolderId); sel.value = ""; }
              }}
              className="px-5 py-2.5 bg-secondary text-white text-sm rounded-xl font-medium hover:bg-secondary/90 transition-colors whitespace-nowrap"
            >
              + Masukkan File
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Filter toolbar */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-3 border-b border-black/5 flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-black/[0.015]">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari dokumen..." 
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select 
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="py-2 px-3 text-sm rounded-lg border border-black/10 bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-secondary/50 flex-1 sm:flex-none"
            >
              <option value="all">Semua Status</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            <select 
              value={filterFolderId} 
              onChange={e => setFilterFolderId(e.target.value)}
              className="py-2 px-3 text-sm rounded-lg border border-black/10 bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-secondary/50 flex-1 sm:flex-none"
            >
              <option value="All">Semua Folder</option>
              <option value="None">Tanpa Folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select 
              value={sortOrder} onChange={e => setSortOrder(e.target.value)}
              className="py-2 px-3 text-sm rounded-lg border border-black/10 bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-secondary/50 flex-1 sm:flex-none"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="a-z">Nama A-Z</option>
              <option value="z-a">Nama Z-A</option>
            </select>
          </div>
        </div>
        
        <div className="p-3 border-b border-black/5 bg-white text-sm text-text-muted">
          Menampilkan {displayDocs.length} dari {documents.length} dokumen
        </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></div>
      ) : displayDocs.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center text-text-muted mb-4">
            <Folder size={32} />
          </div>
          <h3 className="text-xl font-heading text-text-main mb-2">Belum ada file</h3>
          <p className="text-text-muted text-sm">
            {activeFolder 
              ? 'Folder ini kosong. Gunakan tombol "+ Masukkan File" di atas untuk menambahkan dokumen.'
              : 'Belum ada dokumen yang sesuai.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {displayDocs.map((doc) => (
            <div key={doc.id} className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-primary/20 transition-colors group gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button onClick={(e) => handleToggleFavorite(doc, e)} className={`p-1.5 rounded-lg transition-colors shrink-0 ${doc.is_favorite ? 'text-yellow-400' : 'text-black/10 hover:text-yellow-400 group-hover:text-black/20'}`}>
                  <Star size={16} fill={doc.is_favorite ? "currentColor" : "none"} />
                </button>
                <div className="p-2 bg-primary rounded-lg text-text-muted shrink-0"><FileText size={16} /></div>
                <div className="min-w-0">
                  <span className="font-medium text-text-main block truncate text-sm">{doc.original_name}</span>
                  <span className="text-xs text-text-muted">
                    {new Date(doc.uploaded_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} 
                    {doc.folder_id && folders.find(f => f.id === doc.folder_id) 
                      ? ` · ${folders.find(f => f.id === doc.folder_id).name}` 
                      : ''
                    }
                  </span>
                  {doc.status === 'failed' && doc.error_message && (
                    <span className="text-xs text-red-500 block truncate mt-0.5">{doc.error_message}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 sm:ml-4 overflow-x-auto pb-1 sm:pb-0">
                <select 
                  value={doc.folder_id || 'none'}
                  onChange={e => handleMoveDoc(doc.id, e.target.value)}
                  className="py-1 px-2 text-xs rounded-lg border border-black/10 bg-white text-text-muted focus:outline-none focus:ring-1 focus:ring-secondary/50 max-w-[120px]"
                >
                  <option value="none">Tanpa Folder</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <span className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full ${
                  doc.status === 'ready' ? 'bg-green-100 text-green-700' :
                  doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{doc.status}</span>
                <div className="flex items-center gap-1">
                  {doc.status === 'failed' && (
                    <button 
                      onClick={() => handleRetry(doc.id)}
                      className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                    >
                      Retry
                    </button>
                  )}
                  <button 
                    onClick={() => navigate(`/documents/${doc.id}/chat`)}
                    disabled={doc.status !== 'ready'}
                    className="px-3 py-1.5 bg-secondary text-white text-xs rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <MessageSquare size={14} /> Chat
                  </button>
                  <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
