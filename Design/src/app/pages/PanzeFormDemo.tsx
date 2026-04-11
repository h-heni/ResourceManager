import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, LayoutDashboard, FileText, Bell, Settings, Search, ChevronRight, Sparkles } from 'lucide-react';
import '../styles/panze-dashboard.css';
import '../styles/panze-forms.css';

const services = ['Branding', 'Mobile App', 'Website', 'Web App'];
const budgets = ['Less than $1k', '$1k - $5k', '$5k - $10k', 'more than $10k'];

export default function PanzeFormDemo() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    projectDetails: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(
      `Submitted!\n\nName: ${formData.fullName}\nEmail: ${formData.email}\nService: ${selectedService}\nBudget: ${selectedBudget}\nDetails: ${formData.projectDetails}`
    );
  };

  return (
    <div className="panze-shell">
      <div className="panze-container">
        {/* ── Sidebar ── */}
        <nav className="panze-sidebar">
          <div className="panze-sidebar-top">
            <div className="panze-logo">
              <div className="panze-logo-icon">
                <Sparkles size={16} />
              </div>
              <span>laxi.ai</span>
            </div>
          </div>

          <div className="panze-nav">
            <div className="panze-nav-section">MONITOR</div>
            <button className="panze-nav-item" onClick={() => navigate('/new-dashboard')}>
              <span className="panze-nav-icon"><LayoutDashboard size={18} /></span>
              <span className="panze-nav-label">Analytics</span>
            </button>
            <button className="panze-nav-item active">
              <span className="panze-nav-icon"><FileText size={18} /></span>
              <span className="panze-nav-label">Form Components</span>
              <span className="panze-nav-badge">New</span>
            </button>
          </div>

          <div className="panze-sidebar-user">
            <div className="panze-sidebar-avatar">C</div>
            <div className="panze-sidebar-user-info">
              <div className="panze-sidebar-user-name">Chris@shop.com</div>
            </div>
          </div>
        </nav>

        {/* ── Right Pane ── */}
        <div className="panze-right">
          <div className="panze-header">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
              <div className="panze-header-left">
                <h1 className="panze-page-title">Project Inquiry</h1>
                <p className="panze-header-subtitle">Submit your project details</p>
              </div>
              <div className="panze-header-right">
                <button className="panze-header-action" title="Notifications">
                  <Bell size={18} />
                </button>
                <button className="panze-back-btn-inline" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft size={15} />
                  Back to RM
                </button>
              </div>
            </div>
          </div>

          <main className="panze-main">
            <div className="panze-form-card" style={{ maxWidth: 720 }}>
              <h2 className="panze-form-heading">Start a Project</h2>
              <p className="panze-form-subtext">Fill in the details below and we'll get back to you shortly.</p>

              <form onSubmit={handleSubmit} className="panze-form">
                <div className="panze-form-row">
                  <div className="panze-form-group">
                    <label className="panze-form-label">Full Name</label>
                    <input
                      type="text"
                      className="panze-form-input"
                      placeholder="Type your name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div className="panze-form-group">
                    <label className="panze-form-label">Email</label>
                    <input
                      type="email"
                      className="panze-form-input"
                      placeholder="Type contact email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="panze-form-group">
                  <label className="panze-form-label">Select Service</label>
                  <div className="panze-form-pills">
                    {services.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`panze-form-pill ${selectedService === s ? 'active' : ''}`}
                        onClick={() => setSelectedService(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panze-form-group">
                  <label className="panze-form-label">Estimated Budget</label>
                  <div className="panze-form-pills">
                    {budgets.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={`panze-form-pill ${selectedBudget === b ? 'active' : ''}`}
                        onClick={() => setSelectedBudget(b)}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panze-form-group">
                  <label className="panze-form-label">Project Details</label>
                  <textarea
                    className="panze-form-textarea"
                    placeholder="Write your dream plan's brief here"
                    rows={6}
                    value={formData.projectDetails}
                    onChange={(e) => setFormData({ ...formData, projectDetails: e.target.value })}
                  />
                </div>

                <button type="submit" className="panze-form-submit">
                  Submit Inquiry
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
