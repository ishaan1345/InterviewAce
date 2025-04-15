# InterviewAce

InterviewAce is an AI-powered mock interview application that helps users prepare for job interviews by providing real-time interview feedback.

## Features

- Real-time speech-to-text transcription powered by Deepgram
- AI-generated interview answers based on your resume and job details using GPT-4o
- User authentication and data storage with Supabase
- Resume and job details management
- Conversation history tracking

## Tech Stack

- Frontend: React, Tailwind CSS
- Backend: Node.js/Express
- Database/Auth: Supabase
- AI/ML: Deepgram (Speech-to-Text), GPT-4o (Answer generation)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- Supabase account
- Deepgram API key
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/interviewace.git
   cd interviewace
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_DEEPGRAM_API_KEY=your-deepgram-api-key
   OPENAI_API_KEY=your-openai-api-key
   ```

4. Start the development server
   ```bash
   npm run dev:all
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Database Setup

Create the following tables in your Supabase project:

1. **resumes** table:
   - id (uuid, primary key)
   - user_id (uuid, foreign key to auth.users)
   - resume_text (text)
   - updated_at (timestamp)

2. **job_details** table:
   - id (uuid, primary key)
   - user_id (uuid, foreign key to auth.users)
   - job_title (text)
   - company_name (text)
   - responsibilities (text)
   - updated_at (timestamp)

## Deployment

This application can be deployed to platforms like Render or Vercel.

## License

[MIT](LICENSE) 