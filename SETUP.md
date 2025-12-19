# AI Complaint Management System - Setup Guide

## Project Overview

This is a hackathon MVP for an AI-based complaint management system designed for the Indian Postal Department. The system uses machine learning to automatically categorize complaints, analyze sentiment, assign priority levels, and generate automated responses.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase Edge Functions (TypeScript/Deno)
- **Database:** Supabase (PostgreSQL)
- **AI Models:** Local backend models (complaint_model.pkl, vectorizer.pkl)

## Current Implementation

### What's Working (MVP Demo)

1. **User Complaint Submission**
   - Simple form interface for users to submit complaints
   - Real-time AI processing and response display
   - Clean, government-style UI with red accent colors

2. **Admin Dashboard**
   - View all complaints in a table format
   - Filter by status (All, Pending, Resolved)
   - Statistics dashboard showing total, pending, resolved, and high-priority complaints
   - Mark complaints as resolved
   - Collect feedback on AI responses (Yes/No helpful)

3. **AI Processing via External ML Service**
   - Edge Function calls external Python ML service for inference
   - Uses trained models: complaint_model.pkl and vectorizer.pkl
   - Returns: category, sentiment, priority, and AI-generated response
   - Fallback mechanism: If ML service is unavailable, uses default values
   - System continues to accept complaints even if AI is temporarily down

### Database Schema

The system uses a single `complaints` table with the following structure:

```sql
- id (uuid, primary key)
- complaint_text (text)
- category (text)
- sentiment (text)
- priority (text)
- ai_response (text)
- status (text) - Default: "Pending"
- feedback_helpful (boolean, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account (already configured in this project)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   The `.env` file is already configured with Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://ggpfsygazswbsjxmgfpq.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Database Setup:**
   The database schema has been automatically created with:
   - `complaints` table
   - Row Level Security (RLS) policies
   - Indexes for performance

4. **Edge Functions:**
   Two Edge Functions are deployed:
   - `process-complaint`: Handles AI processing and stores complaints
   - `manage-complaints`: Fetches and updates complaints

5. **Run the application:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - User page: http://localhost:5173/
   - Admin dashboard: http://localhost:5173/admin

## Project Structure

```
project/
├── src/
│   ├── components/
│   │   ├── ComplaintForm.tsx      # User complaint submission page
│   │   └── AdminDashboard.tsx     # Admin dashboard
│   ├── lib/
│   │   └── supabase.ts            # Supabase client configuration
│   ├── App.tsx                     # Main app with routing
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Global styles (Tailwind)
├── supabase/
│   └── functions/
│       ├── process-complaint/      # AI processing endpoint
│       │   └── index.ts
│       └── manage-complaints/      # CRUD operations endpoint
│           └── index.ts
└── SETUP.md                        # This file
```

## Production ML Service Setup

### Architecture Overview

**Current Implementation:**
- Edge Function (`process-complaint`) acts as an orchestrator
- NO AI or NLP logic runs in Edge Functions
- Edge Function calls external Python ML service via HTTP POST
- ML service loads and uses trained models (.pkl files)
- Fallback mechanism ensures system works even if ML service is down

**Why This Architecture?**
1. Edge Functions (Deno) cannot load Python pickle files
2. Trained .pkl models require Python runtime with scikit-learn
3. Separation of concerns: API logic vs ML inference
4. ML service can be scaled independently
5. Multiple services can share the same ML service

### Setting Up the Python ML Service

The Edge Function is already configured to call an external ML service. You need to:

1. **Create a separate Python backend:**
   ```bash
   mkdir ml-service
   cd ml-service
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install flask scikit-learn pandas numpy
   ```

2. **Create ML API service (`ml-service/app.py`):**
   ```python
   from flask import Flask, request, jsonify
   import pickle
   import os

   app = Flask(__name__)

   # Load models
   MODEL_PATH = os.path.join(os.path.dirname(__file__), 'complaint_model.pkl')
   VECTORIZER_PATH = os.path.join(os.path.dirname(__file__), 'vectorizer.pkl')

   with open(MODEL_PATH, 'rb') as f:
       model = pickle.load(f)

   with open(VECTORIZER_PATH, 'rb') as f:
       vectorizer = pickle.load(f)

   @app.route('/predict', methods=['POST'])
   def predict():
       data = request.get_json()
       complaint_text = data.get('complaint_text', '')

       # Vectorize the text
       text_vectorized = vectorizer.transform([complaint_text])

       # Predict category
       category = model.predict(text_vectorized)[0]

       # You can add sentiment analysis, priority calculation here
       sentiment = analyze_sentiment(complaint_text)  # Implement this
       priority = calculate_priority(category, sentiment)  # Implement this
       ai_response = generate_response(category)  # Implement this

       return jsonify({
           'category': category,
           'sentiment': sentiment,
           'priority': priority,
           'ai_response': ai_response
       })

   if __name__ == '__main__':
       app.run(host='0.0.0.0', port=5000)
   ```

3. **Run the ML service locally for testing:**
   ```bash
   python app.py
   # Service will run on http://localhost:5000
   ```

4. **Test the ML service:**
   ```bash
   curl -X POST http://localhost:5000/predict \
     -H "Content-Type: application/json" \
     -d '{"complaint_text": "My package was delayed by 5 days"}'
   ```

   Expected response:
   ```json
   {
     "category": "Delayed Delivery",
     "sentiment": "Negative",
     "priority": "High",
     "ai_response": "We apologize for the delay..."
   }
   ```

5. **Deploy the ML service to production:**

   **Option A: Railway (Recommended)**
   - Create account at railway.app
   - Deploy Python app with one click
   - Railway provides a public URL automatically

   **Option B: Render**
   - Create account at render.com
   - Deploy as a Web Service
   - Free tier available

   **Option C: AWS/GCP/Azure**
   - Deploy as containerized service
   - Use Docker for consistent deployments

6. **Configure the ML_SERVICE_URL environment variable:**

   In Supabase Dashboard:
   - Go to: Settings > Edge Functions > Secrets
   - Add secret: `ML_SERVICE_URL` = `https://your-ml-service-url.com`
   - The Edge Function will automatically use this URL

### Important Notes

1. **The Edge Function is already configured** to call the ML service. No code changes needed in Edge Functions.

2. **Fallback safety**: If `ML_SERVICE_URL` is not set or the service is down, the system uses fallback values and continues to accept complaints.

3. **Required ML service response format**:
   ```json
   {
     "category": "string",
     "sentiment": "string",
     "priority": "string",
     "ai_response": "string"
   }
   ```

4. **Security**: Deploy ML service with HTTPS in production. Consider adding API key authentication between Edge Function and ML service.

## ML Model Training & Feedback Loop

The system collects feedback on AI responses through the admin dashboard. This data is stored in the `feedback_helpful` column.

### Using Feedback for Model Improvement

1. **Extract feedback data:**
   ```sql
   SELECT
     complaint_text,
     category,
     sentiment,
     feedback_helpful
   FROM complaints
   WHERE feedback_helpful IS NOT NULL;
   ```

2. **Retrain models periodically:**
   - Use complaints marked as "helpful" to reinforce correct predictions
   - Use complaints marked as "not helpful" to identify misclassifications
   - Implement active learning to improve model accuracy

3. **Model versioning:**
   - Keep track of model versions
   - A/B test new models before full deployment
   - Monitor performance metrics (accuracy, F1-score, etc.)

## API Endpoints

### Process Complaint
- **URL:** `https://ggpfsygazswbsjxmgfpq.supabase.co/functions/v1/process-complaint`
- **Method:** POST
- **Body:**
  ```json
  {
    "complaint_text": "My package was delayed by 5 days"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "complaint": {
      "id": "uuid",
      "complaint_text": "...",
      "category": "Delayed Delivery",
      "sentiment": "Negative",
      "priority": "Medium",
      "ai_response": "...",
      "status": "Pending",
      "created_at": "..."
    }
  }
  ```

### Get All Complaints
- **URL:** `https://ggpfsygazswbsjxmgfpq.supabase.co/functions/v1/manage-complaints`
- **Method:** GET
- **Response:**
  ```json
  {
    "success": true,
    "complaints": [...]
  }
  ```

### Update Complaint
- **URL:** `https://ggpfsygazswbsjxmgfpq.supabase.co/functions/v1/manage-complaints`
- **Method:** PUT
- **Body:**
  ```json
  {
    "id": "uuid",
    "status": "Resolved",
    "feedback_helpful": true
  }
  ```

## UI Design Guidelines

The application follows a minimal, government-style design:

### Color Palette
- **Primary:** Red (#DC2626) - Indian Post inspired
- **Background:** Light gray (#F9FAFB)
- **Text:** Dark gray (#111827)
- **Borders:** Gray (#E5E7EB)
- **Success:** Green (#16A34A)
- **Warning:** Amber (#D97706)
- **Error:** Red (#DC2626)

### Typography
- **Font Family:** System font stack (sans-serif)
- **Headers:** 1.5rem - 2rem, semi-bold
- **Body:** 0.875rem - 1rem, regular
- **Labels:** 0.75rem - 0.875rem, medium

### Components
- Clean, rounded borders (8px)
- Subtle shadows for elevation
- Clear visual hierarchy
- Mobile-responsive design
- Accessible contrast ratios

## Production Checklist

Before deploying to production:

- [ ] Deploy Python ML service to production (Railway, Render, AWS, etc.)
- [ ] Set ML_SERVICE_URL environment variable in Supabase Edge Functions
- [ ] Test end-to-end ML predictions
- [ ] Add authentication for admin dashboard
- [ ] Implement rate limiting on API endpoints
- [ ] Add input validation and sanitization
- [ ] Set up monitoring and error tracking
- [ ] Configure backup and disaster recovery
- [ ] Add comprehensive logging
- [ ] Implement CAPTCHA on public forms
- [ ] Set up CI/CD pipeline
- [ ] Perform security audit
- [ ] Load testing and performance optimization
- [ ] Add email notifications for complaint status updates
- [ ] Implement user tracking (complaint ID lookup)
- [ ] Add data export functionality for admins
- [ ] Configure proper RLS policies for production

## Future Enhancements

1. **User Features:**
   - Track complaint status with ID
   - Email notifications
   - File upload (images of damaged parcels)
   - Multi-language support (Hindi, English, regional languages)

2. **Admin Features:**
   - Advanced filtering and search
   - Bulk actions
   - Analytics dashboard
   - Export reports (PDF, Excel)
   - Complaint assignment to staff

3. **AI Improvements:**
   - Multi-label classification
   - Intent detection
   - Named entity recognition
   - Automated escalation rules
   - Predictive analytics for complaint trends

4. **Integration:**
   - SMS notifications
   - WhatsApp bot integration
   - Integration with existing postal systems
   - API for third-party services

## Troubleshooting

### Common Issues

1. **Edge Functions not working:**
   - Check Supabase project is active
   - Verify API keys are correct
   - Check Edge Function logs in Supabase dashboard

2. **Database errors:**
   - Verify RLS policies are set correctly
   - Check if tables exist
   - Ensure indexes are created

3. **CORS errors:**
   - Edge Functions should already have CORS headers
   - Check browser console for specific errors

4. **Build errors:**
   - Run `npm install` to ensure all dependencies are installed
   - Check for TypeScript errors: `npm run typecheck`
   - Clear node_modules and reinstall if needed

5. **ML Service errors:**
   - Check if ML_SERVICE_URL is configured in Supabase Edge Functions
   - Verify ML service is running and accessible
   - Check Edge Function logs in Supabase dashboard
   - Test ML service directly with curl
   - If ML service is down, system will use fallback values
   - Ensure ML service returns all required fields: category, sentiment, priority, ai_response

## Support & Contact

For questions or issues:
- Check the code comments in each file
- Review Supabase documentation: https://supabase.com/docs
- React documentation: https://react.dev

## License

This is a hackathon MVP project. Use and modify as needed for your purposes.

---

**Built with ❤️ for Indian Postal Department**
