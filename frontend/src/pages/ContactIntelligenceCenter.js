import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { eventService } from '../services/eventService';
import { notificationService } from '../services/notificationService';
import { aiService } from '../services/aiService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

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

  const parsedContacts = useMemo(() => parseContactsFromText(contactsInput), [contactsInput]);

  const analyzeContacts = async () => {
    const hasCsv = Boolean(csvPaste.trim());
    if (!hasCsv && !parsedContacts.length) {
      message.warning('Add manual lines or paste/import a Google Contacts CSV.');
      return;
    }
    setAnalyzing(true);
    try {
      const res = hasCsv
        ? await notificationService.analyzeContacts({ csv: csvPaste, useOpenAi: true })
        : await notificationService.analyzeContacts({ contacts: parsedContacts, useOpenAi: true });
      setAnalyzed(res);
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

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
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
              <Text type="secondary">Manual lines parsed: {parsedContacts.length}</Text>
              {csvPaste.trim() ? <Tag color="blue">CSV ready ({csvPaste.length} chars)</Tag> : null}
            </Space>
          </Space>
        </Card>

        <Card className="phase-card" title="2) Preview AI Segmentation">
          {!analyzed?.contacts?.length ? (
            <Empty description="No analysis yet" />
          ) : (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="purple">Total: {analyzed.summary?.total || 0}</Tag>
                <Tag color="green">Relatives: {analyzed.summary?.relatives || 0}</Tag>
                <Tag color="blue">Friends: {analyzed.summary?.friends || 0}</Tag>
                <Tag color="orange">Work: {analyzed.summary?.work || 0}</Tag>
                <Tag>Others: {analyzed.summary?.others || 0}</Tag>
                <Tag color="gold">WhatsApp Eligible: {analyzed.summary?.whatsAppEligible || 0}</Tag>
                {analyzed.aiUsed ? <Tag color="magenta">OpenAI refinement</Tag> : <Tag>Rules-only</Tag>}
              </Space>
              <Table rowKey={(row) => `${row.index}-${row.name}`} dataSource={analyzed.contacts} columns={columns} pagination={{ pageSize: 8 }} />
            </Space>
          )}
        </Card>

        <Card className="phase-card" title="3) Trigger WhatsApp Reminder">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
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
