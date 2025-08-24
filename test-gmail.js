const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🔐 Testing Gmail Authentication...\n');

// Check if environment variables are set
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('❌ Missing environment variables!');
  console.log('Please create a .env file with:');
  console.log('EMAIL_USER=your-gmail@gmail.com');
  console.log('EMAIL_PASS=your-app-password');
  process.exit(1);
}

console.log(`📧 Email: ${process.env.EMAIL_USER}`);
console.log(`🔑 Password: ${process.env.EMAIL_PASS.substring(0, 4)}...${process.env.EMAIL_PASS.substring(process.env.EMAIL_PASS.length - 4)}`);
console.log('');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

// Test connection
async function testConnection() {
  try {
    console.log('🔄 Testing connection...');
    await transporter.verify();
    console.log('✅ Gmail authentication successful!');
    console.log('🎉 You can now run your quote app.');
    
    // Test sending a simple email
    console.log('\n📤 Testing email sending...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test Email - Quote App',
      text: 'This is a test email to verify your Gmail setup is working correctly.',
      html: '<h2>Test Email</h2><p>Your Gmail setup is working correctly!</p>'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    
  } catch (error) {
    console.error('❌ Authentication failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('Invalid login') || error.message.includes('Username and Password not accepted')) {
      console.log('\n🔧 To fix this:');
      console.log('1. Enable 2-Factor Authentication on your Google account');
      console.log('2. Generate an App Password:');
      console.log('   - Go to Google Account → Security → App passwords');
      console.log('   - Select "Mail" and generate a password');
      console.log('3. Use that App Password in your .env file');
      console.log('4. Make sure EMAIL_USER is your full Gmail address');
    }
  }
}

testConnection();
