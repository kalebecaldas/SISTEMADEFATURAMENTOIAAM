import React, { useState, useEffect } from 'react';
import { Save, Bell, Shield, Database, Mail, CheckCircle, XCircle, Loader, FileText } from 'lucide-react';
import api from '../services/api';
import '../styles/Settings.css';

const Settings = () => {
    const [loading, setLoading] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [emailTestResult, setEmailTestResult] = useState(null);

    // Configurações de email
    const [emailConfig, setEmailConfig] = useState({
        email_host: '',
        email_port: '',
        email_user: '',
        email_pass: '',
        email_secure: false,
        email_service: 'gmail',
        frontend_url: ''
    });

    // Configurações do sistema
    const [systemConfig, setSystemConfig] = useState({
        prazo_nota_fiscal: '15'
    });

    // Configurações de automação
    const [automationConfig, setAutomationConfig] = useState({
        lembrete_nf_ativo: true,
        lembrete_nf_intervalo_dias: 2,
        lembrete_nf_horario: '12:00'
    });

    // Carregar configurações ao montar o componente
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const response = await api.get('/settings');
            const configs = response.data;

            // Separar configurações de email e sistema
            setEmailConfig({
                email_host: configs.email_host || '',
                email_port: configs.email_port || '',
                email_user: configs.email_user || '',
                email_pass: configs.email_pass || '', // Não mostrar senha salva por segurança
                email_secure: configs.email_secure === 'true' || configs.email_secure === '1',
                email_service: configs.email_service || 'gmail',
                frontend_url: configs.frontend_url || ''
            });

            setSystemConfig({
                prazo_nota_fiscal: configs.prazo_nota_fiscal || '15'
            });

            setAutomationConfig({
                lembrete_nf_ativo: configs.lembrete_nf_ativo === 'true',
                lembrete_nf_intervalo_dias: parseInt(configs.lembrete_nf_intervalo_dias) || 2,
                lembrete_nf_horario: configs.lembrete_nf_horario || '12:00'
            });
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    };

    const handleEmailConfigChange = (field, value) => {
        setEmailConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSystemConfigChange = (field, value) => {
        setSystemConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const saveEmailConfig = async () => {
        setLoading(true);
        setEmailTestResult(null);
        try {
            await api.post('/settings', emailConfig);
            alert('Configurações de email salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar configurações de email:', error);
            alert('Erro ao salvar configurações de email');
        } finally {
            setLoading(false);
        }
    };

    const saveSystemConfig = async () => {
        setLoading(true);
        try {
            await api.post('/settings', systemConfig);
            alert('Configurações do sistema salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar configurações do sistema:', error);
            alert('Erro ao salvar configurações do sistema');
        } finally {
            setLoading(false);
        }
    };

    const testEmailConnection = async () => {
        setTestingEmail(true);
        setEmailTestResult(null);
        try {
            // Primeiro salvar as configurações
            await api.post('/settings', emailConfig);

            // Depois testar
            const response = await api.post('/settings/test-email');
            setEmailTestResult(response.data);
        } catch (error) {
            console.error('Erro ao testar email:', error);
            setEmailTestResult({
                success: false,
                message: error.response?.data?.error || 'Erro ao testar conexão de email'
            });
        } finally {
            setTestingEmail(false);
        }
    };

    const saveAutomationConfig = async () => {
        setLoading(true);
        try {
            await api.post('/settings/automation', automationConfig);
            alert('Configurações de automação salvas! O scheduler será reiniciado.');
        } catch (error) {
            console.error('Erro ao salvar automação:', error);
            alert('Erro ao salvar configurações de automação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1>Configurações</h1>
                <p>Gerencie as preferências do sistema</p>
            </div>

            <div className="settings-grid">
                {/* Configurações de Email */}
                <div className="glass-card settings-card">
                    <div className="card-header">
                        <Mail className="card-icon" />
                        <h2>Configurações de Email</h2>
                    </div>
                    <div className="card-content">
                        <div className="form-group">
                            <label>Serviço de Email</label>
                            <select
                                value={emailConfig.email_service}
                                onChange={(e) => handleEmailConfigChange('email_service', e.target.value)}
                            >
                                <option value="gmail">Gmail</option>
                                <option value="outlook">Outlook/Hotmail</option>
                                <option value="yahoo">Yahoo</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>

                        {emailConfig.email_service === 'custom' && (
                            <>
                                <div className="form-group">
                                    <label>Host SMTP</label>
                                    <input
                                        type="text"
                                        value={emailConfig.email_host}
                                        onChange={(e) => handleEmailConfigChange('email_host', e.target.value)}
                                        placeholder="smtp.exemplo.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Porta SMTP</label>
                                    <input
                                        type="number"
                                        value={emailConfig.email_port}
                                        onChange={(e) => handleEmailConfigChange('email_port', e.target.value)}
                                        placeholder="587"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={emailConfig.email_secure}
                                            onChange={(e) => handleEmailConfigChange('email_secure', e.target.checked)}
                                        />
                                        <span style={{ marginLeft: '8px' }}>Conexão Segura (SSL/TLS)</span>
                                    </label>
                                </div>
                            </>
                        )}

                        <div className="form-group">
                            <label>Email/Usuário</label>
                            <input
                                type="email"
                                value={emailConfig.email_user}
                                onChange={(e) => handleEmailConfigChange('email_user', e.target.value)}
                                placeholder="seu-email@exemplo.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>Senha</label>
                            <input
                                type="password"
                                value={emailConfig.email_pass}
                                onChange={(e) => handleEmailConfigChange('email_pass', e.target.value)}
                                placeholder="Senha do email ou App Password"
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                Para Gmail, use uma "App Password" ao invés da senha normal
                            </small>
                        </div>

                        <div className="form-group">
                            <label>URL do Frontend (para links de email)</label>
                            <input
                                type="text"
                                value={emailConfig.frontend_url}
                                onChange={(e) => handleEmailConfigChange('frontend_url', e.target.value)}
                                placeholder="http://192.168.1.100:5173 ou http://localhost:5173"
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                Use o IP da sua máquina (ex: 192.168.1.100) para funcionar em rede local. Deixe vazio para detecção automática.
                            </small>
                        </div>

                        {emailTestResult && (
                            <div style={{
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '16px',
                                backgroundColor: emailTestResult.success ? '#e8f5e9' : '#ffebee',
                                color: emailTestResult.success ? '#2e7d32' : '#c62828',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {emailTestResult.success ? (
                                    <CheckCircle size={20} />
                                ) : (
                                    <XCircle size={20} />
                                )}
                                <span>{emailTestResult.message}</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                            <button
                                className="btn-primary"
                                onClick={saveEmailConfig}
                                disabled={loading}
                            >
                                {loading ? <Loader size={18} className="spin" /> : <Save size={18} />}
                                <span>Salvar</span>
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={testEmailConnection}
                                disabled={testingEmail || loading}
                                style={{ backgroundColor: '#1976d2' }}
                            >
                                {testingEmail ? <Loader size={18} className="spin" /> : <Mail size={18} />}
                                <span>Testar Conexão</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Configurações do Sistema */}
                <div className="glass-card settings-card">
                    <div className="card-header">
                        <Database className="card-icon" />
                        <h2>Sistema</h2>
                    </div>
                    <div className="card-content">
                        <div className="form-group">
                            <label>Prazo de Nota Fiscal (Dias)</label>
                            <input
                                type="number"
                                value={systemConfig.prazo_nota_fiscal}
                                onChange={(e) => handleSystemConfigChange('prazo_nota_fiscal', e.target.value)}
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                Número de dias após o fechamento do mês para envio da nota fiscal
                            </small>
                        </div>
                        <div className="info-box" style={{
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            border: '1px solid rgba(33, 150, 243, 0.3)',
                            marginTop: '1rem'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                💡 <strong>Metas:</strong> As metas mensais são definidas nos modelos de contratos.
                                Acesse <strong>Contratos → Modelos e Metas</strong> para configurar.
                            </p>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={saveSystemConfig}
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? <Loader size={18} className="spin" /> : <Save size={18} />}
                            <span>Salvar Alterações</span>
                        </button>
                    </div>
                </div>

                {/* Automação de Lembretes */}
                <div className="glass-card settings-card">
                    <div className="card-header">
                        <Bell className="card-icon" />
                        <h2>Automação de Lembretes de NF</h2>
                    </div>
                    <div className="card-content">
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={automationConfig.lembrete_nf_ativo}
                                    onChange={(e) => setAutomationConfig({
                                        ...automationConfig,
                                        lembrete_nf_ativo: e.target.checked
                                    })}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                <span style={{ fontSize: '1rem', fontWeight: '500' }}>
                                    Ativar lembretes automáticos
                                </span>
                            </label>
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block', marginLeft: '32px' }}>
                                Envia lembretes automáticos para prestadores de serviço com notas fiscais pendentes
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Intervalo entre Lembretes (dias)</label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={automationConfig.lembrete_nf_intervalo_dias}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    lembrete_nf_intervalo_dias: parseInt(e.target.value)
                                })}
                                disabled={!automationConfig.lembrete_nf_ativo}
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                Dias de espera entre cada lembrete automático (recomendado: 2-3 dias)
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Horário de Envio</label>
                            <input
                                type="time"
                                value={automationConfig.lembrete_nf_horario}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    lembrete_nf_horario: e.target.value
                                })}
                                disabled={!automationConfig.lembrete_nf_ativo}
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                Horário diário para verificação e envio de lembretes
                            </small>
                        </div>

                        <div className="info-box" style={{
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            border: '1px solid rgba(33, 150, 243, 0.3)',
                            marginTop: '1rem'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                💡 <strong>Como funciona:</strong> O sistema verifica diariamente no horário configurado se há prestadores de serviço com notas fiscais pendentes. Se o último lembrete foi enviado há mais de {automationConfig.lembrete_nf_intervalo_dias} {automationConfig.lembrete_nf_intervalo_dias === 1 ? 'dia' : 'dias'}, um novo lembrete será enviado automaticamente.
                            </p>
                        </div>

                        {automationConfig.lembrete_nf_ativo && (
                            <div className="info-box" style={{
                                padding: '12px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                border: '1px solid rgba(76, 175, 80, 0.3)',
                                marginTop: '1rem'
                            }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#2e7d32' }}>
                                    ✅ <strong>Automação ativa!</strong> Próximo envio: {automationConfig.lembrete_nf_horario} (horário do servidor)
                                </p>
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            onClick={saveAutomationConfig}
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? <Loader size={18} className="spin" /> : <Save size={18} />}
                            <span>Salvar Configurações</span>
                        </button>
                    </div>
                </div>

                {/* Configurações de Notas Fiscais */}
                <div className="glass-card settings-card">
                    <div className="card-header">
                        <FileText className="card-icon" />
                        <h2>Notas Fiscais</h2>
                    </div>
                    <div className="card-content">
                        <div className="form-group">
                            <label>Prazo para Envio de NF (após fechamento do mês)</label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={systemConfig.prazo_nota_fiscal}
                                onChange={(e) => handleSystemConfigChange('prazo_nota_fiscal', e.target.value)}
                            />
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                Número de dias que os prestadores têm para enviar suas notas fiscais
                            </small>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    defaultChecked={true}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                <span style={{ fontSize: '1rem', fontWeight: '500' }}>
                                    Permite sobrescrita de notas não aprovadas
                                </span>
                            </label>
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block', marginLeft: '32px' }}>
                                Prestadores podem reenviar notas que ainda não foram aprovadas
                            </small>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    defaultChecked={false}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                <span style={{ fontSize: '1rem', fontWeight: '500' }}>
                                    Requer observação obrigatória no envio
                                </span>
                            </label>
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block', marginLeft: '32px' }}>
                                Prestadores devem incluir uma observação ao enviar a nota
                            </small>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    defaultChecked={true}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                <span style={{ fontSize: '1rem', fontWeight: '500' }}>
                                    Notificar admin sobre novos envios
                                </span>
                            </label>
                            <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block', marginLeft: '32px' }}>
                                Envia email ao administrador quando uma nota for enviada
                            </small>
                        </div>

                        <div className="info-box" style={{
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            border: '1px solid rgba(33, 150, 243, 0.3)',
                            marginTop: '1rem'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                💡 <strong>Regras de Aprovação:</strong> Notas aprovadas não podem ser sobrescritas.
                                Notas rejeitadas retornam ao status "Não Enviado" e podem ser reenviadas pelos prestadores.
                            </p>
                        </div>

                        <button
                            className="btn-primary"
                            onClick={saveSystemConfig}
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? <Loader size={18} className="spin" /> : <Save size={18} />}
                            <span>Salvar Configurações</span>
                        </button>
                    </div>
                </div>

                {/* Notificações */}
                <div className="glass-card settings-card">
                    <div className="card-header">
                        <Bell className="card-icon" />
                        <h2>Notificações</h2>
                    </div>
                    <div className="card-content">
                        <div className="setting-item">
                            <div className="setting-info">
                                <h3>Alertas de Email</h3>
                                <p>Receber emails sobre novos uploads</p>
                            </div>
                            <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="setting-item">
                            <div className="setting-info">
                                <h3>Relatórios Mensais</h3>
                                <p>Receber resumo mensal automático</p>
                            </div>
                            <label className="switch">
                                <input type="checkbox" />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
