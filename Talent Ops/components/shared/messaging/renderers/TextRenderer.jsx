import React from 'react';

const TextRenderer = ({ message }) => {
    const content = message.content;
    if (!content) return null;

    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const mentionPattern = /@\[([^\]]+)\](?:\(([^)]+)\))?/g;
    const lines = content.split('\n');

    return (
        <span className="text-message-content" style={{ lineHeight: '1.5' }}>
            {lines.map((line, lineIndex) => (
                <React.Fragment key={lineIndex}>
                    {line.split(urlPattern).map((part, i) => {
                        if (part.match(urlPattern)) {
                            return (
                                <a key={`url-${i}`} href={part} target="_blank" rel="noopener noreferrer"
                                    className="message-link"
                                    style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: '500', wordBreak: 'break-all' }}>
                                    {part}
                                </a>
                            );
                        }
                        
                        // Handle mentions within the non-URL parts
                        const subParts = part.split(mentionPattern);
                        if (subParts.length > 1) {
                            const result = [];
                            for (let j = 0; j < subParts.length; j++) {
                                // Every 3 elements in subParts correspond to [match, name, id]
                                if (j % 3 === 0) {
                                    result.push(subParts[j]);
                                } else if (j % 3 === 1) {
                                    const name = subParts[j];
                                    const id = subParts[j + 1];
                                    result.push(
                                        <span key={`mention-${i}-${j}`} 
                                            style={{ 
                                                color: '#3b82f6', 
                                                fontWeight: '600', 
                                                cursor: 'pointer',
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                padding: '0 4px',
                                                borderRadius: '4px',
                                                margin: '0 1px'
                                            }}
                                            title={`User ID: ${id}`}
                                        >
                                            @{name}
                                        </span>
                                    );
                                }
                                // Skip the ID part (j%3 === 2) as it's handled with the name
                            }
                            return result;
                        }

                        return part;
                    })}
                    {lineIndex < lines.length - 1 && <br />}
                </React.Fragment>
            ))}
        </span>
    );
};

export default TextRenderer;
