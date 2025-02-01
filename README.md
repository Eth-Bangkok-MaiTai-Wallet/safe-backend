# Project Overview

## Description

This application is designed to manage Safe smart accounts on the Ethereum blockchain, utilizing the ERC-4337 adaptor and Rhinestone ERC-7579 modules. It provides a secure and efficient way to handle multi-signature transactions and manage account ownership through a modular architecture. The application is built using the NestJS framework, offering a robust and scalable backend solution.

## Tech Stack

- **NestJS**: A progressive Node.js framework for building efficient and scalable server-side applications.
- **TypeScript**: A strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.
- **Ethereum Blockchain**: The application interacts with the Ethereum blockchain to manage smart accounts.
- **Safe**: A platform for managing smart contract-based accounts with multi-signature capabilities.
- **ERC-4337 Adaptor**: Facilitates account abstraction, allowing for more flexible and user-friendly smart contract interactions.
- **Rhinestone ERC-7579 Modules**: Provides additional functionality and security features for managing smart accounts.
- **Viem**: A library for interacting with Ethereum, used for account management and blockchain interactions.
- **Pimlico**: A service for handling blockchain transactions and operations.

## Installation and Running the Project

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: The JavaScript runtime environment.
- **Yarn**: A package manager for JavaScript.

### Steps to Install and Run

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install Dependencies**:
   ```bash
   yarn install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the root directory and add the necessary environment variables, such as `PRIVATE_KEY`, `PIMLICO_API_KEY`, and `ETHERSCAN_API_KEY`.

4. **Run the Application**:
   - For development:
     ```bash
     yarn run start:dev
     ```
   - For production:
     ```bash
     yarn run start:prod
     ```

5. **Access the Application**:
   The server will start on the default port 3000. You can access it at `http://localhost:3000`.
