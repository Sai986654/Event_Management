import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Progress,
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
} from '@ant-design/icons';
import { inviteVideoService } from '../services/inviteVideoService';
import { socketService } from '../services/socketService';
import { getErrorMessage } from '../utils/helpers';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColors = { pending: 'default', processing: 'blue', completed: 'green', failed: 'red' };

const InviteVideoManager = ({ eventId, guests: eventGuests = [] }) => {
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Form state
  const [imageFiles, setImageFiles] = useState([]);
  const [musicFile, setMusicFile] = useState(null);
  const [guestInput, setGuestInput] = useState('');
  const [useExistingGuests, setUseExistingGuests] = useState(true);

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
    if (imageFiles.length < 3 || imageFiles.length > 5) {
      message.warning('Please upload 3 to 5 images for the slideshow.');
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
      const files = imageFiles.map((f) => f.originFileObj || f);
      const music = musicFile?.originFileObj || musicFile || null;
      const data = await inviteVideoService.createJob(eventId, files, guests, music);
      message.success(`Job started! Generating videos for ${data.totalGuests} guest(s).`);
      await loadJobs();
      loadJobDetail(data.jobId);
      // Reset form
      setImageFiles([]);
      setMusicFile(null);
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
          Upload 3–5 event images to create a personalized slideshow video for each guest. Each video includes
          a voice greeting ("{'{guest name}'}, you are invited to our wedding ceremony"), image transitions, and
          optional background music. Videos are uploaded to cloud storage and sent via WhatsApp.
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

        <Divider orientation="left">3. Guest List</Divider>
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
          disabled={imageFiles.length < 3}
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
