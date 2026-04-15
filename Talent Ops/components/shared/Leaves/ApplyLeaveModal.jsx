import React, { useState, useEffect } from 'react';
import { X, Briefcase, Calendar, CheckCircle, Target, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { useLeaves } from '../hooks/useLeaves';

const APPLIER_RESPONSIBILITIES = [
    "Complete high-priority current tasks",
    "Handover pending tasks to a teammate",
    "Update status/progress on all active tasks",
    "Ensure relevant documentation is accessible"
];

const ApplyLeaveModal = ({ onClose, onSuccess }) => {
    const { addToast } = useToast();
    const { userId, orgId } = useUser();

    // Use the robust centralized hook
    const { leaveStats, remainingLeaves, refetch: refetchLeaves } = useLeaves(orgId, userId, 'personal');

    const [leaveFormData, setLeaveFormData] = useState({
        leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave',
        startDate: '',
        endDate: '',
        reason: ''
    });
    
    // Multiple discrete dates approach
    const [selectedDates, setSelectedDates] = useState([]);
    const [dateToAdd, setDateToAdd] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const addSelectedDate = (date) => {
        if (!date) return;
        setSelectedDates(prev => {
            const set = new Set(prev);
            if (set.has(date)) return prev;
            set.add(date);
            return Array.from(set).sort();
        });
    };

    const removeSelectedDate = (date) => {
        setSelectedDates(prev => prev.filter(d => d !== date));
    };

    // Calculate LOP vs Paid breakdown
    const calculateBreakdown = () => {
        const useSpecificDates = selectedDates.length > 0;
        let totalDays = 0;
        
        if (useSpecificDates) {
            totalDays = selectedDates.length;
        } else if (leaveFormData.startDate && leaveFormData.endDate) {
            // Simple weekday calculation (re-implementing here for local sync)
            const start = new Date(leaveFormData.startDate);
            const end = new Date(leaveFormData.endDate);
            let count = 0;
            const cur = new Date(start);
            while (cur <= end) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) count++;
                cur.setDate(cur.getDate() + 1);
            }
            totalDays = count;
        }

        const paid = Math.min(totalDays, remainingLeaves);
        const lop = Math.max(0, totalDays - paid);
        
        return { total: totalDays, paid, lop };
    };

    // Remove manual fetchStats logic as it's now handled by the useLeaves hook ABOVE

    const breakdown = calculateBreakdown();

    const handleApplyLeave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // ... (rest of submission still uses breakdown)
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', padding: '40px', borderRadius: '32px', width: '1000px', maxWidth: '95%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 10 }}
                >
                    <X size={20} />
                </button>

                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Request Leave</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>Submit your leave details for approval</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '48px' }}>
                    <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leave Type</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={leaveFormData.leaveType}
                                    onChange={(e) => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
                                    style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', transition: 'all 0.2s', outline: 'none', appearance: 'none' }}
                                    required
                                    disabled={remainingLeaves <= 0}
                                >
                                    <option value="Casual Leave">Casual Leave</option>
                                    <option value="Sick Leave">Sick Leave</option>
                                    <option value="Vacation">Vacation</option>
                                    <option value="Personal Leave">Personal Leave</option>
                                    <option value="Loss of Pay">Loss of Pay</option>
                                </select>
                                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
                                    <Briefcase size={18} />
                                </div>
                            </div>
                            {remainingLeaves <= 0 && (
                                <p style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '8px', fontWeight: 600 }}>0 paid leaves remaining. Only Loss of Pay is available.</p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discrete Dates (Optional)</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input
                                    type="date"
                                    value={dateToAdd}
                                    onChange={(e) => setDateToAdd(e.target.value)}
                                    style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                                    disabled={leaveFormData.startDate !== '' && leaveFormData.endDate !== ''}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (dateToAdd) {
                                            addSelectedDate(dateToAdd);
                                            setDateToAdd('');
                                        }
                                    }}
                                    disabled={!dateToAdd || (leaveFormData.startDate !== '' && leaveFormData.endDate !== '')}
                                    style={{ padding: '0 20px', borderRadius: '12px', backgroundColor: 'var(--surface-active)', color: 'var(--primary)', border: '1px solid var(--border)', fontWeight: 700, cursor: (dateToAdd && (leaveFormData.startDate === '' && leaveFormData.endDate === '')) ? 'pointer' : 'not-allowed', opacity: (dateToAdd && (leaveFormData.startDate === '' && leaveFormData.endDate === '')) ? 1 : 0.5 }}
                                >
                                    Add Date
                                </button>
                            </div>
                            {selectedDates.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    {selectedDates.map(d => (
                                        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#e2e8f0', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                            <span>{new Date(d).toLocaleDateString()}</span>
                                            <X size={14} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => removeSelectedDate(d)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedDates.length === 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveFormData.startDate}
                                        onChange={(e) => {
                                            const nextStart = e.target.value;
                                            setLeaveFormData(prev => ({
                                                ...prev,
                                                startDate: nextStart,
                                                endDate: prev.endDate && prev.endDate >= nextStart ? prev.endDate : nextStart
                                            }));
                                        }}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                                        required={selectedDates.length === 0}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
                                    <input
                                        type="date"
                                        value={leaveFormData.endDate}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                                        min={leaveFormData.startDate}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                                        required={selectedDates.length === 0}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Reason</label>
                            <textarea
                                value={leaveFormData.reason}
                                onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                                rows="3"
                                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', transition: 'all 0.2s', outline: 'none', resize: 'vertical' }}
                                placeholder="Please provide specific details..."
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{ padding: '14px 28px', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                style={{ padding: '14px 32px', borderRadius: '12px', fontWeight: '800', fontSize: '1.05rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>

                    <div style={{ padding: '32px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#0284c7" /> Leave Summary
                            </h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>Monthly Allowance</span>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{leaveStats.monthlyQuota}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>Used ({new Date().toLocaleDateString('en-US', { month: 'long' })})</span>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{leaveStats.monthlyUsed}</span>
                                </div>
                                <div style={{ height: '2px', backgroundColor: '#e2e8f0', margin: '8px 0', borderStyle: 'dashed' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(2, 132, 199, 0.05)', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0284c7' }}>Annual Usage ({new Date().getFullYear()})</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{leaveStats.yearlyUsed} / 12</span>
                                </div>
                            </div>
                        </div>

                        {breakdown.total > 0 && (
                            <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Current Request
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: '#64748b' }}>Duration</span>
                                        <span style={{ fontWeight: 700 }}>{breakdown.total} Days</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: '#64748b' }}>Paid Attribution</span>
                                        <span style={{ fontWeight: 700, color: '#10b981' }}>{breakdown.paid} Days</span>
                                    </div>
                                    {breakdown.lop > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                            <span style={{ color: '#64748b' }}>Loss of Pay</span>
                                            <span style={{ fontWeight: 700, color: '#ef4444' }}>{breakdown.lop} Days</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeaveModal;
