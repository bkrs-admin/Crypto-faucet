import { NextApiRequest, NextApiResponse } from 'next';

const bitcoin = require('bitcoinjs-lib');
const ElectrumClient = require('electrum-client');
const ECPairFactory = require('ecpair');
const bip32Factory = require('bip32');
const tinysecp256k1 = require('tiny-secp256k1');
import * as nodeCrypto from 'crypto';

/**
 * I have used AI tool to help me to write this code to patch the BitcoinJS library to support SIGHASH_MOBICK.
 */

interface ElectrumClientType {
  connection: {
    connected: boolean;
    socket: any;
  };
  connect(): Promise<void>;
  close(): void;
  request(method: string, ...params: any[]): Promise<any>;
  server_ping(): Promise<any>;
  blockchainTransaction_get?: (txid: string) => Promise<string>;
  blockchainTransaction_broadcast?: (hex: string) => Promise<string>;
  blockchainScripthash_listunspent?: (scripthash: string) => Promise<any[]>;
  blockchain_transaction_get?: (txid: string) => Promise<string>;
  blockchain_transaction_broadcast?: (hex: string) => Promise<string>;
  blockchain_scripthash_listunspent?: (scripthash: string) => Promise<any[]>;
  [key: string]: any;
}

interface UTXO {
  tx_hash: string;
  tx_pos: number;
  value: number;
  height?: number;
}

interface AddressInfo {
  address: string;
  type: string;
  redeemScript?: Buffer;
  p2sh?: any;
  p2wpkh?: any;
}

interface BitcoinPatchVerification {
  sighashMobickConstant: boolean;
  sighashMobickValue: number | undefined;
  patchedSignInput: boolean;
  isDefinedHashTypePatched: boolean;
  isDefinedHashTypeWorkaround?: boolean;
}

interface PatchableBitcoinModule {
  Transaction: {
    SIGHASH_MOBICK?: number;
    [key: string]: any;
  };
  Psbt: {
    prototype: {
      signInput: (inputIndex: number, keyPair: any, sighashTypes?: number[]) => any;
      [key: string]: any;
    };
    [key: string]: any;
  };
  script?: {
    isDefinedHashType?: (hashType: number) => boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ScriptModule {
  isDefinedHashType?: (hashType: number) => boolean;
  [key: string]: any;
}

interface PsbtModule {
  checkSighashTypeAllowed?: (sighashType: number) => boolean;
  [key: string]: any;
}

interface UserDocument {
  username?: string;
  message?: string;
  [key: string]: any;
}

interface AddressResolution {
  address: string;
  source: string;
}

interface InputSelection {
  selected: UTXO[];
  total: number;
}

const ECPair = ECPairFactory.default(tinysecp256k1);

bitcoin.initEccLib(tinysecp256k1);


(bitcoin as any).bip32 = bip32Factory.default(tinysecp256k1);

// ===== Runtime SIGHASH_MOBICK patch =====
function applyBitcoinJSPatch(): void {
  

  const bitcoinModule = bitcoin as PatchableBitcoinModule;

  // 1. Add SIGHASH_MOBICK constant to Transaction
  if (!bitcoinModule.Transaction.SIGHASH_MOBICK) {
    bitcoinModule.Transaction.SIGHASH_MOBICK = 0x10;
  }

  // 2. Patch isDefinedHashType function in script.js (multiple methods)
  let isDefinedHashTypePatched = false;

  // Method 1: Direct module patch
  try {
    const script = require('bitcoinjs-lib/src/script') as ScriptModule;
    
    if (script && script.isDefinedHashType) {
      // Backup original function
      const originalIsDefinedHashType = script.isDefinedHashType;
      
      // Replace with patched function
      script.isDefinedHashType = function(hashType: number): boolean {
        const hashTypeMod = hashType & ~0x80;
        // Allow SIGHASH_MOBICK (0x10-0x14) range
        return ((hashTypeMod > 0x00 && hashTypeMod < 0x04) || (hashTypeMod > 0x10 && hashTypeMod < 0x14));
      };
      isDefinedHashTypePatched = true;
    }
  } catch (scriptPatchError: any) {
    console.log(scriptPatchError.message);
  }

  // Method 2: Patch via global require cache
  if (!isDefinedHashTypePatched) {
    try {
      const requireCache = require.cache;
      const scriptPath = Object.keys(requireCache).find(key => key.includes('script.js') || key.includes('script'));
      
      if (scriptPath && requireCache[scriptPath] && requireCache[scriptPath]?.exports?.isDefinedHashType) {
        const scriptModule = requireCache[scriptPath]!.exports as ScriptModule;
        
        scriptModule.isDefinedHashType = function(hashType: number): boolean {
          const hashTypeMod = hashType & ~0x80;
          return ((hashTypeMod > 0x00 && hashTypeMod < 0x04) || (hashTypeMod > 0x10 && hashTypeMod < 0x14));
        };
        
        isDefinedHashTypePatched = true;
      }
    } catch (cacheError: any) {
      console.log(cacheError.message);
    }
  }

  // Method 3: Patch via bitcoinjs-lib main object
  if (!isDefinedHashTypePatched) {
    try {
      // Access internal script module of bitcoinjs-lib
      const bitcoinMainModule = require('bitcoinjs-lib');
      
      // Search internal module
      if (bitcoinMainModule.script && bitcoinMainModule.script.isDefinedHashType) {
        bitcoinMainModule.script.isDefinedHashType = function(hashType: number): boolean {
          const hashTypeMod = hashType & ~0x80;
          return ((hashTypeMod > 0x00 && hashTypeMod < 0x04) || (hashTypeMod > 0x10 && hashTypeMod < 0x14));
        };
        
        isDefinedHashTypePatched = true;
      }
    } catch (bitcoinError: any) {
      console.log(bitcoinError.message);
    }
  }

  // 3. Disable checkSighashTypeAllowed function in PSBT
  try {
    // Disable checkSighashTypeAllowed function in psbt.js
    const psbtModule = require('bitcoinjs-lib/src/psbt') as PsbtModule;
    
    // Disable checkSighashTypeAllowed function
    if (psbtModule.checkSighashTypeAllowed) {
      psbtModule.checkSighashTypeAllowed = function(): boolean {
        // Allow all sighash types (skip check)
        return true;
      };
    }
  } catch (psbtPatchError: any) {
    console.log(psbtPatchError.message);
  }

  // 4. Patch PSBT prototype method
  try {
    const originalSignInput = bitcoinModule.Psbt.prototype.signInput;
    
    bitcoinModule.Psbt.prototype.signInput = function(inputIndex: number, keyPair: any, sighashTypes?: number[]): any {
      
      // Force SIGHASH_MOBICK
      if (Array.isArray(sighashTypes) && sighashTypes.includes(0x10)) {
        
        // Explicitly set sighashType for input
        if (!this.data.inputs[inputIndex].sighashType) {
          this.data.inputs[inputIndex].sighashType = 0x10;
        }
      }
      
      // Call original function
      return originalSignInput.call(this, inputIndex, keyPair, sighashTypes);
    };

  } catch (prototypeError: any) {
    console.log(prototypeError.message);
  }

}

// ===== Verify patch status function =====
function verifyBitcoinJSPatch(): BitcoinPatchVerification {
  
  const bitcoinModule = bitcoin as PatchableBitcoinModule;
  
  const results: BitcoinPatchVerification = {
    sighashMobickConstant: !!bitcoinModule.Transaction.SIGHASH_MOBICK,
    sighashMobickValue: bitcoinModule.Transaction.SIGHASH_MOBICK,
    patchedSignInput: bitcoinModule.Psbt.prototype.signInput.toString().includes('BTC patch'),
    isDefinedHashTypePatched: false
  };
  
  // Test isDefinedHashType function (multiple methods)
  try {
    let testPassed = false;
    
    // Method 1: Direct module test
    try {
      const script = require('bitcoinjs-lib/src/script') as ScriptModule;
      if (script && script.isDefinedHashType && script.isDefinedHashType(0x10)) {
        testPassed = true;
      }
    } catch (e) {
      // Silent fail for method 1
    }
    
    // Method 2: Test via require cache
    if (!testPassed) {
      try {
        const requireCache = require.cache;
        Object.keys(requireCache).forEach(key => {
          if (key.includes('script') && requireCache[key]?.exports?.isDefinedHashType) {
            if (requireCache[key]!.exports.isDefinedHashType(0x10)) {
              testPassed = true;
            }
          }
        });
      } catch (e) {
        // Silent fail for method 2
      }
    }
    
    results.isDefinedHashTypePatched = testPassed;
    results.isDefinedHashTypeWorkaround = !testPassed; // Workaround needed?
    
  } catch (e) {
    results.isDefinedHashTypePatched = false;
    results.isDefinedHashTypeWorkaround = true;
  }
  
  return results;
}

// Apply and verify patch
applyBitcoinJSPatch();
const patchResults = verifyBitcoinJSPatch();

// --- Electrum server settings ---
// !! Important: These values should be loaded from environment variables or configuration files in production.
const ELECTRUM_HOST: string = process.env.ELECTRUM_HOST || ''; // Electrum server IP
const ELECTRUM_PORT: number = parseInt(process.env.ELECTRUM_PORT || '', 10); // Electrum server TCP port
const ELECTRUM_PROTOCOL: string = process.env.ELECTRUM_PROTOCOL || ''; // 'tcp' or 'tls'

// Bitcoin network settings (testnet or mainnet)
const NETWORK = bitcoin.networks.bitcoin; // Use testnet for development (use bitcoin.networks.bitcoin in production)

// Reserve UTXO in process
const inFlightUtxos = new Set<string>();

// Simplified wallet information (use private key directly)
// !! Important: In production, manage these values securely through environment variables or KMS.
const FAUCET_PRIVATE_KEY: string | undefined = process.env.FAUCET_PRIVATE_KEY;

let electrumClient: ElectrumClientType | null = null;

// createSimpleKeyPair replacement: Disallow random generation in production + memoize
let CACHED_FAUCET_KEYPAIR: any;

function createSimpleKeyPair(): any {
  if (CACHED_FAUCET_KEYPAIR) {
    return CACHED_FAUCET_KEYPAIR;
  }

  const pk = (FAUCET_PRIVATE_KEY || '').trim();
  
  if (!pk) {
    throw new Error('FAUCET_PRIVATE_KEY is not set.');
  }

  // WIF: Mainnet can start with 5(uncompressed), K/L(compressed)
  const isWif = /^[5KL][1-9A-HJ-NP-Za-km-z]{50,}$/.test(pk);
  const isHex32 = /^[0-9a-fA-F]{64}$/.test(pk);
  

  if (isWif) {
    CACHED_FAUCET_KEYPAIR = ECPair.fromWIF(pk, NETWORK); // Throw if network mismatch
    return CACHED_FAUCET_KEYPAIR;
  }

  if (isHex32) {
    const buf = Buffer.from(pk, 'hex');
    CACHED_FAUCET_KEYPAIR = ECPair.fromPrivateKey(buf, { network: NETWORK, compressed: true });
    return CACHED_FAUCET_KEYPAIR;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid FAUCET_PRIVATE_KEY format(WIF or 64-hex is required).');
  }

  // Allow only in development environment
  CACHED_FAUCET_KEYPAIR = ECPair.makeRandom({ network: NETWORK });
  return CACHED_FAUCET_KEYPAIR;
}

// --- Create P2SH-P2WPKH address ---
function createP2SHSegwitAddress(keyPair: any): AddressInfo {
  
  // Create P2WPKH script
  const p2wpkh = bitcoin.payments.p2wpkh({ 
    pubkey: keyPair.publicKey, 
    network: NETWORK 
  });
  
  // Wrap P2WPKH in P2SH (P2SH-P2WPKH)
  const p2sh = bitcoin.payments.p2sh({
    redeem: p2wpkh,
    network: NETWORK
  });
  
  return {
    address: p2sh.address!,
    type: 'p2sh-p2wpkh',
    redeemScript: p2wpkh.output,
    p2sh: p2sh,
    p2wpkh: p2wpkh
  };
}

// --- Connect to Electrum server function ---
async function connectToElectrum(): Promise<ElectrumClientType> {
  return await connectToElectrumWithFallback();
}

// --- Main connection function: Official protocol-based verification ---
async function connectToElectrumWithFallback(): Promise<ElectrumClientType> {
  if (electrumClient && electrumClient.connection && electrumClient.connection.connected) {
    // Official protocol-based methods for connection verification
    const connectionCheckMethods = [
      // Method 1: Official server.ping() - no parameters, null return
      async (): Promise<boolean> => {
        const result = await electrumClient!.request('server.ping');
        if (result === null) {
          console.log('Existing connection server.ping success (null return)');
          return true;
        } else {
          throw new Error(`Unexpected ping result: ${result}`);
        }
      },
      // Method 2: Underscore-style ping
      async (): Promise<boolean> => {
        const result = await electrumClient!.server_ping();
        if (result === null) {
          console.log('Existing connection server_ping success');
          return true;
        } else {
          throw new Error(`Unexpected ping result: ${result}`);
        }
      },
      // Method 3: Official server.version protocol
      async (): Promise<boolean> => {
        const result = await electrumClient!.request('server.version', 'Bitcoin P2SH Client', '1.4');
        console.log('Existing connection server.version success:', result);
        if (Array.isArray(result) && result.length === 2) {
          return true;
        } else {
          throw new Error(`Unexpected version result format: ${result}`);
        }
      }
    ];
    
    for (const checkMethod of connectionCheckMethods) {
      try {
        await checkMethod();
        console.log('Existing Electrum connection verification success, reuse.');
        return electrumClient;
      } catch (e: any) {
        console.log(`Connection verification method failed: ${e.message}`);
        continue;
      }
    }
    
    console.warn('Existing connection verification failed, reconnect.');
    try {
      electrumClient.close();
    } catch (e) {
      // Silent fail
    }
    electrumClient = null;
  }

  console.log('Attempting to connect to new Electrum client.');
  electrumClient = new ElectrumClient(ELECTRUM_PORT, ELECTRUM_HOST, ELECTRUM_PROTOCOL) as ElectrumClientType;
  
  try {
    await electrumClient.connect();
    console.log(`Electrum server connection success: ${ELECTRUM_HOST}:${ELECTRUM_PORT}`);
    
    // After successful connection, verify with official protocol
    const verificationMethods = [
      // Method 1: Official server.ping() protocol (no parameters)
      async (): Promise<boolean> => {
        console.log('Verification attempt: server.ping (request method)');
        const result = await electrumClient!.request('server.ping');
        if (result === null) {
          console.log('✅ server.ping verification success (null return)');
          return true;
        } else {
          throw new Error(`ping result is not null: ${result}`);
        }
      },
      // Method 2: Official server.version protocol
      async (): Promise<boolean> => {
        console.log('Verification attempt: server.version (request method)');
        const result = await electrumClient!.request('server.version', 'Bitcoin P2SH Client', '1.4');
        console.log('server.version result:', result);
        if (Array.isArray(result) && result.length === 2) {
          console.log('✅ server.version verification success:', result);
          return true;
        } else {
          throw new Error(`version result format error: ${JSON.stringify(result)}`);
        }
      },
      // Method 3: Underscore-style ping
      async (): Promise<boolean> => {
        console.log('Verification attempt: server_ping');
        const result = await electrumClient!.server_ping();
        if (result === null) {
          console.log('✅ server_ping verification success');
          return true;
        } else {
          throw new Error(`ping result is not null: ${result}`);
        }
      }
    ];
    
    for (const verifyMethod of verificationMethods) {
      try {
        await verifyMethod();
        return electrumClient;
      } catch (error: any) {
        console.log(`Verification method failed: ${error.message}`);
        continue;
      }
    }
    
    // If all verification fails, treat it as connection failure
    console.error('❌ All verification methods failed. Closing connection.');
    electrumClient.close();
    electrumClient = null;
    throw new Error('Electrum server protocol verification failed.');
    
  } catch (error: any) {
    console.error('Electrum connection failed:', error);
    if (electrumClient) {
      try {
        electrumClient.close();
      } catch (e) {
        // Silent fail
      }
    }
    electrumClient = null;
    throw new Error(`Failed to connect to Electrum server: ${error.message}`);
  }
}

// --- Reserve/release helper ---
function reserveUtxoKey(txid: string, vout: number): void {
  inFlightUtxos.add(`${txid}:${vout}`);
}

function releaseUtxoKey(txid: string, vout: number): void {
  inFlightUtxos.delete(`${txid}:${vout}`);
}

// --- Get UTXO: Confirmed (minConf=1) + Unreserved only ---
async function getUTXOsWithFallback(client: ElectrumClientType, scriptHash: string, minConfirmations: number = 1): Promise<UTXO[]> {
  const utxoMethods = [
    async (): Promise<UTXO[]> => await client.request('blockchain.scripthash.listunspent', scriptHash),
    async (): Promise<UTXO[]> => {
      if (typeof client.blockchainScripthash_listunspent === 'function') {
        return await client.blockchainScripthash_listunspent(scriptHash);
      } else {
        throw new Error('blockchainScripthash_listunspent method does not exist');
      }
    },
    async (): Promise<UTXO[]> => {
      if (typeof client.blockchain_scripthash_listunspent === 'function') {
        return await client.blockchain_scripthash_listunspent(scriptHash);
      } else {
        throw new Error('blockchain_scripthash_listunspent method does not exist');
      }
    },
    async (): Promise<UTXO[]> => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client));
      const possibleMethods = [
        'blockchainScripthash_listunspent',
        'blockchain_scripthash_listunspent', 
        'listunspent',
        'scripthash_listunspent'
      ];
      for (const methodName of possibleMethods) {
        if (typeof (client as any)[methodName] === 'function') {
          return await (client as any)[methodName](scriptHash);
        }
      }
      throw new Error('No appropriate UTXO lookup method found');
    },
    async (): Promise<UTXO[]> => {
      if (client.connection && client.connection.socket) {
        const id = Math.random().toString(36).substring(7);
        const request = { id, method: 'blockchain.scripthash.listunspent', params: [scriptHash] };
        return new Promise<UTXO[]>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('UTXO lookup timeout')), 10000);
          const messageHandler = (data: any) => {
            try {
              const response = JSON.parse(data);
              if (response.id === id) {
                clearTimeout(timeout);
                client.connection.socket.removeListener('data', messageHandler);
                if (response.error) reject(new Error(response.error.message || 'Unknown error'));
                else resolve(response.result);
              }
            } catch {
              // Silent fail for JSON parsing
            }
          };
          client.connection.socket.on('data', messageHandler);
          client.connection.socket.write(JSON.stringify(request) + '\n');
        });
      } else {
        throw new Error('Socket connection does not exist');
      }
    }
  ];

  for (let i = 0; i < utxoMethods.length; i++) {
    try {
      const result = await utxoMethods[i]();
      if (Array.isArray(result)) {
        // Confirmed + Unreserved + Dust removal
        return result.filter((u: UTXO) => {
          const isConfirmed = (u.height && u.height > 0) || minConfirmations === 0;
          const key = `${u.tx_hash}:${u.tx_pos}`;
          const notReserved = !inFlightUtxos.has(key);
          const notDust = typeof u.value === 'number' ? u.value >= 546 : true;
          return isConfirmed && notReserved && notDust;
        });
      } else {
        console.log(`[UTXO warning] Unexpected result format:`, typeof result, result);
        return result as UTXO[];
      }
    } catch (error: any) {
      console.log(`UTXO lookup method ${i + 1} failed: ${error.message}`);
      continue;
    }
  }
  throw new Error('All UTXO lookup methods failed.');
}

// --- Get transaction function ---
async function getTransactionWithFallback(client: ElectrumClientType, txid: string): Promise<string> {
  const txMethods = [
    // Method 1: Official blockchain.transaction.get protocol
    async (): Promise<string> => {
      return await client.request('blockchain.transaction.get', txid);
    },
    // Method 2: Official blockchain.transaction.get protocol without verbose flag
    async (): Promise<string> => {
      return await client.request('blockchain.transaction.get', txid, false);
    },
    // Method 3: Underscore-style method (exact method name)
    async (): Promise<string> => {
      return await client.blockchainTransaction_get!(txid);
    },
    // Method 4: Other underscore-style method
    async (): Promise<string> => {
      if (typeof client.blockchain_transaction_get === 'function') {
        return await client.blockchain_transaction_get(txid);
      } else {
        throw new Error('blockchain_transaction_get method does not exist');
      }
    },
    // Method 5: Direct method call
    async (): Promise<string> => {
      if ((client as any).blockchainTransaction && typeof (client as any).blockchainTransaction.get === 'function') {
        return await (client as any).blockchainTransaction.get(txid);
      } else {
        throw new Error('blockchainTransaction.get method does not exist');
      }
    },
    // Method 6: Raw JSON-RPC call
    async (): Promise<string> => {
      if (client.connection && client.connection.socket) {
        const id = Math.random().toString(36).substring(7);
        const request = {
          id: id,
          method: 'blockchain.transaction.get',
          params: [txid]
        };
        
        return new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Transaction lookup timeout'));
          }, 10000);
          
          const messageHandler = (data: any) => {
            try {
              const response = JSON.parse(data);
              if (response.id === id) {
                clearTimeout(timeout);
                client.connection.socket.removeListener('data', messageHandler);
                if (response.error) {
                  reject(new Error(response.error.message || 'Unknown error'));
                } else {
                  resolve(response.result);
                }
              }
            } catch (e) {
              // JSON parsing error ignored
            }
          };
          
          client.connection.socket.on('data', messageHandler);
          client.connection.socket.write(JSON.stringify(request) + '\n');
        });
      } else {
        throw new Error('Socket connection does not exist');
      }
    }
  ];

  for (let i = 0; i < txMethods.length; i++) {
    try {
      const result = await txMethods[i]();
      console.log(`✅ Transaction lookup success (method ${i + 1}):`, typeof result === 'string' ? `${result.substring(0, 100)}...` : result);
      return result;
    } catch (error: any) {
      console.log(`Transaction lookup method ${i + 1} failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All transaction lookup methods failed: ${txid}`);
}

// --- Broadcast (multiple attempts + backoff) ---
async function broadcastTransactionWithFallback(client: ElectrumClientType, transactionHex: string, attempts: number = 3): Promise<string> {
  const methods = [
    async (): Promise<string> => await client.request('blockchain.transaction.broadcast', transactionHex),
    async (): Promise<string> => {
      if (typeof client.blockchainTransaction_broadcast === 'function') {
        return await client.blockchainTransaction_broadcast(transactionHex);
      } else {
        throw new Error('blockchainTransaction_broadcast method does not exist');
      }
    },
    async (): Promise<string> => {
      if (typeof client.blockchain_transaction_broadcast === 'function') {
        return await client.blockchain_transaction_broadcast(transactionHex);
      } else {
        throw new Error('blockchain_transaction_broadcast method does not exist');
      }
    },
    async (): Promise<string> => {
      const possible = ['blockchainTransaction_broadcast','blockchain_transaction_broadcast','broadcast','sendrawtransaction'];
      for (const n of possible) {
        if (typeof (client as any)[n] === 'function') return await (client as any)[n](transactionHex);
      }
      throw new Error('No appropriate broadcast method found');
    },
    async (): Promise<string> => {
      if (client.connection && client.connection.socket) {
        const id = Math.random().toString(36).substring(7);
        const request = { id, method: 'blockchain.transaction.broadcast', params: [transactionHex] };
        return new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Broadcast timeout')), 30000);
          const messageHandler = (data: any) => {
            try {
              const response = JSON.parse(data);
              if (response.id === id) {
                clearTimeout(timeout);
                client.connection.socket.removeListener('data', messageHandler);
                if (response.error) reject(new Error(response.error.message || 'Unknown error'));
                else resolve(response.result);
              }
            } catch {
              // Silent fail for JSON parsing
            }
          };
          client.connection.socket.on('data', messageHandler);
          client.connection.socket.write(JSON.stringify(request) + '\n');
        });
      } else {
        throw new Error('Socket connection does not exist');
      }
    }
  ];

  for (let a = 0; a < attempts; a++) {
    for (let i = 0; i < methods.length; i++) {
      try {
        const result = await methods[i]();
        console.log(`✅ Transaction broadcast success (method ${i + 1}). TXID:`, result);
        if (typeof result === 'string' && result.length === 64) return result;
        return result;
      } catch (error: any) {
        const msg = error?.message || String(error);
        console.log(`Broadcast method ${i + 1} failed: ${msg}`);
        if (i === methods.length - 1 && a < attempts - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, a))); // 1s -> 2s
        }
        if (i === methods.length - 1 && a === attempts - 1) {
          throw new Error(msg);
        }
      }
    }
  }
  throw new Error('All transaction broadcast methods failed');
}

// Address resolution (priority: username -> message)
function resolveUserPayoutAddress(userDoc: UserDocument): AddressResolution | null {
  const candidates = [
    { field: 'username', value: userDoc?.username },
    { field: 'message', value: userDoc?.message },
  ];
  for (const c of candidates) {
    const addr = typeof c.value === 'string' ? c.value.trim() : '';
    if (addr && isValidBitcoinAddress(addr, NETWORK)) {
      return { address: addr, source: c.field };
    }
  }
  return null;
}

// Fee estimation: Electrum estimatefee → sat/vB conversion, reasonable range correction
async function estimateFeeRateSatVb(client: ElectrumClientType, targets: number[] = [2, 3, 6], fallbackSatVb: number = 15): Promise<number> {
  const sats: number[] = [];
  for (const t of targets) {
    try {
      // estimatefee returns BTC/kB
      const btcPerKb = await client.request('blockchain.estimatefee', t);
      if (typeof btcPerKb === 'number' && isFinite(btcPerKb) && btcPerKb > 0) {
        const satPerVb = Math.max(1, Math.round((btcPerKb * 1e8) / 1000)); // 1 kB ≈ 1000 vB
        sats.push(satPerVb);
      }
    } catch {
      // Silent fail for fee estimation
    }
  }
  const est = sats.length ? Math.min(...sats) : fallbackSatVb;
  return Math.max(5, Math.min(est, 200)); // 5~200 range clamp
}

// UTXO sorting helper: highest value first
function sortUtxosByValueDesc(utxos: UTXO[]): UTXO[] {
  return [...utxos].sort((a, b) => (b.value || 0) - (a.value || 0));
}

// Selection logic: Confirmed first → Unconfirmed if insufficient (chain length limit)
function trySelectInputs(confirmed: UTXO[], unconfirmed: UTXO[], needAmount: number, feePerVb: number, addrType: string): InputSelection {
  const SIZE_PER_IN = addrType === 'p2wpkh' ? 68 : 91;
  const SIZE_PER_OUT = 34;
  const BASE_SIZE = 10;

  const selected: UTXO[] = [];
  let total = 0;
  let inputs = 0;
  const add = (u: UTXO) => {
    selected.push(u);
    total += u.value;
    inputs += 1;
  };

  const pickFrom = (list: UTXO[]) => {
    for (const u of list) {
      const estSize = BASE_SIZE + (inputs + 1) * SIZE_PER_IN + 2 * SIZE_PER_OUT;
      const estFee = Math.ceil(estSize * feePerVb);
      if (total >= needAmount + estFee) break;
      add(u);
    }
  };

  pickFrom(sortUtxosByValueDesc(confirmed));
  const estSizeNow = BASE_SIZE + inputs * SIZE_PER_IN + 2 * SIZE_PER_OUT;
  const estFeeNow = Math.ceil(estSizeNow * feePerVb);
  if (total >= needAmount + estFeeNow) {
    return { selected, total };
  }

  const MAX_UNCONF_CHAIN = 20;
  const unconfSorted = sortUtxosByValueDesc(unconfirmed);
  let usedUnconf = 0;
  for (const u of unconfSorted) {
    const estSize = BASE_SIZE + (inputs + 1) * SIZE_PER_IN + 2 * SIZE_PER_OUT;
    const estFee = Math.ceil(estSize * feePerVb);
    if (total >= needAmount + estFee) break;
    if (usedUnconf >= MAX_UNCONF_CHAIN) break;
    add(u);
    usedUnconf += 1;
  }

  return { selected, total };
}

// --- Bitcoin address validation function (mainnet only) ---
function isValidBitcoinAddress(address: string, network: any): boolean {
  try {
    bitcoin.address.toOutputScript(address, network);
    return true;
  } catch (e) {
    return false;
  }
}

function calculateScriptHash(address: string): string {
  try {
    // Create output script from address
    const outputScript = bitcoin.address.toOutputScript(address, NETWORK);
    
    // Use Node.js crypto module to calculate SHA-256 hash
    const hash = nodeCrypto.createHash('sha256').update(outputScript).digest();
    
    // Electrum protocol requires hash to be reversed
    return Buffer.from(hash).reverse().toString('hex');
  } catch (error: any) {
    console.error(`[BTC error] Script hash calculation failed: ${error.message}`);
    throw new Error(`Script hash calculation error: ${error.message}`);
  }
}

// sendBitcoin internal update version (external signature same)
async function sendBitcoin(recipientAddress: string, amountSatoshis: number, addressType: string = 'p2sh-p2wpkh'): Promise<string> {
  
  const client = await connectToElectrum();

  const keyPair = createSimpleKeyPair(); // Keep existing logic (must use the same address for funds)
  let addressInfo: AddressInfo;
  
  if (addressType === 'p2pkh') {
    const p2pkh = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: NETWORK });
    addressInfo = { address: p2pkh.address!, type: 'p2pkh' };
  } else if (addressType === 'p2wpkh') {
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: NETWORK });
    addressInfo = { address: p2wpkh.address!, type: 'p2wpkh' };
  } else {
    addressInfo = createP2SHSegwitAddress(keyPair);
    addressInfo.type = 'p2sh-p2wpkh';
  }
  const faucetAddress = addressInfo.address;

  const scriptHash = calculateScriptHash(faucetAddress);

  // 1) Dynamic fee
  const FEE_PER_VB = await estimateFeeRateSatVb(client, [2, 3, 6], 15);

  // 2) UTXO lookup: Confirmed first
  const utxosConf = await getUTXOsWithFallback(client, scriptHash, 1);
  const utxosAny = await getUTXOsWithFallback(client, scriptHash, 0);
  // Unconfirmed have height===0
  const utxosUnconf = utxosAny.filter(u => (!u.height || u.height === 0));

  if ((!utxosConf || utxosConf.length === 0) && (!utxosUnconf || utxosUnconf.length === 0)) {
    throw new Error('No available UTXO for the sender address');
  }

  // 3) Coin selection: Confirmed → Unconfirmed (chain length limit)
  const { selected, total } = trySelectInputs(utxosConf, utxosUnconf, amountSatoshis, FEE_PER_VB, addressInfo.type);
  if (!selected.length) throw new Error('Input selection failed');

  // Reservation
  for (const u of selected) reserveUtxoKey(u.tx_hash, u.tx_pos);

  // PSBT construction
  const psbt = new bitcoin.Psbt({ network: NETWORK });

  // Add input with RBF signaling (sequence < 0xffffffff)
  for (const u of selected) {
    let rawTxHex: string | undefined;
    try { 
      rawTxHex = await getTransactionWithFallback(client, u.tx_hash); 
    } catch {
      // Silent fail for transaction retrieval
    }

    const common = { hash: u.tx_hash, index: u.tx_pos, sequence: 0xfffffffd }; // RBF on
    
    if (addressInfo.type === 'p2pkh') {
      if (!rawTxHex) {
        selected.forEach(x => releaseUtxoKey(x.tx_hash, x.tx_pos));
        throw new Error('nonWitnessUtxo required but lookup failed');
      }
      psbt.addInput({ ...common, nonWitnessUtxo: Buffer.from(rawTxHex, 'hex') });
    } else if (addressInfo.type === 'p2wpkh') {
      const p2wpkhScript = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: NETWORK }).output!;
      psbt.addInput({ ...common, witnessUtxo: { script: p2wpkhScript, value: BigInt(u.value) } });
    } else {
      let witnessUtxo: { script: Buffer; value: bigint } | undefined;
      
      if (rawTxHex) {
        try {
          const prevTx = bitcoin.Transaction.fromHex(rawTxHex);
          const output = prevTx.outs[u.tx_pos];
          witnessUtxo = { script: Buffer.from(output.script), value: BigInt(u.value) };
        } catch {
          // Silent fail for transaction parsing
        }
      }
      
      if (!witnessUtxo) {
        const p2shScript = bitcoin.address.toOutputScript(faucetAddress, NETWORK);
        witnessUtxo = { script: Buffer.from(p2shScript), value: BigInt(u.value) };
      }
      
      psbt.addInput({ 
        ...common, 
        witnessUtxo, 
        redeemScript: Buffer.from(addressInfo.redeemScript!) 
      });
    }
  }

  // Recalculate size/fee (roughly)
  const SIZE_PER_IN = addressInfo.type === 'p2wpkh' ? 68 : 91;
  const SIZE_PER_OUT = 34;
  const BASE_SIZE = 10;
  const inputsAdded = selected.length;
  const estSize = BASE_SIZE + inputsAdded * SIZE_PER_IN + 2 * SIZE_PER_OUT;
  const fee = Math.ceil(estSize * FEE_PER_VB);

  if (total < amountSatoshis + fee) {
    selected.forEach(u => releaseUtxoKey(u.tx_hash, u.tx_pos));
    throw new Error(`Insufficient balance: needed=${amountSatoshis + fee}, available=${total}`);
  }

  const changeAmount = total - amountSatoshis - fee;

  psbt.addOutput({ address: recipientAddress, value: BigInt(amountSatoshis) });
  if (changeAmount > 0) psbt.addOutput({ address: faucetAddress, value: BigInt(changeAmount) });

  // Sign and finalize (keep existing logic)
  for (let i = 0; i < inputsAdded; i++) {
    if (addressInfo.type === 'p2pkh' || addressInfo.type === 'p2wpkh') {
      psbt.signInput(i, keyPair);
    } else {
      const methods = [
        (): void => { 
          const t = bitcoin.Transaction.SIGHASH_ALL | 16; 
          (psbt.data.inputs[i] as any).sighashType = t; 
          psbt.signInput(i, keyPair, [t]); 
        },
        (): void => { 
          (psbt.data.inputs[i] as any).sighashType = 0x10; 
          psbt.signInput(i, keyPair, [0x10]); 
        },
        (): void => { 
          (psbt.data.inputs[i] as any).sighashType = 0x10; 
          psbt.signInput(i, keyPair); 
        },
      ];
      
      let ok = false;
      for (const m of methods) { 
        try { 
          m(); 
          ok = true; 
          break; 
        } catch {
          // Silent fail for signing attempts
        }
      }
      
      if (!ok) {
        selected.forEach(u => releaseUtxoKey(u.tx_hash, u.tx_pos));
        throw new Error(`Input ${i + 1} signing failed`);
      }
    }
  }

  try {
    for (let i = 0; i < inputsAdded; i++) {
      if (addressInfo.type === 'p2pkh' || addressInfo.type === 'p2wpkh') {
        psbt.finalizeInput(i);
      } else {
        psbt.finalizeInput(i, (inputIndex: number, input: any) => {
          if (!input.partialSig || input.partialSig.length === 0) throw new Error('partialSig not found');
          
          const { signature, pubkey } = input.partialSig[0];
          const sigBuf = Buffer.from(signature);
          const pubkeyBuf = Buffer.from(pubkey);
          const finalScriptWitness = Buffer.concat([
            Buffer.from([0x02]), 
            Buffer.from([sigBuf.length]), 
            sigBuf, 
            Buffer.from([pubkeyBuf.length]), 
            pubkeyBuf
          ]);
          
          const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuf, network: NETWORK });
          const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network: NETWORK });
          let finalScriptSig = p2sh.input;
          
          if (!finalScriptSig || finalScriptSig.length === 0) {
            const redeem = p2wpkh.output!;
            const len = redeem.length;
            finalScriptSig = len < 0x4c
              ? Buffer.concat([Buffer.from([len]), redeem])
              : Buffer.concat([Buffer.from([0x4c]), Buffer.from([len]), redeem]);
          }
          
          return { finalScriptSig, finalScriptWitness };
        });
      }
    }
  } catch (e: any) {
    selected.forEach(u => releaseUtxoKey(u.tx_hash, u.tx_pos));
    throw e;
  }

  try {
    const txId = await broadcastTransactionWithFallback(client, psbt.extractTransaction().toHex(), 3);
    // Input UTXO reservation is kept (avoid reuse)
    return txId;
  } catch (error: any) {
    selected.forEach(u => releaseUtxoKey(u.tx_hash, u.tx_pos));
    throw new Error(`Transaction propagation error: ${error.message}`);
  }
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Invalid method' });
  }

  try {
    const { publicAddress } = req.body;

    // Send 1 test coins (1 * 100,000,000 satoshis = 100,000,000 satoshis)
    const COIN_AMOUNT = 1;
    const SATOSHIS_PER_COIN = 100000000; // 1 coin = 100,000,000 satoshis
    const amountInSatoshis = COIN_AMOUNT * SATOSHIS_PER_COIN;
    
    const txId = await sendBitcoin(publicAddress, amountInSatoshis);
    
    return res.status(200).json({
      success: true,
      message: `${COIN_AMOUNT} test coins have been sent successfully`,
      txId: txId,
    });
    
  } catch (error: any) {
    console.error('Error in Test Coin Faucet:', error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || 'Server error occurred. Please try again later.' 
    });
  }
} 