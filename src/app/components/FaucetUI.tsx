'use client';

import { useState, useRef, useEffect } from 'react';
import styles from '../page.module.css';
import { getUserId, updateClaimData, canMakeClaim, getClaimCount } from '../../utils/userStorage';

interface ResponseMessage {
  text: string;
  isError: boolean;
  txId?: string;
  amount?: number;
}

export default function FaucetUI() {
  const [address, setAddress] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseMessage, setResponseMessage] = useState<ResponseMessage | null>(null);
  const [showInfoSections, setShowInfoSections] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [canClaim, setCanClaim] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  const showApplyForm = () => {
    const userId = getUserId();
    console.log('User ID:', userId);
    
    setShowForm(true);
    setResponseMessage(null);
    setShowInfoSections(false);
    setAddress(''); 
  };

  const handleSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && address.trim() !== '') {
      e.preventDefault();
      await submitForm();
    }
  };

  const handleButtonSubmit = async () => {
    if (address.trim() !== '') {
      await submitForm();
    }
  };

  const submitForm = async () => {
    if (!canMakeClaim()) {
      setResponseMessage({
        text: 'Maximum claim limit exceeded. You have already claimed the maximum allowed amount.',
        isError: true
      });
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    setResponseMessage(null);
    
    try {
      const response = await fetch('/api/v1/request-mote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicAddress: address.trim() }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        updateClaimData(address.trim());
        setShowForm(false);
        setResponseMessage({
          text: data.message || 'Test coins have been sent successfully!',
          isError: false,
          txId: data.txId,
          amount: data.amount
        });
        
        setCanClaim(canMakeClaim());
        
        console.log('Claim count after update:', getClaimCount());
      } else {
        setResponseMessage({
          text: data.message || 'An error occurred while processing your request.',
          isError: true
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setResponseMessage({
        text: 'A connection error occurred. Please try again later.',
        isError: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const goToMainScreen = () => {
    setShowForm(false);
    setResponseMessage(null);
    setShowInfoSections(true);
    setAddress('');
  };

  useEffect(() => {
    if (showForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showForm]);

  useEffect(() => {
    setIsClient(true);
    setCanClaim(canMakeClaim());
  }, []);

  useEffect(() => {
    if (isClient) {
      setCanClaim(canMakeClaim());
    }
  }, [responseMessage, isClient]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>CRYPTO FAUCET</h1>
      <h4 className={styles.subtitle}>Get your testnet coins here.</h4>
      
      {showInfoSections && (
        <>
          <div className={styles.howto}>
            <h2>How to get testnet coins</h2>
            <ul>
              <li>In order to get the testnet coin, you need a Bitcoin-series public address.</li>
              <li>If you need a Bitcoin-series public address, download MoTe Wallet in the app store you are using and create a new wallet.</li>
              <li>After creating the wallet, enter the public address and receive the testnet coin.</li>
              <li>The amount of testnet coin is limited to 10 coins per person (10 claims × 1 coins).</li>
              <li>By clicking the Apply button below, you agree and are aware of the terms and conditions of the service.</li>
            </ul>
          </div>

          {!showForm && !responseMessage && isClient && canClaim && (
            <div className={styles.buttonContainer}>
              <button onClick={showApplyForm} className={styles.applyButton}>
                Claim 5 Coins
              </button>
            </div>
          )}

          {!showForm && !responseMessage && isClient && !canClaim && (
            <div className={styles.maxLimitMessage}>
              <h3>🚫 Maximum Limit Reached</h3>
              <p>You have already claimed the maximum allowed amount (10 coins).</p>
              <p>Thank you for using our faucet!</p>
            </div>
          )}

          <h3 className={styles.disclaimerTitle}>DISCLAIMER</h3>
          <div className={styles.disclaimer}>
            <p>- This testnet coin is not real money and does not have any value.</p>
            <p>- The developer of this service is not the creator of this testnet and does not sell it in any form.</p>
            <p>- The operator is not responsible for the transfer failure due to the address input error, etc.</p>
            <p>- The amount and conditions of the event are not guaranteed and the service can be changed/terminated at any time without notice.</p>
            <p>- The operator is not responsible for direct, indirect, special, incidental losses incurred by the use of the service.</p>
            <p>- The operator is not responsible for losses incurred by system errors, hacking, server down, etc.</p>
            <p>- The intellectual property rights of all contents of the service belong to the operator.</p>
            <p>- The use of macros, bots, etc. is prohibited.</p>
          </div>
        </>
      )}

      {showForm && (
        <div className={styles.formContainer}>
          <div className={styles.inputContainer}>
            <label htmlFor="address" className={styles.label}>
             Please enter your public address:
            </label> 
            <input
              ref={inputRef}
              type="text"
              id="address"
              value={address}
              onChange={handleInputChange}
              onKeyDown={handleSubmit}
              className={styles.input}
              placeholder="Enter your Bitcoin-series public address..."
              disabled={isSubmitting}
            />
            <span className={styles.labelSub}>Only Bitcoin-series public address is supported.</span>
            <br/>
            <button 
              onClick={handleButtonSubmit}
              className={styles.applyButton}
              disabled={isSubmitting || address.trim() === ''}
            >
              {isSubmitting ? 'Processing...' : 'Submit'}
            </button>
            
            {responseMessage && responseMessage.isError && (
              <div>
                <br/>
                <div className={styles.errorMessage}>
                  {responseMessage.text}
                </div>
                <br/>
                <div className={styles.buttonGroup}>
                  <button onClick={goToMainScreen} className={styles.mainButton}>
                    Return to Main
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {responseMessage && !responseMessage.isError && !showForm && (
        <div className={styles.successMessage}>
          <div className={styles.successContent}>
            <h3>🎉 Success!</h3>
            <p>{responseMessage.text}</p>
            {responseMessage.txId && (
              <div className={styles.transactionInfo}>
                <p><strong>Click to view the transaction on the blockchain:</strong></p>
                <a 
                  href={`https://mote.gnc.ne.kr/tx/${responseMessage.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txId}
                >
                  {responseMessage.txId}
                </a>
              </div>
            )}
            <br/>
            <div className={styles.buttonGroup}>
              <button onClick={showApplyForm} className={styles.againButton}>
                Send to Another Address
              </button>
              <button onClick={goToMainScreen} className={styles.mainButton}>
                Return to Main
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 