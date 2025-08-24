const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Add these options for better compatibility
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Send quote request endpoint
app.post('/send-quote', async (req, res) => {
  try {
    const { fullName, email, phone, projectType, message } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: Full Name, Email, Phone, and Message are required' 
      });
    }

    // Create email content
    const subject = `New Quote Request from ${fullName}`;
    const htmlContent = `
      <h2>New Quote Request</h2>
      <p><strong>Full Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Project Type:</strong> ${projectType || 'Not specified'}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;
    
    const textContent = `
New Quote Request

Full Name: ${fullName}
Email: ${email}
Phone: ${phone}
Project Type: ${projectType || 'Not specified'}

Message:
${message}
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself
      replyTo: email, // Reply-to set to customer's email
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      message: 'Quote request sent successfully! We\'ll respond within 24 hours.',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending quote request:', error);
    
    // Provide more helpful error messages
    let userMessage = 'Failed to send quote request. Please try again.';
    if (error.message.includes('Invalid login') || error.message.includes('Username and Password not accepted')) {
      userMessage = 'Email authentication failed. Please check your Gmail credentials and ensure you\'re using an App Password.';
    } else if (error.message.includes('ENOTFOUND')) {
      userMessage = 'Network error. Please check your internet connection.';
    }
    
    res.status(500).json({
      success: false,
      message: userMessage,
      error: error.message
    });
  }
});

// Send email endpoint (keeping for backward compatibility)
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: to, subject, and either text or html' 
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      message: 'Email sent successfully!',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Email server is running' });
});

app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
