import React, { useState, useRef } from 'react';
import { Paperclip, Send, X, Plus, Trash2, BarChart2, Smile, ChevronDown } from 'lucide-react';
import UserAvatar from '../UserAvatar';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '✅', '❌', '🚀', '⭐', '👋', '🙏', '💯', '🤔'];

const EmojiPicker = ({ onEmojiClick, onClose }) => (
    <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        zIndex: 2000,
        border: '1px solid #f1f5f9'
    }}>
        {COMMON_EMOJIS.map(emoji => (
            <button
                key={emoji}
                onClick={() => onEmojiClick(emoji)}
                style={{
                    fontSize: '20px',
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.1s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
                {emoji}
            </button>
        ))}
    </div>
);

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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    // -- Optimized Mentions Logic --
    const isGroupOrOrg = selectedConversation?.type === 'team' || selectedConversation?.type === 'everyone';
    
    const filteredUsers = (orgUsers && showMentions && isGroupOrOrg) 
        ? orgUsers.filter(u => 
            !mentionSearch.trim() || // Show all if search is empty
            u.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) || 
            u.email?.toLowerCase().includes(mentionSearch.toLowerCase())
          ).slice(0, 8)
        : [];

    // ── Handlers ──
    const handleTextareaChange = (e) => {
        const value = e.target.value;
        const position = e.target.selectionStart;
        setMessageInput(value);
        setCursorPos(position);

        // Detect mention trigger: search for @ followed by characters (including spaces) up to the cursor
        // Only trigger in Group or Company chats
        const textBeforeCursor = value.substring(0, position);
        const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^@]*)$/);

        if (isGroupOrOrg && mentionMatch) {
            const search = mentionMatch[1];
            // Only show mentions if search string isn't too long (prevent false positives)
            if (search.length < 30) {
                setShowMentions(true);
                setMentionSearch(search);
                setMentionIndex(0);
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
        }

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    };

    const handleSelect = (e) => {
        const position = e.target.selectionStart;
        setCursorPos(position);
        
        // Re-check for mention trigger on selection change (cursor move)
        const textBeforeCursor = messageInput.substring(0, position);
        const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^@]*)$/);
        
        if (isGroupOrOrg && mentionMatch) {
            const search = mentionMatch[1];
            if (search.length < 30) {
                setShowMentions(true);
                setMentionSearch(search);
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
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
        // Find the start of the mention trigger (@...)
        const textBeforeCursor = messageInput.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex === -1) return;

        const before = messageInput.substring(0, lastAtIndex);
        const after = messageInput.substring(cursorPos);
        const mentionText = `@[${user.full_name || user.email}](${user.id}) `;
        
        setMessageInput(before + mentionText + after);
        setShowMentions(false);
        setMentionSearch('');
        
        // Refocus and set cursor position after the inserted mention
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = lastAtIndex + mentionText.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
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
            <div className="message-input-container" style={{ position: 'relative' }}>
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
                        bottom: 'calc(100% + 12px)',
                        left: '20px',
                        width: '300px',
                        maxHeight: '280px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 1000,
                        overflowY: 'auto',
                        border: '1px solid #f1f5f9',
                        padding: '8px'
                    }}>
                        <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f8fafc', marginBottom: '4px' }}>
                            Mention People
                        </div>
                        {filteredUsers.map((user, index) => (
                            <div
                                key={user.id}
                                onClick={() => insertMention(user)}
                                onMouseEnter={() => setMentionIndex(index)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    backgroundColor: mentionIndex === index ? '#eff6ff' : 'transparent',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <UserAvatar user={user} size={32} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: mentionIndex === index ? '#2563eb' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.full_name || user.email}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.role || (user.email?.split('@')[0])}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Box */}
                <div className="message-input-box" style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '4px',
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '24px',
                    transition: 'all 0.25s ease',
                    position: 'relative'
                }}>
                    <label className="attachment-button" title="Attach Files" style={{ marginBottom: '4px' }}>
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
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Emojis"
                        style={{ marginBottom: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <Smile size={20} />
                    </button>
                    {(selectedConversation?.type === 'team' || selectedConversation?.type === 'everyone') && (
                        <button
                            className="attachment-button"
                            onClick={() => setShowPollModal(true)}
                            title="Create Poll"
                            style={{ marginBottom: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <BarChart2 size={20} />
                        </button>
                    )}
                    <textarea
                        ref={textareaRef}
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyPress}
                        onSelect={handleSelect}
                        onPaste={handlePaste}
                        rows={1}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            padding: '8px 4px',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            resize: 'none',
                            maxHeight: '120px',
                            color: '#0f172a',
                            minHeight: '24px'
                        }}
                    />
                    {showEmojiPicker && (
                        <div style={{ position: 'absolute', bottom: '100%', left: '0', zIndex: 1000, marginBottom: '10px' }}>
                            <EmojiPicker onEmojiClick={(emoji) => {
                                setMessageInput(prev => prev + emoji);
                                setShowEmojiPicker(false);
                            }} />
                        </div>
                    )}
                    <button
                        className="send-button"
                        onClick={handleSend}
                        disabled={!messageInput.trim() && attachments.length === 0}
                        style={{
                            width: '38px',
                            height: '38px',
                            marginBottom: '4px',
                            marginLeft: '4px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <Send size={18} />
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
