import { Info, HelpCircle } from "lucide-react";
import clsx from "clsx";

interface CustomModalProps {
    isOpen: boolean;
    type: 'alert' | 'confirm';
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export function CustomModal({ isOpen, type, message, onConfirm, onCancel }: CustomModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#15171e] w-full max-w-sm rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1e212b]">
                    <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-gray-300">
                        {type === 'alert' ? (
                            <>
                                <Info className="w-4 h-4 text-blue-400" />
                                <span>Notice</span>
                            </>
                        ) : (
                            <>
                                <HelpCircle className="w-4 h-4 text-yellow-500" />
                                <span>Confirm</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed mb-6">
                        {message}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        {type === 'confirm' && (
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={onConfirm}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-lg",
                                type === 'alert'
                                    ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20"
                                    : "bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20"
                            )}
                        >
                            {type === 'alert' ? 'OK' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
