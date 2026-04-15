import React from 'react';
import DataTable from '../../manager/components/UI/DataTable';
import { Eye, Edit, Trash2 } from 'lucide-react';

const LeavesFeature = ({ leaves, type, title, onAction, userId, projectRole, leaveStats, remainingLeaves }) => {
    let columns = [];
    let dataToDisplay = leaves;

    // Helper for current month name
    const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();

    if (type === 'leaves' || type === 'my-leaves') {
        // ... (rest of column logic remains)
        // Manager / Exec Approval view OR Employee personal view if employee's ModulePage uses 'leaves' for personal
        // To distinguish, if it's manager view, they can approve/reject.
        // We handle this via projectRole or just let onAction handle the row data.
        columns = [
            { header: 'Employee', accessor: 'name' },
            { header: 'Type', accessor: 'type' },
            { header: 'Duration', accessor: 'duration' },
            { header: 'Dates', accessor: 'dates' },
            {
                header: 'Status', accessor: 'status', render: (row) => (
                    <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: row.status === 'Approved' ? '#dcfce7' : row.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                        color: row.status === 'Approved' ? '#166534' : row.status === 'Pending' ? '#b45309' : '#991b1b'
                    }}>
                        {row.status}
                    </span>
                )
            },
            {
                header: 'Actions', accessor: 'actions', render: (row) => {
                    // Manager / Admin approving others
                    if (row.status === 'Pending' && row.employee_id !== userId && (projectRole === 'manager' || projectRole === 'executive' || projectRole === 'team_lead')) {
                        return (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => onAction('View Leave', row)} style={btnStyle('#e0f2fe', '#075985', '#7dd3fc', '#bae6fd')}>
                                    <Eye size={14} /> View
                                </button>
                                <button onClick={() => onAction('Approve', row)} style={btnStyle('#dcfce7', '#166534', '#86efac', '#bbf7d0')}>
                                    Approve
                                </button>
                                <button onClick={() => onAction('Reject', row)} style={btnStyle('#fee2e2', '#991b1b', '#fca5a5', '#fecaca')}>
                                    Reject
                                </button>
                            </div>
                        );
                    } 
                    // Employee's pending leave
                    else if (row.status === 'Pending' && row.employee_id === userId) {
                        return (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => onAction('View Leave', row)} style={btnStyle('#e0f2fe', '#075985', '#7dd3fc', '#bae6fd')}>
                                    <Eye size={14} /> View
                                </button>
                                <button onClick={() => onAction('Delete Leave', row)} style={btnStyle('#fee2e2', '#991b1b', '#fca5a5', '#fecaca')}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        );
                    }
                    // Resolved leave
                    else {
                        return (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => onAction('View Leave', row)} style={btnStyle('#e0f2fe', '#075985', '#7dd3fc', '#bae6fd')}>
                                    <Eye size={14} /> View
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>-</span>
                            </div>
                        );
                    }
                }
            }
        ];
    } else if (type === 'employee-leave-info') {
        columns = [
            { header: 'Employee', accessor: 'name' },
            { header: 'Total Leaves Taken', accessor: 'total_taken' },
            { header: 'Paid Leaves', accessor: 'paid_leaves' },
            { header: 'Loss of Pay Days', accessor: 'lop_days' },
            { header: 'Leaves Left', accessor: 'leaves_left' }
        ];
    } else if (type === 'my-leaves') {
        columns = [
            { header: 'Type', accessor: 'type' },
            { header: 'Duration', accessor: 'duration' },
            { header: 'Dates', accessor: 'dates' },
            {
                header: 'Status', accessor: 'status', render: (row) => (
                    <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: row.status === 'Approved' ? '#dcfce7' : row.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                        color: row.status === 'Approved' ? '#166534' : row.status === 'Pending' ? '#b45309' : '#991b1b'
                    }}>
                        {row.status}
                    </span>
                )
            },
            {
                header: 'Actions', accessor: 'actions', render: (row) => {
                    if (row.status === 'Pending') {
                        return (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => onAction('View Leave', row)} style={btnStyle('#e0f2fe', '#075985', '#7dd3fc', '#bae6fd')}>
                                    <Eye size={14} /> View
                                </button>
                                <button onClick={() => onAction('Delete Leave', row)} style={btnStyle('#fee2e2', '#991b1b', '#fca5a5', '#fecaca')}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        );
                    } else {
                        return (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => onAction('View Leave', row)} style={btnStyle('#e0f2fe', '#075985', '#7dd3fc', '#bae6fd')}>
                                    <Eye size={14} /> View
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>-</span>
                            </div>
                        );
                    }
                }
            }
        ];
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Professional Integrated Leave Summary */}
            {leaveStats && (
                <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Leave Summary</h3>
                    
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        {/* Monthly Allowance */}
                        <div style={{ flex: '1', minWidth: '200px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Monthly Allowance</p>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{leaveStats.monthlyQuota || 1}</span>
                        </div>

                        {/* Used (Month) */}
                        <div style={{ flex: '1', minWidth: '200px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Used ({currentMonthName})</p>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{leaveStats.monthlyUsed || 0}</span>
                        </div>

                        {/* Annual Usage (Blue Pill Style) */}
                        <div style={{ flex: '1', minWidth: '240px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>Annual Usage ({currentYear})</p>
                            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '6px 20px', borderRadius: '24px', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.05em' }}>
                                {leaveStats.yearlyUsed || 0} / 12
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <DataTable
                title={`${title} List`}
                columns={columns}
                data={dataToDisplay}
                onAction={onAction}
            />
        </div>
    );
};

// Helper for inline button styles to support hover via CSS alternative or basic fallback
const btnStyle = (bg, color, border, hoverBg) => ({
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    backgroundColor: bg,
    color: color,
    border: `1px solid ${border}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s'
});

export default LeavesFeature;
