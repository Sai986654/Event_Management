import React, { useContext, useState } from 'react';
import { Form, Input, Button, Card, Select, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../utils/helpers';
import './AuthPages.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useContext(AuthContext);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
      });
      message.success('Registration successful! Welcome to EventOS');
      navigate('/dashboard');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card">
        <h1 className="auth-title">Create Your Account</h1>
        <p className="auth-subtitle">Join EventOS and start planning amazing events</p>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please input your full name!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Your full name" size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="your@email.com" size="large" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Select Your Role"
            rules={[{ required: true, message: 'Please select a role!' }]}
          >
            <Select placeholder="I am a..." size="large">
              <Select.Option value="customer">Customer</Select.Option>
              <Select.Option value="organizer">Event Organizer / Planner</Select.Option>
              <Select.Option value="vendor">Vendor / Service Provider</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please input your password!' },
              { min: 6, message: 'Password must be at least 6 characters!' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Create a strong password" size="large" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm your password" size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Create Account
          </Button>
        </Form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Register;
