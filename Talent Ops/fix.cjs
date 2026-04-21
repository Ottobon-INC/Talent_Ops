const fs = require('fs');
const path = 'c:/Users/AJAY/OneDrive/Desktop/talentops/Talent_Ops/Talent Ops/services/messageService.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /export const markAsReadInDB = async \(conversationId, userId\) => \{\s*try \{\s*const \{ error \} = await supabase\s*\.from\('conversation_members'\)\s*\.update\(\{ last_read_at: new Date\(\)\.toISOString\(\) \}\)/s,
    `export const markAsReadInDB = async (conversationId, userId, timestampStr = null) => {
    try {
        const timeToSet = timestampStr || new Date().toISOString();
        const { error } = await supabase
            .from('conversation_members')
            .update({ last_read_at: timeToSet })`
);

content = content.replace(
    /await Promise\.all\(brokenConversations\.map\(async \(conv\) => \{\s*const \{ data: msgs \} = await supabase\s*\.from\('messages'\)\s*\.select\('content'\)\s*\.eq\('conversation_id', conv\.id\)\s*\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(1\);\s*if \(msgs && msgs\.length > 0\) \{\s*const content = msgs\[0\]\.content;\s*\/\/ Update local object immediately so UI shows it\s*if \(conv\.conversation_indexes\[0\]\) \{\s*conv\.conversation_indexes\[0\]\.last_message = content;\s*\}\s*\/\/ Background repair: Persist this fix to the DB index\s*repairConversationIndexLastMessage\(conv\.id, content\)\.catch\(err =>\s*console\.error\('Failed to auto-repair conversation index:', err\)\s*\);\s*\}\s*\}\)\);/s,
    `await Promise.all(brokenConversations.map(async (conv) => {
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
                    repairConversationIndexLastMessage(conv.id, content, msg.created_at, msg.sender_user_id).catch(err =>
                        console.error('Failed to auto-repair conversation index:', err)
                    );
                }
            }));`
);

content = content.replace(
    /const repairConversationIndexLastMessage = async \(conversationId, lastMessage\) => \{\s*const nowIso = new Date\(\)\.toISOString\(\);\s*const \{ error \} = await supabase\s*\.from\('conversation_indexes'\)\s*\.update\(\{ last_message: lastMessage, updated_at: nowIso \}\)\s*\.eq\('conversation_id', conversationId\);/s,
    `const repairConversationIndexLastMessage = async (conversationId, lastMessage, lastMessageAt, lastSenderId) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
        .from('conversation_indexes')
        .update({ last_message: lastMessage, last_message_at: lastMessageAt, last_sender_id: lastSenderId, updated_at: nowIso })
        .eq('conversation_id', conversationId);`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced successfully');
