# Vendor Registration Final Guide

This is the only guide you need to run vendor registration with Google Form -> webhook -> database.

## What You Get

- Vendors submit a Google Form.
- Submission hits your webhook instantly (no cron/timer).
- Vendor user + profile are created automatically.
- Admin approves from panel.
- Form shows category-specific fields based on selected category.
- Form schema is fetched from backend endpoint, so it stays aligned with your app category list.

## Cost

- Google Forms: free
- Google Apps Script webhook trigger: free
- Google API usage in this flow: effectively free for your expected volume

## One-Time Setup (2 Commands + 2 Manual Steps)

Run from [backend](backend):

```bash
npm run vendor:webhook:setup -- --base-url=https://your-domain.com
```

What this command auto-does:

- Generates webhook secret
- Updates [backend/.env](backend/.env) with `VENDOR_WEBHOOK_SECRET`
- Creates ready files in [automation/vendor-webhook](automation/vendor-webhook):
  - `.env.vendor-webhook`
  - `google-apps-script.gs`
  - `sample-vendor-payload.json`
  - `test-vendor-webhook.cmd.txt`

Manual step 1:

- Open Google Form -> Script editor
- Paste [automation/vendor-webhook/google-apps-script.gs](automation/vendor-webhook/google-apps-script.gs)
- Run function `setupDynamicCategoryForm()` once (from Apps Script Run button)
- Create trigger: `onFormSubmit` -> `On form submit`

Whenever categories are updated in your app admin panel, run `setupDynamicCategoryForm()` again to refresh form sections/questions from backend schema.

Manual step 2:

- Run test command from [automation/vendor-webhook/test-vendor-webhook.cmd.txt](automation/vendor-webhook/test-vendor-webhook.cmd.txt)

## Verify End-to-End

1. Submit one test response in Google Form.
2. Check your backend logs for `VendorWebhook` messages.
3. Confirm new vendor appears in admin verification queue.

## Daily Usage

- Share Google Form link with vendors.
- System auto-creates vendor entries on each submit.
- Admin only handles approve/reject.

## Useful Commands

From [backend](backend):

```bash
# Full setup (recommended)
npm run vendor:webhook:setup -- --base-url=https://your-domain.com

# Regenerate webhook assets only
npm run vendor:webhook:bootstrap -- --base-url=https://your-domain.com

# Re-apply env from generated snippet
npm run vendor:webhook:apply-env
```

## Troubleshooting

- `401 Invalid webhook secret`:
  - Re-run setup command and repaste generated Apps Script.
- `Validation failed`:
  - Ensure base required fields exist: email, businessName, name, phone, category, city, state.
  - Ensure category-specific required fields are answered (e.g. `catering -> serviceType, maxGuests`).
- No vendor created:
  - Ensure Apps Script trigger is enabled and backend is reachable from internet.

## Required Files (Already in Project)

- [backend/controllers/webhookController.js](backend/controllers/webhookController.js)
- [backend/routes/webhookRoutes.js](backend/routes/webhookRoutes.js)
- [backend/routes/vendorFormSchemaRoutes.js](backend/routes/vendorFormSchemaRoutes.js)
- [backend/scripts/setup-vendor-webhook.js](backend/scripts/setup-vendor-webhook.js)
- [backend/scripts/bootstrap-vendor-webhook.js](backend/scripts/bootstrap-vendor-webhook.js)
- [backend/scripts/apply-vendor-webhook-env.js](backend/scripts/apply-vendor-webhook-env.js)

That's it. Use this single guide for setup and operations.
