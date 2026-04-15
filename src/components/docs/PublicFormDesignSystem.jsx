# Design System: Public Intake Forms

## Visual Identity & Aesthetic Principles

### 1. Brand Color Palette
```css
:root {
  --brand-charcoal: #1A1A1A;
  --brand-teal: #1F8A70;
  --brand-green: #8DC63F;
  --brand-yellow: #D7DF23;

  --text-primary: #111827;
  --text-secondary: #6B7280;
  --border-light: #E5E7EB;
  --bg-light: #F9FAFB;
}
```

### 2. Typography System
```css
/* Headings - Bold, uppercase, high-impact */
h1, h2 { font-family: 'Anton', 'Impact', sans-serif; text-transform: uppercase; }

/* Body - Clean, readable */
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* Form labels - Small caps, medium weight */
label { font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); }
```

### 3. Spacing & Layout
*   **Container max-width**: 600px (form-focused, reduces cognitive load)
*   **Padding**: 24px (card), 16px (sections)
*   **Gap between form groups**: 24px
*   **Mobile**: 16px padding, 100% width

---

## HTML Structure Template

### Complete Form Shell
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Intake Form</title>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-teal: #1F8A70;
      --brand-green: #8DC63F;
      --brand-yellow: #D7DF23;
      --text-primary: #111827;
      --text-secondary: #6B7280;
      --border-light: #E5E7EB;
      --bg-light: #F9FAFB;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .form-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    .form-header {
      margin-bottom: 32px;
      text-align: center;
      border-bottom: 2px solid var(--brand-teal);
      padding-bottom: 24px;
    }

    .form-header h1 {
      font-family: 'Anton', 'Impact', sans-serif;
      text-transform: uppercase;
      font-size: 2rem;
      margin-bottom: 8px;
      color: var(--text-primary);
      letter-spacing: 0.05em;
    }

    .form-header p {
      font-size: 0.95rem;
      color: var(--text-secondary);
    }

    .form-section {
      margin-bottom: 32px;
      padding: 24px;
      background: var(--bg-light);
      border-radius: 8px;
      border-left: 4px solid var(--brand-teal);
    }

    .form-section h3 {
      font-family: 'Anton', 'Impact', sans-serif;
      text-transform: uppercase;
      font-size: 1.1rem;
      margin-bottom: 16px;
      color: var(--brand-teal);
      letter-spacing: 0.05em;
    }

    .form-group {
      margin-bottom: 24px;
    }

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input, textarea, select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      font-family: inherit;
      font-size: 1rem;
      color: var(--text-primary);
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--brand-teal);
      box-shadow: 0 0 0 3px rgba(31, 138, 112, 0.1);
    }

    button {
      padding: 12px 32px;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-primary {
      background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%);
      color: white;
      width: 100%;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(31, 138, 112, 0.3);
    }
    
    .status-message {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
      border: 1px solid transparent;
    }

    .status-error {
      background: #fee2e2;
      color: #7f1d1d;
      border-color: #fecaca;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="form-header">
      <h1>Form Title</h1>
      <p>Subtitle or instructions</p>
    </div>
    
    <!-- Form Content -->
  </div>
</body>
</html>
``