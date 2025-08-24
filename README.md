# Quote Request App

A professional quote request form application built with Node.js, Express, and Nodemailer. Perfect for businesses to collect project inquiries and send automated responses.

## Features

- 📋 Professional quote request form
- 📤 Instant email notifications
- 🎨 Beautiful and modern UI design
- 📱 Fully responsive design
- ⚡ Fast and reliable processing
- 🔒 Secure form handling
- 📧 Automated email responses

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server Configuration
PORT=3000
```

**Important:** For Gmail, you need to use an "App Password" instead of your regular password:
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account settings → Security → App passwords
3. Generate an app password for "Mail"
4. Use that password in the EMAIL_PASS variable

### 3. Run the Application

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The app will be available at `http://localhost:3000`

## API Endpoints

- `GET /` - Main quote request form page
- `POST /send-quote` - Submit quote request endpoint
- `POST /send-email` - Send email endpoint (legacy)
- `GET /health` - Health check endpoint

## Technologies Used

- **Backend:** Node.js, Express.js, Nodemailer
- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Styling:** Custom CSS with modern design principles

## Security Notes

- Never commit your `.env` file to version control
- Use app passwords for Gmail instead of regular passwords
- The app includes CORS protection and input validation

## Troubleshooting

If you encounter issues:
1. Make sure all dependencies are installed
2. Verify your Gmail credentials in the `.env` file
3. Check that you're using an app password for Gmail
4. Ensure port 3000 is not already in use
