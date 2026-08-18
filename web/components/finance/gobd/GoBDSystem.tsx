'use client';

import { Icon } from '@iconify/react';
import { Badge, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@tasko/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

// Import der modularen Komponenten
import { AutoLockSettings } from './AutoLockSettings';
import { ComplianceDashboard } from './ComplianceDashboard';
import { SevDeskLockManager } from './SevDeskLockManager';
import { StornoManager } from './StornoManager';

// Mock-Dokument für Demo-Zwecke
const mockDocument = {
  id: 'invoice-123',
  documentNumber: 'RE-MOCK-001',
  documentType: 'invoice' as const,
  createdAt: new Date('2025-10-15'),
  amount: 1190.0,
  customerId: 'customer-1',
  companyId: 'company-1',
  gobdStatus: {
    isLocked: true,
    lockedAt: new Date('2025-10-20'),
    lockedBy: 'user-1',
    lockReason: 'auto' as const,
    auditTrail: [],
  },
};

interface GoBDSystemProps {
  companyId: string;
  userRole?: 'admin' | 'steuerberater' | 'user';
  className?: string;
}

export function GoBDSystem({ companyId, userRole = 'user', className }: GoBDSystemProps) {
  const t = useTranslations('finance');
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    {
      id: 'dashboard',
      label: t('GoBDSystem.tabDashboard'),
      icon: <Icon icon="lucide:chart-bar" className="h-4 w-4" />,
      component: <ComplianceDashboard companyId={companyId} userRole={userRole} />,
    },
    {
      id: 'settings',
      label: t('GoBDSystem.tabSettings'),
      icon: <Icon icon="lucide:settings" className="h-4 w-4" />,
      component: <AutoLockSettings companyId={companyId} />,
    },
    {
      id: 'manual',
      label: t('GoBDSystem.tabManual'),
      icon: <Icon icon="lucide:lock" className="h-4 w-4" />,
      component: <SevDeskLockManager companyId={companyId} />,
    },
    {
      id: 'storno',
      label: t('GoBDSystem.tabStorno'),
      icon: <Icon icon="lucide:file-x" className="h-4 w-4" />,
      component: <StornoManager companyId={companyId} document={mockDocument} />,
    },
  ];

  return (
    <div className={className}>
      {/* Header */}
      <Card className="mb-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-3">
              <Icon icon="lucide:shield" className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="font-bold text-2xl text-gray-900">{t('GoBDSystem.title')}</h1>
              <p className="text-gray-600">{t('GoBDSystem.subtitle')}</p>
            </div>
          </div>

          <div className="text-right">
            <Badge className="border-green-200 bg-green-100 text-green-700">
              <Icon icon="lucide:shield" className="mr-1 h-3 w-3" />
              {t('GoBDSystem.compliantBadge')}
            </Badge>
            <p className="mt-1 text-gray-500 text-sm">{t('GoBDSystem.autoComplianceHint')}</p>
          </div>
        </div>
      </Card>

      {/* Info-Banner für neue Benutzer */}
      <Card className="mb-6 border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Icon icon="lucide:book-open" className="mt-0.5 h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <h3 className="mb-1 font-medium text-blue-900">{t('GoBDSystem.infoTitle')}</h3>
            <p className="mb-3 text-blue-800 text-sm">{t('GoBDSystem.infoBody')}</p>

            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                <span>{t('GoBDSystem.infoBulletAutoLock')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                <span>{t('GoBDSystem.infoBullet30DayRule')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                <span>{t('GoBDSystem.infoBulletAuditTrail')}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hauptinhalt mit Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2 text-sm">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-6">
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer-Hinweise */}
      <Card className="mt-6 border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <Icon icon="lucide:alert-triangle" className="h-4 w-4" />
          <span>
            <strong>{t('GoBDSystem.footerNoticeLabel')}</strong> {t('GoBDSystem.footerNoticeBody')}
          </span>
        </div>
      </Card>
    </div>
  );
}
