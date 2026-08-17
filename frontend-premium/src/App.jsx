import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';

// Cada página vira um chunk próprio: o bundle único passava de 1,3 MB e todo
// primeiro acesso baixava o app inteiro para ver uma tela só.
const ConfirmRegistration = lazy(() => import('./pages/ConfirmRegistration'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UploadPage = lazy(() => import('./pages/Upload'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Collaborators = lazy(() => import('./pages/Collaborators'));
const Settings = lazy(() => import('./pages/Settings'));
const Contracts = lazy(() => import('./pages/Contracts'));
const GenerateContract = lazy(() => import('./pages/GenerateContract'));
const Documents = lazy(() => import('./pages/Documents'));
const MyInvoices = lazy(() => import('./pages/MyInvoices'));
const PaymentNotifications = lazy(() => import('./pages/PaymentNotifications'));
const ProviderPaymentHistory = lazy(() => import('./pages/ProviderPaymentHistory'));
const InvoiceDashboard = lazy(() => import('./pages/InvoiceDashboard'));
const AdvancedReports = lazy(() => import('./pages/AdvancedReports'));
const ContractManagement = lazy(() => import('./pages/ContractManagement'));
const ContractsHub = lazy(() => import('./pages/ContractsHub'));
const FinanceHub = lazy(() => import('./pages/FinanceHub'));
const Users = lazy(() => import('./pages/Users'));
const MyContracts = lazy(() => import('./pages/MyContracts'));
const CalcularPagamentos = lazy(() => import('./pages/CalcularPagamentos'));
const EspecialidadesAdmin = lazy(() => import('./pages/EspecialidadesAdmin'));
const EscalasTurnos = lazy(() => import('./pages/EscalasTurnos'));

/** Fallback enquanto o chunk da rota chega. */
const CarregandoRota = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="cp-spinner" />
  </div>
);

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
      <Suspense fallback={<CarregandoRota />}>
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
          <Route path="calcular-pagamentos" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <CalcularPagamentos />
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
          <Route path="especialidades" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <EspecialidadesAdmin />
            </ProtectedRoute>
          } />
          <Route path="escalas" element={
            <ProtectedRoute allowedRoles={['admin', 'master']}>
              <EscalasTurnos />
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
      </Suspense>
    </Router>
  );
}

export default App;
