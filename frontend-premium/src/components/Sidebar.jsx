import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, Users, Settings, LogOut, DollarSign, UserCog, Menu, X, Sun, Moon, Calculator, Stethoscope, CalendarDays } from 'lucide-react';
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
        { icon: Calculator, label: 'Calcular Pagamentos', path: '/calcular-pagamentos' },
        { icon: LayoutDashboard, label: 'Relatórios', path: '/relatorios' },
        { icon: Stethoscope, label: 'Especialidades', path: '/especialidades' },
        { icon: CalendarDays, label: 'Escalas e Turnos', path: '/escalas' },
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
                    <div className="user-info" style={{
                        padding: '0.4rem 0.75rem 0.6rem',
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                    }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.nome}>
                            {user.nome || 'Usuário'}
                        </span>
                        <span style={{ opacity: 0.7 }}>·</span>
                        <span>
                            {user.tipo === 'master' && 'Master'}
                            {user.tipo === 'admin' && 'Admin'}
                            {user.tipo === 'prestador' && 'Prestador'}
                        </span>
                    </div>

                    <button
                        className="nav-item theme-toggle-btn"
                        onClick={toggleTheme}
                        style={{ marginBottom: '0.35rem', padding: '0.5rem 0.75rem', fontSize: '0.78rem' }}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                    </button>

                    <button
                        className="nav-item logout-btn"
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                        }}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem' }}
                    >
                        <LogOut size={16} />
                        <span>Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
