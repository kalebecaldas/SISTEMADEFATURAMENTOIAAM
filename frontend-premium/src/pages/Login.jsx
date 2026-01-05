import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import api from '../services/api';
import '../styles/Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/login', { email, senha: password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/');
        } catch (err) {
            setError('Credenciais inválidas. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card glass-card">
                <div className="login-header">
                    <div className="logo-container" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            margin: '0 auto 1rem',
                            background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2.5rem',
                            fontWeight: 'bold',
                            color: 'white',
                            boxShadow: '0 8px 32px rgba(0, 102, 255, 0.3)'
                        }}>Z</div>
                        <h1 style={{
                            background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontSize: '2.5rem',
                            fontWeight: 'bold',
                            marginBottom: '0.5rem'
                        }}>ZoraH</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                            Sistema de Gestão de Prestadores
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label>Email</label>
                        <div className="input-wrapper">
                            <Mail size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Senha</label>
                        <div className="input-wrapper">
                            <Lock size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Entrando...' : 'Entrar'}
                        {!loading && <ArrowRight size={20} />}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
