// it is recommended to not store encryption keys directly in config files, 
// it's better to use an environment variable or to use dotenv in order to load the value
export const MyEncryptionTransformerConfig = {
    key: process.env.ENCRYPTION_KEY || '',
    algorithm: process.env.ENCRYPT_ALGORITHM || 'aes-256-cbc',
    ivLength: Number(process.env.IV_LENGTH) || 16,
    iv: process.env.IV || ''
};