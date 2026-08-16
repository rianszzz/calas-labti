import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Folder, Tag, Star, 
  Search, Bell, LogOut, Menu, X
} from 'lucide-react';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Folder size={20} />, label: 'Documents', path: '/documents' },
    { icon: <Tag size={20} />, label: 'Folders', path: '/folders' },
  ];
  const subItems = [
    { icon: <Star size={20} />, label: 'Favorites', path: '/favorites' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-black/5 flex flex-col z-50 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-black/5 shrink-0">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center text-white font-bold mr-3">D</div>
            <span className="font-heading font-semibold text-lg text-text-main">DocuChat</span>
          </div>
          <button className="lg:hidden text-text-muted" onClick={() => setMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-6">
          <div className="mb-8">
            <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Main Menu</p>
            <ul className="space-y-1">
              {menuItems.map((item, idx) => (
                <li key={idx}>
                  <Link 
                    to={item.path} 
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${currentPath === item.path ? 'bg-secondary/10 text-secondary font-medium' : 'text-text-muted hover:bg-black/5'}`}>
                    {item.icon}<span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Library</p>
            <ul className="space-y-1">
              {subItems.map((item, idx) => (
                <li key={idx}>
                  <Link 
                    to={item.path} 
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${currentPath === item.path ? 'bg-secondary/10 text-secondary font-medium' : 'text-text-muted hover:bg-black/5'}`}>
                    {item.icon}<span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-4 border-t border-black/5 space-y-1 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={20} /><span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <div className="h-16 bg-white border-b border-black/5 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-text-muted p-2 -ml-2" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="relative w-full max-w-sm hidden sm:block">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Cari dokumen..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-primary/30 border border-transparent focus:border-black/10 focus:bg-white focus:outline-none focus:ring-4 focus:ring-secondary/10 transition-all text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-muted hover:text-secondary transition-colors border border-black/5">
              <Bell size={20} />
            </button>
            <div className="w-10 h-10 rounded-full bg-secondary/20 border-2 border-white overflow-hidden cursor-pointer">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Rian" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <div className="flex-1 overflow-x-hidden p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
