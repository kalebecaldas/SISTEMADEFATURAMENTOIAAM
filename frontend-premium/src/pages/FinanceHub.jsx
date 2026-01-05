import React, { useState } from 'react';
import { Upload, CheckSquare, DollarSign, FileText } from 'lucide-react';
import UploadPage from './Upload';
import InvoiceDashboard from './InvoiceDashboard';
import PaymentNotifications from './PaymentNotifications';
import Invoices from './Invoices';
import '../styles/TabbedPage.css';

const FinanceHub = () => {
    const [activeTab, setActiveTab] = useState('upload');

    return (
        <div className="tabbed-page">
            <div className="tabs-container glass-card">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upload')}
                    >
                        <Upload size={18} />
                        <span>Upload</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'control' ? 'active' : ''}`}
                        onClick={() => setActiveTab('control')}
                    >
                        <CheckSquare size={18} />
                        <span>Controle de Envios</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payments')}
                    >
                        <DollarSign size={18} />
                        <span>Pagamentos</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'invoices' ? 'active' : ''}`}
                        onClick={() => setActiveTab('invoices')}
                    >
                        <FileText size={18} />
                        <span>Notas Fiscais</span>
                    </button>
                </div>
            </div>

            <div className="tab-content">
                {activeTab === 'upload' && <UploadPage />}
                {activeTab === 'control' && <InvoiceDashboard />}
                {activeTab === 'payments' && <PaymentNotifications />}
                {activeTab === 'invoices' && <Invoices />}
            </div>
        </div>
    );
};

export default FinanceHub;
