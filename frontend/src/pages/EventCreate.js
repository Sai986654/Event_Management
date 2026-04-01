import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, DatePicker, Select, Button, Card, message, Spin, Steps, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { eventService } from '../services/eventService';
import { vendorService } from '../services/vendorService';
import { getErrorMessage } from '../utils/helpers';
import './EventCreate.css';

const { Text } = Typography;

const sectorOptions = [
  { key: 'catering', label: 'Catering' },
  { key: 'decor', label: 'Decor' },
  { key: 'photography', label: 'Photography' },
  { key: 'videography', label: 'Videography' },
  { key: 'music', label: 'Music' },
  { key: 'venue', label: 'Venue' },
  { key: 'transportation', label: 'Transportation' },
];

const EventCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [vendorOptions, setVendorOptions] = useState([]);

  useEffect(() => {
    vendorService
      .searchVendors({ limit: 200 })
      .then((data) => {
        const vendors = data.vendors || [];
        setVendorOptions(
          vendors.map((v) => ({
            value: v.id,
            label: `${v.businessName} (#${v.id})`,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const onFinish = async (values) => {
    try {
      const allValues = form.getFieldsValue(true);
      const payloadValues = { ...allValues, ...values };
      const rawDate = payloadValues?.date;
      let parsedDate = null;

      if (rawDate instanceof Date) {
        parsedDate = rawDate;
      } else if (rawDate && typeof rawDate === 'object') {
        if (typeof rawDate.toDate === 'function') {
          parsedDate = rawDate.toDate();
        } else if (rawDate.$d) {
          parsedDate = new Date(rawDate.$d);
        } else if (typeof rawDate.valueOf === 'function') {
          const ts = rawDate.valueOf();
          if (Number.isFinite(ts)) parsedDate = new Date(ts);
        }
      } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
        parsedDate = new Date(rawDate);
      }

      if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        message.error('Please select a valid event date.');
        return;
      }

      const isoDate = parsedDate.toISOString();

      setLoading(true);
      const eventData = {
        title: payloadValues.title,
        type: payloadValues.type,
        date: isoDate,
        venue: payloadValues.location,
        description: payloadValues.description,
        budget: payloadValues.budget,
        guestCount: payloadValues.guestCount,
        customerPreferences: {
          vibe: payloadValues.eventVibe,
          palette: payloadValues.colorPalette,
          mustHaveMoments: payloadValues.mustHaveMoments,
          accessibilityNeeds: payloadValues.accessibilityNeeds,
          dietaryNotes: payloadValues.dietaryNotes,
        },
        sectorCustomizations: sectorOptions.reduce((acc, sector) => {
          const budget = payloadValues[`${sector.key}Budget`];
          const note = payloadValues[`${sector.key}Note`];
          const priority = payloadValues[`${sector.key}Priority`];
          if (budget || note || priority) {
            acc[sector.key] = {
              budget: Number(budget || 0),
              priority: priority || 'medium',
              note: note || '',
            };
          }
          return acc;
        }, {}),
      };
      if (Array.isArray(payloadValues.concernedVendorIds) && payloadValues.concernedVendorIds.length) {
        eventData.concernedVendorIds = payloadValues.concernedVendorIds;
      }
      await eventService.createEvent(eventData);
      message.success('Event created successfully!');
      navigate('/dashboard');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Basic Info',
      content: (
        <>
          <Form.Item
            name="title"
            label="Event Title"
            rules={[{ required: true, message: 'Please input event title!' }]}
          >
            <Input placeholder="E.g. Priya & Arjun's Wedding Reception" size="large" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Event Type"
            rules={[{ required: true, message: 'Please select event type!' }]}
          >
            <Select placeholder="Select event type" size="large">
              <Select.Option value="wedding">Wedding</Select.Option>
              <Select.Option value="corporate">Corporate Event</Select.Option>
              <Select.Option value="birthday">Birthday Party</Select.Option>
              <Select.Option value="conference">Conference</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please input event description!' }]}
          >
            <Input.TextArea rows={4} placeholder="Describe your event..." />
          </Form.Item>
        </>
      ),
    },
    {
      title: 'Details',
      content: (
        <>
          <Form.Item
            name="date"
            label="Event Date"
            rules={[{ required: true, message: 'Please select event date!' }]}
          >
            <DatePicker size="large" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="location"
            label="Location"
            rules={[{ required: true, message: 'Please input location!' }]}
          >
            <Input placeholder="e.g. Hyderabad, Telangana or venue area" size="large" />
          </Form.Item>

          <Form.Item
            name="guestCount"
            label="Expected Guest Count"
            rules={[{ required: true, message: 'Please input guest count!' }]}
          >
            <InputNumber min={1} placeholder="Number of guests" size="large" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="concernedVendorIds" label="Notify vendors (optional)">
            <Select
              mode="multiple"
              allowClear
              placeholder="Select vendors to notify by email & in-app alert"
              options={vendorOptions}
              optionFilterProp="label"
              size="large"
            />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginTop: -8, marginBottom: 8 }}>
            Admins and you are always notified when the event is created. Selected vendors get the same event summary.
          </Text>
        </>
      ),
    },
    {
      title: 'Customization',
      content: (
        <>
          <Form.Item
            name="budget"
            label="Total Budget"
            rules={[{ required: true, message: 'Please input budget!' }]}
          >
            <InputNumber min={0} placeholder="Total budget in INR (₹)" size="large" style={{ width: '100%' }} prefix="₹" />
          </Form.Item>

          <div className="customization-headline">Customer Preferences</div>
          <Form.Item name="eventVibe" label="Event vibe">
            <Select
              size="large"
              options={[
                { label: 'Elegant and timeless', value: 'elegant' },
                { label: 'Luxury and grand', value: 'luxury' },
                { label: 'Modern and minimal', value: 'modern' },
                { label: 'Traditional and cultural', value: 'traditional' },
                { label: 'Playful and vibrant', value: 'vibrant' },
              ]}
              placeholder="Choose the overall vibe"
            />
          </Form.Item>
          <Form.Item name="colorPalette" label="Color palette">
            <Input placeholder="E.g. emerald, ivory, and warm gold" size="large" />
          </Form.Item>
          <Form.Item name="mustHaveMoments" label="Must-have moments">
            <Input.TextArea rows={3} placeholder="Special rituals, performances, or memory moments" />
          </Form.Item>
          <Form.Item name="dietaryNotes" label="Dietary preferences">
            <Input.TextArea rows={2} placeholder="Vegan counters, Jain menu, kids menu, allergy notes" />
          </Form.Item>
          <Form.Item name="accessibilityNeeds" label="Accessibility needs">
            <Input.TextArea rows={2} placeholder="Wheelchair access, elderly seating, sign language support" />
          </Form.Item>

          <div className="customization-headline">Sector-level Customization</div>
          <div className="sector-grid">
            {sectorOptions.map((sector) => (
              <Card key={sector.key} size="small" className="sector-card" title={sector.label}>
                <Form.Item name={`${sector.key}Priority`} label="Priority" initialValue="medium">
                  <Select
                    options={[
                      { label: 'High', value: 'high' },
                      { label: 'Medium', value: 'medium' },
                      { label: 'Low', value: 'low' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name={`${sector.key}Budget`} label="Budget (INR)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={`${sector.key}Note`} label="Customization note">
                  <Input.TextArea rows={2} placeholder="Special expectations for this sector" />
                </Form.Item>
              </Card>
            ))}
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="event-create-container">
      <Card className="event-create-card">
        <h1>Create a New Event</h1>

        <Steps current={currentStep} items={steps} style={{ marginBottom: '24px' }} />

        <Spin spinning={loading}>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            {steps[currentStep].content}

            <div className="steps-action">
              {currentStep > 0 && (
                <Button style={{ margin: '0 8px' }} onClick={() => setCurrentStep(currentStep - 1)}>
                  Previous
                </Button>
              )}
              {currentStep < steps.length - 1 && (
                <Button
                  type="primary"
                  onClick={() => {
                    form.validateFields().then(() => {
                      setCurrentStep(currentStep + 1);
                    });
                  }}
                >
                  Next
                </Button>
              )}
              {currentStep === steps.length - 1 && (
                <Button type="primary" htmlType="submit" loading={loading}>
                  Create Event
                </Button>
              )}
            </div>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default EventCreate;
