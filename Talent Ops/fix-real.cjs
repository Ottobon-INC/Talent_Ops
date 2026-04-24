const fs = require('fs');
const pathStr = 'c:/Users/AJAY/OneDrive/Desktop/talentops/Talent_Ops/Talent Ops/services/messageService.js';
let content = fs.readFileSync(pathStr, 'utf8');

// Replace the broken conversations block using a more reliable regex structure
content = content.replace(
    /if \(brokenConversations\.length > 0\) \{[\s\S]*?updateConversationIndex\(conv\.id, content\)\.catch\(err =>[\s\S]*?console\.error\('Failed to auto-repair conversation index:', err\)[\s\S]*?\);[\s\S]*?\}\s*\}\)\);\s*\}/,
    `if (brokenConversations.length > 0) {
            await Promise.all(brokenConversations.map(async (conv) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('content, created_at, sender_user_id, attachments(id)')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (msgs && msgs.length > 0) {
                    const msg = msgs[0];
                    const content = msg.content || (msg.attachments && msg.attachments.length > 0 ? '📎 Attachment' : '');
                    
                    // Update local object immediately so UI shows it
                    if (conv.conversation_indexes[0]) {
                        conv.conversation_indexes[0].last_message = content;
                        conv.conversation_indexes[0].last_message_at = msg.created_at;
                        conv.conversation_indexes[0].last_sender_id = msg.sender_user_id;
                    }

                    // Background repair: Persist this fix to the DB index
                    updateConversationIndex(conv.id, content, msg.sender_user_id, msg.created_at).catch(err =>
                        console.error('Failed to auto-repair conversation index:', err)
                    );
                }
            }));
        }`
);

// Also restore the markAsReadInDB fix that was lost during github checkout!
content = content.replace(
    /export const markAsReadInDB = async \(conversationId, userId\) => \{[\s\S]*?try \{[\s\S]*?const \{ error \} = await supabase[\s\S]*?\.from\('conversation_members'\)[\s\S]*?\.update\(\{ last_read_at: new Date\(\)\.toISOString\(\) \}\)/,
    `export const markAsReadInDB = async (conversationId, userId, timestampStr = null) => {
    try {
        const timeToSet = timestampStr || new Date().toISOString();
        const { error } = await supabase
            .from('conversation_members')
            .update({ last_read_at: timeToSet })`
);

fs.writeFileSync(pathStr, content, 'utf8');
console.log('Successfully applied accurate regex patches to messageService.js');
