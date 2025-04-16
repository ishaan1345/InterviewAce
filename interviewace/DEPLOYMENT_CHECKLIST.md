# Deployment Checklist

## Before Deployment
- [x] API URLs are using relative paths (`/api/...`) instead of hardcoded localhost
- [x] Environment variables are configured properly
- [x] Rate limiting is implemented for production
- [x] Static file serving is set up correctly
- [x] Error handling is improved for production
- [x] Proper shutdown handling is implemented
- [x] `.gitignore` excludes all sensitive and unnecessary files
- [x] Server can run in both development and production modes

## Environment Variables
- [ ] Create a new OpenAI API key for production use
- [ ] Configure `OPENAI_API_KEY` in your hosting platform
- [ ] Set `NODE_ENV=production`
- [ ] Configure any other necessary environment variables

## Git & Deployment
- [ ] Ensure you have all changes committed
- [ ] Merge changes to your main/master branch
- [ ] Follow platform-specific deployment steps (see DEPLOYMENT.md)

## Post-Deployment
- [ ] Verify the application loads correctly
- [ ] Test resume upload functionality
- [ ] Test question and answer generation
- [ ] Verify job information saving works
- [ ] Test voice input if applicable
- [ ] Check that history/saved answers work properly
- [ ] Monitor logs for any errors
- [ ] Set up monitoring for ongoing issues

## Security and Performance
- [ ] Verify rate limiting is working correctly
- [ ] Monitor OpenAI API usage to avoid unexpected charges
- [ ] Consider adding more robust authentication if needed
- [ ] Regularly update dependencies
- [ ] Create a backup plan for the application

## Platforms
- [ ] Heroku: Make sure Procfile is correct
- [ ] Railway: Set auto-deploy from your repository
- [ ] Render: Configure automatic deployments
- [ ] General: Make sure the correct Node.js version is specified in `package.json` 