import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { eventService } from '../services/eventService';
import { notificationService } from '../services/notificationService';
import { aiService } from '../services/aiService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/** Browser cache for last analyzed segmentation (not sent to server). */
const CONTACT_INTEL_STORAGE_KEY = 'eventos_contact_intelligence_v1';

const LIST_OWNER_OPTIONS = [
  { value: 'unspecified', label: 'Whose list? — Not specified' },
  { value: 'groom', label: "Groom's phone / account" },
  { value: 'bride', label: "Bride's phone / account" },
  { value: 'groom_father', label: "Groom's father" },
  { value: 'groom_mother', label: "Groom's mother" },
  { value: 'bride_father', label: "Bride's father" },
  { value: 'bride_mother', label: "Bride's mother" },
  { value: 'other', label: 'Other (use notes below)' },
];

function saveContactAnalysisLocal(payload) {
  try {
    const record = { version: 1, savedAt: new Date().toISOString(), ...payload };
    localStorage.setItem(CONTACT_INTEL_STORAGE_KEY, JSON.stringify(record));
    console.log('[ContactIntelligence UI] saved to localStorage', {
      key: CONTACT_INTEL_STORAGE_KEY,
      contacts: record.contacts?.length,
      listOwner: record.listOwnerContext,
    });
  } catch (e) {
    console.warn('[ContactIntelligence UI] localStorage save failed', e?.message);
  }
}

function loadContactAnalysisLocal() {
  try {
    const raw = localStorage.getItem(CONTACT_INTEL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[ContactIntelligence UI] localStorage load failed', e?.message);
    return null;
  }
}

const parseContactsFromText = (value) => {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, phone, relationLabel, email] = line.split(',').map((part) => (part || '').trim());
      return { name, phone, relationLabel, email };
    })
    .filter((row) => row.name && (row.phone || row.email));
};

const ContactIntelligenceCenter = () => {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState();
  const [contactsInput, setContactsInput] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sending, setSending] = useState(false);
  const [analyzed, setAnalyzed] = useState(null);
  const [targetGroup, setTargetGroup] = useState('all');
  const [reminderMessage, setReminderMessage] = useState('Namaste! Invitation reminder from EventOS. Please check your invite and RSVP.');
  const [collageStatus, setCollageStatus] = useState(null);
  const [runningCollage, setRunningCollage] = useState(false);
  const [fetchingCollage, setFetchingCollage] = useState(false);
  const [collageStyle, setCollageStyle] = useState('traditional');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvPaste, setCsvPaste] = useState('');
  const [listOwnerContext, setListOwnerContext] = useState('unspecified');
  const [listOwnerNotes, setListOwnerNotes] = useState('');
  /** Table filter: segment + optional name search */
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoadingEvents(true);
      try {
        const data = await eventService.getEvents({ limit: 100 });
        setEvents(data.events || []);
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, []);

  useEffect(() => {
    const prev = loadContactAnalysisLocal();
    if (prev?.savedAt) {
      console.log('[ContactIntelligence UI] previous local cache', prev.savedAt, 'owner=', prev.listOwnerContext);
    }
  }, []);

  const parsedContacts = useMemo(() => parseContactsFromText(contactsInput), [contactsInput]);

  const analyzeContacts = async () => {
    const hasCsv = Boolean(csvPaste.trim());
    if (!hasCsv && !parsedContacts.length) {
      message.warning('Add manual lines or paste/import a Google Contacts CSV.');
      return;
    }
    setAnalyzing(true);
    try {
      console.log('[ContactIntelligence UI] analyze start', {
        listOwnerContext,
        listOwnerNotes: listOwnerNotes?.slice(0, 120),
        hasCsv,
        manualCount: parsedContacts.length,
      });
      const res = hasCsv
        ? await notificationService.analyzeContacts({
            csv: csvPaste,
            useOpenAi: true,
            listOwnerContext,
            listOwnerNotes,
          })
        : await notificationService.analyzeContacts({
            contacts: parsedContacts,
            useOpenAi: true,
            listOwnerContext,
            listOwnerNotes,
          });
      setSegmentFilter('all');
      setNameFilter('');
      setAnalyzed(res);
      console.log('[ContactIntelligence UI] analyze done', {
        aiUsed: res.aiUsed,
        openAiRefinedCount: res.openAiRefinedCount,
        listOwner: res.listOwnerContext,
      });
      saveContactAnalysisLocal({
        listOwnerContext,
        listOwnerNotes,
        contacts: res.contacts,
        summary: res.summary,
        aiUsed: res.aiUsed,
        aiOverview: res.aiOverview,
        openAiRefinedCount: res.openAiRefinedCount,
        importMeta: res.importMeta,
      });
      message.success(
        res.importMeta ? `Imported ${res.importMeta.imported || 0} contacts from CSV.` : 'Contacts analyzed successfully.'
      );
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const onCsvFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    setCsvPaste(text);
    setCsvFileName(f.name);
    message.info(`Loaded ${f.name} — click Analyze to segment.`);
  };

  const sendReminder = async () => {
    if (!eventId) return message.warning('Select an event first.');
    setSending(true);
    try {
      const res = await notificationService.sendWhatsAppReminders({
        eventId,
        group: targetGroup,
        message: reminderMessage,
        templateName: 'invitation_reminder',
      });
      message.success(`Reminder triggered. Sent: ${res.sentCount || 0}`);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const refreshCollageStatus = async () => {
    if (!eventId) return;
    setFetchingCollage(true);
    try {
      const res = await aiService.getEventCollageStatus(eventId);
      setCollageStatus(res.job || null);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setFetchingCollage(false);
    }
  };

  const runCollage = async () => {
    if (!eventId) return message.warning('Select an event first.');
    setRunningCollage(true);
    try {
      const res = await aiService.createEventCollage(eventId, collageStyle);
      setCollageStatus(res.job || null);
      message.success('AI collage job completed and added to event gallery.');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setRunningCollage(false);
    }
  };

  const loadSavedAnalysis = () => {
    const prev = loadContactAnalysisLocal();
    if (!prev?.contacts?.length) {
      message.warning('No saved analysis in this browser.');
      return;
    }
    setListOwnerContext(prev.listOwnerContext || 'unspecified');
    setListOwnerNotes(prev.listOwnerNotes || '');
    setSegmentFilter('all');
    setNameFilter('');
    setAnalyzed({
      contacts: prev.contacts,
      summary: prev.summary,
      aiUsed: prev.aiUsed,
      aiOverview: prev.aiOverview,
      openAiRefinedCount: prev.openAiRefinedCount,
      importMeta: prev.importMeta,
      listOwnerContext: prev.listOwnerContext,
    });
    message.info('Loaded last saved segmentation from this browser.');
    console.log('[ContactIntelligence UI] restored from localStorage', prev.savedAt);
  };

  const filteredContacts = useMemo(() => {
    const list = analyzed?.contacts || [];
    let rows = list;
    switch (segmentFilter) {
      case 'relatives':
        rows = rows.filter((c) => c.group === 'relatives');
        break;
      case 'friends':
        rows = rows.filter((c) => c.group === 'friends');
        break;
      case 'work':
        rows = rows.filter((c) => c.group === 'work');
        break;
      case 'others':
        rows = rows.filter((c) => c.group === 'others');
        break;
      case 'wa_yes':
        rows = rows.filter((c) => c.canNotifyWhatsApp);
        break;
      case 'wa_no':
        rows = rows.filter((c) => !c.canNotifyWhatsApp);
        break;
      default:
        break;
    }
    const q = nameFilter.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          String(c.name || '')
            .toLowerCase()
            .includes(q) ||
          String(c.phone || '').includes(q) ||
          String(c.inferredRelation || '')
            .toLowerCase()
            .includes(q) ||
          String(c.group || '')
            .toLowerCase()
            .includes(q)
      );
    }
    return rows;
  }, [analyzed?.contacts, segmentFilter, nameFilter]);

  const applySegmentFilter = (key) => {
    setSegmentFilter(key);
    if (key === 'all' || key === 'relatives' || key === 'friends' || key === 'work' || key === 'others') {
      setTargetGroup(key);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Telugu (AI / rules)',
      dataIndex: 'relationTelugu',
      key: 'relationTelugu',
      render: (v) => <Text>{v || '—'}</Text>,
    },
    {
      title: 'Name suffix',
      key: 'nameSuffixHint',
      render: (_, row) => {
        const h = row.nameSuffixHint;
        if (!h) return <Text type="secondary">—</Text>;
        const label = h.kind === 'employer' ? `Work @ ${h.token}` : `Trade: ${h.token}`;
        return <Tag color={h.kind === 'employer' ? 'geekblue' : 'cyan'}>{label}</Tag>;
      },
    },
    { title: 'Inferred Relation', dataIndex: 'inferredRelation', key: 'inferredRelation', render: (v) => <Tag>{v}</Tag> },
    { title: 'Group', dataIndex: 'group', key: 'group', render: (v) => <Tag color={v === 'relatives' ? 'green' : v === 'friends' ? 'blue' : 'default'}>{v}</Tag> },
    { title: 'Confidence', dataIndex: 'confidence', key: 'confidence', render: (v) => `${Math.round(Number(v || 0) * 100)}%` },
    { title: 'WhatsApp', dataIndex: 'canNotifyWhatsApp', key: 'canNotifyWhatsApp', render: (v) => (v ? <Tag color="green">Eligible</Tag> : <Tag>Missing Phone</Tag>) },
    {
      title: 'AI',
      dataIndex: 'segmentationSource',
      key: 'segmentationSource',
      render: (v) => <Tag color={v === 'openai' ? 'purple' : 'default'}>{v === 'openai' ? 'LLM' : 'Rules'}</Tag>,
    },
  ];

  return (
    <div className="phase-page">
      <Space direction="vertical" size={16} className="phase-stack">
        <Card className="phase-hero">
          <h1 className="phase-title">Contact Intelligence Center</h1>
          <p className="phase-subtitle">Analyze family/friend groups from contacts and trigger WhatsApp reminders by segment.</p>
        </Card>

        <Card className="phase-card" title="1) Import Contacts and Analyze">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <Text strong>Whose contact list is this?</Text> The AI uses this to read Telugu/English labels correctly (e.g. Amma, Athamma, Mamayya) relative to groom or bride side.
            </Paragraph>
            <Select
              style={{ width: '100%', maxWidth: 420 }}
              value={listOwnerContext}
              onChange={setListOwnerContext}
              options={LIST_OWNER_OPTIONS}
            />
            <TextArea
              rows={2}
              placeholder="Optional notes for the AI (e.g. “Groom side Hyderabad”, “Include colleagues from office”)"
              value={listOwnerNotes}
              onChange={(e) => setListOwnerNotes(e.target.value)}
            />
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <Text strong>Option A — Google Contacts CSV:</Text> export from{' '}
              <a href="https://contacts.google.com" target="_blank" rel="noreferrer">Google Contacts</a> (Export), then upload or paste the file below.
              Labels and Notes are used to infer relations (rules + optional OpenAI when <Text code>OPENAI_API_KEY</Text> is set on the server).
            </Paragraph>
            <input type="file" accept=".csv,text/csv" onChange={onCsvFile} style={{ marginBottom: 8 }} />
            {csvFileName ? <Text type="secondary">Loaded file: {csvFileName}</Text> : null}
            <TextArea
              rows={5}
              placeholder="Paste full Google Contacts CSV here (optional if you use manual lines below)"
              value={csvPaste}
              onChange={(e) => setCsvPaste(e.target.value)}
            />
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <Text strong>Option B — Manual lines:</Text> one per line: <Text code>name, phone, relationLabel, email</Text>
            </Paragraph>
            <TextArea
              rows={6}
              placeholder={'Bride Mother, +919812345678, Amma, mom@example.com\nGroom Friend Ravi, 9876543210, Bestie, ravi@mail.com'}
              value={contactsInput}
              onChange={(e) => setContactsInput(e.target.value)}
            />
            <Space wrap>
              <Button type="primary" onClick={analyzeContacts} loading={analyzing}>
                Analyze &amp; segment (AI)
              </Button>
              <Button onClick={loadSavedAnalysis}>Load last saved (this browser)</Button>
              <Text type="secondary">Manual lines parsed: {parsedContacts.length}</Text>
              {csvPaste.trim() ? <Tag color="blue">CSV ready ({csvPaste.length} chars)</Tag> : null}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              After each successful run, the table is cached in <Text code>localStorage</Text> ({CONTACT_INTEL_STORAGE_KEY}) for offline review — open DevTools → Console to see save logs.
            </Text>
          </Space>
        </Card>

        <Card className="phase-card" title="2) Preview AI Segmentation">
          {!analyzed?.contacts?.length ? (
            <Empty description="No analysis yet" />
          ) : (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                <Text strong>Filter the table:</Text> click a segment to show only that group. Use search to narrow by name, phone, or relation. The WhatsApp reminder audience (step 3) follows the segment when you pick Relatives, Friends, Work, or Others.
              </Paragraph>
              <Space wrap align="center">
                <Text type="secondary">Segment</Text>
                <Tag
                  color={segmentFilter === 'all' ? 'purple' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('all')}
                >
                  All ({analyzed.summary?.total || 0})
                </Tag>
                <Tag
                  color={segmentFilter === 'relatives' ? 'green' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('relatives')}
                >
                  Relatives ({analyzed.summary?.relatives || 0})
                </Tag>
                <Tag
                  color={segmentFilter === 'friends' ? 'blue' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('friends')}
                >
                  Friends ({analyzed.summary?.friends || 0})
                </Tag>
                <Tag
                  color={segmentFilter === 'work' ? 'orange' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('work')}
                >
                  Work ({analyzed.summary?.work || 0})
                </Tag>
                <Tag
                  color={segmentFilter === 'others' ? 'geekblue' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('others')}
                >
                  Others ({analyzed.summary?.others || 0})
                </Tag>
                <Tag
                  color={segmentFilter === 'wa_yes' ? 'gold' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('wa_yes')}
                >
                  WhatsApp OK ({analyzed.summary?.whatsAppEligible || 0})
                </Tag>
                <Tag
                  color={segmentFilter === 'wa_no' ? 'red' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => applySegmentFilter('wa_no')}
                >
                  No phone (
                  {Math.max(
                    0,
                    (analyzed.summary?.total || 0) - (analyzed.summary?.whatsAppEligible || 0)
                  )}
                  )
                </Tag>
              </Space>
              <Space wrap align="center" style={{ width: '100%' }}>
                <Input.Search
                  allowClear
                  placeholder="Search name, phone, relation, group…"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  style={{ maxWidth: 400 }}
                />
                {analyzed.aiUsed ? <Tag color="magenta">OpenAI refinement</Tag> : <Tag>Rules-only</Tag>}
                {analyzed.openAiRefinedCount != null ? (
                  <Tag color="cyan">LLM rows: {analyzed.openAiRefinedCount}</Tag>
                ) : null}
              </Space>
              {analyzed.aiOverview ? (
                <Paragraph style={{ marginBottom: 0 }}>
                  <Text strong>AI summary: </Text>
                  {analyzed.aiOverview}
                </Paragraph>
              ) : null}
              <Text type="secondary">
                Showing {filteredContacts.length} of {analyzed.contacts.length} contacts
                {nameFilter.trim() ? ` (search: “${nameFilter.trim()}”)` : ''}
              </Text>
              <Table
                rowKey={(row) => `${row.index}-${row.name}`}
                dataSource={filteredContacts}
                columns={columns}
                pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: [8, 16, 32, 64] }}
              />
            </Space>
          )}
        </Card>

        <Card className="phase-card" title="3) Trigger WhatsApp Reminder">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="WhatsApp integration (backend)"
              description={
                <Space direction="vertical" size={6}>
                  <Text>
                    By default the API uses <Text code>WHATSAPP_PROVIDER=mock</Text> and <Text code>WHATSAPP_DRY_RUN=true</Text> — no real messages are sent; payloads are logged on the server. That is why the table only shows “Eligible”: it means a phone number exists, not that a message was delivered.
                  </Text>
                  <Text>
                    For real sends, use Meta’s{' '}
                    <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer">
                      WhatsApp Business Platform (Cloud API)
                    </a>{' '}
                    or a provider such as Twilio WhatsApp. You need a verified business, a WhatsApp sender number, and approved message templates for India.
                  </Text>
                  <Text>
                    On your host (e.g. Render), set <Text code>WHATSAPP_DRY_RUN=false</Text>, <Text code>WHATSAPP_FROM_NUMBER</Text>, and either keep <Text code>mock</Text> until you wire code, or add your provider’s URL and secret as <Text code>WHATSAPP_API_BASE_URL</Text> / <Text code>WHATSAPP_API_KEY</Text>. Implement the actual HTTP call inside{' '}
                    <Text code>backend/services/notificationService.js</Text> (<Text code>sendWhatsApp</Text>) to match your provider’s API; the repo currently logs the payload when not in mock mode.
                  </Text>
                </Space>
              }
            />
            <Select
              loading={loadingEvents}
              placeholder="Select event"
              value={eventId}
              onChange={setEventId}
              style={{ width: 420, maxWidth: '100%' }}
              options={events.map((event) => ({
                value: event.id,
                label: `${event.title} (${new Date(event.date).toLocaleDateString('en-IN')})`,
              }))}
            />
            <Space wrap>
              <Select
                value={targetGroup}
                onChange={setTargetGroup}
                style={{ width: 200 }}
                options={[
                  { value: 'all', label: 'All Contacts' },
                  { value: 'relatives', label: 'Relatives' },
                  { value: 'friends', label: 'Friends' },
                  { value: 'work', label: 'Work / colleagues' },
                  { value: 'others', label: 'Others' },
                ]}
              />
            </Space>
            <TextArea rows={3} value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} />
            <Button type="primary" onClick={sendReminder} loading={sending} disabled={!eventId}>
              Send WhatsApp Reminder
            </Button>
          </Space>
        </Card>

        <Card className="phase-card" title="4) Remote Blessings AI Collage">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Generates a collage from remote blessing photos uploaded by guests who cannot attend.
            </Paragraph>
            <Space>
              <Select
                value={collageStyle}
                onChange={setCollageStyle}
                style={{ width: 170 }}
                options={[
                  { value: 'traditional', label: 'Traditional' },
                  { value: 'modern', label: 'Modern' },
                  { value: 'cinematic', label: 'Cinematic' },
                ]}
              />
              <Button type="primary" onClick={runCollage} loading={runningCollage} disabled={!eventId}>
                Generate AI Collage
              </Button>
              <Button onClick={refreshCollageStatus} loading={fetchingCollage} disabled={!eventId}>
                Refresh Status
              </Button>
            </Space>
            {!collageStatus ? (
              <Text type="secondary">No collage job yet for the selected event.</Text>
            ) : (
              <Space direction="vertical" size={4}>
                <Tag color={collageStatus.status === 'completed' ? 'green' : collageStatus.status === 'failed' ? 'red' : 'blue'}>
                  {collageStatus.status}
                </Tag>
                <Text type="secondary">Job: {collageStatus.jobId}</Text>
                {collageStatus.style ? <Text type="secondary">Style: {collageStatus.style}</Text> : null}
                {collageStatus.usedPhotos !== null && collageStatus.usedPhotos !== undefined ? (
                  <Text type="secondary">Photos used: {collageStatus.usedPhotos}</Text>
                ) : null}
                {collageStatus.resultUrl ? (
                  <a href={collageStatus.resultUrl} target="_blank" rel="noreferrer">Open collage result</a>
                ) : null}
              </Space>
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default ContactIntelligenceCenter;
