/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ShipmentList } from './components/ShipmentList';
import { ShipmentDetail } from './components/ShipmentDetail';
import { Settings } from './components/Settings';
import { FreightCalculator } from './components/FreightCalculator';
import { PackingConverter } from './components/packing/PackingConverter';
import { PinLoginModal } from './components/PinLoginModal';
import { AppProvider, useAppStore } from './store/useAppStore';
import { ThemeProvider } from './store/ThemeContext';

function MainContent() {
  const { isUnlocked } = useAppStore();
  
  // Hash-based routing initialization
  const getInitialTab = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (['shipments', 'calculator', 'packing-list', 'settings'].includes(hash)) {
        return hash;
      }
    }
    return 'shipments';
  };

  const getInitialShipmentId = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const parts = window.location.hash.replace(/^#\/?/, '').split('/');
      if (parts[0] === 'shipments' && parts[1]) {
        return parts[1];
      }
    }
    return null;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(getInitialShipmentId);
  const [calculatorPrefill, setCalculatorPrefill] = useState<{
    grossWeight?: number;
    chargeableWeight?: number;
    title?: string;
  } | null>(null);

  // Sync hash changes from browser back/forward or manual hash edits
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const parts = hash.split('/');
      const tab = parts[0];
      if (['shipments', 'calculator', 'packing-list', 'settings'].includes(tab)) {
        setActiveTab(tab);
        if (tab === 'shipments' && parts[1]) {
          setSelectedShipmentId(parts[1]);
        } else if (tab !== 'shipments') {
          setSelectedShipmentId(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when tab or selected shipment changes
  const updateHash = (tab: string, shipmentId: string | null) => {
    if (typeof window === 'undefined') return;
    let targetHash = `#/${tab}`;
    if (tab === 'shipments' && shipmentId) {
      targetHash = `#/shipments/${shipmentId}`;
    }
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab !== 'shipments') {
      setSelectedShipmentId(null);
      updateHash(tab, null);
    } else {
      updateHash('shipments', selectedShipmentId);
    }
  };

  const handleSelectShipment = (id: string | null) => {
    setSelectedShipmentId(id);
    updateHash('shipments', id);
  };

  const handleNavigateToCalculator = (prefill: { grossWeight?: number; chargeableWeight?: number; title?: string }) => {
    setCalculatorPrefill(prefill);
    setActiveTab('calculator');
    updateHash('calculator', null);
  };

  if (!isUnlocked) {
    return <PinLoginModal />;
  }

  const renderContent = () => {
    if (activeTab === 'settings') {
      return <Settings />;
    }
    if (activeTab === 'calculator') {
      return (
        <FreightCalculator 
          initialGrossWeight={calculatorPrefill?.grossWeight}
          initialChargeableWeight={calculatorPrefill?.chargeableWeight}
          sourceShipmentTitle={calculatorPrefill?.title}
          onClearPrefill={() => setCalculatorPrefill(null)}
        />
      );
    }
    if (activeTab === 'packing-list') {
      return null;
    }
    
    if (selectedShipmentId) {
      return (
        <ShipmentDetail 
          id={selectedShipmentId} 
          onBack={() => handleSelectShipment(null)}
          onIdChange={(newId) => handleSelectShipment(newId)}
          onNavigateToCalculator={handleNavigateToCalculator}
        />
      );
    }

    return <ShipmentList onSelect={(id) => handleSelectShipment(id)} />;
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      <div className={`h-full min-h-0 flex-col ${activeTab === 'packing-list' ? 'flex' : 'hidden'}`}>
        <PackingConverter 
          onNavigateToShipment={(id) => handleSelectShipment(id)} 
        />
      </div>
      {activeTab !== 'packing-list' && renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ThemeProvider>
  );
}
