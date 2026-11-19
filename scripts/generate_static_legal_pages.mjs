import fs from 'fs';

const supportEmail = 'earnflow.user@gmail.com';

const privacyHtml = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Policy · EarnFlow.in</title>
    <meta name="description" content="Official Privacy Policy of EarnFlow.in. Learn how our online gaming platform protects your data, Google authentication information, and USDT transactions." />
    <!-- Google Tag Manager / Google Analytics (G-0YDPNYBGDC) -->
    <script async src="https://www.googletagmanager.com/gtm.js?id=G-0YDPNYBGDC"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-0YDPNYBGDC"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-0YDPNYBGDC');
    </script>

    <link rel="canonical" href="https://earnflow.in/legal/privacy" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800;900&display=swap" rel="stylesheet" />

    <style>
      :root {
        --bg-main: #0b0e14;
        --bg-card: rgba(18, 23, 33, 0.85);
        --border-color: #1f2737;
        --gold: #f5c451;
        --gold-bright: #ffd700;
        --text-dim: #94a3b8;
        --text-main: #e1e2eb;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: var(--bg-main);
        color: var(--text-main);
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        line-height: 1.6;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      a { color: var(--gold); text-decoration: none; }
      a:hover { text-decoration: underline; color: var(--gold-bright); }
      .container { max-width: 900px; margin: 0 auto; padding: 24px 16px 48px; width: 100%; }
      .nav-bar {
        background: #10131a;
        border-bottom: 1px solid var(--border-color);
        padding: 14px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 50;
        backdrop-filter: blur(12px);
      }
      .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: white; }
      .brand img { width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(245, 196, 81, 0.4); }
      .brand-title { font-size: 18px; font-weight: 800; font-family: 'Sora', sans-serif; }
      .brand-title span.gold { color: var(--gold); }
      .btn-home {
        background: #151c2b;
        color: var(--gold);
        border: 1px solid rgba(245, 196, 81, 0.3);
        padding: 8px 16px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
        text-decoration: none;
      }
      .btn-home:hover { background: #1c263b; border-color: var(--gold); text-decoration: none; }
      .header-card {
        background: linear-gradient(135deg, #121624 0%, #0e121c 50%, #1a1230 100%);
        border: 1px solid rgba(245, 196, 81, 0.35);
        border-radius: 20px;
        padding: 32px 24px;
        margin-bottom: 28px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      }
      .header-badge {
        display: inline-block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--gold);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
      }
      h1 { font-size: 30px; font-weight: 900; color: white; font-family: 'Sora', sans-serif; margin-bottom: 8px; }
      .effective-date { font-size: 13px; color: var(--text-dim); }
      .section-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 20px;
      }
      .section-title {
        font-size: 17px;
        font-weight: 800;
        color: white;
        font-family: 'Sora', sans-serif;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .section-num {
        background: rgba(245, 196, 81, 0.15);
        color: var(--gold);
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 800;
        padding: 4px 8px;
        border-radius: 6px;
      }
      p { font-size: 13.5px; color: #cbd5e1; margin-bottom: 12px; }
      p:last-child { margin-bottom: 0; }
      ul { padding-left: 20px; margin-bottom: 12px; }
      li { font-size: 13.5px; color: var(--text-dim); margin-bottom: 8px; }
      li strong { color: white; }
      code {
        font-family: 'JetBrains Mono', monospace;
        background: rgba(245, 196, 81, 0.12);
        color: var(--gold);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
      }
      .callout {
        background: #0b0e14;
        border: 1px solid #272a31;
        border-radius: 12px;
        padding: 16px;
        margin-top: 12px;
        margin-bottom: 12px;
      }
      .footer {
        margin-top: auto;
        border-top: 1px solid var(--border-color);
        padding: 24px 20px;
        text-align: center;
        background: #07090d;
        color: var(--text-dim);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <!-- Top Nav -->
    <header class="nav-bar">
      <a href="/" class="brand">
        <img src="/logo.png" alt="EarnFlow.in Logo" />
        <span class="brand-title">EarnFlow<span class="gold">.in</span></span>
      </a>
      <a href="/" class="btn-home">← Back to Lobby</a>
    </header>

    <!-- Main Content Container -->
    <main class="container">
      <!-- Header Banner -->
      <div class="header-card">
        <span class="header-badge">Official Data Protection &amp; Privacy Practices</span>
        <h1>Privacy Policy</h1>
        <p class="effective-date">
          Effective Date: November 19, 2026 · Official Privacy Statement of <strong>EarnFlow.in</strong>
        </p>
      </div>

      <!-- Section 1 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">01</span> Platform Overview &amp; Privacy Commitment</h2>
        <p>
          Welcome to <strong>EarnFlow.in</strong> (<a href="https://earnflow.in">https://earnflow.in</a>). EarnFlow.in is an online gaming platform providing users with access to interactive games, gaming events, account management, and USDT-based payment features.
        </p>
        <p>
          We respect your privacy and are committed to protecting personal information. This Privacy Policy explains what information we collect, how it is used and protected, and your rights regarding your data when you visit our website, register an account, or play games on EarnFlow.in.
        </p>
        <p>
          This Privacy Policy is publicly accessible without requiring registration or login.
        </p>
      </section>

      <!-- Section 2 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">02</span> Information We Collect</h2>
        <p>We collect only the personal information strictly required to deliver our gaming and payment features:</p>
        <ul>
          <li><strong>Registration &amp; Profile Data:</strong> Email address, player username, and optional profile avatar.</li>
          <li><strong>Google OAuth Authentication Data:</strong> When authenticating via Google Sign-In, we receive your Google User ID, primary email address, verified email status, and public profile name and photo.</li>
          <li><strong>Public TRC-20 Wallet Address:</strong> Your public TRON blockchain address used for deposits and prize disbursals. We never request, access, or store your private keys or recovery passphrases.</li>
          <li><strong>Gaming &amp; Provably Fair Records:</strong> Event participation, game rounds, ticket numbers, bet amounts, cryptographic seeds, and prize payouts.</li>
          <li><strong>Financial Transaction Ledger:</strong> USDT wallet balances, deposit invoice identifiers, on-chain transaction hashes (TxHash), and withdrawal records.</li>
          <li><strong>Technical Metadata:</strong> IP address, device type, browser user-agent, operating system, and session timestamps used strictly for security monitoring and DDoS defense.</li>
        </ul>
      </section>

      <!-- Section 3 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">03</span> Google Sign-In &amp; OAuth 2.0 Practices</h2>
        <p>
          EarnFlow.in provides Google Sign-In to allow users to sign up and authenticate quickly and securely without storing passwords on our servers.
        </p>
        <div class="callout">
          <p><strong>Information Obtained from Google Authentication:</strong></p>
          <ul>
            <li><code>Google Profile ID</code>: Unique numeric identifier.</li>
            <li><code>Email Address</code>: Used for account identification and important security alerts.</li>
            <li><code>Verified Email Status</code>: Confirmation that your email address is authentic.</li>
            <li><code>Display Name &amp; Profile Picture</code>: Populates your public player handle.</li>
          </ul>
        </div>
        <p>
          <strong>Strictly Limited Scope:</strong> We do NOT access your Google Drive files, Gmail messages, contact lists, calendar, browsing history, or Google account password.
        </p>
        <p>
          Our use of Google user data adheres strictly to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
      </section>

      <!-- Section 4 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">04</span> How Personal Information Is Used</h2>
        <p>We use the collected information for the following explicit purposes:</p>
        <ul>
          <li><strong>Authentication &amp; Account Access:</strong> Verifying your identity and securing your account sessions.</li>
          <li><strong>Delivering Gaming Features:</strong> Powering interactive games (Four-Digit Lottery, Crash, Dice, Coinflip, Bingo – Color Trading, and Horse Racing) and generating provably fair random results.</li>
          <li><strong>USDT Payments &amp; Prize Disbursals:</strong> Managing wallet balances, crediting deposits, calculating winnings, and processing withdrawals in USDT.</li>
          <li><strong>Fair Play Auditing:</strong> Recording SHA-256 pre-commit seeds so every round can be independently verified.</li>
          <li><strong>Fraud Prevention:</strong> Detecting duplicate accounts, bot exploitation, and maintaining platform security.</li>
          <li><strong>Customer Support:</strong> Responding to user inquiries submitted to <code>\${supportEmail}</code>.</li>
        </ul>
      </section>

      <!-- Section 5 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">05</span> Third-Party Service Providers &amp; Information Sharing</h2>
        <p>
          <strong>We do not sell, rent, or trade your personal information with third parties or advertisers.</strong>
        </p>
        <p>We share information only with trusted infrastructure providers necessary for operational execution:</p>
        <ul>
          <li><strong>Google LLC:</strong> For OAuth 2.0 authentication and identity verification.</li>
          <li><strong>Supabase Inc.:</strong> Encrypted cloud database infrastructure with Row-Level Security (RLS) enforcement.</li>
          <li><strong>NOWPayments &amp; TRON Blockchain:</strong> Non-custodial gateway for TRC-20 USDT deposit invoice generation. Transactions recorded on the public TRON blockchain are transparent by nature of distributed ledger technology.</li>
          <li><strong>Legal Authorities:</strong> Only when strictly required by a court order, enforceable subpoena, or applicable statutory law.</li>
        </ul>
      </section>

      <!-- Section 6 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">06</span> Data Storage, Protection &amp; Security Practices</h2>
        <p>We employ robust enterprise-grade safeguards:</p>
        <ul>
          <li><strong>Encryption in Transit:</strong> All data transmitted is protected with TLS 1.3 encryption.</li>
          <li><strong>Encryption at Rest:</strong> Database storage and backups are encrypted using AES-256.</li>
          <li><strong>Row-Level Security (RLS):</strong> PostgreSQL RLS policies restrict users to accessing only their own private wallet, ticket, and profile data.</li>
          <li><strong>HMAC Authentication:</strong> Cryptographic signatures verify backend edge operations against tampering.</li>
        </ul>
      </section>

      <!-- Section 7 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">07</span> Cookies and Local Storage</h2>
        <p>
          EarnFlow.in utilizes browser LocalStorage solely for operational necessities: storing authentication session tokens (JWT) and user interface preferences (such as audio mute and sidebar toggles). We do not deploy third-party advertising or retargeting cookies.
        </p>
      </section>

      <!-- Section 8 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">08</span> User Rights: Access, Correction &amp; Deletion</h2>
        <p>You have full sovereign rights regarding your personal information:</p>
        <ul>
          <li><strong>Access:</strong> Request an export of your account and transaction ledger data.</li>
          <li><strong>Correction:</strong> Modify your username or linked TRC-20 address directly in your Profile.</li>
          <li><strong>Deletion:</strong> Request permanent deletion of your account and personal data by emailing <code>\${supportEmail}</code>. Account deletion requests are fulfilled within 30 days.</li>
          <li><strong>Revoke Google Access:</strong> Revoke permissions anytime via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account Security page</a>.</li>
        </ul>
      </section>

      <!-- Section 9 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">09</span> Data Retention Policy</h2>
        <p>
          We retain personal data for the duration of your active account. If you request account closure, personal identifiers are deleted within 30 days, retaining only immutable blockchain transaction hashes and legal audit records required by applicable regulations.
        </p>
      </section>

      <!-- Section 10 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">10</span> Age Restrictions &amp; Protection of Minors</h2>
        <p>
          EarnFlow.in is strictly intended for individuals who are at least <strong>18 years of age</strong> (or legal age of majority in your jurisdiction). We do not knowingly collect personal data from minors. Any discovered account belonging to a minor will be terminated immediately.
        </p>
      </section>

      <!-- Section 11 -->
      <section class="section-card">
        <h2 class="section-title"><span class="section-num">11</span> Contact Information &amp; Support</h2>
        <p>For questions or privacy requests regarding this Privacy Policy:</p>
        <div class="callout">
          <p><strong>Platform:</strong> EarnFlow.in</p>
          <p><strong>Website:</strong> <a href="https://earnflow.in">https://earnflow.in</a></p>
          <p><strong>Privacy Inquiries &amp; Deletions:</strong> <a href="mailto:\${supportEmail}">\${supportEmail}</a></p>
          <p><strong>Customer Support:</strong> <a href="mailto:\${supportEmail}">\${supportEmail}</a></p>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <p>© 2026 EarnFlow.in · All rights reserved · Interactive Provably Fair Gaming &amp; USDT Platform</p>
      <p style="margin-top: 6px;">
        <a href="/legal/privacy" style="color: var(--gold);">Privacy Policy</a> · 
        <a href="/legal/terms" style="color: var(--gold);">Terms &amp; Conditions</a> · 
        <a href="/contact" style="color: var(--gold);">Support</a>
      </p>
    </footer>
  </body>
</html>
`;

// Terms HTML with EarnFlow.in branding and USDT
const termsHtml = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Terms &amp; Conditions · EarnFlow.in</title>
    <meta name="description" content="Official Terms &amp; Conditions of EarnFlow.in. Provably fair online gaming platform rules, USDT payments, and responsible gaming governance." />
    <!-- Google Tag Manager / Google Analytics (G-0YDPNYBGDC) -->
    <script async src="https://www.googletagmanager.com/gtm.js?id=G-0YDPNYBGDC"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-0YDPNYBGDC"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-0YDPNYBGDC');
    </script>

    <link rel="canonical" href="https://earnflow.in/legal/terms" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800;900&display=swap" rel="stylesheet" />

    <style>
      :root {
        --bg-main: #0b0e14;
        --bg-card: rgba(18, 23, 33, 0.85);
        --border-color: #1f2737;
        --gold: #f5c451;
        --gold-bright: #ffd700;
        --text-dim: #94a3b8;
        --text-main: #e1e2eb;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: var(--bg-main);
        color: var(--text-main);
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        line-height: 1.6;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      a { color: var(--gold); text-decoration: none; }
      a:hover { text-decoration: underline; color: var(--gold-bright); }
      .container { max-width: 900px; margin: 0 auto; padding: 24px 16px 48px; width: 100%; }
      .nav-bar {
        background: #10131a;
        border-bottom: 1px solid var(--border-color);
        padding: 14px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 50;
        backdrop-filter: blur(12px);
      }
      .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: white; }
      .brand img { width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(245, 196, 81, 0.4); }
      .brand-title { font-size: 18px; font-weight: 800; font-family: 'Sora', sans-serif; }
      .brand-title span.gold { color: var(--gold); }
      .btn-home {
        background: #151c2b;
        color: var(--gold);
        border: 1px solid rgba(245, 196, 81, 0.3);
        padding: 8px 16px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
        text-decoration: none;
      }
      .btn-home:hover { background: #1c263b; border-color: var(--gold); text-decoration: none; }
      .header-card {
        background: linear-gradient(135deg, #121624 0%, #0e121c 50%, #1a1230 100%);
        border: 1px solid rgba(245, 196, 81, 0.35);
        border-radius: 20px;
        padding: 32px 24px;
        margin-bottom: 28px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      }
      .header-badge {
        display: inline-block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--gold);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
      }
      h1 { font-size: 30px; font-weight: 900; color: white; font-family: 'Sora', sans-serif; margin-bottom: 8px; }
      .effective-date { font-size: 13px; color: var(--text-dim); }
      .section-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 20px;
      }
      .section-title {
        font-size: 17px;
        font-weight: 800;
        color: white;
        font-family: 'Sora', sans-serif;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .section-num {
        background: rgba(245, 196, 81, 0.15);
        color: var(--gold);
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 800;
        padding: 4px 8px;
        border-radius: 6px;
      }
      p { font-size: 13.5px; color: #cbd5e1; margin-bottom: 12px; }
      p:last-child { margin-bottom: 0; }
      ul { padding-left: 20px; margin-bottom: 12px; }
      li { font-size: 13.5px; color: var(--text-dim); margin-bottom: 8px; }
      li strong { color: white; }
      .footer {
        margin-top: auto;
        border-top: 1px solid var(--border-color);
        padding: 24px 20px;
        text-align: center;
        background: #07090d;
        color: var(--text-dim);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <header class="nav-bar">
      <a href="/" class="brand">
        <img src="/logo.png" alt="EarnFlow.in Logo" />
        <span class="brand-title">EarnFlow<span class="gold">.in</span></span>
      </a>
      <a href="/" class="btn-home">← Back to Lobby</a>
    </header>

    <main class="container">
      <div class="header-card">
        <span class="header-badge">Legal Terms &amp; Platform Governance</span>
        <h1>Terms &amp; Conditions</h1>
        <p class="effective-date">
          Effective Date: November 19, 2026 · Official Terms of Service for <strong>EarnFlow.in</strong>
        </p>
      </div>

      <section class="section-card">
        <h2 class="section-title"><span class="section-num">01</span> Acceptance of Terms &amp; Eligibility</h2>
        <p>
          By accessing or using <strong>EarnFlow.in</strong> (<a href="https://earnflow.in">https://earnflow.in</a>), registering an account, or participating in gaming events, you agree to be bound by these Terms &amp; Conditions.
        </p>
        <ul>
          <li>You must be at least <strong>18 years of age</strong> (or legal age of majority in your jurisdiction).</li>
          <li>You represent that online gaming is permitted in your jurisdiction.</li>
          <li>You agree to provide accurate registration information via Google Sign-In or email.</li>
        </ul>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-num">02</span> USDT-Only Platform Currency</h2>
        <p>
          <strong>EarnFlow.in exclusively uses USDT (Tether TRC-20) as its platform currency.</strong> All game stakes, lottery tickets, jackpot prizes, and wallet balances are denominated strictly in USDT. No proprietary virtual tokens are supported for active transactions.
        </p>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-num">03</span> Provably Fair Gaming &amp; Outcomes</h2>
        <p>
          All available games on EarnFlow.in (Four-Digit Lottery, Crash, Dice, Coinflip, Bingo – Color Trading, and Horse Racing) utilize cryptographic provably fair algorithms. Outcome seeds and commit hashes are published before each round, allowing players to independently verify round fairness.
        </p>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-num">04</span> Deposits, Wallets &amp; Withdrawals</h2>
        <p>
          Users may deposit USDT using TRON blockchain (TRC-20) addresses. Withdrawal requests are processed to the user&apos;s verified destination address. Users are solely responsible for ensuring that their recipient TRC-20 address is valid and under their control.
        </p>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-num">05</span> Responsible Gaming &amp; Account Conduct</h2>
        <p>
          EarnFlow.in is designed strictly for social entertainment. We do not provide financial investment advisory services, and past results do not guarantee future outcomes. Multi-accounting, automated bot scripts, and fraudulent chargebacks are strictly prohibited and result in permanent account termination.
        </p>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-num">06</span> Support &amp; Contact</h2>
        <p>
          For assistance or disputes, reach out to our team at <a href="mailto:${supportEmail}">${supportEmail}</a>.
        </p>
      </section>
    </main>

    <footer class="footer">
      <p>© 2026 EarnFlow.in · All rights reserved · Interactive Provably Fair Gaming &amp; USDT Platform</p>
      <p style="margin-top: 6px;">
        <a href="/legal/privacy" style="color: var(--gold);">Privacy Policy</a> · 
        <a href="/legal/terms" style="color: var(--gold);">Terms &amp; Conditions</a> · 
        <a href="/contact" style="color: var(--gold);">Support</a>
      </p>
    </footer>
  </body>
</html>
`;

function writeFiles() {
  const dirs = [
    'public/legal/privacy',
    'public/legal/terms',
    'public/privacy',
    'public/privacy-policy',
    'public/terms',
    'public/terms-and-conditions'
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // Write privacy files
  fs.writeFileSync('public/legal/privacy/index.html', privacyHtml);
  fs.writeFileSync('public/legal/privacy.html', privacyHtml);
  fs.writeFileSync('public/privacy/index.html', privacyHtml);
  fs.writeFileSync('public/privacy-policy/index.html', privacyHtml);
  fs.writeFileSync('public/privacy-policy.html', privacyHtml);
  console.log('✓ Privacy Policy static files generated in public/legal/privacy and public/privacy-policy');

  // Write terms files
  fs.writeFileSync('public/legal/terms/index.html', termsHtml);
  fs.writeFileSync('public/legal/terms.html', termsHtml);
  fs.writeFileSync('public/terms/index.html', termsHtml);
  fs.writeFileSync('public/terms-and-conditions/index.html', termsHtml);
  fs.writeFileSync('public/terms-and-conditions.html', termsHtml);
  console.log('✓ Terms & Conditions static files generated in public/legal/terms and public/terms-and-conditions');
}

writeFiles();
