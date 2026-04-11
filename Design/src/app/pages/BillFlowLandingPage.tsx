import React, { useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, useScroll, useTransform } from 'motion/react';
import { 
  ArrowRight, ShieldCheck, Zap, BarChart3, 
  Layers, CheckCircle2, Building2, Globe, Check,
  Activity, ArrowUpRight, Lock, Command, FileText,
  PieChart, DollarSign, Users, RefreshCw
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export default function BillFlowLandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Parallax effects
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 100]);
  const text1Y = useTransform(scrollYProgress, [0, 0.2], [0, 60]);
  const text2Y = useTransform(scrollYProgress, [0, 0.2], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const dashboardY = useTransform(scrollYProgress, [0, 0.3], [0, -120]);
  const dashboardScale = useTransform(scrollYProgress, [0, 0.2], [0.92, 1]);
  
  // Floating cards parallax
  const float1Y = useTransform(scrollYProgress, [0, 0.3], [0, -200]);
  const float2Y = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const float3Y = useTransform(scrollYProgress, [0, 0.3], [0, -250]); // Floating chart
  const float4Y = useTransform(scrollYProgress, [0, 0.3], [0, -150]); // Floating invoice
  const float5Y = useTransform(scrollYProgress, [0, 0.3], [0, -180]); // Floating table

  return (
    <div ref={containerRef} className="min-h-[200vh] bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
            <RefreshCw className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">ResourceManager</span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm font-semibold text-slate-500">
          <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          <a href="#metrics" className="hover:text-slate-900 transition-colors">Benefits</a>
          <a href="#testimonial" className="hover:text-slate-900 transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <button className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-slate-900">Login</button>
          <button 
            onClick={() => navigate('/new-dashboard')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            Start Free Trial <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-32 px-6 min-h-screen flex flex-col items-center bg-slate-50 overflow-visible border-b border-slate-200">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <motion.div 
          style={{ opacity: heroOpacity }}
          className="max-w-5xl mx-auto text-center z-10 w-full relative"
        >
          <motion.div style={{ y: text1Y }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-bold mb-8 shadow-sm">
            <span className="text-xl">🇬🇧</span> English • Trusted by 10,000+ businesses
          </motion.div>
          <motion.h1 style={{ y: text1Y }} className="text-6xl md:text-[5.5rem] font-extrabold tracking-tighter text-slate-900 mb-8 leading-[1.05]">
            Manage Your Business <br />
            <span className="text-indigo-600">Finances</span> In One Platform.
          </motion.h1>
          <motion.p style={{ y: text2Y }} className="text-xl md:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
            Streamline invoicing, track expenses, manage suppliers, and gain financial clarity. Built for growing businesses.
          </motion.p>
          <motion.div style={{ y: text2Y }} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/new-dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors flex items-center gap-2 shadow-md w-full sm:w-auto justify-center"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </button>
            <button className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-full text-lg font-semibold transition-all shadow-sm w-full sm:w-auto justify-center flex items-center gap-2">
              See How It Works
            </button>
          </motion.div>
        </motion.div>

        {/* Dashboard Mockup Parallax */}
        <motion.div 
          style={{ y: dashboardY, scale: dashboardScale }}
          className="mt-24 relative w-full max-w-6xl mx-auto z-20"
        >
          {/* Floating UI Elements */}
          
          {/* Top Left: Revenue Card */}
          <motion.div style={{ y: float1Y }} className="hidden lg:flex absolute -left-16 top-16 bg-white border border-slate-200 p-5 rounded-2xl shadow-xl z-30 flex-col gap-2 w-64">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex justify-between items-baseline">
              <div className="text-3xl font-black text-slate-900 tracking-tight">$124,500</div>
              <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">+12%</div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 w-[85%]" />
            </div>
          </motion.div>

          {/* Bottom Right: Smart Invoice Card */}
          <motion.div style={{ y: float2Y }} className="hidden lg:flex absolute -right-12 bottom-32 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl z-30 flex-col gap-4 w-72">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold">New Invoice Sent</div>
                  <div className="text-xs text-slate-400">#INV-2026</div>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-2" />
            </div>
            <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-sm font-medium">
              <span className="text-slate-300">Client: TechStart Inc.</span>
              <span className="text-emerald-400 font-bold">$4,500</span>
            </div>
          </motion.div>

          {/* Bottom Left: Expense Chart */}
          <motion.div style={{ y: float3Y }} className="hidden lg:flex absolute -left-12 bottom-12 bg-white border border-slate-200 p-4 rounded-2xl shadow-xl z-30 flex-col w-56">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Net Profit</div>
            <div className="flex items-end gap-2 mb-4">
              <div className="text-2xl font-black text-slate-900">$79,300</div>
              <div className="text-xs font-bold text-emerald-600 mb-1">+18%</div>
            </div>
            <div className="flex items-end gap-1 h-12 w-full">
              <div className="w-1/5 bg-indigo-100 rounded-t-sm h-[40%]" />
              <div className="w-1/5 bg-indigo-200 rounded-t-sm h-[60%]" />
              <div className="w-1/5 bg-indigo-300 rounded-t-sm h-[45%]" />
              <div className="w-1/5 bg-indigo-400 rounded-t-sm h-[80%]" />
              <div className="w-1/5 bg-indigo-600 rounded-t-sm h-[100%]" />
            </div>
          </motion.div>

          {/* Top Right: Supplier Alert */}
          <motion.div style={{ y: float4Y }} className="hidden lg:flex absolute -right-8 top-24 bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-lg z-30 flex-col gap-2 w-64">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-900">Pending Payments</div>
                <div className="text-xl font-extrabold text-amber-700">$12,400</div>
              </div>
            </div>
          </motion.div>

          {/* Center: Floating Table */}
          <motion.div style={{ y: float5Y }} className="hidden lg:flex absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 p-6 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)] z-40 flex-col w-[500px]">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
              <h4 className="text-base font-bold text-slate-900">Recent Transactions</h4>
              <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">View All</button>
            </div>
            <div className="space-y-3">
              {[
                { name: 'TechStart Inc.', id: '#INV-2026', amount: '$4,500.00', status: 'Paid', statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                { name: 'Global Trade Co.', id: '#INV-2025', amount: '$12,400.00', status: 'Pending', statusColor: 'text-amber-600 bg-amber-50 border-amber-100' },
                { name: 'Gulf Imports', id: '#INV-2024', amount: '$8,950.00', status: 'Paid', statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
              ].map((tx, i) => (
                <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {tx.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{tx.name}</div>
                      <div className="text-xs font-medium text-slate-500">{tx.id}</div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="text-sm font-black text-slate-900">{tx.amount}</div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tx.statusColor}`}>{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Main App Mockup Container */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] p-2 md:p-3 relative z-20">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 relative shadow-inner">
              
              {/* Mockup App Header */}
              <div className="h-14 border-b border-slate-200 bg-white flex items-center px-6 justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="h-7 w-64 bg-slate-100 rounded-md border border-slate-200 flex items-center px-3">
                  <div className="w-3 h-3 rounded-full bg-slate-300 mr-2" />
                  <div className="h-2 w-24 bg-slate-200 rounded" />
                </div>
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" />
                  <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200" />
                </div>
              </div>

              {/* Mockup App Layout */}
              <div className="flex h-[550px]">
                
                {/* Sidebar */}
                <div className="w-56 border-r border-slate-200 bg-white p-5 hidden md:flex flex-col gap-6">
                  <div className="h-6 w-32 bg-slate-200 rounded mb-2" />
                  
                  <div className="space-y-2">
                    <div className="h-8 w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md flex items-center px-3 gap-2">
                      <div className="w-4 h-4 rounded bg-indigo-200" />
                      <div className="h-2 w-16 bg-indigo-200 rounded" />
                    </div>
                    <div className="h-8 w-full hover:bg-slate-50 rounded-md flex items-center px-3 gap-2">
                      <div className="w-4 h-4 rounded bg-slate-200" />
                      <div className="h-2 w-20 bg-slate-200 rounded" />
                    </div>
                    <div className="h-8 w-full hover:bg-slate-50 rounded-md flex items-center px-3 gap-2">
                      <div className="w-4 h-4 rounded bg-slate-200" />
                      <div className="h-2 w-14 bg-slate-200 rounded" />
                    </div>
                  </div>

                  <div className="mt-8 space-y-2">
                    <div className="h-3 w-16 bg-slate-300 rounded mb-3" />
                    <div className="h-8 w-full hover:bg-slate-50 rounded-md flex items-center px-3 gap-2">
                      <div className="w-4 h-4 rounded bg-slate-200" />
                      <div className="h-2 w-24 bg-slate-200 rounded" />
                    </div>
                    <div className="h-8 w-full hover:bg-slate-50 rounded-md flex items-center px-3 gap-2">
                      <div className="w-4 h-4 rounded bg-slate-200" />
                      <div className="h-2 w-16 bg-slate-200 rounded" />
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 p-8 space-y-6 overflow-hidden">
                  
                  {/* Dashboard Header */}
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <div className="h-8 w-48 bg-slate-800 rounded mb-2" />
                      <div className="h-4 w-72 bg-slate-300 rounded" />
                    </div>
                    <div className="h-10 w-32 bg-indigo-600 rounded-lg shadow-sm" />
                  </div>

                  {/* Top Stats Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="h-3 w-16 bg-slate-200 rounded mb-3" />
                        <div className="h-6 w-24 bg-slate-800 rounded mb-2" />
                        <div className="h-2 w-12 bg-emerald-400 rounded" />
                      </div>
                    ))}
                  </div>

                  {/* Main Charts & Tables Area */}
                  <div className="grid grid-cols-3 gap-6 h-full">
                    
                    {/* Big Chart Area */}
                    <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <div className="h-5 w-32 bg-slate-800 rounded" />
                        <div className="h-6 w-20 bg-slate-100 rounded-md" />
                      </div>
                      <div className="flex-1 border-b border-l border-slate-100 flex items-end gap-3 pb-0 pl-0 relative">
                        {/* Mock Chart Bars */}
                        {[40, 60, 30, 80, 50, 90, 70].map((height, i) => (
                          <div key={i} className="flex-1 bg-indigo-100 rounded-t-sm" style={{ height: `${height}%` }}>
                            <div className="w-full bg-indigo-600 rounded-t-sm" style={{ height: `${height * 0.7}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Side List / Feed */}
                    <div className="col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="h-5 w-24 bg-slate-800 rounded mb-6" />
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="flex gap-3 items-center">
                            <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-full bg-slate-200 rounded" />
                              <div className="h-2 w-2/3 bg-slate-100 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Logos Section */}
      <section className="border-b border-slate-200 bg-white py-14">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">
            Trusted by businesses across industries
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2 font-bold text-xl"><Building2 className="w-6 h-6" /> Technology</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Globe className="w-6 h-6" /> Retail</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Layers className="w-6 h-6" /> Services</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Command className="w-6 h-6" /> Healthcare</div>
            <div className="flex items-center gap-2 font-bold text-xl"><ShieldCheck className="w-6 h-6" /> Manufacturing</div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section id="metrics" className="py-24 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">10,000+</div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Active Users</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">$2B+</div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Processed</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">60+</div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Countries</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-emerald-400 mb-2">99.9%</div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Uptime SLA</p>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="py-32 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
              Powerful Features.<br />Everything You Need.
            </h2>
            <p className="text-xl text-slate-600 font-medium">
              Comprehensive tools designed to save you time, reduce errors, and help your business grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Box 1: Smart Invoicing (2 cols) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="col-span-1 md:col-span-2 bg-white rounded-3xl p-10 border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <FileText className="w-12 h-12 text-indigo-600 mb-6" />
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Smart Invoicing</h3>
                  <p className="text-slate-600 font-medium max-w-md">
                    Create professional invoices in seconds with auto-calculated VAT, customizable templates, and one-click PDF generation.
                  </p>
                </div>
                <div className="hidden md:flex w-16 h-16 rounded-full bg-indigo-50 items-center justify-center border border-indigo-100">
                  <CheckCircle2 className="w-6 h-6 text-indigo-500" />
                </div>
              </div>
              <div className="h-48 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center p-8 relative overflow-hidden">
                <div className="w-full max-w-md space-y-3 relative z-10">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0, y: 10 }}
                    whileInView={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="bg-white p-4 rounded-xl border border-emerald-100 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] flex justify-between items-center relative overflow-hidden"
                  >
                    <motion.div 
                      initial={{ scale: 0, opacity: 0.5 }} 
                      whileInView={{ scale: 3, opacity: 0 }} 
                      transition={{ duration: 0.8, delay: 0.4 }} 
                      viewport={{ once: true }}
                      className="absolute inset-0 bg-emerald-100/60 rounded-full origin-center pointer-events-none" 
                    />
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">Invoice #2024-001</div>
                        <div className="text-xs text-emerald-600 font-medium">Sent to Client via Email</div>
                      </div>
                    </div>
                    <motion.div 
                      initial={{ scale: 0, rotate: -20 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", bounce: 0.6, delay: 0.6 }}
                      viewport={{ once: true }}
                      className="text-emerald-700 font-bold text-sm bg-emerald-100 px-3 py-1 rounded-md relative z-10 flex items-center gap-1"
                    >
                      Paid
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Box 2: Analytics (1 col) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="col-span-1 bg-indigo-600 rounded-3xl p-10 text-white relative overflow-hidden group shadow-md"
            >
              <BarChart3 className="w-12 h-12 text-indigo-200 mb-6 relative z-10" />
              <h3 className="text-2xl font-bold mb-3 relative z-10">Real-time Analytics</h3>
              <p className="text-indigo-100 font-medium relative z-10 leading-relaxed mb-6">
                Monitor revenue, expenses, and payment trends with interactive charts.
              </p>
              <div className="relative z-10 flex items-end gap-2 h-20 w-full mt-auto">
                <motion.div initial={{ height: 0 }} whileInView={{ height: "40%" }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }} className="w-1/4 bg-indigo-400/50 rounded-t-md" />
                <motion.div initial={{ height: 0 }} whileInView={{ height: "70%" }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }} className="w-1/4 bg-indigo-400/70 rounded-t-md" />
                <motion.div initial={{ height: 0 }} whileInView={{ height: "55%" }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }} className="w-1/4 bg-indigo-400/90 rounded-t-md" />
                <motion.div initial={{ height: 0 }} whileInView={{ height: "95%" }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 }} className="w-1/4 bg-white rounded-t-md" />
              </div>
            </motion.div>

            {/* Box 3: Multi-currency (1 col) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="col-span-1 bg-slate-900 rounded-3xl p-10 text-white shadow-md group relative overflow-hidden"
            >
              {/* Floating Currency Chips */}
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute top-6 right-8 w-12 h-12 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-emerald-400 text-xl font-bold shadow-lg z-0">$</motion.div>
              <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute bottom-12 right-20 w-14 h-14 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-blue-400 text-2xl font-bold shadow-lg z-0">€</motion.div>
              <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute top-24 right-28 w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-indigo-400 text-lg font-bold shadow-lg z-0">£</motion.div>
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }} className="absolute bottom-24 right-6 w-9 h-9 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-amber-400 text-base font-bold shadow-lg z-0">¥</motion.div>

              <Globe className="w-12 h-12 text-emerald-400 mb-6 relative z-10" />
              <h3 className="text-2xl font-bold mb-3 relative z-10">60+ Currencies</h3>
              <p className="text-slate-400 font-medium leading-relaxed relative z-10">
                Work globally including USD, EUR, GBP, SAR, AED. Enjoy automatic currency conversion and real-time exchange rates.
              </p>
            </motion.div>

            {/* Box 4: Purchase Management (2 cols) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="col-span-1 md:col-span-2 bg-white rounded-3xl p-10 border border-slate-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8">
                <div>
                  <Command className="w-12 h-12 text-indigo-600 mb-6" />
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Complete Purchase Control</h3>
                  <p className="text-slate-600 font-medium max-w-md">
                    Track supplier invoices, manage purchase orders, and maintain a complete record. Never miss a payment deadline again.
                  </p>
                </div>
              </div>
              <div className="h-24 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white border border-indigo-200 rounded-xl flex items-center justify-center shadow-sm text-indigo-600 font-bold">
                    <Activity size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-indigo-900">Supplier DB Active</div>
                    <div className="text-xs font-medium text-indigo-700">142 Relationships Managed</div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section id="testimonial" className="py-32 px-6 bg-white border-y border-slate-200 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="mb-10 text-indigo-600 flex justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.017 18L14.017 10.609C14.017 4.905 17.748 1.039 23 0L23.995 2.151C21.563 3.068 20 5.789 20 8H24V18H14.017ZM0 18V10.609C0 4.905 3.748 1.038 9 0L9.996 2.151C7.563 3.068 6 5.789 6 8H9.983L9.983 18L0 18Z" />
            </svg>
          </div>
          <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-12">
            "ResourceManager transformed how we handle our finances. We've saved countless hours and our cash flow has never been better."
          </h3>
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-200 rounded-full mb-4 overflow-hidden flex items-center justify-center text-slate-500 font-bold text-xl">
              H
            </div>
            <div className="font-bold text-slate-900 text-lg">Heni Hasnaoui</div>
            <div className="text-slate-500 font-medium">IT services in Action</div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-slate-900 mb-8">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-slate-600 mb-12 font-medium max-w-2xl mx-auto">
            Join thousands of businesses that have already upgraded their financial management. Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/new-dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-full text-xl font-bold transition-colors flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              Start Free Trial <ArrowRight className="w-6 h-6" />
            </button>
            <button className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-10 py-5 rounded-full text-xl font-bold transition-colors shadow-sm">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-20 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center">
                <RefreshCw className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">ResourceManager</span>
            </div>
            <p className="text-sm font-medium leading-relaxed max-w-xs mb-8">
              Complete business management solution for growing companies. Save time, reduce errors, and grow your business.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide uppercase text-sm">Product</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide uppercase text-sm">Company</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide uppercase text-sm">Support</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 text-sm font-medium">
          <div>&copy; {new Date().getFullYear()} Heni Hasnaoui - IT services. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
