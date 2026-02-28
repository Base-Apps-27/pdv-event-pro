html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDV Event Pro - Intake Form</title>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-charcoal: #1A1A1A; /* Added from overall design system variables */
      --brand-teal: #1F8A70;
      --brand-green: #8DC63F;
      --brand-yellow: #D7DF23;

      --text-primary: #111827;
      --text-secondary: #6B7280;
      --border-light: #E5E7EB; /* Corresponds to border-gray-200 */
      --bg-light: #F9FAFB;
      --bg-page: #F0F1F3; /* New background color from Visual Identity */
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg-page); /* Changed to use new --bg-page variable */
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
      max-width: 640px; /* Changed from 600px as per UX Patterns */
      margin: 0 auto;
      padding: 24px;
      background: white; /* "Cards: white" */
      border: 1px solid var(--border-light); /* Added as per "Cards: border-gray-200" */
      border-radius: 8px; /* Changed from 12px as per "Cards: rounded-lg" */
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
      border-left: 4px solid var(--brand-teal); /* Consistent with "Section left borders: teal (primary)" */
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
      font-size: 0.75rem; /* Changed from 0.875rem as per "Labels: text-xs" */
      font-weight: 700; /* Changed from 500 as per "Labels: font-bold" */
      color: var(--text-secondary); /* Corresponds to "Labels: text-gray-500" */
      margin-bottom: 8px;
      text-transform: uppercase; /* As per "Labels: uppercase" */
      letter-spacing: 0.05em; /* Changed from 0.5px as per "Labels: tracking-wide" */
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
      background: linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-green) 100%); /* Consistent with "Submit buttons: brand-gradient class" */
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
