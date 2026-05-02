import React from 'react';
import { Modal, Divider, Button, Row, Col, Statistic, Card, message, Space, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import './PaymentConfirmationModal.css';

const PaymentConfirmationModal = ({ visible, receipt, loading, onClose }) => {
  if (!receipt || !receipt.payment) {
    return null;
  }

  const {
    payment,
    entityDetails,
    formattedAmount,
    statusDisplay,
    completedAtFormatted,
  } = receipt;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} copied to clipboard`);
  };

  const handleDownloadReceipt = () => {
    // Generate and download receipt as text/PDF
    const receiptText = `
VEDIKA 360 - PAYMENT RECEIPT
${'='.repeat(60)}

PAYMENT STATUS: ${statusDisplay}
${payment.status === 'completed' ? '✓ PAYMENT SUCCESSFUL' : ''}

TRANSACTION DETAILS
${'-'.repeat(60)}
Transaction ID:        ${payment.razorpayPaymentId || 'N/A'}
Order ID:              ${payment.razorpayOrderId || 'N/A'}
Payment ID (Internal): #${payment.id}

AMOUNT
${'-'.repeat(60)}
Amount:                ${formattedAmount}
Currency:              ${payment.currency || 'INR'}

TIMELINE
${'-'.repeat(60)}
Date & Time:           ${completedAtFormatted || 'Pending'}
Created At:            ${new Date(payment.createdAt).toLocaleDateString('en-IN')}

SERVICE DETAILS
${'-'.repeat(60)}
Service Type:          ${payment.entityType.replace(/_/g, ' ').toUpperCase()}
${entityDetails ? `Service Name:          ${entityDetails.title || entityDetails.vendorName || 'N/A'}` : ''}
${payment.description ? `Description:           ${payment.description}` : ''}

PAYMENT METHOD
${'-'.repeat(60)}
Method:                ${payment.paymentMethod || 'Razorpay'}

NOTES
${'-'.repeat(60)}
- Keep this receipt for your records
- This is an automated confirmation
- For support, please contact us with your Transaction ID

${'='.repeat(60)}
Generated: ${new Date().toLocaleString('en-IN')}
Vedika 360 - Event Management Platform
    `;

    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(receiptText)
    );
    element.setAttribute('download', `receipt_${payment.id}_${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    message.success('Receipt downloaded');
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '24px' }} />
          <span>Payment Confirmation</span>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
        <Button key="receipt" icon={<DownloadOutlined />} onClick={handleDownloadReceipt}>
          Download Receipt
        </Button>,
      ]}
      width={700}
      loading={loading}
      destroyOnClose
    >
      <Card
        className="payment-success-card"
        style={{
          background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
          color: 'white',
          marginBottom: '20px',
          border: 'none',
          borderRadius: '8px',
        }}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <h2 style={{ margin: '0 0 10px 0', color: 'white' }}>Payment Successful!</h2>
          <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
            Your payment has been received and confirmed
          </p>
        </div>
      </Card>

      <Divider />

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Transaction Details</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <div className="receipt-item">
              <span className="receipt-label">Transaction ID</span>
              <div className="receipt-value-with-action">
                <code style={{ fontSize: '12px' }}>{payment.razorpayPaymentId || 'N/A'}</code>
                <CopyOutlined
                  onClick={() =>
                    copyToClipboard(
                      payment.razorpayPaymentId || '',
                      'Transaction ID'
                    )
                  }
                  style={{ cursor: 'pointer', marginLeft: '8px', color: '#1677ff' }}
                />
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="receipt-item">
              <span className="receipt-label">Order ID</span>
              <div className="receipt-value-with-action">
                <code style={{ fontSize: '12px' }}>{payment.razorpayOrderId || 'N/A'}</code>
                <CopyOutlined
                  onClick={() =>
                    copyToClipboard(payment.razorpayOrderId || '', 'Order ID')
                  }
                  style={{ cursor: 'pointer', marginLeft: '8px', color: '#1677ff' }}
                />
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <Divider />

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Amount</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Statistic
              title="Payment Amount"
              value={payment.amount}
              prefix="₹"
              suffix={payment.currency || 'INR'}
              valueStyle={{ color: '#1677ff', fontSize: '24px' }}
            />
          </Col>
        </Row>
      </div>

      <Divider />

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Payment Status</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <div className="receipt-item">
              <span className="receipt-label">Status</span>
              <div>
                <Tag color={payment.status === 'completed' ? 'green' : 'orange'}>
                  {statusDisplay}
                </Tag>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="receipt-item">
              <span className="receipt-label">Date & Time</span>
              <div>{completedAtFormatted || 'Pending'}</div>
            </div>
          </Col>
        </Row>
      </div>

      {entityDetails && (
        <>
          <Divider />
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '15px' }}>Service Details</h3>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div className="receipt-item">
                  <span className="receipt-label">Service Type</span>
                  <div>{payment.entityType.replace(/_/g, ' ').toUpperCase()}</div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div className="receipt-item">
                  <span className="receipt-label">Service Name</span>
                  <div>{entityDetails.title || entityDetails.vendorName || 'N/A'}</div>
                </div>
              </Col>
            </Row>
          </div>
        </>
      )}

      {payment.description && (
        <>
          <Divider />
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px' }}>Description</h3>
            <p style={{ margin: 0, color: '#666' }}>{payment.description}</p>
          </div>
        </>
      )}

      <Divider />

      <div style={{ background: '#f0f2f5', padding: '12px', borderRadius: '4px', marginTop: '20px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
          <strong>Important:</strong> A confirmation email has been sent to your registered email address. Please keep your Transaction ID and Order ID for reference.
        </p>
      </div>
    </Modal>
  );
};

export default PaymentConfirmationModal;
