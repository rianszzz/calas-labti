import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, ArrowRight, Loader2, Plus, Edit2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Folders() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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
        setDocuments(data.documents || []);
      }
      if (foldRes.ok) {
        const data = await foldRes.json();
        setFolders(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></div>;

  const counts = (folders || []).reduce((acc, folder) => {
    acc[folder.id] = (documents || []).filter(d => d.folder_id === folder.id).length;
    return acc;
  }, {});

  const onRefresh = loadData;

  const handleCreate = async () => {
    const name = window.prompt("Masukkan nama folder baru:");
    if (!name || !name.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Gagal membuat folder");
      }
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRename = async (e, folder) => {
    e.stopPropagation();
    const name = window.prompt("Ubah nama folder:", folder.name);
    if (!name || !name.trim() || name === folder.name) return;
    try {
      const res = await fetch(`${API_BASE_URL}/folders/${folder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Gagal mengubah nama folder");
      }
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Hapus folder ini? Dokumen di dalamnya tetap aman dan akan dipindahkan ke Tanpa Folder.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Gagal menghapus folder");
      }
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading mb-2 text-text-main">Folders</h1>
          <p className="text-text-muted">Kelola folder untuk mengelompokkan dokumen Anda.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="px-4 py-2.5 bg-secondary text-white rounded-xl font-medium hover:bg-secondary/90 transition-colors flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus size={18} /> Buat Folder
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {folders.map(folder => (
          <div 
            key={folder.id} 
            onClick={() => navigate(`/folders/${folder.id}`)}
            className="dashboard-card p-6 cursor-pointer hover:border-secondary/50 hover:shadow-md transition-all group relative"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform"><Folder size={24} /></div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => handleRename(e, folder)} className="p-1.5 text-black/20 hover:text-secondary rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={16} /></button>
                <button onClick={(e) => handleDelete(e, folder.id)} className="p-1.5 text-black/20 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                <ArrowRight size={20} className="text-black/10 group-hover:text-secondary transition-colors ml-1" />
              </div>
            </div>
            <h3 className="font-heading text-lg text-text-main truncate" title={folder.name}>{folder.name}</h3>
            <p className="text-sm text-text-muted mt-1">{counts[folder.id] || 0} Dokumen</p>
          </div>
        ))}
        {folders.length === 0 && (
          <div className="col-span-1 sm:col-span-2 md:col-span-3 text-center p-8 text-text-muted border-2 border-dashed border-black/10 rounded-2xl">
            Belum ada folder. Silakan klik "Buat Folder" untuk menambahkan.
          </div>
        )}
      </div>
    </div>
  );
}
