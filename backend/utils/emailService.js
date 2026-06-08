const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
    if (transporter) return transporter;

    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpPort = (process.env.SMTP_PORT || '').trim();
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();

    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
        pool: true,
        maxConnections: 5,
        maxMessages: 100
    });

    return transporter;
};

const sendEmail = async (options) => {
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const transporter = getTransporter();

    // Define email options
    const mailOptions = {
        from: `HIREWORK <${smtpUser}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[EmailService DEBUG] Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('[EmailService ERROR] Failed to send email:', error);
        throw error;
    }
};

module.exports = sendEmail;
