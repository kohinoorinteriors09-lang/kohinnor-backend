const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration
// In development, allow all origins for easier testing
// In production, specify exact origins
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Request logging middleware (optimized to prevent memory issues)
app.use((req, res, next) => {
  // Only log in development to reduce memory usage in production
  if (process.env.NODE_ENV === 'development') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Origin:', req.headers.origin);
  }
  next();
});

app.use(cors(corsOptions));
// Add body size limits to prevent memory issues
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Static files should come after API routes to avoid conflicts
// app.use(express.static('public'));

// Email configuration with improved timeout and connection settings for Render
// Using pool: false to prevent memory leaks and connection issues
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "kohinoorinteriors09@gmail.com",
    pass: "utzv hlvh xonq dvbl"
  },
  // Increased connection timeout settings for Render network delays
  connectionTimeout: 60000, // 60 seconds - accounts for Render spin-up
  greetingTimeout: 30000, // 30 seconds
  socketTimeout: 60000, // 60 seconds
  // Retry settings - pool disabled to prevent memory leaks
  pool: false, // Disable pooling for better reliability on Render and to prevent memory issues
  // TLS options
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  // Debug (set to false in production)
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development'
});

// Add memory monitoring (optional, for debugging)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const used = process.memoryUsage();
    console.log('Memory Usage:', {
      rss: `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
      external: `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`
    });
  }, 30000); // Log every 30 seconds in development
}

// Routes
// Note: CORS middleware above already handles OPTIONS preflight requests
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Retry utility function for handling Render free tier spin-down delays (50+ seconds)
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Pass attempt number to function so it can try different configurations
      return await fn(attempt);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isTimeoutError = error.code === 'ETIMEDOUT' || 
                            error.message?.includes('timeout') ||
                            error.code === 'ECONNREFUSED' ||
                            error.command === 'CONN' ||
                            (error.code && error.code.includes('TIMEOUT'));
      
      if (isLastAttempt || !isTimeoutError) {
        throw error;
      }
      
      // Exponential backoff with longer delays for Render spin-up: 2s, 10s, 30s
      // This accounts for the 50+ second spin-up time on Render free tier
      const delays = [2000, 10000, 30000];
      const delay = delays[attempt - 1] || initialDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt}/${maxRetries} failed (${error.code || error.message || 'CONN timeout'}), retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Send quote request endpoint
app.post('/send-quote', cors(corsOptions), async (req, res) => {
  console.log('Received POST /send-quote request');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  
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
      from: "kohinoorinteriors09@gmail.com",
      to: "kohinoorinteriors09@gmail.com", // Send to yourself
      replyTo: email, // Reply-to set to customer's email
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    // Add timeout wrapper for email sending (increased timeout for Render spin-up and SMTP connection)
    const sendEmailWithTimeout = (transporter, mailOptions, timeout = 90000) => {
      return Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => {
            const error = new Error('Email sending timeout - server may be experiencing connectivity issues');
            error.code = 'ETIMEDOUT';
            error.command = 'CONN';
            reject(error);
          }, timeout)
        )
      ]);
    };

    // Retry email sending with exponential backoff to handle Render free tier spin-down
    // Try different ports/configurations on retry
    const sendEmail = async (attempt = 1) => {
      // Try port 465 (SSL) on later attempts if 587 (TLS) fails
      const useSSL = attempt >= 2;
      const port = useSSL ? 465 : 587;
      
      let retryTransporter = null;
      try {
        retryTransporter = nodemailer.createTransport({
          service: 'gmail',
          host: 'smtp.gmail.com',
          port: port,
          secure: useSSL, // true for 465, false for 587
          auth: {
            user: "kohinoorinteriors09@gmail.com",
            pass: "utzv hlvh xonq dvbl"
          },
          connectionTimeout: 60000,
          greetingTimeout: 30000,
          socketTimeout: 60000,
          pool: false, // Disable pooling to prevent memory leaks
          tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
          }
        });
        
        console.log(`Attempting to send email via ${useSSL ? 'SSL (465)' : 'TLS (587)'}...`);
        const result = await sendEmailWithTimeout(retryTransporter, mailOptions);
        return result;
      } finally {
        // Properly close and cleanup transporter to free memory
        if (retryTransporter) {
          try {
            retryTransporter.close();
          } catch (closeError) {
            console.warn('Error closing transporter:', closeError.message);
          }
          retryTransporter = null;
        }
      }
    };

    // Retry up to 3 times with increasing delays (2s, 10s, 30s) to handle Render's 50+ second spin-up
    const info = await retryWithBackoff(sendEmail, 3, 2000);
    
    res.json({
      success: true,
      message: 'Quote request sent successfully! We\'ll respond within 24 hours.',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending quote request:', error);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    
    // Provide more helpful error messages
    let userMessage = 'Failed to send quote request. Please try again.';
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      userMessage = 'Connection timeout - Unable to reach email server. This may be a temporary network issue. Please try again in a few moments.';
    } else if (error.message.includes('Invalid login') || error.message.includes('Username and Password not accepted')) {
      userMessage = 'Email authentication failed. Please check your Gmail credentials and ensure you\'re using an App Password.';
    } else if (error.message.includes('ENOTFOUND') || error.code === 'ENOTFOUND') {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'ECONNREFUSED') {
      userMessage = 'Connection refused - Email server is not reachable. Please try again later.';
    }
    
    res.status(500).json({
      success: false,
      message: userMessage,
      error: error.message,
      errorCode: error.code || 'UNKNOWN'
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
      from: "kohinoorinteriors09@gmail.com",
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

// Serve static files after API routes
app.use(express.static('public'));

// 404 handler for unmatched routes
app.use((req, res) => {
  // Only return JSON for API-like paths, otherwise let Express handle it
  if (req.path.startsWith('/api') || req.path.startsWith('/send-') || req.path.startsWith('/health')) {
    return res.status(404).json({ 
      success: false, 
      message: `Route not found: ${req.method} ${req.path}` 
    });
  }
  // For other routes, send a simple 404
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`CORS enabled for localhost origins`);
  console.log(`API endpoints available:`);
  console.log(`  POST http://localhost:${PORT}/send-quote`);
  console.log(`  POST http://localhost:${PORT}/send-email`);
  console.log(`  GET  http://localhost:${PORT}/health`);
});
