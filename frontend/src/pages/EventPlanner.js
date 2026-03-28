import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, InputNumber, Row, Select, Space, Tag, Typography, message } from 'antd';
import { eventService } from '../services/eventService';
import { packageService } from '../services/packageService';
import { orderService } from '../services/orderService';
import { vendorService } from '../services/vendorService';
import { aiService } from '../services/aiService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const { Text } = Typography;

const sectorOrder = [
  'invitation',
  'makeup',
  'transportation',
  'catering',
  'decor',
  'photography',
  'videography',
  'music',
  'venue',
  'florist',
  'other',
];

const categoryToSector = {
  transportation: 'transportation',
  catering: 'catering',
  decor: 'decor',
  photography: 'photography',
  videography: 'videography',
  music: 'music',
  venue: 'venue',
  florist: 'florist',
  other: 'other',
};

const normalizeDeliverables = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const TELUGU_STATES = new Set(['telangana', 'andhra pradesh', 'ap', 'ts']);
const normalizeName = (value) => String(value || '').trim().toLowerCase();

const formatINR = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
};

const EventPlanner = () => {
  const [events, setEvents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [eventId, setEventId] = useState();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedVendorBySector, setSelectedVendorBySector] = useState({});
  const [selectedPackageBySector, setSelectedPackageBySector] = useState({});
  const [aiReasonBySector, setAiReasonBySector] = useState({});
  const [criteriaMap, setCriteriaMap] = useState({});
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [aiPlanning, setAiPlanning] = useState(false);
  const [optimizingBudget, setOptimizingBudget] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [scenarioGuests, setScenarioGuests] = useState();
  const [scenarioBudget, setScenarioBudget] = useState();
  const [budgetOptimization, setBudgetOptimization] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [eventsRes, packagesRes] = await Promise.all([
          eventService.getEvents({ limit: 50 }),
          packageService.getPublicPackages(),
        ]);
        const vendorsRes = await vendorService.searchVendors({ limit: 300 });
        setEvents(eventsRes.events || []);
        setPackages(packagesRes.packages || []);
        setVendors(vendorsRes.vendors || []);
      } catch (err) {
        message.error(getErrorMessage(err));
      }
    })();
  }, []);

  const packagesBySector = useMemo(() => {
    return packages.reduce((acc, pkg) => {
      const sector = categoryToSector[String(pkg.category || '').toLowerCase()] || 'other';
      if (!acc[sector]) acc[sector] = [];
      acc[sector].push(pkg);
      return acc;
    }, {});
  }, [packages]);

  const vendorsBySector = useMemo(() => {
    const groupedAll = vendors.reduce((acc, vendor) => {
      const sector = categoryToSector[String(vendor.category || '').toLowerCase()] || 'other';
      if (!acc[sector]) acc[sector] = [];
      acc[sector].push(vendor);
      return acc;
    }, {});

    const groupedTelugu = vendors.reduce((acc, vendor) => {
      const state = String(vendor.state || '').trim().toLowerCase();
      if (!TELUGU_STATES.has(state)) return acc;
      const sector = categoryToSector[String(vendor.category || '').toLowerCase()] || 'other';
      if (!acc[sector]) acc[sector] = [];
      acc[sector].push(vendor);
      return acc;
    }, {});

    return sectorOrder.reduce((acc, sector) => {
      const source = (groupedTelugu[sector] && groupedTelugu[sector].length > 0)
        ? groupedTelugu[sector]
        : (groupedAll[sector] || []);
      const seen = new Set();
      acc[sector] = source.filter((vendor) => {
        if (seen.has(vendor.id)) return false;
        seen.add(vendor.id);
        return true;
      });
      return acc;
    }, {});
  }, [vendors]);

  const steps = useMemo(
    () => ['choose_event', ...sectorOrder, 'review_quote'],
    []
  );

  const reviewStepIndex = steps.length - 1;
  const activeSector = currentStep > 0 && currentStep < reviewStepIndex
    ? steps[currentStep]
    : null;

  const selectedPackageList = useMemo(() => {
    return Object.values(selectedPackageBySector).filter(Boolean);
  }, [selectedPackageBySector]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId),
    [events, eventId]
  );

  const updateCriteria = (packageId, field, value) => {
    setCriteriaMap((prev) => ({
      ...prev,
      [packageId]: { ...(prev[packageId] || {}), [field]: value || 0 },
    }));
  };

  const selectVendorForSector = (sector, vendor) => {
    setSelectedVendorBySector((prev) => ({
      ...prev,
      [sector]: { id: vendor.id, businessName: vendor.businessName },
    }));
    setSelectedPackageBySector((prev) => ({ ...prev, [sector]: null }));
  };

  const selectPackageForSector = (sector, pkg) => {
    setSelectedPackageBySector((prev) => ({
      ...prev,
      [sector]: prev[sector]?.id === pkg.id ? null : pkg,
    }));
  };

  const canGoNext = () => {
    if (currentStep === 0) return Boolean(eventId);
    return currentStep < reviewStepIndex;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (currentStep === 0) message.warning('Select an event first');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, reviewStepIndex));
  };

  const goPrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goToStep = (index) => {
    if (index === 0 || eventId) {
      setCurrentStep(index);
      return;
    }
    message.warning('Select an event first');
  };

  const createQuote = async () => {
    if (!eventId) return message.warning('Select an event first');
    if (!selectedPackageList.length) {
      return message.warning('Select at least one sector package before generating quotation');
    }

    setQuoting(true);
    try {
      const payload = {
        eventId: Number(eventId),
        selections: selectedPackageList.map((pkg) => ({
          packageId: Number(pkg.id),
          criteria: criteriaMap[pkg.id] || {},
        })),
      };
      const res = await orderService.createQuote(payload);
      setQuote(res.order);
      message.success('Quotation generated');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setQuoting(false);
    }
  };

  const applyAiPlan = async () => {
    if (!eventId) {
      message.warning('Select an event first');
      return;
    }

    setAiPlanning(true);
    try {
      const res = await aiService.generatePlannerCopilot(eventId);
      const recs = res.plan?.recommendations || [];
      if (!recs.length) {
        message.warning('AI plan did not return recommendations');
        return;
      }

      const packageIndex = new Map(packages.map((pkg) => [pkg.id, pkg]));
      const vendorSelections = {};
      const packageSelections = {};
      const reasonSelections = {};
      const nextCriteria = {};
      let selectedCount = 0;

      recs.forEach((rec) => {
        if (!rec?.sector || !rec.packageId) return;
        const pkg = packageIndex.get(rec.packageId);
        if (!pkg) return;

        vendorSelections[rec.sector] = {
          id: rec.vendorId || pkg.vendor?.id,
          businessName: rec.vendorName || pkg.vendor?.businessName || 'Vendor',
        };
        packageSelections[rec.sector] = pkg;
        reasonSelections[rec.sector] = rec.reason || 'AI suggested this package based on your event profile.';

        const rules = pkg.estimationRules || {};
        nextCriteria[pkg.id] = {
          guests: Number(rules.perGuest || 0) > 0 ? Number(res.plan?.eventSnapshot?.guestCount || 0) : 0,
          hours: Number(rules.perHour || 0) > 0 ? 4 : 0,
        };
        selectedCount += 1;
      });

      setSelectedVendorBySector((prev) => ({ ...prev, ...vendorSelections }));
      setSelectedPackageBySector((prev) => ({ ...prev, ...packageSelections }));
      setAiReasonBySector((prev) => ({ ...prev, ...reasonSelections }));
      setCriteriaMap((prev) => ({ ...prev, ...nextCriteria }));
      if (currentStep === 0) setCurrentStep(1);
      message.success(`AI plan applied to ${selectedCount} sector(s). You can still edit each step.`);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setAiPlanning(false);
    }
  };

  const placeOrder = async () => {
    if (!quote?.id) return;
    setPlacingOrder(true);
    try {
      const res = await orderService.placeOrder(quote.id);
      setQuote((prev) => ({ ...prev, ...res.order }));
      message.success('Order placed');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setPlacingOrder(false);
    }
  };

  const runBudgetOptimization = async () => {
    if (!eventId) return message.warning('Select an event first');
    if (!selectedPackageList.length) return message.warning('Select at least one package first');

    setOptimizingBudget(true);
    try {
      const payload = {
        eventId,
        packageIds: selectedPackageList.map((pkg) => pkg.id),
        guestCount: Number(scenarioGuests || selectedEvent?.guestCount || 0),
        budget: Number(scenarioBudget || selectedEvent?.budget || 0),
      };
      const res = await aiService.optimizeBudget(payload);
      setBudgetOptimization(res.optimization || null);
      message.success('AI budget simulation ready');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setOptimizingBudget(false);
    }
  };

  const runAutoRebalance = async () => {
    if (!eventId) return message.warning('Select an event first');
    if (!selectedPackageList.length) return message.warning('Select at least one package first');

    setRebalancing(true);
    try {
      const payload = {
        eventId,
        packageIds: selectedPackageList.map((pkg) => pkg.id),
        guestCount: Number(scenarioGuests || selectedEvent?.guestCount || 0),
        budget: Number(scenarioBudget || selectedEvent?.budget || 0),
      };
      const res = await aiService.autoRebalance(payload);
      const plan = res.rebalance;
      const selections = plan?.selections || [];
      const swaps = plan?.swaps || [];
      if (!selections.length) {
        message.warning('AI could not rebalance with current data');
        return;
      }

      const packageIndex = new Map(packages.map((pkg) => [pkg.id, pkg]));
      const nextVendor = {};
      const nextPackage = {};
      const reasonUpdates = {};
      let applied = 0;

      selections.forEach((row) => {
        const pkg = packageIndex.get(row.packageId);
        if (!pkg || !row.sector) return;
        nextPackage[row.sector] = pkg;
        nextVendor[row.sector] = {
          id: row.vendorId || pkg.vendor?.id,
          businessName: row.vendorName || pkg.vendor?.businessName || 'Vendor',
        };
        const swap = swaps.find((s) => s.sector === row.sector && s.toPackageId === row.packageId);
        reasonUpdates[row.sector] = swap
          ? `AI rebalance: ${swap.reason}`
          : `AI rebalance kept this package for best budget fit.`;
        applied += 1;
      });

      setSelectedVendorBySector((prev) => ({ ...prev, ...nextVendor }));
      setSelectedPackageBySector((prev) => ({ ...prev, ...nextPackage }));
      setAiReasonBySector((prev) => ({ ...prev, ...reasonUpdates }));
      setQuote(null);
      setBudgetOptimization((prev) => (prev ? {
        ...prev,
        projectedTotal: plan.afterTotal,
        delta: Number(plan.afterTotal || 0) - Number(payload.budget || 0),
        status: Number(plan.afterTotal || 0) <= Number(payload.budget || 0) ? 'under_budget' : 'over_budget',
      } : prev));
      message.success(`AI rebalanced ${applied} sector selection(s). Review and regenerate quotation.`);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setRebalancing(false);
    }
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <Card className="phase-card" title="Step 1: Choose Event">
          <Select
            style={{ width: 520, maxWidth: '100%' }}
            placeholder="Select event"
            value={eventId}
            onChange={setEventId}
            options={events.map((e) => ({
              value: e.id,
              label: `${e.title} (${new Date(e.date).toLocaleDateString('en-IN')})`,
            }))}
          />
          <div className="phase-note" style={{ marginTop: 10 }}>
            This selected event will be used to build your end-to-end quote.
          </div>
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" ghost onClick={applyAiPlan} loading={aiPlanning} disabled={!eventId}>
              Generate with AI Co-Pilot
            </Button>
            <Text type="secondary">Auto-picks best-fit vendor/package per sector for you.</Text>
          </Space>
        </Card>
      );
    }

    if (activeSector) {
      const items = packagesBySector[activeSector] || [];
      const sectorVendors = vendorsBySector[activeSector] || [];
      const selectedId = selectedPackageBySector[activeSector]?.id;
      const selectedVendor = selectedVendorBySector[activeSector];
      const selectedVendorId = selectedVendor?.id;
      const selectedVendorName = normalizeName(selectedVendor?.businessName);
      const packagesForSelectedVendor = items.filter((pkg) => {
        const pkgVendorId = pkg.vendor?.id;
        const pkgVendorName = normalizeName(pkg.vendor?.businessName);
        if (selectedVendorId && pkgVendorId === selectedVendorId) return true;
        if (selectedVendorName && pkgVendorName && pkgVendorName === selectedVendorName) return true;
        return false;
      });
      return (
        <Card className="phase-card" title={`Step ${currentStep + 1}: ${activeSector.charAt(0).toUpperCase() + activeSector.slice(1)} Sector`}>
          <p className="phase-note">Choose vendor first, then choose one optional package from that vendor.</p>
          {aiReasonBySector[activeSector] ? (
            <Tag color="geekblue" style={{ marginBottom: 10 }}>
              AI reason: {aiReasonBySector[activeSector]}
            </Tag>
          ) : null}
          {sectorVendors.length === 0 ? (
            <div className="phase-empty">No vendors available in this sector yet. Click Next to continue.</div>
          ) : (
            <>
              <h3 className="phase-section-title">1) Select Vendor</h3>
              <div className="planner-vendor-list">
                {sectorVendors.map((vendor) => {
                  const selected = selectedVendorBySector[activeSector]?.id === vendor.id;
                  const vendorName = normalizeName(vendor.businessName);
                  const packageCount = items.filter((pkg) => {
                    const pkgVendorName = normalizeName(pkg.vendor?.businessName);
                    return pkg.vendor?.id === vendor.id || (vendorName && pkgVendorName === vendorName);
                  }).length;
                  return (
                    <Card key={vendor.id} size="small" className={`planner-vendor-card ${selected ? 'selected' : ''}`}>
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <Space wrap>
                          <Text strong>{vendor.businessName}</Text>
                          {vendor.isVerified ? <Tag color="green">Verified</Tag> : <Tag>Unverified</Tag>}
                          <Tag color="blue">{packageCount} packages</Tag>
                        </Space>
                        <Text type="secondary">Rating: {vendor.averageRating ?? '-'}</Text>
                        <Button type={selected ? 'primary' : 'default'} onClick={() => selectVendorForSector(activeSector, vendor)}>
                          {selected ? 'Selected Vendor' : 'Select Vendor'}
                        </Button>
                      </Space>
                    </Card>
                  );
                })}
              </div>

              <h3 className="phase-section-title" style={{ marginTop: 18 }}>2) Select Package</h3>
              {!selectedVendor ? (
                <Empty description="Select a vendor to view packages" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="planner-package-list">
                  {packagesForSelectedVendor.map((pkg) => {
                      const isSelected = selectedId === pkg.id;
                      const deliverables = normalizeDeliverables(pkg.deliverables);
                      return (
                        <Card
                          key={pkg.id}
                          className={`planner-package-card ${isSelected ? 'selected' : ''}`}
                          size="small"
                        >
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space wrap>
                              <Tag color="purple">{pkg.tier || 'standard'}</Tag>
                              <Tag>{pkg.category}</Tag>
                              <Button type={isSelected ? 'primary' : 'default'} size="small" onClick={() => selectPackageForSector(activeSector, pkg)}>
                                {isSelected ? 'Selected Package' : 'Select Package'}
                              </Button>
                            </Space>
                            <h3 className="phase-section-title">{pkg.title}</h3>
                            <Text strong>{pkg.vendor?.businessName || 'Vendor'}</Text>
                            <Text type="secondary">
                              Rating: {pkg.vendor?.averageRating ?? '-'} | Base Price: {formatINR(pkg.basePrice || 0)}
                            </Text>
                            <div>{pkg.description}</div>
                            {deliverables.length > 0 && (
                              <div>
                                <Text strong>Package Includes:</Text>
                                <ul className="planner-list">
                                  {deliverables.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                            <Row gutter={10}>
                              <Col>
                                <InputNumber
                                  min={0}
                                  placeholder="Guests"
                                  value={criteriaMap[pkg.id]?.guests}
                                  onChange={(v) => updateCriteria(pkg.id, 'guests', v)}
                                />
                              </Col>
                              <Col>
                                <InputNumber
                                  min={0}
                                  placeholder="Hours"
                                  value={criteriaMap[pkg.id]?.hours}
                                  onChange={(v) => updateCriteria(pkg.id, 'hours', v)}
                                />
                              </Col>
                            </Row>
                          </Space>
                        </Card>
                      );
                    })}
                  {packagesForSelectedVendor.length === 0 ? (
                    <Empty
                      description="This vendor has no structured package in this sector yet."
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : null}
                </div>
              )}
            </>
          )}
        </Card>
      );
    }

    return (
      <Card className="phase-card" title="Final Review and Quotation">
        {selectedPackageList.length === 0 ? (
          <div className="phase-empty">No sector package selected yet.</div>
        ) : (
          <div className="planner-review-list">
            {selectedPackageList.map((pkg) => {
              const sector = Object.keys(selectedPackageBySector).find((key) => selectedPackageBySector[key]?.id === pkg.id);
              return (
                <Card key={pkg.id} size="small" className="planner-review-card">
                  <Space direction="vertical" size={4}>
                    <Text strong>{pkg.title}</Text>
                    <Text type="secondary">
                      Sector: {sector} | Vendor: {pkg.vendor?.businessName} | Tier: {pkg.tier}
                    </Text>
                    {aiReasonBySector[sector] ? <Tag color="geekblue">AI: {aiReasonBySector[sector]}</Tag> : null}
                    <Text>Base: {formatINR(pkg.basePrice || 0)}</Text>
                  </Space>
                </Card>
              );
            })}
          </div>
        )}
        <Space direction="vertical" size={12} style={{ marginTop: 16 }}>
          <Card size="small" title="AI Budget Optimizer (What-if Simulator)">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space wrap>
                <InputNumber
                  min={1}
                  placeholder={`Guests (default ${selectedEvent?.guestCount || '-'})`}
                  value={scenarioGuests}
                  onChange={setScenarioGuests}
                />
                <InputNumber
                  min={0}
                  placeholder={`Budget INR (default ${selectedEvent?.budget || '-'})`}
                  value={scenarioBudget}
                  onChange={setScenarioBudget}
                />
                <Button onClick={runBudgetOptimization} loading={optimizingBudget}>
                  Run AI Budget Simulation
                </Button>
                <Button
                  type="primary"
                  onClick={runAutoRebalance}
                  loading={rebalancing}
                  disabled={!selectedPackageList.length}
                >
                  Auto-Rebalance Selection
                </Button>
              </Space>
              {budgetOptimization ? (
                <Space direction="vertical" size={6}>
                  <div>
                    <strong>Projected Total:</strong> {formatINR(budgetOptimization.projectedTotal)}
                    {' '}|{' '}
                    <strong>Status:</strong>{' '}
                    <Tag color={budgetOptimization.status === 'under_budget' ? 'green' : 'volcano'}>
                      {budgetOptimization.status === 'under_budget' ? 'Under Budget' : 'Over Budget'}
                    </Tag>
                    {' '}|{' '}
                    <strong>Delta:</strong> {formatINR(budgetOptimization.delta)}
                  </div>
                  <ul className="planner-list">
                    {(budgetOptimization.suggestions || []).map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </Space>
              ) : (
                <Text type="secondary">Run simulation to get AI suggestions for budget changes.</Text>
              )}
            </Space>
          </Card>
          {!quote ? (
            <Tag color="default">Generate quote when ready</Tag>
          ) : (
            <>
              <div><strong>Status:</strong> <Tag color="blue">{quote.status}</Tag></div>
              <div><strong>Quoted Total:</strong> {formatINR(quote.quotedTotal)}</div>
              <div><strong>Items:</strong> {quote.items?.length || 0}</div>
            </>
          )}
          <Space direction="vertical" size={8}>
            <Space wrap>
              <Button type="primary" onClick={createQuote} loading={quoting} disabled={quoting}>
                Generate Final Quotation
              </Button>
              {quote ? (
                <Button type="primary" onClick={placeOrder} loading={placingOrder} disabled={quote.status === 'placed'}>
                  Place Order
                </Button>
              ) : null}
            </Space>
            <Text type="secondary" style={{ display: 'block', maxWidth: 560, fontSize: 12 }}>
              Requires an organizer (or admin) account for this event; vendor logins cannot call this API. Packages must still be active with verified vendors — refresh the page if vendors were unverified after you picked them.
            </Text>
          </Space>
        </Space>
      </Card>
    );
  };

  return (
    <div className="phase-page">
      <Space direction="vertical" size={16} className="phase-stack">
        <Card className="phase-hero">
          <h1 className="phase-title">Event Planner</h1>
          <p className="phase-subtitle">Step-by-step sectors for Telangana and Andhra Pradesh: review details, select optional package, and continue.</p>
        </Card>
        <Card className="phase-card">
          <div className="planner-layout">
            <aside className="planner-step-rail">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isDone = index < currentStep;
                const label = step === 'choose_event'
                  ? 'Choose Event'
                  : step === 'review_quote'
                    ? 'Review & Quote'
                    : `${step.charAt(0).toUpperCase()}${step.slice(1)} Sector`;
                return (
                  <button
                    key={step}
                    type="button"
                    className={`planner-step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                    onClick={() => goToStep(index)}
                  >
                    <span className="planner-step-index">{index + 1}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </aside>
            <div className="planner-main-pane">
              <div className="planner-progress-head">
                <Text strong>Step {currentStep + 1} of {steps.length}</Text>
                <Text type="secondary">
                  {currentStep === 0 ? 'Choose Event' : currentStep === reviewStepIndex ? 'Review & Quote' : `${activeSector?.charAt(0).toUpperCase()}${activeSector?.slice(1)} Sector`}
                </Text>
              </div>
              <div style={{ marginTop: 18 }}>{renderStepContent()}</div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <Button onClick={goPrevious} disabled={currentStep === 0}>Previous</Button>
                {currentStep < reviewStepIndex ? (
                  <Button type="primary" onClick={goNext} disabled={!canGoNext()}>
                    Next
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </Space>
    </div>
  );
};

export default EventPlanner;
