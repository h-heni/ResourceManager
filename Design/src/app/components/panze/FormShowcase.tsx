import { useState } from 'react';
import {
  Upload, Search, Eye, EyeOff, Calendar, ChevronDown,
} from 'lucide-react';
import '../../styles/panze-forms.css';

/* ====================================================================
   FORM SHOWCASE — All form component types in one view
   Organized into titled cards, each demonstrating a different type.
   ==================================================================== */

const services = ['Branding', 'Mobile App', 'Website', 'Web App'];
const budgets = ['Less than $1k', '$1k - $5k', '$5k - $10k', 'more than $10k'];

export default function FormShowcase() {
  /* --- State for interactive previews --- */
  const [showPassword, setShowPassword] = useState(false);
  const [selectedService, setSelectedService] = useState('Website');
  const [selectedBudget, setSelectedBudget] = useState('$1k - $5k');
  const [toggle1, setToggle1] = useState(true);
  const [toggle2, setToggle2] = useState(false);
  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(true);
  const [radio, setRadio] = useState('option1');
  const [range, setRange] = useState(65);
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="panze-form-showcase">

      {/* ============================================================ */}
      {/*  SECTION HEADER                                               */}
      {/* ============================================================ */}
      <div className="panze-form-section-header">
        <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 0 }}>
          Every input type in your design system — clean borders, purple focus ring.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  1 — TEXT INPUTS                                              */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Text Inputs</h3>

        <div className="panze-form">
          <div className="panze-form-row">
            <div className="panze-form-group">
              <label className="panze-form-label">Full Name</label>
              <input className="panze-form-input" placeholder="Type your name" defaultValue="Marcus Chen" />
            </div>
            <div className="panze-form-group">
              <label className="panze-form-label">Email Address</label>
              <input className="panze-form-input" type="email" placeholder="name@example.com" />
            </div>
          </div>

          <div className="panze-form-row">
            <div className="panze-form-group">
              <label className="panze-form-label">Password</label>
              <div className="panze-input-icon-wrap">
                <input
                  className="panze-form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  defaultValue="mypassword123"
                />
                <button
                  type="button"
                  className="panze-input-icon-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="panze-form-group">
              <label className="panze-form-label">Phone Number</label>
              <input className="panze-form-input" type="tel" placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div className="panze-form-row">
            <div className="panze-form-group">
              <label className="panze-form-label">Search</label>
              <div className="panze-input-icon-wrap panze-input-icon-left">
                <Search size={18} className="panze-input-icon-static" />
                <input className="panze-form-input panze-form-input--icon-left" placeholder="Search anything..." />
              </div>
            </div>
            <div className="panze-form-group">
              <label className="panze-form-label">Website URL</label>
              <input className="panze-form-input" type="url" placeholder="https://example.com" />
            </div>
          </div>

          {/* Disabled state */}
          <div className="panze-form-group" style={{ maxWidth: '48%' }}>
            <label className="panze-form-label">Disabled Input</label>
            <input className="panze-form-input panze-form-input--disabled" placeholder="Cannot edit" disabled />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  2 — SELECT / DROPDOWN                                        */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Select / Dropdown</h3>

        <div className="panze-form">
          <div className="panze-form-row">
            <div className="panze-form-group">
              <label className="panze-form-label">Country</label>
              <div className="panze-select-wrap">
                <select className="panze-form-select">
                  <option value="">Select a country</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Germany</option>
                  <option>France</option>
                  <option>Japan</option>
                </select>
                <ChevronDown size={18} className="panze-select-icon" />
              </div>
            </div>
            <div className="panze-form-group">
              <label className="panze-form-label">Role</label>
              <div className="panze-select-wrap">
                <select className="panze-form-select" defaultValue="Designer">
                  <option>Admin</option>
                  <option>Designer</option>
                  <option>Developer</option>
                  <option>Manager</option>
                </select>
                <ChevronDown size={18} className="panze-select-icon" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  3 — TEXTAREA                                                 */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Textarea</h3>

        <div className="panze-form">
          <div className="panze-form-group">
            <label className="panze-form-label">Project Details</label>
            <textarea
              className="panze-form-textarea"
              placeholder="Write your dream plan's brief here"
              rows={5}
              defaultValue=""
            />
          </div>
          <div className="panze-form-group">
            <label className="panze-form-label">Notes (with content)</label>
            <textarea
              className="panze-form-textarea"
              rows={4}
              defaultValue={"We need a modern SaaS dashboard with analytics, user management, and subscription billing. The design should be clean and minimal with a blue accent color system."}
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  4 — PILL SELECTORS                                           */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Pill Selectors</h3>

        <div className="panze-form">
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
        </div>
      </div>

      {/* ============================================================ */}
      {/*  5 — CHECKBOXES                                               */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Checkboxes</h3>

        <div className="panze-form" style={{ gap: 16 }}>
          {[
            { id: 'c1', label: 'Email notifications', checked: check1, set: setCheck1 },
            { id: 'c2', label: 'SMS alerts', checked: check2, set: setCheck2 },
            { id: 'c3', label: 'Push notifications', checked: check3, set: setCheck3 },
          ].map((c) => (
            <label key={c.id} className="panze-form-checkbox-label">
              <div className={`panze-form-checkbox ${c.checked ? 'checked' : ''}`} onClick={() => c.set(!c.checked)}>
                {c.checked && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  6 — RADIO BUTTONS                                            */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Radio Buttons</h3>

        <div className="panze-form" style={{ gap: 16 }}>
          {[
            { value: 'option1', label: 'Monthly billing' },
            { value: 'option2', label: 'Yearly billing (save 20%)' },
            { value: 'option3', label: 'Lifetime access' },
          ].map((r) => (
            <label key={r.value} className="panze-form-checkbox-label">
              <div
                className={`panze-form-radio ${radio === r.value ? 'checked' : ''}`}
                onClick={() => setRadio(r.value)}
              >
                {radio === r.value && <div className="panze-form-radio-dot" />}
              </div>
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  7 — TOGGLE SWITCHES                                          */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Toggle Switches</h3>

        <div className="panze-form" style={{ gap: 20 }}>
          <div className="panze-form-toggle-row">
            <span className="panze-form-label" style={{ fontWeight: 500 }}>Dark Mode</span>
            <button
              type="button"
              className={`panze-form-toggle ${toggle1 ? 'active' : ''}`}
              onClick={() => setToggle1(!toggle1)}
            >
              <div className="panze-form-toggle-knob" />
            </button>
          </div>
          <div className="panze-form-toggle-row">
            <span className="panze-form-label" style={{ fontWeight: 500 }}>Auto-save drafts</span>
            <button
              type="button"
              className={`panze-form-toggle ${toggle2 ? 'active' : ''}`}
              onClick={() => setToggle2(!toggle2)}
            >
              <div className="panze-form-toggle-knob" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  8 — DATE & NUMBER INPUTS                                     */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Date &amp; Number</h3>

        <div className="panze-form">
          <div className="panze-form-row">
            <div className="panze-form-group">
              <label className="panze-form-label">Date</label>
              <div className="panze-input-icon-wrap">
                <input className="panze-form-input" type="date" defaultValue="2026-03-13" />
              </div>
            </div>
            <div className="panze-form-group">
              <label className="panze-form-label">Quantity</label>
              <input className="panze-form-input" type="number" placeholder="0" defaultValue={12} />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  9 — RANGE SLIDER                                             */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Range Slider</h3>

        <div className="panze-form">
          <div className="panze-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="panze-form-label">Volume</label>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#4F46E5' }}>{range}%</span>
            </div>
            <input
              className="panze-form-range"
              type="range"
              min={0}
              max={100}
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #4F46E5 ${range}%, #E2E8F0 ${range}%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  10 — FILE UPLOAD                                              */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">File Upload</h3>

        <div className="panze-form">
          <div
            className={`panze-form-dropzone ${dragActive ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
          >
            <Upload size={32} color="#4F46E5" />
            <p className="panze-form-dropzone-text">
              Drag &amp; drop files here, or <span className="panze-form-dropzone-link">browse</span>
            </p>
            <p className="panze-form-dropzone-hint">PNG, JPG, PDF up to 10MB</p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  11 — BUTTONS                                                  */}
      {/* ============================================================ */}
      <div className="panze-form-card panze-form-card--full">
        <h3 className="panze-form-card-title">Buttons</h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <button className="panze-form-submit">Primary</button>
          <button className="panze-form-btn-secondary">Secondary</button>
          <button className="panze-form-btn-outline">Outline</button>
          <button className="panze-form-btn-ghost">Ghost</button>
          <button className="panze-form-btn-danger">Danger</button>
          <button className="panze-form-submit" disabled style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            Disabled
          </button>
        </div>
      </div>

    </div>
  );
}