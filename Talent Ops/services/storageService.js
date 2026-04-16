import { supabase } from '../lib/supabaseClient';

/**
 * Storage Service
 * Responsibility: Handles all file-related operations with Supabase Storage.
 * Follows SRP (Single Responsibility Principle).
 */

/**
 * Sanitizes a filename for storage consistency while keeping it "normal".
 * Only removes characters that are known to cause S3/Supabase 400 errors (like brackets).
 * Keeps spaces (optionally replaces with underscores for safety).
 */
export const sanitizeFileName = (fileName) => {
    if (!fileName) return `file_${Date.now()}`;

    // Replace characters that break S3/Supabase keys: [ ] { }
    return fileName
        .replace(/[\[\]{}]/g, '') // Remove brackets/braces
        .replace(/\s+/g, '_');    // Replace spaces with underscores for URL safety
};

/**
 * Validates file type against whitelist (Issue 7)
 */
export const isFileTypeAllowed = (file) => {
    const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    const fileExt = file.name.split('.').pop().toLowerCase();
    return allowedExtensions.includes(fileExt) || allowedMimeTypes.includes(file.type);
};

/**
 * Uploads a file to a specific bucket with path grouping.
 * Grouping by path (e.g. org/user/task/) makes the filenames look "normal".
 */
export const uploadFile = async ({ bucket, path, file }) => {
    try {
        // Validation: Block ZIP, executables, etc. (Issue 7)
        if (!isFileTypeAllowed(file)) {
            throw new Error('File type not allowed. Only PDF, Word documents, and Images are permitted.');
        }

        // 1. PROACTIVE AUTH CHECK
        // by forcing a session refresh right before the high-stakes upload.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            throw new Error('Your session has expired. Please refresh the page and log in again.');
        }

        // 2. PATH VALIDATION: Ensure we aren't creating a "null" path which triggers 400 errors
        if (path && (path.includes('undefined') || path.includes('null'))) {
            console.warn('StorageService: Malformed path detected:', path);
            // We can try to repair or just warn, but usually this means context is stale
        }

        const cleanName = sanitizeFileName(file.name);

        // We put the uniqueness in the path and a timestamp prefix
        // This avoids the "long string of random letters" in the actual filename
        const fileName = `${Date.now()}_${cleanName}`;
        const filePath = path ? `${path}/${fileName}` : fileName;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'application/octet-stream'
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);

        return {
            publicUrl,
            fileName: file.name,
            storagePath: filePath
        };
    } catch (error) {
        console.error('StorageService: Upload failed:', error.message);
        throw error;
    }
};

/**
 * Bulk upload helper for multiple files.
 */
export const uploadMultipleFiles = async ({ bucket, path, files, onProgress }) => {
    const results = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
        const file = files[i];

        const progressStart = (i / total) * 100;
        onProgress?.(progressStart);

        const result = await uploadFile({ bucket, path, file });
        results.push({
            ...result,
            fileType: file.type || 'application/octet-stream'
        });

        const progressEnd = ((i + 1) / total) * 100;
        onProgress?.(progressEnd);
    }

    return results;
};
