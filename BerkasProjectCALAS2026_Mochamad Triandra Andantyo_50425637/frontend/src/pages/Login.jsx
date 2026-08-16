import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: `${username}@docuchat.app`,
        password: password
      });
      if (authError) throw authError;
      localStorage.setItem('token', data.session.access_token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat login');
    }
  };

  return (
    <div className="h-screen bg-primary flex flex-col items-center justify-center px-4">
      {/* Decorative Brand Header could go here */}
      <div className="mb-8 text-center">
        <div className="w-12 h-12 bg-secondary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm">
          <span className="text-white font-heading font-bold text-xl">D</span>
        </div>
        <h1 className="text-3xl text-text-main mb-2">DocuChat</h1>
        <p className="text-text-muted text-sm max-w-xs mx-auto">
          Sistem Manajemen Dokumen
        </p>
      </div>

      <div className="dashboard-card w-full max-w-sm p-8">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-6 border border-red-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1.5">Username</label>
            <input 
              type="text" 
              placeholder="Masukkan username" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-black/5 border-transparent focus:bg-white focus:border-secondary focus:ring-2 focus:ring-secondary/20 p-3 rounded-xl outline-none transition-all duration-200 text-text-main placeholder:text-text-muted/60"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1.5">Password</label>
            <input 
              type="password" 
              placeholder="Masukkan kata sandi" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/5 border-transparent focus:bg-white focus:border-secondary focus:ring-2 focus:ring-secondary/20 p-3 rounded-xl outline-none transition-all duration-200 text-text-main placeholder:text-text-muted/60"
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-secondary text-white font-medium p-3.5 rounded-xl hover:bg-secondary/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mt-2 flex justify-center items-center gap-2"
          >
            Masuk ke Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
        <div className="mt-6 text-center">
          <p className="text-[11px] text-text-muted/60">Demo: Username = <strong>admin</strong>, Password = <strong>123</strong></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
