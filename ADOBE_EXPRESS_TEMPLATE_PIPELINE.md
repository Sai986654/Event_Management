# Adobe Express Premium Template Pipeline

This guide defines how to export reusable invite templates from Adobe Express Premium and ingest them into Vedika 360.

## Goal

Create one premium Adobe master design and generate many personalized invite outputs by swapping dynamic data and style variants.

## Export Package Structure

Each template export must be uploaded as a folder with this shape:

- manifest.json
- preview/thumb.jpg
- preview/preview.mp4
- scenes/
- overlays/
- graphics/
- audio/
- variants/

Recommended naming:

- Template root folder: `<templateKey>-v<version>`
- Assets: kebab-case names only

## Adobe Express Export Settings

### Video scenes

- Format: MP4 (H.264)
- Resolution: 1080x1920 (primary), optional 1080x1080 and 1920x1080
- FPS: 30
- Bitrate: 8 to 12 Mbps for master exports

### Static graphics

- Decorative elements: PNG (with transparency)
- Non-transparent artwork: JPG or WEBP
- Optional print card: PDF

### Audio

- Master music: WAV 48kHz (if available)
- Delivery fallback: MP3 320kbps

### Preview assets

- thumb.jpg: 1200x1200
- preview.mp4: 10 to 20 second marketing preview

## Dynamic Field Rules

Define all editable fields in manifest.json. Supported field types:

- text
- date
- image
- audio
- color
- font
- qrcode

Minimum required field ids for wedding templates:

- brideName
- groomName
- guestName
- eventDate
- venueName
- customMessage
- qrUrl

## Backend API Integration

Use these admin endpoints after export validation.

### Validate manifest (no DB write)

- Endpoint: `POST /api/admin/invite-templates/adobe-express/validate`
- Body: `{ "manifest": { ... } }` or direct manifest JSON

### Import or update template from manifest

- Endpoint: `POST /api/admin/invite-templates/adobe-express/import`
- Body:
	- `manifest`: object (required)
	- `upsert`: boolean (optional, default true)
	- `variantKey`: string (optional, chooses default style for preview palette)
	- `isActive`: boolean (optional)
	- `sortOrder`: integer (optional)

Example import request body:

```json
{
	"upsert": true,
	"variantKey": "royal-gold",
	"manifest": {
		"manifestVersion": "1.0",
		"templateKey": "luxury-wedding-01",
		"templateName": "Luxury Wedding Cinematic",
		"engine": "adobe-express",
		"version": 1,
		"editableFields": [],
		"variantProfiles": [],
		"outputProfiles": [],
		"timeline": []
	}
}
```

## Variant Strategy

Build style variants by overriding palette, typography, and optional overlays.

Example variants:

- royal-gold
- floral-pastel
- telugu-traditional
- dark-luxury
- modern-minimal

## Validation Before Upload

Run the validator in backend:

`node backend/scripts/validate-adobe-express-manifest.js <path-to-manifest.json>`

If validation fails, fix all listed errors before publishing the template.

## Publishing Workflow

1. Designer exports Adobe package assets.
2. Engineer updates manifest.json and verifies file paths.
3. Run validator.
4. Upload package to storage.
5. Register template record with `templateKey`, `version`, and `variantProfiles`.
6. Enable template in app.

## Notes

- Adobe Express does not provide AE-level timeline and alpha export controls.
- Treat scene videos as pre-rendered textless bases; personalization is applied by manifest-driven field placement in app renderer.
- Keep source Adobe project links in manifest metadata for traceability.
