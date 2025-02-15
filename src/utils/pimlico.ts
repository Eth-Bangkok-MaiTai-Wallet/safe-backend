export function getChainSlug(chainId: number): string | undefined {
  switch (chainId) {
    case 1:
      return 'mainnet';
    case 5:
      return 'goerli';
    case 10:
      return 'optimism';
    case 11155111:
      return 'sepolia';
    case 420:
      return 'optimism-sepolia';
    case 42161:
      return 'arbitrum';
    default:
      return undefined;
  }
} 