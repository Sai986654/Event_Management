import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Statistic, Progress, Button, Form, Input, InputNumber, Table, message, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { budgetService } from '../services/budgetService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import './BudgetDashboard.css';

const BudgetDashboard = () => {
  const { eventId } = useParams();
  const [budget, setBudget] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const fetchBudget = async () => {
    try {
      setLoading(true);
      const data = await budgetService.getBudget(eventId);
      setBudget(data.budget);
      setAllocations(data.allocations || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleOptimizeBudget = async () => {
    try {
      const data = await budgetService.optimizeBudget(eventId, budget?.guestCount);
      setBudget(data.budget);
      setAllocations(data.allocations || []);
      message.success('Budget optimized successfully');
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleAddAllocation = async (values) => {
    try {
      await budgetService.allocateBudget(budget.id, [
        {
          category: values.category,
          amount: values.amount,
        },
      ]);
      message.success('Budget allocation added');
      form.resetFields();
      fetchBudget();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const columns = [
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Allocated', dataIndex: 'allocated', key: 'allocated', render: (val) => formatCurrency(val) },
    { title: 'Spent', dataIndex: 'spent', key: 'spent', render: (val) => formatCurrency(val) },
    {
      title: 'Remaining',
      dataIndex: 'remaining',
      key: 'remaining',
      render: (_, record) => formatCurrency(record.allocated - (record.spent || 0)),
    },
  ];

  if (loading) {
    return <Spin />;
  }

  if (!budget) {
    return <div>No budget data found</div>;
  }

  const totalBudgetNum = Number(budget.totalBudget ?? 0);
  const totalSpent = allocations.reduce((sum, a) => sum + Number(a.spent ?? 0), 0);
  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocated ?? 0), 0);
  const percentageUsed = totalBudgetNum > 0 ? ((totalSpent / totalBudgetNum) * 100).toFixed(2) : '0';

  return (
    <div className="budget-dashboard-container">
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} className="budget-stats">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Budget"
                value={totalBudgetNum}
                valueStyle={{ color: '#667eea' }}
                formatter={(value) => formatCurrency(value)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Allocated"
                value={totalAllocated}
                valueStyle={{ color: '#52c41a' }}
                formatter={(value) => formatCurrency(value)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Spent"
                value={totalSpent}
                valueStyle={{ color: '#f5222d' }}
                formatter={(value) => formatCurrency(value)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Remaining"
                value={totalBudgetNum - totalAllocated}
                valueStyle={{ color: '#faad14' }}
                formatter={(value) => formatCurrency(value)}
              />
            </Card>
          </Col>
        </Row>

        <Card className="budget-progress" style={{ marginTop: '24px' }}>
          <h3>Budget Usage</h3>
          <Progress
            percent={parseFloat(percentageUsed)}
            status={percentageUsed > 100 ? 'exception' : 'active'}
            showInfo={true}
          />
          <p style={{ marginTop: '12px', color: '#666' }}>
            {percentageUsed}% of budget used
          </p>
        </Card>

        <Card title="Budget Allocations" style={{ marginTop: '24px' }}>
          <Table dataSource={allocations} columns={columns} pagination={false} />
        </Card>

        <Card title="Add Budget Allocation" style={{ marginTop: '24px' }}>
          <Form form={form} layout="vertical" onFinish={handleAddAllocation}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="category"
                  label="Category"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="E.g., Venue, Catering, Decor" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="amount"
                  label="Amount"
                  rules={[{ required: true }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    prefix="₹"
                    placeholder="Amount in INR"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              Add Allocation
            </Button>
          </Form>
        </Card>

        <Button
          type="primary"
          size="large"
          block
          style={{ marginTop: '24px' }}
          onClick={handleOptimizeBudget}
        >
          AI Optimize Budget
        </Button>
      </Spin>
    </div>
  );
};

export default BudgetDashboard;
