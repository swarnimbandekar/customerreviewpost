import { useState } from 'react';
import { Send, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface ComplaintResult {
  id: string;
  category: string;
  sentiment: string;
  priority: string;
  ai_response: string;
}

export default function ComplaintForm() {
  const [complaintText, setComplaintText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ComplaintResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!complaintText.trim()) {
      setError('Please enter your complaint');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setResult(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-complaint`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ complaint_text: complaintText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit complaint');
      }

      setResult(data.complaint);
      setComplaintText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'Medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'Low':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive':
        return 'text-green-600';
      case 'Negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Indian Postal Department</h1>
              <p className="text-sm text-gray-600">Complaint Management System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Submit Your Complaint</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="complaint" className="block text-sm font-medium text-gray-700 mb-2">
                Describe your issue
              </label>
              <textarea
                id="complaint"
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                placeholder="Please provide detailed information about your complaint..."
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Complaint
                </>
              )}
            </button>
          </form>

          {result && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Complaint Submitted Successfully</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Category</p>
                    <p className="text-base font-semibold text-gray-900">{result.category}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Sentiment</p>
                    <p className={`text-base font-semibold ${getSentimentColor(result.sentiment)}`}>
                      {result.sentiment}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Priority</p>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(result.priority)}`}>
                      <TrendingUp className="w-4 h-4" />
                      {result.priority}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Automated Response</h4>
                  <p className="text-sm text-blue-800 leading-relaxed">{result.ai_response}</p>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Complaint ID: {result.id}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a
            href="/admin"
            className="text-sm text-gray-600 hover:text-red-600 underline transition-colors"
          >
            Admin Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
