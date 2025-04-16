# InterviewAce Deployment Guide

This document provides instructions for deploying InterviewAce to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. A valid OpenAI API key
2. Node.js 18.x installed
3. Git installed
4. An account on your chosen hosting platform (Heroku, Vercel, Netlify, etc.)

## Preparing for Deployment

1. **Build the application**:
   ```
   npm run build
   ```

2. **Setup environment variables**:
   
   Your deployment will need these environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `NODE_ENV`: Set to `production`
   - `PORT`: Usually set automatically by the platform

## Deployment Options

### Heroku Deployment

1. Create a Heroku account and install the Heroku CLI
2. Log in to Heroku:
   ```
   heroku login
   ```

3. Create a new Heroku app:
   ```
   heroku create your-app-name
   ```

4. Set environment variables:
   ```
   heroku config:set OPENAI_API_KEY=your_api_key
   heroku config:set NODE_ENV=production
   ```

5. Push your code to Heroku:
   ```
   git push heroku main
   ```
   
   If you're on a different branch:
   ```
   git push heroku your-branch-name:main
   ```

6. Open your app:
   ```
   heroku open
   ```

### Railway Deployment

1. Create a Railway account
2. Create a new project and connect your GitHub repository
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
4. Deploy your project

### Render Deployment

1. Create a Render account
2. Create a new Web Service and connect your GitHub repository
3. Configure your service:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add environment variables:
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
5. Deploy your service

## Troubleshooting

### Common Issues

1. **Deployment fails**:
   - Check your build logs for any errors
   - Ensure all dependencies are correctly installed
   - Verify that your Node.js version is supported

2. **Application crashes after deployment**:
   - Check logs on your hosting platform
   - Verify that all environment variables are correctly set
   - Check for any path-related issues in server.js

3. **API calls failing**:
   - Ensure your CORS configuration includes your deployment domain
   - Verify that your API key is valid and has credits
   - Check rate limits on your hosting platform

### Monitoring

- Use your platform's built-in logging to monitor application performance
- Consider adding a monitoring service like New Relic, Sentry, or LogRocket

## Security Considerations

- Never commit your `.env` file with sensitive information
- Regularly rotate your API keys
- Consider implementing additional authentication for your application
- Monitor your API usage to prevent unexpected charges 