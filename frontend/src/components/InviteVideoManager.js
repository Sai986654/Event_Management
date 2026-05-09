import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Card,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  Typography,
  Divider,
  message,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  DeleteOutlined,
  SoundOutlined,
  AudioOutlined,
} from '@ant-design/icons';
import { adminService } from '../services/adminService';
import { inviteVideoService } from '../services/inviteVideoService';
import { socketService } from '../services/socketService';
import { getErrorMessage } from '../utils/helpers';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColors = { pending: 'default', processing: 'blue', completed: 'green', failed: 'red' };

const VOICE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'te', label: 'Telugu (తెలుగు)' },
  { value: 'hi', label: 'Hindi (हिन्दी)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
  { value: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'ml', label: 'Malayalam (മലയാളം)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
  { value: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { value: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'ur', label: 'Urdu (اردو)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'ar', label: 'Arabic' },
];

const isAdobeTemplate = (template) => Boolean(template?.palette?.__adobeExpress);

const getAdobeTemplateTimeline = (template) => {
  const adobe = template?.palette?.__adobeExpress || {};
  return Array.isArray(adobe.timeline) ? adobe.timeline : [];
};

const getTemplatePreviewInfo = (template) => {
  const timeline = getAdobeTemplateTimeline(template);
  const firstScene = timeline[0] || null;
  const previewAsset = String(firstScene?.baseVideo || firstScene?.baseImage || firstScene?.background || '').trim();
  const previewUrl = /^https?:\/\//i.test(previewAsset) ? previewAsset : '';

  return {
    sceneCount: timeline.length,
    previewUrl,
    previewLabel: firstScene?.sceneId || template?.key || 'template',
  };
};

const InviteVideoManager = ({ eventId, guests: eventGuests = [] }) => {
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Form state
  const [imageFiles, setImageFiles] = useState([]);
  const [musicFile, setMusicFile] = useState(null);
  const [manifestJson, setManifestJson] = useState('');
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const [useExistingGuests, setUseExistingGuests] = useState(true);
  const [voiceTemplate, setVoiceTemplate] = useState('Dear {name}, you are cordially invited to our event');
  const [voiceLang, setVoiceLang] = useState('en');

  // Real-time progress ref
  const progressRef = useRef(null);

  // ── Load jobs ─────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inviteVideoService.getJobsByEvent(eventId);
      setJobs(data.jobs || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadJobDetail = useCallback(async (jobId) => {
    try {
      const data = await inviteVideoService.getJob(jobId);
      setActiveJob(data);
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const loadInviteTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await adminService.getInviteTemplates();
      setInviteTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadInviteTemplates();
  }, [loadInviteTemplates]);

  useEffect(() => {
    if (selectedTemplateKey) {
      const selectedExists = inviteTemplates.some((template) => template.key === selectedTemplateKey);
      if (selectedExists) return;
    }

    const newestAdobeTemplate = [...inviteTemplates]
      .filter(isAdobeTemplate)
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0))[0];

    if (newestAdobeTemplate?.key) {
      setSelectedTemplateKey(newestAdobeTemplate.key);
    }
  }, [inviteTemplates, selectedTemplateKey]);

  // ── Socket.IO real-time progress ──────────────────────────
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handler = (data) => {
      progressRef.current = data;
      // Update active job inline
      if (activeJob && data.jobId === activeJob.jobId) {
        setActiveJob((prev) => ({
          ...prev,
          status: data.status,
          processed: data.processed ?? prev.processed,
          failed: data.failed ?? prev.failed,
        }));
      }
      // If completed or failed, refresh job list
      if (data.status === 'completed' || data.status === 'failed') {
        loadJobs();
        if (activeJob?.jobId === data.jobId) loadJobDetail(data.jobId);
      }
    };

    socket.on('invite-job-progress', handler);
    return () => socket.off('invite-job-progress', handler);
  }, [activeJob, loadJobs, loadJobDetail]);

  // ── Submit new job ────────────────────────────────────────
  const handleSubmit = async () => {
    const manifestText = manifestJson.trim();
    let parsedManifest = null;

    if (manifestText) {
      try {
        parsedManifest = JSON.parse(manifestText);
      } catch {
        message.error('Manifest JSON is invalid. Paste a valid Adobe manifest before submitting.');
        return;
      }
    } else if (imageFiles.length < 3 || imageFiles.length > 5) {
      message.warning('Please upload 3 to 5 images for the slideshow, or paste an Adobe manifest.');
      return;
    }

    let guests;
    if (useExistingGuests) {
      guests = eventGuests
        .filter((g) => g.phone)
        .map((g) => ({ name: g.name, phone: g.phone }));
      if (guests.length === 0) {
        message.warning('No guests with phone numbers found. Add guests manually or update the guest list.');
        return;
      }
    } else {
      try {
        guests = JSON.parse(guestInput);
        if (!Array.isArray(guests) || guests.length === 0) throw new Error();
      } catch {
        message.error('Invalid guest JSON. Expected: [{ "name": "...", "phone": "..." }]');
        return;
      }
    }

    setSubmitting(true);
    try {
      const music = musicFile?.originFileObj || musicFile || null;
      const data = manifestText
        ? await inviteVideoService.createJobFromManifest(eventId, parsedManifest, guests, music, voiceTemplate, voiceLang, parsedManifest?.templateKey || '')
        : selectedTemplateKey
        ? await inviteVideoService.createJobFromTemplate(eventId, selectedTemplateKey, guests, music, voiceTemplate, voiceLang)
        : await inviteVideoService.createJob(eventId, imageFiles.map((f) => f.originFileObj || f), guests, music, voiceTemplate, voiceLang);
      message.success(`Job started! Generating videos for ${data.totalGuests} guest(s).`);
      await loadJobs();
      loadJobDetail(data.jobId);
      // Reset form
      setImageFiles([]);
      setMusicFile(null);
      setManifestJson('');
      setSelectedTemplateKey('');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Retry failed ──────────────────────────────────────────
  const handleRetry = async (jobId) => {
    setRetrying(true);
    try {
      const data = await inviteVideoService.retryFailed(jobId);
      message.success(data.message);
      loadJobDetail(jobId);
      loadJobs();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setRetrying(false);
    }
  };

  // ── Guest detail columns ──────────────────────────────────
  const guestColumns = [
    { title: 'Guest', dataIndex: 'guestName', key: 'guestName' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColors[s]}>{s}</Tag>,
    },
    {
      title: 'Video',
      dataIndex: 'videoUrl',
      key: 'videoUrl',
      render: (url) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer">
            Watch
          </a>
        ) : (
          '—'
        ),
    },
    {
      title: 'WhatsApp',
      dataIndex: 'messageSent',
      key: 'messageSent',
      render: (sent) => (sent ? <Tag color="green">Sent</Tag> : <Tag>Pending</Tag>),
    },
    {
      title: 'Error',
      dataIndex: 'error',
      key: 'error',
      render: (err) => (err ? <Text type="danger" style={{ fontSize: 12 }}>{err}</Text> : '—'),
    },
  ];

  // ── Job history columns ───────────────────────────────────
  const jobColumns = [
    { title: 'Job ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColors[s]}>{s}</Tag>,
    },
    { title: 'Guests', dataIndex: 'totalGuests', key: 'totalGuests', width: 80 },
    { title: 'Done', dataIndex: 'processed', key: 'processed', width: 80 },
    { title: 'Failed', dataIndex: 'failed', key: 'failed', width: 80 },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d) => new Date(d).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => loadJobDetail(record.id)}>
            Details
          </Button>
          {record.failed > 0 && (
            <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRetry(record.id)} loading={retrying}>
              Retry
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const guestsWithPhone = eventGuests.filter((g) => g.phone).length;
  const selectedTemplate = inviteTemplates.find((template) => template.key === selectedTemplateKey) || null;
  const selectedTemplatePreview = selectedTemplate ? getTemplatePreviewInfo(selectedTemplate) : null;
  const newestAdobeTemplate = [...inviteTemplates]
    .filter(isAdobeTemplate)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0))[0] || null;

  const renderTemplateOption = (template) => {
    const preview = getTemplatePreviewInfo(template);
    const isAdobe = isAdobeTemplate(template);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: preview.previewUrl
              ? `url(${preview.previewUrl}) center / cover no-repeat`
              : 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
            border: '1px solid rgba(124, 45, 18, 0.35)',
            flex: '0 0 auto',
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {template.name || template.key}
            </span>
            {isAdobe ? (
              <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                Adobe
              </Tag>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {template.description || template.key}
          </div>
          {isAdobe ? (
            <div style={{ fontSize: 11, color: '#9a3412', marginTop: 2 }}>
              {preview.sceneCount} scene{preview.sceneCount === 1 ? '' : 's'}
              {preview.previewLabel ? ` • ${preview.previewLabel}` : ''}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <VideoCameraOutlined />
            <span>Generate Personalized Invite Videos</span>
          </Space>
        }
      >
        <Paragraph type="secondary">
          Upload 3–5 event images to create a personalized slideshow video for each guest. Customize the
          voice message and language — each video includes a voice greeting with the guest's name, image
          transitions, and optional background music. Videos are uploaded to cloud storage and sent via WhatsApp.
        </Paragraph>

        <Divider orientation="left">1. Event Images (3–5)</Divider>
        <Upload
          listType="picture-card"
          accept="image/*"
          multiple
          fileList={imageFiles}
          beforeUpload={() => false}
          onChange={({ fileList }) => setImageFiles(fileList.slice(0, 5))}
          onRemove={(file) => setImageFiles((prev) => prev.filter((f) => f.uid !== file.uid))}
        >
          {imageFiles.length < 5 && (
            <div>
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>Add Image</div>
            </div>
          )}
        </Upload>
        {imageFiles.length > 0 && imageFiles.length < 3 && (
          <Text type="warning">Upload at least 3 images ({imageFiles.length}/3 minimum)</Text>
        )}

        <Divider orientation="left">1b. Adobe Manifest (optional)</Divider>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Select
            value={selectedTemplateKey || undefined}
            onChange={(value) => setSelectedTemplateKey(value)}
            placeholder="Select an imported Adobe template"
            loading={loadingTemplates}
            allowClear
            style={{ width: '100%' }}
            options={inviteTemplates.map((template) => ({
              value: template.key,
              label: renderTemplateOption(template),
              title: template.key,
            }))}
            optionLabelProp="title"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pick an imported Adobe template here if you want the video job to use the saved timeline directly.
          </Text>
          {selectedTemplate ? (
            <Card size="small" style={{ borderColor: selectedTemplatePreview ? '#f59e0b' : undefined }}>
              <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Text strong>{selectedTemplate.name || selectedTemplate.key}</Text>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {isAdobeTemplate(selectedTemplate)
                      ? `${selectedTemplatePreview?.sceneCount || 0} scene Adobe timeline ready for video rendering.`
                      : 'Classic template selected.'}
                  </div>
                </div>
                {newestAdobeTemplate?.key === selectedTemplate.key ? <Tag color="gold">Newest Adobe template</Tag> : null}
              </Space>
            </Card>
          ) : null}
          <TextArea
            rows={7}
            value={manifestJson}
            onChange={(e) => setManifestJson(e.target.value)}
            placeholder={`{
  "templateKey": "telugu-wedding-premium-five-scene",
  "timeline": [ ... ]
}`}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Paste an Adobe manifest here to generate a scene-based video from the template timeline. If this is filled, manual image uploads are optional.
          </Text>
        </Space>

        <Divider orientation="left">2. Background Music (Optional)</Divider>
        <Space>
          {musicFile ? (
            <Space>
              <SoundOutlined />
              <Text>{musicFile.name || musicFile.originFileObj?.name || 'music.mp3'}</Text>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={() => setMusicFile(null)}
              />
            </Space>
          ) : (
            <Upload
              accept="audio/*"
              maxCount={1}
              beforeUpload={(file) => {
                setMusicFile(file);
                return false;
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Upload Music (MP3)</Button>
            </Upload>
          )}
        </Space>

        <Divider orientation="left">3. Voice Message</Divider>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text strong>Language</Text>
            <Select
              value={voiceLang}
              onChange={setVoiceLang}
              options={VOICE_LANGUAGES}
              style={{ width: 220, marginLeft: 12 }}
            />
          </div>
          <div>
            <Text strong>Voice Message Template</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              Use <Text code>{'{name}'}</Text> where the guest's name should appear
            </Text>
          </div>
          <TextArea
            rows={3}
            value={voiceTemplate}
            onChange={(e) => setVoiceTemplate(e.target.value)}
            placeholder="Dear {name}, you are cordially invited to our event"
            maxLength={200}
            showCount
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <AudioOutlined /> Preview: "{voiceTemplate.replace(/\{name\}/gi, 'Prakash')}"
          </Text>
        </Space>

        <Divider orientation="left">4. Guest List</Divider>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space>
            <Button
              type={useExistingGuests ? 'primary' : 'default'}
              onClick={() => setUseExistingGuests(true)}
            >
              Use event guests ({guestsWithPhone} with phone)
            </Button>
            <Button
              type={!useExistingGuests ? 'primary' : 'default'}
              onClick={() => setUseExistingGuests(false)}
            >
              Enter manually (JSON)
            </Button>
          </Space>

          {useExistingGuests ? (
            <Text type="secondary">
              {guestsWithPhone > 0
                ? `${guestsWithPhone} guest(s) with phone numbers will receive personalized videos.`
                : 'No guests with phone numbers. Add phone numbers in the Guests tab or enter manually.'}
            </Text>
          ) : (
            <TextArea
              rows={6}
              placeholder={'[\n  { "name": "Prakash", "phone": "919999999999" },\n  { "name": "Ravi", "phone": "918888888888" }\n]'}
              value={guestInput}
              onChange={(e) => setGuestInput(e.target.value)}
            />
          )}
        </Space>

        <Divider />
        <Button
          type="primary"
          size="large"
          icon={<VideoCameraOutlined />}
          loading={submitting}
          onClick={handleSubmit}
          disabled={!manifestJson.trim() && !selectedTemplateKey && imageFiles.length < 3}
        >
          Generate & Send Invite Videos
        </Button>
      </Card>

      {/* ── Active Job Progress ─────────────────────────────── */}
      {activeJob && (
        <Card
          title={`Job #${activeJob.jobId} — ${activeJob.status}`}
          style={{ marginTop: 16 }}
          extra={
            activeJob.failed > 0 && (
              <Button icon={<ReloadOutlined />} onClick={() => handleRetry(activeJob.jobId)} loading={retrying}>
                Retry Failed
              </Button>
            )
          }
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Progress
              percent={
                activeJob.totalGuests > 0
                  ? Math.round((activeJob.processed / activeJob.totalGuests) * 100)
                  : 0
              }
              status={
                activeJob.status === 'failed'
                  ? 'exception'
                  : activeJob.status === 'completed'
                  ? 'success'
                  : 'active'
              }
              format={() => `${activeJob.processed || 0} / ${activeJob.totalGuests}`}
            />
            {activeJob.error && <Text type="danger">{activeJob.error}</Text>}
            <Table
              dataSource={activeJob.guests || []}
              columns={guestColumns}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Space>
        </Card>
      )}

      {/* ── Job History ─────────────────────────────────────── */}
      <Card title="Job History" style={{ marginTop: 16 }} loading={loading}>
        <Table
          dataSource={jobs}
          columns={jobColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
          locale={{ emptyText: 'No invite video jobs yet.' }}
        />
      </Card>
    </div>
  );
};

export default InviteVideoManager;
