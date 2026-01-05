import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import '../styles/Login.css';

const ConfirmRegistration = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState('initial'); // initial, loading, success, error
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Token de confirmação não encontrado.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setStatus('error');
            setMessage('As senhas não coincidem.');
            return;
        }

        if (password.length < 6) {
            setStatus('error');
            setMessage('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setStatus('loading');

        try {
            const response = await api.post('/auth/confirm-registration', {
                token,
                senha: password
            });

            setStatus('success');
            setMessage(response.data.message);
            setTimeout(() => navigate('/login'), 3000);
        } catch (error) {
            setStatus('error');
            setMessage(error.response?.data?.error || 'Erro ao confirmar cadastro. Verifique sua conexão.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card glass-card">
                <div className="login-header">
                    <div className="logo-container" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            margin: '0 auto 1rem',
                            background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                            borderRadius: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            color: 'white',
                            boxShadow: '0 8px 32px rgba(0, 102, 255, 0.3)'
                        }}>Z</div>
                        <h1 style={{
                            background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            marginBottom: '0.5rem'
                        }}>ZoraH</h1>
                    </div>
                    <h2>Confirmar Cadastro</h2>
                    <p>Defina sua senha para ativar sua conta</p>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <CheckCircle size={64} color="#4CAF50" style={{ margin: '0 auto 1rem' }} />
                        <h3 style={{ color: '#4CAF50', marginBottom: '1rem' }}>Cadastro Confirmado!</h3>
                        <p>{message}</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                            Redirecionando para o login...
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="login-form">
                        {status === 'error' && (
                            <div className="error-message" style={{
                                background: 'rgba(255, 82, 82, 0.1)',
                                color: '#ff5252',
                                padding: '1rem',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '1rem'
                            }}>
                                <AlertCircle size={20} />
                                <span>{message}</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Nova Senha</label>
                            <div className="password-input-wrapper">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Confirmar Senha</label>
                            <div className="password-input-wrapper">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repita a senha"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="login-btn"
                            disabled={status === 'loading'}
                        >
                            {status === 'loading' ? 'Confirmando...' : 'Ativar Conta'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ConfirmRegistration;
