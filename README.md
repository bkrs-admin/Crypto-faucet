# Crypto Faucet - Get Your Testnet Coins Here!

#### Test URL: https://crypto-faucet-101.vercel.app/

#### Description

As a crypto enthusiast, I've always wanted to make crypto more accessible to people, so I built this platform and now it's possible with Crypto Faucet!

#### What is a 'Faucet'?

I assume you already know what a 'faucet' means, but you may wonder why it's used in the crypto world. The word "faucet" is used in crypto because it describes the way these platforms "drip" small amounts of cryptocurrency to users, similar to how a leaky water tap drips water. *(Source: Google search)*

#### How to Use This Faucet

Now that you know what it is, here's how to try this faucet:

It's a simple process:

1. **Read the manual and disclaimer carefully** and click the "Claim 5 Coins" button
2. **Enter your public address** where you want to receive the coins
3. **That's it!** You will receive the coins and can check them in your phone wallet app

#### What are Public Addresses and Wallet Apps?

The easiest way to explain this is to imagine your bank account:

##### Public Address
- **Think of it like your personal bank account number, but for crypto**
- You can use this to receive funds/coins from elsewhere
- It's safe to share this address with others to receive payments

##### Wallet App
- **Your personal banking system for crypto**
- Allows you to check your account balance and manage your received coins
- Shows transaction history and current holdings

##### MoTe Blockchain Integration
- This faucet uses the **MoTe Blockchain system** and its native coins (called "MoTe" coins)
- You can download the **"MoTe"** wallet app from:
  - **iOS**: AppStore
  - **Android**: PlayStore
- You can either create a new wallet or import an existing one if you already have it

#### How to run it locally

##### Local Environment Variables Set up
- **Private Key Set up**: Set up your FAUCET_PRIVATE_KEY in .env.local file
- **Electrum Server Setup**: Set up your electrum wallet server info via ELECTRUM_HOST, ELECTRUM_PORT, ELECTRUM_PROTOCOL in .env.local file
- **How to Connect to Your Own Blockchain**: Make sure comment or delete applyBitcoinJSPatch() and verifyBitcoinJSPatch() if you plan to use your own blockchain. Currently it has set up for patch bitcoin-jslib in order to use sign transaction for MoTe Blockchain.


#### Address Compatibility

##### Supported Addresses
- **Bitcoin-series addresses**: If you already have or use any Bitcoin-series address(es), you can use them
- **Note**: You can only check coins/funds through the MoTe Wallet app

##### Unsupported Addresses
- ❌ **Ethereum** addresses are not supported
- ❌ **Solana** addresses are not supported  
- ❌ Any other blockchain addresses are not supported

#### Features

- 🪙 **1 coins per claim**
- 🔄 **Maximum 10 claims per user** (50 total coins)
- 🔒 **User tracking via localStorage**
- 📱 **Mobile-friendly interface**
- 🔗 **Direct blockchain explorer integration**

#### Technical Stack

- **Frontend**: Next.js with React
- **Styling**: CSS Modules
- **User Management**: localStorage with UUID
- **Blockchain**: MoTe Network integration

