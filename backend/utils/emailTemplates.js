const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const brandUrl = (path = '/') => {
    const base = (process.env.CLIENT_URL || 'https://hirework-freelance-platform.vercel.app').replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const createEmailLayout = ({ eyebrow, title, intro, content, accent = '#10b981', ctaLabel, ctaHref, footerNote }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HIREWORK</title>
</head>
<body style="margin:0;padding:0;background:#020617;font-family:Arial,sans-serif;color:#e5e7eb;">
  <div style="background:radial-gradient(circle at top, rgba(16,185,129,0.22), transparent 38%), #020617; padding:32px 16px;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="display:inline-block;padding:8px 14px;border:1px solid rgba(255,255,255,0.12);border-radius:999px;background:rgba(15,23,42,0.72);color:#86efac;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
          ${eyebrow}
        </div>
      </div>
      <div style="background:linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98)); border:1px solid rgba(148,163,184,0.18); border-radius:28px; overflow:hidden; box-shadow:0 22px 70px rgba(0,0,0,0.35);">
        <div style="padding:32px 32px 18px; background:linear-gradient(135deg, rgba(16,185,129,0.20), rgba(6,182,212,0.12)); border-bottom:1px solid rgba(148,163,184,0.16);">
          <div style="font-size:28px;font-weight:800;letter-spacing:0.04em;color:#f8fafc;">HIREWORK</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#cbd5e1;">${intro}</div>
        </div>
        <div style="padding:28px 32px 32px;">
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#f8fafc;">${title}</h1>
          <div style="font-size:15px;line-height:1.75;color:#cbd5e1;">${content}</div>
          ${ctaLabel && ctaHref ? `
          <div style="margin-top:28px;">
            <a href="${ctaHref}" style="display:inline-block;background:${accent};color:#052e16;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px;">${ctaLabel}</a>
          </div>` : ''}
        </div>
      </div>
      <div style="padding:18px 8px 0;text-align:center;color:#94a3b8;font-size:12px;line-height:1.7;">
        ${footerNote || 'You are receiving this email because of activity on your HIREWORK account.'}<br />
        <a href="${brandUrl('/')}" style="color:#86efac;text-decoration:none;">hirework-freelance-platform.vercel.app</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const buildOtpEmail = ({ otp, type }) => {
    const isRegistration = type === 'registration';
    const actionLabel = isRegistration ? 'Verify your email' : 'Reset your password';

    return {
        subject: isRegistration ? 'Verify your email - HIREWORK OTP' : 'Reset your password - HIREWORK OTP',
        message: `${actionLabel}. Your HIREWORK OTP is ${otp}. It expires in 10 minutes.`,
        html: createEmailLayout({
            eyebrow: isRegistration ? 'Registration OTP' : 'Password Reset OTP',
            title: actionLabel,
            intro: isRegistration
                ? 'Welcome to HIREWORK. Use the secure code below to continue creating your account.'
                : 'We received a password reset request for your HIREWORK account. Use the secure code below to continue.',
            content: `
              <p style="margin:0 0 18px;">Hello,</p>
              <p style="margin:0 0 22px;">Enter this one-time password in the app to continue:</p>
              <div style="margin:0 0 24px;padding:22px;border-radius:20px;background:linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.10));border:1px solid rgba(16,185,129,0.26);text-align:center;">
                <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#86efac;margin-bottom:10px;">Your OTP Code</div>
                <div style="font-size:36px;font-weight:800;letter-spacing:0.32em;color:#f8fafc;">${escapeHtml(otp)}</div>
              </div>
              <p style="margin:0 0 14px;">This code expires in <strong style="color:#f8fafc;">10 minutes</strong>.</p>
              <p style="margin:0;">If you did not request this, you can safely ignore this email.</p>
            `,
            accent: '#10b981',
            ctaLabel: isRegistration ? 'Open HIREWORK' : 'Go to Reset Password',
            ctaHref: isRegistration ? brandUrl('/register') : brandUrl('/forgot-password'),
            footerNote: 'For your security, never share this OTP with anyone - including HIREWORK support.'
        })
    };
};

const buildAgreementEmail = ({ freelancerName, senderName, projectTitle, amount, milestones = [] }) => {
    const safeMilestones = milestones.map((milestone, index) => {
        const dueText = milestone.dueDate ? ` - Due ${escapeHtml(milestone.dueDate)}` : '';
        return `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,0.12);vertical-align:top;">
              <div style="color:#f8fafc;font-weight:700;">${index + 1}. ${escapeHtml(milestone.title)}</div>
              <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Milestone payment${dueText}</div>
            </td>
            <td style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,0.12);vertical-align:top;text-align:right;color:#86efac;font-weight:700;white-space:nowrap;">Rs ${escapeHtml(milestone.amount)}</td>
          </tr>`;
    }).join('');

    const plainMilestones = milestones.map((milestone, index) => `${index + 1}. ${milestone.title} - Rs ${milestone.amount}${milestone.dueDate ? ` (Due ${milestone.dueDate})` : ''}`).join('\n');

    return {
        subject: `New Agreement: ${projectTitle}`,
        message: `${senderName} sent you a new agreement for ${projectTitle}.\n\n${plainMilestones}\n\nTotal: Rs ${amount}`,
        html: createEmailLayout({
            eyebrow: 'New Agreement',
            title: `Agreement for ${escapeHtml(projectTitle)}`,
            intro: `${escapeHtml(senderName)} sent a new agreement on HIREWORK. Review the scope, milestones, and total before accepting.`,
            content: `
              <p style="margin:0 0 18px;">Hi ${escapeHtml(freelancerName)},</p>
              <p style="margin:0 0 22px;">A new agreement is ready for your review. Here is the summary:</p>
              <div style="margin:0 0 24px;padding:20px;border-radius:20px;background:rgba(15,23,42,0.72);border:1px solid rgba(148,163,184,0.14);">
                <div style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;">Project</div>
                <div style="font-size:24px;font-weight:800;color:#f8fafc;">${escapeHtml(projectTitle)}</div>
                <div style="margin-top:14px;color:#cbd5e1;">Total value: <strong style="color:#86efac;">Rs ${escapeHtml(amount)}</strong></div>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 8px;">
                ${safeMilestones}
              </table>
              <p style="margin:20px 0 0;">Please respond inside HIREWORK to keep your work, payment, and dispute protections active.</p>
            `,
            accent: '#10b981',
            ctaLabel: 'Review Agreement',
            ctaHref: brandUrl('/contract'),
            footerNote: 'Keep all communication and acceptance inside HIREWORK for full platform protection.'
        })
    };
};

module.exports = {
    buildOtpEmail,
    buildAgreementEmail
};
