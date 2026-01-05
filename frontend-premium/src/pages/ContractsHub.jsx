import React, { useState } from 'react';
import { FileText, Settings } from 'lucide-react';
import Contracts from './Contracts';
import ContractManagement from './ContractManagement';
import '../styles/TabbedPage.css';

const ContractsHub = () => {
    const [activeTab, setActiveTab] = useState('list');

    return (
        <div className="tabbed-page">
            <div className="page-header">
                <h1>📄 Contratos</h1>
                <p>Gerencie contratos e modelos</p>
            </div>

            <div className="tabs-container glass-card">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        <FileText size={18} />
                        <span>Contratos Gerados</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'models' ? 'active' : ''}`}
                        onClick={() => setActiveTab('models')}
                    >
                        <Settings size={18} />
                        <span>Modelos e Metas</span>
                    </button>
                </div>
            </div>

            <div className="tab-content">
                {activeTab === 'list' && <Contracts />}
                {activeTab === 'models' && <ContractManagement />}
            </div>
        </div>
    );
};

export default ContractsHub;
