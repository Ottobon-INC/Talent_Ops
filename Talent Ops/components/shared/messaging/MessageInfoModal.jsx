import React, { useMemo } from 'react';
import { X, CheckCheck, Check } from 'lucide-react';

const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
};

const modalStyle = {
    width: 'min(560px, calc(100vw - 28px))',
    maxHeight: 'min(78vh, 720px)',
    background: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
};

const sectionTitleStyle = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
};

const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#ffffff'
};

const nameStyle = {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a'
};

const timeStyle = {
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748b'
};

const formatSeenTime = (seenAt) => {
    if (!seenAt) return '';
    const d = new Date(seenAt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
};

const MessageInfoModal = ({ message, members = [], currentUserId, onClose }) => {
    const computed = useMemo(() => {
        const msg = message || {};
        const senderId = msg.sender_user_id;

        const eligibleMembers = (members || []).filter(m => m?.user_id !== senderId && m?.id !== senderId);
        const seenBy = Array.isArray(msg.seen_by) ? msg.seen_by : [];

        const seenIds = new Set(seenBy.map(s => s.user_id));
        const readList = eligibleMembers
            .filter(m => seenIds.has(m.user_id || m.id))
            .map(m => {
                const id = m.user_id || m.id;
                const seenMeta = seenBy.find(s => s.user_id === id);
                return {
                    id,
                    name: m.full_name || m.email || 'User',
                    seen_at: seenMeta?.seen_at || null
                };
            })
            .sort((a, b) => new Date(a.seen_at || 0) - new Date(b.seen_at || 0));

        const unreadList = eligibleMembers
            .filter(m => !seenIds.has(m.user_id || m.id))
            .map(m => ({
                id: m.user_id || m.id,
                name: m.full_name || m.email || 'User'
            }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const isGroup = eligibleMembers.length > 1;
        const title = isGroup ? 'Message info' : 'Info';

        return { title, readList, unreadList, senderId, createdAt: msg.created_at };
    }, [message, members]);

    if (!message) return null;

    const canClose = (e) => {
        e.stopPropagation();
        onClose?.();
    };

    return (
        <div style={overlayStyle} onMouseDown={canClose}>
            <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
                <div style={{ padding: '14px 14px 12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>{computed.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {new Date(message.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '12px 14px', overflow: 'auto', display: 'grid', gap: '14px' }}>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCheck size={16} style={{ color: '#3b82f6' }} />
                            <div style={sectionTitleStyle}>Read by ({computed.readList.length})</div>
                        </div>
                        {computed.readList.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#64748b', padding: '10px 12px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc' }}>
                                No one has seen this yet.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {computed.readList.map(u => (
                                    <div key={u.id} style={rowStyle}>
                                        <div style={nameStyle}>{u.name}{u.id === currentUserId ? ' (You)' : ''}</div>
                                        <div style={timeStyle}>{formatSeenTime(u.seen_at)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Check size={16} style={{ color: '#94a3b8' }} />
                            <div style={sectionTitleStyle}>Not seen yet ({computed.unreadList.length})</div>
                        </div>
                        {computed.unreadList.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#64748b', padding: '10px 12px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc' }}>
                                Everyone has seen this.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {computed.unreadList.map(u => (
                                    <div key={u.id} style={rowStyle}>
                                        <div style={nameStyle}>{u.name}{u.id === currentUserId ? ' (You)' : ''}</div>
                                        <div style={timeStyle}>—</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageInfoModal;

