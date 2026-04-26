import React, { useContext, useEffect, useRef, useState } from 'react';
import { Avatar, Button, Card, Col, Divider, Form, Input, Popconfirm, Row, Select, Tag, Upload, message } from 'antd';
import { CameraOutlined, DeleteOutlined, FacebookOutlined, InstagramOutlined, LockOutlined, MailOutlined, PhoneOutlined, TwitterOutlined, UploadOutlined, UserOutlined, YoutubeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authService } from '../services/authService';
import { vendorService } from '../services/vendorService';
import { adminService } from '../services/adminService';
import { getErrorMessage, getInitials } from '../utils/helpers';
import './PhaseFlows.css';

const FALLBACK_CATEGORIES = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];

const USER_FIELDS = ['name', 'phone'];
const VENDOR_FIELDS = ['businessName', 'category', 'description', 'city', 'state', 'contactPhone', 'contactEmail', 'website', 'facebook', 'instagram', 'twitter', 'youtube'];

const Profile = () => {
  const { user, setUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [userForm] = Form.useForm();
  const [vendorForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [userDirty, setUserDirty] = useState(false);
  const [vendorDirty, setVendorDirty] = useState(false);
  const savedUserRef = useRef({});
  const savedVendorRef = useRef({});

  const isVendor = user?.role === 'vendor';

  const loadData = async () => {
    setLoading(true);
    try {
      // Load categories
      try {
        const catRes = await adminService.getCategories();
        const cats = (catRes.categories || []).map((c) => c.name);
        if (cats.length > 0) setCategories(cats);
      } catch (_) { /* fallback */ }

      // Load fresh user profile
      const profileRes = await authService.getProfile();
      const u = profileRes.user || profileRes;
      if (setUser) setUser(u);
      userForm.setFieldsValue({ name: u.name || '', phone: u.phone || '' });
      savedUserRef.current = { name: u.name || '', phone: u.phone || '' };

      // Load vendor profile if vendor role
      if (isVendor) {
        const vendorsRes = await vendorService.searchVendors({ limit: 100 });
        const mine = (vendorsRes.vendors || []).find((v) => v.user?.id === user?.id);
        setVendor(mine || null);
      }
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  // Populate vendor form when vendor data loads
  useEffect(() => {
    if (!vendor) {
      const defaults = { category: 'other' };
      vendorForm.setFieldsValue(defaults);
      savedVendorRef.current = defaults;
    } else {
      const saved = {};
      const coreFields = ['businessName', 'category', 'description', 'city', 'state', 'contactPhone', 'contactEmail', 'website'];
      coreFields.forEach((f) => { saved[f] = vendor[f] ?? ''; });
      const links = vendor.socialLinks || {};
      saved.facebook = links.facebook || '';
      saved.instagram = links.instagram || '';
      saved.twitter = links.twitter || '';
      saved.youtube = links.youtube || '';
      vendorForm.setFieldsValue(saved);
      savedVendorRef.current = saved;
    }
    setVendorDirty(false);
  }, [vendor, vendorForm]);

  const onUserValuesChange = () => {
    const current = userForm.getFieldsValue(USER_FIELDS);
    const saved = savedUserRef.current;
    setUserDirty(USER_FIELDS.some((f) => (current[f] ?? '') !== (saved[f] ?? '')));
  };

  const onVendorValuesChange = () => {
    const current = vendorForm.getFieldsValue(VENDOR_FIELDS);
    const saved = savedVendorRef.current;
    setVendorDirty(VENDOR_FIELDS.some((f) => (current[f] ?? '') !== (saved[f] ?? '')));
  };

  const saveUserProfile = async (values) => {
    setSavingUser(true);
    try {
      const res = await authService.updateProfile(values);
      if (res.user && setUser) setUser(res.user);
      message.success('Profile updated');
      savedUserRef.current = { name: values.name || '', phone: values.phone || '' };
      setUserDirty(false);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingUser(false);
    }
  };

  const saveVendorProfile = async (values) => {
    setSavingVendor(true);
    try {
      const { facebook, instagram, twitter, youtube, ...rest } = values;
      const payload = {
        ...rest,
        socialLinks: {
          ...(facebook ? { facebook } : {}),
          ...(instagram ? { instagram } : {}),
          ...(twitter ? { twitter } : {}),
          ...(youtube ? { youtube } : {}),
        },
      };
      if (vendor) {
        await vendorService.updateVendorProfile(vendor.id, payload);
        message.success('Vendor profile updated');
      } else {
        await vendorService.createVendorProfile(payload);
        message.success('Vendor profile created');
      }
      setVendorDirty(false);
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingVendor(false);
    }
  };

  const uploadAvatar = async (file) => {
    setUploadingAvatar(true);
    try {
      const res = await authService.uploadAvatar(file);
      if (res.user && setUser) setUser(res.user);
      message.success('Profile picture updated');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
    return false;
  };

  const onChangePassword = async (values) => {
    setChangingPassword(true);
    try {
      await authService.changePassword(values);
      passwordForm.resetFields();
      message.success('Password changed successfully');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  };

  const onDeleteAccount = async () => {
    try {
      const values = await deleteForm.validateFields();
      setDeletingAccount(true);
      await authService.deleteAccount(values);
      message.success('Account deleted');
      logout();
      navigate('/login');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(getErrorMessage(err));
    } finally {
      setDeletingAccount(false);
    }
  };

  const statusColor = { approved: 'green', pending: 'orange', rejected: 'red' }[vendor?.verificationStatus] || 'default';

  return (
    <div className="phase-page">
      <Row gutter={[24, 24]} className="phase-stack">
        {/* Hero */}
        <Col span={24}>
          <Card loading={loading} className="phase-hero">
            <h1 className="phase-title">My Profile</h1>
            <p className="phase-subtitle">
              {user?.name} &middot; <Tag color="blue">{user?.role}</Tag>
              {user?.email}
            </p>
          </Card>
        </Col>

        {/* Account Details */}
        <Col xs={24} lg={isVendor ? 8 : 12}>
          <Card className="phase-card" title="Account Details">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar src={user?.avatar} size={72} icon={!user?.avatar ? <UserOutlined /> : undefined}>
                {!user?.avatar ? getInitials(user?.name || 'U') : null}
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Profile Picture</div>
                <div style={{ color: '#6b7280', marginBottom: 8 }}>Upload a square image for your account avatar.</div>
                <Upload showUploadList={false} beforeUpload={uploadAvatar} accept="image/*">
                  <Button icon={uploadingAvatar ? <CameraOutlined /> : <UploadOutlined />} loading={uploadingAvatar}>
                    Update Picture
                  </Button>
                </Upload>
              </div>
            </div>
            <Form form={userForm} layout="vertical" onFinish={saveUserProfile} onValuesChange={onUserValuesChange}>
              <Form.Item label="Email">
                <Input value={user?.email} disabled prefix={<MailOutlined />} />
              </Form.Item>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                <Input prefix={<UserOutlined />} />
              </Form.Item>
              <Form.Item name="phone" label="Phone">
                <Input prefix={<PhoneOutlined />} placeholder="+91 9876543210" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={savingUser} disabled={!userDirty}>
                Save Account
              </Button>
            </Form>

            <Divider />

            <Form form={passwordForm} layout="vertical" onFinish={onChangePassword}>
              <Form.Item name="currentPassword" label="Current Password" rules={[{ required: true, message: 'Enter your current password' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item name="newPassword" label="New Password" rules={[{ required: true, message: 'Enter a new password' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Confirm your new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Button type="default" htmlType="submit" loading={changingPassword}>
                Change Password
              </Button>
            </Form>

            <Divider />

            <Form form={deleteForm} layout="vertical">
              <Form.Item name="currentPassword" label="Confirm Password To Delete Account" rules={[{ required: true, message: 'Enter your password to continue' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Popconfirm
                title="Delete account?"
                description="This will permanently remove your account if there are no active dependencies. This cannot be undone."
                onConfirm={onDeleteAccount}
                okText="Delete"
                okButtonProps={{ danger: true, loading: deletingAccount }}
              >
                <Button danger icon={<DeleteOutlined />} loading={deletingAccount}>
                  Delete Account
                </Button>
              </Popconfirm>
            </Form>
          </Card>
        </Col>

        {/* Vendor Business Profile */}
        {isVendor && (
          <Col xs={24} lg={16}>
            <Card
              className="phase-card"
              title={vendor ? 'Business Profile' : 'Create Business Profile'}
              extra={vendor?.isVerified ? <Tag color="green">Verified</Tag> : <Tag color={statusColor}>{vendor?.verificationStatus || 'not submitted'}</Tag>}
            >
              {vendor?.verificationNotes && (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff7e6', borderRadius: 8, border: '1px solid #ffe58f' }}>
                  <strong>Admin notes:</strong> {vendor.verificationNotes}
                </div>
              )}
              <Form form={vendorForm} layout="vertical" onFinish={saveVendorProfile} onValuesChange={onVendorValuesChange}>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="businessName" label="Business Name" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="category" label="Primary Category" rules={[{ required: true }]}>
                      <Select options={categories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="description" label="About Your Business">
                  <Input.TextArea rows={4} placeholder="Describe your services, experience, specialties..." />
                </Form.Item>
                <Row gutter={16}>
                  <Col xs={24} md={8}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="state" label="State"><Input /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="website" label="Website"><Input placeholder="https://..." /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="contactPhone" label="Business Phone"><Input prefix={<PhoneOutlined />} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="contactEmail" label="Business Email"><Input prefix={<MailOutlined />} /></Form.Item></Col>
                </Row>

                <Divider orientation="left" style={{ margin: '4px 0 16px' }}>Social Media</Divider>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="facebook" label={<span><FacebookOutlined style={{ color: '#1877F2', marginRight: 6 }} />Facebook</span>}>
                      <Input placeholder="https://facebook.com/..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="instagram" label={<span><InstagramOutlined style={{ color: '#E4405F', marginRight: 6 }} />Instagram</span>}>
                      <Input placeholder="https://instagram.com/..." />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="twitter" label={<span><TwitterOutlined style={{ color: '#1DA1F2', marginRight: 6 }} />Twitter / X</span>}>
                      <Input placeholder="https://x.com/..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="youtube" label={<span><YoutubeOutlined style={{ color: '#FF0000', marginRight: 6 }} />YouTube</span>}>
                      <Input placeholder="https://youtube.com/..." />
                    </Form.Item>
                  </Col>
                </Row>

                <Button type="primary" htmlType="submit" loading={savingVendor} disabled={vendor && !vendorDirty}>
                  {vendor ? 'Save Business Profile' : 'Create Business Profile'}
                </Button>
              </Form>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default Profile;
