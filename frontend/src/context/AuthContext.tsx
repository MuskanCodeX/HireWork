import { createContext, useState, useEffect, useMemo, useContext, type ReactNode } from 'react';
import { API_BASE } from '../config';

interface User {
    _id: string;
    name: string;
    email: string;
    role: 'freelancer' | 'employer' | 'admin';
    token: string;
    bio?: string;
    skills?: string[];
    hourlyRate?: number;
    badge?: string;
    badgeSubscriptionEnd?: string;
}

interface AuthContextType {
    user: User | null;
    login: (userData: User) => void;
    logout: () => void;
    isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // If arriving via OAuth code exchange, avoid token validation race.
        if (window.location.search.includes('auth_code=')) {
            setIsLoading(false);
            return;
        }

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            let parsed;
            try {
                parsed = JSON.parse(storedUser);
            } catch {
                localStorage.removeItem('user');
                setIsLoading(false);
                return;
            }
            setUser(parsed);

            fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${parsed.token}` },
            })
                .then(async (res) => {
                    if (!res.ok) {
                        // Only hard-logout on explicit auth failure.
                        if (res.status === 401 || res.status === 403) {
                            setUser(null);
                            localStorage.removeItem('user');
                        }
                        return;
                    }

                    const data = await res.json();
                    const updatedUser = { ...parsed, ...data, token: parsed.token };
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                })
                .catch(() => {
                    // Network/server transient issue: keep existing local session.
                })
                .finally(() => setIsLoading(false));

            // Absolute safety timeout: never let loading hang for > 5s
            const timer = setTimeout(() => setIsLoading(false), 5000);
            return () => clearTimeout(timer);
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = (userData: User) => {
        // Preserve token if update payload does not include token.
        const existing = (() => {
            try {
                const raw = localStorage.getItem('user');
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        })();

        const finalUser = {
            ...(existing || {}),
            ...(userData || {}),
            token: (userData as any)?.token || existing?.token || '',
        } as User;

        setUser(finalUser);
        localStorage.setItem('user', JSON.stringify(finalUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    const value = useMemo(() => ({ user, login, logout, isLoading }), [user, isLoading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
