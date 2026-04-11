import { useTranslation } from 'react-i18next';
import { ShieldOff, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AccountLockedPageProps {
    reason: 'suspended' | 'expired';
    expiryDate?: string;
}

export default function AccountLockedPage({ reason, expiryDate }: AccountLockedPageProps) {
    const { t } = useTranslation();
    const { logout } = useAuth();

    const isSuspended = reason === 'suspended';

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
                <div className={`size-20 rounded-full ${isSuspended ? 'bg-red-100' : 'bg-amber-100'} flex items-center justify-center mx-auto mb-6`}>
                    {isSuspended ? (
                        <ShieldOff className="text-red-600" size={40} />
                    ) : (
                        <Clock className="text-amber-600" size={40} />
                    )}
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    {isSuspended ? t('accountLocked.suspendedTitle') : t('accountLocked.expiredTitle')}
                </h1>

                <div className={`p-4 rounded-xl mb-6 ${isSuspended ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-start gap-3">
                        <AlertTriangle className={`flex-shrink-0 mt-0.5 ${isSuspended ? 'text-red-500' : 'text-amber-500'}`} size={18} />
                        <p className={`text-sm text-left ${isSuspended ? 'text-red-700' : 'text-amber-700'}`}>
                            {isSuspended ? t('accountLocked.suspendedMessage') : t('accountLocked.expiredMessage')}
                        </p>
                    </div>
                </div>

                {!isSuspended && expiryDate && (
                    <p className="text-sm text-gray-500 mb-4">
                        {t('accountLocked.expiredOn')}: <span className="font-medium">{new Date(expiryDate).toLocaleDateString()}</span>
                    </p>
                )}

                <p className="text-sm text-gray-500 mb-8">
                    {t('accountLocked.contactAdmin')}
                </p>

                <button
                    onClick={logout}
                    className="px-6 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 shadow-md transition-all"
                >
                    {t('accountLocked.logout')}
                </button>
            </div>
        </div>
    );
}
