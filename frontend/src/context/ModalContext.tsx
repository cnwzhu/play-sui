import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CustomModal } from '../components/CustomModal';

interface ModalContextType {
    alert: (message: string) => Promise<void>;
    confirm: (message: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm';
        message: string;
        resolve?: (value: any) => void;
    }>({
        isOpen: false,
        type: 'alert',
        message: '',
    });

    const alert = useCallback((message: string) => {
        return new Promise<void>((resolve) => {
            setModalState({
                isOpen: true,
                type: 'alert',
                message,
                resolve: () => {
                    setModalState(prev => ({ ...prev, isOpen: false }));
                    resolve();
                }
            });
        });
    }, []);

    const confirm = useCallback((message: string) => {
        return new Promise<boolean>((resolve) => {
            setModalState({
                isOpen: true,
                type: 'confirm',
                message,
                resolve: (confirmed: boolean) => {
                    setModalState(prev => ({ ...prev, isOpen: false }));
                    resolve(confirmed);
                }
            });
        });
    }, []);

    const handleConfirm = () => {
        if (modalState.resolve) {
            modalState.resolve(true); // For alert this is just ignored/void, for confirm it's true
        }
    };

    const handleCancel = () => {
        if (modalState.type === 'confirm' && modalState.resolve) {
            modalState.resolve(false);
        } else if (modalState.type === 'alert' && modalState.resolve) {
            modalState.resolve(null); // Just close
        }
    };

    return (
        <ModalContext.Provider value={{ alert, confirm }}>
            {children}
            <CustomModal
                isOpen={modalState.isOpen}
                type={modalState.type}
                message={modalState.message}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}
