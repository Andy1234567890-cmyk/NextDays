'use client';

import { Icon } from '@iconify/react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tasko/ui';
import { format, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { GoBDService } from '@/services/gobdService';
import type { GoBDComplianceReport } from '@/types/gobdTypes';

interface ComplianceDashboardProps {
  companyId: string;
  userRole?: 'admin' | 'steuerberater' | 'user';
}

export function ComplianceDashboard({ companyId, userRole = 'user' }: ComplianceDashboardProps) {
  const t = useTranslations('finance');
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });

  const [report, setReport] = useState<GoBDComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const complianceReport = await GoBDService.generateComplianceReport(
        companyId,
        selectedPeriod,
      );
      setReport(complianceReport);
    } catch (error) {
      console.error('Failed to load compliance report:', error);
      toast.error(t('ComplianceDashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedPeriod, t]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const generateReport = async () => {
    try {
      setGenerating(true);
      await loadReport();
      toast.success(t('ComplianceDashboard.reportUpdated'));
    } catch (error) {
      console.error('Report generation failed:', error);
      toast.error(t('ComplianceDashboard.generationError'));
    } finally {
      setGenerating(false);
    }
  };

  const exportReport = () => {
    if (!report) return;

    const reportData = {
      ...report,
      exportDate: new Date().toISOString(),
      exportedBy: companyId,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gobd-compliance-${selectedPeriod}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t('ComplianceDashboard.exportSuccess'));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'non-compliant':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Icon icon="lucide:check-circle" className="h-4 w-4" />;
      case 'warning':
        return <Icon icon="lucide:alert-triangle" className="h-4 w-4" />;
      case 'non-compliant':
        return <Icon icon="lucide:alert-triangle" className="h-4 w-4" />;
      default:
        return <Icon icon="lucide:clock" className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'compliant':
        return t('ComplianceDashboard.statusCompliant');
      case 'warning':
        return t('ComplianceDashboard.statusWarning');
      case 'non-compliant':
        return t('ComplianceDashboard.statusNonCompliant');
      default:
        return status;
    }
  };

  const getIssueLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return t('ComplianceDashboard.severityCritical');
      case 'high':
        return t('ComplianceDashboard.severityHigh');
      case 'medium':
        return t('ComplianceDashboard.severityMedium');
      case 'low':
        return t('ComplianceDashboard.severityLow');
      default:
        return severity;
    }
  };

  const getIssueColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    const value = format(date, 'yyyy-MM');
    const label = format(date, 'MMMM yyyy', { locale: de });
    return { value, label };
  });

  if (loading && !report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:shield" className="h-5 w-5 text-accent" />
            {t('ComplianceDashboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-3/4 rounded bg-gray-200"></div>
            <div className="h-4 w-1/2 rounded bg-gray-200"></div>
            <div className="h-4 w-2/3 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="lucide:shield" className="h-5 w-5 text-accent" />
                {t('ComplianceDashboard.title')}
                {userRole === 'steuerberater' && (
                  <Badge className="border-blue-200 bg-blue-100 text-blue-700">
                    {t('ComplianceDashboard.taxAdvisorView')}
                  </Badge>
                )}
              </CardTitle>
              {report && (
                <p className="mt-1 text-gray-600 text-sm">
                  {t('ComplianceDashboard.lastReport', {
                    date: format(report.generatedAt, 'dd.MM.yyyy HH:mm'),
                  })}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button variant="outline" onClick={generateReport} disabled={generating}>
                  {generating ? (
                    <>
                      <Icon icon="lucide:clock" className="mr-2 h-4 w-4 animate-spin" />
                      {t('ComplianceDashboard.generating')}
                    </>
                  ) : (
                    <>
                      <Icon icon="lucide:bar-chart3" className="mr-2 h-4 w-4" />
                      {t('ComplianceDashboard.refresh')}
                    </>
                  )}
                </Button>

                {report && (
                  <Button variant="outline" onClick={exportReport}>
                    <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                    {t('ComplianceDashboard.export')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {report && (
        <>
          {/* Status-Übersicht */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="lucide:trending-up" className="h-5 w-5 text-accent" />
                {t('ComplianceDashboard.complianceStatus')}
                <Badge className={getStatusColor(report.status)}>
                  {getStatusIcon(report.status)}
                  <span className="ml-1 capitalize">{getStatusLabel(report.status)}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <div className="font-bold text-2xl text-blue-600">
                    {report.summary.totalDocuments}
                  </div>
                  <p className="flex items-center justify-center gap-1 text-blue-700 text-sm">
                    <Icon icon="lucide:file-text" className="h-4 w-4" />
                    {t('ComplianceDashboard.totalDocuments')}
                  </p>
                </div>

                <div className="rounded-lg border p-4 text-center">
                  <div className="font-bold text-2xl text-green-600">
                    {report.summary.lockedDocuments}
                  </div>
                  <p className="flex items-center justify-center gap-1 text-green-700 text-sm">
                    <Icon icon="lucide:check-circle" className="h-4 w-4" />
                    {t('ComplianceDashboard.lockedDocuments')}
                  </p>
                </div>

                <div className="rounded-lg border p-4 text-center">
                  <div className="font-bold text-2xl text-orange-600">
                    {report.summary.unlockedDocuments}
                  </div>
                  <p className="flex items-center justify-center gap-1 text-orange-700 text-sm">
                    <Icon icon="lucide:clock" className="h-4 w-4" />
                    {t('ComplianceDashboard.unlockedDocuments')}
                  </p>
                </div>

                <div className="rounded-lg border p-4 text-center">
                  <div className="font-bold text-2xl text-red-600">
                    {report.summary.overdueDocuments}
                  </div>
                  <p className="flex items-center justify-center gap-1 text-red-700 text-sm">
                    <Icon icon="lucide:alert-triangle" className="h-4 w-4" />
                    {t('ComplianceDashboard.overdueDocuments')}
                  </p>
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-sm">{t('ComplianceDashboard.lockProgress')}</span>
                  <span className="text-gray-600 text-sm">
                    {Math.round(
                      (report.summary.lockedDocuments / report.summary.totalDocuments) * 100,
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={(report.summary.lockedDocuments / report.summary.totalDocuments) * 100}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Compliance-Issues */}
          {report.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon icon="lucide:alert-triangle" className="h-5 w-5 text-orange-500" />
                  {t('ComplianceDashboard.complianceIssues')}
                  <Badge className="border-orange-200 bg-orange-100 text-orange-700">
                    {t('ComplianceDashboard.issueCount', { count: report.issues.length })}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.issues.map((issue, index) => (
                    <div key={index} className="rounded-lg border p-4">
                      <div className="flex items-start gap-3">
                        <Badge className={getIssueColor(issue.severity)}>
                          {getIssueLabel(issue.severity)}
                        </Badge>
                        <div className="flex-1">
                          <h4 className="font-medium">{issue.message}</h4>
                          <p className="mt-1 text-gray-600 text-sm">
                            {t('ComplianceDashboard.affectedDocuments', {
                              count: issue.documentIds.length,
                            })}
                          </p>
                          {issue.resolution && (
                            <div className="mt-2 rounded bg-blue-50 p-2 text-blue-800 text-sm">
                              <strong>{t('ComplianceDashboard.resolution')}</strong>{' '}
                              {issue.resolution}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empfehlungen */}
          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon icon="lucide:check-circle" className="h-5 w-5 text-green-500" />
                  {t('ComplianceDashboard.recommendations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-lg bg-green-50 p-3">
                      <Icon
                        icon="lucide:check-circle"
                        className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                      />
                      <p className="text-green-800 text-sm">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steuerberater-spezifische Informationen */}
          {userRole === 'steuerberater' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon icon="lucide:users" className="h-5 w-5 text-accent" />
                  {t('ComplianceDashboard.taxAdvisorInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 font-medium">{t('ComplianceDashboard.datevExportReady')}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">{t('ComplianceDashboard.invoices')}</span>
                        <span className="font-medium">{report.summary.lockedDocuments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">{t('ComplianceDashboard.cancellations')}</span>
                        <span className="font-medium">{report.summary.stornoDocuments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">{t('ComplianceDashboard.status')}</span>
                        <Badge
                          className={
                            report.summary.unlockedDocuments === 0
                              ? 'border-green-200 bg-green-100 text-green-700'
                              : 'border-orange-200 bg-orange-100 text-orange-700'
                          }
                        >
                          {report.summary.unlockedDocuments === 0
                            ? t('ComplianceDashboard.exportPossible')
                            : t('ComplianceDashboard.incomplete')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-medium">{t('ComplianceDashboard.auditNotes')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
                        <span>{t('ComplianceDashboard.consecutiveNumbering')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
                        <span>{t('ComplianceDashboard.immutability')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.summary.overdueDocuments === 0 ? (
                          <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
                        ) : (
                          <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-red-600" />
                        )}
                        <span>{t('ComplianceDashboard.timelyLocking')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erfolgreiche Compliance */}
          {report.status === 'compliant' && (
            <Alert className="border-green-200 bg-green-50">
              <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>{t('ComplianceDashboard.congratulations')}</strong>{' '}
                {t('ComplianceDashboard.fullyCompliant')}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
