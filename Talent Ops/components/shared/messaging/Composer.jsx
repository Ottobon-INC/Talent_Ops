import React, { useState, useRef } from 'react';
import { Paperclip, Send, X, Plus, Trash2, BarChart2 } from 'lucide-react';

const Composer = ({
    // Shared state from parent
    replyingTo,
    setReplyingTo,
    errorMessage,
    setErrorMessage,
    loading,
    selectedConversation,
    onSendMessage,
    onSendPoll,
    onFileAttachment,
    orgUsers
}) => {
    // ── Local state (owned by Composer) ──
    const [messageInput, setMessageInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const textareaRef = useRef(null);
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [allowMultiplePoll, setAllowMultiplePoll] = useState(false);
    
    const [cursorPos, setCursorPos] = useState(0);
    const [mentionSearch, setMentionSearch] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionIndex, setMentionIndex] = useState(0);
    
    // -- Optimized Mentions Logic --
    const filteredUsers = (orgUsers && showMentions) 
        ? orgUsers.filter(u => 
            u.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) || 
            u.email?.toLowerCase().includes(mentionSearch.toLowerCase())
          ).slice(0, 10)
        : [];

    // ── Handlers ──
    const handleTextareaChange = (e) => {
        const value = e.target.value;
        const position = e.target.selectionStart;
        setMessageInput(value);
        setCursorPos(position);

        // Detect mention trigger
        const textBeforeCursor = value.substring(0, position);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            setShowMentions(true);
            setMentionSearch(mentionMatch[1]);
            setMentionIndex(0);
        } else {
            setShowMentions(false);
        }

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    };

    const handleKeyPress = (e) => {
        if (showMentions && filteredUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredUsers.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredUsers[mentionIndex]) {
                    insertMention(filteredUsers[mentionIndex]);
                }
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const insertMention = (user) => {
        const before = messageInput.substring(0, cursorPos).replace(/@\w*$/, '');
        const after = messageInput.substring(cursorPos);
        const mentionText = `@[${user.full_name || user.email}](${user.id}) `;
        setMessageInput(before + mentionText + after);
        setShowMentions(false);
        setMentionSearch('');
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length > 0) {
            setAttachments(prev => [...prev, ...files]);
        }
    };

    const handleFileAttachment = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setAttachments(prev => [...prev, ...files]);
        }
        // Reset input to allow re-selecting the same file
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if (!messageInput.trim() && attachments.length === 0) return;
        const content = messageInput;
        const filesCopy = [...attachments];
        // Clear composer immediately for snappy UX
        setMessageInput('');
        setAttachments([]);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        await onSendMessage(content, filesCopy);
    };

    const handleSendPoll = async () => {
        const validOptions = pollOptions.filter(o => o.trim());
        if (!pollQuestion.trim() || validOptions.length < 2) return;
        await onSendPoll(pollQuestion, validOptions, allowMultiplePoll);
        // Reset poll state
        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        setAllowMultiplePoll(false);
    };

    if (!selectedConversation) return null;

    return (
        <>
            <div className="message-input-container">
                {/* Error Banner */}
                {errorMessage && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        color: '#b91c1c',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{errorMessage}</span>
                        <button
                            onClick={() => setErrorMessage(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Reply Context */}
                {replyingTo && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: '#f3f4f6',
                        borderLeft: '3px solid #3b82f6',
                        margin: '0.5rem 0',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                Replying to {replyingTo.sender_name}
                            </div>
                            <div style={{ fontSize: '14px', color: '#1f2937' }}>
                                {replyingTo.content.substring(0, 50)}{replyingTo.content.length > 50 ? '...' : ''}
                            </div>
                        </div>
                        <button
                            onClick={() => setReplyingTo(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#6b7280',
                                padding: '4px'
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Attachment Preview */}
                {attachments.length > 0 && (
                    <div className="attachments-preview">
                        {attachments.map((file, index) => (
                            <div key={index} className="attachment-chip">
                                <span>{file.name}</span>
                                <button onClick={() => removeAttachment(index)}>
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mention Suggestions Dropdown */}
                {showMentions && filteredUsers.length > 0 && (
                    <div className="mention-suggestions" style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 10px)',
                        left: '10px',
                        width: '280px',
                        maxHeight: '320px',
                        background: 'white',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        overflowY: 'auto',
                        padding: '6px'
                    }}>
                        <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                            SUGGESTIONS
                        </div>
                        {filteredUsers.map((user, idx) => (
                            <div
                                key={user.id}
                                onClick={() => insertMention(user)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    background: idx === mentionIndex ? '#f1f5f9' : 'transparent',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)`,
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                }}>
                                    {(user.full_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.full_name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        @{user.email?.split('@')[0]}
                                    </div>
                                </div>
                                {idx === mentionIndex && (
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Box */}
                <div className="message-input-box">
                    <label className="attachment-button">
                        <Paperclip size={20} />
                        <input
                            type="file"
                            multiple
                            onChange={handleFileAttachment}
                            style={{ display: 'none' }}
                        />
                    </label>
                    <button
                        className="attachment-button"
                        onClick={() => setShowPollModal(true)}
                        title="Create Poll"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <BarChart2 size={20} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyPress}
                        onPaste={handlePaste}
                        rows={1}
                        style={{
                            resize: 'none',
                            minHeight: '40px',
                            maxHeight: '120px',
                            overflowY: 'auto'
                        }}
                    />
                    <button
                        className="send-button"
                        onClick={handleSend}
                        disabled={!messageInput.trim() && attachments.length === 0}
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>

            {/* ════════ Create Poll Modal ════════ */}
            {showPollModal && (
                <div className="modal-overlay" onClick={() => setShowPollModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3>Create Poll</h3>
                            <button onClick={() => setShowPollModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>Question</label>
                                <textarea
                                    className="poll-option-input"
                                    placeholder="Ask a question..."
                                    value={pollQuestion}
                                    onChange={(e) => setPollQuestion(e.target.value)}
                                    style={{ minHeight: '80px', width: '100%', resize: 'none' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>Options</label>
                                <div className="poll-modal-options">
                                    {pollOptions.map((opt, idx) => (
                                        <div key={idx} className="poll-option-input-container">
                                            <input
                                                className="poll-option-input"
                                                placeholder={`Option ${idx + 1}`}
                                                value={opt}
                                                onChange={(e) => {
                                                    const newOpts = [...pollOptions];
                                                    newOpts[idx] = e.target.value;
                                                    setPollOptions(newOpts);
                                                }}
                                            />
                                            {pollOptions.length > 2 && (
                                                <button
                                                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="add-option-btn"
                                    onClick={() => setPollOptions([...pollOptions, ''])}
                                >
                                    <Plus size={16} /> Add option
                                </button>
                            </div>
                            <div className="poll-toggle-container">
                                <span className="poll-toggle-label">Allow multiple answers</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={allowMultiplePoll}
                                        onChange={(e) => setAllowMultiplePoll(e.target.checked)}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
                            <button
                                style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '600', cursor: 'pointer' }}
                                onClick={() => setShowPollModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                style={{ flex: 1, padding: '12px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: '700', cursor: 'pointer' }}
                                onClick={handleSendPoll}
                                disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                            >
                                Create Poll
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Composer;
