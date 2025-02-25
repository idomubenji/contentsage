/**
 * GDPR/CCPA Client-Side Encryption Utilities
 * 
 * This module provides functions for client-side encryption of sensitive data
 * before sending it to Supabase. This provides end-to-end encryption for 
 * highly sensitive data where even database administrators should not have access.
 * 
 * Requirements:
 * - crypto-js: npm install crypto-js
 */

import CryptoJS from 'crypto-js';

/**
 * Generate a secure encryption key
 * @returns {string} A random encryption key
 */
export const generateEncryptionKey = () => {
  // Generate a random 256-bit key (32 bytes)
  const randomKey = CryptoJS.lib.WordArray.random(32);
  return randomKey.toString(CryptoJS.enc.Base64);
};

/**
 * Encrypt data using AES encryption
 * @param {string} plaintext - The data to encrypt
 * @param {string} secretKey - The encryption key
 * @returns {string} The encrypted data
 */
export const encryptData = (plaintext, secretKey) => {
  if (!plaintext) return null;
  
  try {
    // Add a random IV for added security
    const encrypted = CryptoJS.AES.encrypt(plaintext, secretKey);
    return encrypted.toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES encryption
 * @param {string} ciphertext - The encrypted data
 * @param {string} secretKey - The encryption key
 * @returns {string} The decrypted data
 */
export const decryptData = (ciphertext, secretKey) => {
  if (!ciphertext) return null;
  
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data - possibly wrong encryption key');
  }
};

/**
 * Securely hash data (one-way) - useful for creating lookups without storing the actual data
 * @param {string} data - The data to hash
 * @param {string} [salt=null] - Optional salt for the hash
 * @returns {string} The hashed data
 */
export const hashData = (data, salt = null) => {
  if (!data) return null;
  
  const saltToUse = salt || CryptoJS.lib.WordArray.random(16).toString();
  const hashedData = CryptoJS.PBKDF2(data, saltToUse, {
    keySize: 8,
    iterations: 1000
  }).toString();
  
  // Return both the hash and salt if a salt wasn't provided
  return salt ? hashedData : { hash: hashedData, salt: saltToUse };
};

/**
 * Example of a secure data object with selective encryption
 * @param {Object} userData - User data with sensitive fields
 * @param {string} encryptionKey - Encryption key
 * @returns {Object} User data with encrypted sensitive fields
 */
export const secureUserData = (userData, encryptionKey) => {
  // Make a copy to avoid mutating the original
  const secureData = { ...userData };
  
  // List of fields to encrypt
  const sensitiveFields = ['ssn', 'creditCardNumber', 'medicalInfo'];
  
  // Encrypt only sensitive fields
  sensitiveFields.forEach(field => {
    if (secureData[field]) {
      secureData[field] = encryptData(secureData[field], encryptionKey);
    }
  });
  
  return secureData;
};

/**
 * Helper to store encryption key in secure storage
 * @param {string} keyName - Name/identifier for the key
 * @param {string} encryptionKey - The encryption key to store
 */
export const storeEncryptionKey = (keyName, encryptionKey) => {
  try {
    // For web applications, sessionStorage is more secure than localStorage
    // For production, consider using a secure key management solution
    sessionStorage.setItem(`encryption_key_${keyName}`, encryptionKey);
    return true;
  } catch (error) {
    console.error('Failed to store encryption key:', error);
    return false;
  }
};

/**
 * Helper to retrieve encryption key from secure storage
 * @param {string} keyName - Name/identifier for the key
 * @returns {string|null} The encryption key or null if not found
 */
export const getEncryptionKey = (keyName) => {
  try {
    return sessionStorage.getItem(`encryption_key_${keyName}`);
  } catch (error) {
    console.error('Failed to retrieve encryption key:', error);
    return null;
  }
};

/**
 * Example Supabase helper that uses encryption
 * @param {Object} supabase - Supabase client instance
 * @param {string} encryptionKey - Encryption key
 */
export const createEncryptedSupabaseHelpers = (supabase, encryptionKey) => {
  return {
    /**
     * Insert user profile with encrypted sensitive data
     * @param {Object} profileData - The profile data
     * @returns {Promise} Supabase query result
     */
    async insertEncryptedProfile(profileData) {
      // Fields to encrypt
      const fieldsToEncrypt = ['phone', 'address', 'ssn'];
      
      // Create a copy of the data
      const secureData = { ...profileData };
      
      // Encrypt specified fields
      fieldsToEncrypt.forEach(field => {
        if (secureData[field]) {
          secureData[`${field}_encrypted`] = encryptData(secureData[field], encryptionKey);
          delete secureData[field]; // Remove unencrypted field
        }
      });
      
      // Insert the data with encrypted fields
      return supabase.from('user_profiles').insert(secureData);
    },
    
    /**
     * Get and decrypt user profile data
     * @param {string} userId - The user ID
     * @returns {Promise<Object>} Decrypted profile data
     */
    async getDecryptedProfile(userId) {
      // Fields that are encrypted in the database
      const encryptedFields = ['phone_encrypted', 'address_encrypted', 'ssn_encrypted'];
      
      // Get the profile data
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      if (!data) return null;
      
      // Create a copy for decrypted data
      const decryptedData = { ...data };
      
      // Decrypt the encrypted fields
      encryptedFields.forEach(field => {
        if (data[field]) {
          // Get the original field name (remove _encrypted suffix)
          const originalField = field.replace('_encrypted', '');
          
          // Decrypt and add to the result
          try {
            decryptedData[originalField] = decryptData(data[field], encryptionKey);
          } catch (e) {
            console.error(`Failed to decrypt ${field}:`, e);
            decryptedData[originalField] = null;
          }
        }
      });
      
      return decryptedData;
    }
  };
};

// Usage example:
/*
import { createClient } from '@supabase/supabase-js';
import { 
  generateEncryptionKey, 
  storeEncryptionKey, 
  getEncryptionKey,
  createEncryptedSupabaseHelpers 
} from './encryption-utils';

// Initialize Supabase client
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_KEY');

// Get or generate encryption key
let encryptionKey = getEncryptionKey('user-data');
if (!encryptionKey) {
  encryptionKey = generateEncryptionKey();
  storeEncryptionKey('user-data', encryptionKey);
}

// Create helpers for working with encrypted data
const encryptedHelpers = createEncryptedSupabaseHelpers(supabase, encryptionKey);

// Save encrypted profile
await encryptedHelpers.insertEncryptedProfile({
  user_id: 'user-uuid',
  name: 'John Doe', // Not encrypted
  phone: '+1234567890', // Will be encrypted
  ssn: '123-45-6789', // Will be encrypted
});

// Retrieve and decrypt profile
const profile = await encryptedHelpers.getDecryptedProfile('user-uuid');
console.log(profile.name); // "John Doe"
console.log(profile.phone); // "+1234567890" (decrypted)
console.log(profile.ssn); // "123-45-6789" (decrypted)
*/ 