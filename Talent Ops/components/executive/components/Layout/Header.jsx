import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, MessageSquare, User, FileText, ClipboardList, Receipt, File, Moon, Sun } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../../shared/context/ThemeContext';

const Header = () => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    
    const notificationRef = useRef(null);
    const searchRef = useRef(null);
    
    const { userId } = useUser();
    const { addToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    const fetchUnreadCount = async () => {
        if (userId) {
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', userId)
                .eq('is_read', false)
                .not('type', 'in', '("message","mention")');

            setUnreadCount(count || 0);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowResults(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userId]);

    return (
        <header style={{
            height: '80px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            transition: 'all 0.3s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
                <div style={{ position: 'relative', width: '300px' }} ref={searchRef}>
                    <Search 
                        size={18} 
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
                    />
                    <input
                        type="text"
                        placeholder="Search anything..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setShowResults(true)}
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 40px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button
                    onClick={toggleTheme}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        borderRadius: '10px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div style={{ position: 'relative' }} ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            position: 'relative',
                            padding: '8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                backgroundColor: 'var(--danger)',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 5px',
                                borderRadius: '10px',
                                border: '2px solid var(--surface)',
                                fontWeight: 'bold'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '6px 12px', borderRadius: '12px', backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <User size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>Executive</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Admin</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
