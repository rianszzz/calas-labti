import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-primary flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-lg w-full flex flex-col items-center">
        <div className="w-24 h-24 bg-secondary/10 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-secondary/20">
          <Compass className="text-secondary w-12 h-12" />
        </div>
        
        <h1 className="text-9xl font-heading text-text-main mb-4 tracking-tighter leading-none">
          404
        </h1>
        
        <h2 className="text-2xl font-medium text-text-main mb-3">
          Halaman Tidak Ditemukan
        </h2>
        
        <p className="text-text-muted mb-10 leading-relaxed">
          Sepertinya Anda tersesat. Dokumen atau halaman yang Anda cari mungkin telah dihapus, namanya diganti, atau memang tidak pernah ada.
        </p>
        
        <button 
          onClick={() => navigate('/')} 
          className="bg-secondary text-white px-8 py-3.5 rounded-xl hover:bg-secondary/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 font-medium flex items-center gap-2"
        >
          <ArrowLeft size={18} />
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
}
