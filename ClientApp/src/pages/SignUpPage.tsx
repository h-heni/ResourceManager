import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Building, MapPin, Hash, Phone, ArrowRight, Loader } from 'lucide-react';
import api from '../services/api';
import { cn } from '../lib/utils';

export default function SignUpPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Company, 2: User
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        // Company Stats
        companyName: '',
        address: '',
        matriculeFiscal: '',
        phone: '',
        // User Stats
        userEmail: '',
        userPassword: '',
        userFirstName: '',
        userLastName: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/Auth/signup', formData);
            alert("Account created successfully! Please log in.");
            navigate('/login');
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || err.response?.data || "Registration failed";
            setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
            setLoading(false);
        }
    };

    const nextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 1) {
            if (!formData.companyName || !formData.address || !formData.matriculeFiscal) {
                setError("Please fill in all company details.");
                return;
            }
            setError('');
            setStep(2);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="w-full max-w-lg bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <Link to="/login" className="text-sm text-indigo-600 hover:underline mb-4 inline-block">&larr; Back to Login</Link>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                            Create Account
                        </h1>
                        <p className="text-gray-500 mt-2">Create your business account today.</p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center mb-8 space-x-4">
                        <div className={cn("w-3 h-3 rounded-full transition-colors", step >= 1 ? "bg-indigo-600" : "bg-gray-300")} />
                        <div className={cn("w-16 h-1 rounded-full transition-colors", step >= 2 ? "bg-indigo-600" : "bg-gray-200")} />
                        <div className={cn("w-3 h-3 rounded-full transition-colors", step >= 2 ? "bg-indigo-600" : "bg-gray-300")} />
                    </div>

                    <form onSubmit={step === 1 ? nextStep : handleSubmit} className="space-y-6">

                        {step === 1 && (
                            <div className="space-y-4 animate-slide-up">
                                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Company Information</h3>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Company Name</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleChange}
                                            required
                                            className="fancy-input w-full pl-10"
                                            placeholder="Acme Corp"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            required
                                            className="fancy-input w-full pl-10"
                                            placeholder="123 Business St"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Matricule Fiscal</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                name="matriculeFiscal"
                                                value={formData.matriculeFiscal}
                                                onChange={handleChange}
                                                required
                                                className="fancy-input w-full pl-10"
                                                placeholder="MF123456"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Phone</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                className="fancy-input w-full pl-10"
                                                placeholder="+216 ..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-slide-up">
                                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Manager Details</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">First Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                name="userFirstName"
                                                value={formData.userFirstName}
                                                onChange={handleChange}
                                                required
                                                className="fancy-input w-full pl-10"
                                                placeholder="John"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Last Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                name="userLastName"
                                                value={formData.userLastName}
                                                onChange={handleChange}
                                                required
                                                className="fancy-input w-full pl-10"
                                                placeholder="Doe"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            type="email"
                                            name="userEmail"
                                            value={formData.userEmail}
                                            onChange={handleChange}
                                            required
                                            className="fancy-input w-full pl-10"
                                            placeholder="john@acme.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            type="password"
                                            name="userPassword"
                                            value={formData.userPassword}
                                            onChange={handleChange}
                                            required
                                            className="fancy-input w-full pl-10"
                                            placeholder="••••••••"
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center animate-slide-up">
                                {error}
                            </div>
                        )}

                        <div className="flex space-x-3 pt-4">
                            {step === 2 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="px-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Back
                                </button>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    "flex-1 py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                    "bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700",
                                    loading && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    {loading ? (
                                        <>
                                            <Loader className="animate-spin h-5 w-5" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{step === 1 ? 'Next Step' : 'Create Account'}</span>
                                            <ArrowRight className="h-5 w-5" />
                                        </>
                                    )}
                                </div>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
