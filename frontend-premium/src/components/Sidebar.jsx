import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, Users, Settings, LogOut, DollarSign, UserCog, Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import '../styles/Sidebar.css';

const Sidebar = () => {
    const { theme, toggleTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.tipo === 'admin' || user.tipo === 'master';
    const isMaster = user.tipo === 'master';

    const adminItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Colaboradores', path: '/colaboradores' },
        { icon: DollarSign, label: 'Financeiro', path: '/financeiro' },
        { icon: LayoutDashboard, label: 'Relatórios', path: '/relatorios' },
        { icon: UserCog, label: 'Usuários', path: '/usuarios' },
        { icon: Settings, label: 'Configurações', path: '/settings' },
    ];

    const providerItems = [
        { icon: LayoutDashboard, label: 'Meu Dashboard', path: '/' },
        { icon: DollarSign, label: 'Meus Pagamentos', path: '/meus-pagamentos' },
        { icon: FileText, label: 'Minhas Notas', path: '/minhas-notas' },
        { icon: FileText, label: 'Meus Documentos', path: '/meus-documentos' },
        { icon: FileText, label: 'Meus Contratos', path: '/meus-contratos' },
        { icon: Settings, label: 'Perfil', path: '/perfil' },
    ];

    const navItems = isAdmin ? adminItems : providerItems;

    const handleNavClick = () => {
        setMobileOpen(false);
    };

    return (
        <>
            {/* Mobile Menu Toggle */}
            <button
                className="mobile-menu-toggle"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
            >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Overlay */}
            <div
                className={`mobile-overlay ${mobileOpen ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar glass ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-icon" style={{
                        background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                    }}>Z</div>
                    <span className="logo-text" style={{
                        background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 'bold',
                        fontSize: '1.3rem'
                    }}>ZoraH</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={handleNavClick}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info" style={{ padding: '0 1rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{user.nome}</div>
                        <div>
                            {user.tipo === 'master' && 'Master'}
                            {user.tipo === 'admin' && 'Administrador'}
                            {user.tipo === 'prestador' && 'Prestador'}
                        </div>
                    </div>

                    <button
                        className="nav-item theme-toggle-btn"
                        onClick={toggleTheme}
                        style={{ marginBottom: '0.5rem' }}
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                    </button>

                    <button
                        className="nav-item logout-btn"
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                        }}
                    >
                        <LogOut size={20} />
                        <span>Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
