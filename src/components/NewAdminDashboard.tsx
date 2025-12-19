import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, CheckCircle2, Clock, AlertCircle, ThumbsUp, ThumbsDown,
  LogOut, BarChart3, MessageSquare, Brain, Info, Eye, X, Package, TrendingUp,
  Search, Filter, Users, Settings, Menu, ChevronRight, Activity, Target
} from 'lucide-react';
import Analytics from './Analytics';
import MessageThread from './MessageThread';
import { supabase } from '../lib/supabase';

interface Complaint {
  id: string;
  complaint_text: string;
  category: string;
  sentiment: string;
  priority: string;
  ai_response: string;
  ai_confidence_score?: number;
  ai_explanation?: string;
  status: string;
  feedback_helpful: boolean | null;
  created_at: string;
  user_id: string;
}

export default function NewAdminDashboard() {
  const { signOut, user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'complaints' | 'analytics'>('dashboard');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateComplaintStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchComplaints();
    } catch (error) {
      console.error('Error updating complaint:', error);
    }
  };

  const getEmojiForSentiment = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return '😊';
      case 'Negative': return '😞';
      case 'Neutral': return '😐';
      default: return '💬';
    }
  };

  const getEmojiForCategory = (category: string) => {
    if (category.includes('Delivery')) return '📦';
    if (category.includes('Lost')) return '🔍';
    if (category.includes('Damage')) return '📮';
    if (category.includes('Delay')) return '⏰';
    return '📬';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-300';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'Low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const filteredComplaints = complaints.filter(complaint => {
    const matchesFilter = filter === 'all' || complaint.status.toLowerCase() === filter;
    const matchesSearch = complaint.complaint_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         complaint.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'Pending').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
    highPriority: complaints.filter(c => c.priority === 'High').length,
    avgResponseTime: '2.5h',
    satisfactionRate: complaints.filter(c => c.feedback_helpful === true).length / Math.max(complaints.filter(c => c.feedback_helpful !== null).length, 1) * 100,
  };

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'complaints', label: 'Complaints', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      <aside className={`bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col shadow-2xl`}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Admin</h2>
                  <p className="text-xs text-slate-400">Control Panel</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                {sidebarOpen && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className={`${sidebarOpen ? 'mb-4' : ''}`}>
            {sidebarOpen && (
              <div className="bg-slate-700 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">Logged in as</span>
                </div>
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => signOut()}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-red-500 hover:text-white transition-all duration-300 ${!sidebarOpen && 'justify-center'}`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {activeTab === 'dashboard' && 'Dashboard Overview'}
                  {activeTab === 'complaints' && 'Complaint Management'}
                  {activeTab === 'analytics' && 'Analytics & Insights'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {activeTab === 'dashboard' && 'Monitor system performance and key metrics'}
                  {activeTab === 'complaints' && 'Manage and respond to user complaints'}
                  {activeTab === 'analytics' && 'Detailed analysis and reporting'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                  <Activity className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">System Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-blue-500 transform hover:scale-105 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Package className="w-8 h-8 text-blue-600" />
                    </div>
                    <span className="text-2xl">📊</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Total Complaints</p>
                  <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-500 mt-2">All time</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-amber-500 transform hover:scale-105 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <Clock className="w-8 h-8 text-amber-600" />
                    </div>
                    <span className="text-2xl">⏳</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Pending</p>
                  <p className="text-4xl font-bold text-gray-900">{stats.pending}</p>
                  <p className="text-xs text-gray-500 mt-2">Awaiting response</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-green-500 transform hover:scale-105 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Resolved</p>
                  <p className="text-4xl font-bold text-gray-900">{stats.resolved}</p>
                  <p className="text-xs text-gray-500 mt-2">Successfully closed</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-red-500 transform hover:scale-105 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-red-100 rounded-xl">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <span className="text-2xl">🚨</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">High Priority</p>
                  <p className="text-4xl font-bold text-gray-900">{stats.highPriority}</p>
                  <p className="text-xs text-gray-500 mt-2">Urgent attention needed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Performance Metrics</h3>
                    <Target className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Resolution Rate</span>
                        <span className="text-sm font-bold text-purple-600">
                          {Math.round((stats.resolved / Math.max(stats.total, 1)) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000 animate-pulse"
                          style={{ width: `${(stats.resolved / Math.max(stats.total, 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Customer Satisfaction</span>
                        <span className="text-sm font-bold text-green-600">
                          {Math.round(stats.satisfactionRate)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000"
                          style={{ width: `${stats.satisfactionRate}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Response Time</span>
                        <span className="text-sm font-bold text-blue-600">{stats.avgResponseTime}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-1000"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('complaints')}
                      className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-6 h-6" />
                        <div>
                          <p className="font-semibold">View All Complaints</p>
                          <p className="text-xs text-blue-100">Manage pending items</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-xl p-4 text-left transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-6 h-6" />
                        <div>
                          <p className="font-semibold">View Analytics</p>
                          <p className="text-xs text-blue-100">Detailed insights</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Complaints</h3>
                <div className="space-y-3">
                  {complaints.slice(0, 5).map((complaint) => (
                    <div
                      key={complaint.id}
                      onClick={() => setSelectedComplaint(complaint)}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:border-blue-200"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{getEmojiForCategory(complaint.category)}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{complaint.category}</p>
                          <p className="text-sm text-gray-500 line-clamp-1">{complaint.complaint_text}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(complaint.priority)}`}>
                          {complaint.priority}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'complaints' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${filter === 'all' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      All ({complaints.length})
                    </button>
                    <button
                      onClick={() => setFilter('pending')}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${filter === 'pending' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Pending ({stats.pending})
                    </button>
                    <button
                      onClick={() => setFilter('resolved')}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${filter === 'resolved' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Resolved ({stats.resolved})
                    </button>
                  </div>

                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search complaints..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredComplaints.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No complaints found</p>
                    </div>
                  ) : (
                    filteredComplaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="border-2 border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                        onClick={() => setSelectedComplaint(complaint)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-4xl">{getEmojiForCategory(complaint.category)}</span>
                              <div>
                                <h3 className="font-bold text-lg text-gray-900">{complaint.category}</h3>
                                <p className="text-sm text-gray-500">{new Date(complaint.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <p className="text-gray-700 mb-4">{complaint.complaint_text}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <span className="text-xl">{getEmojiForSentiment(complaint.sentiment)}</span>
                                {complaint.sentiment}
                              </span>
                              {complaint.ai_confidence_score && (
                                <span className="flex items-center gap-1">
                                  <Brain className="w-4 h-4" />
                                  {complaint.ai_confidence_score}% AI Confidence
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-4">
                            <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${getPriorityColor(complaint.priority)}`}>
                              {complaint.priority}
                            </span>
                            <span className={`px-4 py-2 rounded-xl text-sm font-bold ${complaint.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {complaint.status}
                            </span>
                            {complaint.status === 'Pending' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateComplaintStatus(complaint.id, 'Resolved');
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all transform hover:scale-105"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <Analytics complaints={complaints} />
            </div>
          )}
        </div>
      </main>

      {selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-500 p-6 flex items-center justify-between rounded-t-3xl text-white">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{getEmojiForCategory(selectedComplaint.category)}</span>
                <div>
                  <h2 className="text-2xl font-bold">{selectedComplaint.category}</h2>
                  <p className="text-sm text-blue-100">ID: {selectedComplaint.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border-2 border-gray-200">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Complaint Details
                </h3>
                <p className="text-gray-800 leading-relaxed">{selectedComplaint.complaint_text}</p>
                <p className="text-sm text-gray-500 mt-4">
                  Submitted: {new Date(selectedComplaint.created_at).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${selectedComplaint.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedComplaint.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Priority</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border-2 ${getPriorityColor(selectedComplaint.priority)}`}>
                    {selectedComplaint.priority}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Sentiment</p>
                  <span className="text-2xl">{getEmojiForSentiment(selectedComplaint.sentiment)}</span>
                  <p className="text-sm font-bold text-gray-900">{selectedComplaint.sentiment}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">AI Confidence</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedComplaint.ai_confidence_score}%</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-300">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    <Brain className="w-6 h-6 text-blue-600" />
                    AI-Generated Response
                  </h4>
                  <span className="px-3 py-1 bg-blue-200 text-blue-700 rounded-full text-xs font-bold">
                    AI POWERED
                  </span>
                </div>
                <p className="text-gray-800 leading-relaxed mb-4">
                  {getEmojiForSentiment(selectedComplaint.sentiment)} {selectedComplaint.ai_response}
                </p>

                {selectedComplaint.feedback_helpful !== null && (
                  <div className="pt-4 border-t border-blue-200 flex items-center gap-2">
                    <span className="text-sm text-gray-700">User Feedback:</span>
                    {selectedComplaint.feedback_helpful ? (
                      <span className="flex items-center gap-1 text-green-700 font-bold">
                        <ThumbsUp className="w-4 h-4" /> Helpful
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-700 font-bold">
                        <ThumbsDown className="w-4 h-4" /> Not Helpful
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <MessageThread complaintId={selectedComplaint.id} isAdmin={true} />
              </div>

              <div className="flex gap-3 justify-end">
                {selectedComplaint.status === 'Pending' && (
                  <button
                    onClick={() => {
                      updateComplaintStatus(selectedComplaint.id, 'Resolved');
                      setSelectedComplaint({ ...selectedComplaint, status: 'Resolved' });
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all shadow-lg"
                  >
                    Mark as Resolved
                  </button>
                )}
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
