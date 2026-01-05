import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ConfirmRegistration from './pages/ConfirmRegistration';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import Invoices from './pages/Invoices';
import Collaborators from './pages/Collaborators';
import Settings from './pages/Settings';
import Contracts from './pages/Contracts';
import GenerateContract from './pages/GenerateContract';
import Documents from './pages/Documents';
import MyInvoices from './pages/MyInvoices';
import PaymentNotifications from './pages/PaymentNotifications';
import ProviderPaymentHistory from './pages/ProviderPaymentHistory';
import InvoiceDashboard from './pages/InvoiceDashboard';
import AdvancedReports from './pages/AdvancedReports';
import ContractManagement from './pages/ContractManagement';
import ContractsHub from './pages/ContractsHub';
import FinanceHub from './pages/FinanceHub';
import Users from './pages/Users';
import MyContracts from './pages/MyContracts';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAuthenticated = !!localStorage.getItem('token');

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.tipo)) {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  const isAuthenticated = !!localStorage.getItem('token'); // This variable is now primarily for the old commented out route structure, but kept for consistency if needed elsewhere.

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/confirmar-cadastro" element={<ConfirmRegistration />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />

          {/* Rotas de Admin */}
          <Route path="invoices" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <Invoices />
            </ProtectedRoute>
          } />
          {/* Redirect antigo para novo */}
          <Route path="providers" element={<Navigate to="/colaboradores" replace />} />
          <Route path="colaboradores" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <Collaborators />
            </ProtectedRoute>
          } />
          <Route path="contratos" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <ContractsHub />
            </ProtectedRoute>
          } />
          <Route path="contratos/gerar" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <GenerateContract />
            </ProtectedRoute>
          } />
          <Route path="financeiro" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <FinanceHub />
            </ProtectedRoute>
          } />
          <Route path="notas-dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <InvoiceDashboard />
            </ProtectedRoute>
          } />
          <Route path="relatorios" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <AdvancedReports />
            </ProtectedRoute>
          } />
          <Route path="gestao-contratos" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <ContractManagement />
            </ProtectedRoute>
          } />
          <Route path="usuarios" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="settings" element={<Settings />} />

          {/* Rotas Compartilhadas ou de Prestador */}
          <Route path="documentos/:prestadorId" element={<Documents />} />
          <Route path="meus-documentos" element={<Documents />} />
          <Route path="minhas-notas" element={<MyInvoices />} />
          <Route path="meus-pagamentos" element={<ProviderPaymentHistory />} />
          <Route path="meus-contratos" element={
            <ProtectedRoute allowedRoles={['prestador']}>
              <MyContracts />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
