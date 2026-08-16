import { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, File as FileIcon, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function StatCard({ count, label }) {
  return (
    <div className="dashboard-card p-5">
      <div className="font-heading text-3xl font-semibold text-text-main mb-1">{count}</div>
      <div className="text-sm text-text-muted">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ total: 0, processing: 0, ready: 0, failed: 0 });
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folderId, setFolderId] = useState("");

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

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
        setStats(data.stats);
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

  useEffect(() => {
    if (stats.processing > 0) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [loadData, stats.processing]);

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadStatus('error');
      setMessage('Format file tidak didukung. Harap unggah PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus('error');
      setMessage('Ukuran file maksimal 5MB.');
      return;
    }
    setUploadStatus('uploading');
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, { 
        method: 'POST', 
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setUploadStatus('success');
        setMessage('Dokumen berhasil diunggah dan sedang diproses.');
        setTimeout(() => {
          setFile(null);
          setUploadStatus('idle');
          loadData();
        }, 2000);
      } else {
        setUploadStatus('error');
        setMessage('Gagal mengunggah dokumen.');
      }
    } catch {
      setUploadStatus('error');
      setMessage('Gagal terhubung ke server.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-heading mb-2 text-text-main">Dashboard</h1>
        <p className="text-text-muted">Selamat datang, unggah dan kelola dokumen PDF Anda.</p>
      </div>

      <div className="dashboard-card p-8">
        <h2 className="font-heading text-xl mb-6">Upload your documents</h2>
        <div 
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-10 text-center
            ${dragActive ? 'border-secondary bg-secondary/5' : 'border-black/10 hover:border-secondary/50 bg-primary/30'}
            ${file ? 'hidden' : 'block'}
          `}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        >
          <input ref={inputRef} type="file" accept="application/pdf" onChange={(e) => { if(e.target.files[0]) setFile(e.target.files[0]); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="" />
          <div className="flex flex-col items-center gap-4 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-secondary mb-2"><UploadCloud size={32} /></div>
            <div><p className="text-lg font-medium text-text-main">Drag & drop or <span className="text-secondary">browse files</span></p><p className="text-sm text-text-muted mt-1">PDF up to 5 MB</p></div>
          </div>
        </div>

        {file && (
          <div className="bg-primary/50 border border-black/5 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-secondary"><FileIcon size={24} /></div>
                <div><p className="font-medium text-text-main">{file.name}</p><p className="text-sm text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
              </div>
              {uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
                <button onClick={() => setFile(null)} className="p-2 text-text-muted hover:text-red-500 hover:bg-white rounded-lg transition-colors"><X size={20} /></button>
              )}
            </div>
            
            <div className="mt-4 flex flex-col gap-2">
              <label className="text-sm font-medium text-text-main">Pilih Folder (Opsional)</label>
              <select 
                value={folderId} 
                onChange={e => setFolderId(e.target.value)}
                disabled={uploadStatus === 'uploading' || uploadStatus === 'success'}
                className="p-2.5 rounded-lg border border-black/10 bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-secondary/50"
              >
                <option value="">Tanpa Folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-black/5">
              <div className="flex-1">
                {uploadStatus === 'error' && <p className="text-red-500 text-sm flex items-center gap-2"><AlertCircle size={16}/> {message}</p>}
                {uploadStatus === 'success' && <p className="text-green-500 text-sm flex items-center gap-2"><CheckCircle size={16}/> {message}</p>}
              </div>
              {uploadStatus !== 'success' && (
                <button onClick={handleUpload} disabled={uploadStatus === 'uploading'} className="px-6 py-2.5 bg-secondary text-white rounded-xl font-medium hover:bg-secondary/90 transition-colors disabled:opacity-70 flex items-center gap-2">
                  {uploadStatus === 'uploading' ? <><Loader2 size={18} className="animate-spin" /> Uploading...</> : 'Upload Document'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg mb-4 text-text-main">Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard count={stats.total} label="Total Documents" />
          <StatCard count={stats.ready} label="Ready" />
          <StatCard count={stats.processing} label="Processing" />
          <StatCard count={stats.failed} label="Failed" />
        </div>
      </div>
      
      <div>
        <h2 className="font-heading text-lg mb-4 text-text-main">Recent Documents</h2>
        {documents.length === 0 && !loading ? (
          <div className="dashboard-card p-6 text-center text-text-muted">
            <p className="mb-4 text-sm font-medium">Belum ada dokumen. Ikuti langkah berikut:</p>
            <div className="flex justify-center flex-wrap gap-4 text-xs">
              <div className="bg-black/5 px-3 py-2 rounded-lg">1. Buat folder</div>
              <div className="bg-black/5 px-3 py-2 rounded-lg">2. Upload PDF</div>
              <div className="bg-black/5 px-3 py-2 rounded-lg">3. Tunggu Ready</div>
              <div className="bg-black/5 px-3 py-2 rounded-lg">4. Buka Chat</div>
            </div>
          </div>
        ) : (
          <div className="dashboard-card divide-y divide-black/5">
            {documents.slice(0, 5).map(doc => (
              <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-black/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon size={20} className="text-text-muted shrink-0" />
                  <span className="font-medium text-text-main truncate text-sm">{doc.original_name}</span>
                </div>
                <span className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full shrink-0 ${
                  doc.status === 'ready' ? 'bg-green-100 text-green-700' :
                  doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{doc.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
